#include "cadr_audio_model.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;
static cadr_audio_incarnation_allocator test_incarnation_allocator;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        ++failures; \
    } \
} while (0)

static uint32_t get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t get64(const uint8_t *bytes)
{
    uint64_t result = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        result |= (uint64_t)bytes[index] << (index * 8U);
    }
    return result;
}

static void put32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static const cadr_audio_event *queue_at(const cadr_audio_model *model,
                                        uint32_t offset)
{
    return &model->queue[(model->head + offset) % CADR_AUDIO_QUEUE_PACKETS];
}

static void initialize_fresh(cadr_audio_model *model,
                             cadr_audio_authority *authority,
                             uint64_t generation,
                             uint32_t renderer_profile,
                             uint64_t identity,
                             uint64_t consumer_epoch)
{
    CHECK(cadr_audio_authority_initialize(
              authority, &test_incarnation_allocator,
              identity, consumer_epoch, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_initialize(
              model, authority, generation, renderer_profile) ==
          CADR_AUDIO_STATUS_OK);
}

static void test_literals_and_beep_validation(void)
{
    static const uint8_t initial_witness[CADR_AUDIO_WITNESS_BYTES] = {
        0x9cU,0x6cU,0x1aU,0x65U,0x66U,0xcaU,0xf4U,0x7aU,
        0x10U,0x96U,0x85U,0x5cU,0x93U,0xd8U,0x32U,0xd6U,
        0x05U,0xd5U,0x50U,0x33U,0x1dU,0x96U,0x06U,0x79U,
        0x0aU,0x4dU,0x53U,0xc5U,0xaeU,0xddU,0xcbU,0x2dU
    };
    cadr_audio_model model = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor cursor;
    uint8_t copied[CADR_AUDIO_CANONICAL_EVENT_BYTES];
    uint8_t mutated[CADR_AUDIO_CANONICAL_EVENT_BYTES];
    uint8_t witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t head_witness[CADR_AUDIO_WITNESS_BYTES];
    uint64_t written = 99U;

    CHECK(CADR_AUDIO_ABI_MAJOR == UINT32_C(1));
    CHECK(CADR_AUDIO_ABI_MINOR == UINT32_C(6));
    CHECK(CADR_AUDIO_PROTOCOL_VERSION == UINT32_C(6));
    CHECK(CADR_AUDIO_CANONICAL_EVENT_BYTES == UINT32_C(64));
    CHECK(CADR_AUDIO_QUEUE_PACKETS == UINT32_C(64));
    CHECK(CADR_AUDIO_FRAMES_PER_PACKET == UINT32_C(512));
    CHECK(CADR_AUDIO_UART_8E2 == UINT32_C(0x00020208));
    CHECK(CADR_AUDIO_UART_7E1 == UINT32_C(0x00010207));

    initialize_fresh(&model, &authority, UINT64_C(7),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(1001), UINT64_C(99));
    cadr_audio_model_witness_copy(&model, witness);
    cadr_audio_model_head_witness_copy(&model, head_witness);
    CHECK(memcmp(witness, initial_witness, sizeof(witness)) == 0);
    CHECK(memcmp(head_witness, initial_witness, sizeof(head_witness)) == 0);
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(19), UINT32_C(744), UINT32_C(1058)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.pending_active == 0U && model.count == 1U);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cursor.generation == UINT64_C(7) &&
          cursor.authority_identity == UINT64_C(1001) &&
          cursor.consumer_epoch == UINT64_C(99) &&
          cursor.sequence == 0U && cursor.frame_offset == 0U &&
          cursor.frames_remaining == UINT32_C(9));
    CHECK(get64(cursor.event) == 0U &&
          get64(cursor.event + 8U) == UINT64_C(7) &&
          get64(cursor.event + 16U) == UINT64_C(19));
    CHECK(get32(cursor.event + 24U) == 0U &&
          get32(cursor.event + 28U) == CADR_AUDIO_EVENT_BEEP &&
          get32(cursor.event + 32U) == UINT32_C(9) &&
          get32(cursor.event + 40U) == UINT32_C(744) &&
          get32(cursor.event + 44U) == UINT32_C(1058) &&
          get64(cursor.event + 48U) == 0U &&
          get32(cursor.event + 56U) == CADR_AUDIO_SOURCE_BEEPER_303 &&
          get32(cursor.event + 60U) == 0U);
    CHECK(cadr_audio_event_validate(cursor.event) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_copy(&model, &cursor, copied, sizeof(copied),
                                &written) == CADR_AUDIO_STATUS_OK &&
          written == sizeof(copied) &&
          memcmp(copied, cursor.event, sizeof(copied)) == 0);
    CHECK(cadr_audio_model_copy(&model, &cursor, copied,
                                sizeof(copied) - 1U, &written) ==
          CADR_AUDIO_STATUS_WRONG_LENGTH && written == 0U);

    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put32(mutated + 60U, 1U);
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put32(mutated + 36U, get32(mutated + 36U) | UINT32_C(0x80));
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put32(mutated + 44U, 0U);
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put64(mutated + 48U, UINT64_C(1));
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put64(mutated + 48U, UINT64_C(9));
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put32(mutated + 32U, UINT32_C(8));
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
}

static void test_partial_ack_render_and_restore_session(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model restored = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor original;
    cadr_audio_cursor remainder;
    cadr_audio_cursor session_two_cursor;
    cadr_audio_cursor restored_cursor;
    uint8_t before_witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t after_witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t before_anchor[CADR_AUDIO_WITNESS_BYTES];
    uint8_t after_anchor[CADR_AUDIO_WITNESS_BYTES];
    uint32_t frames_written = UINT32_MAX;
    int16_t pcm[CADR_AUDIO_FRAMES_PER_PACKET] = { 0 };
    static const int16_t expected_remainder_pcm[5] = {
        30273, 18204, 0, -12539, -27245
    };

    initialize_fresh(&model, &authority, UINT64_C(7),
                     CADR_AUDIO_RENDERER_USIM_SDL3_SINE,
                     UINT64_C(2001), UINT64_C(1));
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(19), UINT32_C(744), UINT32_C(1058)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &original) == CADR_AUDIO_STATUS_OK);
    cadr_audio_model_witness_copy(&model, before_witness);
    cadr_audio_model_head_witness_copy(&model, before_anchor);
    CHECK(cadr_audio_model_ack(&model, &original, UINT32_C(4)) ==
          CADR_AUDIO_STATUS_OK);
    cadr_audio_model_witness_copy(&model, after_witness);
    cadr_audio_model_head_witness_copy(&model, after_anchor);
    CHECK(memcmp(before_witness, after_witness, sizeof(before_witness)) == 0);
    CHECK(memcmp(before_anchor, after_anchor, sizeof(before_anchor)) == 0);
    CHECK(cadr_audio_model_copy(&model, &original, original.event,
                                sizeof(original.event), &(uint64_t){ 0U }) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_peek(&model, &remainder) == CADR_AUDIO_STATUS_OK);
    CHECK(remainder.sequence == original.sequence &&
          remainder.frame_offset == UINT32_C(4) &&
          remainder.frames_remaining == UINT32_C(5));
    CHECK(cadr_audio_model_render_pcm_s16le(
              &model, &remainder, pcm, CADR_AUDIO_FRAMES_PER_PACKET,
              &frames_written) == CADR_AUDIO_STATUS_OK &&
          frames_written == UINT32_C(5) &&
          memcmp(pcm, expected_remainder_pcm,
                 sizeof(expected_remainder_pcm)) == 0);

    restored = model;
    CHECK(cadr_audio_model_start_consumer_session(&model) ==
          CADR_AUDIO_STATUS_OK &&
          authority.consumer_epoch == UINT64_C(2));
    CHECK(cadr_audio_model_ack(&model, &remainder, UINT32_C(5)) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_peek(&model, &session_two_cursor) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(session_two_cursor.consumer_epoch == UINT64_C(2) &&
          session_two_cursor.generation == remainder.generation &&
          memcmp(session_two_cursor.event, remainder.event,
                 sizeof(remainder.event)) == 0);
    CHECK(cadr_audio_model_start_consumer_session(&model) ==
          CADR_AUDIO_STATUS_OK &&
          authority.consumer_epoch == UINT64_C(3));
    CHECK(cadr_audio_model_ack(&model, &remainder, UINT32_C(5)) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_ack(&model, &session_two_cursor,
                               UINT32_C(5)) ==
          CADR_AUDIO_STATUS_STALE);
    {
        cadr_audio_authority forged_authority = authority;
        cadr_audio_model rolled_back = restored;
        forged_authority.consumer_epoch = UINT64_C(1);
        rolled_back.authority = &forged_authority;
        CHECK(cadr_audio_model_adopt_semantic_state(&model, &rolled_back) ==
              CADR_AUDIO_STATUS_OK);
        CHECK(model.authority == &authority &&
              authority.consumer_epoch == UINT64_C(4));
        CHECK(cadr_audio_model_ack(&model, &remainder, UINT32_C(5)) ==
              CADR_AUDIO_STATUS_STALE);
    }
    CHECK(cadr_audio_model_peek(&model, &restored_cursor) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(restored_cursor.consumer_epoch == UINT64_C(4));
    cadr_audio_model_witness_copy(&model, after_witness);
    CHECK(memcmp(before_witness, after_witness, sizeof(before_witness)) == 0);
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &restored_cursor, UINT32_C(5)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &restored_cursor) ==
          CADR_AUDIO_STATUS_EMPTY);
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
}

static void test_pointer_free_snapshot_transport(void)
{
    cadr_audio_model source = { 0 };
    cadr_audio_model destination = { 0 };
    cadr_audio_authority source_authority = { 0 };
    cadr_audio_authority destination_authority = { 0 };
    cadr_audio_cursor source_cursor;
    cadr_audio_cursor destination_cursor;
    uint8_t bytes[CADR_AUDIO_SNAPSHOT_MAX_BYTES];
    uint32_t size = 0U;
    uint32_t written = 0U;

    initialize_fresh(&source, &source_authority, UINT64_C(11),
                     CADR_AUDIO_RENDERER_USIM_SDL3_SINE,
                     UINT64_C(7001), UINT64_C(3));
    CHECK(cadr_audio_model_accept_beep_job(
              &source, UINT64_C(9), UINT32_C(744), UINT32_C(125000)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&source, &source_cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&source, &source_cursor, UINT32_C(7)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_snapshot_size(&source, &size) == CADR_AUDIO_STATUS_OK &&
          size > CADR_AUDIO_SNAPSHOT_HEADER_BYTES);
    CHECK(cadr_audio_model_snapshot_serialize(&source, bytes, sizeof(bytes),
                                               &written) == CADR_AUDIO_STATUS_OK &&
          written == size);
    initialize_fresh(&destination, &destination_authority, UINT64_C(1),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(7002), UINT64_C(1));
    CHECK(cadr_audio_model_snapshot_adopt(&destination, bytes, written) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&destination, &destination_cursor) ==
          CADR_AUDIO_STATUS_OK &&
          destination_cursor.consumer_epoch == UINT64_C(2) &&
          destination_cursor.sequence == source_cursor.sequence &&
          destination_cursor.frame_offset == UINT32_C(7) &&
          memcmp(destination_cursor.event, source_cursor.event,
                 sizeof(source_cursor.event)) == 0);
    bytes[12] ^= UINT8_C(1);
    CHECK(cadr_audio_model_snapshot_adopt(&destination, bytes, written) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_verify_witness(&destination) == CADR_AUDIO_STATUS_OK);
}

static void test_large_resumable_job(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model malformed = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor head;
    const cadr_audio_event *tail;
    uint8_t witness_before[CADR_AUDIO_WITNESS_BYTES];
    uint8_t witness_after[CADR_AUDIO_WITNESS_BYTES];
    uint32_t index;

    initialize_fresh(&model, &authority, UINT64_C(1),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(3001), UINT64_C(1));
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(2), UINT32_C(744), UINT32_C(4096001)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.count == CADR_AUDIO_QUEUE_PACKETS &&
          model.queued_frames == UINT64_C(32768) &&
          model.pending_active == 1U &&
          model.pending_half_wavelength_us == UINT32_C(744) &&
          model.pending_duration_us == UINT32_C(4096001) &&
          model.pending_total_frames == UINT64_C(32769) &&
          model.pending_next_frame == UINT64_C(32768) &&
          model.pending_post_slot == UINT64_C(2));
    for (index = 0U; index < CADR_AUDIO_QUEUE_PACKETS; ++index) {
        const cadr_audio_event *event = queue_at(&model, index);
        CHECK(event->sequence == index && event->post_slot == UINT64_C(2) &&
              event->intra_slot == index &&
              event->payload == (uint64_t)index * CADR_AUDIO_FRAMES_PER_PACKET &&
              event->frame_count == CADR_AUDIO_FRAMES_PER_PACKET);
    }
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
    malformed = model;
    malformed.pending_next_frame -= CADR_AUDIO_FRAMES_PER_PACKET;
    CHECK(cadr_audio_model_verify_witness(&malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    cadr_audio_model_witness_copy(&model, witness_before);
    CHECK(cadr_audio_model_peek(&model, &head) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &head,
                               CADR_AUDIO_FRAMES_PER_PACKET) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.count == CADR_AUDIO_QUEUE_PACKETS &&
          model.pending_active == 0U &&
          model.queued_frames == UINT64_C(32257) &&
          model.active_post_slot == UINT64_C(2));
    tail = queue_at(&model, CADR_AUDIO_QUEUE_PACKETS - 1U);
    CHECK(tail->sequence == UINT64_C(64) &&
          tail->post_slot == UINT64_C(2) &&
          tail->intra_slot == UINT32_C(64) &&
          tail->payload == UINT64_C(32768) &&
          tail->frame_count == UINT32_C(1));
    for (index = 0U; index < CADR_AUDIO_QUEUE_PACKETS; ++index) {
        CHECK(queue_at(&model, index)->sequence == (uint64_t)index + UINT64_C(1));
    }
    cadr_audio_model_witness_copy(&model, witness_after);
    CHECK(memcmp(witness_before, witness_after, sizeof(witness_before)) != 0);
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(3)) ==
          CADR_AUDIO_STATUS_BACKPRESSURE);
}

static void test_sixty_three_uart_then_513_frame_job(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model unchanged = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor head;
    const cadr_audio_event *tail;
    uint32_t slot;

    initialize_fresh(&model, &authority, UINT64_C(4),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(4001), UINT64_C(8));
    for (slot = 0U; slot < 63U; ++slot) {
        CHECK(cadr_audio_model_begin_slot(&model, slot) ==
              CADR_AUDIO_STATUS_OK);
        CHECK(cadr_audio_model_enqueue_votrax(
                  &model, CADR_AUDIO_SOURCE_VOTRAX_303,
                  slot & UINT32_C(255)) == CADR_AUDIO_STATUS_OK);
    }
    CHECK(model.count == 63U && model.active_post_slot == UINT64_C(62));
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(63), UINT32_C(744), UINT32_C(64125)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.count == CADR_AUDIO_QUEUE_PACKETS &&
          model.pending_active == 1U &&
          model.pending_total_frames == UINT64_C(513) &&
          model.pending_next_frame == UINT64_C(512));
    tail = queue_at(&model, CADR_AUDIO_QUEUE_PACKETS - 1U);
    CHECK(tail->sequence == UINT64_C(63) && tail->payload == 0U &&
          tail->frame_count == CADR_AUDIO_FRAMES_PER_PACKET);
    CHECK(cadr_audio_model_peek(&model, &head) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &head, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.count == CADR_AUDIO_QUEUE_PACKETS &&
          model.pending_active == 0U);
    tail = queue_at(&model, CADR_AUDIO_QUEUE_PACKETS - 1U);
    CHECK(tail->sequence == UINT64_C(64) &&
          tail->payload == UINT64_C(512) &&
          tail->frame_count == UINT32_C(1));
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);

    unchanged = model;
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(64), UINT32_C(744), UINT32_C(1)) ==
          CADR_AUDIO_STATUS_BACKPRESSURE);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
}

static void test_uart_boundaries_and_profiles(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model unchanged = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor cursor;
    uint8_t mutated[CADR_AUDIO_CANONICAL_EVENT_BYTES];

    initialize_fresh(&model, &authority, UINT64_C(1),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(5001), UINT64_C(2));
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_S46, UINT32_C(255)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(get32(cursor.event + 40U) == UINT32_C(255) &&
          get32(cursor.event + 44U) == CADR_AUDIO_UART_7E1 &&
          get64(cursor.event + 48U) == UINT64_C(300));
    (void)memcpy(mutated, cursor.event, sizeof(mutated));
    put32(mutated + 40U, UINT32_C(256));
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    put32(mutated + 40U, UINT32_MAX);
    CHECK(cadr_audio_event_validate(mutated) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    unchanged = model;
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_S46, UINT32_C(256)) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_S46, UINT32_MAX) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
    CHECK(cadr_audio_model_ack(&model, &cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(2)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(255)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(get32(cursor.event + 40U) == UINT32_C(255) &&
          get32(cursor.event + 44U) == CADR_AUDIO_UART_8E2 &&
          cadr_audio_event_validate(cursor.event) == CADR_AUDIO_STATUS_OK);
}

static void prepare_distinct_history(cadr_audio_model *model,
                                     cadr_audio_authority *authority,
                                     uint32_t first_byte)
{
    cadr_audio_cursor cursor;
    initialize_fresh(model, authority, UINT64_C(9),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(6000) + first_byte, UINT64_C(4));
    CHECK(cadr_audio_model_begin_slot(model, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              model, CADR_AUDIO_SOURCE_VOTRAX_303, first_byte) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(model, UINT64_C(2)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(9)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(model, &cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
}

static void test_distinct_acknowledged_histories(void)
{
    cadr_audio_model left = { 0 };
    cadr_audio_model right = { 0 };
    cadr_audio_authority left_authority = { 0 };
    cadr_audio_authority right_authority = { 0 };
    cadr_audio_cursor left_head;
    cadr_audio_cursor right_head;
    uint8_t left_anchor[CADR_AUDIO_WITNESS_BYTES];
    uint8_t right_anchor[CADR_AUDIO_WITNESS_BYTES];
    uint8_t left_final[CADR_AUDIO_WITNESS_BYTES];
    uint8_t right_final[CADR_AUDIO_WITNESS_BYTES];

    prepare_distinct_history(&left, &left_authority, UINT32_C(1));
    prepare_distinct_history(&right, &right_authority, UINT32_C(2));
    CHECK(cadr_audio_model_peek(&left, &left_head) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&right, &right_head) == CADR_AUDIO_STATUS_OK);
    CHECK(memcmp(left_head.event, right_head.event,
                 sizeof(left_head.event)) == 0);
    cadr_audio_model_head_witness_copy(&left, left_anchor);
    cadr_audio_model_head_witness_copy(&right, right_anchor);
    cadr_audio_model_witness_copy(&left, left_final);
    cadr_audio_model_witness_copy(&right, right_final);
    CHECK(memcmp(left_anchor, right_anchor, sizeof(left_anchor)) != 0);
    CHECK(memcmp(left_final, right_final, sizeof(left_final)) != 0);
    CHECK(cadr_audio_model_verify_witness(&left) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_verify_witness(&right) == CADR_AUDIO_STATUS_OK);
}

static void test_reset_clears_job_and_stales_cursor(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model unchanged = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_cursor stale;
    cadr_audio_cursor cursor;
    uint64_t authority_identity;
    uint64_t authority_incarnation;
    uint64_t accepted_sequence_high_water;
    uintptr_t authority_self;
    cadr_audio_incarnation_allocator *authority_allocator;

    initialize_fresh(&model, &authority, UINT64_C(42),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(7001), UINT64_C(70));
    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(1), UINT32_C(744), UINT32_C(4096001)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &stale) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_reset(&model) == CADR_AUDIO_STATUS_OK &&
          model.generation == UINT64_C(43) &&
          authority.consumer_epoch == UINT64_C(71) &&
          model.count == 0U && model.pending_active == 0U &&
          model.pending_total_frames == 0U &&
          model.pending_next_frame == 0U);
    CHECK(cadr_audio_model_ack(&model, &stale, stale.frames_remaining) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_peek(&model, &cursor) ==
          CADR_AUDIO_STATUS_EMPTY);
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);

    CHECK(cadr_audio_model_accept_beep_job(
              &model, UINT64_C(2), UINT32_C(744), UINT32_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &cursor, cursor.frames_remaining) ==
          CADR_AUDIO_STATUS_OK && authority.accepted_sequence_high_water != 0U &&
          model.count == 0U);

    authority_identity = authority.identity;
    authority_incarnation = authority.incarnation;
    accepted_sequence_high_water = authority.accepted_sequence_high_water;
    authority_self = authority.self_address_token;
    authority_allocator = authority.incarnation_allocator;
    CHECK(cadr_audio_model_reset_for_generation(&model, UINT64_C(9)) ==
          CADR_AUDIO_STATUS_OK && model.generation == UINT64_C(9) &&
          authority.consumer_epoch == UINT64_C(72) && model.count == 0U &&
          authority.identity == authority_identity &&
          authority.incarnation == authority_incarnation &&
          authority.accepted_sequence_high_water == accepted_sequence_high_water &&
          authority.self_address_token == authority_self &&
          authority.incarnation_allocator == authority_allocator);
    unchanged = model;
    CHECK(cadr_audio_model_reset_for_generation(&model, UINT64_C(0)) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);

    model.generation = UINT64_MAX;
    unchanged = model;
    CHECK(cadr_audio_model_reset(&model) == CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
    model = unchanged;
    model.generation = UINT64_C(43);
    authority.consumer_epoch = UINT64_MAX;
    unchanged = model;
    CHECK(cadr_audio_model_reset(&model) == CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
    CHECK(cadr_audio_model_start_consumer_session(&model) ==
          CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&model, &unchanged, sizeof(model)) == 0);
}

static void test_acknowledged_sequence_anchor(void)
{
    cadr_audio_model model = { 0 };
    cadr_audio_model malformed = { 0 };
    cadr_audio_model live_before = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_authority authority_before = { 0 };
    cadr_audio_cursor cursor;

    initialize_fresh(&model, &authority, UINT64_C(5),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(8001), UINT64_C(1));
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(10)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(2)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(11)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &cursor) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_ack(&model, &cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(model.count == 0U && model.head_sequence == UINT64_C(2) &&
          model.next_sequence == UINT64_C(2));
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);

    malformed = model;
    malformed.head_sequence = UINT64_C(1);
    malformed.next_sequence = UINT64_C(1);
    CHECK(cadr_audio_model_verify_witness(&malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    live_before = model;
    authority_before = authority;
    CHECK(cadr_audio_model_adopt_semantic_state(&model, &malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&model, &live_before, sizeof(model)) == 0 &&
          memcmp(&authority, &authority_before, sizeof(authority)) == 0);
    CHECK(cadr_audio_model_begin_slot(&malformed, UINT64_C(3)) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_enqueue_votrax(
              &malformed, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(12)) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(malformed.count == 0U &&
          malformed.next_sequence == UINT64_C(1) &&
          malformed.head_sequence == UINT64_C(1));
    CHECK(cadr_audio_model_verify_witness(&malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);

    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(3)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(12)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(queue_at(&model, 0U)->sequence == UINT64_C(2));
    CHECK(cadr_audio_model_verify_witness(&model) == CADR_AUDIO_STATUS_OK);
    malformed = model;
    malformed.head_sequence = UINT64_C(1);
    CHECK(cadr_audio_model_verify_witness(&malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    malformed = model;
    malformed.next_sequence = UINT64_C(2);
    CHECK(cadr_audio_model_verify_witness(&malformed) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
}

static void test_authority_identity_and_exhaustion(void)
{
    cadr_audio_model left = { 0 };
    cadr_audio_model right = { 0 };
    cadr_audio_model unchanged = { 0 };
    cadr_audio_authority left_authority = { 0 };
    cadr_audio_authority right_authority = { 0 };
    cadr_audio_authority epoch_exhausted = { 0 };
    cadr_audio_authority sequence_exhausted = { 0 };
    cadr_audio_cursor left_cursor;

    initialize_fresh(&left, &left_authority, UINT64_C(12),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(9001), UINT64_C(4));
    initialize_fresh(&right, &right_authority, UINT64_C(12),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(9001), UINT64_C(4));
    CHECK(cadr_audio_model_begin_slot(&left, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&right, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &left, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(7)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &right, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(7)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&left, &left_cursor) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(left_cursor.authority_identity == UINT64_C(9001) &&
          left_cursor.authority_address_token ==
              (uintptr_t)(void *)&left_authority &&
          left_cursor.authority_incarnation == left_authority.incarnation &&
          left_authority.incarnation != right_authority.incarnation);
    unchanged = right;
    CHECK(cadr_audio_model_ack(&right, &left_cursor, 0U) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(memcmp(&right, &unchanged, sizeof(right)) == 0);
    CHECK(cadr_audio_model_destroy(&left) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_destroy(&right) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(&left_authority) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(&right_authority) ==
          CADR_AUDIO_STATUS_OK);

    CHECK(cadr_audio_authority_initialize(
              &epoch_exhausted, &test_incarnation_allocator,
              UINT64_C(9003), UINT64_MAX, UINT64_C(0)) ==
          CADR_AUDIO_STATUS_OK);
    (void)memset(&left, 0, sizeof(left));
    CHECK(cadr_audio_model_initialize(
              &left, &epoch_exhausted, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    unchanged = left;
    CHECK(cadr_audio_model_start_consumer_session(&left) ==
          CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&left, &unchanged, sizeof(left)) == 0);
    CHECK(cadr_audio_model_adopt_semantic_state(&left, &unchanged) ==
          CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&left, &unchanged, sizeof(left)) == 0);

    CHECK(cadr_audio_authority_initialize(
              &sequence_exhausted, &test_incarnation_allocator,
              UINT64_C(9004), UINT64_C(1),
              UINT64_MAX) == CADR_AUDIO_STATUS_OK);
    (void)memset(&right, 0, sizeof(right));
    CHECK(cadr_audio_model_initialize(
              &right, &sequence_exhausted, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&right, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    unchanged = right;
    CHECK(cadr_audio_model_enqueue_votrax(
              &right, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(1)) ==
          CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&right, &unchanged, sizeof(right)) == 0 &&
          sequence_exhausted.accepted_sequence_high_water == UINT64_MAX);
}

static void test_authority_lifecycle(void)
{
    cadr_audio_authority authority = { 0 };
    cadr_audio_authority unchanged_authority = { 0 };
    cadr_audio_model first = { 0 };
    cadr_audio_model second = { 0 };
    cadr_audio_model unchanged_model = { 0 };

    unchanged_authority = authority;
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              0U, UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              UINT64_C(9100), 0U, 0U) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              UINT64_C(9100), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_OK);

    unchanged_authority = authority;
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              UINT64_C(9100), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_model_initialize(
              &first, &authority, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    unchanged_authority = authority;
    unchanged_model = first;
    CHECK(cadr_audio_model_initialize(
              &first, &authority, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&first, &unchanged_model, sizeof(first)) == 0 &&
          memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              UINT64_C(9101), UINT64_C(2), 0U) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    unchanged_model = second;
    CHECK(cadr_audio_model_initialize(
              &second, &authority, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&second, &unchanged_model, sizeof(second)) == 0);

    CHECK(cadr_audio_model_destroy(&first) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_destroy(&first) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_OK);
    unchanged_authority = authority;
    CHECK(cadr_audio_authority_initialize(
              &authority, &test_incarnation_allocator,
              UINT64_C(9100), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&authority, &unchanged_authority, sizeof(authority)) == 0);
    CHECK(cadr_audio_model_initialize(
              &second, &authority, UINT64_C(1),
              CADR_AUDIO_RENDERER_NO_AUDIO) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
}

static void test_model_alias_rejection(void)
{
    cadr_audio_authority authority = { 0 };
    cadr_audio_model original = { 0 };
    cadr_audio_model alias = { 0 };
    cadr_audio_model original_before = { 0 };
    cadr_audio_authority authority_before = { 0 };
    cadr_audio_cursor cursor;

    initialize_fresh(&original, &authority, UINT64_C(20),
                     CADR_AUDIO_RENDERER_NO_AUDIO,
                     UINT64_C(9200), UINT64_C(1));
    CHECK(cadr_audio_model_begin_slot(&original, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &original, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(3)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&original, &cursor) ==
          CADR_AUDIO_STATUS_OK);
    alias = original;
    original_before = original;
    authority_before = authority;

    CHECK(cadr_audio_model_ack(&alias, &cursor, 0U) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_reset(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_start_consumer_session(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_destroy(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_adopt_semantic_state(&alias, &original) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_verify_witness(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&original, &original_before, sizeof(original)) == 0 &&
          memcmp(&authority, &authority_before, sizeof(authority)) == 0);

    CHECK(cadr_audio_model_ack(&original, &cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_destroy(&original) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_OK);
}

static void test_authority_address_reuse_and_allocator_exhaustion(void)
{
    cadr_audio_incarnation_allocator allocator = { 0 };
    cadr_audio_incarnation_allocator exhausted_before = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_authority detached_copy = { 0 };
    cadr_audio_authority second_authority = { 0 };
    cadr_audio_model model = { 0 };
    cadr_audio_cursor old_cursor;
    cadr_audio_cursor new_cursor;
    uintptr_t old_address;
    uint64_t old_incarnation;

    CHECK(cadr_audio_incarnation_allocator_initialize(
              &allocator, UINT64_C(50)) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_initialize(
              &authority, &allocator, UINT64_C(9300), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_initialize(
              &model, &authority, UINT64_C(30),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(4)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &old_cursor) ==
          CADR_AUDIO_STATUS_OK);
    old_address = old_cursor.authority_address_token;
    old_incarnation = old_cursor.authority_incarnation;
    CHECK(cadr_audio_model_destroy(&model) == CADR_AUDIO_STATUS_OK);
    detached_copy = authority;
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(&detached_copy) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    authority = detached_copy;
    CHECK(cadr_audio_model_initialize(
              &model, &authority, UINT64_C(30),
              CADR_AUDIO_RENDERER_NO_AUDIO) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);

    /* Simulate allocator reuse of the same storage address for a new object. */
    (void)memset(&authority, 0, sizeof(authority));
    CHECK(cadr_audio_authority_initialize(
              &authority, &allocator, UINT64_C(9300), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_initialize(
              &model, &authority, UINT64_C(30),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(&model, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              &model, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(4)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(&model, &new_cursor) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(new_cursor.authority_address_token == old_address &&
          new_cursor.authority_incarnation != old_incarnation);
    CHECK(cadr_audio_model_ack(&model, &old_cursor, 0U) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_ack(&model, &new_cursor, 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_destroy(&model) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_OK);

    (void)memset(&allocator, 0, sizeof(allocator));
    (void)memset(&authority, 0, sizeof(authority));
    CHECK(cadr_audio_incarnation_allocator_initialize(
              &allocator, UINT64_MAX - UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_initialize(
              &authority, &allocator, UINT64_C(9301), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(authority.incarnation == UINT64_MAX - UINT64_C(1));
    exhausted_before = allocator;
    CHECK(cadr_audio_authority_initialize(
              &second_authority, &allocator, UINT64_C(9302),
              UINT64_C(1), 0U) == CADR_AUDIO_STATUS_OVERFLOW);
    CHECK(memcmp(&allocator, &exhausted_before, sizeof(allocator)) == 0 &&
          memcmp(&second_authority,
                 &(cadr_audio_authority){ 0 },
                 sizeof(second_authority)) == 0);
    CHECK(cadr_audio_authority_destroy(&authority) ==
          CADR_AUDIO_STATUS_OK);
}

static void test_alias_after_owner_and_authority_free(void)
{
    cadr_audio_incarnation_allocator allocator = { 0 };
    cadr_audio_authority *authority =
        (cadr_audio_authority *)calloc(1U, sizeof(*authority));
    cadr_audio_model *owner =
        (cadr_audio_model *)calloc(1U, sizeof(*owner));
    cadr_audio_model alias = { 0 };
    cadr_audio_cursor cursor;

    CHECK(authority != NULL && owner != NULL);
    if (authority == NULL || owner == NULL) {
        free(owner);
        free(authority);
        return;
    }
    CHECK(cadr_audio_incarnation_allocator_initialize(
              &allocator, UINT64_C(70)) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_initialize(
              authority, &allocator, UINT64_C(9400), UINT64_C(1), 0U) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_initialize(
              owner, authority, UINT64_C(40),
              CADR_AUDIO_RENDERER_NO_AUDIO) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_begin_slot(owner, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_enqueue_votrax(
              owner, CADR_AUDIO_SOURCE_VOTRAX_303, UINT32_C(5)) ==
          CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_model_peek(owner, &cursor) ==
          CADR_AUDIO_STATUS_OK);
    alias = *owner;
    CHECK(cadr_audio_model_destroy(owner) == CADR_AUDIO_STATUS_OK);
    CHECK(cadr_audio_authority_destroy(authority) ==
          CADR_AUDIO_STATUS_OK);
    free(authority);
    free(owner);

    CHECK(cadr_audio_model_ack(&alias, &cursor, 0U) ==
          CADR_AUDIO_STATUS_STALE);
    CHECK(cadr_audio_model_reset(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_start_consumer_session(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_audio_model_destroy(&alias) ==
          CADR_AUDIO_STATUS_INVALID_ARGUMENT);
}

int main(void)
{
    CHECK(cadr_audio_incarnation_allocator_initialize(
              &test_incarnation_allocator, UINT64_C(1)) ==
          CADR_AUDIO_STATUS_OK);
    test_literals_and_beep_validation();
    test_partial_ack_render_and_restore_session();
    test_pointer_free_snapshot_transport();
    test_large_resumable_job();
    test_sixty_three_uart_then_513_frame_job();
    test_uart_boundaries_and_profiles();
    test_distinct_acknowledged_histories();
    test_reset_clears_job_and_stales_cursor();
    test_acknowledged_sequence_anchor();
    test_authority_identity_and_exhaustion();
    test_authority_lifecycle();
    test_model_alias_rejection();
    test_authority_address_reuse_and_allocator_exhaustion();
    test_alias_after_owner_and_authority_free();
    if (failures != 0) return 1;
    (void)puts("cadr M11 audio model passed");
    return 0;
}
