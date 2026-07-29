#include "cadr_snapshot.h"
#include "cadr_state_v3.h"
#include "cadr_trace_engine.h"

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define CADR_SNAPSHOT_HEADER_BYTES UINT64_C(264)
#define CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES UINT64_C(64)
#define CADR_SNAPSHOT_TRAILER_BYTES UINT64_C(32)
#define CADR_SNAPSHOT_M2_CHUNK_COUNT UINT32_C(8)
#define CADR_SNAPSHOT_M3_CHUNK_COUNT UINT32_C(9)
#define CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT CADR_SNAPSHOT_M3_CHUNK_COUNT
#define CADR_SNAPSHOT_MAX_CHUNKS UINT32_C(1024)
#define CADR_SNAPSHOT_REQUIRED_FLAG UINT32_C(1)
#define CADR_SNAPSHOT_MAX_COMPLETION_BYTES UINT64_C(1048576)
#define CADR_SNAPSHOT_U48_MASK UINT64_C(0x0000ffffffffffff)

#define CADR_SNAPSHOT_CHUNK_CORE UINT32_C(1)
#define CADR_SNAPSHOT_CHUNK_CPU UINT32_C(2)
#define CADR_SNAPSHOT_CHUNK_MEMORY UINT32_C(3)
#define CADR_SNAPSHOT_CHUNK_BUS UINT32_C(4)
#define CADR_SNAPSHOT_CHUNK_DEVICES UINT32_C(5)
#define CADR_SNAPSHOT_CHUNK_CANONICAL UINT32_C(6)
#define CADR_SNAPSHOT_CHUNK_EVENTS UINT32_C(7)
#define CADR_SNAPSHOT_CHUNK_TRACE UINT32_C(8)
#define CADR_SNAPSHOT_CHUNK_DISK UINT32_C(9)
#define CADR_SNAPSHOT_DISK_CHUNK_BYTES UINT64_C(96)
#define CADR_SNAPSHOT_DISK_STATUS_KNOWN \
    (CADR_DISK_STATUS_READ_COMPARE | CADR_DISK_STATUS_CCW_CYCLE | \
     CADR_DISK_STATUS_NXM | CADR_DISK_STATUS_SEEK_ERROR | \
     CADR_DISK_STATUS_OFFLINE | CADR_DISK_STATUS_READ_ONLY | \
     CADR_DISK_STATUS_FAULT | CADR_DISK_STATUS_INTERRUPT | \
     CADR_DISK_STATUS_ATTENTION | CADR_DISK_STATUS_ANY_ATTENTION | \
     CADR_DISK_STATUS_NOT_ACTIVE)

#define CADR_SNAPSHOT_ARTIFACT_BOOT UINT32_C(1)
#define CADR_SNAPSHOT_ARTIFACT_CONTROL UINT32_C(2)
#define CADR_SNAPSHOT_ARTIFACT_DISK UINT32_C(4)
#define CADR_SNAPSHOT_ARTIFACT_PROM_SYMBOLS UINT32_C(8)
#define CADR_SNAPSHOT_ARTIFACT_MICROCODE_SYMBOLS UINT32_C(16)
#define CADR_SNAPSHOT_ARTIFACT_MASK (CADR_SNAPSHOT_ARTIFACT_BOOT | \
                                     CADR_SNAPSHOT_ARTIFACT_CONTROL | \
                                     CADR_SNAPSHOT_ARTIFACT_DISK | \
                                     CADR_SNAPSHOT_ARTIFACT_PROM_SYMBOLS | \
                                     CADR_SNAPSHOT_ARTIFACT_MICROCODE_SYMBOLS)

static const uint8_t cadr_snapshot_magic[8] = {
    UINT8_C('C'), UINT8_C('D'), UINT8_C('R'), UINT8_C('S'),
    UINT8_C('N'), UINT8_C('A'), UINT8_C('P'), UINT8_C('1')
};

/* SHA-256 of cadr-web/profiles/cadr-web-303.json at the selected profile. */
static const uint8_t cadr_snapshot_profile_sha256[CADR_SHA256_BYTES] = {
    UINT8_C(0x1b), UINT8_C(0x8d), UINT8_C(0x63), UINT8_C(0xdb),
    UINT8_C(0x98), UINT8_C(0xac), UINT8_C(0xd4), UINT8_C(0x6e),
    UINT8_C(0x40), UINT8_C(0xad), UINT8_C(0xf9), UINT8_C(0x9a),
    UINT8_C(0x8a), UINT8_C(0x3c), UINT8_C(0xeb), UINT8_C(0x5e),
    UINT8_C(0x05), UINT8_C(0x58), UINT8_C(0xd4), UINT8_C(0xac),
    UINT8_C(0x02), UINT8_C(0x7c), UINT8_C(0xb2), UINT8_C(0xcb),
    UINT8_C(0x4a), UINT8_C(0x43), UINT8_C(0x96), UINT8_C(0x65),
    UINT8_C(0xb1), UINT8_C(0x4b), UINT8_C(0x5d), UINT8_C(0x2a)
};

/* SHA-256(CDRARTSET1\\0 + five canonical profile-artifact records). */
static const uint8_t cadr_snapshot_artifact_set_sha256[CADR_SHA256_BYTES] = {
    UINT8_C(0xe9), UINT8_C(0x6e), UINT8_C(0x6f), UINT8_C(0xf9),
    UINT8_C(0x03), UINT8_C(0xc2), UINT8_C(0x3c), UINT8_C(0xce),
    UINT8_C(0xa7), UINT8_C(0x07), UINT8_C(0xec), UINT8_C(0xe0),
    UINT8_C(0xe9), UINT8_C(0xa8), UINT8_C(0x72), UINT8_C(0xa8),
    UINT8_C(0xa7), UINT8_C(0x77), UINT8_C(0x71), UINT8_C(0xa6),
    UINT8_C(0x66), UINT8_C(0x3e), UINT8_C(0x3b), UINT8_C(0x91),
    UINT8_C(0x9e), UINT8_C(0xab), UINT8_C(0xa2), UINT8_C(0x1e),
    UINT8_C(0x22), UINT8_C(0xf2), UINT8_C(0xf9), UINT8_C(0x41)
};

typedef struct cadr_snapshot_sha256_context {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t block_used;
} cadr_snapshot_sha256_context;

typedef struct cadr_snapshot_sink {
    uint8_t *bytes;
    uint64_t capacity;
    uint64_t offset;
    cadr_snapshot_sha256_context *hash;
    int failed;
} cadr_snapshot_sink;

typedef struct cadr_snapshot_reader {
    const uint8_t *bytes;
    uint64_t length;
    uint64_t offset;
    int failed;
} cadr_snapshot_reader;

typedef struct cadr_snapshot_directory_entry {
    uint32_t type;
    uint32_t flags;
    uint64_t offset;
    uint64_t length;
    uint8_t sha256[CADR_SHA256_BYTES];
} cadr_snapshot_directory_entry;

typedef struct cadr_snapshot_layout {
    uint16_t format_minor;
    uint32_t chunk_count;
    uint64_t chunk_lengths[CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT];
    uint64_t directory_bytes;
    uint64_t payload_offset;
    uint64_t total_bytes;
} cadr_snapshot_layout;

static uint32_t cadr_snapshot_rotr32(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void cadr_snapshot_sha256_transform(cadr_snapshot_sha256_context *context,
                                           const uint8_t block[64])
{
    static const uint32_t constants[64] = {
        UINT32_C(0x428a2f98), UINT32_C(0x71374491), UINT32_C(0xb5c0fbcf), UINT32_C(0xe9b5dba5),
        UINT32_C(0x3956c25b), UINT32_C(0x59f111f1), UINT32_C(0x923f82a4), UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98), UINT32_C(0x12835b01), UINT32_C(0x243185be), UINT32_C(0x550c7dc3),
        UINT32_C(0x72be5d74), UINT32_C(0x80deb1fe), UINT32_C(0x9bdc06a7), UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1), UINT32_C(0xefbe4786), UINT32_C(0x0fc19dc6), UINT32_C(0x240ca1cc),
        UINT32_C(0x2de92c6f), UINT32_C(0x4a7484aa), UINT32_C(0x5cb0a9dc), UINT32_C(0x76f988da),
        UINT32_C(0x983e5152), UINT32_C(0xa831c66d), UINT32_C(0xb00327c8), UINT32_C(0xbf597fc7),
        UINT32_C(0xc6e00bf3), UINT32_C(0xd5a79147), UINT32_C(0x06ca6351), UINT32_C(0x14292967),
        UINT32_C(0x27b70a85), UINT32_C(0x2e1b2138), UINT32_C(0x4d2c6dfc), UINT32_C(0x53380d13),
        UINT32_C(0x650a7354), UINT32_C(0x766a0abb), UINT32_C(0x81c2c92e), UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1), UINT32_C(0xa81a664b), UINT32_C(0xc24b8b70), UINT32_C(0xc76c51a3),
        UINT32_C(0xd192e819), UINT32_C(0xd6990624), UINT32_C(0xf40e3585), UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116), UINT32_C(0x1e376c08), UINT32_C(0x2748774c), UINT32_C(0x34b0bcb5),
        UINT32_C(0x391c0cb3), UINT32_C(0x4ed8aa4a), UINT32_C(0x5b9cca4f), UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee), UINT32_C(0x78a5636f), UINT32_C(0x84c87814), UINT32_C(0x8cc70208),
        UINT32_C(0x90befffa), UINT32_C(0xa4506ceb), UINT32_C(0xbef9a3f7), UINT32_C(0xc67178f2)
    };
    uint32_t schedule[64];
    uint32_t a;
    uint32_t b;
    uint32_t c;
    uint32_t d;
    uint32_t e;
    uint32_t f;
    uint32_t g;
    uint32_t h;
    uint32_t index;

    for (index = 0U; index < 16U; ++index) {
        const uint32_t at = index * UINT32_C(4);
        schedule[index] = ((uint32_t)block[at] << 24U) |
                          ((uint32_t)block[at + 1U] << 16U) |
                          ((uint32_t)block[at + 2U] << 8U) |
                          (uint32_t)block[at + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = cadr_snapshot_rotr32(schedule[index - 15U], 7U) ^
                            cadr_snapshot_rotr32(schedule[index - 15U], 18U) ^
                            (schedule[index - 15U] >> 3U);
        const uint32_t s1 = cadr_snapshot_rotr32(schedule[index - 2U], 17U) ^
                            cadr_snapshot_rotr32(schedule[index - 2U], 19U) ^
                            (schedule[index - 2U] >> 10U);
        schedule[index] = schedule[index - 16U] + s0 + schedule[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t sum1 = cadr_snapshot_rotr32(e, 6U) ^ cadr_snapshot_rotr32(e, 11U) ^
                              cadr_snapshot_rotr32(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temporary1 = h + sum1 + choose + constants[index] + schedule[index];
        const uint32_t sum0 = cadr_snapshot_rotr32(a, 2U) ^ cadr_snapshot_rotr32(a, 13U) ^
                              cadr_snapshot_rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary2 = sum0 + majority;
        h = g; g = f; f = e; e = d + temporary1;
        d = c; c = b; b = a; a = temporary1 + temporary2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void cadr_snapshot_sha256_init(cadr_snapshot_sha256_context *context)
{
    context->state[0] = UINT32_C(0x6a09e667); context->state[1] = UINT32_C(0xbb67ae85);
    context->state[2] = UINT32_C(0x3c6ef372); context->state[3] = UINT32_C(0xa54ff53a);
    context->state[4] = UINT32_C(0x510e527f); context->state[5] = UINT32_C(0x9b05688c);
    context->state[6] = UINT32_C(0x1f83d9ab); context->state[7] = UINT32_C(0x5be0cd19);
    context->bit_count = 0U;
    context->block_used = 0U;
}

static void cadr_snapshot_sha256_update(cadr_snapshot_sha256_context *context,
                                        const uint8_t *bytes, uint64_t byte_count)
{
    while (byte_count != 0U) {
        const uint32_t available = UINT32_C(64) - context->block_used;
        const uint32_t take = byte_count < (uint64_t)available
            ? (uint32_t)byte_count : available;
        (void)memcpy(&context->block[context->block_used], bytes, take);
        context->block_used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        byte_count -= take;
        if (context->block_used == 64U) {
            cadr_snapshot_sha256_transform(context, context->block);
            context->block_used = 0U;
        }
    }
}

static void cadr_snapshot_sha256_final(cadr_snapshot_sha256_context *context,
                                       uint8_t digest[CADR_SHA256_BYTES])
{
    uint32_t index;
    const uint64_t bit_count = context->bit_count;
    context->block[context->block_used++] = UINT8_C(0x80);
    if (context->block_used > 56U) {
        (void)memset(&context->block[context->block_used], 0,
                     (size_t)(64U - context->block_used));
        cadr_snapshot_sha256_transform(context, context->block);
        context->block_used = 0U;
    }
    (void)memset(&context->block[context->block_used], 0,
                 (size_t)(56U - context->block_used));
    for (index = 0U; index < 8U; ++index) {
        context->block[63U - index] = (uint8_t)(bit_count >> (index * 8U));
    }
    cadr_snapshot_sha256_transform(context, context->block);
    for (index = 0U; index < 8U; ++index) {
        digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        digest[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

static void cadr_snapshot_sha256(const uint8_t *bytes, uint64_t byte_count,
                                 uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_snapshot_sha256_context context;
    cadr_snapshot_sha256_init(&context);
    cadr_snapshot_sha256_update(&context, bytes, byte_count);
    cadr_snapshot_sha256_final(&context, digest);
}

static int cadr_snapshot_u64_add(uint64_t left, uint64_t right, uint64_t *out)
{
    if (left > UINT64_MAX - right) return 0;
    *out = left + right;
    return 1;
}

static int cadr_snapshot_u64_multiply(uint64_t left, uint64_t right, uint64_t *out)
{
    if (left != 0U && right > UINT64_MAX / left) return 0;
    *out = left * right;
    return 1;
}

static void cadr_snapshot_sink_bytes(cadr_snapshot_sink *sink,
                                     const uint8_t *bytes, uint64_t byte_count)
{
    if (sink->failed != 0) return;
    if ((byte_count != 0U && bytes == NULL) ||
        byte_count > sink->capacity - sink->offset) {
        sink->failed = 1;
        return;
    }
    if (sink->bytes != NULL && byte_count != 0U) {
        (void)memcpy(sink->bytes + (size_t)sink->offset, bytes, (size_t)byte_count);
    }
    if (sink->hash != NULL && byte_count != 0U) {
        cadr_snapshot_sha256_update(sink->hash, bytes, byte_count);
    }
    sink->offset += byte_count;
}

static void cadr_snapshot_sink_u8(cadr_snapshot_sink *sink, uint8_t value)
{
    cadr_snapshot_sink_bytes(sink, &value, UINT64_C(1));
}

static void cadr_snapshot_sink_u16(cadr_snapshot_sink *sink, uint16_t value)
{
    uint8_t bytes[2];
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    cadr_snapshot_sink_bytes(sink, bytes, sizeof(bytes));
}

static void cadr_snapshot_sink_u32(cadr_snapshot_sink *sink, uint32_t value)
{
    uint8_t bytes[4];
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
    cadr_snapshot_sink_bytes(sink, bytes, sizeof(bytes));
}

static void cadr_snapshot_sink_u64(cadr_snapshot_sink *sink, uint64_t value)
{
    uint8_t bytes[8];
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
    cadr_snapshot_sink_bytes(sink, bytes, sizeof(bytes));
}

static void cadr_snapshot_reader_bytes(cadr_snapshot_reader *reader,
                                       uint8_t *out, uint64_t byte_count)
{
    if (reader->failed != 0) return;
    if ((byte_count != 0U && out == NULL) ||
        byte_count > reader->length - reader->offset) {
        reader->failed = 1;
        return;
    }
    if (byte_count != 0U) {
        (void)memcpy(out, reader->bytes + (size_t)reader->offset, (size_t)byte_count);
    }
    reader->offset += byte_count;
}

static uint8_t cadr_snapshot_reader_u8(cadr_snapshot_reader *reader)
{
    uint8_t value = 0U;
    cadr_snapshot_reader_bytes(reader, &value, UINT64_C(1));
    return value;
}

static uint16_t cadr_snapshot_reader_u16(cadr_snapshot_reader *reader)
{
    uint8_t bytes[2] = {0U, 0U};
    cadr_snapshot_reader_bytes(reader, bytes, sizeof(bytes));
    return (uint16_t)((uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8U));
}

static uint32_t cadr_snapshot_reader_u32(cadr_snapshot_reader *reader)
{
    uint8_t bytes[4] = {0U, 0U, 0U, 0U};
    cadr_snapshot_reader_bytes(reader, bytes, sizeof(bytes));
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
           ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t cadr_snapshot_reader_u64(cadr_snapshot_reader *reader)
{
    uint8_t bytes[8] = {0U, 0U, 0U, 0U, 0U, 0U, 0U, 0U};
    uint64_t value = 0U;
    uint32_t index;
    cadr_snapshot_reader_bytes(reader, bytes, sizeof(bytes));
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

static int cadr_snapshot_is_boolean(uint32_t value)
{
    return value <= 1U;
}

static int cadr_snapshot_lifecycle_valid(uint32_t lifecycle)
{
    return lifecycle <= CADR_MACHINE_GUEST_FAULTED;
}

static int cadr_snapshot_persistent_status_valid(uint32_t status)
{
    return status == CADR_STATUS_OK ||
           status == CADR_STATUS_HOST_FAILURE ||
           status == CADR_STATUS_GUEST_FAULT ||
           status == CADR_STATUS_UNIMPLEMENTED_DEVICE ||
           status == CADR_STATUS_HALTED;
}

static int cadr_snapshot_operation_valid(uint32_t operation)
{
    return operation >= CADR_HOST_OPERATION_BLOCK_READ &&
           operation <= CADR_HOST_OPERATION_NETWORK;
}

static uint64_t cadr_snapshot_descriptor_size(uint32_t operation)
{
    switch (operation) {
    case CADR_HOST_OPERATION_BLOCK_READ:
        return UINT64_C(16);
    case CADR_HOST_OPERATION_BLOCK_WRITE:
        return UINT64_C(24);
    case CADR_HOST_OPERATION_PRESENT:
        return UINT64_C(24);
    case CADR_HOST_OPERATION_AUDIO:
        return UINT64_C(24);
    case CADR_HOST_OPERATION_NETWORK:
        return UINT64_C(16);
    default:
        return 0U;
    }
}

static void cadr_snapshot_encode_descriptor(const cadr_event_state *events,
                                            cadr_snapshot_sink *sink)
{
    switch (events->outstanding_operation) {
    case CADR_HOST_OPERATION_BLOCK_READ: {
        cadr_block_read_descriptor value;
        (void)memcpy(&value, events->request_descriptor, sizeof(value));
        cadr_snapshot_sink_u64(sink, value.first_block);
        cadr_snapshot_sink_u32(sink, value.block_count);
        cadr_snapshot_sink_u32(sink, value.block_bytes);
        break;
    }
    case CADR_HOST_OPERATION_BLOCK_WRITE: {
        cadr_block_write_descriptor value;
        (void)memcpy(&value, events->request_descriptor, sizeof(value));
        cadr_snapshot_sink_u64(sink, value.transaction_id);
        cadr_snapshot_sink_u64(sink, value.first_block);
        cadr_snapshot_sink_u32(sink, value.block_count);
        cadr_snapshot_sink_u32(sink, value.block_bytes);
        break;
    }
    case CADR_HOST_OPERATION_PRESENT: {
        cadr_present_descriptor value;
        (void)memcpy(&value, events->request_descriptor, sizeof(value));
        cadr_snapshot_sink_u64(sink, value.framebuffer_generation);
        cadr_snapshot_sink_u32(sink, value.x);
        cadr_snapshot_sink_u32(sink, value.y);
        cadr_snapshot_sink_u32(sink, value.width);
        cadr_snapshot_sink_u32(sink, value.height);
        break;
    }
    case CADR_HOST_OPERATION_AUDIO: {
        cadr_audio_descriptor value;
        (void)memcpy(&value, events->request_descriptor, sizeof(value));
        cadr_snapshot_sink_u64(sink, value.audio_generation);
        cadr_snapshot_sink_u64(sink, value.guest_timestamp);
        cadr_snapshot_sink_u32(sink, value.encoding);
        cadr_snapshot_sink_u32(sink, value.frame_count);
        break;
    }
    case CADR_HOST_OPERATION_NETWORK: {
        cadr_network_descriptor value;
        (void)memcpy(&value, events->request_descriptor, sizeof(value));
        cadr_snapshot_sink_u64(sink, value.frame_sequence);
        cadr_snapshot_sink_u64(sink, value.frame_byte_count);
        break;
    }
    default:
        break;
    }
}

static void cadr_snapshot_decode_descriptor(cadr_snapshot_reader *reader,
                                            cadr_event_state *events)
{
    switch (events->outstanding_operation) {
    case CADR_HOST_OPERATION_BLOCK_READ: {
        cadr_block_read_descriptor value;
        (void)memset(&value, 0, sizeof(value));
        value.first_block = cadr_snapshot_reader_u64(reader);
        value.block_count = cadr_snapshot_reader_u32(reader);
        value.block_bytes = cadr_snapshot_reader_u32(reader);
        (void)memcpy(events->request_descriptor, &value, sizeof(value));
        break;
    }
    case CADR_HOST_OPERATION_BLOCK_WRITE: {
        cadr_block_write_descriptor value;
        (void)memset(&value, 0, sizeof(value));
        value.transaction_id = cadr_snapshot_reader_u64(reader);
        value.first_block = cadr_snapshot_reader_u64(reader);
        value.block_count = cadr_snapshot_reader_u32(reader);
        value.block_bytes = cadr_snapshot_reader_u32(reader);
        (void)memcpy(events->request_descriptor, &value, sizeof(value));
        break;
    }
    case CADR_HOST_OPERATION_PRESENT: {
        cadr_present_descriptor value;
        (void)memset(&value, 0, sizeof(value));
        value.framebuffer_generation = cadr_snapshot_reader_u64(reader);
        value.x = cadr_snapshot_reader_u32(reader);
        value.y = cadr_snapshot_reader_u32(reader);
        value.width = cadr_snapshot_reader_u32(reader);
        value.height = cadr_snapshot_reader_u32(reader);
        (void)memcpy(events->request_descriptor, &value, sizeof(value));
        break;
    }
    case CADR_HOST_OPERATION_AUDIO: {
        cadr_audio_descriptor value;
        (void)memset(&value, 0, sizeof(value));
        value.audio_generation = cadr_snapshot_reader_u64(reader);
        value.guest_timestamp = cadr_snapshot_reader_u64(reader);
        value.encoding = cadr_snapshot_reader_u32(reader);
        value.frame_count = cadr_snapshot_reader_u32(reader);
        (void)memcpy(events->request_descriptor, &value, sizeof(value));
        break;
    }
    case CADR_HOST_OPERATION_NETWORK: {
        cadr_network_descriptor value;
        (void)memset(&value, 0, sizeof(value));
        value.frame_sequence = cadr_snapshot_reader_u64(reader);
        value.frame_byte_count = cadr_snapshot_reader_u64(reader);
        (void)memcpy(events->request_descriptor, &value, sizeof(value));
        break;
    }
    default:
        break;
    }
}

static uint32_t cadr_snapshot_artifact_mask(const cadr_machine_state *state)
{
    uint32_t result = 0U;
    if (state->artifacts.boot_configuration_ingressed != 0U) {
        result |= CADR_SNAPSHOT_ARTIFACT_BOOT;
    }
    if (state->artifacts.control_store_ingressed != 0U) {
        result |= CADR_SNAPSHOT_ARTIFACT_CONTROL;
    }
    if (state->artifacts.base_disk_verified != 0U) {
        result |= CADR_SNAPSHOT_ARTIFACT_DISK;
    }
    if (state->artifacts.prom_symbols_verified != 0U) {
        result |= CADR_SNAPSHOT_ARTIFACT_PROM_SYMBOLS;
    }
    if (state->artifacts.microcode_symbols_verified != 0U) {
        result |= CADR_SNAPSHOT_ARTIFACT_MICROCODE_SYMBOLS;
    }
    return result;
}

static void cadr_snapshot_mutation_hash(const cadr_canonical_state *canonical,
                                        uint8_t digest[CADR_SHA256_BYTES])
{
    static const uint8_t domain[] = {
        UINT8_C('C'), UINT8_C('D'), UINT8_C('R'), UINT8_C('M'),
        UINT8_C('U'), UINT8_C('T'), UINT8_C('1'), UINT8_C(0)
    };
    cadr_snapshot_sha256_context context;
    uint32_t index;
    cadr_snapshot_sha256_init(&context);
    cadr_snapshot_sha256_update(&context, domain, sizeof(domain));
    for (index = 0U; index < canonical->mutation_count; ++index) {
        cadr_snapshot_sha256_update(&context, canonical->mutation_events[index],
                                    sizeof(canonical->mutation_events[index]));
    }
    cadr_snapshot_sha256_final(&context, digest);
}

static int cadr_snapshot_zero_bytes(const uint8_t *bytes, size_t byte_count)
{
    size_t index;
    for (index = 0U; index < byte_count; ++index) {
        if (bytes[index] != 0U) return 0;
    }
    return 1;
}

static int cadr_snapshot_validate_cpu(const cadr_cpu_state *cpu)
{
    if ((cpu->p0 & ~CADR_SNAPSHOT_U48_MASK) != 0U ||
        (cpu->p1 & ~CADR_SNAPSHOT_U48_MASK) != 0U ||
        (cpu->debug_ir & ~CADR_SNAPSHOT_U48_MASK) != 0U ||
        (cpu->instruction_write_register & ~CADR_SNAPSHOT_U48_MASK) != 0U ||
        !cadr_snapshot_is_boolean(cpu->guest_fault) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->p0_imem) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->p1_imem) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->inhibit) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->oa_low_pending) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->oa_high_pending) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->halted) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->prom_disabled) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->vma_ok) ||
        !cadr_snapshot_is_boolean((uint32_t)cpu->main_memory_nxm) ||
        cpu->pending_md_delay > 2U) {
        return 0;
    }
    return 1;
}

static int cadr_snapshot_validate_memory(const cadr_memory_state *memory)
{
    const uint64_t expected_words = (uint64_t)memory->main_memory_pages *
        (uint64_t)CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    uint32_t index;
    if (!cadr_snapshot_is_boolean(memory->initialized) ||
        memory->main_memory_pages > CADR_MAIN_MEMORY_MAX_PAGES ||
        memory->mapped_words != expected_words) return 0;
    for (index = 0U; index < 512U; ++index) {
        if ((memory->prom[index] & ~CADR_SNAPSHOT_U48_MASK) != 0U) return 0;
    }
    for (index = 0U; index < 16U * 1024U; ++index) {
        if ((memory->imem[index] & ~CADR_SNAPSHOT_U48_MASK) != 0U) return 0;
    }
    return 1;
}

static int cadr_snapshot_validate_bus(const cadr_bus_state *bus)
{
    const cadr_diagnostic_latches *diagnostic = &bus->diagnostic;
    return (diagnostic->instruction & ~CADR_SNAPSHOT_U48_MASK) == 0U &&
           (diagnostic->debug_instruction & ~CADR_SNAPSHOT_U48_MASK) == 0U &&
           cadr_snapshot_is_boolean(bus->interrupt_pending) &&
           cadr_snapshot_is_boolean((uint32_t)bus->nxm_inhibited) &&
           cadr_snapshot_zero_bytes(bus->reserved0, sizeof(bus->reserved0)) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->machine_error) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->single_step_done) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->running) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->write_map) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->destination_spc) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->instruction_write) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->instruction_modify) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->pdl_write) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->spc_push) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->instruction_parity) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->nop) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->vma_ok) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->jump_condition) &&
           cadr_snapshot_is_boolean((uint32_t)diagnostic->next_pc_source) &&
           diagnostic->reserved0 == 0U;
}

static int cadr_snapshot_validate_devices(const cadr_device_state *devices)
{
    return cadr_snapshot_is_boolean(devices->initialized) &&
           devices->tv_sync_ptr < sizeof(devices->tv_sync_ram);
}

/* CDRSNAP1 1.0 predates D0.  It may represent only this implied quiescent
 * controller state; active or configured disk work requires the M3 extension. */
static int cadr_snapshot_disk_is_default(const cadr_disk_state *disk)
{
    return disk->pending_first_block == 0U &&
        disk->compatibility_profile == CADR_DISK_COMPAT_SYSTEM_303 &&
        disk->command == 0U && disk->command_list_pointer == 0U &&
        disk->disk_address == 0U && disk->last_memory_address == 0U &&
        disk->pending_ccw_address == 0U && disk->pending_memory_address == 0U &&
        disk->pending_ccw == 0U && disk->status == CADR_DISK_STATUS_NOT_ACTIVE &&
        disk->transfer_active == 0U && disk->reset_condition == 0U &&
        disk->done_interrupt_enable == 0U && disk->attention_interrupt_enable == 0U &&
        disk->reserved0 == 0U;
}

static void cadr_snapshot_initialize_default_disk(cadr_device_state *devices)
{
    (void)memset(&devices->disk, 0, sizeof(devices->disk));
    devices->disk.compatibility_profile = CADR_DISK_COMPAT_SYSTEM_303;
    devices->disk.status = CADR_DISK_STATUS_NOT_ACTIVE;
}

/* The disk chunk has no padding: all reserved and boolean encodings are
 * explicit, and address/continuation values are constrained to the state
 * machine's representable domain before the CDRSTATE3 witness is accepted. */
static int cadr_snapshot_validate_disk(const cadr_disk_state *disk)
{
    const uint64_t total_blocks = (uint64_t)CADR_DISK_T300_CYLINDERS *
        CADR_DISK_T300_HEADS * CADR_DISK_T300_BLOCKS_PER_TRACK;
    if (disk->compatibility_profile != CADR_DISK_COMPAT_SYSTEM_303 &&
        disk->compatibility_profile != CADR_DISK_COMPAT_USIM_330D) return 0;
    if ((disk->status & ~CADR_SNAPSHOT_DISK_STATUS_KNOWN) != 0U ||
        !cadr_snapshot_is_boolean(disk->transfer_active) ||
        !cadr_snapshot_is_boolean(disk->reset_condition) ||
        !cadr_snapshot_is_boolean(disk->done_interrupt_enable) ||
        !cadr_snapshot_is_boolean(disk->attention_interrupt_enable) ||
        disk->reserved0 != 0U || disk->pending_ccw > UINT32_C(0xffff) ||
        disk->pending_memory_address > UINT32_C(0x00ffff00) ||
        (disk->pending_memory_address & UINT32_C(0xff)) != 0U) return 0;
    if (disk->transfer_active != 0U &&
        (disk->pending_first_block >= total_blocks ||
         (disk->status & CADR_DISK_STATUS_NOT_ACTIVE) != 0U)) return 0;
    return 1;
}

static int cadr_snapshot_validate_disk_continuation(const cadr_machine_state *state)
{
    const cadr_disk_state *disk = &state->devices.disk;
    const cadr_event_state *events = &state->events;
    cadr_block_read_descriptor descriptor;
    if (disk->transfer_active == 0U) {
        return 1;
    }
    if (disk->reset_condition != 0U ||
        (disk->status & CADR_DISK_STATUS_NOT_ACTIVE) != 0U ||
        events->outstanding_request_id == 0U ||
        events->outstanding_operation != CADR_HOST_OPERATION_BLOCK_READ ||
        events->request_descriptor_byte_count != sizeof(descriptor) ||
        events->expected_completion_byte_count != CADR_DISK_BLOCK_BYTES) {
        return 0;
    }
    (void)memcpy(&descriptor, events->request_descriptor, sizeof(descriptor));
    return descriptor.first_block == disk->pending_first_block &&
           descriptor.block_count == 1U &&
           descriptor.block_bytes == CADR_DISK_BLOCK_BYTES;
}

static int cadr_snapshot_validate_canonical(const cadr_canonical_state *canonical)
{
    uint8_t expected[CADR_SHA256_BYTES];
    if (!cadr_snapshot_is_boolean(canonical->initialized) ||
        !cadr_snapshot_is_boolean(canonical->overflowed) ||
        canonical->mutation_count > CADR_CANONICAL_MAX_SLOT_MUTATIONS ||
        canonical->first_mutation_ordinal > UINT64_MAX -
            (uint64_t)canonical->mutation_count ||
        canonical->first_mutation_ordinal +
            (uint64_t)canonical->mutation_count != canonical->mutation_ordinal) {
        return 0;
    }
    if (canonical->initialized == 0U) {
        return canonical->mutation_ordinal == 0U &&
               canonical->first_mutation_ordinal == 0U &&
               canonical->mutation_count == 0U &&
               canonical->overflowed == 0U &&
               cadr_snapshot_zero_bytes(canonical->mutation_sha256,
                                        sizeof(canonical->mutation_sha256));
    }
    cadr_snapshot_mutation_hash(canonical, expected);
    return memcmp(expected, canonical->mutation_sha256, sizeof(expected)) == 0;
}

static int cadr_snapshot_validate_events(const cadr_event_state *events)
{
    const uint64_t descriptor_size =
        cadr_snapshot_descriptor_size(events->outstanding_operation);
    if (events->generation == 0U || events->next_request_id == 0U ||
        events->last_completed_request_id >= events->next_request_id ||
        !cadr_snapshot_is_boolean(events->completion_queued) ||
        !cadr_snapshot_is_boolean(events->unexpected_bus_operation) ||
        events->reserved0 != 0U ||
        !cadr_snapshot_persistent_status_valid(events->persistent_status) ||
        events->request_descriptor_byte_count > CADR_MAX_HOST_DESCRIPTOR_BYTES ||
        events->request_payload_byte_count != 0U ||
        events->expected_completion_byte_count > CADR_SNAPSHOT_MAX_COMPLETION_BYTES ||
        events->completion_byte_count > CADR_SNAPSHOT_MAX_COMPLETION_BYTES) {
        return 0;
    }
    if (events->outstanding_request_id == 0U) {
        return events->outstanding_operation == CADR_HOST_OPERATION_NONE &&
               events->request_descriptor_byte_count == 0U &&
               events->expected_completion_byte_count == 0U &&
               events->completion_queued == 0U &&
               events->completion_byte_count == 0U &&
               events->completion_bytes == NULL &&
               events->completion_host_status == CADR_HOST_RESULT_OK &&
               (events->persistent_status == CADR_STATUS_OK ||
                events->completion_queued == 0U);
    }
    if (!cadr_snapshot_operation_valid(events->outstanding_operation) ||
        events->outstanding_request_id >= events->next_request_id ||
        events->last_completed_request_id >= events->outstanding_request_id ||
        events->request_descriptor_byte_count != descriptor_size ||
        events->persistent_status != CADR_STATUS_OK) {
        return 0;
    }
    if (events->completion_queued == 0U) {
        return events->completion_byte_count == 0U &&
               events->completion_bytes == NULL &&
               events->completion_host_status == CADR_HOST_RESULT_OK;
    }
    return events->completion_byte_count == events->expected_completion_byte_count &&
           (events->completion_byte_count == 0U || events->completion_bytes != NULL) &&
           (events->completion_byte_count != 0U || events->completion_bytes == NULL) &&
           (events->completion_host_status == CADR_HOST_RESULT_OK ||
            events->completion_host_status == CADR_HOST_RESULT_FAILED);
}

static cadr_status cadr_snapshot_validate_state(const cadr_machine_state *state,
                                                uint16_t format_minor)
{
    uint32_t index;
    if (state == NULL || state->profile != CADR_PROFILE_CADR_WEB_303 ||
        !cadr_snapshot_lifecycle_valid(state->lifecycle) ||
        state->in_host_completion != 0U || state->reserved0 != 0U ||
        !cadr_snapshot_validate_cpu(&state->cpu) ||
        !cadr_snapshot_validate_memory(&state->memory) ||
        !cadr_snapshot_validate_bus(&state->bus) ||
        !cadr_snapshot_validate_devices(&state->devices) ||
        (format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M2
             ? !cadr_snapshot_disk_is_default(&state->devices.disk)
             : !cadr_snapshot_validate_disk(&state->devices.disk)) ||
        (format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3 &&
             !cadr_snapshot_validate_disk_continuation(state)) ||
        !cadr_snapshot_validate_canonical(&state->canonical) ||
        !cadr_snapshot_validate_events(&state->events) ||
        cadr_trace_latches_validate(state) != CADR_STATUS_OK ||
        !cadr_snapshot_is_boolean(state->artifacts.boot_configuration_ingressed) ||
        !cadr_snapshot_is_boolean(state->artifacts.control_store_ingressed) ||
        !cadr_snapshot_is_boolean(state->artifacts.base_disk_verified) ||
        !cadr_snapshot_is_boolean(state->artifacts.prom_symbols_verified) ||
        !cadr_snapshot_is_boolean(state->artifacts.microcode_symbols_verified)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    for (index = 0U; index < 3U; ++index) {
        if (state->artifacts.reserved0[index] != 0U) return CADR_STATUS_INVALID_ARGUMENT;
    }
    if ((state->lifecycle == CADR_MACHINE_RUNNING ||
         state->lifecycle == CADR_MACHINE_GUEST_FAULTED) &&
        state->canonical.initialized == 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if ((state->lifecycle == CADR_MACHINE_COLD ||
         state->lifecycle == CADR_MACHINE_POWERED) &&
        state->events.persistent_status != CADR_STATUS_OK) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->lifecycle == CADR_MACHINE_GUEST_FAULTED) {
        if (state->events.persistent_status != CADR_STATUS_GUEST_FAULT) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    } else if (state->events.persistent_status == CADR_STATUS_GUEST_FAULT) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->events.persistent_status == CADR_STATUS_HALTED &&
        state->cpu.halted == 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->events.persistent_status != CADR_STATUS_OK &&
        (state->events.outstanding_request_id != 0U ||
         state->events.completion_queued != 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return CADR_STATUS_OK;
}

static void cadr_snapshot_encode_core(const cadr_machine_state *state,
                                      cadr_snapshot_sink *sink)
{
    uint32_t index;
    cadr_snapshot_sink_u32(sink, state->profile);
    cadr_snapshot_sink_u32(sink, state->lifecycle);
    cadr_snapshot_sink_u32(sink, state->in_host_completion);
    cadr_snapshot_sink_u32(sink, state->reserved0);
    cadr_snapshot_sink_u64(sink, state->clock_slots_completed);
    cadr_snapshot_sink_u32(sink, state->artifacts.boot_configuration_ingressed);
    cadr_snapshot_sink_u32(sink, state->artifacts.control_store_ingressed);
    cadr_snapshot_sink_u32(sink, state->artifacts.base_disk_verified);
    cadr_snapshot_sink_u32(sink, state->artifacts.prom_symbols_verified);
    cadr_snapshot_sink_u32(sink, state->artifacts.microcode_symbols_verified);
    for (index = 0U; index < 3U; ++index) {
        cadr_snapshot_sink_u32(sink, state->artifacts.reserved0[index]);
    }
}

static void cadr_snapshot_encode_cpu(const cadr_machine_state *state,
                                     cadr_snapshot_sink *sink)
{
    const cadr_cpu_state *cpu = &state->cpu;
    uint32_t index;
    cadr_snapshot_sink_u64(sink, cpu->microinstructions_executed);
    cadr_snapshot_sink_u32(sink, cpu->guest_fault);
    cadr_snapshot_sink_u64(sink, cpu->p0 & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u64(sink, cpu->p1 & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u64(sink, cpu->debug_ir & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u64(sink, cpu->instruction_write_register & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u32(sink, cpu->p0_pc);
    cadr_snapshot_sink_u32(sink, cpu->p1_pc);
    cadr_snapshot_sink_u32(sink, cpu->next_micro_pc);
    for (index = 0U; index < 1024U; ++index) cadr_snapshot_sink_u32(sink, cpu->a_memory[index]);
    for (index = 0U; index < 32U; ++index) cadr_snapshot_sink_u32(sink, cpu->m_memory[index]);
    for (index = 0U; index < 2048U; ++index) cadr_snapshot_sink_u32(sink, cpu->dispatch_memory[index]);
    for (index = 0U; index < 1024U; ++index) cadr_snapshot_sink_u32(sink, cpu->pdl[index]);
    for (index = 0U; index < 32U; ++index) cadr_snapshot_sink_u32(sink, cpu->micro_stack[index]);
    cadr_snapshot_sink_u32(sink, cpu->micro_stack_pointer);
    cadr_snapshot_sink_u32(sink, cpu->dispatch_constant);
    cadr_snapshot_sink_u32(sink, cpu->pdl_pointer);
    cadr_snapshot_sink_u32(sink, cpu->pdl_index);
    cadr_snapshot_sink_u32(sink, cpu->vma);
    cadr_snapshot_sink_u32(sink, cpu->md);
    cadr_snapshot_sink_u32(sink, cpu->location_counter);
    cadr_snapshot_sink_u32(sink, cpu->oa_low);
    cadr_snapshot_sink_u32(sink, cpu->oa_high);
    cadr_snapshot_sink_u32(sink, cpu->opc);
    cadr_snapshot_sink_u32(sink, cpu->q);
    cadr_snapshot_sink_u32(sink, cpu->old_q);
    cadr_snapshot_sink_u32(sink, cpu->interrupt_control);
    cadr_snapshot_sink_u32(sink, cpu->pending_md);
    cadr_snapshot_sink_u32(sink, cpu->pending_md_delay);
    cadr_snapshot_sink_u32(sink, cpu->alu_carry);
    cadr_snapshot_sink_u32(sink, cpu->alu_out);
    cadr_snapshot_sink_u32(sink, cpu->out);
    cadr_snapshot_sink_u32(sink, cpu->interrupt_pending);
    cadr_snapshot_sink_u32(sink, cpu->decoded_a_address);
    cadr_snapshot_sink_u32(sink, cpu->decoded_m_address);
    cadr_snapshot_sink_u32(sink, cpu->decoded_a_data);
    cadr_snapshot_sink_u32(sink, cpu->decoded_m_data);
    cadr_snapshot_sink_u32(sink, cpu->decoded_initial_m_data);
    cadr_snapshot_sink_u32(sink, cpu->decoded_class);
    cadr_snapshot_sink_u32(sink, cpu->effective_popj);
    cadr_snapshot_sink_u8(sink, cpu->p0_imem);
    cadr_snapshot_sink_u8(sink, cpu->p1_imem);
    cadr_snapshot_sink_u8(sink, cpu->inhibit);
    cadr_snapshot_sink_u8(sink, cpu->oa_low_pending);
    cadr_snapshot_sink_u8(sink, cpu->oa_high_pending);
    cadr_snapshot_sink_u8(sink, cpu->halted);
    cadr_snapshot_sink_u8(sink, cpu->prom_disabled);
    cadr_snapshot_sink_u8(sink, cpu->vma_ok);
    cadr_snapshot_sink_u8(sink, cpu->main_memory_nxm);
}

static void cadr_snapshot_encode_memory(const cadr_machine_state *state,
                                        cadr_snapshot_sink *sink)
{
    const cadr_memory_state *memory = &state->memory;
    uint32_t page;
    uint32_t index;
    cadr_snapshot_sink_u64(sink, memory->mapped_words);
    cadr_snapshot_sink_u32(sink, memory->initialized);
    cadr_snapshot_sink_u32(sink, memory->main_memory_pages);
    for (index = 0U; index < 512U; ++index) cadr_snapshot_sink_u64(sink, memory->prom[index] & CADR_SNAPSHOT_U48_MASK);
    for (index = 0U; index < 16U * 1024U; ++index) cadr_snapshot_sink_u64(sink, memory->imem[index] & CADR_SNAPSHOT_U48_MASK);
    for (index = 0U; index < 2048U; ++index) cadr_snapshot_sink_u32(sink, memory->l1_map[index]);
    for (index = 0U; index < 1024U; ++index) cadr_snapshot_sink_u32(sink, memory->l2_map[index]);
    for (page = 0U; page < CADR_MAIN_MEMORY_MAX_PAGES; ++page) {
        for (index = 0U; index < CADR_MAIN_MEMORY_WORDS_PER_PAGE; ++index) {
            cadr_snapshot_sink_u32(sink, memory->main_memory[page][index]);
        }
    }
}

static void cadr_snapshot_encode_bus(const cadr_machine_state *state,
                                     cadr_snapshot_sink *sink)
{
    const cadr_bus_state *bus = &state->bus;
    const cadr_diagnostic_latches *diagnostic = &bus->diagnostic;
    uint32_t index;
    cadr_snapshot_sink_u64(sink, bus->guest_tick);
    cadr_snapshot_sink_u32(sink, bus->interrupt_pending);
    cadr_snapshot_sink_u16(sink, bus->interrupt_status);
    cadr_snapshot_sink_u16(sink, bus->error_status);
    for (index = 0U; index < CADR_UNIBUS_MAP_PAGES; ++index) {
        cadr_snapshot_sink_u16(sink, bus->unibus_map[index]);
    }
    for (index = 0U; index < CADR_UNIBUS_MAP_PAGES; ++index) {
        cadr_snapshot_sink_u16(sink, bus->unibus_halfword[index]);
    }
    cadr_snapshot_sink_u64(sink, diagnostic->instruction & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u64(sink, diagnostic->debug_instruction & CADR_SNAPSHOT_U48_MASK);
    cadr_snapshot_sink_u32(sink, diagnostic->opc);
    cadr_snapshot_sink_u32(sink, diagnostic->next_micro_pc);
    cadr_snapshot_sink_u32(sink, diagnostic->output_bus);
    cadr_snapshot_sink_u32(sink, diagnostic->m_source);
    cadr_snapshot_sink_u32(sink, diagnostic->a_source);
    cadr_snapshot_sink_u8(sink, diagnostic->machine_error);
    cadr_snapshot_sink_u8(sink, diagnostic->single_step_done);
    cadr_snapshot_sink_u8(sink, diagnostic->running);
    cadr_snapshot_sink_u8(sink, diagnostic->write_map);
    cadr_snapshot_sink_u8(sink, diagnostic->destination_spc);
    cadr_snapshot_sink_u8(sink, diagnostic->instruction_write);
    cadr_snapshot_sink_u8(sink, diagnostic->instruction_modify);
    cadr_snapshot_sink_u8(sink, diagnostic->pdl_write);
    cadr_snapshot_sink_u8(sink, diagnostic->spc_push);
    cadr_snapshot_sink_u8(sink, diagnostic->instruction_parity);
    cadr_snapshot_sink_u8(sink, diagnostic->nop);
    cadr_snapshot_sink_u8(sink, diagnostic->vma_ok);
    cadr_snapshot_sink_u8(sink, diagnostic->jump_condition);
    cadr_snapshot_sink_u8(sink, diagnostic->next_pc_source);
    cadr_snapshot_sink_u8(sink, diagnostic->reserved0);
    cadr_snapshot_sink_u8(sink, bus->nxm_inhibited);
    for (index = 0U; index < 3U; ++index) cadr_snapshot_sink_u8(sink, bus->reserved0[index]);
}

static void cadr_snapshot_encode_devices(const cadr_machine_state *state,
                                         cadr_snapshot_sink *sink)
{
    const cadr_device_state *devices = &state->devices;
    uint32_t index;
    cadr_snapshot_sink_u64(sink, devices->event_sequence);
    cadr_snapshot_sink_u32(sink, devices->initialized);
    cadr_snapshot_sink_u32(sink, devices->tv_mode);
    cadr_snapshot_sink_u32(sink, devices->tv_vert_spacing);
    cadr_snapshot_sink_u32(sink, devices->tv_sync_ptr);
    cadr_snapshot_sink_bytes(sink, devices->tv_sync_ram, sizeof(devices->tv_sync_ram));
    for (index = 0U; index < CADR_TV_WORDS; ++index) {
        cadr_snapshot_sink_u32(sink, devices->tv_screen[index]);
    }
}

static void cadr_snapshot_encode_canonical(const cadr_machine_state *state,
                                           cadr_snapshot_sink *sink)
{
    const cadr_canonical_state *canonical = &state->canonical;
    uint32_t index;
    cadr_snapshot_sink_u64(sink, canonical->mutation_ordinal);
    cadr_snapshot_sink_u64(sink, canonical->first_mutation_ordinal);
    cadr_snapshot_sink_u32(sink, canonical->mutation_count);
    cadr_snapshot_sink_u32(sink, canonical->initialized);
    cadr_snapshot_sink_u32(sink, canonical->overflowed);
    cadr_snapshot_sink_bytes(sink, canonical->mutation_sha256,
                             sizeof(canonical->mutation_sha256));
    for (index = 0U; index < canonical->mutation_count; ++index) {
        cadr_snapshot_sink_bytes(sink, canonical->mutation_events[index],
                                 sizeof(canonical->mutation_events[index]));
    }
}

static void cadr_snapshot_encode_events(const cadr_machine_state *state,
                                        cadr_snapshot_sink *sink)
{
    const cadr_event_state *events = &state->events;
    cadr_snapshot_sink_u64(sink, events->generation);
    cadr_snapshot_sink_u64(sink, events->next_request_id);
    cadr_snapshot_sink_u64(sink, events->outstanding_request_id);
    cadr_snapshot_sink_u64(sink, events->last_completed_request_id);
    cadr_snapshot_sink_u64(sink, events->request_descriptor_byte_count);
    cadr_snapshot_sink_u64(sink, events->expected_completion_byte_count);
    cadr_snapshot_sink_u64(sink, events->completion_byte_count);
    cadr_snapshot_sink_u32(sink, events->outstanding_operation);
    cadr_snapshot_sink_u32(sink, events->completion_host_status);
    cadr_snapshot_sink_u32(sink, events->completion_queued);
    cadr_snapshot_sink_u32(sink, events->persistent_status);
    cadr_snapshot_sink_u32(sink, events->unexpected_bus_operation);
    cadr_snapshot_sink_u32(sink, events->reserved0);
    cadr_snapshot_encode_descriptor(events, sink);
    if (events->completion_queued != 0U) {
        cadr_snapshot_sink_bytes(sink, events->completion_bytes,
                                 events->completion_byte_count);
    }
}

static void cadr_snapshot_encode_trace(const cadr_machine_state *state,
                                       cadr_snapshot_sink *sink)
{
    const cadr_trace_state *trace = &state->trace;
    cadr_snapshot_sink_u64(sink, trace->instruction_ordinal);
    cadr_snapshot_sink_u64(sink, trace->event_sequence);
    cadr_snapshot_sink_u64(sink, trace->raw_fetched_word);
    cadr_snapshot_sink_u64(sink, trace->effective_word);
    cadr_snapshot_sink_u32(sink, trace->pc);
    cadr_snapshot_sink_u32(sink, trace->store_selector);
    cadr_snapshot_sink_u32(sink, trace->operation);
    cadr_snapshot_sink_u32(sink, trace->a_address);
    cadr_snapshot_sink_u32(sink, trace->m_address);
    cadr_snapshot_sink_u32(sink, trace->a_value);
    cadr_snapshot_sink_u32(sink, trace->m_value);
    cadr_snapshot_sink_u32(sink, trace->instruction_memory);
    cadr_snapshot_sink_u32(sink, trace->functional_m_source);
    cadr_snapshot_sink_u32(sink, trace->effective_popj);
    cadr_snapshot_sink_u32(sink, trace->last_slot_executed);
    cadr_snapshot_sink_u32(sink, trace->last_slot_inhibited);
    cadr_snapshot_sink_u32(sink, trace->decoded);
    cadr_snapshot_sink_u32(sink, trace->valid_mask);
    cadr_snapshot_sink_u32(sink, trace->pre_destination);
    cadr_snapshot_sink_u32(sink, trace->pre_q);
    cadr_snapshot_sink_u32(sink, trace->pre_vma);
    cadr_snapshot_sink_u32(sink, trace->pre_md);
    cadr_snapshot_sink_u32(sink, trace->pre_macro_pc);
    cadr_snapshot_sink_u32(sink, trace->post_destination_value);
    cadr_snapshot_sink_u32(sink, trace->post_q);
    cadr_snapshot_sink_u32(sink, trace->post_vma);
    cadr_snapshot_sink_u32(sink, trace->post_md);
    cadr_snapshot_sink_u32(sink, trace->post_macro_pc);
    cadr_snapshot_sink_u32(sink, trace->post_fault);
    cadr_snapshot_sink_u32(sink, trace->post_interrupt_status);
    cadr_snapshot_sink_u32(sink, trace->post_interrupt_pending);
    cadr_snapshot_sink_u32(sink, trace->class_outcome);
    cadr_snapshot_sink_u32(sink, trace->pre_p0_pc);
    cadr_snapshot_sink_u32(sink, trace->pre_p1_pc);
    cadr_snapshot_sink_u32(sink, trace->pre_next_micro_pc);
    cadr_snapshot_sink_u32(sink, trace->pre_opc);
    cadr_snapshot_sink_u32(sink, trace->post_p0_pc);
    cadr_snapshot_sink_u32(sink, trace->post_p1_pc);
    cadr_snapshot_sink_u32(sink, trace->post_next_micro_pc);
    cadr_snapshot_sink_u32(sink, trace->post_opc);
    cadr_snapshot_sink_u32(sink, trace->m_source_kind);
    cadr_snapshot_sink_u32(sink, trace->destination_kind);
    cadr_snapshot_sink_u32(sink, trace->destination_address);
    cadr_snapshot_sink_u32(sink, trace->md_delayed_phase);
    cadr_snapshot_sink_u32(sink, trace->pre_fault);
    cadr_snapshot_sink_u32(sink, trace->fault_code);
    cadr_snapshot_sink_u32(sink, trace->pre_interrupt_status);
    cadr_snapshot_sink_u32(sink, trace->pre_interrupt_pending);
    cadr_snapshot_sink_u32(sink, trace->interrupt_level);
    cadr_snapshot_sink_u32(sink, trace->reserved0);
}

static void cadr_snapshot_encode_disk_fields(const cadr_machine_state *state,
                                             cadr_snapshot_sink *sink)
{
    const cadr_disk_state *disk = &state->devices.disk;
    cadr_snapshot_sink_u64(sink, disk->pending_first_block);
    cadr_snapshot_sink_u32(sink, disk->compatibility_profile);
    cadr_snapshot_sink_u32(sink, disk->command);
    cadr_snapshot_sink_u32(sink, disk->command_list_pointer);
    cadr_snapshot_sink_u32(sink, disk->disk_address);
    cadr_snapshot_sink_u32(sink, disk->last_memory_address);
    cadr_snapshot_sink_u32(sink, disk->pending_ccw_address);
    cadr_snapshot_sink_u32(sink, disk->pending_memory_address);
    cadr_snapshot_sink_u32(sink, disk->pending_ccw);
    cadr_snapshot_sink_u32(sink, disk->status);
    cadr_snapshot_sink_u32(sink, disk->transfer_active);
    cadr_snapshot_sink_u32(sink, disk->reset_condition);
    cadr_snapshot_sink_u32(sink, disk->done_interrupt_enable);
    cadr_snapshot_sink_u32(sink, disk->attention_interrupt_enable);
    cadr_snapshot_sink_u32(sink, disk->reserved0);
}

static void cadr_snapshot_encode_disk(const cadr_machine_state *state,
                                      cadr_snapshot_sink *sink)
{
    uint8_t witness[CADR_SHA256_BYTES];
    cadr_snapshot_encode_disk_fields(state, sink);
    if (cadr_state_v3_digest(state, witness) != CADR_STATUS_OK) {
        sink->failed = 1;
        return;
    }
    cadr_snapshot_sink_bytes(sink, witness, sizeof(witness));
}

static void cadr_snapshot_encode_chunk(uint32_t type,
                                       const cadr_machine_state *state,
                                       cadr_snapshot_sink *sink)
{
    switch (type) {
    case CADR_SNAPSHOT_CHUNK_CORE:
        cadr_snapshot_encode_core(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_CPU:
        cadr_snapshot_encode_cpu(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_MEMORY:
        cadr_snapshot_encode_memory(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_BUS:
        cadr_snapshot_encode_bus(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_DEVICES:
        cadr_snapshot_encode_devices(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_CANONICAL:
        cadr_snapshot_encode_canonical(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_EVENTS:
        cadr_snapshot_encode_events(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_TRACE:
        cadr_snapshot_encode_trace(state, sink);
        break;
    case CADR_SNAPSHOT_CHUNK_DISK:
        cadr_snapshot_encode_disk(state, sink);
        break;
    default:
        sink->failed = 1;
        break;
    }
}

static cadr_status cadr_snapshot_layout_for_state(const cadr_machine_state *state,
                                                  uint16_t format_minor,
                                                  cadr_snapshot_layout *layout)
{
    uint32_t type;
    uint64_t value;
    if (layout == NULL || (format_minor != CADR_SNAPSHOT_FORMAT_MINOR_M2 &&
                           format_minor != CADR_SNAPSHOT_FORMAT_MINOR_M3)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(layout, 0, sizeof(*layout));
    layout->format_minor = format_minor;
    layout->chunk_count = format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3
        ? CADR_SNAPSHOT_M3_CHUNK_COUNT : CADR_SNAPSHOT_M2_CHUNK_COUNT;
    for (type = CADR_SNAPSHOT_CHUNK_CORE;
         type <= layout->chunk_count; ++type) {
        cadr_snapshot_sink count_sink = { NULL, UINT64_MAX, 0U, NULL, 0 };
        cadr_snapshot_encode_chunk(type, state, &count_sink);
        if (count_sink.failed != 0) return CADR_STATUS_INVALID_ARGUMENT;
        layout->chunk_lengths[type - CADR_SNAPSHOT_CHUNK_CORE] = count_sink.offset;
    }
    if (!cadr_snapshot_u64_multiply((uint64_t)layout->chunk_count,
                                    CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES,
                                    &layout->directory_bytes) ||
        !cadr_snapshot_u64_add(CADR_SNAPSHOT_HEADER_BYTES, layout->directory_bytes,
                               &layout->payload_offset)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    value = layout->payload_offset;
    for (type = 0U; type < layout->chunk_count; ++type) {
        if (!cadr_snapshot_u64_add(value, layout->chunk_lengths[type], &value)) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    if (!cadr_snapshot_u64_add(value, CADR_SNAPSHOT_TRAILER_BYTES,
                               &layout->total_bytes)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return CADR_STATUS_OK;
}

static cadr_status cadr_snapshot_semantic_fingerprint(const cadr_machine_state *state,
                                                       uint16_t format_minor,
                                                       uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_snapshot_sha256_context context;
    cadr_snapshot_sink sink;
    uint32_t type;
    if (state == NULL || digest == NULL ||
        (format_minor != CADR_SNAPSHOT_FORMAT_MINOR_M2 &&
         format_minor != CADR_SNAPSHOT_FORMAT_MINOR_M3)) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_snapshot_sha256_init(&context);
    sink.bytes = NULL;
    sink.capacity = UINT64_MAX;
    sink.offset = 0U;
    sink.hash = &context;
    sink.failed = 0;
    for (type = CADR_SNAPSHOT_CHUNK_CORE;
         type <= CADR_SNAPSHOT_CHUNK_TRACE; ++type) {
        cadr_snapshot_encode_chunk(type, state, &sink);
    }
    if (format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3) {
        cadr_snapshot_encode_disk_fields(state, &sink);
    }
    if (sink.failed != 0) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_snapshot_sha256_final(&context, digest);
    return CADR_STATUS_OK;
}

static void cadr_snapshot_metadata_from_state(const cadr_machine_state *state,
                                              const uint8_t cdrstate1_digest[
                                                  CADR_SNAPSHOT_CDRSTATE1_BYTES],
                                              const uint8_t cdrstate2_digest[
                                                  CADR_SNAPSHOT_CDRSTATE2_BYTES],
                                              cadr_snapshot_metadata *metadata)
{
    (void)memset(metadata, 0, sizeof(*metadata));
    metadata->profile = state->profile;
    metadata->lifecycle = state->lifecycle;
    metadata->artifact_mask = cadr_snapshot_artifact_mask(state);
    metadata->storage_binding_flags = 0U;
    metadata->storage_overlay_generation = 0U;
    metadata->clock_slots_completed = state->clock_slots_completed;
    metadata->microinstructions_executed = state->cpu.microinstructions_executed;
    (void)memcpy(metadata->selected_profile_sha256, cadr_snapshot_profile_sha256,
                 sizeof(metadata->selected_profile_sha256));
    (void)memcpy(metadata->artifact_set_sha256, cadr_snapshot_artifact_set_sha256,
                 sizeof(metadata->artifact_set_sha256));
    (void)memcpy(metadata->cdrstate1_digest, cdrstate1_digest,
                 sizeof(metadata->cdrstate1_digest));
    (void)memcpy(metadata->cdrstate2_digest, cdrstate2_digest,
                 sizeof(metadata->cdrstate2_digest));
}

static void cadr_snapshot_encode_header(const cadr_snapshot_layout *layout,
                                        const cadr_snapshot_metadata *metadata,
                                        const uint8_t directory_sha256[CADR_SHA256_BYTES],
                                        uint8_t *out_header)
{
    cadr_snapshot_sink sink = {
        out_header, CADR_SNAPSHOT_HEADER_BYTES, 0U, NULL, 0
    };
    cadr_snapshot_sink_bytes(&sink, cadr_snapshot_magic, sizeof(cadr_snapshot_magic));
    cadr_snapshot_sink_u16(&sink, CADR_SNAPSHOT_FORMAT_MAJOR);
    cadr_snapshot_sink_u16(&sink, layout->format_minor);
    cadr_snapshot_sink_u32(&sink, (uint32_t)CADR_SNAPSHOT_HEADER_BYTES);
    cadr_snapshot_sink_u32(&sink, 0U);
    cadr_snapshot_sink_u32(&sink, layout->chunk_count);
    cadr_snapshot_sink_u32(&sink, (uint32_t)CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES);
    cadr_snapshot_sink_u32(&sink, 0U);
    cadr_snapshot_sink_u64(&sink, layout->total_bytes);
    cadr_snapshot_sink_u64(&sink, CADR_SNAPSHOT_HEADER_BYTES);
    cadr_snapshot_sink_u64(&sink, layout->directory_bytes);
    cadr_snapshot_sink_u64(&sink, layout->payload_offset);
    cadr_snapshot_sink_u32(&sink, metadata->profile);
    cadr_snapshot_sink_u32(&sink, metadata->artifact_mask);
    cadr_snapshot_sink_u32(&sink, metadata->lifecycle);
    cadr_snapshot_sink_u32(&sink, metadata->storage_binding_flags);
    cadr_snapshot_sink_u64(&sink, metadata->storage_overlay_generation);
    cadr_snapshot_sink_u64(&sink, metadata->clock_slots_completed);
    cadr_snapshot_sink_u64(&sink, metadata->microinstructions_executed);
    cadr_snapshot_sink_bytes(&sink, metadata->selected_profile_sha256,
                             sizeof(metadata->selected_profile_sha256));
    cadr_snapshot_sink_bytes(&sink, metadata->artifact_set_sha256,
                             sizeof(metadata->artifact_set_sha256));
    cadr_snapshot_sink_bytes(&sink, metadata->cdrstate1_digest,
                             sizeof(metadata->cdrstate1_digest));
    cadr_snapshot_sink_bytes(&sink, metadata->cdrstate2_digest,
                             sizeof(metadata->cdrstate2_digest));
    cadr_snapshot_sink_bytes(&sink, directory_sha256, CADR_SHA256_BYTES);
    if (sink.failed != 0 || sink.offset != CADR_SNAPSHOT_HEADER_BYTES) {
        (void)memset(out_header, 0, (size_t)CADR_SNAPSHOT_HEADER_BYTES);
    }
}

static void cadr_snapshot_encode_directory(const cadr_snapshot_directory_entry *entries,
                                           uint32_t entry_count,
                                           uint8_t *out_directory)
{
    cadr_snapshot_sink sink = {
        out_directory,
        (uint64_t)entry_count * CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES,
        0U, NULL, 0
    };
    uint32_t index;
    for (index = 0U; index < entry_count; ++index) {
        cadr_snapshot_sink_u32(&sink, entries[index].type);
        cadr_snapshot_sink_u32(&sink, entries[index].flags);
        cadr_snapshot_sink_u64(&sink, entries[index].offset);
        cadr_snapshot_sink_u64(&sink, entries[index].length);
        cadr_snapshot_sink_u64(&sink, 0U);
        cadr_snapshot_sink_bytes(&sink, entries[index].sha256,
                                 sizeof(entries[index].sha256));
    }
    if (sink.failed != 0) {
        (void)memset(out_directory, 0,
                     (size_t)((uint64_t)entry_count * CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES));
    }
}

cadr_status cadr_snapshot_size_versioned(
    const cadr_machine_state *state, uint16_t format_minor,
    const uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES],
    const uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES],
    uint64_t *out_byte_count)
{
    cadr_snapshot_layout layout;
    cadr_status status;
    if (out_byte_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_byte_count = 0U;
    if (cdrstate1_digest == NULL || cdrstate2_digest == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state != NULL && state->events.request_payload_byte_count != 0U) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_snapshot_validate_state(state, format_minor);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_layout_for_state(state, format_minor, &layout);
    if (status != CADR_STATUS_OK) return status;
    *out_byte_count = layout.total_bytes;
    return CADR_STATUS_OK;
}

cadr_status cadr_snapshot_size(const cadr_machine_state *state,
                               const uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES],
                               const uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES],
                               uint64_t *out_byte_count)
{
    return cadr_snapshot_size_versioned(state, CADR_SNAPSHOT_FORMAT_MINOR_M2,
                                        cdrstate1_digest, cdrstate2_digest,
                                        out_byte_count);
}

cadr_status cadr_snapshot_serialize_versioned(
    const cadr_machine_state *state, uint16_t format_minor,
    const uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES],
    const uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES],
    uint8_t *out_bytes,
    uint64_t out_capacity,
    uint64_t *out_written)
{
    cadr_snapshot_layout layout;
    cadr_snapshot_directory_entry entries[CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT];
    cadr_snapshot_metadata metadata;
    uint8_t directory_sha256[CADR_SHA256_BYTES];
    uint8_t final_sha256[CADR_SHA256_BYTES];
    uint64_t payload_offset;
    uint32_t type;
    cadr_status status;

    if (out_written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_written = 0U;
    if (cdrstate1_digest == NULL || cdrstate2_digest == NULL ||
        out_bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (state != NULL && state->events.request_payload_byte_count != 0U) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_snapshot_validate_state(state, format_minor);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_layout_for_state(state, format_minor, &layout);
    if (status != CADR_STATUS_OK || layout.total_bytes > (uint64_t)SIZE_MAX ||
        out_capacity < layout.total_bytes) {
        return status == CADR_STATUS_OK ? CADR_STATUS_WRONG_LENGTH : status;
    }
    cadr_snapshot_metadata_from_state(state, cdrstate1_digest, cdrstate2_digest,
                                      &metadata);
    payload_offset = layout.payload_offset;
    (void)memset(entries, 0, sizeof(entries));
    for (type = CADR_SNAPSHOT_CHUNK_CORE;
         type <= layout.chunk_count; ++type) {
        const uint32_t entry_index = type - CADR_SNAPSHOT_CHUNK_CORE;
        cadr_snapshot_sha256_context chunk_context;
        cadr_snapshot_sink chunk_sink;
        entries[entry_index].type = type;
        entries[entry_index].flags = CADR_SNAPSHOT_REQUIRED_FLAG;
        entries[entry_index].offset = payload_offset;
        entries[entry_index].length = layout.chunk_lengths[entry_index];
        cadr_snapshot_sha256_init(&chunk_context);
        chunk_sink.bytes = out_bytes + (size_t)payload_offset;
        chunk_sink.capacity = entries[entry_index].length;
        chunk_sink.offset = 0U;
        chunk_sink.hash = &chunk_context;
        chunk_sink.failed = 0;
        cadr_snapshot_encode_chunk(type, state, &chunk_sink);
        if (chunk_sink.failed != 0 || chunk_sink.offset != entries[entry_index].length) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        cadr_snapshot_sha256_final(&chunk_context, entries[entry_index].sha256);
        if (!cadr_snapshot_u64_add(payload_offset, entries[entry_index].length,
                                   &payload_offset)) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    cadr_snapshot_encode_directory(entries, layout.chunk_count,
                                   out_bytes + (size_t)CADR_SNAPSHOT_HEADER_BYTES);
    cadr_snapshot_sha256(out_bytes + (size_t)CADR_SNAPSHOT_HEADER_BYTES,
                         layout.directory_bytes, directory_sha256);
    cadr_snapshot_encode_header(&layout, &metadata, directory_sha256, out_bytes);
    cadr_snapshot_sha256(out_bytes, layout.total_bytes - CADR_SNAPSHOT_TRAILER_BYTES,
                         final_sha256);
    (void)memcpy(out_bytes + (size_t)(layout.total_bytes - CADR_SNAPSHOT_TRAILER_BYTES),
                 final_sha256, sizeof(final_sha256));
    *out_written = layout.total_bytes;
    return CADR_STATUS_OK;
}

cadr_status cadr_snapshot_serialize(
    const cadr_machine_state *state,
    const uint8_t cdrstate1_digest[CADR_SNAPSHOT_CDRSTATE1_BYTES],
    const uint8_t cdrstate2_digest[CADR_SNAPSHOT_CDRSTATE2_BYTES],
    uint8_t *out_bytes, uint64_t out_capacity, uint64_t *out_written)
{
    return cadr_snapshot_serialize_versioned(
        state, CADR_SNAPSHOT_FORMAT_MINOR_M2, cdrstate1_digest,
        cdrstate2_digest, out_bytes, out_capacity, out_written);
}

typedef struct cadr_snapshot_header {
    uint16_t format_minor;
    uint32_t chunk_count;
    uint64_t total_bytes;
    uint64_t directory_offset;
    uint64_t directory_bytes;
    uint64_t payload_offset;
    cadr_snapshot_metadata metadata;
    uint8_t directory_sha256[CADR_SHA256_BYTES];
} cadr_snapshot_header;

static int cadr_snapshot_known_chunk(uint16_t format_minor, uint32_t type)
{
    return type >= CADR_SNAPSHOT_CHUNK_CORE &&
        type <= (format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3
                     ? CADR_SNAPSHOT_CHUNK_DISK : CADR_SNAPSHOT_CHUNK_TRACE);
}

static cadr_status cadr_snapshot_parse_header(const uint8_t *bytes,
                                              uint64_t byte_count,
                                              cadr_snapshot_header *header)
{
    cadr_snapshot_reader reader;
    uint16_t major;
    uint16_t minor;
    uint32_t header_bytes;
    uint32_t flags;
    uint32_t directory_entry_bytes;
    uint32_t reserved0;
    uint32_t artifact_mask;
    uint32_t lifecycle;
    uint64_t expected_directory_bytes;
    uint64_t expected_payload_offset;
    uint64_t minimum_total;
    uint8_t final_sha256[CADR_SHA256_BYTES];

    if (bytes == NULL || header == NULL || byte_count > (uint64_t)SIZE_MAX ||
        byte_count < CADR_SNAPSHOT_HEADER_BYTES + CADR_SNAPSHOT_TRAILER_BYTES) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(header, 0, sizeof(*header));
    reader.bytes = bytes;
    reader.length = CADR_SNAPSHOT_HEADER_BYTES;
    reader.offset = 0U;
    reader.failed = 0;
    {
        uint8_t magic[sizeof(cadr_snapshot_magic)];
        cadr_snapshot_reader_bytes(&reader, magic, sizeof(magic));
        if (reader.failed != 0 || memcmp(magic, cadr_snapshot_magic, sizeof(magic)) != 0) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    major = cadr_snapshot_reader_u16(&reader);
    minor = cadr_snapshot_reader_u16(&reader);
    header_bytes = cadr_snapshot_reader_u32(&reader);
    flags = cadr_snapshot_reader_u32(&reader);
    header->chunk_count = cadr_snapshot_reader_u32(&reader);
    directory_entry_bytes = cadr_snapshot_reader_u32(&reader);
    reserved0 = cadr_snapshot_reader_u32(&reader);
    header->total_bytes = cadr_snapshot_reader_u64(&reader);
    header->directory_offset = cadr_snapshot_reader_u64(&reader);
    header->directory_bytes = cadr_snapshot_reader_u64(&reader);
    header->payload_offset = cadr_snapshot_reader_u64(&reader);
    header->metadata.profile = cadr_snapshot_reader_u32(&reader);
    artifact_mask = cadr_snapshot_reader_u32(&reader);
    lifecycle = cadr_snapshot_reader_u32(&reader);
    header->metadata.storage_binding_flags = cadr_snapshot_reader_u32(&reader);
    header->metadata.storage_overlay_generation = cadr_snapshot_reader_u64(&reader);
    header->metadata.clock_slots_completed = cadr_snapshot_reader_u64(&reader);
    header->metadata.microinstructions_executed = cadr_snapshot_reader_u64(&reader);
    cadr_snapshot_reader_bytes(&reader, header->metadata.selected_profile_sha256,
                               sizeof(header->metadata.selected_profile_sha256));
    cadr_snapshot_reader_bytes(&reader, header->metadata.artifact_set_sha256,
                               sizeof(header->metadata.artifact_set_sha256));
    cadr_snapshot_reader_bytes(&reader, header->metadata.cdrstate1_digest,
                               sizeof(header->metadata.cdrstate1_digest));
    cadr_snapshot_reader_bytes(&reader, header->metadata.cdrstate2_digest,
                               sizeof(header->metadata.cdrstate2_digest));
    cadr_snapshot_reader_bytes(&reader, header->directory_sha256,
                               sizeof(header->directory_sha256));
    if (reader.failed != 0 || reader.offset != CADR_SNAPSHOT_HEADER_BYTES ||
        major != CADR_SNAPSHOT_FORMAT_MAJOR ||
        (minor != CADR_SNAPSHOT_FORMAT_MINOR_M2 &&
         minor != CADR_SNAPSHOT_FORMAT_MINOR_M3) ||
        header_bytes != CADR_SNAPSHOT_HEADER_BYTES || flags != 0U || reserved0 != 0U ||
        header->chunk_count < (minor == CADR_SNAPSHOT_FORMAT_MINOR_M3
                                   ? CADR_SNAPSHOT_M3_CHUNK_COUNT
                                   : CADR_SNAPSHOT_M2_CHUNK_COUNT) ||
        header->chunk_count > CADR_SNAPSHOT_MAX_CHUNKS ||
        directory_entry_bytes != CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES ||
        header->total_bytes != byte_count ||
        header->directory_offset != CADR_SNAPSHOT_HEADER_BYTES ||
        header->metadata.profile != CADR_PROFILE_CADR_WEB_303 ||
        (artifact_mask & ~CADR_SNAPSHOT_ARTIFACT_MASK) != 0U ||
        !cadr_snapshot_lifecycle_valid(lifecycle) ||
        header->metadata.storage_binding_flags != 0U ||
        header->metadata.storage_overlay_generation != 0U ||
        memcmp(header->metadata.selected_profile_sha256, cadr_snapshot_profile_sha256,
               sizeof(cadr_snapshot_profile_sha256)) != 0 ||
        memcmp(header->metadata.artifact_set_sha256, cadr_snapshot_artifact_set_sha256,
               sizeof(cadr_snapshot_artifact_set_sha256)) != 0) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    header->metadata.lifecycle = lifecycle;
    header->metadata.artifact_mask = artifact_mask;
    header->metadata.format_minor = minor;
    header->format_minor = minor;
    if (!cadr_snapshot_u64_multiply((uint64_t)header->chunk_count,
                                    CADR_SNAPSHOT_DIRECTORY_ENTRY_BYTES,
                                    &expected_directory_bytes) ||
        !cadr_snapshot_u64_add(header->directory_offset, expected_directory_bytes,
                               &expected_payload_offset) ||
        !cadr_snapshot_u64_add(expected_payload_offset, CADR_SNAPSHOT_TRAILER_BYTES,
                               &minimum_total) ||
        header->directory_bytes != expected_directory_bytes ||
        header->payload_offset != expected_payload_offset ||
        header->total_bytes < minimum_total) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_snapshot_sha256(bytes, header->total_bytes - CADR_SNAPSHOT_TRAILER_BYTES,
                         final_sha256);
    if (memcmp(final_sha256,
               bytes + (size_t)(header->total_bytes - CADR_SNAPSHOT_TRAILER_BYTES),
               sizeof(final_sha256)) != 0) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_snapshot_sha256(bytes + (size_t)header->directory_offset,
                         header->directory_bytes, final_sha256);
    if (memcmp(final_sha256, header->directory_sha256, sizeof(final_sha256)) != 0) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return CADR_STATUS_OK;
}

static cadr_status cadr_snapshot_parse_directory(
    const uint8_t *bytes,
    const cadr_snapshot_header *header,
    cadr_snapshot_directory_entry **out_entries,
    const cadr_snapshot_directory_entry *known_entries[CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT])
{
    cadr_snapshot_directory_entry *entries;
    cadr_snapshot_reader reader;
    uint64_t next_payload_offset;
    uint32_t previous_type = 0U;
    int have_previous_type = 0;
    uint32_t index;
    uint8_t seen[CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT] = {0U};
    if (bytes == NULL || header == NULL || out_entries == NULL || known_entries == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    *out_entries = NULL;
    for (index = 0U; index < CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT; ++index) {
        known_entries[index] = NULL;
    }
    entries = calloc((size_t)header->chunk_count, sizeof(*entries));
    if (entries == NULL) return CADR_STATUS_NO_MEMORY;
    reader.bytes = bytes + (size_t)header->directory_offset;
    reader.length = header->directory_bytes;
    reader.offset = 0U;
    reader.failed = 0;
    next_payload_offset = header->payload_offset;
    for (index = 0U; index < header->chunk_count; ++index) {
        uint64_t reserved0;
        uint64_t end_offset;
        uint8_t digest[CADR_SHA256_BYTES];
        entries[index].type = cadr_snapshot_reader_u32(&reader);
        entries[index].flags = cadr_snapshot_reader_u32(&reader);
        entries[index].offset = cadr_snapshot_reader_u64(&reader);
        entries[index].length = cadr_snapshot_reader_u64(&reader);
        reserved0 = cadr_snapshot_reader_u64(&reader);
        cadr_snapshot_reader_bytes(&reader, entries[index].sha256,
                                   sizeof(entries[index].sha256));
        if (reader.failed != 0 ||
            (have_previous_type != 0 && entries[index].type <= previous_type) ||
            (entries[index].flags & ~CADR_SNAPSHOT_REQUIRED_FLAG) != 0U ||
            reserved0 != 0U || entries[index].offset != next_payload_offset ||
            !cadr_snapshot_u64_add(entries[index].offset, entries[index].length,
                                   &end_offset) ||
            end_offset > header->total_bytes - CADR_SNAPSHOT_TRAILER_BYTES) {
            free(entries);
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        cadr_snapshot_sha256(bytes + (size_t)entries[index].offset,
                             entries[index].length, digest);
        if (memcmp(digest, entries[index].sha256, sizeof(digest)) != 0) {
            free(entries);
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        if (cadr_snapshot_known_chunk(header->format_minor, entries[index].type)) {
            const uint32_t known_index = entries[index].type - CADR_SNAPSHOT_CHUNK_CORE;
            if (entries[index].flags != CADR_SNAPSHOT_REQUIRED_FLAG || seen[known_index] != 0U) {
                free(entries);
                return CADR_STATUS_INVALID_ARGUMENT;
            }
            seen[known_index] = 1U;
            known_entries[known_index] = &entries[index];
        } else if (entries[index].flags != 0U) {
            free(entries);
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        previous_type = entries[index].type;
        have_previous_type = 1;
        next_payload_offset = end_offset;
    }
    if (reader.failed != 0 || reader.offset != header->directory_bytes ||
        next_payload_offset != header->total_bytes - CADR_SNAPSHOT_TRAILER_BYTES) {
        free(entries);
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    for (index = 0U;
         index < (header->format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3
                      ? CADR_SNAPSHOT_M3_CHUNK_COUNT : CADR_SNAPSHOT_M2_CHUNK_COUNT);
         ++index) {
        if (seen[index] == 0U) {
            free(entries);
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    *out_entries = entries;
    return CADR_STATUS_OK;
}

static cadr_snapshot_reader cadr_snapshot_chunk_reader(
    const uint8_t *bytes, const cadr_snapshot_directory_entry *entry)
{
    cadr_snapshot_reader reader;
    reader.bytes = bytes + (size_t)entry->offset;
    reader.length = entry->length;
    reader.offset = 0U;
    reader.failed = 0;
    return reader;
}

static cadr_status cadr_snapshot_finish_chunk(const cadr_snapshot_reader *reader)
{
    return reader->failed == 0 && reader->offset == reader->length
        ? CADR_STATUS_OK : CADR_STATUS_INVALID_ARGUMENT;
}

static void cadr_snapshot_decode_core(cadr_snapshot_reader *reader,
                                      cadr_machine_state *state)
{
    uint32_t index;
    state->profile = cadr_snapshot_reader_u32(reader);
    state->lifecycle = cadr_snapshot_reader_u32(reader);
    state->in_host_completion = cadr_snapshot_reader_u32(reader);
    state->reserved0 = cadr_snapshot_reader_u32(reader);
    state->clock_slots_completed = cadr_snapshot_reader_u64(reader);
    state->artifacts.boot_configuration_ingressed = cadr_snapshot_reader_u32(reader);
    state->artifacts.control_store_ingressed = cadr_snapshot_reader_u32(reader);
    state->artifacts.base_disk_verified = cadr_snapshot_reader_u32(reader);
    state->artifacts.prom_symbols_verified = cadr_snapshot_reader_u32(reader);
    state->artifacts.microcode_symbols_verified = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 3U; ++index) {
        state->artifacts.reserved0[index] = cadr_snapshot_reader_u32(reader);
    }
}

static void cadr_snapshot_decode_cpu(cadr_snapshot_reader *reader,
                                     cadr_machine_state *state)
{
    cadr_cpu_state *cpu = &state->cpu;
    uint32_t index;
    cpu->microinstructions_executed = cadr_snapshot_reader_u64(reader);
    cpu->guest_fault = cadr_snapshot_reader_u32(reader);
    cpu->p0 = cadr_snapshot_reader_u64(reader);
    cpu->p1 = cadr_snapshot_reader_u64(reader);
    cpu->debug_ir = cadr_snapshot_reader_u64(reader);
    cpu->instruction_write_register = cadr_snapshot_reader_u64(reader);
    cpu->p0_pc = cadr_snapshot_reader_u32(reader);
    cpu->p1_pc = cadr_snapshot_reader_u32(reader);
    cpu->next_micro_pc = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 1024U; ++index) cpu->a_memory[index] = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 32U; ++index) cpu->m_memory[index] = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 2048U; ++index) cpu->dispatch_memory[index] = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 1024U; ++index) cpu->pdl[index] = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 32U; ++index) cpu->micro_stack[index] = cadr_snapshot_reader_u32(reader);
    cpu->micro_stack_pointer = cadr_snapshot_reader_u32(reader);
    cpu->dispatch_constant = cadr_snapshot_reader_u32(reader);
    cpu->pdl_pointer = cadr_snapshot_reader_u32(reader);
    cpu->pdl_index = cadr_snapshot_reader_u32(reader);
    cpu->vma = cadr_snapshot_reader_u32(reader);
    cpu->md = cadr_snapshot_reader_u32(reader);
    cpu->location_counter = cadr_snapshot_reader_u32(reader);
    cpu->oa_low = cadr_snapshot_reader_u32(reader);
    cpu->oa_high = cadr_snapshot_reader_u32(reader);
    cpu->opc = cadr_snapshot_reader_u32(reader);
    cpu->q = cadr_snapshot_reader_u32(reader);
    cpu->old_q = cadr_snapshot_reader_u32(reader);
    cpu->interrupt_control = cadr_snapshot_reader_u32(reader);
    cpu->pending_md = cadr_snapshot_reader_u32(reader);
    cpu->pending_md_delay = cadr_snapshot_reader_u32(reader);
    cpu->alu_carry = cadr_snapshot_reader_u32(reader);
    cpu->alu_out = cadr_snapshot_reader_u32(reader);
    cpu->out = cadr_snapshot_reader_u32(reader);
    cpu->interrupt_pending = cadr_snapshot_reader_u32(reader);
    cpu->decoded_a_address = cadr_snapshot_reader_u32(reader);
    cpu->decoded_m_address = cadr_snapshot_reader_u32(reader);
    cpu->decoded_a_data = cadr_snapshot_reader_u32(reader);
    cpu->decoded_m_data = cadr_snapshot_reader_u32(reader);
    cpu->decoded_initial_m_data = cadr_snapshot_reader_u32(reader);
    cpu->decoded_class = cadr_snapshot_reader_u32(reader);
    cpu->effective_popj = cadr_snapshot_reader_u32(reader);
    cpu->p0_imem = cadr_snapshot_reader_u8(reader);
    cpu->p1_imem = cadr_snapshot_reader_u8(reader);
    cpu->inhibit = cadr_snapshot_reader_u8(reader);
    cpu->oa_low_pending = cadr_snapshot_reader_u8(reader);
    cpu->oa_high_pending = cadr_snapshot_reader_u8(reader);
    cpu->halted = cadr_snapshot_reader_u8(reader);
    cpu->prom_disabled = cadr_snapshot_reader_u8(reader);
    cpu->vma_ok = cadr_snapshot_reader_u8(reader);
    cpu->main_memory_nxm = cadr_snapshot_reader_u8(reader);
}

static void cadr_snapshot_decode_memory(cadr_snapshot_reader *reader,
                                        cadr_machine_state *state)
{
    cadr_memory_state *memory = &state->memory;
    uint32_t page;
    uint32_t index;
    memory->mapped_words = cadr_snapshot_reader_u64(reader);
    memory->initialized = cadr_snapshot_reader_u32(reader);
    memory->main_memory_pages = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 512U; ++index) memory->prom[index] = cadr_snapshot_reader_u64(reader);
    for (index = 0U; index < 16U * 1024U; ++index) memory->imem[index] = cadr_snapshot_reader_u64(reader);
    for (index = 0U; index < 2048U; ++index) memory->l1_map[index] = cadr_snapshot_reader_u32(reader);
    for (index = 0U; index < 1024U; ++index) memory->l2_map[index] = cadr_snapshot_reader_u32(reader);
    for (page = 0U; page < CADR_MAIN_MEMORY_MAX_PAGES; ++page) {
        for (index = 0U; index < CADR_MAIN_MEMORY_WORDS_PER_PAGE; ++index) {
            memory->main_memory[page][index] = cadr_snapshot_reader_u32(reader);
        }
    }
}

static void cadr_snapshot_decode_bus(cadr_snapshot_reader *reader,
                                     cadr_machine_state *state)
{
    cadr_bus_state *bus = &state->bus;
    cadr_diagnostic_latches *diagnostic = &bus->diagnostic;
    uint32_t index;
    bus->guest_tick = cadr_snapshot_reader_u64(reader);
    bus->interrupt_pending = cadr_snapshot_reader_u32(reader);
    bus->interrupt_status = cadr_snapshot_reader_u16(reader);
    bus->error_status = cadr_snapshot_reader_u16(reader);
    for (index = 0U; index < CADR_UNIBUS_MAP_PAGES; ++index) {
        bus->unibus_map[index] = cadr_snapshot_reader_u16(reader);
    }
    for (index = 0U; index < CADR_UNIBUS_MAP_PAGES; ++index) {
        bus->unibus_halfword[index] = cadr_snapshot_reader_u16(reader);
    }
    diagnostic->instruction = cadr_snapshot_reader_u64(reader);
    diagnostic->debug_instruction = cadr_snapshot_reader_u64(reader);
    diagnostic->opc = cadr_snapshot_reader_u32(reader);
    diagnostic->next_micro_pc = cadr_snapshot_reader_u32(reader);
    diagnostic->output_bus = cadr_snapshot_reader_u32(reader);
    diagnostic->m_source = cadr_snapshot_reader_u32(reader);
    diagnostic->a_source = cadr_snapshot_reader_u32(reader);
    diagnostic->machine_error = cadr_snapshot_reader_u8(reader);
    diagnostic->single_step_done = cadr_snapshot_reader_u8(reader);
    diagnostic->running = cadr_snapshot_reader_u8(reader);
    diagnostic->write_map = cadr_snapshot_reader_u8(reader);
    diagnostic->destination_spc = cadr_snapshot_reader_u8(reader);
    diagnostic->instruction_write = cadr_snapshot_reader_u8(reader);
    diagnostic->instruction_modify = cadr_snapshot_reader_u8(reader);
    diagnostic->pdl_write = cadr_snapshot_reader_u8(reader);
    diagnostic->spc_push = cadr_snapshot_reader_u8(reader);
    diagnostic->instruction_parity = cadr_snapshot_reader_u8(reader);
    diagnostic->nop = cadr_snapshot_reader_u8(reader);
    diagnostic->vma_ok = cadr_snapshot_reader_u8(reader);
    diagnostic->jump_condition = cadr_snapshot_reader_u8(reader);
    diagnostic->next_pc_source = cadr_snapshot_reader_u8(reader);
    diagnostic->reserved0 = cadr_snapshot_reader_u8(reader);
    bus->nxm_inhibited = cadr_snapshot_reader_u8(reader);
    for (index = 0U; index < 3U; ++index) bus->reserved0[index] = cadr_snapshot_reader_u8(reader);
}

static void cadr_snapshot_decode_devices(cadr_snapshot_reader *reader,
                                         cadr_machine_state *state)
{
    cadr_device_state *devices = &state->devices;
    uint32_t index;
    devices->event_sequence = cadr_snapshot_reader_u64(reader);
    devices->initialized = cadr_snapshot_reader_u32(reader);
    devices->tv_mode = cadr_snapshot_reader_u32(reader);
    devices->tv_vert_spacing = cadr_snapshot_reader_u32(reader);
    devices->tv_sync_ptr = cadr_snapshot_reader_u32(reader);
    cadr_snapshot_reader_bytes(reader, devices->tv_sync_ram, sizeof(devices->tv_sync_ram));
    for (index = 0U; index < CADR_TV_WORDS; ++index) {
        devices->tv_screen[index] = cadr_snapshot_reader_u32(reader);
    }
    cadr_snapshot_initialize_default_disk(devices);
}

static void cadr_snapshot_decode_disk(cadr_snapshot_reader *reader,
                                      cadr_machine_state *state,
                                      uint8_t witness[CADR_SHA256_BYTES])
{
    cadr_disk_state *disk = &state->devices.disk;
    disk->pending_first_block = cadr_snapshot_reader_u64(reader);
    disk->compatibility_profile = cadr_snapshot_reader_u32(reader);
    disk->command = cadr_snapshot_reader_u32(reader);
    disk->command_list_pointer = cadr_snapshot_reader_u32(reader);
    disk->disk_address = cadr_snapshot_reader_u32(reader);
    disk->last_memory_address = cadr_snapshot_reader_u32(reader);
    disk->pending_ccw_address = cadr_snapshot_reader_u32(reader);
    disk->pending_memory_address = cadr_snapshot_reader_u32(reader);
    disk->pending_ccw = cadr_snapshot_reader_u32(reader);
    disk->status = cadr_snapshot_reader_u32(reader);
    disk->transfer_active = cadr_snapshot_reader_u32(reader);
    disk->reset_condition = cadr_snapshot_reader_u32(reader);
    disk->done_interrupt_enable = cadr_snapshot_reader_u32(reader);
    disk->attention_interrupt_enable = cadr_snapshot_reader_u32(reader);
    disk->reserved0 = cadr_snapshot_reader_u32(reader);
    cadr_snapshot_reader_bytes(reader, witness, CADR_SHA256_BYTES);
}

static void cadr_snapshot_decode_canonical(cadr_snapshot_reader *reader,
                                           cadr_machine_state *state)
{
    cadr_canonical_state *canonical = &state->canonical;
    uint32_t index;
    canonical->mutation_ordinal = cadr_snapshot_reader_u64(reader);
    canonical->first_mutation_ordinal = cadr_snapshot_reader_u64(reader);
    canonical->mutation_count = cadr_snapshot_reader_u32(reader);
    canonical->initialized = cadr_snapshot_reader_u32(reader);
    canonical->overflowed = cadr_snapshot_reader_u32(reader);
    cadr_snapshot_reader_bytes(reader, canonical->mutation_sha256,
                               sizeof(canonical->mutation_sha256));
    if (canonical->mutation_count > CADR_CANONICAL_MAX_SLOT_MUTATIONS) {
        reader->failed = 1;
        return;
    }
    for (index = 0U; index < canonical->mutation_count; ++index) {
        cadr_snapshot_reader_bytes(reader, canonical->mutation_events[index],
                                   sizeof(canonical->mutation_events[index]));
    }
}

static cadr_status cadr_snapshot_decode_events(cadr_snapshot_reader *reader,
                                               cadr_machine_state *state)
{
    cadr_event_state *events = &state->events;
    uint8_t *completion_bytes = NULL;
    events->generation = cadr_snapshot_reader_u64(reader);
    events->next_request_id = cadr_snapshot_reader_u64(reader);
    events->outstanding_request_id = cadr_snapshot_reader_u64(reader);
    events->last_completed_request_id = cadr_snapshot_reader_u64(reader);
    events->request_descriptor_byte_count = cadr_snapshot_reader_u64(reader);
    events->expected_completion_byte_count = cadr_snapshot_reader_u64(reader);
    events->completion_byte_count = cadr_snapshot_reader_u64(reader);
    events->outstanding_operation = cadr_snapshot_reader_u32(reader);
    events->completion_host_status = cadr_snapshot_reader_u32(reader);
    events->completion_queued = cadr_snapshot_reader_u32(reader);
    events->persistent_status = cadr_snapshot_reader_u32(reader);
    events->unexpected_bus_operation = cadr_snapshot_reader_u32(reader);
    events->reserved0 = cadr_snapshot_reader_u32(reader);
    if (reader->failed != 0 ||
        events->request_descriptor_byte_count > CADR_MAX_HOST_DESCRIPTOR_BYTES ||
        events->expected_completion_byte_count > CADR_SNAPSHOT_MAX_COMPLETION_BYTES ||
        events->completion_byte_count > CADR_SNAPSHOT_MAX_COMPLETION_BYTES) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (events->outstanding_request_id == 0U) {
        if (events->outstanding_operation != CADR_HOST_OPERATION_NONE ||
            events->request_descriptor_byte_count != 0U) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    } else if (!cadr_snapshot_operation_valid(events->outstanding_operation) ||
               events->request_descriptor_byte_count !=
                   cadr_snapshot_descriptor_size(events->outstanding_operation)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_snapshot_decode_descriptor(reader, events);
    if (reader->failed != 0 || events->completion_queued > 1U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (events->completion_queued != 0U && events->completion_byte_count != 0U) {
        completion_bytes = malloc((size_t)events->completion_byte_count);
        if (completion_bytes == NULL) return CADR_STATUS_NO_MEMORY;
        cadr_snapshot_reader_bytes(reader, completion_bytes, events->completion_byte_count);
        if (reader->failed != 0) {
            free(completion_bytes);
            return CADR_STATUS_INVALID_ARGUMENT;
        }
    }
    events->completion_bytes = completion_bytes;
    return CADR_STATUS_OK;
}

static void cadr_snapshot_decode_trace(cadr_snapshot_reader *reader,
                                       cadr_machine_state *state)
{
    cadr_trace_state *trace = &state->trace;
    trace->instruction_ordinal = cadr_snapshot_reader_u64(reader);
    trace->event_sequence = cadr_snapshot_reader_u64(reader);
    trace->raw_fetched_word = cadr_snapshot_reader_u64(reader);
    trace->effective_word = cadr_snapshot_reader_u64(reader);
    trace->pc = cadr_snapshot_reader_u32(reader);
    trace->store_selector = cadr_snapshot_reader_u32(reader);
    trace->operation = cadr_snapshot_reader_u32(reader);
    trace->a_address = cadr_snapshot_reader_u32(reader);
    trace->m_address = cadr_snapshot_reader_u32(reader);
    trace->a_value = cadr_snapshot_reader_u32(reader);
    trace->m_value = cadr_snapshot_reader_u32(reader);
    trace->instruction_memory = cadr_snapshot_reader_u32(reader);
    trace->functional_m_source = cadr_snapshot_reader_u32(reader);
    trace->effective_popj = cadr_snapshot_reader_u32(reader);
    trace->last_slot_executed = cadr_snapshot_reader_u32(reader);
    trace->last_slot_inhibited = cadr_snapshot_reader_u32(reader);
    trace->decoded = cadr_snapshot_reader_u32(reader);
    trace->valid_mask = cadr_snapshot_reader_u32(reader);
    trace->pre_destination = cadr_snapshot_reader_u32(reader);
    trace->pre_q = cadr_snapshot_reader_u32(reader);
    trace->pre_vma = cadr_snapshot_reader_u32(reader);
    trace->pre_md = cadr_snapshot_reader_u32(reader);
    trace->pre_macro_pc = cadr_snapshot_reader_u32(reader);
    trace->post_destination_value = cadr_snapshot_reader_u32(reader);
    trace->post_q = cadr_snapshot_reader_u32(reader);
    trace->post_vma = cadr_snapshot_reader_u32(reader);
    trace->post_md = cadr_snapshot_reader_u32(reader);
    trace->post_macro_pc = cadr_snapshot_reader_u32(reader);
    trace->post_fault = cadr_snapshot_reader_u32(reader);
    trace->post_interrupt_status = cadr_snapshot_reader_u32(reader);
    trace->post_interrupt_pending = cadr_snapshot_reader_u32(reader);
    trace->class_outcome = cadr_snapshot_reader_u32(reader);
    trace->pre_p0_pc = cadr_snapshot_reader_u32(reader);
    trace->pre_p1_pc = cadr_snapshot_reader_u32(reader);
    trace->pre_next_micro_pc = cadr_snapshot_reader_u32(reader);
    trace->pre_opc = cadr_snapshot_reader_u32(reader);
    trace->post_p0_pc = cadr_snapshot_reader_u32(reader);
    trace->post_p1_pc = cadr_snapshot_reader_u32(reader);
    trace->post_next_micro_pc = cadr_snapshot_reader_u32(reader);
    trace->post_opc = cadr_snapshot_reader_u32(reader);
    trace->m_source_kind = cadr_snapshot_reader_u32(reader);
    trace->destination_kind = cadr_snapshot_reader_u32(reader);
    trace->destination_address = cadr_snapshot_reader_u32(reader);
    trace->md_delayed_phase = cadr_snapshot_reader_u32(reader);
    trace->pre_fault = cadr_snapshot_reader_u32(reader);
    trace->fault_code = cadr_snapshot_reader_u32(reader);
    trace->pre_interrupt_status = cadr_snapshot_reader_u32(reader);
    trace->pre_interrupt_pending = cadr_snapshot_reader_u32(reader);
    trace->interrupt_level = cadr_snapshot_reader_u32(reader);
    trace->reserved0 = cadr_snapshot_reader_u32(reader);
}

void cadr_snapshot_state_destroy(cadr_machine_state *state)
{
    if (state == NULL) return;
    free(state->events.completion_bytes);
    state->events.completion_bytes = NULL;
    free(state);
}

cadr_status cadr_snapshot_parse(const uint8_t *bytes,
                                uint64_t byte_count,
                                const cadr_snapshot_restore_hooks *hooks,
                                cadr_machine_state **out_state,
                                cadr_snapshot_metadata *out_metadata)
{
    cadr_snapshot_header header;
    cadr_snapshot_directory_entry *entries = NULL;
    const cadr_snapshot_directory_entry *known_entries[CADR_SNAPSHOT_MAX_KNOWN_CHUNK_COUNT];
    cadr_machine_state *state = NULL;
    uint8_t before_rebuild[CADR_SHA256_BYTES];
    uint8_t after_rebuild[CADR_SHA256_BYTES];
    uint8_t disk_witness[CADR_SHA256_BYTES];
    uint8_t computed_disk_witness[CADR_SHA256_BYTES];
    cadr_snapshot_reader reader;
    cadr_status status;

    if (out_state != NULL) *out_state = NULL;
    if (out_metadata != NULL) (void)memset(out_metadata, 0, sizeof(*out_metadata));
    if (bytes == NULL || hooks == NULL || out_state == NULL || out_metadata == NULL ||
        hooks->rebuild_derived == NULL || hooks->validate_state == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    /* The parser's byte-addressable storage is bounded by native size_t. */
    if (byte_count > (uint64_t)SIZE_MAX) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_snapshot_parse_header(bytes, byte_count, &header);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_parse_directory(bytes, &header, &entries, known_entries);
    if (status != CADR_STATUS_OK) return status;
    state = calloc(1U, sizeof(*state));
    if (state == NULL) {
        free(entries);
        return CADR_STATUS_NO_MEMORY;
    }

    reader = cadr_snapshot_chunk_reader(bytes, known_entries[0]);
    cadr_snapshot_decode_core(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[1]);
    cadr_snapshot_decode_cpu(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[2]);
    cadr_snapshot_decode_memory(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[3]);
    cadr_snapshot_decode_bus(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[4]);
    cadr_snapshot_decode_devices(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    if (header.format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3) {
        reader = cadr_snapshot_chunk_reader(bytes, known_entries[8]);
        cadr_snapshot_decode_disk(&reader, state, disk_witness);
        status = cadr_snapshot_finish_chunk(&reader);
        if (status != CADR_STATUS_OK) goto fail;
    }
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[5]);
    cadr_snapshot_decode_canonical(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[6]);
    status = cadr_snapshot_decode_events(&reader, state);
    if (status != CADR_STATUS_OK) goto fail;
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;
    reader = cadr_snapshot_chunk_reader(bytes, known_entries[7]);
    cadr_snapshot_decode_trace(&reader, state);
    status = cadr_snapshot_finish_chunk(&reader);
    if (status != CADR_STATUS_OK) goto fail;

    if (state->profile != header.metadata.profile ||
        state->lifecycle != header.metadata.lifecycle ||
        cadr_snapshot_artifact_mask(state) != header.metadata.artifact_mask ||
        state->clock_slots_completed != header.metadata.clock_slots_completed ||
        state->cpu.microinstructions_executed !=
            header.metadata.microinstructions_executed) {
        status = CADR_STATUS_INVALID_ARGUMENT;
        goto fail;
    }
    status = cadr_snapshot_validate_state(state, header.format_minor);
    if (status != CADR_STATUS_OK) goto fail;
    status = cadr_snapshot_semantic_fingerprint(state, header.format_minor,
                                                before_rebuild);
    if (status != CADR_STATUS_OK) goto fail;
    status = hooks->rebuild_derived(state, hooks->context);
    if (status != CADR_STATUS_OK) goto fail;
    status = cadr_snapshot_semantic_fingerprint(state, header.format_minor,
                                                after_rebuild);
    if (status != CADR_STATUS_OK ||
        memcmp(before_rebuild, after_rebuild, sizeof(before_rebuild)) != 0 ||
        state->trace.engine != NULL) {
        status = CADR_STATUS_INVALID_ARGUMENT;
        goto fail;
    }
    if (header.format_minor == CADR_SNAPSHOT_FORMAT_MINOR_M3) {
        status = cadr_state_v3_digest(state, computed_disk_witness);
        if (status != CADR_STATUS_OK ||
            memcmp(disk_witness, computed_disk_witness,
                   sizeof(disk_witness)) != 0) {
            status = CADR_STATUS_ARTIFACT_MISMATCH;
            goto fail;
        }
    }
    status = hooks->validate_state(state, &header.metadata, hooks->context);
    if (status != CADR_STATUS_OK) goto fail;
    free(entries);
    *out_state = state;
    *out_metadata = header.metadata;
    return CADR_STATUS_OK;

fail:
    free(entries);
    cadr_snapshot_state_destroy(state);
    return status;
}
