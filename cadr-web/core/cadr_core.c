#include "cadr_machine.h"
#include "cadr_boundary_state.h"
#include "cadr_host_api.h"
#include "cadr_snapshot.h"
#include "cadr_state_v2.h"
#include "cadr_trace_engine.h"
#include "usim-port/cadr_bus_device.h"
#include "usim-port/cadr_processor_memory.h"

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define CADR_MAX_COMPLETION_BYTES UINT64_C(1048576)
#define CADR_M1_PREFIX_CLOCK_SLOTS UINT64_C(100000)

typedef struct cadr_sha256_context {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t block_used;
} cadr_sha256_context;

static uint32_t cadr_rotr32(const uint32_t value, const uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void cadr_sha256_transform(cadr_sha256_context *const context,
                                  const uint8_t block[64])
{
    static const uint32_t round_constants[64] = {
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
        const uint32_t byte_index = index * 4U;
        schedule[index] = ((uint32_t)block[byte_index] << 24U) |
                          ((uint32_t)block[byte_index + 1U] << 16U) |
                          ((uint32_t)block[byte_index + 2U] << 8U) |
                          (uint32_t)block[byte_index + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = cadr_rotr32(schedule[index - 15U], 7U) ^
                            cadr_rotr32(schedule[index - 15U], 18U) ^
                            (schedule[index - 15U] >> 3U);
        const uint32_t s1 = cadr_rotr32(schedule[index - 2U], 17U) ^
                            cadr_rotr32(schedule[index - 2U], 19U) ^
                            (schedule[index - 2U] >> 10U);
        schedule[index] = schedule[index - 16U] + s0 + schedule[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t sum1 = cadr_rotr32(e, 6U) ^ cadr_rotr32(e, 11U) ^ cadr_rotr32(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temporary1 = h + sum1 + choose + round_constants[index] + schedule[index];
        const uint32_t sum0 = cadr_rotr32(a, 2U) ^ cadr_rotr32(a, 13U) ^ cadr_rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary2 = sum0 + majority;
        h = g; g = f; f = e; e = d + temporary1;
        d = c; c = b; b = a; a = temporary1 + temporary2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void cadr_sha256_init(cadr_sha256_context *const context)
{
    context->state[0] = UINT32_C(0x6a09e667); context->state[1] = UINT32_C(0xbb67ae85);
    context->state[2] = UINT32_C(0x3c6ef372); context->state[3] = UINT32_C(0xa54ff53a);
    context->state[4] = UINT32_C(0x510e527f); context->state[5] = UINT32_C(0x9b05688c);
    context->state[6] = UINT32_C(0x1f83d9ab); context->state[7] = UINT32_C(0x5be0cd19);
    context->bit_count = 0U;
    context->block_used = 0U;
}

static void cadr_sha256_update(cadr_sha256_context *const context,
                               const uint8_t *bytes, uint64_t byte_count)
{
    while (byte_count != 0U) {
        const uint32_t available = UINT32_C(64) - context->block_used;
        const uint32_t take = byte_count < (uint64_t)available ? (uint32_t)byte_count : available;
        (void)memcpy(&context->block[context->block_used], bytes, take);
        context->block_used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        byte_count -= take;
        if (context->block_used == 64U) {
            cadr_sha256_transform(context, context->block);
            context->block_used = 0U;
        }
    }
}

static void cadr_sha256_final(cadr_sha256_context *const context,
                              uint8_t digest[CADR_SHA256_BYTES])
{
    uint32_t index;
    const uint64_t bit_count = context->bit_count;

    context->block[context->block_used++] = UINT8_C(0x80);
    if (context->block_used > 56U) {
        (void)memset(&context->block[context->block_used], 0, 64U - context->block_used);
        cadr_sha256_transform(context, context->block);
        context->block_used = 0U;
    }
    (void)memset(&context->block[context->block_used], 0, 56U - context->block_used);
    for (index = 0U; index < 8U; ++index) {
        context->block[63U - index] = (uint8_t)(bit_count >> (index * 8U));
    }
    cadr_sha256_transform(context, context->block);
    for (index = 0U; index < 8U; ++index) {
        digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        digest[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

static void cadr_sha256(const uint8_t *const bytes, const uint64_t byte_count,
                        uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_sha256_context context;
    cadr_sha256_init(&context);
    cadr_sha256_update(&context, bytes, byte_count);
    cadr_sha256_final(&context, digest);
}

#define CADR_FAMILY_AMEM UINT32_C(2)
#define CADR_FAMILY_MMEM UINT32_C(3)
#define CADR_FAMILY_PDL UINT32_C(5)
#define CADR_FAMILY_SPC UINT32_C(6)
#define CADR_FAMILY_L1_MAP UINT32_C(7)
#define CADR_FAMILY_L2_MAP UINT32_C(8)

static void cadr_put32(uint8_t bytes[4], uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void cadr_put64(uint8_t bytes[8], uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void cadr_tree_leaf(uint32_t family, uint32_t index, uint32_t value,
                           uint8_t digest[CADR_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRLEAF1\0";
    cadr_sha256_context context;
    uint8_t header[12];
    uint8_t encoded[4];
    cadr_put32(header, family);
    cadr_put32(header + 4U, index);
    cadr_put32(header + 8U, 4U);
    cadr_put32(encoded, value);
    cadr_sha256_init(&context);
    cadr_sha256_update(&context, domain, sizeof(domain) - 1U);
    cadr_sha256_update(&context, header, sizeof(header));
    cadr_sha256_update(&context, encoded, sizeof(encoded));
    cadr_sha256_final(&context, digest);
}

static void cadr_tree_parent(uint32_t family, uint32_t level,
                             const uint8_t left[CADR_SHA256_BYTES],
                             const uint8_t right[CADR_SHA256_BYTES],
                             uint8_t digest[CADR_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRNODE1\0";
    cadr_sha256_context context;
    uint8_t header[8];
    cadr_put32(header, family);
    cadr_put32(header + 4U, level);
    cadr_sha256_init(&context);
    cadr_sha256_update(&context, domain, sizeof(domain) - 1U);
    cadr_sha256_update(&context, header, sizeof(header));
    cadr_sha256_update(&context, left, CADR_SHA256_BYTES);
    cadr_sha256_update(&context, right, CADR_SHA256_BYTES);
    cadr_sha256_final(&context, digest);
}

static void cadr_tree_build(uint32_t family, const uint32_t *values,
                            uint32_t count, uint8_t (*nodes)[CADR_SHA256_BYTES])
{
    uint32_t index;
    uint32_t width;
    uint32_t level = 0U;
    for (index = 0U; index < count; ++index) {
        cadr_tree_leaf(family, index, values[index], nodes[count + index]);
    }
    for (width = count; width > 1U; width >>= 1U, ++level) {
        const uint32_t base = width >> 1U;
        for (index = 0U; index < base; ++index) {
            cadr_tree_parent(family, level, nodes[width + index * 2U],
                             nodes[width + index * 2U + 1U],
                             nodes[base + index]);
        }
    }
}

static uint8_t (*cadr_tree_for(cadr_machine_state *state, uint32_t family,
                               uint32_t *count,
                               const uint32_t **values))[CADR_SHA256_BYTES]
{
    switch (family) {
    case CADR_FAMILY_AMEM:
        *count = 1024U; *values = state->cpu.a_memory;
        return state->canonical.amem_nodes;
    case CADR_FAMILY_MMEM:
        *count = 32U; *values = state->cpu.m_memory;
        return state->canonical.mmem_nodes;
    case CADR_FAMILY_PDL:
        *count = 1024U; *values = state->cpu.pdl;
        return state->canonical.pdl_nodes;
    case CADR_FAMILY_SPC:
        *count = 32U; *values = state->cpu.micro_stack;
        return state->canonical.spc_nodes;
    case CADR_FAMILY_L1_MAP:
        *count = 2048U; *values = state->memory.l1_map;
        return state->canonical.l1_nodes;
    case CADR_FAMILY_L2_MAP:
        *count = 1024U; *values = state->memory.l2_map;
        return state->canonical.l2_nodes;
    default:
        *count = 0U; *values = NULL; return NULL;
    }
}

static void cadr_tree_update(cadr_machine_state *state, uint32_t family,
                             uint32_t index)
{
    uint32_t count;
    uint32_t node;
    uint32_t level = 0U;
    const uint32_t *values;
    uint8_t (*nodes)[CADR_SHA256_BYTES] =
        cadr_tree_for(state, family, &count, &values);
    if (nodes == NULL || index >= count) {
        state->canonical.overflowed = 1U;
        return;
    }
    node = count + index;
    cadr_tree_leaf(family, index, values[index], nodes[node]);
    while (node > 1U) {
        const uint32_t parent = node >> 1U;
        const uint32_t left = parent << 1U;
        cadr_tree_parent(family, level, nodes[left], nodes[left + 1U],
                         nodes[parent]);
        node = parent;
        level += 1U;
    }
}

void cadr_canonical_write_u32(cadr_machine_state *state, uint32_t family,
                              uint32_t index, uint32_t old_value,
                              uint32_t new_value)
{
    cadr_canonical_state *canonical;
    uint8_t *event;
    if (state == NULL || state->canonical.initialized == 0U) return;
    canonical = &state->canonical;
    if (canonical->mutation_count >= CADR_CANONICAL_MAX_SLOT_MUTATIONS) {
        canonical->overflowed = 1U;
        return;
    }
    event = canonical->mutation_events[canonical->mutation_count];
    cadr_put32(event, family);
    cadr_put32(event + 4U, index);
    cadr_put64(event + 8U, old_value);
    cadr_put64(event + 16U, new_value);
    cadr_put32(event + 24U, 0U);
    cadr_put32(event + 28U, 0U);
    canonical->mutation_count += 1U;
    canonical->mutation_ordinal += 1U;
    cadr_tree_update(state, family, index);
}

cadr_status cadr_canonical_rebuild(cadr_machine_state *state)
{
    uint32_t family;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    for (family = CADR_FAMILY_AMEM; family <= CADR_FAMILY_L2_MAP; ++family) {
        uint32_t count;
        const uint32_t *values;
        uint8_t (*nodes)[CADR_SHA256_BYTES] =
            cadr_tree_for(state, family, &count, &values);
        if (nodes != NULL) cadr_tree_build(family, values, count, nodes);
    }
    return CADR_STATUS_OK;
}

static void cadr_canonical_initialize(cadr_machine_state *state)
{
    static const uint8_t empty_domain[] = "CDRMUT1\0";
    cadr_canonical_state *canonical = &state->canonical;
    (void)memset(canonical, 0, sizeof(*canonical));
    (void)cadr_canonical_rebuild(state);
    cadr_sha256(empty_domain, sizeof(empty_domain) - 1U,
                canonical->mutation_sha256);
    canonical->initialized = 1U;
}

static void cadr_canonical_slot_begin(cadr_machine_state *state)
{
    state->canonical.first_mutation_ordinal =
        state->canonical.mutation_ordinal;
    state->canonical.mutation_count = 0U;
}

static void cadr_canonical_slot_end(cadr_machine_state *state)
{
    static const uint8_t domain[] = "CDRMUT1\0";
    cadr_sha256_context context;
    uint32_t index;
    cadr_sha256_init(&context);
    cadr_sha256_update(&context, domain, sizeof(domain) - 1U);
    for (index = 0U; index < state->canonical.mutation_count; ++index) {
        cadr_sha256_update(&context, state->canonical.mutation_events[index],
                           sizeof(state->canonical.mutation_events[index]));
    }
    cadr_sha256_final(&context, state->canonical.mutation_sha256);
}

typedef struct cadr_profile_artifact {
    uint32_t kind;
    uint64_t byte_count;
    uint8_t sha256[CADR_SHA256_BYTES];
} cadr_profile_artifact;

static const cadr_profile_artifact cadr_profile_artifacts[] = {
    { CADR_ARTIFACT_BOOT_CONFIGURATION, UINT64_C(854),
      { 0x1c,0xfd,0x4c,0xb6,0xf8,0xeb,0xe3,0x90,0xa5,0x27,0xf6,0xc8,0x70,0xfa,0xd5,0x1b,
        0x53,0xd1,0xe4,0x89,0x7c,0xee,0x43,0x71,0xbb,0xfc,0x2a,0xe8,0xbb,0xa3,0x8e,0x2f } },
    { CADR_ARTIFACT_CONTROL_STORE, UINT64_C(20480),
      { 0x2c,0x66,0x7f,0x99,0xf0,0x14,0xa7,0x13,0x0a,0x55,0xb2,0x55,0xd3,0x1d,0xf0,0x25,
        0x88,0xd9,0x39,0x6b,0xea,0xce,0x78,0xab,0xfe,0x93,0x25,0x26,0x9e,0x4f,0xf3,0xe6 } },
    { CADR_ARTIFACT_BASE_DISK, UINT64_C(269562880),
      { 0xbb,0x16,0xe4,0x6a,0xd8,0x1d,0xec,0xfe,0x1e,0xfe,0x69,0x1d,0x36,0xb6,0xaa,0x4c,
        0xe3,0xfd,0x4f,0xfb,0x82,0x47,0x43,0x65,0xde,0x35,0x20,0x98,0x9d,0x39,0x7c,0xb5 } },
    { CADR_ARTIFACT_PROM_SYMBOLS, UINT64_C(3130),
      { 0xe9,0xe3,0xdd,0x6a,0x54,0x15,0x11,0xdd,0x95,0x41,0xae,0x96,0xb9,0x9d,0xae,0x19,
        0xcb,0x18,0x5d,0x8b,0x79,0xfa,0x09,0x95,0x9f,0x21,0xfa,0x52,0x22,0x4f,0x23,0x3d } },
    { CADR_ARTIFACT_MICROCODE_SYMBOLS, UINT64_C(83270),
      { 0x90,0x71,0xde,0xcf,0x16,0xfa,0x8f,0x11,0xd7,0x97,0x0c,0x46,0x62,0xdb,0x0d,0x6e,
        0x95,0x60,0x0f,0xe4,0x3e,0xc8,0x6a,0xc4,0x1c,0x77,0xb3,0x7d,0xbd,0x7c,0xaa,0x2a } }
};

static const uint8_t cadr_selected_profile_sha256[CADR_SHA256_BYTES] = {
    0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
    0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
    0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
    0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
};

static const uint8_t cadr_selected_artifact_set_sha256[CADR_SHA256_BYTES] = {
    0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
    0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
    0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
    0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
};

static cadr_status cadr_validate_record(uint32_t abi_major, uint32_t abi_minor,
                                        uint32_t struct_size, size_t minimum_size)
{
    if (abi_major != CADR_ABI_MAJOR) return CADR_STATUS_ABI_MISMATCH;
    if (abi_minor > CADR_ABI_MINOR) return CADR_STATUS_ABI_MISMATCH;
    return (size_t)struct_size < minimum_size
        ? CADR_STATUS_INVALID_ARGUMENT : CADR_STATUS_OK;
}

static cadr_status cadr_validate_m2_record(uint32_t abi_major,
                                           uint32_t abi_minor,
                                           uint32_t struct_size,
                                           size_t minimum_size)
{
    cadr_status status = cadr_validate_record(abi_major, abi_minor, struct_size,
                                               minimum_size);
    if (status != CADR_STATUS_OK) return status;
    return abi_minor < CADR_ABI_MINOR_M2
        ? CADR_STATUS_ABI_MISMATCH : CADR_STATUS_OK;
}

static const cadr_profile_artifact *cadr_profile_artifact_for(uint32_t kind)
{
    size_t index;
    for (index = 0U;
         index < sizeof(cadr_profile_artifacts) / sizeof(cadr_profile_artifacts[0]);
         ++index) {
        if (cadr_profile_artifacts[index].kind == kind) {
            return &cadr_profile_artifacts[index];
        }
    }
    return NULL;
}

static uint32_t cadr_read16le(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U);
}

static uint32_t cadr_read32pdp(const uint8_t *bytes)
{
    return ((uint32_t)bytes[1] << 24U) | ((uint32_t)bytes[0] << 16U) |
           ((uint32_t)bytes[3] << 8U) | (uint32_t)bytes[2];
}

static cadr_status cadr_load_prom(cadr_machine *machine, const uint8_t *bytes,
                                  uint64_t byte_count)
{
    uint32_t code;
    uint32_t start;
    uint32_t count;
    uint32_t index;
    if (byte_count < UINT64_C(12)) return CADR_STATUS_ARTIFACT_MISMATCH;
    code = cadr_read32pdp(bytes);
    start = cadr_read32pdp(bytes + 4U);
    count = cadr_read32pdp(bytes + 8U);
    if (code != 1U || start > 512U || count > 512U - start ||
        UINT64_C(12) + (uint64_t)count * UINT64_C(8) > byte_count) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    (void)memset(machine->state.memory.prom, 0,
                 sizeof(machine->state.memory.prom));
    for (index = 0U; index < count; ++index) {
        const uint8_t *word = bytes + 12U + (size_t)index * 8U;
        machine->state.memory.prom[start + index] =
            ((uint64_t)cadr_read16le(word) << 48U) |
            ((uint64_t)cadr_read16le(word + 2U) << 32U) |
            ((uint64_t)cadr_read16le(word + 4U) << 16U) |
            (uint64_t)cadr_read16le(word + 6U);
    }
    return CADR_STATUS_OK;
}

static int cadr_valid_operation(uint32_t operation)
{
    return operation >= CADR_HOST_OPERATION_BLOCK_READ &&
           operation <= CADR_HOST_OPERATION_NETWORK;
}

static uint64_t cadr_descriptor_size(uint32_t operation)
{
    switch (operation) {
    case CADR_HOST_OPERATION_BLOCK_READ: return sizeof(cadr_block_read_descriptor);
    case CADR_HOST_OPERATION_BLOCK_WRITE: return sizeof(cadr_block_write_descriptor);
    case CADR_HOST_OPERATION_PRESENT: return sizeof(cadr_present_descriptor);
    case CADR_HOST_OPERATION_AUDIO: return sizeof(cadr_audio_descriptor);
    case CADR_HOST_OPERATION_NETWORK: return sizeof(cadr_network_descriptor);
    default: return 0U;
    }
}

static void cadr_discard_completion(cadr_machine *machine)
{
    free(machine->state.events.completion_bytes);
    machine->state.events.completion_bytes = NULL;
    machine->state.events.completion_byte_count = 0U;
    machine->state.events.completion_queued = 0U;
    machine->state.events.completion_host_status = CADR_HOST_RESULT_OK;
}

static void cadr_invalidate_requests(cadr_machine *machine)
{
    cadr_discard_completion(machine);
    machine->state.events.outstanding_request_id = 0U;
    machine->state.events.last_completed_request_id = 0U;
    machine->state.events.request_descriptor_byte_count = 0U;
    machine->state.events.expected_completion_byte_count = 0U;
    machine->state.events.outstanding_operation = CADR_HOST_OPERATION_NONE;
}

static void cadr_update_diagnostic_latches(cadr_machine *machine)
{
    cadr_diagnostic_latches latches;
    (void)memset(&latches, 0, sizeof(latches));
    latches.instruction = machine->state.cpu.p0;
    latches.debug_instruction = machine->state.cpu.debug_ir;
    latches.opc = machine->state.cpu.opc;
    latches.next_micro_pc = machine->state.cpu.next_micro_pc;
    latches.output_bus = machine->state.cpu.out;
    latches.m_source = machine->state.cpu.decoded_m_data;
    latches.a_source = machine->state.cpu.decoded_a_data;
    latches.running = machine->state.lifecycle == CADR_MACHINE_RUNNING ? 1U : 0U;
    latches.vma_ok = machine->state.cpu.vma_ok;
    cadr_diagnostic_set_latches(&machine->state, &latches);
}

static cadr_status cadr_guarded_bus_read(cadr_machine_state *state,
                                         uint32_t paddr, uint32_t *value)
{
    (void)paddr;
    if (value != NULL) *value = 0U;
    state->events.unexpected_bus_operation = 1U;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

static cadr_status cadr_guarded_bus_write(cadr_machine_state *state,
                                          uint32_t paddr, uint32_t value)
{
    (void)paddr;
    (void)value;
    state->events.unexpected_bus_operation = 1U;
    return CADR_STATUS_UNIMPLEMENTED_DEVICE;
}

void cadr_get_abi_info(cadr_abi_info *out_info)
{
    if (out_info == NULL) return;
    out_info->abi_major = CADR_ABI_MAJOR;
    out_info->abi_minor = CADR_ABI_MINOR;
    out_info->struct_size = (uint32_t)sizeof(*out_info);
    out_info->reserved0 = 0U;
}

cadr_status cadr_machine_create(const cadr_machine_config *config,
                                cadr_machine **out_machine)
{
    cadr_machine *machine;
    cadr_status status;
    if (config == NULL || out_machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_machine = NULL;
    status = cadr_validate_record(config->abi_major, config->abi_minor,
                                  config->struct_size, sizeof(*config));
    if (status != CADR_STATUS_OK) return status;
    if (config->flags != 0U || config->reserved0 != 0U ||
        config->profile != CADR_PROFILE_CADR_WEB_303) {
        return CADR_STATUS_PROFILE_MISMATCH;
    }
    machine = calloc(1U, sizeof(*machine));
    if (machine == NULL) return CADR_STATUS_NO_MEMORY;
    machine->state.profile = config->profile;
    machine->state.lifecycle = CADR_MACHINE_COLD;
    machine->state.events.generation = UINT64_C(1);
    machine->state.events.next_request_id = UINT64_C(1);
    cadr_processor_memory_set_main_memory_pages(&machine->state, 8192U);
    /*
     * CDRSTATE2 is an M2-derived cache.  Keep a newly created M1 machine
     * cheap and construct the full-RAM Merkle cache only at an M2 boundary
     * that needs it (trace start, snapshot, or restore).
     */
    *out_machine = machine;
    return CADR_STATUS_OK;
}

void cadr_machine_destroy(cadr_machine *machine)
{
    if (machine == NULL) return;
    cadr_trace_engine_stop(&machine->state);
    cadr_discard_completion(machine);
    free(machine);
}

cadr_status cadr_machine_import_artifact(cadr_machine *machine,
                                         const cadr_artifact_ingress *ingress,
                                         const uint8_t *bytes,
                                         uint64_t byte_count)
{
    const cadr_profile_artifact *expected;
    cadr_status status;
    uint8_t digest[CADR_SHA256_BYTES];
    if (machine == NULL || ingress == NULL ||
        (byte_count != 0U && bytes == NULL) || byte_count > (uint64_t)SIZE_MAX) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_validate_record(ingress->abi_major, ingress->abi_minor,
                                  ingress->struct_size, sizeof(*ingress));
    if (status != CADR_STATUS_OK) return status;
    if (machine->state.lifecycle != CADR_MACHINE_COLD ||
        ingress->byte_count != byte_count) return CADR_STATUS_INVALID_ARGUMENT;
    if (cadr_trace_engine_active(&machine->state)) return CADR_STATUS_NOT_READY;
    expected = cadr_profile_artifact_for(ingress->artifact_kind);
    if (expected == NULL) return CADR_STATUS_PROFILE_MISMATCH;
    if (expected->byte_count != byte_count) return CADR_STATUS_ARTIFACT_MISMATCH;
    cadr_sha256(bytes, byte_count, digest);
    if (memcmp(digest, expected->sha256, CADR_SHA256_BYTES) != 0) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    /* Artifact ingress can bulk-replace a logical root. */
    cadr_state_v2_invalidate(&machine->state);
    switch (ingress->artifact_kind) {
    case CADR_ARTIFACT_BOOT_CONFIGURATION:
        machine->state.artifacts.boot_configuration_ingressed = 1U;
        break;
    case CADR_ARTIFACT_CONTROL_STORE:
        status = cadr_load_prom(machine, bytes, byte_count);
        if (status != CADR_STATUS_OK) return status;
        machine->state.artifacts.control_store_ingressed = 1U;
        break;
    case CADR_ARTIFACT_BASE_DISK:
        machine->state.artifacts.base_disk_verified = 1U;
        break;
    case CADR_ARTIFACT_PROM_SYMBOLS:
        machine->state.artifacts.prom_symbols_verified = 1U;
        break;
    case CADR_ARTIFACT_MICROCODE_SYMBOLS:
        machine->state.artifacts.microcode_symbols_verified = 1U;
        break;
    default:
        return CADR_STATUS_PROFILE_MISMATCH;
    }
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_cold_power_on(cadr_machine *machine)
{
    if (machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (machine->state.lifecycle != CADR_MACHINE_COLD ||
        machine->state.artifacts.boot_configuration_ingressed == 0U ||
        machine->state.artifacts.control_store_ingressed == 0U ||
        machine->state.artifacts.base_disk_verified == 0U) {
        return CADR_STATUS_NOT_READY;
    }
    if (cadr_trace_engine_active(&machine->state)) return CADR_STATUS_NOT_READY;
    cadr_state_v2_invalidate(&machine->state);
    cadr_invalidate_requests(machine);
    machine->state.events.persistent_status = CADR_STATUS_OK;
    machine->state.cpu.microinstructions_executed = 0U;
    machine->state.clock_slots_completed = 0U;
    cadr_processor_memory_reset(&machine->state);
    cadr_bus_device_cold_power_on(&machine->state);
    machine->state.lifecycle = CADR_MACHINE_POWERED;
    cadr_update_diagnostic_latches(machine);
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_boot(cadr_machine *machine)
{
    if (machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (machine->state.lifecycle != CADR_MACHINE_POWERED) return CADR_STATUS_NOT_READY;
    if (cadr_trace_engine_active(&machine->state)) return CADR_STATUS_NOT_READY;
    cadr_state_v2_invalidate(&machine->state);
    cadr_processor_memory_boot(&machine->state);
    cadr_canonical_initialize(&machine->state);
    machine->state.lifecycle = CADR_MACHINE_RUNNING;
    cadr_update_diagnostic_latches(machine);
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_reset(cadr_machine *machine,
                               const cadr_reset_request *request)
{
    cadr_status status;
    if (machine == NULL || request == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_validate_record(request->abi_major, request->abi_minor,
                                  request->struct_size, sizeof(*request));
    if (status != CADR_STATUS_OK) return status;
    if (request->flags != 0U || machine->state.lifecycle == CADR_MACHINE_COLD ||
        machine->state.events.generation == UINT64_MAX) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (cadr_trace_engine_active(&machine->state)) return CADR_STATUS_NOT_READY;
    cadr_state_v2_invalidate(&machine->state);
    cadr_invalidate_requests(machine);
    machine->state.events.generation += UINT64_C(1);
    machine->state.events.persistent_status = CADR_STATUS_OK;
    cadr_processor_memory_reset(&machine->state);
    machine->state.lifecycle = CADR_MACHINE_POWERED;
    cadr_update_diagnostic_latches(machine);
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_issue_host_request(cadr_machine *machine,
                                            uint32_t operation,
                                            const uint8_t *descriptor_bytes,
                                            uint64_t descriptor_byte_count,
                                            uint64_t completion_byte_count)
{
    uint64_t required = cadr_descriptor_size(operation);
    uint8_t descriptor_sha256[CADR_SHA256_BYTES];
    uint64_t request_id;
    cadr_status status;
    if (machine == NULL || !cadr_valid_operation(operation) ||
        descriptor_byte_count != required ||
        descriptor_byte_count > CADR_MAX_HOST_DESCRIPTOR_BYTES ||
        completion_byte_count > CADR_MAX_COMPLETION_BYTES ||
        (descriptor_byte_count != 0U && descriptor_bytes == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (machine->state.lifecycle != CADR_MACHINE_RUNNING ||
        machine->state.events.persistent_status != CADR_STATUS_OK) {
        return CADR_STATUS_NOT_READY;
    }
    if (machine->state.events.outstanding_request_id != 0U ||
        machine->state.events.completion_queued != 0U ||
        machine->state.events.next_request_id == UINT64_MAX) {
        return CADR_STATUS_WAITING_FOR_HOST;
    }
    cadr_sha256(descriptor_bytes, descriptor_byte_count, descriptor_sha256);
    status = cadr_trace_engine_preflight_event(&machine->state,
                                               CADR_TRACE_EVENT_DEVICE);
    if (status != CADR_STATUS_OK) return status;
    request_id = machine->state.events.next_request_id;
    (void)memcpy(machine->state.events.request_descriptor, descriptor_bytes,
                 (size_t)descriptor_byte_count);
    machine->state.events.request_descriptor_byte_count = descriptor_byte_count;
    machine->state.events.outstanding_request_id = machine->state.events.next_request_id++;
    machine->state.events.outstanding_operation = operation;
    machine->state.events.expected_completion_byte_count = completion_byte_count;
    cadr_state_v2_note_completion_changed(&machine->state);
    status = cadr_trace_engine_record_device_request_issue(
        &machine->state, operation, CADR_STATUS_OK,
        machine->state.events.generation, request_id, descriptor_sha256,
        descriptor_byte_count, completion_byte_count);
    if (status != CADR_STATUS_OK) {
        machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
        return CADR_STATUS_GUEST_FAULT;
    }
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_next_host_request(cadr_machine *machine,
                                           cadr_host_request *out_request,
                                           uint8_t *descriptor_bytes,
                                           uint64_t descriptor_capacity)
{
    cadr_status status;
    uint64_t needed;
    uint32_t requested_minor;
    if (machine == NULL || out_request == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    requested_minor = out_request->abi_minor;
    status = cadr_validate_record(out_request->abi_major, out_request->abi_minor,
                                  out_request->struct_size, sizeof(*out_request));
    if (status != CADR_STATUS_OK) return status;
    if (machine->state.events.outstanding_request_id == 0U ||
        machine->state.events.completion_queued != 0U) return CADR_STATUS_NOT_READY;
    needed = machine->state.events.request_descriptor_byte_count;
    if (descriptor_capacity < needed || (needed != 0U && descriptor_bytes == NULL) ||
        descriptor_capacity > (uint64_t)SIZE_MAX) {
        return CADR_STATUS_WRONG_LENGTH;
    }
    (void)memcpy(descriptor_bytes, machine->state.events.request_descriptor,
                 (size_t)needed);
    out_request->abi_major = CADR_ABI_MAJOR;
    out_request->abi_minor = requested_minor;
    out_request->struct_size = (uint32_t)sizeof(*out_request);
    out_request->operation = machine->state.events.outstanding_operation;
    out_request->generation = machine->state.events.generation;
    out_request->request_id = machine->state.events.outstanding_request_id;
    out_request->descriptor_byte_count = needed;
    out_request->completion_byte_count =
        machine->state.events.expected_completion_byte_count;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_rejected_completion(
    cadr_machine *machine, const cadr_host_completion *completion,
    const uint8_t *bytes, uint64_t byte_count, cadr_status rejection)
{
    uint8_t completion_sha256[CADR_SHA256_BYTES];
    cadr_status status;
    /*
     * Malformed ABI records are outside the trace model.  A semantic
     * rejection is recordable only when every field needed by the normalized
     * code-4 payload has a valid representation and the declared payload
     * length agrees with the bytes supplied by the caller.
     */
    if (!cadr_valid_operation(completion->operation) ||
        (completion->host_status != CADR_HOST_RESULT_OK &&
         completion->host_status != CADR_HOST_RESULT_FAILED) ||
        completion->generation == 0U || completion->request_id == 0U ||
        completion->completion_byte_count != byte_count) {
        return rejection;
    }
    cadr_sha256(bytes, byte_count, completion_sha256);
    status = cadr_trace_engine_preflight_event(&machine->state,
                                               CADR_TRACE_EVENT_DEVICE);
    if (status != CADR_STATUS_OK) return status;
    machine->state.in_host_completion = 0U;
    status = cadr_trace_engine_record_device_completion(
        &machine->state, 4U, completion->operation, completion->host_status,
        (uint32_t)rejection, completion->generation, completion->request_id,
        completion_sha256, byte_count);
    if (status != CADR_STATUS_OK) {
        machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
        return CADR_STATUS_GUEST_FAULT;
    }
    return rejection;
}

cadr_status cadr_machine_complete_host_request(cadr_machine *machine,
                                               const cadr_host_completion *completion,
                                               const uint8_t *bytes,
                                               uint64_t byte_count)
{
    cadr_status status;
    uint8_t *copy = NULL;
    uint8_t completion_sha256[CADR_SHA256_BYTES];
    uint32_t record_rejection = 0U;
    if (machine == NULL || completion == NULL ||
        (byte_count != 0U && bytes == NULL) || byte_count > (uint64_t)SIZE_MAX) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (machine->state.in_host_completion != 0U) return CADR_STATUS_REENTRANT;
    status = cadr_validate_record(completion->abi_major, completion->abi_minor,
                                  completion->struct_size, sizeof(*completion));
    if (status != CADR_STATUS_OK) return status;
    if (completion->reserved0 != 0U) return CADR_STATUS_INVALID_ARGUMENT;
    machine->state.in_host_completion = 1U;
    if ((completion->host_status != CADR_HOST_RESULT_OK &&
         completion->host_status != CADR_HOST_RESULT_FAILED) ||
        completion->completion_byte_count != byte_count) {
        status = CADR_STATUS_INVALID_ARGUMENT;
        goto done;
    }
    if (completion->generation != machine->state.events.generation) {
        status = CADR_STATUS_STALE_GENERATION;
        record_rejection = 1U;
        goto done;
    }
    if (completion->request_id <= machine->state.events.last_completed_request_id ||
        (machine->state.events.completion_queued != 0U &&
         completion->request_id == machine->state.events.outstanding_request_id &&
         completion->operation == machine->state.events.outstanding_operation)) {
        status = CADR_STATUS_DUPLICATE_COMPLETION;
        record_rejection = 1U;
        goto done;
    }
    if (machine->state.events.outstanding_request_id == 0U ||
        completion->request_id != machine->state.events.outstanding_request_id ||
        completion->operation != machine->state.events.outstanding_operation) {
        status = CADR_STATUS_WRONG_COMPLETION;
        record_rejection = 1U;
        goto done;
    }
    if (byte_count != machine->state.events.expected_completion_byte_count) {
        status = CADR_STATUS_WRONG_LENGTH;
        record_rejection = 1U;
        goto done;
    }
    if (byte_count != 0U) {
        copy = malloc((size_t)byte_count);
        if (copy == NULL) {
            status = CADR_STATUS_NO_MEMORY;
            goto done;
        }
        (void)memcpy(copy, bytes, (size_t)byte_count);
    }
    cadr_sha256(bytes, byte_count, completion_sha256);
    status = cadr_trace_engine_preflight_event(&machine->state,
                                               CADR_TRACE_EVENT_DEVICE);
    if (status != CADR_STATUS_OK) {
        free(copy);
        goto done;
    }
    machine->state.events.completion_bytes = copy;
    machine->state.events.completion_byte_count = byte_count;
    machine->state.events.completion_host_status = completion->host_status;
    machine->state.events.completion_queued = 1U;
    cadr_state_v2_note_completion_changed(&machine->state);
    /*
     * The reentrancy guard is operational call state, not a stable machine
     * boundary.  Clear it before hashing the accepted completion so the event
     * witnesses the state visible when this API returns.
     */
    machine->state.in_host_completion = 0U;
    status = cadr_trace_engine_record_device_completion(
        &machine->state, 2U, completion->operation, completion->host_status,
        CADR_STATUS_OK, completion->generation, completion->request_id,
        completion_sha256, byte_count);
    if (status != CADR_STATUS_OK) {
        machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
        status = CADR_STATUS_GUEST_FAULT;
    }
done:
    if (record_rejection != 0U) {
        status = cadr_trace_rejected_completion(machine, completion, bytes,
                                                 byte_count, status);
    }
    machine->state.in_host_completion = 0U;
    return status;
}

static cadr_status cadr_apply_completion(cadr_machine *machine)
{
    cadr_status status = machine->state.events.completion_host_status ==
        CADR_HOST_RESULT_FAILED ? CADR_STATUS_HOST_FAILURE
                                : CADR_STATUS_UNIMPLEMENTED_DEVICE;
    const uint32_t operation = machine->state.events.outstanding_operation;
    const uint32_t result = machine->state.events.completion_host_status;
    const uint64_t generation = machine->state.events.generation;
    const uint64_t request_id = machine->state.events.outstanding_request_id;
    const uint64_t byte_count = machine->state.events.completion_byte_count;
    uint8_t completion_sha256[CADR_SHA256_BYTES];
    cadr_status trace_status;
    cadr_sha256(machine->state.events.completion_bytes, byte_count,
                completion_sha256);
    machine->state.events.last_completed_request_id =
        machine->state.events.outstanding_request_id;
    cadr_discard_completion(machine);
    machine->state.events.outstanding_request_id = 0U;
    machine->state.events.request_descriptor_byte_count = 0U;
    machine->state.events.expected_completion_byte_count = 0U;
    machine->state.events.outstanding_operation = CADR_HOST_OPERATION_NONE;
    machine->state.events.persistent_status = status;
    cadr_state_v2_note_completion_changed(&machine->state);
    trace_status = cadr_trace_engine_record_device_completion(
        &machine->state, 3U, operation, result, status, generation, request_id,
        completion_sha256, byte_count);
    if (trace_status != CADR_STATUS_OK) {
        machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
        return CADR_STATUS_GUEST_FAULT;
    }
    return status;
}

cadr_status cadr_machine_run(cadr_machine *machine,
                             const cadr_run_request *request,
                             cadr_run_result *out_result)
{
    const cadr_processor_memory_bus guarded_bus = {
        cadr_guarded_bus_read, cadr_guarded_bus_write
    };
    cadr_status status;
    uint64_t before_micro;
    uint64_t slots;
    uint32_t requested_minor;
    if (machine == NULL || request == NULL || out_result == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    requested_minor = out_result->abi_minor;
    status = cadr_validate_record(request->abi_major, request->abi_minor,
                                  request->struct_size, sizeof(*request));
    if (status != CADR_STATUS_OK) return status;
    status = cadr_validate_record(out_result->abi_major, out_result->abi_minor,
                                  out_result->struct_size, sizeof(*out_result));
    if (status != CADR_STATUS_OK) return status;
    if (request->reserved0 != 0U) return CADR_STATUS_INVALID_ARGUMENT;
    if (request->clock_slot_budget == 0U) return CADR_STATUS_INVALID_ARGUMENT;
    if (machine->state.clock_slots_completed > CADR_M1_PREFIX_CLOCK_SLOTS ||
        request->clock_slot_budget >
            CADR_M1_PREFIX_CLOCK_SLOTS -
                machine->state.clock_slots_completed) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    out_result->abi_major = CADR_ABI_MAJOR;
    out_result->abi_minor = requested_minor;
    out_result->struct_size = (uint32_t)sizeof(*out_result);
    out_result->clock_slots_completed = 0U;
    out_result->microinstructions_executed = 0U;
    out_result->completions_applied = 0U;
    out_result->reserved0 = 0U;
    if (machine->state.events.persistent_status != CADR_STATUS_OK) {
        out_result->terminal_status = machine->state.events.persistent_status;
        return out_result->terminal_status;
    }
    if (machine->state.lifecycle != CADR_MACHINE_RUNNING) {
        out_result->terminal_status = CADR_STATUS_NOT_READY;
        return CADR_STATUS_NOT_READY;
    }
    if (machine->state.events.outstanding_request_id != 0U &&
        machine->state.events.completion_queued == 0U) {
        out_result->terminal_status = CADR_STATUS_WAITING_FOR_HOST;
        return CADR_STATUS_WAITING_FOR_HOST;
    }
    if (machine->state.events.completion_queued != 0U) {
        status = cadr_trace_engine_preflight_event(&machine->state,
                                                   CADR_TRACE_EVENT_DEVICE);
        if (status != CADR_STATUS_OK) {
            out_result->terminal_status = status;
            return status;
        }
        status = cadr_apply_completion(machine);
        out_result->completions_applied = 1U;
        out_result->terminal_status = status;
        return status;
    }
    before_micro = machine->state.cpu.microinstructions_executed;
    status = CADR_STATUS_OK;
    for (slots = 0U; slots < request->clock_slot_budget; ++slots) {
        uint32_t old_interrupt_control;
        uint64_t tick_before;
        uint32_t interrupt_before;
        uint32_t fault_before;
        uint32_t halt_before;
        uint16_t boundary_flags;
        cadr_trace_slot_events slot_events;
        if (machine->state.clock_slots_completed == UINT64_MAX ||
            machine->state.cpu.microinstructions_executed == UINT64_MAX) {
            machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
            break;
        }
        tick_before = machine->state.bus.guest_tick;
        interrupt_before = machine->state.bus.interrupt_status;
        fault_before = machine->state.cpu.guest_fault;
        halt_before = machine->state.cpu.halted;
        status = cadr_trace_engine_slot_preflight(&machine->state);
        if (status != CADR_STATUS_OK) break;
        machine->state.cpu.interrupt_pending = machine->state.bus.interrupt_pending;
        machine->state.cpu.debug_ir = cadr_diagnostic_debug_instruction(&machine->state);
        machine->state.trace.raw_fetched_word =
            machine->state.cpu.p1 & UINT64_C(0x0000ffffffffffff);
        machine->state.trace.pc = machine->state.cpu.p1_pc;
        machine->state.trace.store_selector =
            machine->state.cpu.p1_imem != 0U ? 1U : 0U;
        machine->state.trace.instruction_memory =
            machine->state.cpu.p1_imem != 0U ? 1U : 0U;
        machine->state.trace.operation = 0U;
        machine->state.trace.a_address = 0U;
        machine->state.trace.m_address = 0U;
        machine->state.trace.a_value = 0U;
        machine->state.trace.m_value = 0U;
        machine->state.trace.functional_m_source = 0U;
        machine->state.trace.effective_popj = 0U;
        machine->state.trace.decoded = 0U;
        machine->state.trace.last_slot_inhibited =
            machine->state.cpu.inhibit != 0U ? 1U : 0U;
        machine->state.events.unexpected_bus_operation = 0U;
        old_interrupt_control = machine->state.cpu.interrupt_control;
        cadr_canonical_slot_begin(&machine->state);
        cadr_processor_memory_step_with_bus(&machine->state, &guarded_bus);
        cadr_canonical_slot_end(&machine->state);
        machine->state.trace.effective_word =
            machine->state.cpu.p0 & UINT64_C(0x0000ffffffffffff);
        machine->state.trace.last_slot_executed =
            machine->state.trace.last_slot_inhibited == 0U ? 1U : 0U;
        if (machine->state.trace.last_slot_executed != 0U) {
            machine->state.trace.operation = machine->state.cpu.decoded_class;
            machine->state.trace.a_address =
                machine->state.cpu.decoded_a_address;
            machine->state.trace.m_address =
                machine->state.cpu.decoded_m_address;
            machine->state.trace.a_value =
                machine->state.cpu.decoded_a_data;
            machine->state.trace.m_value =
                machine->state.cpu.decoded_initial_m_data;
            machine->state.trace.functional_m_source =
                (uint32_t)((machine->state.cpu.p0 >> 31U) & UINT64_C(1));
            machine->state.trace.effective_popj =
                machine->state.cpu.effective_popj;
            machine->state.trace.decoded = 1U;
        }
        machine->state.clock_slots_completed += 1U;
        machine->state.trace.instruction_ordinal =
            machine->state.cpu.microinstructions_executed;
        if (machine->state.cpu.interrupt_control != old_interrupt_control) {
            cadr_bus_processor_interrupt_control_written(
                &machine->state, machine->state.cpu.interrupt_control);
        }
        cadr_update_diagnostic_latches(machine);
        out_result->clock_slots_completed += 1U;
        boundary_flags = machine->state.trace.last_slot_inhibited != 0U
            ? CADR_TRACE_BOUNDARY_INHIBITED : CADR_TRACE_BOUNDARY_EXECUTED;
        if (machine->state.cpu.halted != 0U) {
            boundary_flags = (uint16_t)(boundary_flags | CADR_TRACE_BOUNDARY_HALT);
        }
        /*
         * Terminal slot status is part of the machine state witnessed by the
         * boundary and its events.  Classify it before closing the compound
         * trace slot so the following terminal record observes the same final
         * state instead of a host-status mutation made between records.
         */
        if (machine->state.events.unexpected_bus_operation != 0U) {
            machine->state.events.persistent_status =
                CADR_STATUS_UNIMPLEMENTED_DEVICE;
        } else if (machine->state.canonical.overflowed != 0U ||
                   machine->state.cpu.guest_fault != 0U) {
            machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
            machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
        } else if (machine->state.cpu.halted != 0U) {
            machine->state.events.persistent_status = CADR_STATUS_HALTED;
        }
        status = cadr_trace_engine_record_boundary(&machine->state,
                                                   boundary_flags);
        if (status == CADR_STATUS_OK) {
            (void)memset(&slot_events, 0, sizeof(slot_events));
            slot_events.clock_present =
                machine->state.bus.guest_tick != tick_before ? 1U : 0U;
            if (slot_events.clock_present != 0U) {
                slot_events.tick_before = tick_before;
                slot_events.tick_after = machine->state.bus.guest_tick;
                slot_events.clock_decision = 1U;
            }
            slot_events.interrupt_present =
                machine->state.bus.interrupt_status != interrupt_before
                    ? 1U : 0U;
            if (slot_events.interrupt_present != 0U) {
                slot_events.interrupt_before = interrupt_before;
                slot_events.interrupt_after =
                    machine->state.bus.interrupt_status;
                slot_events.interrupt_level =
                    slot_events.interrupt_after & UINT32_C(01774);
                slot_events.interrupt_pending =
                    (slot_events.interrupt_after & UINT32_C(0140000)) != 0U
                        ? 1U : 0U;
            }
            slot_events.fault_present =
                machine->state.cpu.guest_fault != fault_before ? 1U : 0U;
            if (slot_events.fault_present != 0U) {
                slot_events.fault_before = fault_before;
                slot_events.fault_after = machine->state.cpu.guest_fault;
                slot_events.fault_code = slot_events.fault_after;
                slot_events.fault_value_valid = 1U;
            }
            slot_events.halt_present =
                machine->state.cpu.halted != halt_before ? 1U : 0U;
            if (slot_events.halt_present != 0U) {
                slot_events.halt_code = CADR_STATUS_HALTED;
            }
            status = cadr_trace_engine_slot_close(&machine->state,
                                                  &slot_events);
        }
        if (status != CADR_STATUS_OK) {
            machine->state.lifecycle = CADR_MACHINE_GUEST_FAULTED;
            machine->state.events.persistent_status = CADR_STATUS_GUEST_FAULT;
            status = CADR_STATUS_GUEST_FAULT;
            break;
        }
        if (machine->state.events.persistent_status != CADR_STATUS_OK) break;
    }
    out_result->microinstructions_executed =
        machine->state.cpu.microinstructions_executed - before_micro;
    if (machine->state.events.persistent_status != CADR_STATUS_OK) {
        status = machine->state.events.persistent_status;
    }
    out_result->terminal_status = status;
    return status;
}

cadr_status cadr_machine_query(cadr_machine *machine, cadr_machine_info *out_info)
{
    cadr_status status;
    uint32_t requested_minor;
    if (machine == NULL || out_info == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    requested_minor = out_info->abi_minor;
    status = cadr_validate_record(out_info->abi_major, out_info->abi_minor,
                                  out_info->struct_size, sizeof(*out_info));
    if (status != CADR_STATUS_OK) return status;
    out_info->abi_major = CADR_ABI_MAJOR;
    out_info->abi_minor = requested_minor;
    out_info->struct_size = (uint32_t)sizeof(*out_info);
    out_info->lifecycle = machine->state.lifecycle;
    out_info->generation = machine->state.events.generation;
    out_info->next_request_id = machine->state.events.next_request_id;
    out_info->outstanding_request_id = machine->state.events.outstanding_request_id;
    out_info->clock_slots_completed = machine->state.clock_slots_completed;
    out_info->microinstructions_executed =
        machine->state.cpu.microinstructions_executed;
    out_info->outstanding_operation = machine->state.events.outstanding_operation;
    out_info->waiting_for_host =
        machine->state.events.outstanding_request_id != 0U &&
        machine->state.events.completion_queued == 0U ? 1U : 0U;
    out_info->completion_queued = machine->state.events.completion_queued;
    out_info->boot_configuration_ingressed =
        machine->state.artifacts.boot_configuration_ingressed;
    out_info->control_store_ingressed =
        machine->state.artifacts.control_store_ingressed;
    out_info->base_disk_verified = machine->state.artifacts.base_disk_verified;
    out_info->persistent_status = machine->state.events.persistent_status;
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_boundary_state(cadr_machine *machine,
                                        cadr_boundary_state *out_state)
{
    uint32_t flags = 0U;
    if (machine == NULL || out_state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    (void)memset(out_state, 0, sizeof(*out_state));
    out_state->clock_slot_ordinal = machine->state.clock_slots_completed;
    out_state->microinstructions_executed =
        machine->state.cpu.microinstructions_executed;
    out_state->p0 = machine->state.cpu.p0 & UINT64_C(0x0000ffffffffffff);
    out_state->p1 = machine->state.cpu.p1 & UINT64_C(0x0000ffffffffffff);
    out_state->debug_ir =
        machine->state.cpu.debug_ir & UINT64_C(0x0000ffffffffffff);
    out_state->instruction_write_register =
        machine->state.cpu.instruction_write_register &
        UINT64_C(0x0000ffffffffffff);
    out_state->raw_fetched_word = machine->state.trace.raw_fetched_word;
    out_state->effective_word = machine->state.trace.effective_word;
    out_state->first_mutation_ordinal =
        machine->state.canonical.first_mutation_ordinal;
    out_state->mutation_count = machine->state.canonical.mutation_count;
    (void)memcpy(out_state->mutation_sha256,
                 machine->state.canonical.mutation_sha256,
                 CADR_SHA256_BYTES);
    out_state->p0_pc = machine->state.cpu.p0_pc;
    out_state->p1_pc = machine->state.cpu.p1_pc;
    out_state->next_micro_pc = machine->state.cpu.next_micro_pc;
    out_state->location_counter = machine->state.cpu.location_counter;
    out_state->q = machine->state.cpu.q;
    out_state->old_q = machine->state.cpu.old_q;
    out_state->vma = machine->state.cpu.vma;
    out_state->md = machine->state.cpu.md;
    out_state->pending_md = machine->state.cpu.pending_md;
    out_state->pending_md_delay = machine->state.cpu.pending_md_delay;
    out_state->dispatch_constant = machine->state.cpu.dispatch_constant;
    out_state->interrupt_control = machine->state.cpu.interrupt_control;
    out_state->interrupt_status = machine->state.bus.interrupt_status;
    out_state->interrupt_pending = machine->state.bus.interrupt_pending;
    out_state->micro_stack_pointer = machine->state.cpu.micro_stack_pointer;
    out_state->pdl_pointer = machine->state.cpu.pdl_pointer;
    out_state->pdl_index = machine->state.cpu.pdl_index;
    out_state->oa_low = machine->state.cpu.oa_low;
    out_state->oa_high = machine->state.cpu.oa_high;
    out_state->oa_low_pending = machine->state.cpu.oa_low_pending;
    out_state->oa_high_pending = machine->state.cpu.oa_high_pending;
    out_state->decoded_a_address = machine->state.cpu.decoded_a_address;
    out_state->decoded_m_address = machine->state.cpu.decoded_m_address;
    out_state->decoded_a_data = machine->state.cpu.decoded_a_data;
    out_state->decoded_m_data = machine->state.cpu.decoded_m_data;
    out_state->decoded_class = machine->state.cpu.decoded_class;
    out_state->effective_popj = machine->state.cpu.effective_popj;
    out_state->alu_out = machine->state.cpu.alu_out;
    out_state->alu_carry = machine->state.cpu.alu_carry;
    out_state->output_bus = machine->state.cpu.out;
    out_state->opc = machine->state.cpu.opc;
    out_state->main_memory_pages = machine->state.memory.main_memory_pages;
    out_state->bus_error_status = machine->state.bus.error_status;
    out_state->trace_pc = machine->state.trace.pc;
    out_state->trace_store_selector = machine->state.trace.store_selector;
    out_state->trace_operation = machine->state.trace.operation;
    out_state->trace_a_address = machine->state.trace.a_address;
    out_state->trace_m_address = machine->state.trace.m_address;
    out_state->trace_a_value = machine->state.trace.a_value;
    out_state->trace_m_value = machine->state.trace.m_value;
    out_state->trace_instruction_memory =
        machine->state.trace.instruction_memory;
    out_state->trace_functional_m_source =
        machine->state.trace.functional_m_source;
    out_state->trace_effective_popj = machine->state.trace.effective_popj;
    out_state->trace_decoded = machine->state.trace.decoded;
    if (machine->state.trace.last_slot_executed != 0U) flags |= CADR_BOUNDARY_EXECUTED;
    if (machine->state.trace.last_slot_inhibited != 0U) flags |= CADR_BOUNDARY_INHIBITED;
    if (machine->state.cpu.halted != 0U) flags |= CADR_BOUNDARY_HALTED;
    if (machine->state.cpu.prom_disabled != 0U) flags |= CADR_BOUNDARY_PROM_DISABLED;
    if (machine->state.cpu.vma_ok != 0U) flags |= CADR_BOUNDARY_VMA_OK;
    out_state->flags = flags;
    return CADR_STATUS_OK;
}

static void cadr_digest_u32(cadr_sha256_context *context, uint32_t value)
{
    uint8_t bytes[4];
    bytes[0] = (uint8_t)value; bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U); bytes[3] = (uint8_t)(value >> 24U);
    cadr_sha256_update(context, bytes, sizeof(bytes));
}

static void cadr_digest_u64(cadr_sha256_context *context, uint64_t value)
{
    uint32_t index;
    uint8_t bytes[8];
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
    cadr_sha256_update(context, bytes, sizeof(bytes));
}

static void cadr_state_u32(cadr_sha256_context *context, uint32_t tag,
                           uint32_t value)
{
    cadr_digest_u32(context, tag);
    cadr_digest_u32(context, value);
}

static void cadr_state_u64(cadr_sha256_context *context, uint32_t tag,
                           uint64_t value)
{
    cadr_digest_u32(context, tag);
    cadr_digest_u64(context, value);
}

typedef struct cadr_fixed_root {
    uint32_t family;
    char hex[65];
} cadr_fixed_root;

static uint8_t cadr_hex_nibble(char value)
{
    if (value >= '0' && value <= '9') return (uint8_t)(value - '0');
    return (uint8_t)(value - 'a' + 10);
}

static void cadr_state_fixed_root(cadr_sha256_context *context,
                                  const cadr_fixed_root *root)
{
    uint8_t digest[CADR_SHA256_BYTES];
    uint32_t index;
    cadr_digest_u32(context, root->family);
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        digest[index] = (uint8_t)(
            (uint8_t)(cadr_hex_nibble(root->hex[index * 2U]) << 4U) |
            cadr_hex_nibble(root->hex[index * 2U + 1U]));
    }
    cadr_sha256_update(context, digest, sizeof(digest));
}

static void cadr_state_tree_root(cadr_sha256_context *context,
                                 const cadr_machine_state *state, uint32_t family)
{
    uint32_t count;
    const uint32_t *values;
    uint8_t (*nodes)[CADR_SHA256_BYTES] =
        cadr_tree_for((cadr_machine_state *)(uintptr_t)state, family, &count, &values);
    (void)count;
    (void)values;
    cadr_digest_u32(context, family);
    cadr_sha256_update(context, nodes[1], CADR_SHA256_BYTES);
}

cadr_status cadr_boundary_digest_state(
    const cadr_machine_state *state,
    uint8_t digest[CADR_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRSTATE1\0";
    static const cadr_fixed_root fixed_trees[] = {
        {14U, "0fe6645abd65c1e35942c0f74d5b8382293f9d9e8cac92e534de4d7be792f4f9"},
        {1U, "d71dbaad1af53e2419f1dfedd57fc7fb880e6c408c2eb9f44c8c8717277ffbd0"},
        {4U, "607cbf410c1180f1b3d995efb9c2ba6060cc657083476e3b8f9227e88a374d47"},
        {9U, "34c97307c7721c646fb7ddf3114f66f270c5d80c9cff05f1243c4a579d8966ad"},
        {10U, "81689cb64aaf599925611e729ce1b031f7c110e2ebc7a54c76bd07c7c717ab26"},
        {11U, "641967dcf453c354731a53025bc1b98d3932032f1bf708e96196fb84b812afcb"},
        {12U, "7b3d1a078a3768235a156a35f1d74de60dd3beae8582dd35d73de91105df798f"},
        {13U, "a05334b41ce4bda6100ed20b7bfbd6b039d2a09c8eb554d978205fb501f3d01d"},
        {15U, "dc2b46ae373960841c68a0aa82bfb06ff692942a2bd7bf5384d0053fc20b2d13"}
    };
    static const cadr_fixed_root fixed_devices[] = {
        {31U, "649bb9ad9259950a73f3e1d5845bc3132b4ac8c0f765554a36ff64d72c488f3b"},
        {32U, "06c9b931540cca70d1ad1564a88a6a203f987d5a370e4ba9716920fa3bff708c"},
        {33U, "736e83e758c6021354b4e64ac19442ccea4d1133bd49f15088a562d3b943bed8"},
        {34U, "57ba6788fba24c7b784ba32ddf7fea92cb1802e6c03577a4e64ca335c32c3318"},
        {35U, "227ec139fda3b8c1cd674e3aaa598383a45ed317a2385af9ba95f03cbeca356a"},
        {36U, "fc19253d8cab8743f153ee1b262f54f9a1d050e250ed7d1d7bbd1040138149df"},
        {37U, "27be1c8d4b1c4e01ac9550bc22662c958c18f8da7522bc99c8d17ecb7ce825df"}
    };
    cadr_sha256_context context;
    size_t index;
    if (state == NULL || digest == NULL ||
        state->canonical.initialized == 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_sha256_init(&context);
    cadr_sha256_update(&context, domain, sizeof(domain) - 1U);
    cadr_state_u64(&context, 1U, state->clock_slots_completed);
    cadr_state_u64(&context, 2U, state->cpu.p0 & UINT64_C(0xffffffffffff));
    cadr_state_u64(&context, 3U, state->cpu.p1 & UINT64_C(0xffffffffffff));
    cadr_state_u64(&context, 4U, state->cpu.debug_ir & UINT64_C(0xffffffffffff));
    cadr_state_u64(&context, 5U, state->cpu.instruction_write_register & UINT64_C(0xffffffffffff));
    cadr_state_u32(&context, 6U, state->cpu.p0_pc);
    cadr_state_u32(&context, 7U, state->cpu.p1_pc);
    cadr_state_u32(&context, 8U, state->cpu.next_micro_pc);
    cadr_state_u32(&context, 9U, state->cpu.p0_imem);
    cadr_state_u32(&context, 10U, state->cpu.p1_imem);
    cadr_state_u32(&context, 11U, state->cpu.location_counter);
    cadr_state_u32(&context, 12U, state->cpu.q);
    cadr_state_u32(&context, 13U, state->cpu.old_q);
    cadr_state_u32(&context, 14U, state->cpu.vma);
    cadr_state_u32(&context, 15U, state->cpu.md);
    cadr_state_u32(&context, 16U, state->cpu.pending_md);
    cadr_state_u32(&context, 17U, state->cpu.pending_md_delay);
    cadr_state_u32(&context, 18U, state->cpu.dispatch_constant);
    cadr_state_u32(&context, 19U, state->cpu.interrupt_control);
    cadr_state_u32(&context, 20U, state->bus.interrupt_status);
    cadr_state_u32(&context, 21U, state->cpu.interrupt_pending);
    cadr_state_u32(&context, 22U, state->cpu.micro_stack_pointer);
    cadr_state_u32(&context, 23U, state->cpu.pdl_pointer);
    cadr_state_u32(&context, 24U, state->cpu.pdl_index);
    cadr_state_u32(&context, 25U, state->cpu.oa_low);
    cadr_state_u32(&context, 26U, state->cpu.oa_high);
    cadr_state_u32(&context, 27U, state->cpu.oa_low_pending);
    cadr_state_u32(&context, 28U, state->cpu.oa_high_pending);
    cadr_state_u32(&context, 29U, state->cpu.decoded_a_address);
    cadr_state_u32(&context, 30U, state->cpu.decoded_m_address);
    cadr_state_u32(&context, 31U, state->cpu.decoded_a_data);
    cadr_state_u32(&context, 32U, state->cpu.decoded_m_data);
    cadr_state_u32(&context, 33U, state->cpu.decoded_class);
    cadr_state_u32(&context, 34U, state->cpu.effective_popj);
    cadr_state_u32(&context, 35U, state->cpu.alu_out);
    cadr_state_u32(&context, 36U, state->cpu.alu_carry);
    cadr_state_u32(&context, 37U, state->cpu.out);
    cadr_state_u32(&context, 38U, state->cpu.inhibit);
    cadr_state_u32(&context, 39U, state->cpu.opc);
    cadr_state_u32(&context, 40U, state->cpu.halted);
    cadr_state_u32(&context, 41U, state->cpu.vma_ok);
    cadr_state_u32(&context, 42U, state->cpu.prom_disabled);
    cadr_state_u32(&context, 43U, state->memory.main_memory_pages);
    cadr_state_u32(&context, 44U, 0U);
    cadr_state_u32(&context, 45U, 0U);
    cadr_state_u32(&context, 46U, state->bus.error_status);
    cadr_state_u64(&context, 47U, state->trace.raw_fetched_word);
    cadr_state_u64(&context, 48U, state->trace.effective_word);
    cadr_state_u32(&context, 49U, state->trace.pc);
    cadr_state_u32(&context, 50U, state->trace.store_selector);
    cadr_state_u32(&context, 51U, state->trace.operation);
    cadr_state_u32(&context, 52U, state->trace.a_address);
    cadr_state_u32(&context, 53U, state->trace.m_address);
    cadr_state_u32(&context, 54U, state->trace.a_value);
    cadr_state_u32(&context, 55U, state->trace.m_value);
    cadr_state_u32(&context, 56U, state->trace.instruction_memory);
    cadr_state_u32(&context, 57U, state->trace.functional_m_source);
    cadr_state_u32(&context, 58U, state->trace.effective_popj);
    cadr_state_u32(&context, 59U, state->trace.last_slot_inhibited);
    cadr_state_u32(&context, 60U, state->trace.decoded);
    cadr_state_fixed_root(&context, &fixed_trees[0]);
    cadr_state_fixed_root(&context, &fixed_trees[1]);
    cadr_state_tree_root(&context, state, 2U);
    cadr_state_tree_root(&context, state, 3U);
    cadr_state_fixed_root(&context, &fixed_trees[2]);
    cadr_state_tree_root(&context, state, 5U);
    cadr_state_tree_root(&context, state, 6U);
    cadr_state_tree_root(&context, state, 7U);
    cadr_state_tree_root(&context, state, 8U);
    for (index = 3U; index < sizeof(fixed_trees) / sizeof(fixed_trees[0]);
         ++index) {
        cadr_state_fixed_root(&context, &fixed_trees[index]);
    }
    for (index = 0U;
         index < sizeof(fixed_devices) / sizeof(fixed_devices[0]); ++index) {
        cadr_state_fixed_root(&context, &fixed_devices[index]);
    }
    cadr_sha256_final(&context, digest);
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_boundary_digest(cadr_machine *machine,
                                         uint8_t digest[CADR_SHA256_BYTES])
{
    if (machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    return cadr_boundary_digest_state(&machine->state, digest);
}

cadr_status cadr_machine_trace_start(cadr_machine *machine,
                                     const cadr_trace_config *config)
{
    cadr_trace_engine_config internal;
    cadr_status status;
    if (machine == NULL || config == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_validate_m2_record(config->abi_major, config->abi_minor,
                                     config->struct_size, sizeof(*config));
    if (status != CADR_STATUS_OK) return status;
    if (config->flags != 0U || config->reserved0 != 0U ||
        config->reserved1 != 0U ||
        memcmp(config->profile_sha256, cadr_selected_profile_sha256,
               CADR_SHA256_BYTES) != 0 ||
        memcmp(config->artifact_set_sha256,
               cadr_selected_artifact_set_sha256,
               CADR_SHA256_BYTES) != 0) {
        return CADR_STATUS_PROFILE_MISMATCH;
    }
    if (config->first_boundary != machine->state.clock_slots_completed) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (machine->state.events.outstanding_request_id != 0U ||
        machine->state.events.completion_queued != 0U) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_state_v2_rebuild(&machine->state);
    if (status != CADR_STATUS_OK) return status;
    (void)memset(&internal, 0, sizeof(internal));
    internal.first_boundary = config->first_boundary;
    internal.selector_mask = config->selector_mask;
    internal.event_mask = config->event_mask;
    internal.ring_record_capacity = config->ring_record_capacity;
    internal.transport_mode = config->transport_mode;
    (void)memcpy(internal.profile_sha256, config->profile_sha256,
                 CADR_SHA256_BYTES);
    (void)memcpy(internal.artifact_set_sha256, config->artifact_set_sha256,
                 CADR_SHA256_BYTES);
    (void)memcpy(internal.input_schedule_sha256,
                 config->input_schedule_sha256, CADR_SHA256_BYTES);
    return cadr_trace_engine_start(&machine->state, &internal);
}

cadr_status cadr_machine_trace_header(const cadr_machine *machine,
                                      uint8_t *bytes, uint64_t capacity,
                                      uint64_t *out_written)
{
    cadr_status status;
    if (out_written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_written = 0U;
    if (machine == NULL || bytes == NULL ||
        capacity < CADR_TRACE_HEADER_BYTES ||
        !cadr_trace_engine_active(&machine->state)) {
        return capacity < CADR_TRACE_HEADER_BYTES
            ? CADR_STATUS_WRONG_LENGTH : CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_trace_engine_header(&machine->state, bytes);
    if (status == CADR_STATUS_OK) *out_written = CADR_TRACE_HEADER_BYTES;
    return status;
}

cadr_status cadr_machine_trace_drain(cadr_machine *machine,
                                     uint8_t *bytes, uint64_t capacity,
                                     uint64_t *out_written,
                                     uint64_t *out_records)
{
    if (machine == NULL || out_written == NULL || out_records == NULL ||
        (capacity != 0U && bytes == NULL) ||
        !cadr_trace_engine_active(&machine->state)) {
        if (out_written != NULL) *out_written = 0U;
        if (out_records != NULL) *out_records = 0U;
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return cadr_trace_engine_drain(&machine->state, bytes, capacity,
                                   out_written, out_records);
}

cadr_status cadr_machine_trace_finish(
    cadr_machine *machine, const cadr_trace_finish_request *request)
{
    cadr_status status;
    if (machine == NULL || request == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_validate_m2_record(request->abi_major, request->abi_minor,
                                     request->struct_size, sizeof(*request));
    if (status != CADR_STATUS_OK) return status;
    if (request->reserved0 != 0U || request->reserved1 != 0U ||
        !cadr_trace_engine_active(&machine->state)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return cadr_trace_engine_finish(&machine->state, request->reason);
}

cadr_status cadr_machine_trace_digest(
    const cadr_machine *machine, uint8_t digest[CADR_SHA256_BYTES])
{
    if (machine == NULL || digest == NULL ||
        !cadr_trace_engine_active(&machine->state)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return cadr_trace_engine_semantic_digest(&machine->state, digest);
}

cadr_status cadr_machine_trace_count(const cadr_machine *machine,
                                     uint64_t *out_record_count)
{
    if (out_record_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_record_count = 0U;
    if (machine == NULL || !cadr_trace_engine_active(&machine->state)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    *out_record_count = cadr_trace_engine_record_count(&machine->state);
    return CADR_STATUS_OK;
}

static cadr_status cadr_snapshot_request_validate(
    const cadr_snapshot_request *request)
{
    cadr_status status;
    if (request == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_validate_m2_record(request->abi_major, request->abi_minor,
                                     request->struct_size, sizeof(*request));
    if (status != CADR_STATUS_OK) return status;
    return request->flags == 0U ? CADR_STATUS_OK
                                : CADR_STATUS_INVALID_ARGUMENT;
}

static cadr_status cadr_snapshot_compute_digests(
    cadr_machine_state *state,
    uint8_t cdrstate1[CADR_SHA256_BYTES],
    uint8_t cdrstate2[CADR_SHA256_BYTES])
{
    cadr_status status = cadr_canonical_rebuild(state);
    if (status != CADR_STATUS_OK) return status;
    /*
     * Normal execution maintains the cache through the typed write hooks.
     * Rebuilding here only when an earlier bulk lifecycle operation marked it
     * invalid preserves the M2 snapshot boundary without making each save an
     * O(full RAM) operation.
     */
    if (state->trace.state_v2.initialized == 0U) {
        status = cadr_state_v2_rebuild(state);
        if (status != CADR_STATUS_OK) return status;
    }
    status = cadr_boundary_digest_state(state, cdrstate1);
    if (status != CADR_STATUS_OK) return status;
    return cadr_state_v2_digest(state, cdrstate2);
}

cadr_status cadr_machine_snapshot_size(cadr_machine *machine,
                                       const cadr_snapshot_request *request,
                                       uint64_t *out_byte_count)
{
    uint8_t cdrstate1[CADR_SHA256_BYTES];
    uint8_t cdrstate2[CADR_SHA256_BYTES];
    cadr_status status;
    if (out_byte_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_byte_count = 0U;
    if (machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_snapshot_request_validate(request);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_compute_digests(&machine->state, cdrstate1,
                                           cdrstate2);
    if (status != CADR_STATUS_OK) return status;
    return cadr_snapshot_size(&machine->state, cdrstate1, cdrstate2,
                              out_byte_count);
}

cadr_status cadr_machine_snapshot_save(cadr_machine *machine,
                                       const cadr_snapshot_request *request,
                                       uint8_t *bytes, uint64_t capacity,
                                       uint64_t *out_written)
{
    uint8_t cdrstate1[CADR_SHA256_BYTES];
    uint8_t cdrstate2[CADR_SHA256_BYTES];
    cadr_status status;
    if (out_written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_written = 0U;
    if (machine == NULL || bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_snapshot_request_validate(request);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_compute_digests(&machine->state, cdrstate1,
                                           cdrstate2);
    if (status != CADR_STATUS_OK) return status;
    return cadr_snapshot_serialize(&machine->state, cdrstate1, cdrstate2,
                                   bytes, capacity, out_written);
}

static cadr_status cadr_restore_rebuild(cadr_machine_state *state,
                                        void *context)
{
    cadr_status status;
    (void)context;
    status = cadr_canonical_rebuild(state);
    if (status != CADR_STATUS_OK) return status;
    return cadr_state_v2_rebuild(state);
}

static cadr_status cadr_restore_validate(
    const cadr_machine_state *state,
    const cadr_snapshot_metadata *metadata,
    void *context)
{
    uint8_t cdrstate1[CADR_SHA256_BYTES];
    uint8_t cdrstate2[CADR_SHA256_BYTES];
    cadr_status status;
    (void)context;
    status = cadr_boundary_digest_state(state, cdrstate1);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_state_v2_digest(state, cdrstate2);
    if (status != CADR_STATUS_OK) return status;
    if (memcmp(cdrstate1, metadata->cdrstate1_digest,
               CADR_SHA256_BYTES) != 0 ||
        memcmp(cdrstate2, metadata->cdrstate2_digest,
               CADR_SHA256_BYTES) != 0) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    return cadr_state_v2_verify_cache(state);
}

cadr_status cadr_machine_snapshot_restore(
    const cadr_snapshot_request *request,
    const uint8_t *bytes, uint64_t byte_count,
    cadr_machine **out_machine)
{
    const cadr_snapshot_restore_hooks hooks = {
        cadr_restore_rebuild, cadr_restore_validate, NULL
    };
    cadr_snapshot_metadata metadata;
    cadr_machine_state *state = NULL;
    cadr_machine *machine;
    cadr_status status;
    if (out_machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_machine = NULL;
    if (bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_snapshot_request_validate(request);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_snapshot_parse(bytes, byte_count, &hooks, &state, &metadata);
    if (status != CADR_STATUS_OK) return status;
    machine = malloc(sizeof(*machine));
    if (machine == NULL) {
        cadr_snapshot_state_destroy(state);
        return CADR_STATUS_NO_MEMORY;
    }
    machine->state = *state;
    free(state);
    *out_machine = machine;
    return CADR_STATUS_OK;
}
