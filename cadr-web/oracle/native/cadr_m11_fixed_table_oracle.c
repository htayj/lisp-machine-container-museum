/*
 * CDRM11FIX1 is a synthetic, fixed-table audio-model comparator.  It links
 * the clean-room cadr_audio_model.c directly; it does not link SDL3, open an
 * audio device, or make a claim about a preserved or physical waveform.
 */
#include "cadr_audio_model.h"

#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef CDR_M11_CORE_SHA256
#error "CDR_M11_CORE_SHA256 must identify cadr_audio_model.c"
#endif
#ifndef CDR_M11_ORACLE_SHA256
#error "CDR_M11_ORACLE_SHA256 must identify this oracle source"
#endif
#ifndef CDR_M11_SCRIPT_SHA256
#error "CDR_M11_SCRIPT_SHA256 must identify the checked runner"
#endif

#define SNAPSHOT_CAPACITY CADR_AUDIO_SNAPSHOT_MAX_BYTES

typedef struct sha256_state {
    uint32_t words[8];
    uint64_t byte_count;
    uint8_t block[64];
    uint32_t used;
} sha256_state;

typedef struct fixture_capture {
    uint8_t initial_snapshot[SNAPSHOT_CAPACITY];
    uint8_t pause_snapshot[SNAPSHOT_CAPACITY];
    uint8_t post_ack_snapshot[SNAPSHOT_CAPACITY];
    uint8_t events[3][CADR_AUDIO_CANONICAL_EVENT_BYTES];
    uint8_t head_witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t final_witness[CADR_AUDIO_WITNESS_BYTES];
    uint8_t pre_pause_hash[CADR_AUDIO_WITNESS_BYTES];
    uint8_t resumed_hashes[3][CADR_AUDIO_WITNESS_BYTES];
    int16_t short_samples[9];
    uint32_t initial_snapshot_bytes;
    uint32_t pause_snapshot_bytes;
    uint32_t post_ack_snapshot_bytes;
    uint32_t event_count;
    uint32_t pre_pause_frames;
    uint32_t resumed_frames[3];
    uint32_t resumed_count;
} fixture_capture;

static uint32_t rotate_right(uint32_t value, uint32_t amount)
{
    return (value >> amount) | (value << (32U - amount));
}

static uint32_t get32be(const uint8_t bytes[4])
{
    return ((uint32_t)bytes[0] << 24U) | ((uint32_t)bytes[1] << 16U) |
        ((uint32_t)bytes[2] << 8U) | (uint32_t)bytes[3];
}

static void sha256_compress(sha256_state *state, const uint8_t block[64])
{
    static const uint32_t constants[64] = {
        UINT32_C(0x428a2f98),UINT32_C(0x71374491),UINT32_C(0xb5c0fbcf),UINT32_C(0xe9b5dba5),
        UINT32_C(0x3956c25b),UINT32_C(0x59f111f1),UINT32_C(0x923f82a4),UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98),UINT32_C(0x12835b01),UINT32_C(0x243185be),UINT32_C(0x550c7dc3),
        UINT32_C(0x72be5d74),UINT32_C(0x80deb1fe),UINT32_C(0x9bdc06a7),UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1),UINT32_C(0xefbe4786),UINT32_C(0x0fc19dc6),UINT32_C(0x240ca1cc),
        UINT32_C(0x2de92c6f),UINT32_C(0x4a7484aa),UINT32_C(0x5cb0a9dc),UINT32_C(0x76f988da),
        UINT32_C(0x983e5152),UINT32_C(0xa831c66d),UINT32_C(0xb00327c8),UINT32_C(0xbf597fc7),
        UINT32_C(0xc6e00bf3),UINT32_C(0xd5a79147),UINT32_C(0x06ca6351),UINT32_C(0x14292967),
        UINT32_C(0x27b70a85),UINT32_C(0x2e1b2138),UINT32_C(0x4d2c6dfc),UINT32_C(0x53380d13),
        UINT32_C(0x650a7354),UINT32_C(0x766a0abb),UINT32_C(0x81c2c92e),UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1),UINT32_C(0xa81a664b),UINT32_C(0xc24b8b70),UINT32_C(0xc76c51a3),
        UINT32_C(0xd192e819),UINT32_C(0xd6990624),UINT32_C(0xf40e3585),UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116),UINT32_C(0x1e376c08),UINT32_C(0x2748774c),UINT32_C(0x34b0bcb5),
        UINT32_C(0x391c0cb3),UINT32_C(0x4ed8aa4a),UINT32_C(0x5b9cca4f),UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee),UINT32_C(0x78a5636f),UINT32_C(0x84c87814),UINT32_C(0x8cc70208),
        UINT32_C(0x90befffa),UINT32_C(0xa4506ceb),UINT32_C(0xbef9a3f7),UINT32_C(0xc67178f2)
    };
    uint32_t words[64];
    uint32_t a, b, c, d, e, f, g, h, index;
    for (index = 0U; index < 16U; ++index) words[index] = get32be(block + index * 4U);
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = rotate_right(words[index - 15U], 7U) ^
            rotate_right(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
        const uint32_t s1 = rotate_right(words[index - 2U], 17U) ^
            rotate_right(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a = state->words[0]; b = state->words[1]; c = state->words[2]; d = state->words[3];
    e = state->words[4]; f = state->words[5]; g = state->words[6]; h = state->words[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t s1 = rotate_right(e, 6U) ^ rotate_right(e, 11U) ^ rotate_right(e, 25U);
        const uint32_t choice = (e & f) ^ ((~e) & g);
        const uint32_t temporary_one = h + s1 + choice + constants[index] + words[index];
        const uint32_t s0 = rotate_right(a, 2U) ^ rotate_right(a, 13U) ^ rotate_right(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary_two = s0 + majority;
        h = g; g = f; f = e; e = d + temporary_one;
        d = c; c = b; b = a; a = temporary_one + temporary_two;
    }
    state->words[0] += a; state->words[1] += b; state->words[2] += c; state->words[3] += d;
    state->words[4] += e; state->words[5] += f; state->words[6] += g; state->words[7] += h;
}

static void sha256_initialize(sha256_state *state)
{
    static const uint32_t initial[8] = {
        UINT32_C(0x6a09e667),UINT32_C(0xbb67ae85),UINT32_C(0x3c6ef372),UINT32_C(0xa54ff53a),
        UINT32_C(0x510e527f),UINT32_C(0x9b05688c),UINT32_C(0x1f83d9ab),UINT32_C(0x5be0cd19)
    };
    (void)memcpy(state->words, initial, sizeof(initial));
    state->byte_count = 0U;
    state->used = 0U;
}

static void sha256_update(sha256_state *state, const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t room = UINT32_C(64) - state->used;
        const uint32_t take = count < (uint64_t)room ? (uint32_t)count : room;
        (void)memcpy(state->block + state->used, bytes, take);
        state->used += take;
        state->byte_count += take;
        bytes += take;
        count -= take;
        if (state->used == UINT32_C(64)) {
            sha256_compress(state, state->block);
            state->used = 0U;
        }
    }
}

static void sha256_finish(sha256_state *state, uint8_t output[32])
{
    uint8_t tail[128] = { 0U };
    const uint64_t bit_count = state->byte_count * UINT64_C(8);
    const uint32_t tail_bytes = state->used < UINT32_C(56) ? UINT32_C(64) : UINT32_C(128);
    uint32_t index;
    (void)memcpy(tail, state->block, state->used);
    tail[state->used] = UINT8_C(0x80);
    for (index = 0U; index < 8U; ++index) tail[tail_bytes - 1U - index] =
        (uint8_t)(bit_count >> (index * 8U));
    sha256_compress(state, tail);
    if (tail_bytes == UINT32_C(128)) sha256_compress(state, tail + 64U);
    for (index = 0U; index < 8U; ++index) {
        output[index * 4U] = (uint8_t)(state->words[index] >> 24U);
        output[index * 4U + 1U] = (uint8_t)(state->words[index] >> 16U);
        output[index * 4U + 2U] = (uint8_t)(state->words[index] >> 8U);
        output[index * 4U + 3U] = (uint8_t)state->words[index];
    }
}

static void hash_s16le(const int16_t *samples, uint32_t frame_count, uint8_t output[32])
{
    sha256_state state;
    uint32_t index;
    sha256_initialize(&state);
    for (index = 0U; index < frame_count; ++index) {
        const uint16_t sample = (uint16_t)samples[index];
        const uint8_t bytes[2] = { (uint8_t)sample, (uint8_t)(sample >> 8U) };
        sha256_update(&state, bytes, sizeof(bytes));
    }
    sha256_finish(&state, output);
}

static int capture_snapshot(const cadr_audio_model *model, uint8_t bytes[SNAPSHOT_CAPACITY],
                            uint32_t *out_bytes)
{
    uint32_t needed = 0U;
    if (cadr_audio_model_snapshot_size(model, &needed) != CADR_AUDIO_STATUS_OK ||
        needed > SNAPSHOT_CAPACITY ||
        cadr_audio_model_snapshot_serialize(model, bytes, SNAPSHOT_CAPACITY, out_bytes) !=
            CADR_AUDIO_STATUS_OK || *out_bytes != needed) return 0;
    return 1;
}

static int initialize_model(cadr_audio_model *model, cadr_audio_authority *authority,
                            cadr_audio_incarnation_allocator *allocator)
{
    if (cadr_audio_incarnation_allocator_initialize(allocator, UINT64_C(1)) !=
            CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_initialize(authority, allocator, UINT64_C(1), UINT64_C(1),
                                        UINT64_C(0)) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_initialize(model, authority, UINT64_C(1),
                                    CADR_AUDIO_RENDERER_USIM_SDL3_SINE) !=
            CADR_AUDIO_STATUS_OK) return 0;
    return 1;
}

static int render_head(const cadr_audio_model *model, cadr_audio_cursor *cursor,
                       int16_t samples[CADR_AUDIO_FRAMES_PER_PACKET],
                       uint32_t *out_frames, uint8_t hash[32])
{
    if (cadr_audio_model_peek(model, cursor) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_model_render_pcm_s16le(model, cursor, samples,
                                          CADR_AUDIO_FRAMES_PER_PACKET,
                                          out_frames) != CADR_AUDIO_STATUS_OK ||
        *out_frames != cursor->frames_remaining) return 0;
    hash_s16le(samples, *out_frames, hash);
    return 1;
}

static int capture_short_fixture(fixture_capture *capture)
{
    cadr_audio_model model = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_incarnation_allocator allocator = { 0 };
    cadr_audio_cursor cursor;
    int16_t samples[CADR_AUDIO_FRAMES_PER_PACKET] = { 0 };
    uint8_t packet_hash[32];
    uint32_t frames = 0U;
    static const int16_t expected[9] = {
        0, 23170, 32767, 23170, 0, -23170, -32767, -23170, 0
    };
    (void)memset(capture, 0, sizeof(*capture));
    if (!initialize_model(&model, &authority, &allocator) ||
        cadr_audio_model_accept_beep_job(&model, UINT64_C(1), UINT32_C(500),
                                         UINT32_C(1058)) != CADR_AUDIO_STATUS_OK ||
        !capture_snapshot(&model, capture->initial_snapshot,
                          &capture->initial_snapshot_bytes) ||
        !render_head(&model, &cursor, samples, &frames, packet_hash) || frames != UINT32_C(9) ||
        memcmp(samples, expected, sizeof(expected)) != 0) return 0;
    (void)memcpy(capture->events[0], cursor.event, CADR_AUDIO_CANONICAL_EVENT_BYTES);
    (void)memcpy(capture->short_samples, samples, sizeof(expected));
    (void)memcpy(capture->resumed_hashes[0], packet_hash, sizeof(packet_hash));
    capture->event_count = 1U;
    capture->resumed_count = 1U;
    capture->resumed_frames[0] = frames;
    cadr_audio_model_head_witness_copy(&model, capture->head_witness);
    cadr_audio_model_witness_copy(&model, capture->final_witness);
    if (cadr_audio_model_ack(&model, &cursor, frames) != CADR_AUDIO_STATUS_OK ||
        !capture_snapshot(&model, capture->post_ack_snapshot,
                          &capture->post_ack_snapshot_bytes) ||
        cadr_audio_model_destroy(&model) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_destroy(&authority) != CADR_AUDIO_STATUS_OK) return 0;
    return 1;
}

static int capture_multi_fixture(fixture_capture *capture)
{
    cadr_audio_model model = { 0 };
    cadr_audio_authority authority = { 0 };
    cadr_audio_incarnation_allocator allocator = { 0 };
    cadr_audio_cursor cursor;
    int16_t samples[CADR_AUDIO_FRAMES_PER_PACKET] = { 0 };
    uint32_t index;
    uint32_t frames = 0U;
    (void)memset(capture, 0, sizeof(*capture));
    if (!initialize_model(&model, &authority, &allocator) ||
        cadr_audio_model_accept_beep_job(&model, UINT64_C(2), UINT32_C(499),
                                         UINT32_C(128125)) != CADR_AUDIO_STATUS_OK ||
        model.count != UINT32_C(3) ||
        !capture_snapshot(&model, capture->initial_snapshot,
                          &capture->initial_snapshot_bytes)) return 0;
    for (index = 0U; index < UINT32_C(3); ++index) {
        cadr_audio_event_encode(&model.queue[(model.head + index) % CADR_AUDIO_QUEUE_PACKETS],
                                capture->events[index]);
    }
    capture->event_count = 3U;
    cadr_audio_model_head_witness_copy(&model, capture->head_witness);
    cadr_audio_model_witness_copy(&model, capture->final_witness);
    if (!render_head(&model, &cursor, samples, &frames, capture->pre_pause_hash) ||
        frames != CADR_AUDIO_FRAMES_PER_PACKET ||
        cadr_audio_model_ack(&model, &cursor, UINT32_C(200)) != CADR_AUDIO_STATUS_OK ||
        !capture_snapshot(&model, capture->pause_snapshot,
                          &capture->pause_snapshot_bytes)) return 0;
    capture->pre_pause_frames = frames;
    /* Resume only through a fresh model and authority.  Continuing in the
     * source model would let the fixture claim CDRAUDS1 pause/resume coverage
     * while never exercising snapshot adoption. */
    if (cadr_audio_model_destroy(&model) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_destroy(&authority) != CADR_AUDIO_STATUS_OK) return 0;
    (void)memset(&model, 0, sizeof(model));
    (void)memset(&authority, 0, sizeof(authority));
    (void)memset(&allocator, 0, sizeof(allocator));
    if (!initialize_model(&model, &authority, &allocator) ||
        cadr_audio_model_snapshot_adopt(&model, capture->pause_snapshot,
                                        capture->pause_snapshot_bytes) !=
            CADR_AUDIO_STATUS_OK) return 0;
    for (index = 0U; index < UINT32_C(3); ++index) {
        if (!render_head(&model, &cursor, samples, &frames, capture->resumed_hashes[index]) ||
            cadr_audio_model_ack(&model, &cursor, frames) != CADR_AUDIO_STATUS_OK) return 0;
        capture->resumed_frames[index] = frames;
        ++capture->resumed_count;
    }
    if (model.count != 0U || !capture_snapshot(&model, capture->post_ack_snapshot,
                                                &capture->post_ack_snapshot_bytes) ||
        cadr_audio_model_destroy(&model) != CADR_AUDIO_STATUS_OK ||
        cadr_audio_authority_destroy(&authority) != CADR_AUDIO_STATUS_OK) return 0;
    return 1;
}

static void print_hex(const uint8_t *bytes, uint32_t count)
{
    static const char hexadecimal[] = "0123456789abcdef";
    uint32_t index;
    (void)putchar('"');
    for (index = 0U; index < count; ++index) {
        (void)putchar(hexadecimal[bytes[index] >> 4U]);
        (void)putchar(hexadecimal[bytes[index] & UINT8_C(15)]);
    }
    (void)putchar('"');
}

static uint64_t snapshot_get64(const uint8_t *bytes, uint32_t offset)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)bytes[offset + index] << (index * 8U);
    return value;
}

static uint32_t snapshot_get32(const uint8_t *bytes, uint32_t offset)
{
    return (uint32_t)bytes[offset] | ((uint32_t)bytes[offset + 1U] << 8U) |
        ((uint32_t)bytes[offset + 2U] << 16U) | ((uint32_t)bytes[offset + 3U] << 24U);
}

static void print_post_ack(const fixture_capture *capture)
{
    const uint8_t *const bytes = capture->post_ack_snapshot;
    (void)fputs("{\"snapshot_cdrauds1_hex\":", stdout);
    print_hex(bytes, capture->post_ack_snapshot_bytes);
    (void)printf(",\"head_sequence\":%" PRIu64 ",\"next_sequence\":%" PRIu64
                 ",\"packet_count\":%" PRIu32 ",\"queued_frames\":%" PRIu64 "}",
                 snapshot_get64(bytes, 24U), snapshot_get64(bytes, 32U),
                 snapshot_get32(bytes, 88U), snapshot_get64(bytes, 56U));
}

static void print_packet(const uint8_t event[CADR_AUDIO_CANONICAL_EVENT_BYTES],
                         uint32_t frame_offset, uint32_t frames, const uint8_t hash[32])
{
    (void)fputs("{\"event_hex\":", stdout);
    print_hex(event, CADR_AUDIO_CANONICAL_EVENT_BYTES);
    (void)printf(",\"frame_offset\":%" PRIu32 ",\"frames\":%" PRIu32
                 ",\"pcm_s16le_sha256\":", frame_offset, frames);
    print_hex(hash, CADR_AUDIO_WITNESS_BYTES);
    (void)putchar('}');
}

static void print_short_fixture(const fixture_capture *capture)
{
    uint32_t index;
    (void)fputs("{\"name\":\"short-500us-1058us\",\"job\":{\"post_slot\":1,"
                "\"half_wavelength_us\":500,\"duration_us\":1058},"
                "\"snapshot_cdrauds1_hex\":", stdout);
    print_hex(capture->initial_snapshot, capture->initial_snapshot_bytes);
    (void)fputs(",\"events_hex\":[", stdout);
    print_hex(capture->events[0], CADR_AUDIO_CANONICAL_EVENT_BYTES);
    (void)fputs("],\"packets\":[", stdout);
    print_packet(capture->events[0], 0U, capture->resumed_frames[0], capture->resumed_hashes[0]);
    (void)fputs("],\"pcm_s16le_samples\":[", stdout);
    for (index = 0U; index < UINT32_C(9); ++index) {
        if (index != 0U) (void)putchar(',');
        (void)printf("%d", (int)capture->short_samples[index]);
    }
    (void)fputs("],\"head_witness_sha256\":", stdout);
    print_hex(capture->head_witness, CADR_AUDIO_WITNESS_BYTES);
    (void)fputs(",\"final_witness_sha256\":", stdout);
    print_hex(capture->final_witness, CADR_AUDIO_WITNESS_BYTES);
    (void)fputs(",\"post_ack\":", stdout);
    print_post_ack(capture);
    (void)putchar('}');
}

static void print_multi_fixture(const fixture_capture *capture)
{
    uint32_t index;
    (void)fputs("{\"name\":\"multi-packet-partial-ack-pause\",\"job\":{"
                "\"post_slot\":2,\"half_wavelength_us\":499,\"duration_us\":128125},"
                "\"initial_snapshot_cdrauds1_hex\":", stdout);
    print_hex(capture->initial_snapshot, capture->initial_snapshot_bytes);
    (void)fputs(",\"events_hex\":[", stdout);
    for (index = 0U; index < capture->event_count; ++index) {
        if (index != 0U) (void)putchar(',');
        print_hex(capture->events[index], CADR_AUDIO_CANONICAL_EVENT_BYTES);
    }
    (void)fputs("],\"pre_pause_packet\":", stdout);
    print_packet(capture->events[0], 0U, capture->pre_pause_frames, capture->pre_pause_hash);
    (void)fputs(",\"pause\":{\"ack_frames\":200,\"snapshot_cdrauds1_hex\":", stdout);
    print_hex(capture->pause_snapshot, capture->pause_snapshot_bytes);
    (void)printf(",\"head_sequence\":%" PRIu64 ",\"next_sequence\":%" PRIu64
                 ",\"packet_count\":%" PRIu32 ",\"queued_frames\":%" PRIu64 "}",
                 snapshot_get64(capture->pause_snapshot, 24U),
                 snapshot_get64(capture->pause_snapshot, 32U),
                 snapshot_get32(capture->pause_snapshot, 88U),
                 snapshot_get64(capture->pause_snapshot, 56U));
    (void)fputs(",\"resumed_packets\":[", stdout);
    for (index = 0U; index < capture->resumed_count; ++index) {
        if (index != 0U) (void)putchar(',');
        print_packet(capture->events[index], index == 0U ? UINT32_C(200) : 0U,
                     capture->resumed_frames[index], capture->resumed_hashes[index]);
    }
    (void)fputs("],\"head_witness_sha256\":", stdout);
    print_hex(capture->head_witness, CADR_AUDIO_WITNESS_BYTES);
    (void)fputs(",\"final_witness_sha256\":", stdout);
    print_hex(capture->final_witness, CADR_AUDIO_WITNESS_BYTES);
    (void)fputs(",\"post_ack\":", stdout);
    print_post_ack(capture);
    (void)putchar('}');
}

int main(void)
{
    fixture_capture short_capture;
    fixture_capture multi_capture;
    if (!capture_short_fixture(&short_capture) || !capture_multi_fixture(&multi_capture)) {
        (void)fputs("CDRM11FIX1 fixture construction failed\n", stderr);
        return 1;
    }
    (void)fputs("{\"schema\":\"CDRM11FIX1\",\"schema_version\":1,\"identities\":{"
                "\"core_source_sha256\":\"" CDR_M11_CORE_SHA256 "\","
                "\"oracle_source_sha256\":\"" CDR_M11_ORACLE_SHA256 "\","
                "\"script_source_sha256\":\"" CDR_M11_SCRIPT_SHA256 "\","
                "\"event_encoding\":\"CDRAUD1-v1\","
                "\"renderer\":\"fixed-sine32-q0.15-v1\","
                "\"renderer_profile\":\"USIM-SDL3-SINE-330D8248-CANONICAL-v1\","
                "\"tool\":\"cadr-m11-fixed-table-oracle-v1\"},\"fixtures\":[", stdout);
    print_short_fixture(&short_capture);
    (void)putchar(',');
    print_multi_fixture(&multi_capture);
    (void)fputs("]}\n", stdout);
    return ferror(stdout) ? 1 : 0;
}
