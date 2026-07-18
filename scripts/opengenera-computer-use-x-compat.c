#define _GNU_SOURCE

#include <X11/Xlib.h>
#include <X11/Xlibint.h>
#include <dlfcn.h>
#include <errno.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define COMPATIBILITY_EXTENSION_NUMBER (-20260717)
#define COMPATIBILITY_MAGIC UINT64_C(0x47454e4552415843)
#define LEGACY_MODIFIER_KEYS_PER_MODIFIER 18
#define LEGACY_MODIFIER_MAP_BYTES 144
#define LEGACY_SET_MODIFIER_REQUEST_BYTES 148
#define TRACKED_DISPLAY_FD_SLOTS 8

/*
 * The preserved VLM expects nonzero timestamps on core input events and a
 * successful result for one exact legacy modifier-map request.  The event
 * change is made at Xlib's typed API boundary.  The guest's main X connection,
 * however, is a raw protocol stream relayed by the VLM with write(2), so the
 * exact observed modifier setup is transformed at that relay boundary.
 *
 * XESetWireToEvent is installed independently on each Display.  Its saved
 * converters live in XExtData owned by that Display, so Xlib controls their
 * lifetime.  The wrapper delegates first and changes only a CurrentTime value
 * in the resulting typed XEvent.
 *
 * The private Xvfb modifier map is prepared before the VLM starts.  On a file
 * descriptor returned by a wrapped XOpenDisplay, and only for the exact byte
 * sequences fingerprinted below, the legacy GrabServer is replaced by an X11
 * NoOperation and SetModifierMapping is replaced by a same-size query for an
 * extension that the harness live-verifies as absent.  QueryExtension's
 * `present = 0` reply has the
 * same byte position and value as XSetModifierMapping's MappingSuccess status;
 * one request still produces one reply, so X11 sequence numbers are unchanged.
 * Ordinary writes and every non-matching X request are delegated byte-for-byte.
 */
typedef Bool (*wire_to_event_fn)(Display *, XEvent *, xEvent *);

struct display_compatibility {
  uint64_t magic;
  atomic_uint suppressed_server_grabs;
  wire_to_event_fn converters[LeaveNotify - KeyPress + 1];
};

/*
 * Observed map SHA-256:
 * a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466
 * Observed complete SetModifierMapping request SHA-256:
 * e17ca71a9780516bee282b09c5297660122fca7806a111dc00771748e850fc71
 */
static const unsigned char legacy_modifier_map[LEGACY_MODIFIER_MAP_BYTES] = {
    0x32, 0x3e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x25, 0x69, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x6c, 0xcc, 0xcd, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x71, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xe7, 0xcc, 0x92, 0x88, 0x7f, 0x6c,
    0x60, 0x54, 0x4a, 0x48, 0x47, 0x46, 0x45, 0x44, 0x43, 0x40, 0xcb, 0xcf,
    0x49, 0x85, 0x86, 0xce, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5c, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

static atomic_flag timestamp_log_once = ATOMIC_FLAG_INIT;
static atomic_flag modifier_fallback_log_once = ATOMIC_FLAG_INIT;
static atomic_flag untracked_grab_log_once = ATOMIC_FLAG_INIT;
static atomic_flag suppressed_ungrab_log_once = ATOMIC_FLAG_INIT;
static atomic_flag ungrab_log_once = ATOMIC_FLAG_INIT;
static atomic_flag relay_grab_log_once = ATOMIC_FLAG_INIT;
static atomic_flag relay_modifier_log_once = ATOMIC_FLAG_INIT;
static atomic_flag relay_partial_log_once = ATOMIC_FLAG_INIT;
static atomic_flag relay_mismatch_log_once = ATOMIC_FLAG_INIT;
static atomic_int tracked_display_fds[TRACKED_DISPLAY_FD_SLOTS] = {
    -1, -1, -1, -1, -1, -1, -1, -1,
};
static Display *(*real_x_open_display_fn)(const char *) = NULL;
static int (*real_x_close_display_fn)(Display *) = NULL;
static int (*real_x_grab_server_fn)(Display *) = NULL;
static int (*real_x_set_modifier_mapping_fn)(Display *, XModifierKeymap *) =
    NULL;
static int (*real_x_ungrab_server_fn)(Display *) = NULL;
static ssize_t (*real_write_fn)(int, const void *, size_t) = NULL;

enum relay_transform_kind {
  RELAY_TRANSFORM_NONE = 0,
  RELAY_TRANSFORM_GRAB = 1,
  RELAY_TRANSFORM_MODIFIER = 2,
};

struct relay_write_continuation {
  enum relay_transform_kind kind;
  int fd;
  size_t offset;
};

static _Thread_local struct relay_write_continuation relay_continuation = {
    RELAY_TRANSFORM_NONE, -1, 0};

__attribute__((constructor)) static void resolve_x_symbols(void) {
  real_x_open_display_fn =
      (Display *(*)(const char *))dlsym(RTLD_NEXT, "XOpenDisplay");
  real_x_close_display_fn =
      (int (*)(Display *))dlsym(RTLD_NEXT, "XCloseDisplay");
  real_x_grab_server_fn =
      (int (*)(Display *))dlsym(RTLD_NEXT, "XGrabServer");
  real_x_set_modifier_mapping_fn =
      (int (*)(Display *, XModifierKeymap *))dlsym(
          RTLD_NEXT, "XSetModifierMapping");
  real_x_ungrab_server_fn =
      (int (*)(Display *))dlsym(RTLD_NEXT, "XUngrabServer");
  real_write_fn =
      (ssize_t(*)(int, const void *, size_t))dlsym(RTLD_NEXT, "write");
}

static int track_display_fd(int fd) {
  size_t slot;

  for (slot = 0; slot < TRACKED_DISPLAY_FD_SLOTS; slot++) {
    int observed = atomic_load_explicit(&tracked_display_fds[slot],
                                        memory_order_relaxed);
    if (observed == fd) {
      return 1;
    }
    if (observed == -1) {
      int expected = -1;
      if (atomic_compare_exchange_strong_explicit(
              &tracked_display_fds[slot], &expected, fd,
              memory_order_relaxed, memory_order_relaxed)) {
        return 1;
      }
    }
  }
  return 0;
}

static void untrack_display_fd(int fd) {
  size_t slot;

  for (slot = 0; slot < TRACKED_DISPLAY_FD_SLOTS; slot++) {
    int expected = fd;
    (void)atomic_compare_exchange_strong_explicit(
        &tracked_display_fds[slot], &expected, -1,
        memory_order_relaxed, memory_order_relaxed);
  }
  if (relay_continuation.fd == fd) {
    relay_continuation.kind = RELAY_TRANSFORM_NONE;
    relay_continuation.fd = -1;
    relay_continuation.offset = 0;
  }
}

static int is_tracked_display_fd(int fd) {
  size_t slot;

  for (slot = 0; slot < TRACKED_DISPLAY_FD_SLOTS; slot++) {
    if (atomic_load_explicit(&tracked_display_fds[slot],
                             memory_order_relaxed) == fd) {
      return 1;
    }
  }
  return 0;
}

static ssize_t delegate_write(int fd, const void *buffer, size_t count) {
  if (real_write_fn != NULL) {
    return real_write_fn(fd, buffer, count);
  }
  return (ssize_t)syscall(SYS_write, fd, buffer, count);
}

static int free_compatibility_data(XExtData *extension) {
  struct display_compatibility *compatibility;

  if (extension == NULL) {
    return 0;
  }
  compatibility =
      (struct display_compatibility *)extension->private_data;
  if (compatibility != NULL && compatibility->magic == COMPATIBILITY_MAGIC) {
    compatibility->magic = 0;
    free(compatibility);
    extension->private_data = NULL;
  }
  return 0;
}

static XExtData **display_extension_list(Display *display) {
  return &((_XPrivDisplay)display)->ext_data;
}

static struct display_compatibility *compatibility_for(Display *display) {
  XExtData *extension;

  if (display == NULL) {
    return NULL;
  }
  for (extension = *display_extension_list(display); extension != NULL;
       extension = extension->next) {
    struct display_compatibility *compatibility;

    if (extension->number != COMPATIBILITY_EXTENSION_NUMBER ||
        extension->free_private != free_compatibility_data) {
      continue;
    }
    compatibility =
        (struct display_compatibility *)extension->private_data;
    if (compatibility != NULL && compatibility->magic == COMPATIBILITY_MAGIC) {
      return compatibility;
    }
  }
  return NULL;
}

static Time nonzero_event_time(void) {
  struct timespec observed;
  uint64_t milliseconds;
  Time result;

  if (clock_gettime(CLOCK_MONOTONIC, &observed) != 0) {
    return (Time)1;
  }
  milliseconds = (uint64_t)observed.tv_sec * 1000U;
  milliseconds += (uint64_t)observed.tv_nsec / 1000000U;
  result = (Time)(uint32_t)milliseconds;
  return result == CurrentTime ? (Time)1 : result;
}

static Time *event_time_field(XEvent *event, int event_type) {
  switch (event_type) {
  case KeyPress:
  case KeyRelease:
    return &event->xkey.time;
  case ButtonPress:
  case ButtonRelease:
    return &event->xbutton.time;
  case MotionNotify:
    return &event->xmotion.time;
  case EnterNotify:
  case LeaveNotify:
    return &event->xcrossing.time;
  default:
    return NULL;
  }
}

static Bool convert_wire_event(Display *display, XEvent *event, xEvent *wire) {
  struct display_compatibility *compatibility = compatibility_for(display);
  int event_type = wire->u.u.type & 0x7f;
  wire_to_event_fn converter;
  Time *timestamp;
  Bool converted;

  if (compatibility == NULL || event_type < KeyPress ||
      event_type > LeaveNotify) {
    return False;
  }
  converter = compatibility->converters[event_type - KeyPress];
  if (converter == NULL || converter == convert_wire_event) {
    return False;
  }
  converted = converter(display, event, wire);
  if (!converted) {
    return False;
  }
  timestamp = event_time_field(event, event_type);
  if (timestamp != NULL && *timestamp == CurrentTime) {
    *timestamp = nonzero_event_time();
    if (!atomic_flag_test_and_set(&timestamp_log_once)) {
      fprintf(stderr,
              "computer-use normalized a zero X event timestamp at the "
              "Xlib conversion boundary: event-type=%d\n",
              event_type);
      fflush(stderr);
    }
  }
  return True;
}

static void detach_compatibility_extension(Display *display,
                                           XExtData *target) {
  XExtData **link;

  for (link = display_extension_list(display); *link != NULL;
       link = &(*link)->next) {
    if (*link == target) {
      *link = target->next;
      (void)free_compatibility_data(target);
      free(target);
      return;
    }
  }
}

static int install_event_converters(Display *display) {
  struct display_compatibility *compatibility;
  XExtData *extension;
  int event_type;

  compatibility =
      (struct display_compatibility *)calloc(1, sizeof(*compatibility));
  extension = (XExtData *)calloc(1, sizeof(*extension));
  if (compatibility == NULL || extension == NULL) {
    free(compatibility);
    free(extension);
    return 0;
  }
  compatibility->magic = COMPATIBILITY_MAGIC;
  extension->number = COMPATIBILITY_EXTENSION_NUMBER;
  extension->free_private = free_compatibility_data;
  extension->private_data = (XPointer)compatibility;
  (void)XAddToExtensionList(display_extension_list(display), extension);

  for (event_type = KeyPress; event_type <= LeaveNotify; event_type++) {
    wire_to_event_fn converter =
        XESetWireToEvent(display, event_type, convert_wire_event);
    compatibility->converters[event_type - KeyPress] = converter;
    if (converter == NULL || converter == convert_wire_event) {
      int restore_type;
      for (restore_type = KeyPress; restore_type <= event_type; restore_type++) {
        (void)XESetWireToEvent(
            display, restore_type,
            compatibility->converters[restore_type - KeyPress]);
      }
      detach_compatibility_extension(display, extension);
      return 0;
    }
  }
  return 1;
}

static int is_exact_legacy_modifier_request(const XModifierKeymap *modmap) {
  return modmap != NULL && modmap->modifiermap != NULL &&
         modmap->max_keypermod == LEGACY_MODIFIER_KEYS_PER_MODIFIER &&
         memcmp(modmap->modifiermap, legacy_modifier_map,
                sizeof(legacy_modifier_map)) == 0;
}

Display *XOpenDisplay(const char *display_name) {
  Display *display;

  if (real_x_open_display_fn == NULL) {
    errno = ENOSYS;
    return NULL;
  }
  display = real_x_open_display_fn(display_name);
  if (display == NULL) {
    return NULL;
  }
  if (!install_event_converters(display)) {
    fprintf(stderr,
            "computer-use could not install complete Xlib event "
            "compatibility hooks; closing the Display\n");
    fflush(stderr);
    (void)XCloseDisplay(display);
    errno = EIO;
    return NULL;
  }
  if (!track_display_fd(ConnectionNumber(display))) {
    fprintf(stderr,
            "computer-use exhausted its tracked X Display descriptor slots; "
            "closing the Display\n");
    fflush(stderr);
    (void)XCloseDisplay(display);
    errno = EMFILE;
    return NULL;
  }
  fprintf(stderr,
          "computer-use installed Xlib compatibility on Display=%p fd=%d\n",
          (void *)display, ConnectionNumber(display));
  fflush(stderr);
  return display;
}

int XCloseDisplay(Display *display) {
  int fd;

  if (display == NULL || real_x_close_display_fn == NULL) {
    errno = ENOSYS;
    return -1;
  }
  fd = ConnectionNumber(display);
  untrack_display_fd(fd);
  return real_x_close_display_fn(display);
}

static size_t build_relay_transform(enum relay_transform_kind kind,
                                    unsigned char *original,
                                    unsigned char *replacement) {
  static const unsigned char grab_then_get_modifier_mapping[] = {
      0x24, 0x00, 0x01, 0x00, 0x77, 0x00, 0x01, 0x00,
  };
  static const unsigned char set_modifier_header[4] = {
      0x76, LEGACY_MODIFIER_KEYS_PER_MODIFIER, 0x25, 0x00,
  };
  static const char absent_extension_prefix[] =
      "GENERA-COMPUTER-USE-LEGACY-MODIFIER-MAP-SUPPRESSED-";

  if (kind == RELAY_TRANSFORM_GRAB) {
    memcpy(original, grab_then_get_modifier_mapping,
           sizeof(grab_then_get_modifier_mapping));
    memcpy(replacement, original, sizeof(grab_then_get_modifier_mapping));
    replacement[0] = 0x7f; /* NoOperation */
    return sizeof(grab_then_get_modifier_mapping);
  }
  if (kind == RELAY_TRANSFORM_MODIFIER) {
    memcpy(original, set_modifier_header, sizeof(set_modifier_header));
    memcpy(original + sizeof(set_modifier_header), legacy_modifier_map,
           sizeof(legacy_modifier_map));
    memset(replacement, 'X', LEGACY_SET_MODIFIER_REQUEST_BYTES);
    replacement[0] = 0x62; /* QueryExtension */
    replacement[1] = 0x00;
    replacement[2] = 0x25; /* 37 four-byte units, little-endian */
    replacement[3] = 0x00;
    replacement[4] = 0x8c; /* 140 name bytes, little-endian */
    replacement[5] = 0x00;
    replacement[6] = 0x00;
    replacement[7] = 0x00;
    memcpy(replacement + 8, absent_extension_prefix,
           sizeof(absent_extension_prefix) - 1U);
    return LEGACY_SET_MODIFIER_REQUEST_BYTES;
  }
  return 0;
}

static ssize_t write_relay_transform(int fd, const void *buffer, size_t count,
                                     enum relay_transform_kind kind,
                                     size_t offset) {
  unsigned char original[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  unsigned char replacement[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  size_t total = build_relay_transform(kind, original, replacement);
  ssize_t written;

  if (total == 0 || offset > total || count > total - offset || buffer == NULL ||
      memcmp(buffer, original + offset, count) != 0) {
    if (!atomic_flag_test_and_set(&relay_mismatch_log_once)) {
      fprintf(stderr,
              "computer-use refused a mismatched continuation of an exact "
              "guest X compatibility write\n");
      fflush(stderr);
    }
    errno = EPROTO;
    return -1;
  }

  written = delegate_write(fd, replacement + offset, count);
  if (written >= 0 && (size_t)written < count) {
    relay_continuation.kind = kind;
    relay_continuation.fd = fd;
    relay_continuation.offset = offset + (size_t)written;
    if (!atomic_flag_test_and_set(&relay_partial_log_once)) {
      fprintf(stderr,
              "computer-use retained an exact guest X replacement across "
              "a partial write\n");
      fflush(stderr);
    }
  } else if (written >= 0) {
    size_t completed = offset + (size_t)written;
    if (completed == total) {
      atomic_flag *success_log =
          kind == RELAY_TRANSFORM_GRAB ? &relay_grab_log_once
                                       : &relay_modifier_log_once;
      if (!atomic_flag_test_and_set(success_log)) {
        fprintf(stderr,
                kind == RELAY_TRANSFORM_GRAB
                    ? "computer-use transformed the exact guest X modifier "
                      "setup: GrabServer -> NoOperation\n"
                    : "computer-use transformed the exact guest X modifier "
                      "setup: SetModifierMapping -> absent QueryExtension\n");
        fflush(stderr);
      }
      relay_continuation.kind = RELAY_TRANSFORM_NONE;
      relay_continuation.fd = -1;
      relay_continuation.offset = 0;
    } else {
      relay_continuation.kind = kind;
      relay_continuation.fd = fd;
      relay_continuation.offset = completed;
    }
  }
  return written;
}

ssize_t write(int fd, const void *buffer, size_t count) {
  unsigned char original[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  unsigned char replacement[LEGACY_SET_MODIFIER_REQUEST_BYTES];

  if (relay_continuation.kind != RELAY_TRANSFORM_NONE &&
      relay_continuation.fd == fd) {
    if (!is_tracked_display_fd(fd)) {
      relay_continuation.kind = RELAY_TRANSFORM_NONE;
      relay_continuation.fd = -1;
      relay_continuation.offset = 0;
      return delegate_write(fd, buffer, count);
    }
    return write_relay_transform(fd, buffer, count, relay_continuation.kind,
                                 relay_continuation.offset);
  }

  if (buffer != NULL && is_tracked_display_fd(fd) &&
      count == build_relay_transform(RELAY_TRANSFORM_GRAB, original,
                                     replacement) &&
      memcmp(buffer, original, count) == 0) {
    return write_relay_transform(fd, buffer, count, RELAY_TRANSFORM_GRAB, 0);
  }

  if (buffer != NULL && is_tracked_display_fd(fd) &&
      count == build_relay_transform(RELAY_TRANSFORM_MODIFIER, original,
                                     replacement) &&
      memcmp(buffer, original, count) == 0) {
    return write_relay_transform(fd, buffer, count,
                                 RELAY_TRANSFORM_MODIFIER, 0);
  }

  return delegate_write(fd, buffer, count);
}

int XSetModifierMapping(Display *display, XModifierKeymap *modmap) {
  int tracked_display = compatibility_for(display) != NULL;
  int exact_legacy_request = is_exact_legacy_modifier_request(modmap);

  if (tracked_display && exact_legacy_request) {
    fprintf(stderr,
            "computer-use acknowledged the exact legacy modifier map "
            "locally; the private Xvfb map was prepared before VLM launch\n");
    fflush(stderr);
    return MappingSuccess;
  }
  if (!atomic_flag_test_and_set(&modifier_fallback_log_once)) {
    fprintf(stderr,
            "computer-use delegated a non-matching XSetModifierMapping call: "
            "tracked-display=%d exact-legacy-request=%d max-keypermod=%d\n",
            tracked_display, exact_legacy_request,
            modmap == NULL ? -1 : modmap->max_keypermod);
    fflush(stderr);
  }
  if (real_x_set_modifier_mapping_fn == NULL) {
    errno = ENOSYS;
    return MappingFailed;
  }
  return real_x_set_modifier_mapping_fn(display, modmap);
}

int XGrabServer(Display *display) {
  struct display_compatibility *compatibility = compatibility_for(display);
  Display *dpy = display;

  if (compatibility == NULL) {
    if (!atomic_flag_test_and_set(&untracked_grab_log_once)) {
      fprintf(stderr,
              "computer-use delegated XGrabServer for an untracked "
              "Display=%p fd=%d\n",
              (void *)display,
              display == NULL ? -1 : ConnectionNumber(display));
      fflush(stderr);
    }
    if (real_x_grab_server_fn != NULL) {
      return real_x_grab_server_fn(display);
    }
    errno = ENOSYS;
    return 0;
  }

  /*
   * The inspected VLM has one XGrabServer call site, around its legacy
   * modifier-map setup.  This harness prepares that map before launch and
   * gives the VLM a dedicated private Xvfb, so excluding the automation
   * client while the old request is handled has no useful atomicity role.
   * Suppressing the grab also prevents a rejected old SetModifierMapping
   * request from indefinitely disabling every later museum client.
   */
  (void)atomic_fetch_add_explicit(&compatibility->suppressed_server_grabs, 1U,
                                  memory_order_relaxed);
  fprintf(stderr,
          "computer-use locally suppressed the tracked legacy "
          "XGrabServer request on the dedicated private Xvfb: "
          "Display=%p fd=%d\n",
          (void *)display, ConnectionNumber(display));
  fflush(stderr);
  SyncHandle();
  return 1;
}

int XUngrabServer(Display *display) {
  struct display_compatibility *compatibility = compatibility_for(display);
  Display *dpy = display;
  _X_UNUSED xReq *request;
  unsigned pending;

  if (compatibility == NULL) {
    if (real_x_ungrab_server_fn != NULL) {
      return real_x_ungrab_server_fn(display);
    }
    errno = ENOSYS;
    return 0;
  }

  pending = atomic_load_explicit(&compatibility->suppressed_server_grabs,
                                 memory_order_relaxed);
  while (pending > 0U) {
    if (atomic_compare_exchange_weak_explicit(
            &compatibility->suppressed_server_grabs, &pending, pending - 1U,
            memory_order_relaxed, memory_order_relaxed)) {
      if (!atomic_flag_test_and_set(&suppressed_ungrab_log_once)) {
        fprintf(stderr,
                "computer-use locally acknowledged the matching "
                "XUngrabServer request for a suppressed private-Xvfb grab\n");
        fflush(stderr);
      }
      SyncHandle();
      return 1;
    }
  }

  /*
   * Keep the UngrabServer request and its flush under one Display lock.  The
   * VLM has another Xlib input thread; calling the public XUngrabServer and
   * XFlush functions separately leaves a lock hand-off in which that thread
   * can begin waiting while the server is still grabbed by this client.
   */
  LockDisplay(dpy);
  GetEmptyReq(UngrabServer, request);
  _XFlush(dpy);
  UnlockDisplay(dpy);
  SyncHandle();
  if (!atomic_flag_test_and_set(&ungrab_log_once)) {
    fprintf(stderr,
            "computer-use atomically flushed the tracked XUngrabServer "
            "request\n");
    fflush(stderr);
  }
  return 1;
}
