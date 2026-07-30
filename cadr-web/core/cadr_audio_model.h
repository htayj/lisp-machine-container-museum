#ifndef CADR_AUDIO_MODEL_H
#define CADR_AUDIO_MODEL_H

/*
 * C-M11 Phase 1 is a self-contained semantic queue.  It intentionally has no
 * dependency on the CADR core, SDL, Web Audio, libm, or a host audio device.
 * A caller serializes calls to one model instance; these operations are
 * transactional API operations, not a claim of lock-free thread safety.
 */

#include <stdint.h>

#define CADR_AUDIO_ABI_MAJOR UINT32_C(1)
#define CADR_AUDIO_ABI_MINOR UINT32_C(6)
#define CADR_AUDIO_PROTOCOL_VERSION UINT32_C(6)

#define CADR_AUDIO_PROFILE_BEEPER_303 "CADR-IOB-BEEPER-REF-303-v1"
#define CADR_AUDIO_PROFILE_NO_AUDIO "NO-AUDIO"
#define CADR_AUDIO_PROFILE_USIM_SDL3_SINE \
    "USIM-SDL3-SINE-330D8248-CANONICAL-v1"
#define CADR_AUDIO_PROFILE_VOTRAX_303 "VOTRAX-SERIAL-303-300-8E2-v1"
#define CADR_AUDIO_PROFILE_VOTRAX_S46 "VOTRAX-SERIAL-S46-300-7E1-v1"

#define CADR_AUDIO_CANONICAL_EVENT_BYTES UINT32_C(64)
#define CADR_AUDIO_WITNESS_BYTES UINT32_C(32)
#define CADR_AUDIO_QUEUE_PACKETS UINT32_C(64)
#define CADR_AUDIO_FRAMES_PER_PACKET UINT32_C(512)
#define CADR_AUDIO_SAMPLE_RATE UINT32_C(8000)
#define CADR_AUDIO_INCARNATION_SLOTS UINT32_C(64)
#define CADR_AUDIO_SNAPSHOT_HEADER_BYTES UINT32_C(188)
#define CADR_AUDIO_SNAPSHOT_MAX_BYTES \
    (CADR_AUDIO_SNAPSHOT_HEADER_BYTES + \
     CADR_AUDIO_QUEUE_PACKETS * CADR_AUDIO_CANONICAL_EVENT_BYTES)

typedef enum cadr_audio_status {
    CADR_AUDIO_STATUS_OK = 0,
    CADR_AUDIO_STATUS_INVALID_ARGUMENT = 1,
    CADR_AUDIO_STATUS_EMPTY = 2,
    CADR_AUDIO_STATUS_STALE = 3,
    CADR_AUDIO_STATUS_BACKPRESSURE = 4,
    CADR_AUDIO_STATUS_WRONG_LENGTH = 5,
    CADR_AUDIO_STATUS_NOT_READY = 6,
    CADR_AUDIO_STATUS_OVERFLOW = 7
} cadr_audio_status;

typedef enum cadr_audio_renderer_profile {
    CADR_AUDIO_RENDERER_NO_AUDIO = 1,
    CADR_AUDIO_RENDERER_USIM_SDL3_SINE = 2
} cadr_audio_renderer_profile;

typedef enum cadr_audio_source_profile {
    CADR_AUDIO_SOURCE_BEEPER_303 = 1,
    CADR_AUDIO_SOURCE_VOTRAX_303 = 2,
    CADR_AUDIO_SOURCE_VOTRAX_S46 = 3
} cadr_audio_source_profile;

typedef enum cadr_audio_event_kind {
    CADR_AUDIO_EVENT_BEEP = 1,
    CADR_AUDIO_EVENT_VOTRAX_UART = 2
} cadr_audio_event_kind;

#define CADR_AUDIO_EVENT_SYNTHETIC UINT32_C(1)
#define CADR_AUDIO_EVENT_WAVEFORM_NOT_READY UINT32_C(2)
#define CADR_AUDIO_EVENT_UART UINT32_C(4)

/* Low byte is data bits, then parity (2 means even), then stop bits. */
#define CADR_AUDIO_UART_8E2 UINT32_C(0x00020208)
#define CADR_AUDIO_UART_7E1 UINT32_C(0x00010207)

/* This native layout is never serialized directly.  `encode_event` owns the
 * 64-byte little-endian representation named by CDRAUD1. */
typedef struct cadr_audio_event {
    uint64_t sequence;
    uint64_t generation;
    uint64_t post_slot;
    uint32_t intra_slot;
    uint32_t kind;
    uint32_t frame_count;
    uint32_t flags;
    uint32_t primary;
    uint32_t secondary;
    uint64_t payload;
    uint32_t source_profile;
    uint32_t reserved0;
} cadr_audio_event;

typedef struct cadr_audio_model cadr_audio_model;
typedef struct cadr_audio_authority cadr_audio_authority;

typedef struct cadr_audio_incarnation_allocator {
    uint64_t next_incarnation;
    uintptr_t self_address_token;
    uintptr_t authority_addresses[CADR_AUDIO_INCARNATION_SLOTS];
    uint64_t authority_incarnations[CADR_AUDIO_INCARNATION_SLOTS];
    uint8_t authority_active[CADR_AUDIO_INCARNATION_SLOTS];
    uint32_t lifecycle;
    uint32_t reserved0;
} cadr_audio_incarnation_allocator;

typedef struct cadr_audio_cursor {
    uint64_t generation;
    uint64_t authority_identity;
    uintptr_t authority_address_token;
    uint64_t authority_incarnation;
    uint64_t consumer_epoch;
    uint64_t sequence;
    uint32_t frame_offset;
    uint32_t frames_remaining;
    uint8_t event[CADR_AUDIO_CANONICAL_EVENT_BYTES];
} cadr_audio_cursor;

/* Host-owned live authority.  CDRSNAP1 never serializes or adopts this object.
 * Storage MUST be zero-initialized before its one permitted initialization and
 * MUST NOT move or be copied for use afterward. */
struct cadr_audio_authority {
    uint64_t identity;
    uint64_t consumer_epoch;
    uint64_t accepted_sequence_high_water;
    uint64_t incarnation;
    uintptr_t self_address_token;
    cadr_audio_incarnation_allocator *incarnation_allocator;
    cadr_audio_model *owner;
    uint32_t incarnation_slot;
    uint32_t lifecycle;
    uint32_t attached;
};

struct cadr_audio_model {
    cadr_audio_event queue[CADR_AUDIO_QUEUE_PACKETS];
    uint8_t witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t head_witness[CADR_AUDIO_WITNESS_BYTES];
    uintptr_t self_address_token;
    cadr_audio_authority *authority;
    uint64_t generation;
    /* Sequence of the logical head, or next_sequence when the queue is empty. */
    uint64_t head_sequence;
    uint64_t next_sequence;
    uint64_t last_post_slot;
    uint64_t active_post_slot;
    uint64_t queued_frames;
    uint64_t pending_total_frames;
    uint64_t pending_next_frame;
    uint64_t pending_post_slot;
    uint32_t head;
    uint32_t count;
    uint32_t head_frame_offset;
    uint32_t last_intra_slot;
    uint32_t have_last;
    uint32_t slot_open;
    uint32_t renderer_profile;
    uint32_t pending_active;
    uint32_t pending_half_wavelength_us;
    uint32_t pending_duration_us;
};

/* Allocator, authority, and model storage must be zero-initialized and remain at
 * their initialization addresses.  One authority attaches to at most one model
 * in Phase 1. */
cadr_audio_status cadr_audio_authority_initialize(
    cadr_audio_authority *authority,
    cadr_audio_incarnation_allocator *incarnation_allocator,
    uint64_t identity,
    uint64_t consumer_epoch, uint64_t accepted_sequence_high_water);
cadr_audio_status cadr_audio_incarnation_allocator_initialize(
    cadr_audio_incarnation_allocator *allocator,
    uint64_t first_incarnation);
cadr_audio_status cadr_audio_authority_destroy(
    cadr_audio_authority *authority);
cadr_audio_status cadr_audio_model_initialize(
    cadr_audio_model *model, cadr_audio_authority *authority,
    uint64_t generation, uint32_t renderer_profile);
/* Detaches and zeroes one model; authority storage must still be live. */
cadr_audio_status cadr_audio_model_destroy(cadr_audio_model *model);
cadr_audio_status cadr_audio_model_reset(cadr_audio_model *model);
/* Issues the authority's current epoch + 1; no epoch is caller-selectable. */
cadr_audio_status cadr_audio_model_start_consumer_session(
    cadr_audio_model *model);
/* Adopts semantic state only, preserving destination live authority. */
cadr_audio_status cadr_audio_model_adopt_semantic_state(
    cadr_audio_model *destination, const cadr_audio_model *decoded);

/* This must be called before queueing an event for a new post-slot.  It checks
 * queue capacity before changing the active slot, making next-slot
 * backpressure deterministic. */
cadr_audio_status cadr_audio_model_begin_slot(cadr_audio_model *model,
                                              uint64_t post_slot);

/* Atomically accepts one later post-slot and one complete source beep job.
 * Available at-most-512-frame packets are emitted immediately.  If the job is
 * larger than the free ring, its exact continuation stays pending and is
 * pumped after each complete head acknowledgement. */
cadr_audio_status cadr_audio_model_accept_beep_job(
    cadr_audio_model *model, uint64_t post_slot,
    uint32_t half_wavelength_us, uint32_t duration_us);
cadr_audio_status cadr_audio_model_enqueue_votrax(cadr_audio_model *model,
                                                  uint32_t source_profile,
                                                  uint32_t serial_byte);

/* Snapshot the head, copy precisely its canonical event, then consume zero
 * frames for a UART event or one-or-more frames for a beep.  A stale cursor
 * never mutates the model. */
cadr_audio_status cadr_audio_model_peek(const cadr_audio_model *model,
                                        cadr_audio_cursor *out_cursor);
cadr_audio_status cadr_audio_model_copy(const cadr_audio_model *model,
                                        const cadr_audio_cursor *cursor,
                                        uint8_t *bytes, uint64_t capacity,
                                        uint64_t *written);
cadr_audio_status cadr_audio_model_ack(cadr_audio_model *model,
                                       const cadr_audio_cursor *cursor,
                                       uint32_t frames);

/* Phase 1 deliberately has no host-libm-dependent waveform implementation. */
cadr_audio_status cadr_audio_model_render_pcm_s16le(
    const cadr_audio_model *model, const cadr_audio_cursor *cursor,
    int16_t *samples, uint32_t sample_capacity, uint32_t *frames_written);

/* CDRAUDS1 is a canonical, pointer-free transport for queue semantic state.
 * It contains no cursor, authority, address, or consumer-epoch capability.
 * Import atomically adopts valid state into an already live destination and
 * starts a fresh consumer epoch, making every prior cursor stale. */
cadr_audio_status cadr_audio_model_snapshot_size(
    const cadr_audio_model *model, uint32_t *out_byte_count);
cadr_audio_status cadr_audio_model_snapshot_serialize(
    const cadr_audio_model *model, uint8_t *bytes, uint32_t capacity,
    uint32_t *out_written);
cadr_audio_status cadr_audio_model_snapshot_adopt(
    cadr_audio_model *destination, const uint8_t *bytes, uint32_t byte_count);

void cadr_audio_event_encode(const cadr_audio_event *event,
                             uint8_t bytes[CADR_AUDIO_CANONICAL_EVENT_BYTES]);
cadr_audio_status cadr_audio_event_validate(
    const uint8_t bytes[CADR_AUDIO_CANONICAL_EVENT_BYTES]);
void cadr_audio_model_witness_copy(const cadr_audio_model *model,
                                   uint8_t witness[CADR_AUDIO_WITNESS_BYTES]);
void cadr_audio_model_head_witness_copy(
    const cadr_audio_model *model,
    uint8_t witness[CADR_AUDIO_WITNESS_BYTES]);
cadr_audio_status cadr_audio_model_verify_witness(
    const cadr_audio_model *model);

#endif
