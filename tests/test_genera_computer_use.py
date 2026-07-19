from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "genera-computer-use.py"
TIME_SERVER_SCRIPT = (
    REPOSITORY / "scripts" / "opengenera-computer-use-time-server.py"
)


def load_script():
    module_name = "genera_computer_use_for_tests"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


genera = load_script()


def load_time_server():
    module_name = "genera_time_server_for_tests"
    spec = importlib.util.spec_from_file_location(module_name, TIME_SERVER_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {TIME_SERVER_SCRIPT.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


time_server = load_time_server()


def repository_temporary_directory():
    build_dir = REPOSITORY / "build"
    build_dir.mkdir(exist_ok=True)
    return tempfile.TemporaryDirectory(dir=build_dir)


def completed(
    argv: list[str] | None = None,
    *,
    returncode: int = 0,
    stdout: str | bytes = "",
    stderr: str | bytes = "",
):
    return subprocess.CompletedProcess(argv or [], returncode, stdout, stderr)


class NamePathAndMarkerTests(unittest.TestCase):
    def test_names_and_labels_accept_only_bounded_portable_components(self) -> None:
        for name in ("default", "museum-1", "Genera_8.5", "a" * 64):
            with self.subTest(name=name):
                self.assertEqual(genera.validate_session_name(name), name)
        for name in (
            "",
            ".",
            "..",
            ".hidden",
            "-option",
            "has/slash",
            "has space",
            "caf\N{LATIN SMALL LETTER E WITH ACUTE}",
            "a" * 65,
        ):
            with self.subTest(name=name):
                with self.assertRaises(genera.HarnessError):
                    genera.validate_session_name(name)

        for label in ("screen", "after-login_1", "x" * 48):
            with self.subTest(label=label):
                self.assertEqual(genera.validate_label(label), label)
        for label in ("", ".", "..", "bad/label", "bad label", "x" * 49):
            with self.subTest(label=label):
                with self.assertRaises(genera.HarnessError):
                    genera.validate_label(label)

    def test_owned_roots_and_sessions_are_marked_and_unowned_ones_refused(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            unowned = base / "unowned"
            unowned.mkdir()
            keep = unowned / "keep"
            keep.write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(genera.HarnessError, "refusing to adopt"):
                genera.ensure_state_root(unowned)
            self.assertEqual(keep.read_text(encoding="utf-8"), "preserve")

            root = base / "owned" / "state"
            genera.ensure_state_root(root)
            self.assertEqual(
                (root / genera.STATE_ROOT_MARKER).read_text(encoding="ascii"),
                genera.STATE_ROOT_MARKER_CONTENT,
            )
            self.assertEqual(stat.S_IMODE(root.stat().st_mode), 0o700)
            self.assertEqual(
                stat.S_IMODE((root / genera.STATE_ROOT_MARKER).stat().st_mode),
                0o600,
            )

            session = root / "museum"
            genera.ensure_session_directory(session)
            self.assertEqual(
                (session / genera.SESSION_MARKER).read_text(encoding="ascii"),
                genera.SESSION_MARKER_CONTENT,
            )
            self.assertEqual(stat.S_IMODE(session.stat().st_mode), 0o700)
            self.assertEqual(
                stat.S_IMODE((session / genera.SESSION_MARKER).stat().st_mode),
                0o600,
            )
            self.assertIsNone(genera.require_session_directory(session))

            foreign = root / "foreign"
            foreign.mkdir()
            foreign_keep = foreign / "keep"
            foreign_keep.write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(genera.HarnessError, "unowned session"):
                genera.ensure_session_directory(foreign)
            self.assertEqual(foreign_keep.read_text(encoding="utf-8"), "preserve")

    def test_session_paths_cannot_escape_their_state_root(self) -> None:
        with repository_temporary_directory() as temporary:
            state_root = Path(temporary) / "state"
            state_root.mkdir()
            outside = Path(temporary) / "outside"
            outside.mkdir()
            (state_root / "escape").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(genera.HarnessError, "escapes"):
                genera.session_dir_for(state_root, "escape")

    def test_state_root_is_strictly_the_ignored_repository_root(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                genera.state_root_from(None), genera.DEFAULT_STATE_ROOT.resolve()
            )

        with tempfile.TemporaryDirectory() as temporary:
            alternate = Path(temporary) / "genera-state"
            with self.assertRaisesRegex(genera.HarnessError, "restricted"):
                genera.state_root_from(str(alternate))
            with mock.patch.dict(
                os.environ,
                {"GENERA_COMPUTER_USE_ROOT": str(alternate)},
                clear=True,
            ):
                with self.assertRaisesRegex(genera.HarnessError, "restricted"):
                    genera.state_root_from(None)

    def test_private_log_refuses_a_preexisting_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "outside.log"
            target.write_bytes(b"preserve")
            session_log = root / "vlm-generation-1.log"
            session_log.symlink_to(target)

            with self.assertRaisesRegex(genera.HarnessError, "symbolic link"):
                genera.open_private_append_log(session_log)

            self.assertEqual(target.read_bytes(), b"preserve")

    def test_prepare_refuses_unmarked_existing_runtime_before_deletion(self) -> None:
        with repository_temporary_directory() as temporary:
            session = Path(temporary) / "session"
            runtime = session / "runtime"
            runtime.mkdir(parents=True)
            keep = runtime / "licensed-data"
            keep.write_bytes(b"must survive")
            with mock.patch.object(
                genera, "remove_tree", wraps=genera.remove_tree
            ) as remove:
                with self.assertRaisesRegex(
                    genera.HarnessError, "private-runtime marker"
                ):
                    genera.prepare_session(
                        session,
                        {},
                        Path(temporary) / "archive",
                        "0" * 64,
                        fresh=True,
                    )
            remove.assert_not_called()
            self.assertEqual(keep.read_bytes(), b"must survive")


class PrivateRuntimeAndProvenanceTests(unittest.TestCase):
    def test_rendered_vlm_config_uses_only_sandbox_runtime_paths(self) -> None:
        config = genera.render_vlm_config()

        self.assertIn(f"genera.network: {genera.NETWORK_SPEC}", config)
        self.assertIn(
            f"genera.world: {genera.SANDBOX_RUNTIME / 'Genera-8-5.vlod'}",
            config,
        )
        self.assertIn(
            f"genera.debugger: {genera.SANDBOX_RUNTIME / 'VLM_debugger'}",
            config,
        )
        self.assertIn(
            f"genera.worldSearchPath: {genera.SANDBOX_RUNTIME}", config
        )
        self.assertIn(
            f"genera.coldLoad.geometry: {genera.COLD_LOAD_GEOMETRY}", config
        )
        self.assertNotIn(str(REPOSITORY), config)
        self.assertNotIn(".lm-home/opengenera/runtime", config)

    def test_x_compatibility_preload_is_scoped_to_each_open_display(
        self,
    ) -> None:
        source = (
            REPOSITORY
            / "scripts"
            / "opengenera-computer-use-x-compat.c"
        ).read_text(encoding="utf-8")

        self.assertIn("struct display_compatibility", source)
        self.assertIn("XExtData", source)
        self.assertIn("XESetWireToEvent", source)
        self.assertIn("free_compatibility_data", source)
        self.assertIn("COMPATIBILITY_MAGIC", source)
        self.assertIn("event_time_field", source)
        self.assertIn("*timestamp == CurrentTime", source)
        self.assertIn(
            "converter == NULL || converter == convert_wire_event",
            source,
        )
        self.assertIn(
            "modmap->max_keypermod == LEGACY_MODIFIER_KEYS_PER_MODIFIER",
            source,
        )
        self.assertIn(
            "memcmp(modmap->modifiermap, legacy_modifier_map",
            source,
        )
        self.assertIn(
            "a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466",
            source,
        )
        self.assertNotIn("ssize_t read(", source)
        self.assertNotIn("ssize_t recv(", source)
        self.assertNotIn("ssize_t readv(", source)
        self.assertNotIn("MSG_PEEK", source)
        self.assertNotIn("SO_COOKIE", source)
        self.assertNotIn("pthread_mutex", source)
        self.assertIn("int XCloseDisplay(Display *display)", source)
        self.assertIn("ssize_t write(int fd, const void *buffer", source)
        self.assertIn("is_tracked_display_fd(fd)", source)
        self.assertIn("struct relay_write_continuation", source)
        self.assertIn("SetModifierMapping -> absent QueryExtension", source)
        self.assertIn("GrabServer -> NoOperation", source)
        self.assertIn("return LEGACY_SET_MODIFIER_REQUEST_BYTES", source)
        self.assertIn("return delegate_write(fd, buffer, count);", source)
        self.assertIn("int XGrabServer(Display *display)", source)
        self.assertIn("suppressed_server_grabs", source)

        for forbidden in (
            "AF_PACKET",
            "SOCK_RAW",
            "tun0",
            "Genera-8-5",
            ".vlod",
            "\nssize_t send(",
            "\nssize_t recvfrom(",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)

        ungrab_body = source[source.index("int XUngrabServer(") :]
        self.assertLess(
            ungrab_body.index("LockDisplay(dpy);"),
            ungrab_body.index("GetEmptyReq(UngrabServer, request);"),
        )
        self.assertLess(
            ungrab_body.index("GetEmptyReq(UngrabServer, request);"),
            ungrab_body.index("_XFlush(dpy);"),
        )
        self.assertLess(
            ungrab_body.index("_XFlush(dpy);"),
            ungrab_body.index("UnlockDisplay(dpy);"),
        )
        self.assertIn("if (compatibility == NULL)", ungrab_body)
        self.assertNotIn("XFlush(display)", ungrab_body)

    def test_x_compatibility_runtime_observation_requires_both_markers(
        self,
    ) -> None:
        with repository_temporary_directory() as temporary:
            log = Path(temporary) / "vlm.log"
            state = {"launcher_log": str(log)}
            log.write_bytes(genera.RELAY_GRAB_MARKER + b"\n")
            self.assertIsNone(genera.read_x_compatibility_observations(state))

            log.write_bytes(
                genera.RELAY_GRAB_MARKER
                + b"\n"
                + genera.RELAY_MODIFIER_MARKER
                + b"\n"
            )
            observed = genera.read_x_compatibility_observations(state)
            self.assertIsNotNone(observed)
            assert observed is not None
            self.assertTrue(observed["guest_relay_grab_transformed"])
            self.assertTrue(
                observed["guest_relay_modifier_mapping_transformed"]
            )

            log.write_bytes(genera.RELAY_MISMATCH_MARKER + b"\n")
            with self.assertRaisesRegex(
                genera.HarnessError, "mismatched partial-write continuation"
            ):
                genera.read_x_compatibility_observations(state)

    @unittest.skipUnless(sys.platform.startswith("linux"), "Linux Xlib test")
    def test_x_compatibility_preload_c_behavior(self) -> None:
        if shutil.which("gcc") is None:
            self.skipTest("gcc is required for the C compatibility test")

        exact_map_hex = (
            "323e000000000000000000000000000000004200000000000000000000000000"
            "00000000256900000000000000000000000000000000406ccccd000000000000"
            "0000000000000000710000000000000000000000000000000000e7cc92887f6c"
            "60544a48474645444340cbcf498586ce00000000000000000000000000005c00"
            "00000000000000000000000000000000"
        )
        self.assertEqual(len(bytes.fromhex(exact_map_hex)), 144)
        self.assertEqual(
            hashlib.sha256(bytes.fromhex(exact_map_hex)).hexdigest(),
            "a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466",
        )

        harness_source = r'''
#define dlsym genera_test_dlsym
#include "opengenera-computer-use-x-compat.c"
#undef dlsym

#define CHECK(expression)                                                     \
  do {                                                                        \
    if (!(expression)) {                                                      \
      fprintf(stderr, "check failed at line %d: %s\n", __LINE__,             \
              #expression);                                                   \
      return __LINE__;                                                        \
    }                                                                         \
  } while (0)

struct fake_display_state {
  Display *display;
  wire_to_event_fn converters[128];
  wire_to_event_fn originals[LeaveNotify - KeyPress + 1];
  unsigned long serial_marker;
  int closed;
};

static struct fake_display_state fake_states[8];
static int fake_state_count;
static int fail_event_type = -1;
static Time fake_core_time;
static Bool fake_core_result = True;
static int real_modifier_calls;
static int real_grab_calls;
static int real_ungrab_calls;
static int flush_calls;
static int ungrab_request_calls;
static int close_calls;
static int free_private_calls;
static int fake_write_calls;
static int fake_write_fd;
static ssize_t fake_write_limit = -1;
static unsigned char fake_write_bytes[1024];
static size_t fake_write_bytes_count;

static int fake_x_close_display(Display *display);

static ssize_t fake_write(int fd, const void *buffer, size_t count) {
  size_t written = count;
  if (fake_write_limit >= 0 && (size_t)fake_write_limit < written) {
    written = (size_t)fake_write_limit;
    fake_write_limit = -1;
  }
  if (fake_write_bytes_count + written > sizeof(fake_write_bytes)) {
    errno = ENOSPC;
    return -1;
  }
  memcpy(fake_write_bytes + fake_write_bytes_count, buffer, written);
  fake_write_bytes_count += written;
  fake_write_calls++;
  fake_write_fd = fd;
  return (ssize_t)written;
}

static void reset_fake_write(void) {
  memset(fake_write_bytes, 0, sizeof(fake_write_bytes));
  fake_write_bytes_count = 0;
  fake_write_calls = 0;
  fake_write_fd = -1;
  fake_write_limit = -1;
}

static struct fake_display_state *fake_state_for(Display *display) {
  int index;
  for (index = 0; index < fake_state_count; index++) {
    if (fake_states[index].display == display) {
      return &fake_states[index];
    }
  }
  return NULL;
}

static Bool fake_core_common(Display *display, XEvent *event, xEvent *wire,
                             unsigned long serial_marker) {
  int event_type = wire->u.u.type & 0x7f;
  Time *timestamp;
  if (!fake_core_result) {
    return False;
  }
  memset(event, 0, sizeof(*event));
  event->xany.type = event_type;
  event->xany.serial = serial_marker;
  event->xany.display = display;
  timestamp = event_time_field(event, event_type);
  if (timestamp != NULL) {
    *timestamp = fake_core_time;
  }
  return True;
}

static Bool fake_core_first(Display *display, XEvent *event, xEvent *wire) {
  return fake_core_common(display, event, wire, 0x1111UL);
}

static Bool fake_core_second(Display *display, XEvent *event, xEvent *wire) {
  return fake_core_common(display, event, wire, 0x2222UL);
}

static Display *fake_x_open_display(const char *name) {
  struct fake_display_state *state;
  _XPrivDisplay display;
  wire_to_event_fn original;
  int event_type;

  (void)name;
  if (fake_state_count >= 8) {
    return NULL;
  }
  display = (_XPrivDisplay)calloc(1, sizeof(*display));
  if (display == NULL) {
    return NULL;
  }
  display->fd = 40 + fake_state_count;
  state = &fake_states[fake_state_count];
  memset(state, 0, sizeof(*state));
  state->display = (Display *)display;
  state->serial_marker =
      fake_state_count == 0 ? 0x1111UL : 0x2222UL;
  original =
      fake_state_count == 0 ? fake_core_first : fake_core_second;
  for (event_type = 0; event_type < 128; event_type++) {
    state->converters[event_type] = original;
  }
  for (event_type = KeyPress; event_type <= LeaveNotify; event_type++) {
    state->originals[event_type - KeyPress] = original;
  }
  fake_state_count++;
  return state->display;
}

static int fake_x_set_modifier_mapping(Display *display,
                                       XModifierKeymap *modmap) {
  (void)display;
  (void)modmap;
  real_modifier_calls++;
  return MappingBusy;
}

static int fake_x_grab_server(Display *display) {
  (void)display;
  real_grab_calls++;
  return 71;
}

static int fake_x_ungrab_server(Display *display) {
  (void)display;
  real_ungrab_calls++;
  return 73;
}

void *genera_test_dlsym(void *handle, const char *name) {
  (void)handle;
  if (strcmp(name, "XOpenDisplay") == 0) {
    return (void *)fake_x_open_display;
  }
  if (strcmp(name, "XCloseDisplay") == 0) {
    return (void *)fake_x_close_display;
  }
  if (strcmp(name, "XSetModifierMapping") == 0) {
    return (void *)fake_x_set_modifier_mapping;
  }
  if (strcmp(name, "XGrabServer") == 0) {
    return (void *)fake_x_grab_server;
  }
  if (strcmp(name, "XUngrabServer") == 0) {
    return (void *)fake_x_ungrab_server;
  }
  if (strcmp(name, "write") == 0) {
    return (void *)fake_write;
  }
  return NULL;
}

int XAddToExtensionList(XExtData **list, XExtData *extension) {
  extension->next = *list;
  *list = extension;
  return 1;
}

wire_to_event_fn XESetWireToEvent(Display *display, int event_type,
                                  wire_to_event_fn converter) {
  struct fake_display_state *state = fake_state_for(display);
  wire_to_event_fn previous;
  if (state == NULL || event_type < 0 || event_type >= 128) {
    return NULL;
  }
  previous = state->converters[event_type];
  state->converters[event_type] = converter;
  if (event_type == fail_event_type) {
    return NULL;
  }
  return previous;
}

static xReq fake_ungrab_request;

void *_XGetRequest(Display *display, CARD8 type, size_t length) {
  (void)display;
  if (type != X_UngrabServer || length != SIZEOF(xReq)) {
    return NULL;
  }
  memset(&fake_ungrab_request, 0, sizeof(fake_ungrab_request));
  fake_ungrab_request.reqType = type;
  ungrab_request_calls++;
  return &fake_ungrab_request;
}

void _XFlush(Display *display) {
  (void)display;
  flush_calls++;
}

static int fake_x_close_display(Display *display) {
  struct fake_display_state *state = fake_state_for(display);
  XExtData *extension;
  XExtData *next;
  if (state == NULL) {
    return 0;
  }
  close_calls++;
  state->closed = 1;
  extension = ((_XPrivDisplay)display)->ext_data;
  ((_XPrivDisplay)display)->ext_data = NULL;
  while (extension != NULL) {
    next = extension->next;
    if (extension->free_private != NULL) {
      if (extension->free_private == free_compatibility_data) {
        free_private_calls++;
      }
      (void)extension->free_private(extension);
    }
    free(extension);
    extension = next;
  }
  return 0;
}

static Bool dispatch_event(Display *display, int event_type,
                           Time initial_time, XEvent *event) {
  struct fake_display_state *state = fake_state_for(display);
  xEvent wire;
  memset(&wire, 0, sizeof(wire));
  wire.u.u.type = (BYTE)event_type;
  fake_core_time = initial_time;
  return state->converters[event_type & 0x7f](display, event, &wire);
}

int main(void) {
  Display *first;
  Display *second;
  Display *untracked;
  Display *failed;
  struct fake_display_state *first_state;
  struct fake_display_state *second_state;
  XEvent event;
  XModifierKeymap map;
  unsigned char map_bytes[LEGACY_MODIFIER_MAP_BYTES];
  unsigned char relay_original[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  unsigned char relay_replacement[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  unsigned char wrong_tail[LEGACY_SET_MODIFIER_REQUEST_BYTES];
  size_t relay_length;
  int first_fd;
  int event_type;
  int saved_modifier_calls;
  int (*saved_modifier_fn)(Display *, XModifierKeymap *);
  Display *(*saved_open_fn)(const char *);

  first = XOpenDisplay("first");
  second = XOpenDisplay("second");
  CHECK(first != NULL && second != NULL && first != second);
  first_state = fake_state_for(first);
  second_state = fake_state_for(second);
  CHECK(first_state != NULL && second_state != NULL);
  CHECK(compatibility_for(first) != NULL);
  CHECK(compatibility_for(second) != NULL);
  CHECK(((_XPrivDisplay)first)->ext_data !=
        ((_XPrivDisplay)second)->ext_data);
  first_fd = ConnectionNumber(first);

  for (event_type = KeyPress; event_type <= LeaveNotify; event_type++) {
    Time *timestamp;
    CHECK(dispatch_event(first, event_type, CurrentTime, &event));
    timestamp = event_time_field(&event, event_type);
    CHECK(timestamp != NULL && *timestamp != CurrentTime);
    CHECK(event.xany.serial == 0x1111UL);

    CHECK(dispatch_event(second, event_type, CurrentTime, &event));
    timestamp = event_time_field(&event, event_type);
    CHECK(timestamp != NULL && *timestamp != CurrentTime);
    CHECK(event.xany.serial == 0x2222UL);
  }

  CHECK(dispatch_event(first, KeyPress, (Time)0x12345678U, &event));
  CHECK(event.xkey.time == (Time)0x12345678U);
  CHECK(dispatch_event(first, KeyPress | 0x80, CurrentTime, &event));
  CHECK(event.xkey.time != CurrentTime);
  fake_core_result = False;
  CHECK(!dispatch_event(first, MotionNotify, CurrentTime, &event));
  fake_core_result = True;
  CHECK(first_state->converters[Expose] == fake_core_first);
  CHECK(second_state->converters[Expose] == fake_core_second);

  memcpy(map_bytes, legacy_modifier_map, sizeof(map_bytes));
  map.max_keypermod = LEGACY_MODIFIER_KEYS_PER_MODIFIER;
  map.modifiermap = map_bytes;
  CHECK(XSetModifierMapping(first, &map) == MappingSuccess);
  CHECK(real_modifier_calls == 0);

  map_bytes[0] ^= 1;
  CHECK(XSetModifierMapping(first, &map) == MappingBusy);
  CHECK(real_modifier_calls == 1);
  map_bytes[0] ^= 1;
  map.max_keypermod--;
  CHECK(XSetModifierMapping(first, &map) == MappingBusy);
  CHECK(real_modifier_calls == 2);
  map.max_keypermod = LEGACY_MODIFIER_KEYS_PER_MODIFIER;

  relay_length = build_relay_transform(RELAY_TRANSFORM_GRAB, relay_original,
                                       relay_replacement);
  CHECK(relay_length == 8);
  CHECK(relay_replacement[0] == 0x7f && relay_replacement[4] == 0x77);
  reset_fake_write();
  CHECK(write(first_fd, relay_original, relay_length) == (ssize_t)relay_length);
  CHECK(fake_write_calls == 1 && fake_write_fd == first_fd);
  CHECK(fake_write_bytes_count == relay_length);
  CHECK(memcmp(fake_write_bytes, relay_replacement, relay_length) == 0);

  reset_fake_write();
  fake_write_limit = 3;
  CHECK(write(first_fd, relay_original, relay_length) == 3);
  CHECK(relay_continuation.kind == RELAY_TRANSFORM_GRAB);
  CHECK(relay_continuation.offset == 3);
  CHECK(write(first_fd, relay_original + 3, relay_length - 3) ==
        (ssize_t)(relay_length - 3));
  CHECK(relay_continuation.kind == RELAY_TRANSFORM_NONE);
  CHECK(fake_write_bytes_count == relay_length);
  CHECK(memcmp(fake_write_bytes, relay_replacement, relay_length) == 0);

  reset_fake_write();
  fake_write_limit = 3;
  CHECK(write(first_fd, relay_original, relay_length) == 3);
  memcpy(wrong_tail, relay_original + 3, relay_length - 3);
  wrong_tail[0] ^= 1;
  errno = 0;
  CHECK(write(first_fd, wrong_tail, relay_length - 3) == -1);
  CHECK(errno == EPROTO && fake_write_calls == 1);
  CHECK(write(first_fd, relay_original + 3, relay_length - 3) ==
        (ssize_t)(relay_length - 3));
  CHECK(relay_continuation.kind == RELAY_TRANSFORM_NONE);

  relay_length = build_relay_transform(RELAY_TRANSFORM_MODIFIER,
                                       relay_original, relay_replacement);
  CHECK(relay_length == LEGACY_SET_MODIFIER_REQUEST_BYTES);
  CHECK(relay_replacement[0] == 0x62 && relay_replacement[2] == 0x25);
  CHECK(relay_replacement[4] == 0x8c && relay_replacement[5] == 0x00);
  reset_fake_write();
  CHECK(write(first_fd, relay_original, relay_length) == (ssize_t)relay_length);
  CHECK(fake_write_bytes_count == relay_length);
  CHECK(memcmp(fake_write_bytes, relay_replacement, relay_length) == 0);

  reset_fake_write();
  fake_write_limit = 17;
  CHECK(write(first_fd, relay_original, relay_length) == 17);
  CHECK(relay_continuation.kind == RELAY_TRANSFORM_MODIFIER);
  CHECK(write(first_fd, relay_original + 17, relay_length - 17) ==
        (ssize_t)(relay_length - 17));
  CHECK(relay_continuation.kind == RELAY_TRANSFORM_NONE);
  CHECK(fake_write_bytes_count == relay_length);
  CHECK(memcmp(fake_write_bytes, relay_replacement, relay_length) == 0);

  untracked = fake_x_open_display("untracked");
  CHECK(untracked != NULL && compatibility_for(untracked) == NULL);
  CHECK(XSetModifierMapping(untracked, &map) == MappingBusy);
  CHECK(real_modifier_calls == 3);
  reset_fake_write();
  relay_length = build_relay_transform(RELAY_TRANSFORM_GRAB, relay_original,
                                       relay_replacement);
  CHECK(write(ConnectionNumber(untracked), relay_original, relay_length) ==
        (ssize_t)relay_length);
  CHECK(memcmp(fake_write_bytes, relay_original, relay_length) == 0);

  CHECK(XGrabServer(first) == 1);
  CHECK(real_grab_calls == 0);
  CHECK(XUngrabServer(first) == 1);
  CHECK(real_ungrab_calls == 0 && ungrab_request_calls == 0 &&
        flush_calls == 0);
  CHECK(XUngrabServer(first) == 1);
  CHECK(real_ungrab_calls == 0 && ungrab_request_calls == 1 &&
        flush_calls == 1);
  CHECK(XGrabServer(untracked) == 71);
  CHECK(real_grab_calls == 1);
  CHECK(XUngrabServer(untracked) == 73);
  CHECK(real_ungrab_calls == 1 && ungrab_request_calls == 1 &&
        flush_calls == 1);

  XCloseDisplay(first);
  CHECK(first_state->closed);
  CHECK(((_XPrivDisplay)first)->ext_data == NULL);
  CHECK(free_private_calls == 1);
  CHECK(compatibility_for(first) == NULL);
  reset_fake_write();
  CHECK(write(first_fd, relay_original, relay_length) == (ssize_t)relay_length);
  CHECK(memcmp(fake_write_bytes, relay_original, relay_length) == 0);
  CHECK(dispatch_event(second, ButtonPress, CurrentTime, &event));
  CHECK(event.xbutton.time != CurrentTime);
  CHECK(event.xany.serial == 0x2222UL);

  fail_event_type = MotionNotify;
  errno = 0;
  failed = XOpenDisplay("failed");
  CHECK(failed == NULL && errno == EIO);
  CHECK(close_calls == 2);
  CHECK(fake_states[fake_state_count - 1].closed);
  CHECK(((_XPrivDisplay)fake_states[fake_state_count - 1].display)->ext_data ==
        NULL);
  fail_event_type = -1;

  saved_modifier_calls = real_modifier_calls;
  saved_modifier_fn = real_x_set_modifier_mapping_fn;
  real_x_set_modifier_mapping_fn = NULL;
  errno = 0;
  CHECK(XSetModifierMapping(untracked, &map) == MappingFailed);
  CHECK(errno == ENOSYS && real_modifier_calls == saved_modifier_calls);
  real_x_set_modifier_mapping_fn = saved_modifier_fn;

  saved_open_fn = real_x_open_display_fn;
  real_x_open_display_fn = NULL;
  errno = 0;
  CHECK(XOpenDisplay("missing") == NULL && errno == ENOSYS);
  real_x_open_display_fn = saved_open_fn;

  XCloseDisplay(second);
  XCloseDisplay(untracked);
  CHECK(free_private_calls == 2);
  return 0;
}
'''

        with repository_temporary_directory() as temporary:
            directory = Path(temporary)
            harness = directory / "x-compat-behavior.c"
            executable = directory / "x-compat-behavior"
            harness.write_text(harness_source, encoding="utf-8")
            compile_result = subprocess.run(
                [
                    "gcc",
                    "-std=c11",
                    "-Wall",
                    "-Wextra",
                    "-Werror",
                    "-pthread",
                    "-I",
                    str(REPOSITORY / "scripts"),
                    str(harness),
                    "-o",
                    str(executable),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                compile_result.returncode,
                0,
                compile_result.stdout + compile_result.stderr,
            )
            behavior = subprocess.run(
                [str(executable)],
                capture_output=True,
                text=True,
                check=False,
                timeout=20,
            )
            self.assertEqual(
                behavior.returncode,
                0,
                behavior.stdout + behavior.stderr,
            )
            self.assertIn("event-type=2", behavior.stderr)

    def test_fresh_prepare_copies_and_hashes_private_artifacts(self) -> None:
        with repository_temporary_directory() as temporary:
            root = Path(temporary)
            session = root / "museum"
            session.mkdir()
            base_dir = root / "base"
            base_dir.mkdir()
            archive = root / "opengenera2.tar.bz2"
            archive.write_bytes(b"licensed archive identity")
            base = {
                "world": base_dir / "Genera-8-5.vlod",
                "debugger": base_dir / "VLM_debugger",
                "vlm": base_dir / "genera",
                "ifconfig_preload_source": base_dir
                / "opengenera-computer-use-ifconfig-bypass.c",
                "x_compatibility_preload_source": base_dir
                / "opengenera-computer-use-x-compat.c",
                "time_server_source": base_dir / "rfc868-time-server.py",
            }
            base["world"].write_bytes(b"private world input")
            base["debugger"].write_bytes(b"private debugger input")
            base["vlm"].write_bytes(b"public snap4 VLM input")
            base["ifconfig_preload_source"].write_bytes(
                b"narrow ifconfig compatibility source"
            )
            base["x_compatibility_preload_source"].write_bytes(
                b"typed Xlib compatibility source"
            )
            base["time_server_source"].write_bytes(b"one-shot responder source")
            os.utime(base["ifconfig_preload_source"], (1, 1))
            archive_sha256 = genera.sha256_file(archive)

            def fake_copy(source: Path, destination: Path) -> None:
                shutil.copy2(source, destination)

            def fake_build(source: Path, destination: Path) -> None:
                payload = (
                    b"private X compatibility preload"
                    if source == base["x_compatibility_preload_source"]
                    else b"private ifconfig preload"
                )
                destination.write_bytes(payload)
                destination.chmod(0o700)

            toolchain = {"commands": {"Xvfb": "/test/Xvfb"}}
            with (
                mock.patch.object(genera, "copy_reflink", side_effect=fake_copy),
                mock.patch.object(
                    genera, "build_private_preload", side_effect=fake_build
                ),
                mock.patch.object(
                    genera, "toolchain_provenance", return_value=toolchain
                ),
                mock.patch.object(genera, "boot_id", return_value="boot-test"),
                mock.patch.object(
                    genera, "now_iso", return_value="2026-07-17T12:00:00-04:00"
                ),
            ):
                metadata = genera.prepare_session(
                    session,
                    base,
                    archive,
                    archive_sha256,
                    fresh=True,
                )

            runtime = session / "runtime"
            artifacts = genera.private_artifact_paths(runtime)
            self.assertEqual(artifacts["world"].read_bytes(), base["world"].read_bytes())
            self.assertEqual(
                artifacts["debugger"].read_bytes(), base["debugger"].read_bytes()
            )
            self.assertEqual(artifacts["vlm"].read_bytes(), base["vlm"].read_bytes())
            self.assertEqual(
                artifacts["ifconfig_preload"].read_bytes(),
                b"private ifconfig preload",
            )
            self.assertEqual(
                artifacts["x_compatibility_preload"].read_bytes(),
                b"private X compatibility preload",
            )
            self.assertEqual(
                artifacts["time_server"].read_bytes(),
                base["time_server_source"].read_bytes(),
            )
            self.assertEqual(
                artifacts["sandbox_hosts"].read_text(encoding="ascii"),
                genera.SANDBOX_HOSTS_CONTENT,
            )
            self.assertEqual(
                artifacts["sandbox_nsswitch"].read_text(encoding="ascii"),
                genera.SANDBOX_NSSWITCH_CONTENT,
            )
            self.assertIn(
                str(genera.SANDBOX_RUNTIME / "Genera-8-5.vlod"),
                artifacts["config"].read_text(encoding="utf-8"),
            )
            self.assertNotIn(
                str(runtime), artifacts["config"].read_text(encoding="utf-8")
            )
            self.assertEqual(
                (runtime / genera.RUNTIME_MARKER).read_text(encoding="ascii"),
                genera.RUNTIME_MARKER_CONTENT,
            )
            self.assertEqual(stat.S_IMODE(runtime.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(artifacts["vlm"].stat().st_mode), 0o700)
            self.assertEqual(
                stat.S_IMODE(artifacts["ifconfig_preload"].stat().st_mode), 0o700
            )
            self.assertEqual(
                stat.S_IMODE(
                    artifacts["x_compatibility_preload"].stat().st_mode
                ),
                0o700,
            )
            self.assertEqual(
                stat.S_IMODE(artifacts["time_server"].stat().st_mode), 0o700
            )
            self.assertEqual(
                stat.S_IMODE(artifacts["sandbox_hosts"].stat().st_mode), 0o600
            )
            self.assertEqual(
                stat.S_IMODE(artifacts["sandbox_nsswitch"].stat().st_mode),
                0o600,
            )
            self.assertEqual(stat.S_IMODE(artifacts["config"].stat().st_mode), 0o600)
            actions = genera.action_log_path(session, 1)
            self.assertEqual(
                json.loads(actions.read_text(encoding="utf-8")),
                {
                    "schema": 1,
                    "session": "museum",
                    "generation": 1,
                    "actions": [],
                },
            )
            self.assertEqual(stat.S_IMODE(actions.stat().st_mode), 0o600)

            self.assertEqual(metadata["generation"], 1)
            self.assertEqual(metadata["boot_id"], "boot-test")
            self.assertEqual(metadata["archive"]["basename"], archive.name)
            self.assertEqual(metadata["archive"]["bytes"], archive.stat().st_size)
            self.assertEqual(metadata["archive"]["sha256"], archive_sha256)
            self.assertTrue(metadata["private_world_matches_base_at_start"])
            self.assertEqual(metadata["toolchain_provenance"], toolchain)
            self.assertFalse(metadata["network_isolation"]["external_route"])
            self.assertFalse(metadata["network_isolation"]["host_file_service"])
            self.assertFalse(metadata["network_isolation"]["default_route"])
            self.assertTrue(metadata["native_process_isolation"]["pid_namespace"])
            self.assertIsNone(metadata["guest_checkpoint_created"])
            self.assertFalse(metadata["save_world_invoked_by_harness"])
            self.assertFalse(metadata["process_checkpoint_created_by_harness"])
            self.assertEqual(
                metadata["ifconfig_preload_source"]["sha256_at_start"],
                genera.sha256_file(base["ifconfig_preload_source"]),
            )
            self.assertEqual(
                metadata["x_compatibility_preload_source"]["sha256_at_start"],
                genera.sha256_file(base["x_compatibility_preload_source"]),
            )
            self.assertEqual(
                metadata["time_server_source"]["sha256_at_start"],
                genera.sha256_file(base["time_server_source"]),
            )
            self.assertEqual(
                metadata["time_service"]["source_sha256_at_start"],
                genera.sha256_file(base["time_server_source"]),
            )
            self.assertEqual(
                metadata["time_service"]["mode"],
                "one-shot-rfc868-ethernet-responder",
            )
            self.assertEqual(metadata["time_service"]["reply_attempts"], 1)
            self.assertEqual(
                metadata["time_service"]["delivery"],
                "af-packet-raw-ethernet",
            )
            self.assertFalse(metadata["time_service"]["vlm_tap_io_interposed"])
            self.assertEqual(
                metadata["x_protocol_compatibility"]["mode"],
                "typed-xlib-hooks-plus-exact-guest-x-relay-transform",
            )
            self.assertEqual(
                metadata["x_protocol_compatibility"]["scope"],
                "displays-returned-by-x-open-display",
            )
            self.assertEqual(
                metadata["x_protocol_compatibility"]["state_lifetime"],
                "per-display-xextdata",
            )
            self.assertEqual(
                metadata["x_protocol_compatibility"]["event_conversion"],
                "per-display-xesetwiretoevent",
            )
            modifier_mapping = metadata["x_protocol_compatibility"][
                "modifier_mapping"
            ]
            self.assertEqual(modifier_mapping["max_keypermod"], 18)
            self.assertEqual(
                modifier_mapping["map_sha256"],
                "a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466",
            )
            self.assertEqual(
                modifier_mapping["wire_request_sha256"],
                "e17ca71a9780516bee282b09c5297660122fca7806a111dc00771748e850fc71",
            )
            self.assertTrue(
                modifier_mapping["guest_relay_transform_configured"]
            )
            self.assertEqual(
                modifier_mapping["replacement_request"], "QueryExtension"
            )
            self.assertEqual(
                modifier_mapping["replacement_extension_name_bytes"], 140
            )
            self.assertTrue(
                modifier_mapping[
                    "replacement_extension_absence_required_before_vlm"
                ]
            )
            self.assertEqual(
                modifier_mapping["client_byte_order"],
                "little-endian-pinned-wire-framing",
            )
            self.assertTrue(
                metadata["x_protocol_compatibility"]
                ["x_server_grab_transform_configured"]
            )
            self.assertTrue(
                metadata["x_protocol_compatibility"]
                ["x_ungrab_server_fallback_flush_available"]
            )
            self.assertTrue(
                metadata["x_protocol_compatibility"]
                ["libc_descriptor_io_interposed"]
            )
            self.assertFalse(
                metadata["x_protocol_compatibility"]
                ["raw_relay_reads_interposed"]
            )
            self.assertFalse(
                metadata["x_protocol_compatibility"]["tap_io_modified"]
            )
            self.assertFalse(
                metadata["x_protocol_compatibility"]
                ["world_or_ordinary_file_io_modified"]
            )
            self.assertFalse(
                metadata["x_protocol_compatibility"]
                ["unrelated_socket_io_modified"]
            )
            for name in ("world", "debugger", "vlm"):
                self.assertEqual(
                    metadata["base_artifacts"][name]["sha256_at_start"],
                    genera.sha256_file(base[name]),
                )
                self.assertEqual(
                    metadata["private_artifacts"][name]["sha256_at_start"],
                    genera.sha256_file(artifacts[name]),
                )
            for name in (
                "ifconfig_preload",
                "x_compatibility_preload",
                "time_server",
            ):
                self.assertEqual(
                    metadata["private_artifacts"][name]["sha256_at_start"],
                    genera.sha256_file(artifacts[name]),
                )

    def test_hashes_at_stop_distinguish_base_integrity_and_private_change(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            base = root / "base.vlod"
            private = root / "private.vlod"
            base.write_bytes(b"same base")
            private.write_bytes(b"private at start")
            state = {
                "base_artifacts": {
                    "world": {
                        "path": str(base),
                        "sha256_at_start": genera.sha256_file(base),
                    }
                },
                "private_artifacts": {
                    "world": {
                        "path": str(private),
                        "sha256_at_start": genera.sha256_file(private),
                    }
                },
            }
            private.write_bytes(b"changed private world")

            hashes = genera.hashes_at_stop(state)

            self.assertTrue(hashes["base_world_unchanged"])
            self.assertTrue(hashes["private_world_changed_during_run"])
            self.assertEqual(
                hashes["base_world_sha256_at_stop"], genera.sha256_file(base)
            )
            self.assertEqual(
                hashes["private_world_sha256_at_stop"], genera.sha256_file(private)
            )

    def test_screenshot_provenance_omits_paths_and_includes_sandbox_evidence(
        self,
    ) -> None:
        state = {
            "archive": {
                "path": "/private/archive.tar.bz2",
                "basename": "archive.tar.bz2",
                "bytes": 12,
                "sha256": "a" * 64,
            },
            "base_artifacts": {
                "world": {
                    "path": "/private/base.vlod",
                    "bytes": 10,
                    "sha256_at_start": "b" * 64,
                }
            },
            "private_artifacts": {
                "world": {
                    "path": "/private/session/world.vlod",
                    "bytes": 10,
                    "sha256_at_start": "b" * 64,
                },
                "ifconfig_preload": {
                    "path": "/private/session/ifconfig-bypass.so",
                    "bytes": 11,
                    "sha256_at_start": "g" * 64,
                },
                "x_compatibility_preload": {
                    "path": "/private/session/x-compat.so",
                    "bytes": 13,
                    "sha256_at_start": "o" * 64,
                },
                "time_server": {
                    "path": "/private/session/rfc868-time-server.py",
                    "bytes": 12,
                    "sha256_at_start": "j" * 64,
                },
            },
            "ifconfig_preload_source": {"sha256_at_start": "h" * 64},
            "x_compatibility_preload_source": {"sha256_at_start": "p" * 64},
            "time_server_source": {"sha256_at_start": "k" * 64},
            "network_isolation": {"external_route": False},
            "native_process_isolation": {"host_root_visible": False},
            "toolchain_provenance": {"python_version": "test"},
            "vlm_sha256_at_exec": "d" * 64,
            "ifconfig_preload_sha256_at_exec": "i" * 64,
            "x_compatibility_preload_sha256_at_exec": "q" * 64,
            "time_server_sha256_at_exec": "l" * 64,
            "config_sha256_at_exec": "f" * 64,
            "execution_inputs": {
                "harness_sources": {"namespace_helper": "m" * 64}
            },
            "time_service_evidence": {
                "schema": 2,
                "reply_attempts": 1,
                "sha256": "n" * 64,
            },
            "x_modifier_compatibility": {
                "mode": "pre-vlm-core-modifier-map"
            },
            "x_protocol_compatibility": {
                "mode": "typed-xlib-hooks-plus-exact-guest-x-relay-transform",
                "tap_io_modified": False,
                "world_or_ordinary_file_io_modified": False,
                "unrelated_socket_io_modified": False,
            },
            "x_protocol_compatibility_observed": {
                "guest_relay_grab_transformed": True,
                "guest_relay_modifier_mapping_transformed": True,
            },
        }

        provenance = genera.screenshot_provenance(state)
        serialized = json.dumps(provenance)

        self.assertNotIn("/private/", serialized)
        self.assertEqual(provenance["archive"]["basename"], "archive.tar.bz2")
        self.assertEqual(provenance["vlm_sha256_at_exec"], "d" * 64)
        self.assertEqual(
            provenance["ifconfig_preload_source_sha256_at_start"], "h" * 64
        )
        self.assertEqual(
            provenance["ifconfig_preload_sha256_at_exec"], "i" * 64
        )
        self.assertEqual(
            provenance["x_compatibility_preload_source_sha256_at_start"],
            "p" * 64,
        )
        self.assertEqual(
            provenance["x_compatibility_preload_sha256_at_exec"], "q" * 64
        )
        self.assertEqual(
            provenance["time_server_source_sha256_at_start"], "k" * 64
        )
        self.assertEqual(provenance["time_server_sha256_at_exec"], "l" * 64)
        self.assertEqual(
            provenance["harness_sources_at_exec"]["namespace_helper"], "m" * 64
        )
        self.assertEqual(provenance["time_service_evidence"]["reply_attempts"], 1)
        self.assertEqual(
            provenance["x_modifier_compatibility"]["mode"],
            "pre-vlm-core-modifier-map",
        )
        self.assertEqual(
            provenance["x_protocol_compatibility"]["mode"],
            "typed-xlib-hooks-plus-exact-guest-x-relay-transform",
        )
        self.assertTrue(
            provenance["x_protocol_compatibility_observed"]
            ["guest_relay_modifier_mapping_transformed"]
        )

    def test_pre_exec_hash_verification_rejects_input_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifact = root / "genera"
            helper = root / "inside-helper.sh"
            artifact.write_bytes(b"verified VLM")
            helper.write_bytes(b"verified helper")
            state = {
                "private_artifacts": {
                    "vlm": {
                        "path": str(artifact),
                        "sha256_at_start": genera.sha256_file(artifact),
                    }
                },
                "harness_sources": {
                    "namespace_helper": {
                        "path": str(helper),
                        "sha256_at_start": genera.sha256_file(helper),
                    }
                },
            }

            artifact.write_bytes(b"tampered VLM")
            with self.assertRaisesRegex(
                genera.HarnessError,
                "private execution input changed before launch: vlm",
            ):
                genera.verify_execution_inputs(state)

            artifact.write_bytes(b"verified VLM")
            helper.write_bytes(b"tampered helper")
            with self.assertRaisesRegex(
                genera.HarnessError,
                "harness execution source changed before launch: namespace_helper",
            ):
                genera.verify_execution_inputs(state)

    def test_one_shot_rfc868_evidence_is_validated_before_use(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            evidence = Path(temporary) / "rfc868.json"
            completion = Path(temporary) / "rfc868.complete.json"
            state = {
                "time_service": {
                    "evidence_path": str(evidence),
                    "completion_path": str(completion),
                    "interface": "tun0",
                    "host_ip": "10.0.0.1",
                    "host_mac": "02:00:00:00:00:25",
                    "guest_mac": "40:00:00:00:00:00",
                    "port": 37,
                    "reply_attempts": 1,
                    "expected_request_frame_sha256": (
                        genera.EXPECTED_TIME_REQUEST_SHA256
                    ),
                },
                "network_isolation": {"guest_side": "10.0.0.2/24"},
            }
            self.assertIsNone(genera.read_time_service_evidence(state))

            valid = {
                "schema": 2,
                "received_at": "2026-07-17T12:00:00-04:00",
                "interface": "tun0",
                "host_ip": "10.0.0.1",
                "host_mac": "02:00:00:00:00:25",
                "port": 37,
                "udp_guard_bind": "0.0.0.0",
                "request_source_mac": "40:00:00:00:00:00",
                "request_destination_mac": "ff:ff:ff:ff:ff:ff",
                "request_source_ip": "10.0.0.2",
                "request_destination_ip": "255.255.255.255",
                "request_source_port": 40000,
                "request_destination_port": 37,
                "request_udp_checksum": 0,
                "request_payload_bytes": 0,
                "request_frame_bytes": 58,
                "request_frame_sha256": genera.EXPECTED_TIME_REQUEST_SHA256,
                "reply_source_mac": "02:00:00:00:00:25",
                "reply_destination_mac": "40:00:00:00:00:00",
                "reply_source_ip": "10.0.0.1",
                "reply_destination_ip": "10.0.0.2",
                "reply_source_port": 37,
                "reply_destination_port": 40000,
                "reply_udp_checksum": 0,
                "reply_payload_hex": "83aa7e80",
                "reply_frame_bytes": 46,
                "reply_frame_sha256": "b" * 64,
                "reply_attempts": 1,
                "reply_interval_seconds": 0.1,
                "first_reply_sent_at": "2026-07-17T12:00:00-04:00",
                "last_reply_sent_at": "2026-07-17T12:00:00-04:00",
                "rfc868_seconds": 2208988800,
                "unix_seconds": 0,
            }
            genera.atomic_write_json(evidence, valid)
            observed = genera.read_time_service_evidence(state)
            self.assertEqual(observed["request_source_ip"], "10.0.0.2")
            self.assertEqual(observed["reply_frame_bytes"], 46)
            self.assertEqual(observed["reply_attempts"], 1)
            self.assertEqual(observed["sha256"], genera.sha256_file(evidence))

            genera.atomic_write_json(
                completion,
                {
                    "schema": 1,
                    "completed_at": "2026-07-17T12:00:01-04:00",
                    "responder_exit_status": 0,
                    "evidence_sha256": observed["sha256"],
                },
            )
            completed = genera.read_time_service_completion(state, observed)
            self.assertEqual(completed["responder_exit_status"], 0)
            self.assertEqual(completed["sha256"], genera.sha256_file(completion))

            invalid = {**valid, "reply_attempts": 2}
            genera.atomic_write_json(evidence, invalid)
            with self.assertRaisesRegex(genera.HarnessError, "reply evidence"):
                genera.read_time_service_evidence(state)

            evidence.unlink()
            target = Path(temporary) / "elsewhere.json"
            genera.atomic_write_json(target, valid)
            evidence.symlink_to(target)
            with self.assertRaisesRegex(genera.HarnessError, "symbolic link"):
                genera.read_time_service_evidence(state)


class TimeResponderTests(unittest.TestCase):
    def test_responder_emits_exactly_one_rfc868_reply_and_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            ready = root / "ready.json"
            evidence = root / "evidence.json"

            source_mac = bytes.fromhex("020000000002")
            destination_mac = b"\xff" * 6
            source_ip = time_server.socket.inet_aton("10.0.0.2")
            destination_ip = time_server.socket.inet_aton("255.255.255.255")
            udp = time_server.struct.pack("!HHHH", 40000, 37, 8, 0)
            ip = time_server.struct.pack(
                "!BBHHHBBH4s4s",
                0x45,
                0,
                20 + len(udp),
                0,
                0,
                64,
                time_server.IPPROTO_UDP,
                0,
                source_ip,
                destination_ip,
            )
            request_frame = (
                destination_mac
                + source_mac
                + time_server.struct.pack("!H", time_server.ETH_P_IP)
                + ip
                + udp
            )

            class FakeSocket:
                def __init__(self, frame: bytes | None = None):
                    self.bound = None
                    self.recv_count = 0
                    self.frame = frame
                    self.sent: list[bytes] = []

                def __enter__(self):
                    return self

                def __exit__(self, *_args):
                    return False

                def setsockopt(self, *_args):
                    return None

                def bind(self, address):
                    self.bound = address

                def recvfrom(self, _size):
                    if self.frame is None:
                        raise AssertionError("recvfrom called on the UDP guard")
                    self.recv_count += 1
                    return self.frame, ("tun0", 0, 0, 1, source_mac)

                def send(self, payload):
                    self.sent.append(payload)
                    return len(payload)

            parsed = time_server.argparse.Namespace(
                interface="tun0",
                host_ip="10.0.0.1",
                host_mac="02:00:00:00:00:25",
                port=37,
                reply_count=1,
                reply_interval=0.1,
                ready_file=ready,
                evidence_file=evidence,
            )
            argument_parser = mock.Mock()
            argument_parser.parse_args.return_value = parsed
            guard = FakeSocket()
            server = FakeSocket(request_frame)
            with (
                mock.patch.object(
                    time_server, "parser", return_value=argument_parser
                ),
                mock.patch.object(
                    time_server.socket,
                    "socket",
                    side_effect=[guard, server],
                ) as socket_constructor,
                mock.patch.object(time_server.time, "time", return_value=1_000),
                mock.patch.object(time_server.time, "sleep") as sleep,
                mock.patch.object(
                    time_server,
                    "now_iso",
                    side_effect=[
                        "2026-07-17T12:00:00-04:00",
                        "2026-07-17T12:00:01-04:00",
                        "2026-07-17T12:00:01-04:00",
                        "2026-07-17T12:00:02-04:00",
                    ],
                ),
            ):
                self.assertEqual(time_server.main(), 0)

            self.assertEqual(guard.bound, ("0.0.0.0", 37))
            self.assertEqual(server.bound, ("tun0", 0))
            self.assertEqual(server.recv_count, 1)
            self.assertEqual(len(server.sent), 1)
            reply = server.sent[0]
            self.assertEqual(len(reply), 46)
            self.assertEqual(reply[:6], source_mac)
            self.assertEqual(reply[6:12], bytes.fromhex("020000000025"))
            self.assertEqual(
                int.from_bytes(reply[42:46], "big"),
                1_000 + time_server.RFC868_UNIX_EPOCH_OFFSET,
            )
            self.assertEqual(socket_constructor.call_count, 2)
            sleep.assert_not_called()

            ready_value = json.loads(ready.read_text(encoding="utf-8"))
            evidence_value = json.loads(evidence.read_text(encoding="utf-8"))
            self.assertEqual(ready_value["schema"], 2)
            self.assertEqual(ready_value["interface"], "tun0")
            self.assertEqual(ready_value["udp_guard_bind"], "0.0.0.0")
            self.assertEqual(evidence_value["schema"], 2)
            self.assertEqual(evidence_value["reply_attempts"], 1)
            self.assertEqual(evidence_value["request_frame_bytes"], 42)
            self.assertEqual(evidence_value["reply_frame_bytes"], 46)
            self.assertEqual(evidence_value["reply_payload_hex"], reply[42:46].hex())
            self.assertEqual(evidence_value["reply_destination_ip"], "10.0.0.2")
            self.assertEqual(stat.S_IMODE(ready.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(evidence.stat().st_mode), 0o600)


class ProcessIdentityAndDiscoveryTests(unittest.TestCase):
    def test_process_identity_requires_boot_pid_and_start_ticks(self) -> None:
        record = {"pid": 4321, "start_ticks": 81723, "cmdline": "genera"}
        with (
            mock.patch.object(genera, "boot_id", return_value="boot-a"),
            mock.patch.object(genera, "proc_start_ticks", return_value=81723),
        ):
            self.assertTrue(genera.process_matches(record, "boot-a"))
            self.assertFalse(genera.process_matches(record, "boot-b"))
        with (
            mock.patch.object(genera, "boot_id", return_value="boot-a"),
            mock.patch.object(genera, "proc_start_ticks", return_value=99999),
        ):
            self.assertFalse(genera.process_matches(record, "boot-a"))

    def test_descendant_search_requires_an_exact_argv_element(self) -> None:
        children = {100: [200, 300], 200: [400], 300: [200], 400: []}
        arguments = {
            200: [
                "env",
                "GENERA_COMPUTER_USE_VLM=/private/session/runtime/genera",
            ],
            300: ["loader", "/private/session/runtime/genera.extra"],
            400: ["loader", "--library-path", "/private/session/runtime/genera"],
        }
        with (
            mock.patch.object(
                genera, "child_pids", side_effect=lambda pid: children.get(pid, [])
            ),
            mock.patch.object(
                genera,
                "proc_cmdline_elements",
                side_effect=lambda pid: arguments.get(pid, []),
            ),
        ):
            self.assertEqual(genera.descendant_pids(100), [200, 300, 400])
            self.assertEqual(
                genera.find_descendant_with_argument(
                    100, "/private/session/runtime/genera"
                ),
                400,
            )
            self.assertIsNone(
                genera.find_descendant_with_argument(
                    100, "/private/session/runtime/gener"
                )
            )

    def test_vlm_discovery_excludes_bubblewraps_copied_argument(self) -> None:
        expected = "/session/runtime/genera"
        descendants = [200, 300, 400, 500]
        arguments = {
            200: ["bwrap", "--setenv", "GENERA_COMPUTER_USE_VLM", expected],
            300: ["bash", "/museum/scripts/inside-vlm.sh", expected],
            400: ["loader", expected, "-world", "/session/runtime/world.vlod"],
            500: ["loader", expected, "-network", genera.NETWORK_SPEC],
        }
        with (
            mock.patch.object(genera, "descendant_pids", return_value=descendants),
            mock.patch.object(
                genera,
                "proc_cmdline_elements",
                side_effect=lambda pid: arguments[pid],
            ),
        ):
            self.assertEqual(genera.find_vlm_descendant(100, expected), 500)


class WindowInputAndActionTests(unittest.TestCase):
    def test_window_classification_and_selection_follow_dynamic_roles(self) -> None:
        self.assertEqual(genera.classify_window("Genera on VLM"), "main")
        self.assertEqual(genera.classify_window("genera (Cold Load)"), "cold-load")
        self.assertEqual(
            genera.classify_window("VLM Debugger - Cold Load"), "cold-load"
        )
        self.assertEqual(genera.classify_window("VLM Debugger"), "debugger")
        self.assertEqual(genera.classify_window("Genera status"), "genera-other")
        self.assertEqual(genera.classify_window("unrelated"), "other")

        search = completed(stdout="10\n11\n12\n13\n")
        geometries = {
            10: {"width": 1400, "height": 1000},
            11: {"width": 1024, "height": 768},
            12: {"width": 800, "height": 600},
            13: {"width": 640, "height": 480},
        }
        titles = {
            10: "unrelated giant window",
            11: "genera (Cold Load)",
            12: "Genera on private-vlm",
            13: "VLM Debugger",
        }
        with (
            mock.patch.object(genera, "xdotool", return_value=search),
            mock.patch.object(
                genera,
                "geometry_for_window",
                side_effect=lambda _state, window: geometries[window],
            ),
            mock.patch.object(
                genera,
                "window_title",
                side_effect=lambda _state, window: titles[window],
            ),
        ):
            observed = genera.discover_windows({"display": ":200"})

        self.assertEqual(observed["selected"]["window_id"], 12)
        self.assertEqual(observed["selected"]["kind"], "main")
        self.assertEqual(len(observed["candidates"]), 4)

        titles[12] = "ordinary window"
        with (
            mock.patch.object(genera, "xdotool", return_value=search),
            mock.patch.object(
                genera,
                "geometry_for_window",
                side_effect=lambda _state, window: geometries[window],
            ),
            mock.patch.object(
                genera,
                "window_title",
                side_effect=lambda _state, window: titles[window],
            ),
        ):
            observed = genera.discover_windows({"display": ":200"})
        self.assertEqual(observed["selected"]["window_id"], 11)
        self.assertEqual(observed["selected"]["kind"], "cold-load")

    def test_explicit_interaction_window_selection_is_exact_and_fail_closed(self) -> None:
        main = {
            "window_id": 12,
            "title": "Genera on private-vlm",
            "kind": "main",
            "geometry": {"width": 1200, "height": 900},
            "area": 1080000,
        }
        cold = {
            "window_id": 11,
            "title": "INTERNET|10.0.0.2 Cold Load Stream",
            "kind": "cold-load",
            "geometry": {"width": 1024, "height": 768},
            "area": 786432,
        }
        self.assertIs(genera.select_interaction_window([main, cold], "main"), main)
        self.assertIs(
            genera.select_interaction_window([main, cold], "cold-load"), cold
        )
        with self.assertRaisesRegex(genera.HarnessError, "could not be identified"):
            genera.select_interaction_window([main], "cold-load")
        with self.assertRaisesRegex(genera.HarnessError, "ambiguous"):
            genera.select_interaction_window(
                [cold, {**cold, "window_id": 13, "title": "second Cold Load"}],
                "cold-load",
            )
        with self.assertRaisesRegex(genera.HarnessError, "unsupported"):
            genera.select_interaction_window([main, cold], "other")

    def test_interaction_commands_parse_main_default_and_explicit_cold_load(self) -> None:
        parser = genera.build_parser()
        cases = (
            (["key", "F12"], "main"),
            (["key", "--window-kind", "cold-load", "Return"], "cold-load"),
            (["type", "(+ 40 2)"], "main"),
            (["type", "--window-kind", "cold-load", "(+ 40 2)"], "cold-load"),
            (["mouse", "move", "1", "2"], "main"),
            (
                ["mouse", "--window-kind", "cold-load", "move", "1", "2"],
                "cold-load",
            ),
            (["screenshot"], "main"),
            (["screenshot", "--window-kind", "cold-load"], "cold-load"),
            (["wait"], "main"),
            (["wait", "--window-kind", "cold-load"], "cold-load"),
        )
        for arguments, expected in cases:
            with self.subTest(arguments=arguments):
                self.assertEqual(parser.parse_args(arguments).window_kind, expected)

    def test_action_context_records_exact_interaction_window_kind(self) -> None:
        selected = {
            "window_id": 11,
            "title": "INTERNET|10.0.0.2 Cold Load Stream",
            "kind": "cold-load",
            "geometry": {"x": 100, "y": 100, "width": 1024, "height": 768},
        }
        context = genera.action_context({"generation": 3}, selected)
        self.assertEqual(context["window_kind"], "cold-load")
        self.assertEqual(context["window_id"], 11)

    def test_coordinates_use_current_geometry_and_buttons_are_bounded(self) -> None:
        geometry = {"width": 1200, "height": 900}
        for point in ((0, 0), (1199, 899)):
            self.assertIsNone(genera.validate_coordinates(*point, geometry))
        for point in ((-1, 0), (0, -1), (1200, 0), (0, 900)):
            with self.subTest(point=point):
                with self.assertRaises(genera.HarnessError):
                    genera.validate_coordinates(*point, geometry)
        for button in (1, 2, 3):
            self.assertIsNone(genera.validate_button(button))
        for button in (0, 4, -1):
            with self.assertRaises(genera.HarnessError):
                genera.validate_button(button)

        self.assertEqual(
            genera.translate_keys(
                [
                    "SELECT",
                    "function",
                    "suspend",
                    "resume",
                    "clear-input",
                    "complete",
                    "end",
                    "help",
                    "rubout",
                    "Abort",
                    "super",
                    "enter",
                    "space",
                    "F12",
                ]
            ),
            [
                "F1",
                "F3",
                "F4",
                "F5",
                "F10",
                "F11",
                "KP_End",
                "F12",
                "Delete",
                "KP_Subtract",
                "Control_R",
                "Return",
                "space",
                "F12",
            ],
        )

    def test_mouse_move_does_not_wait_for_motion_at_an_already_reached_point(
        self,
    ) -> None:
        state = {"display": ":200"}
        selected = {
            "window_id": 4242,
            "geometry": {"x": 72, "y": 55, "width": 1200, "height": 900},
        }
        calls: list[list[str]] = []

        def fake_xdotool(_state, arguments, *, check=True):
            calls.append(list(arguments))
            if arguments[0] == "getmouselocation":
                return completed(stdout="X=882\nY=415\nSCREEN=0\nWINDOW=4242\n")
            return completed()

        with mock.patch.object(genera, "xdotool", side_effect=fake_xdotool):
            genera.mouse_move(state, selected, 810, 360)

        self.assertEqual(
            calls[0], ["mousemove", "--window", "4242", "810", "360"]
        )
        self.assertNotIn("--sync", calls[0])
        self.assertEqual(calls[1], ["getmouselocation", "--shell"])

    def test_action_log_appends_atomically_and_hashes_the_complete_log(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary)
            state = {"generation": 7}
            path = genera.action_log_path(session, 7)
            genera.atomic_write_json(
                path,
                {
                    "schema": 1,
                    "session": "museum",
                    "generation": 7,
                    "actions": [],
                },
            )
            first = {"action": "key", "keys": ["F1"]}
            second = {"action": "mouse-click", "x": 10, "y": 20}

            first_result = genera.append_action(session, state, first)
            second_result = genera.append_action(session, state, second)

            value = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(value["actions"], [first, second])
            self.assertEqual(first_result["count"], 1)
            self.assertEqual(second_result["count"], 2)
            self.assertEqual(second_result["sha256"], genera.sha256_file(path))
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

            path.write_text(
                '{"schema": 2, "generation": 7, "actions": []}\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(genera.HarnessError, "action-log schema"):
                genera.append_action(session, state, first)

    def test_capture_targets_exact_selected_window_and_checks_geometry(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "screen.png"
            selected = {
                "window_id": 4242,
                "title": "Genera on private-vlm",
                "kind": "main",
                "geometry": {"width": 1200, "height": 900},
            }
            calls: list[list[object]] = []

            def fake_run(argv, **kwargs):
                calls.append(list(argv))
                if argv[0] == "import":
                    return completed(stdout=b"png payload")
                if argv[0] == "identify":
                    return completed(stdout="1200 900")
                if argv[0] == "convert":
                    return completed(stdout=b"normalized pixels")
                raise AssertionError(argv)

            with mock.patch.object(genera, "run", side_effect=fake_run):
                captured = genera.capture_window(
                    {
                        "display": ":200",
                        "xauthority": "/private/Xauthority",
                        "session_dir": str(Path(temporary)),
                    },
                    selected,
                    destination,
                )

            self.assertEqual(calls[0], ["import", "-window", "4242", "png:-"])
            self.assertEqual(destination.read_bytes(), b"png payload")
            self.assertEqual(captured["window_id"], 4242)
            self.assertEqual((captured["width"], captured["height"]), (1200, 900))
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o600)

    def test_screenshot_sequence_continues_after_four_digits(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary)
            screenshots = session / "screenshots"
            screenshots.mkdir()
            for name in ("0001-first.png", "9999-last-four-digit.png"):
                (screenshots / name).touch()
            first = genera.next_screenshot_path(session, "continued")
            self.assertEqual(first.name, "10000-continued.png")
            first.touch()
            self.assertEqual(
                genera.next_screenshot_path(session, "continued-again").name,
                "10001-continued-again.png",
            )


class XvfbAndLauncherTests(unittest.TestCase):
    def test_xvfb_uses_cookie_authentication_and_disables_tcp(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            runtime = session / "runtime"
            runtime.mkdir(parents=True)
            genera.atomic_write_json(
                genera.state_path(session),
                {"schema": genera.STATE_SCHEMA, "generation": 7},
            )
            display_number = next(
                number
                for number in range(260, 400)
                if not Path(f"/tmp/.X11-unix/X{number}").exists()
                and not Path(f"/tmp/.X{number}-lock").exists()
            )
            popen_calls: list[list[str]] = []

            class FakeXvfb:
                pid = 9999
                returncode = None

                def poll(self):
                    return None

                def terminate(self):
                    self.returncode = 0

                def wait(self, timeout=None):
                    return self.returncode

            def fake_popen(argv, **_kwargs):
                popen_calls.append(list(argv))
                return FakeXvfb()

            def fake_run(argv, **_kwargs):
                if argv[0] == "xauth":
                    Path(argv[2]).write_bytes(b"private cookie database")
                    return completed(list(argv))
                if argv[0] == "xdotool":
                    return completed(list(argv))
                if argv == ["xdpyinfo", "-queryExtensions"]:
                    return completed(
                        list(argv),
                        stdout="number of extensions: 3\n    BIG-REQUESTS\n",
                    )
                if argv == ["xmodmap", "-pm"]:
                    return completed(
                        list(argv),
                        stdout="mod2        Left (0x71)\n",
                    )
                if argv[0] == "xmodmap":
                    return completed(list(argv))
                raise AssertionError(argv)

            with (
                mock.patch.object(
                    genera, "DISPLAY_RANGE", range(display_number, display_number + 1)
                ),
                mock.patch.object(genera, "locked", return_value=contextlib.nullcontext()),
                mock.patch.object(genera, "run", side_effect=fake_run),
                mock.patch.object(genera.subprocess, "Popen", side_effect=fake_popen),
                mock.patch.object(
                    genera,
                    "process_record",
                    return_value={
                        "pid": 9999,
                        "start_ticks": 1,
                        "cmdline": "Xvfb",
                    },
                ),
                mock.patch.object(genera.secrets, "token_hex", return_value="c" * 32),
            ):
                (
                    process,
                    display,
                    xauthority,
                    modifier_map,
                    x_server_security,
                ) = genera.start_xvfb(session)

            self.assertEqual(process.pid, 9999)
            self.assertEqual(display, f":{display_number}")
            self.assertEqual(stat.S_IMODE(xauthority.stat().st_mode), 0o600)
            command = popen_calls[0]
            self.assertEqual(command[0:2], ["Xvfb", f":{display_number}"])
            self.assertIn("-auth", command)
            self.assertEqual(command[command.index("-auth") + 1], str(xauthority))
            self.assertIn("-nolisten", command)
            self.assertEqual(command[command.index("-nolisten") + 1], "tcp")
            self.assertEqual(
                command[command.index("-extension") + 1], "MIT-SHM"
            )
            self.assertNotIn("-ac", command)
            self.assertEqual(
                modifier_map["mode"], "pre-vlm-core-modifier-map"
            )
            self.assertEqual(
                modifier_map["verified_mod2"], "mod2        Left (0x71)"
            )
            self.assertFalse(x_server_security["mit_shm_enabled"])
            self.assertTrue(x_server_security["mit_shm_verified_absent"])
            relay_query = x_server_security["relay_query_extension"]
            self.assertTrue(relay_query["verified_absent"])
            self.assertEqual(relay_query["name_bytes"], 140)
            self.assertEqual(
                relay_query["name_sha256"],
                "a6c472743dd40ae103e78134fc6c6deffb36feec674ea26c65212b4d69f1ae36",
            )

    def test_capability_probe_uses_the_hardened_bubblewrap_shape(self) -> None:
        def fake_which(command: str) -> str | None:
            return {
                "bwrap": "/usr/bin/bwrap",
                "bash": "/gnu/store/test-profile/bin/bash",
            }.get(command)

        with (
            mock.patch.object(genera.Path, "exists", return_value=True),
            mock.patch.object(genera.shutil, "which", side_effect=fake_which),
            mock.patch.object(
                genera,
                "run",
                return_value=completed(returncode=0),
            ) as run,
        ):
            result = genera.probe_host_capabilities()

        self.assertTrue(result["ok"])
        self.assertEqual(result["returncode"], 0)
        self.assertIsNone(result["error"])
        self.assertIn("minimal-generated-hostname-resolution", result["checks"])
        self.assertIn("rfc868-raw-ethernet-responder", result["checks"])
        self.assertIn("rfc868-udp-port-guard", result["checks"])

        command = run.call_args.args[0]
        self.assertEqual(command[0], "/usr/bin/bwrap")
        for option in (
            "--unshare-user",
            "--unshare-net",
            "--unshare-pid",
            "--unshare-ipc",
            "--unshare-uts",
            "--clearenv",
        ):
            self.assertIn(option, command)
        self.assertIn("CAP_NET_ADMIN", command)
        self.assertIn("CAP_NET_RAW", command)
        self.assertIn("CAP_NET_BIND_SERVICE", command)
        self.assertEqual(command[command.index("PATH") + 1],
            "/gnu/store/test-profile/bin:/gnu/store/test-profile/sbin")
        self.assertEqual(command[command.index("/etc/hosts") - 2], "--ro-bind")
        self.assertEqual(
            command[command.index("/etc/nsswitch.conf") - 2], "--ro-bind"
        )
        self.assertEqual(
            command[command.index(genera.SANDBOX_RUNTIME) - 2], "--bind"
        )
        probe = command[-1]
        self.assertIn(
            "socket.socket(socket.AF_PACKET, socket.SOCK_RAW", probe
        )
        self.assertIn('raw.bind(("tun0", 0))', probe)
        self.assertIn('guard.bind(("0.0.0.0", 37))', probe)
        self.assertIn('socket.gethostbyname("genera-museum")', probe)
        self.assertIn('test -z "$(ip route show default)"', probe)
        self.assertEqual(run.call_args.kwargs["check"], False)
        self.assertEqual(run.call_args.kwargs["timeout"], 20)

    def test_runtime_preparation_invokes_existing_inert_launcher(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "archive.tar.bz2"
            archive.write_bytes(b"archive")
            paths = {
                "world": root / "world.vlod",
                "debugger": root / "debugger",
                "vlm": root / "genera",
                "ifconfig_preload_source": root / "ifconfig-preload.c",
                "x_compatibility_preload_source": root / "x-compat.c",
                "time_server_source": root / "time-server.py",
            }
            for path in paths.values():
                path.write_bytes(b"artifact")
            paths["vlm"].chmod(0o700)
            archive_sha256 = "a" * 64

            def fake_hash(path: Path) -> str:
                if path == archive:
                    return archive_sha256
                for name in ("world", "debugger", "vlm"):
                    if path == paths[name]:
                        return genera.EXPECTED_BASE_SHA256[name]
                return "b" * 64

            with (
                mock.patch.object(genera, "base_paths", return_value=paths),
                mock.patch.object(genera, "run", return_value=completed()) as run,
                mock.patch.object(genera, "sha256_file", side_effect=fake_hash),
            ):
                self.assertEqual(
                    genera.ensure_runtime_ready(archive),
                    (paths, archive_sha256),
                )

            run.assert_called_once_with(
                [
                    genera.ROOT / "scripts" / "opengenera-guix-container.sh",
                    "--mode",
                    "run",
                    "--prepare-only",
                    "--archive",
                    archive,
                ],
                cwd=genera.ROOT,
                timeout=1800,
            )

    def test_launcher_uses_bubblewrap_allowlist_and_scrubbed_inner_env(self) -> None:
        session_dir = REPOSITORY / "build" / "genera-computer-use" / "unit"
        runtime = session_dir / "runtime"
        state = {
            "session_dir": str(session_dir),
            "display": ":207",
            "xauthority": str(runtime / "Xauthority"),
            "archive": {"path": "/licensed/opengenera2.tar.bz2"},
            "private_artifacts": {
                "world": {"path": str(runtime / "world.vlod")},
                "debugger": {"path": str(runtime / "debugger")},
                "vlm": {"path": str(runtime / "genera")},
                "ifconfig_preload": {"path": str(runtime / "ifconfig-bypass.so")},
                "x_compatibility_preload": {
                    "path": str(runtime / "x-compat.so")
                },
                "time_server": {"path": str(runtime / "rfc868-time-server.py")},
                "sandbox_hosts": {"path": str(runtime / "sandbox-hosts")},
                "sandbox_nsswitch": {
                    "path": str(runtime / "sandbox-nsswitch.conf")
                },
                "config": {"path": str(runtime / ".VLM")},
            },
            "time_service": {
                "sandbox_ready_path": "/session/runtime/time.ready.json",
                "sandbox_evidence_path": "/session/runtime/time.json",
                "sandbox_completion_path": "/session/runtime/time.complete.json",
                "sandbox_failure_path": "/session/runtime/time.failure.json",
            },
        }

        def fake_which(command: str) -> str | None:
            return {
                "bwrap": "/usr/bin/bwrap",
                "bash": "/gnu/store/test-profile/bin/bash",
            }.get(command)

        with (
            mock.patch.object(genera.Path, "is_socket", return_value=True),
            mock.patch.object(genera.shutil, "which", side_effect=fake_which),
            mock.patch.dict(os.environ, {"UNRELATED_SECRET": "do-not-pass"}),
        ):
            command, env, expected_vlm_argument = genera.launcher_command(state)

        self.assertEqual(command[0], "/usr/bin/bwrap")
        for option in (
            "--die-with-parent",
            "--unshare-user",
            "--unshare-net",
            "--unshare-pid",
            "--unshare-ipc",
            "--unshare-uts",
            "--clearenv",
        ):
            self.assertIn(option, command)
        self.assertIn("CAP_NET_ADMIN", command)
        self.assertIn("CAP_NET_RAW", command)
        self.assertIn("CAP_NET_BIND_SERVICE", command)

        def has_mount(flag: str, source: object, destination: object) -> bool:
            expected = [flag, os.fspath(source), os.fspath(destination)]
            return any(command[index : index + 3] == expected for index in range(len(command)))

        x_socket = Path("/tmp/.X11-unix/X207")
        helper = REPOSITORY / "scripts" / "inside-genera-computer-use-netns.sh"
        vlm_helper = REPOSITORY / "scripts" / "inside-genera-computer-use-vlm.sh"
        self.assertTrue(has_mount("--bind", runtime, genera.SANDBOX_RUNTIME))
        self.assertTrue(has_mount("--ro-bind", x_socket, x_socket))
        self.assertTrue(
            has_mount(
                "--ro-bind",
                helper,
                genera.SANDBOX_HELPERS / helper.name,
            )
        )
        self.assertTrue(
            has_mount(
                "--ro-bind",
                vlm_helper,
                genera.SANDBOX_HELPERS / vlm_helper.name,
            )
        )
        self.assertTrue(has_mount("--ro-bind", "/gnu/store", "/gnu/store"))
        self.assertTrue(has_mount("--dev-bind", "/dev/net/tun", "/dev/net/tun"))
        self.assertTrue(
            has_mount("--ro-bind", runtime / "sandbox-hosts", "/etc/hosts")
        )
        self.assertTrue(
            has_mount(
                "--ro-bind",
                runtime / "sandbox-nsswitch.conf",
                "/etc/nsswitch.conf",
            )
        )
        self.assertNotIn("/home", command)
        self.assertNotIn("/var", command)

        clear_index = command.index("--clearenv")
        delimiter = command.index("--", clear_index)
        inner_environment: dict[str, str] = {}
        cursor = clear_index + 1
        while cursor < delimiter:
            self.assertEqual(command[cursor], "--setenv")
            inner_environment[command[cursor + 1]] = command[cursor + 2]
            cursor += 3

        self.assertEqual(inner_environment["HOME"], "/session/runtime/home")
        self.assertEqual(
            inner_environment["PATH"],
            "/gnu/store/test-profile/bin:/gnu/store/test-profile/sbin",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_VLM"],
            "/session/runtime/genera",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_PRELOADS"],
            (
                "/session/runtime/ifconfig-bypass.so:"
                "/session/runtime/x-compat.so"
            ),
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_TIME_SERVER"],
            "/session/runtime/rfc868-time-server.py",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_TIME_READY"],
            "/session/runtime/time.ready.json",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_TIME_EVIDENCE"],
            "/session/runtime/time.json",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_TIME_COMPLETE"],
            "/session/runtime/time.complete.json",
        )
        self.assertEqual(
            inner_environment["GENERA_COMPUTER_USE_TIME_FAILURE"],
            "/session/runtime/time.failure.json",
        )
        self.assertNotIn("UNRELATED_SECRET", inner_environment)

        guest_command = command[delimiter + 1 :]
        self.assertEqual(
            guest_command[:4],
            [
                "/gnu/store/test-profile/bin/bash",
                "/museum/scripts/inside-genera-computer-use-netns.sh",
                "/gnu/store/test-profile/bin/bash",
                "/museum/scripts/inside-genera-computer-use-vlm.sh",
            ],
        )
        self.assertEqual(command[command.index("-network") + 1], genera.NETWORK_SPEC)
        self.assertEqual(
            command[command.index("-world") + 1],
            "/session/runtime/world.vlod",
        )
        self.assertEqual(
            command[command.index("-debugger") + 1],
            "/session/runtime/debugger",
        )
        self.assertEqual(command[command.index("-display") + 1], ":207")
        self.assertEqual(command[command.index("-coldloaddisplay") + 1], ":207")
        self.assertEqual(expected_vlm_argument, "/session/runtime/genera")
        self.assertNotIn("UNRELATED_SECRET", env)
        self.assertFalse(any(key.startswith("GENERA_COMPUTER_USE_") for key in env))
        self.assertEqual(env["HOME"], str(runtime / "home"))
        self.assertEqual(env["DISPLAY"], ":207")
        self.assertEqual(env["XAUTHORITY"], state["xauthority"])


class ShutdownTests(unittest.TestCase):
    def test_process_termination_helpers_distinguish_orderly_and_forced(self) -> None:
        self.assertEqual(genera.terminate_process(None, 2), (None, False))

        graceful = mock.Mock(name="graceful")
        graceful.poll.return_value = None
        graceful.returncode = 0
        graceful.wait.return_value = 0
        self.assertEqual(genera.terminate_process(graceful, 2), (0, False))
        graceful.terminate.assert_called_once_with()
        graceful.kill.assert_not_called()

        forced = mock.Mock(name="forced")
        forced.poll.return_value = None
        forced.returncode = -signal.SIGKILL
        forced.wait.side_effect = (
            subprocess.TimeoutExpired(cmd="Xvfb", timeout=2),
            -signal.SIGKILL,
        )
        self.assertEqual(
            genera.terminate_process(forced, 2), (-signal.SIGKILL, True)
        )
        forced.kill.assert_called_once_with()

        group = mock.Mock(name="launcher-group")
        group.pid = 5150
        group.poll.return_value = None
        group.wait.side_effect = (
            subprocess.TimeoutExpired(cmd="launcher", timeout=3),
            -signal.SIGKILL,
        )
        with mock.patch.object(genera.os, "killpg") as killpg:
            self.assertTrue(genera.terminate_process_group(group, 3))
        self.assertEqual(
            killpg.call_args_list,
            [mock.call(5150, signal.SIGTERM), mock.call(5150, signal.SIGKILL)],
        )

    def _run_supervisor_stop_case(
        self,
        *,
        prompt_observed: bool,
        cleanup_progress: bool,
        exits_after_confirmation: bool,
    ) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "museum"
            session.mkdir()
            runtime = session / "runtime"
            runtime.mkdir()
            private_vlm = runtime / "genera"
            private_ifconfig_preload = runtime / "ifconfig-preload.so"
            private_x_compatibility_preload = runtime / "x-compat.so"
            private_time_server = runtime / "rfc868-time-server.py"
            private_config = runtime / ".VLM"
            for path in (
                private_vlm,
                private_ifconfig_preload,
                private_x_compatibility_preload,
                private_time_server,
                private_config,
            ):
                path.write_bytes(path.name.encode("ascii"))

            state: dict[str, object] = {
                "schema": genera.STATE_SCHEMA,
                "session": "museum",
                "session_dir": str(session),
                "generation": 4,
                "boot_id": "boot-test",
                "status": "starting",
                "private_artifacts": {
                    "vlm": {"path": str(private_vlm)},
                    "ifconfig_preload": {"path": str(private_ifconfig_preload)},
                    "x_compatibility_preload": {
                        "path": str(private_x_compatibility_preload)
                    },
                    "time_server": {"path": str(private_time_server)},
                    "config": {"path": str(private_config)},
                },
            }
            updates: list[dict[str, object]] = []
            handlers: dict[int, object] = {}

            class FakeLock:
                closed = False

                def close(self):
                    self.closed = True

            class FakeStdin:
                def __init__(self):
                    self.writes: list[bytes] = []
                    self.flush_count = 0
                    self.closed = False

                def write(self, value: bytes):
                    self.writes.append(value)
                    return len(value)

                def flush(self):
                    self.flush_count += 1

                def close(self):
                    self.closed = True

            class FakeProcess:
                def __init__(self, pid: int, stdin=None):
                    self.pid = pid
                    self.stdin = stdin
                    self.returncode = 0

                def poll(self):
                    return None

            xvfb = FakeProcess(111)
            stdin = FakeStdin()
            launcher = FakeProcess(222, stdin=stdin)
            run_lock = FakeLock()

            def fake_signal(signum, handler):
                handlers[signum] = handler

            def fake_update(_session: Path, changes: dict[str, object]):
                updates.append(dict(changes))
                state.update(changes)
                return dict(state)

            def fake_discover(_state):
                handler = handlers[signal.SIGTERM]
                handler(signal.SIGTERM, None)
                selected = {
                    "window_id": 3333,
                    "title": "Genera on private-vlm",
                    "kind": "main",
                    "geometry": {"width": 1200, "height": 900},
                    "area": 1080000,
                }
                return {"candidates": [selected], "selected": selected}

            records = {
                111: {"pid": 111, "start_ticks": 1, "cmdline": "Xvfb"},
                222: {"pid": 222, "start_ticks": 2, "cmdline": "bwrap"},
                333: {"pid": 333, "start_ticks": 3, "cmdline": "genera"},
            }
            with contextlib.ExitStack() as stack:
                stack.enter_context(
                    mock.patch.object(
                        genera.signal, "signal", side_effect=fake_signal
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "wait_for_own_record", return_value=dict(state)
                    )
                )
                stack.enter_context(
                    mock.patch.object(genera, "try_run_lock", return_value=run_lock)
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "start_xvfb",
                        return_value=(
                            xvfb,
                            ":207",
                            runtime / "Xauthority",
                            {"mode": "pre-vlm-core-modifier-map"},
                            {
                                "mit_shm_enabled": False,
                                "mit_shm_verified_absent": True,
                            },
                        ),
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "process_record",
                        side_effect=lambda pid: records[pid],
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "update_state", side_effect=fake_update
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "read_state",
                        side_effect=lambda *_args, **_kwargs: dict(state),
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "launcher_command",
                        return_value=(
                            ["fake-launcher"],
                            {},
                            "/session/runtime/genera",
                        ),
                    )
                )
                popen = stack.enter_context(
                    mock.patch.object(
                        genera.subprocess, "Popen", return_value=launcher
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "proc_cmdline_elements",
                        return_value=["bwrap", "--unshare-net"],
                    )
                )
                find_descendant = stack.enter_context(
                    mock.patch.object(
                        genera, "find_vlm_descendant", return_value=333
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "verify_execution_inputs",
                        return_value={
                            "verified_at": "2026-07-17T12:00:00-04:00",
                            "private_artifacts": {
                                "vlm": "h" * 64,
                                "ifconfig_preload": "i" * 64,
                                "x_compatibility_preload": "x" * 64,
                                "time_server": "t" * 64,
                                "config": "c" * 64,
                            },
                            "harness_sources": {},
                        },
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "read_time_service_evidence", return_value=None
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "read_time_service_failure", return_value=None
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "discover_windows", side_effect=fake_discover
                    )
                )
                stack.enter_context(mock.patch.object(genera.time, "sleep"))
                stack.enter_context(
                    mock.patch.object(genera, "process_matches", return_value=True)
                )
                safe_signal = stack.enter_context(
                    mock.patch.object(genera, "safe_signal", return_value=True)
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "wait_for_log_token",
                        side_effect=[prompt_observed, cleanup_progress],
                    )
                )
                process_gone_results = (
                    [True] if exits_after_confirmation else [False, True]
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "wait_process_gone",
                        side_effect=process_gone_results,
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "terminate_process_group", return_value=False
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera, "terminate_process", return_value=(0, False)
                    )
                )
                stack.enter_context(
                    mock.patch.object(
                        genera,
                        "hashes_at_stop",
                        return_value={"base_world_unchanged": True},
                    )
                )
                result = genera.supervise(session)

            final = updates[-1]
            self.assertIsNone(final["guest_checkpoint_created"])
            self.assertIsNone(final["save_world_performed"])
            self.assertFalse(final["save_world_invoked_by_harness"])
            self.assertTrue(final["unsaved_lisp_state_discarded"])
            self.assertTrue(final["base_world_unchanged"])
            self.assertEqual(stdin.writes, [b"yes\n"])
            self.assertEqual(stdin.flush_count, 1)
            self.assertTrue(stdin.closed)
            self.assertIs(popen.call_args.kwargs["stdin"], subprocess.PIPE)
            find_descendant.assert_called_once_with(
                222, "/session/runtime/genera"
            )
            self.assertTrue(run_lock.closed)
            return {
                "result": result,
                "final": final,
                "vlm_record": records[333],
                "safe_signal_calls": safe_signal.call_args_list,
            }

    def test_orderly_supervisor_exit_records_accepted_confirmation(self) -> None:
        observed = self._run_supervisor_stop_case(
            prompt_observed=True,
            cleanup_progress=False,
            exits_after_confirmation=True,
        )
        final = observed["final"]

        self.assertEqual(observed["result"], 0)
        self.assertEqual(final["status"], "stopped")
        self.assertTrue(final["vlm_signal_sent"])
        self.assertTrue(final["shutdown_prompt_observed"])
        self.assertTrue(final["shutdown_confirmation_sent"])
        self.assertTrue(final["shutdown_confirmation_accepted"])
        self.assertFalse(final["shutdown_cleanup_progress_observed"])
        self.assertFalse(final["forced_after_confirmed_shutdown_stall"])
        self.assertTrue(final["orderly_vlm_host_shutdown"])
        self.assertFalse(final["forced_stop"])
        self.assertFalse(final["state_may_be_incomplete"])
        self.assertEqual(
            observed["safe_signal_calls"],
            [mock.call(observed["vlm_record"], "boot-test", signal.SIGTERM)],
        )

    def test_accepted_confirmation_with_stalled_cleanup_is_forced(self) -> None:
        observed = self._run_supervisor_stop_case(
            prompt_observed=True,
            cleanup_progress=True,
            exits_after_confirmation=False,
        )
        final = observed["final"]

        self.assertEqual(observed["result"], 1)
        self.assertEqual(final["status"], "forced-stopped")
        self.assertTrue(final["vlm_signal_sent"])
        self.assertTrue(final["shutdown_prompt_observed"])
        self.assertTrue(final["shutdown_confirmation_sent"])
        self.assertTrue(final["shutdown_confirmation_accepted"])
        self.assertTrue(final["shutdown_cleanup_progress_observed"])
        self.assertTrue(final["forced_after_confirmed_shutdown_stall"])
        self.assertFalse(final["orderly_vlm_host_shutdown"])
        self.assertTrue(final["forced_stop"])
        self.assertTrue(final["state_may_be_incomplete"])
        self.assertEqual(
            observed["safe_signal_calls"],
            [
                mock.call(observed["vlm_record"], "boot-test", signal.SIGTERM),
                mock.call(observed["vlm_record"], "boot-test", signal.SIGKILL),
            ],
        )

    def test_confirmation_without_observed_prompt_is_not_accepted(self) -> None:
        observed = self._run_supervisor_stop_case(
            prompt_observed=False,
            cleanup_progress=True,
            exits_after_confirmation=True,
        )
        final = observed["final"]

        self.assertEqual(observed["result"], 0)
        self.assertEqual(final["status"], "stopped")
        self.assertFalse(final["shutdown_prompt_observed"])
        self.assertTrue(final["shutdown_confirmation_sent"])
        self.assertTrue(final["shutdown_cleanup_progress_observed"])
        self.assertFalse(final["shutdown_confirmation_accepted"])
        self.assertFalse(final["orderly_vlm_host_shutdown"])
        self.assertFalse(final["forced_after_confirmed_shutdown_stall"])

    def test_stale_active_session_with_no_live_processes_is_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary) / "state"
            genera.ensure_state_root(state_root)
            session = state_root / "museum"
            genera.ensure_session_directory(session)
            initial = {
                "schema": genera.STATE_SCHEMA,
                "session": "museum",
                "session_dir": str(session),
                "generation": 1,
                "boot_id": "boot-test",
                "status": "running",
                "supervisor": {"pid": 101, "start_ticks": 1},
                "vlm": {"pid": 202, "start_ticks": 2},
                "launcher": {"pid": 303, "start_ticks": 3},
                "xvfb": {"pid": 404, "start_ticks": 4},
            }
            genera.replace_state(session, initial)

            args = genera.argparse.Namespace(
                session="museum",
                timeout=1,
                discard=False,
            )
            with (
                mock.patch.object(
                    genera,
                    "live_processes",
                    return_value={
                        "supervisor": False,
                        "xvfb": False,
                        "launcher": False,
                        "vlm": False,
                    },
                ),
                mock.patch.object(genera, "safe_signal", return_value=False) as safe_signal,
                mock.patch.object(genera, "safe_signal_group", return_value=False),
                mock.patch.object(genera, "wait_process_gone", return_value=True),
                mock.patch.object(
                    genera,
                    "hashes_at_stop",
                    return_value={"base_world_unchanged": True},
                ),
                mock.patch.object(
                    genera, "now_iso", return_value="2026-07-17T12:00:00-04:00"
                ),
                mock.patch.object(genera, "status_payload", side_effect=dict),
                mock.patch.object(genera, "json_print"),
            ):
                self.assertEqual(genera.command_stop(args, state_root), 2)

            final = genera.read_state(session)
            self.assertEqual(final["status"], "forced-stopped")
            self.assertTrue(final["forced_stop"])
            self.assertTrue(final["state_may_be_incomplete"])
            self.assertFalse(final["vlm_signal_sent"])
            self.assertFalse(final["shutdown_prompt_observed"])
            self.assertFalse(final["shutdown_confirmation_sent"])
            self.assertFalse(final["shutdown_confirmation_accepted"])
            self.assertFalse(final["shutdown_cleanup_progress_observed"])
            self.assertFalse(final["forced_after_confirmed_shutdown_stall"])
            self.assertFalse(final["vlm_forced_stop"])
            self.assertFalse(final["orderly_vlm_host_shutdown"])
            self.assertFalse(final["fallback_process_signal_sent"])
            self.assertIsNone(final["guest_checkpoint_created"])
            self.assertIsNone(final["save_world_performed"])
            self.assertFalse(final["save_world_invoked_by_harness"])
            self.assertTrue(final["unsaved_lisp_state_discarded"])
            self.assertTrue(final["base_world_unchanged"])
            self.assertIn("all recorded processes disappeared", final["error"])
            self.assertEqual(safe_signal.call_count, 3)

    def test_forced_cleanup_of_current_vlm_returns_two(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary) / "state"
            genera.ensure_state_root(state_root)
            session = state_root / "museum"
            genera.ensure_session_directory(session)
            initial = {
                "schema": genera.STATE_SCHEMA,
                "session": "museum",
                "session_dir": str(session),
                "generation": 1,
                "boot_id": "boot-test",
                "status": "running",
                "supervisor": {"pid": 101, "start_ticks": 1},
                "vlm": {"pid": 202, "start_ticks": 2},
                "launcher": {"pid": 303, "start_ticks": 3},
                "xvfb": {"pid": 404, "start_ticks": 4},
            }
            genera.replace_state(session, initial)

            def fake_safe_signal(record, _boot_id, _signum):
                return bool(record and record["pid"] == 202)

            args = genera.argparse.Namespace(
                session="museum", timeout=1, discard=False
            )
            with (
                mock.patch.object(
                    genera,
                    "live_processes",
                    return_value={
                        "supervisor": False,
                        "xvfb": False,
                        "launcher": False,
                        "vlm": True,
                    },
                ),
                mock.patch.object(
                    genera, "safe_signal", side_effect=fake_safe_signal
                ),
                mock.patch.object(genera, "safe_signal_group", return_value=False),
                mock.patch.object(genera, "wait_process_gone", return_value=True),
                mock.patch.object(genera, "hashes_at_stop", return_value={}),
                mock.patch.object(genera, "status_payload", side_effect=dict),
                mock.patch.object(genera, "json_print"),
            ):
                self.assertEqual(genera.command_stop(args, state_root), 2)

            final = genera.read_state(session)
            self.assertEqual(final["status"], "forced-stopped")
            self.assertTrue(final["forced_stop"])
            self.assertTrue(final["vlm_forced_stop"])
            self.assertTrue(final["fallback_process_signal_sent"])
            self.assertTrue(final["state_may_be_incomplete"])
            self.assertTrue(final["unsaved_lisp_state_discarded"])


class GenerationHistoryTests(unittest.TestCase):
    def test_legacy_state_and_actions_are_preserved_before_next_generation(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "museum"
            session.mkdir()
            previous = {
                "schema": genera.STATE_SCHEMA,
                "session": "museum",
                "session_dir": str(session),
                "generation": 1,
                "status": "stopped",
            }
            genera.atomic_write_json(genera.state_path(session), previous)
            legacy_actions = session / "actions.json"
            genera.atomic_write_json(
                legacy_actions,
                {"schema": 1, "actions": [{"action": "key", "keys": ["F1"]}]},
            )

            def fake_copy(source: Path, destination: Path) -> None:
                shutil.copy2(source, destination)

            with mock.patch.object(
                genera, "copy_reflink", side_effect=fake_copy
            ):
                preserved = genera.preserve_previous_generation(session, previous)

            first_history = genera.generation_state_path(session, 1)
            self.assertEqual(
                json.loads(first_history.read_text(encoding="utf-8")), preserved
            )
            preserved_actions = (
                session / "actions" / "legacy-through-generation-0001.json"
            )
            self.assertEqual(
                preserved_actions.read_bytes(), legacy_actions.read_bytes()
            )
            self.assertEqual(
                preserved["legacy_action_log"]["sha256"],
                genera.sha256_file(preserved_actions),
            )

            second = {
                "schema": genera.STATE_SCHEMA,
                "session": "museum",
                "session_dir": str(session),
                "generation": 2,
                "status": "prepared",
            }
            genera.replace_state(session, second)
            genera.update_state(session, {"status": "running"})

            current = genera.read_state(session)
            second_history = genera.generation_state_path(session, 2)
            self.assertEqual(current["generation"], 2)
            self.assertEqual(current["status"], "running")
            self.assertEqual(
                json.loads(second_history.read_text(encoding="utf-8")), current
            )
            self.assertEqual(
                json.loads(first_history.read_text(encoding="utf-8")), preserved
            )
            self.assertEqual(
                genera.action_log_path(session, 2).name,
                "generation-0002.json",
            )


class WaitCommandTests(unittest.TestCase):
    def test_zero_second_wait_still_requires_a_running_session(self) -> None:
        args = genera.argparse.Namespace(session="museum", seconds=0)
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary)
            with mock.patch.object(
                genera,
                "require_running",
                side_effect=genera.HarnessError("session is stopped"),
            ) as require_running:
                with self.assertRaisesRegex(genera.HarnessError, "stopped"):
                    genera.command_wait(args, state_root)

        require_running.assert_called_once_with(state_root / "museum")

    def test_semantic_wait_reports_the_selected_window_kind(self) -> None:
        args = genera.argparse.Namespace(
            session="museum",
            seconds=None,
            stable_for=None,
            changed_from=None,
            window_kind="cold-load",
        )
        state = {"status": "running"}
        selected = {
            "kind": "cold-load",
            "window_id": 17,
            "title": "INTERNET|10.0.0.2 Cold Load Stream",
            "geometry": {"x": 0, "y": 0, "width": 1280, "height": 956},
        }
        with tempfile.TemporaryDirectory() as temporary:
            state_root = Path(temporary)
            with mock.patch.object(
                genera, "require_running", return_value=state
            ) as require_running, mock.patch.object(
                genera, "refresh_window", return_value=(state, selected)
            ) as refresh_window, mock.patch.object(genera, "json_print") as json_print:
                self.assertEqual(genera.command_wait(args, state_root), 0)

        session_dir = state_root / "museum"
        require_running.assert_called_once_with(session_dir)
        refresh_window.assert_called_once_with(session_dir, state, "cold-load")
        json_print.assert_called_once_with(
            {
                "session": "museum",
                "condition": "window-ready",
                "window_kind": "cold-load",
                "window": selected,
            }
        )


class ParserTests(unittest.TestCase):
    def test_parser_exposes_public_commands_without_resume(self) -> None:
        parser = genera.build_parser()
        cases = (
            (["doctor", "--archive", "/licensed/archive"], "doctor", genera.command_doctor),
            (
                ["start", "--session", "demo", "--fresh", "--timeout", "12.5"],
                "start",
                genera.command_start,
            ),
            (["status", "--session", "demo"], "status", genera.command_status),
            (
                ["wait", "--session", "demo", "--stable-for", "2"],
                "wait",
                genera.command_wait,
            ),
            (["key", "--session", "demo", "--down", "select"], "key", genera.command_key),
            (
                ["type", "--session", "demo", "--enter", "(+ 2 3)"],
                "type",
                genera.command_type,
            ),
            (
                ["mouse", "--session", "demo", "click", "12", "34", "--button", "3"],
                "mouse",
                genera.command_mouse,
            ),
            (
                ["screenshot", "--session", "demo", "--label", "listener"],
                "screenshot",
                genera.command_screenshot,
            ),
            (["stop", "--session", "demo", "--discard"], "stop", genera.command_stop),
        )
        for arguments, command, handler in cases:
            with self.subTest(arguments=arguments):
                parsed = parser.parse_args(arguments)
                self.assertEqual(parsed.command, command)
                self.assertIs(parsed.handler, handler)

        start = parser.parse_args(["start"])
        self.assertEqual(start.session, genera.DEFAULT_SESSION)
        self.assertEqual(start.timeout, 120)
        self.assertFalse(start.fresh)
        self.assertFalse(hasattr(start, "resume"))

        internal = parser.parse_args(["_supervise", "--session", "internal"])
        self.assertEqual(internal.command, "_supervise")
        self.assertFalse(hasattr(internal, "resume"))
        self.assertFalse(hasattr(internal, "handler"))

        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                parser.parse_args(["start", "--resume"])

    def test_parser_rejects_conflicting_or_unbounded_inputs(self) -> None:
        parser = genera.build_parser()
        invalid = (
            [],
            ["key"],
            ["key", "--down", "--up", "a"],
            ["mouse"],
            ["start", "--timeout", "0"],
            ["start", "--timeout", "nan"],
            ["wait", "--seconds", "-1"],
            ["wait", "--stable-for", "inf"],
            ["key", "--delay-ms", "60001", "a"],
            ["mouse", "drag", "0", "0", "1", "1", "--steps", "0"],
            ["stop", "--timeout", "-1"],
        )
        for arguments in invalid:
            with self.subTest(arguments=arguments):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit):
                        parser.parse_args(arguments)


if __name__ == "__main__":
    unittest.main()
