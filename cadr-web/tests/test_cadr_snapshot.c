#include "cadr_host_api.h"
#include "cadr_machine.h"
#include "cadr_snapshot.h"
#include "cadr_state_v2.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SNAP_HEADER_BYTES 264U
#define SNAP_DIRECTORY_ENTRY_BYTES 64U
#define SNAP_TRAILER_BYTES 32U

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

typedef struct test_sha_context {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t used;
} test_sha_context;

typedef struct restore_context {
    const uint8_t *expected_digest;
    uint32_t rebuild_calls;
    uint32_t validate_calls;
    uint32_t reject_validate;
    uint32_t mutate_semantic;
} restore_context;

static uint32_t test_rotr32(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void test_sha_transform(test_sha_context *context, const uint8_t block[64])
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
        const uint32_t offset = index * 4U;
        schedule[index] = ((uint32_t)block[offset] << 24U) |
                          ((uint32_t)block[offset + 1U] << 16U) |
                          ((uint32_t)block[offset + 2U] << 8U) |
                          (uint32_t)block[offset + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = test_rotr32(schedule[index - 15U], 7U) ^
                            test_rotr32(schedule[index - 15U], 18U) ^
                            (schedule[index - 15U] >> 3U);
        const uint32_t s1 = test_rotr32(schedule[index - 2U], 17U) ^
                            test_rotr32(schedule[index - 2U], 19U) ^
                            (schedule[index - 2U] >> 10U);
        schedule[index] = schedule[index - 16U] + s0 + schedule[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t s1 = test_rotr32(e, 6U) ^ test_rotr32(e, 11U) ^ test_rotr32(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temporary1 = h + s1 + choose + constants[index] + schedule[index];
        const uint32_t s0 = test_rotr32(a, 2U) ^ test_rotr32(a, 13U) ^ test_rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary2 = s0 + majority;
        h = g; g = f; f = e; e = d + temporary1;
        d = c; c = b; b = a; a = temporary1 + temporary2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void test_sha_init(test_sha_context *context)
{
    context->state[0] = UINT32_C(0x6a09e667); context->state[1] = UINT32_C(0xbb67ae85);
    context->state[2] = UINT32_C(0x3c6ef372); context->state[3] = UINT32_C(0xa54ff53a);
    context->state[4] = UINT32_C(0x510e527f); context->state[5] = UINT32_C(0x9b05688c);
    context->state[6] = UINT32_C(0x1f83d9ab); context->state[7] = UINT32_C(0x5be0cd19);
    context->bit_count = 0U;
    context->used = 0U;
}

static void test_sha_update(test_sha_context *context, const uint8_t *bytes, size_t count)
{
    while (count != 0U) {
        const uint32_t available = UINT32_C(64) - context->used;
        const uint32_t take = count < (size_t)available ? (uint32_t)count : available;
        (void)memcpy(&context->block[context->used], bytes, take);
        context->used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        count -= take;
        if (context->used == 64U) {
            test_sha_transform(context, context->block);
            context->used = 0U;
        }
    }
}

static void test_sha_final(test_sha_context *context, uint8_t digest[32])
{
    const uint64_t bit_count = context->bit_count;
    uint32_t index;
    context->block[context->used++] = UINT8_C(0x80);
    if (context->used > 56U) {
        (void)memset(&context->block[context->used], 0, 64U - context->used);
        test_sha_transform(context, context->block);
        context->used = 0U;
    }
    (void)memset(&context->block[context->used], 0, 56U - context->used);
    for (index = 0U; index < 8U; ++index) {
        context->block[63U - index] = (uint8_t)(bit_count >> (index * 8U));
    }
    test_sha_transform(context, context->block);
    for (index = 0U; index < 8U; ++index) {
        digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        digest[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

static void test_sha256(const uint8_t *bytes, size_t count, uint8_t digest[32])
{
    test_sha_context context;
    test_sha_init(&context);
    test_sha_update(&context, bytes, count);
    test_sha_final(&context, digest);
}

static uint64_t get_u64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)bytes[index] << (index * 8U);
    return value;
}

static void put_u32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put_u64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static void reseal(uint8_t *bytes, size_t byte_count)
{
    const uint64_t directory_offset = get_u64(bytes + 40U);
    const uint64_t directory_bytes = get_u64(bytes + 48U);
    uint8_t digest[32];
    test_sha256(bytes + (size_t)directory_offset, (size_t)directory_bytes, digest);
    (void)memcpy(bytes + 232U, digest, sizeof(digest));
    test_sha256(bytes, byte_count - SNAP_TRAILER_BYTES, digest);
    (void)memcpy(bytes + byte_count - SNAP_TRAILER_BYTES, digest, sizeof(digest));
}

static uint8_t *chunk_entry(uint8_t *bytes, uint32_t type)
{
    return bytes + SNAP_HEADER_BYTES +
        (size_t)(type - 1U) * SNAP_DIRECTORY_ENTRY_BYTES;
}

static const uint8_t *const_chunk_entry(const uint8_t *bytes, uint32_t type)
{
    return bytes + SNAP_HEADER_BYTES +
        (size_t)(type - 1U) * SNAP_DIRECTORY_ENTRY_BYTES;
}

static void reseal_chunk(uint8_t *bytes, size_t byte_count, uint32_t type)
{
    uint8_t *entry = chunk_entry(bytes, type);
    const uint64_t offset = get_u64(entry + 8U);
    const uint64_t length = get_u64(entry + 16U);
    uint8_t digest[32];
    test_sha256(bytes + (size_t)offset, (size_t)length, digest);
    (void)memcpy(entry + 32U, digest, sizeof(digest));
    reseal(bytes, byte_count);
}

static uint8_t *chunk_payload(uint8_t *bytes, uint32_t type)
{
    return bytes + (size_t)get_u64(chunk_entry(bytes, type) + 8U);
}

static const uint8_t *const_chunk_payload(const uint8_t *bytes, uint32_t type)
{
    return bytes + (size_t)get_u64(const_chunk_entry(bytes, type) + 8U);
}

static cadr_status rebuild_cache(cadr_machine_state *state, void *opaque)
{
    restore_context *context = opaque;
    cadr_status status;
    context->rebuild_calls += 1U;
    /* Test stand-in for the core-owned legacy canonical tree rebuild. */
    state->canonical.amem_nodes[1][0] = UINT8_C(0x7b);
    status = cadr_state_v2_rebuild(state);
    if (status != CADR_STATUS_OK) return status;
    if (context->mutate_semantic != 0U) state->cpu.q += 1U;
    return CADR_STATUS_OK;
}

static cadr_status validate_state(const cadr_machine_state *state,
                                  const cadr_snapshot_metadata *metadata,
                                  void *opaque)
{
    restore_context *context = opaque;
    uint8_t actual_digest[CADR_SHA256_BYTES];
    context->validate_calls += 1U;
    if (cadr_state_v2_verify_cache(state) != CADR_STATUS_OK ||
        cadr_state_v2_digest(state, actual_digest) != CADR_STATUS_OK ||
        memcmp(metadata->cdrstate2_digest, actual_digest,
               sizeof(actual_digest)) != 0 ||
        (context->expected_digest != NULL &&
         (memcmp(metadata->cdrstate1_digest, context->expected_digest, 32U) != 0 ||
          memcmp(metadata->cdrstate2_digest, context->expected_digest, 32U) != 0))) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    if (state->profile != metadata->profile ||
        state->clock_slots_completed != metadata->clock_slots_completed) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return context->reject_validate != 0U ? CADR_STATUS_HOST_FAILURE : CADR_STATUS_OK;
}

static cadr_snapshot_restore_hooks hooks_for(restore_context *context)
{
    cadr_snapshot_restore_hooks hooks;
    hooks.rebuild_derived = rebuild_cache;
    hooks.validate_state = validate_state;
    hooks.context = context;
    return hooks;
}

static cadr_machine *booted_machine(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR, (uint32_t)sizeof(cadr_machine_config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    CHECK(cadr_machine_create(&config, &machine) == CADR_STATUS_OK);
    if (machine == NULL) return NULL;
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(machine) == CADR_STATUS_OK);
    CHECK(cadr_machine_boot(machine) == CADR_STATUS_OK);
    return machine;
}

static void decorate_state(cadr_machine *machine)
{
    cadr_machine_state *state = &machine->state;
    state->clock_slots_completed = UINT64_C(77);
    state->cpu.microinstructions_executed = UINT64_C(53);
    state->cpu.p0 = UINT64_C(0x123456789abc);
    state->cpu.p1 = UINT64_C(0x0fedcba98765);
    state->cpu.a_memory[17] = UINT32_C(0x12345678);
    state->cpu.m_memory[4] = UINT32_C(0x87654321);
    state->cpu.dispatch_memory[100] = UINT32_C(0x13579bdf);
    state->cpu.pdl[10] = UINT32_C(0x2468ace0);
    state->cpu.micro_stack[2] = UINT32_C(0xdeadbeef);
    state->memory.prom[7] = UINT64_C(0x0000beefcafe);
    state->memory.imem[9] = UINT64_C(0x000012345678);
    state->memory.l1_map[4] = UINT32_C(0x44556677);
    state->memory.l2_map[6] = UINT32_C(0x8899aabb);
    state->memory.main_memory[0][3] = UINT32_C(0xcafebabe);
    state->memory.main_memory[CADR_MAIN_MEMORY_MAX_PAGES - 1U]
        [CADR_MAIN_MEMORY_WORDS_PER_PAGE - 1U] = UINT32_C(0x10203040);
    state->bus.guest_tick = UINT64_C(88);
    state->bus.unibus_map[2] = UINT16_C(012345);
    state->bus.diagnostic.instruction = UINT64_C(0x000001234567);
    state->devices.event_sequence = UINT64_C(99);
    state->devices.tv_mode = 3U;
    state->devices.tv_sync_ptr = 12U;
    state->devices.tv_sync_ram[5] = UINT8_C(0xaa);
    state->devices.tv_screen[11] = UINT32_C(0x55aa55aa);
    state->trace.instruction_ordinal = state->cpu.microinstructions_executed;
    state->trace.event_sequence = UINT64_C(12);
    state->trace.raw_fetched_word = UINT64_C(0x0000abcdef0123);
    state->trace.effective_word = UINT64_C(0x0000456789abcd);
    state->trace.valid_mask = CADR_TRACE_LATCH_VALID_PIPELINE |
        CADR_TRACE_LATCH_VALID_DESTINATION | CADR_TRACE_LATCH_VALID_MD;
    state->trace.pre_p0_pc = 100U;
    state->trace.post_p0_pc = 101U;
    state->trace.destination_kind = 2U;
    state->trace.destination_address = 17U;
    state->trace.post_interrupt_status = 4U;
    state->trace.interrupt_level = 4U;
}

static uint8_t *serialize_state(const cadr_machine_state *state,
                                const uint8_t digest[32], size_t *out_length)
{
    uint64_t length = 0U;
    uint64_t written = 0U;
    uint8_t *bytes;
    CHECK(cadr_snapshot_size(state, digest, digest, &length) == CADR_STATUS_OK);
    if (length == 0U || length > (uint64_t)SIZE_MAX) return NULL;
    bytes = malloc((size_t)length);
    CHECK(bytes != NULL);
    if (bytes == NULL) return NULL;
    CHECK(cadr_snapshot_serialize(state, digest, digest, bytes, length, &written) ==
          CADR_STATUS_OK);
    CHECK(written == length);
    if (written != length) {
        free(bytes);
        return NULL;
    }
    *out_length = (size_t)length;
    return bytes;
}

static int state_digest(cadr_machine_state *state, uint8_t digest[32])
{
    CHECK(cadr_state_v2_rebuild(state) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_digest(state, digest) == CADR_STATUS_OK);
    return state->trace.state_v2.initialized != 0U;
}

static void assert_rejected(const uint8_t *bytes, size_t length,
                            const cadr_snapshot_restore_hooks *hooks)
{
    cadr_machine_state *parsed = (cadr_machine_state *)(uintptr_t)UINTPTR_MAX;
    cadr_snapshot_metadata metadata;
    (void)memset(&metadata, UINT8_C(0xff), sizeof(metadata));
    CHECK(cadr_snapshot_parse(bytes, length, hooks, &parsed, &metadata) != CADR_STATUS_OK);
    CHECK(parsed == NULL);
    CHECK(memcmp(&metadata, &(cadr_snapshot_metadata){0}, sizeof(metadata)) == 0);
}

static uint8_t *append_unknown_optional(const uint8_t *source, size_t source_length,
                                        size_t *out_length)
{
    const uint64_t old_directory_bytes = get_u64(source + 48U);
    const uint64_t old_payload_offset = get_u64(source + 56U);
    const uint64_t payload_bytes = (uint64_t)source_length - old_payload_offset - SNAP_TRAILER_BYTES;
    const size_t result_length = source_length + SNAP_DIRECTORY_ENTRY_BYTES;
    const uint64_t new_payload_offset = old_payload_offset + SNAP_DIRECTORY_ENTRY_BYTES;
    uint8_t empty_sha256[32];
    uint8_t *result = calloc(1U, result_length);
    uint32_t index;
    if (result == NULL) return NULL;
    (void)memcpy(result, source, SNAP_HEADER_BYTES);
    (void)memcpy(result + SNAP_HEADER_BYTES, source + SNAP_HEADER_BYTES,
                 (size_t)old_directory_bytes);
    (void)memcpy(result + (size_t)new_payload_offset,
                 source + (size_t)old_payload_offset, (size_t)payload_bytes);
    for (index = 0U; index < 8U; ++index) {
        uint8_t *entry = result + SNAP_HEADER_BYTES + index * SNAP_DIRECTORY_ENTRY_BYTES;
        put_u64(entry + 8U, get_u64(entry + 8U) + SNAP_DIRECTORY_ENTRY_BYTES);
    }
    test_sha256(NULL, 0U, empty_sha256);
    put_u32(result + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES, 9U);
    put_u32(result + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES + 4U, 0U);
    put_u64(result + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES + 8U,
            new_payload_offset + payload_bytes);
    put_u64(result + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES + 16U, 0U);
    (void)memcpy(result + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES + 32U,
                 empty_sha256, sizeof(empty_sha256));
    put_u32(result + 20U, 9U);
    put_u64(result + 32U, result_length);
    put_u64(result + 48U, old_directory_bytes + SNAP_DIRECTORY_ENTRY_BYTES);
    put_u64(result + 56U, new_payload_offset);
    reseal(result, result_length);
    *out_length = result_length;
    return result;
}

static void test_deterministic_round_trip_and_queued_completion(void)
{
    cadr_machine *machine = booted_machine();
    cadr_network_descriptor descriptor = { UINT64_C(7), UINT64_C(3) };
    cadr_host_completion completion = {0};
    uint8_t completion_bytes[3] = { UINT8_C(0xaa), UINT8_C(0xbb), UINT8_C(0xcc) };
    uint8_t digest[32];
    cadr_snapshot_restore_hooks hooks;
    restore_context context = {0};
    cadr_machine_state *parsed = NULL;
    cadr_snapshot_metadata metadata;
    uint8_t *first;
    uint8_t *second;
    size_t first_length;
    size_t second_length;
    if (machine == NULL) return;
    decorate_state(machine);
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), sizeof(completion_bytes)) == CADR_STATUS_OK);
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = machine->state.events.generation;
    completion.request_id = machine->state.events.outstanding_request_id;
    completion.completion_byte_count = sizeof(completion_bytes);
    CHECK(cadr_machine_complete_host_request(machine, &completion, completion_bytes,
                                             sizeof(completion_bytes)) == CADR_STATUS_OK);
    CHECK(state_digest(&machine->state, digest));
    first = serialize_state(&machine->state, digest, &first_length);
    if (first == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    context.expected_digest = digest;
    hooks = hooks_for(&context);
    CHECK(cadr_snapshot_parse(first, first_length, &hooks, &parsed, &metadata) == CADR_STATUS_OK);
    CHECK(parsed != NULL);
    if (parsed != NULL) {
        CHECK(parsed->events.completion_queued == 1U);
        CHECK(parsed->events.completion_byte_count == sizeof(completion_bytes));
        CHECK(memcmp(parsed->events.completion_bytes, completion_bytes,
                     sizeof(completion_bytes)) == 0);
        CHECK(parsed->memory.main_memory[0][3] == UINT32_C(0xcafebabe));
        CHECK(parsed->memory.main_memory[CADR_MAIN_MEMORY_MAX_PAGES - 1U]
              [CADR_MAIN_MEMORY_WORDS_PER_PAGE - 1U] == UINT32_C(0x10203040));
        CHECK(parsed->trace.interrupt_level == 4U);
        CHECK(parsed->trace.engine == NULL);
        CHECK(parsed->trace.state_v2.initialized == 1U);
        CHECK(parsed->canonical.amem_nodes[1][0] == UINT8_C(0x7b));
        CHECK(context.rebuild_calls == 1U);
        CHECK(context.validate_calls == 1U);
        second = serialize_state(parsed, metadata.cdrstate2_digest, &second_length);
        CHECK(second != NULL);
        if (second != NULL) {
            CHECK(second_length == first_length);
            CHECK(memcmp(second, first, first_length) == 0);
            free(second);
        }
        cadr_snapshot_state_destroy(parsed);
    }
    free(first);
    cadr_machine_destroy(machine);
}

static void test_sha256_and_chunk_integrity_vectors(void)
{
    static const uint8_t empty_expected[32] = {
        0xe3U, 0xb0U, 0xc4U, 0x42U, 0x98U, 0xfcU, 0x1cU, 0x14U,
        0x9aU, 0xfbU, 0xf4U, 0xc8U, 0x99U, 0x6fU, 0xb9U, 0x24U,
        0x27U, 0xaeU, 0x41U, 0xe4U, 0x64U, 0x9bU, 0x93U, 0x4cU,
        0xa4U, 0x95U, 0x99U, 0x1bU, 0x78U, 0x52U, 0xb8U, 0x55U
    };
    static const uint8_t abc_expected[32] = {
        0xbaU, 0x78U, 0x16U, 0xbfU, 0x8fU, 0x01U, 0xcfU, 0xeaU,
        0x41U, 0x41U, 0x40U, 0xdeU, 0x5dU, 0xaeU, 0x22U, 0x23U,
        0xb0U, 0x03U, 0x61U, 0xa3U, 0x96U, 0x17U, 0x7aU, 0x9cU,
        0xb4U, 0x10U, 0xffU, 0x61U, 0xf2U, 0x00U, 0x15U, 0xadU
    };
    uint8_t digest[32];
    test_sha256(NULL, 0U, digest);
    CHECK(memcmp(digest, empty_expected, sizeof(digest)) == 0);
    test_sha256((const uint8_t *)"abc", 3U, digest);
    CHECK(memcmp(digest, abc_expected, sizeof(digest)) == 0);
}

static void test_descriptor_wire_round_trips(void)
{
    static const uint8_t expected[][24] = {
        { 0x08U,0x07U,0x06U,0x05U,0x04U,0x03U,0x02U,0x01U,
          0x0cU,0x0bU,0x0aU,0x09U,0x10U,0x0fU,0x0eU,0x0dU },
        { 0x08U,0x07U,0x06U,0x05U,0x04U,0x03U,0x02U,0x01U,
          0x18U,0x17U,0x16U,0x15U,0x14U,0x13U,0x12U,0x11U,
          0x1cU,0x1bU,0x1aU,0x19U,0x20U,0x1fU,0x1eU,0x1dU },
        { 0x08U,0x07U,0x06U,0x05U,0x04U,0x03U,0x02U,0x01U,
          0x0cU,0x0bU,0x0aU,0x09U,0x10U,0x0fU,0x0eU,0x0dU,
          0x14U,0x13U,0x12U,0x11U,0x18U,0x17U,0x16U,0x15U },
        { 0x08U,0x07U,0x06U,0x05U,0x04U,0x03U,0x02U,0x01U,
          0x18U,0x17U,0x16U,0x15U,0x14U,0x13U,0x12U,0x11U,
          0x1cU,0x1bU,0x1aU,0x19U,0x20U,0x1fU,0x1eU,0x1dU },
        { 0x08U,0x07U,0x06U,0x05U,0x04U,0x03U,0x02U,0x01U,
          0x18U,0x17U,0x16U,0x15U,0x14U,0x13U,0x12U,0x11U }
    };
    union {
        cadr_block_read_descriptor read;
        cadr_block_write_descriptor write;
        cadr_present_descriptor present;
        cadr_audio_descriptor audio;
        cadr_network_descriptor network;
    } descriptor;
    uint32_t operation;
    for (operation = CADR_HOST_OPERATION_BLOCK_READ;
         operation <= CADR_HOST_OPERATION_NETWORK; ++operation) {
        cadr_machine *machine = booted_machine();
        cadr_machine_state *parsed = NULL;
        restore_context context = {0};
        cadr_snapshot_restore_hooks hooks;
        cadr_snapshot_metadata metadata;
        uint8_t digest[32];
        uint8_t *bytes;
        const uint8_t *wire;
        size_t length;
        size_t descriptor_size = (operation == CADR_HOST_OPERATION_BLOCK_READ ||
                                  operation == CADR_HOST_OPERATION_NETWORK) ? 16U : 24U;
        if (machine == NULL) continue;
        (void)memset(&descriptor, 0, sizeof(descriptor));
        if (operation == CADR_HOST_OPERATION_BLOCK_READ) {
            descriptor.read.first_block = UINT64_C(0x0102030405060708);
            descriptor.read.block_count = UINT32_C(0x090a0b0c);
            descriptor.read.block_bytes = UINT32_C(0x0d0e0f10);
        } else if (operation == CADR_HOST_OPERATION_BLOCK_WRITE) {
            descriptor.write.transaction_id = UINT64_C(0x0102030405060708);
            descriptor.write.first_block = UINT64_C(0x1112131415161718);
            descriptor.write.block_count = UINT32_C(0x191a1b1c);
            descriptor.write.block_bytes = UINT32_C(0x1d1e1f20);
        } else if (operation == CADR_HOST_OPERATION_PRESENT) {
            descriptor.present.framebuffer_generation = UINT64_C(0x0102030405060708);
            descriptor.present.x = UINT32_C(0x090a0b0c);
            descriptor.present.y = UINT32_C(0x0d0e0f10);
            descriptor.present.width = UINT32_C(0x11121314);
            descriptor.present.height = UINT32_C(0x15161718);
        } else if (operation == CADR_HOST_OPERATION_AUDIO) {
            descriptor.audio.audio_generation = UINT64_C(0x0102030405060708);
            descriptor.audio.guest_timestamp = UINT64_C(0x1112131415161718);
            descriptor.audio.encoding = UINT32_C(0x191a1b1c);
            descriptor.audio.frame_count = UINT32_C(0x1d1e1f20);
        } else {
            descriptor.network.frame_sequence = UINT64_C(0x0102030405060708);
            descriptor.network.frame_byte_count = UINT64_C(0x1112131415161718);
        }
        CHECK(cadr_machine_issue_host_request(machine, operation,
                                              (const uint8_t *)&descriptor,
                                              descriptor_size, 0U) == CADR_STATUS_OK);
        CHECK(state_digest(&machine->state, digest));
        bytes = serialize_state(&machine->state, digest, &length);
        if (bytes == NULL) {
            cadr_machine_destroy(machine);
            continue;
        }
        wire = const_chunk_payload(bytes, 7U) + 80U;
        CHECK(memcmp(wire, expected[operation - 1U], descriptor_size) == 0);
        context.expected_digest = digest;
        hooks = hooks_for(&context);
        CHECK(cadr_snapshot_parse(bytes, length, &hooks, &parsed, &metadata) ==
              CADR_STATUS_OK);
        CHECK(parsed != NULL);
        if (parsed != NULL) {
            CHECK(parsed->events.request_descriptor_byte_count == descriptor_size);
            CHECK(memcmp(parsed->events.request_descriptor, &descriptor,
                         descriptor_size) == 0);
            cadr_snapshot_state_destroy(parsed);
        }
        free(bytes);
        cadr_machine_destroy(machine);
    }
}

static void test_zero_length_queued_completion(void)
{
    cadr_machine *machine = booted_machine();
    cadr_network_descriptor descriptor = { UINT64_C(9), UINT64_C(0) };
    cadr_host_completion completion = {0};
    cadr_machine_state *parsed = NULL;
    restore_context context = {0};
    cadr_snapshot_restore_hooks hooks;
    cadr_snapshot_metadata metadata;
    uint8_t digest[32];
    uint8_t *bytes;
    size_t length;
    if (machine == NULL) return;
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) == CADR_STATUS_OK);
    completion.abi_major = CADR_ABI_MAJOR;
    completion.abi_minor = CADR_ABI_MINOR;
    completion.struct_size = (uint32_t)sizeof(completion);
    completion.operation = CADR_HOST_OPERATION_NETWORK;
    completion.host_status = CADR_HOST_RESULT_OK;
    completion.generation = machine->state.events.generation;
    completion.request_id = machine->state.events.outstanding_request_id;
    CHECK(cadr_machine_complete_host_request(machine, &completion, NULL, 0U) ==
          CADR_STATUS_OK);
    CHECK(state_digest(&machine->state, digest));
    bytes = serialize_state(&machine->state, digest, &length);
    if (bytes != NULL) {
        context.expected_digest = digest;
        hooks = hooks_for(&context);
        CHECK(cadr_snapshot_parse(bytes, length, &hooks, &parsed, &metadata) ==
              CADR_STATUS_OK);
        CHECK(parsed != NULL);
        if (parsed != NULL) {
            CHECK(parsed->events.completion_queued == 1U);
            CHECK(parsed->events.completion_byte_count == 0U);
            CHECK(parsed->events.completion_bytes == NULL);
            cadr_snapshot_state_destroy(parsed);
        }
        free(bytes);
    }
    cadr_machine_destroy(machine);
}

static void test_pending_request_and_rejection_atomicity(void)
{
    cadr_machine *machine = booted_machine();
    cadr_network_descriptor descriptor = { UINT64_C(55), UINT64_C(66) };
    uint8_t digest[32];
    restore_context context = {0};
    cadr_snapshot_restore_hooks hooks;
    cadr_machine_state *parsed = NULL;
    cadr_snapshot_metadata metadata;
    uint8_t *bytes;
    size_t length;
    if (machine == NULL) return;
    CHECK(cadr_machine_issue_host_request(machine, CADR_HOST_OPERATION_NETWORK,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor), 0U) == CADR_STATUS_OK);
    CHECK(state_digest(&machine->state, digest));
    bytes = serialize_state(&machine->state, digest, &length);
    if (bytes == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    context.expected_digest = digest;
    hooks = hooks_for(&context);
    CHECK(cadr_snapshot_parse(bytes, length, &hooks, &parsed, &metadata) == CADR_STATUS_OK);
    CHECK(parsed != NULL);
    if (parsed != NULL) {
        CHECK(parsed->events.outstanding_request_id != 0U);
        CHECK(parsed->events.completion_queued == 0U);
        CHECK(parsed->events.completion_bytes == NULL);
        cadr_snapshot_state_destroy(parsed);
    }
    context.reject_validate = 1U;
    assert_rejected(bytes, length, &hooks);
    context.reject_validate = 0U;
    context.mutate_semantic = 1U;
    assert_rejected(bytes, length, &hooks);
    free(bytes);
    cadr_machine_destroy(machine);
}

static void test_integrity_directory_and_extension_rejections(void)
{
    cadr_machine *machine = booted_machine();
    uint8_t digest[32];
    restore_context context = {0};
    cadr_snapshot_restore_hooks hooks;
    uint8_t *bytes;
    uint8_t *mutated;
    uint8_t *optional;
    size_t length;
    size_t optional_length;
    cadr_machine_state *parsed = NULL;
    cadr_snapshot_metadata metadata;
    if (machine == NULL) return;
    CHECK(state_digest(&machine->state, digest));
    bytes = serialize_state(&machine->state, digest, &length);
    if (bytes == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    context.expected_digest = digest;
    hooks = hooks_for(&context);

    {
        uint32_t type;
        uint8_t expected_hash[32];
        for (type = 1U; type <= 8U; ++type) {
            const uint8_t *entry = const_chunk_entry(bytes, type);
            test_sha256(bytes + (size_t)get_u64(entry + 8U),
                        (size_t)get_u64(entry + 16U), expected_hash);
            CHECK(memcmp(expected_hash, entry + 32U, sizeof(expected_hash)) == 0);
        }
        test_sha256(bytes, length - SNAP_TRAILER_BYTES, expected_hash);
        CHECK(memcmp(expected_hash, bytes + length - SNAP_TRAILER_BYTES,
                     sizeof(expected_hash)) == 0);
    }

    mutated = malloc(length);
    CHECK(mutated != NULL);
    if (mutated != NULL) {
        (void)memcpy(mutated, bytes, length);
        mutated[SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES] ^= UINT8_C(1);
        assert_rejected(mutated, length, &hooks);
        assert_rejected(mutated, length - 1U, &hooks);
        free(mutated);
    }

    optional = append_unknown_optional(bytes, length, &optional_length);
    CHECK(optional != NULL);
    if (optional != NULL) {
        CHECK(cadr_snapshot_parse(optional, optional_length, &hooks, &parsed, &metadata) == CADR_STATUS_OK);
        if (parsed != NULL) cadr_snapshot_state_destroy(parsed);
        parsed = NULL;
        put_u32(optional + SNAP_HEADER_BYTES + 8U * SNAP_DIRECTORY_ENTRY_BYTES + 4U, 1U);
        reseal(optional, optional_length);
        assert_rejected(optional, optional_length, &hooks);
        free(optional);
    }

    mutated = malloc(length);
    CHECK(mutated != NULL);
    if (mutated != NULL) {
        (void)memcpy(mutated, bytes, length);
        mutated[168U] ^= UINT8_C(1);
        reseal(mutated, length);
        assert_rejected(mutated, length, &hooks);

        (void)memcpy(mutated, bytes, length);
        mutated[200U] ^= UINT8_C(1);
        reseal(mutated, length);
        assert_rejected(mutated, length, &hooks);

        (void)memcpy(mutated, bytes, length);
        put_u32(mutated + SNAP_HEADER_BYTES + SNAP_DIRECTORY_ENTRY_BYTES, 1U);
        reseal(mutated, length);
        assert_rejected(mutated, length, &hooks);

        (void)memcpy(mutated, bytes, length);
        put_u32(mutated + SNAP_HEADER_BYTES, 2U);
        put_u32(mutated + SNAP_HEADER_BYTES + SNAP_DIRECTORY_ENTRY_BYTES, 1U);
        reseal(mutated, length);
        assert_rejected(mutated, length, &hooks);

        (void)memcpy(mutated, bytes, length);
        put_u64(mutated + SNAP_HEADER_BYTES + SNAP_DIRECTORY_ENTRY_BYTES + 8U,
                get_u64(mutated + SNAP_HEADER_BYTES + 8U));
        reseal(mutated, length);
        assert_rejected(mutated, length, &hooks);
        free(mutated);
    }
    free(bytes);
    cadr_machine_destroy(machine);
}

static void test_self_consistent_semantic_negative_matrix(void)
{
    cadr_machine *machine = booted_machine();
    uint8_t digest[32];
    restore_context context = {0};
    cadr_snapshot_restore_hooks hooks;
    uint8_t *bytes;
    uint8_t *mutated;
    size_t length;
    uint32_t type;
    if (machine == NULL) return;
    decorate_state(machine);
    CHECK(state_digest(&machine->state, digest));
    bytes = serialize_state(&machine->state, digest, &length);
    if (bytes == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    context.expected_digest = digest;
    hooks = hooks_for(&context);
    for (type = 1U; type <= 8U; ++type) {
        uint8_t *payload;
        mutated = malloc(length);
        CHECK(mutated != NULL);
        if (mutated == NULL) continue;
        (void)memcpy(mutated, bytes, length);
        payload = chunk_payload(mutated, type);
        switch (type) {
        case 1U: put_u32(payload + 12U, 1U); break; /* CORE reserved */
        case 2U: put_u32(payload + 8U, 2U); break;  /* CPU boolean */
        case 3U: put_u64(payload, get_u64(payload) + 1U); break; /* mapped words */
        case 4U: put_u32(payload + 8U, 2U); break;  /* BUS boolean */
        case 5U: put_u32(payload + 8U, 2U); break;  /* DEVICES boolean */
        case 6U: put_u64(payload + 8U, get_u64(payload) + 1U); break;
        case 7U: put_u32(payload + 68U, CADR_STATUS_WAITING_FOR_HOST); break;
        case 8U:
            put_u32(payload + get_u64(chunk_entry(mutated, type) + 16U) - 4U, 1U);
            break;
        default: break;
        }
        reseal_chunk(mutated, length, type);
        assert_rejected(mutated, length, &hooks);
        free(mutated);
    }
    free(bytes);
    cadr_machine_destroy(machine);
}

static void test_derived_storage_and_pointer_are_omitted(void)
{
    cadr_machine *machine = booted_machine();
    uint8_t digest[32];
    uint8_t *first;
    uint8_t *second;
    size_t first_length;
    size_t second_length;
    if (machine == NULL) return;
    decorate_state(machine);
    CHECK(state_digest(&machine->state, digest));
    first = serialize_state(&machine->state, digest, &first_length);
    machine->state.canonical.amem_nodes[1][0] ^= UINT8_C(0xff);
    machine->state.trace.state_v2.roots[0][0] ^= UINT8_C(0xff);
    machine->state.trace.state_v2.rebuild_ordinal += UINT64_C(99);
    machine->state.trace.engine =
        (cadr_trace_engine *)(uintptr_t)UINTPTR_MAX;
    second = serialize_state(&machine->state, digest, &second_length);
    CHECK(first != NULL);
    CHECK(second != NULL);
    if (first != NULL && second != NULL) {
        CHECK(first_length == second_length);
        CHECK(memcmp(first, second, first_length) == 0);
    }
    free(first);
    free(second);
    machine->state.trace.engine = NULL;
    cadr_machine_destroy(machine);
}

static void test_shared_trace_latch_negative_matrix(void)
{
    enum { TRACE_CASE_COUNT = 33 };
    cadr_machine *machine = booted_machine();
    uint8_t digest[32];
    restore_context context = {0};
    cadr_snapshot_restore_hooks hooks;
    uint8_t *bytes;
    size_t length;
    uint32_t test_case;
    if (machine == NULL) return;
    CHECK(state_digest(&machine->state, digest));
    bytes = serialize_state(&machine->state, digest, &length);
    if (bytes == NULL) {
        cadr_machine_destroy(machine);
        return;
    }
    context.expected_digest = digest;
    hooks = hooks_for(&context);
    for (test_case = 0U; test_case < TRACE_CASE_COUNT; ++test_case) {
        uint8_t *mutated = malloc(length);
        uint8_t *trace;
        CHECK(mutated != NULL);
        if (mutated == NULL) continue;
        (void)memcpy(mutated, bytes, length);
        trace = chunk_payload(mutated, 8U);
        switch (test_case) {
        case 0U: put_u32(trace + 144U, UINT32_C(0x4000)); break; /* pre p0 */
        case 1U: put_u32(trace + 148U, UINT32_C(0x4000)); break; /* pre p1 */
        case 2U: put_u32(trace + 152U, UINT32_C(0x4000)); break; /* pre npc */
        case 3U: put_u32(trace + 156U, UINT32_C(0x4000)); break; /* pre opc */
        case 4U: put_u32(trace + 160U, UINT32_C(0x4000)); break; /* post p0 */
        case 5U: put_u32(trace + 164U, UINT32_C(0x4000)); break; /* post p1 */
        case 6U: put_u32(trace + 168U, UINT32_C(0x4000)); break; /* post npc */
        case 7U: put_u32(trace + 172U, UINT32_C(0x4000)); break; /* post opc */
        case 8U: put_u64(trace + 16U, UINT64_C(0x0001000000000000)); break;
        case 9U: put_u64(trace + 24U, UINT64_C(0x0001000000000000)); break;
        case 10U: put_u32(trace + 192U, 2U); break; /* pre fault */
        case 11U: put_u32(trace + 204U, 2U); break; /* pre interrupt pending */
        case 12U: put_u32(trace + 188U, 2U); break; /* MD delayed phase */
        case 13U: put_u32(trace + 72U, 2U); break;  /* executed */
        case 14U: put_u32(trace + 76U, 2U); break;  /* inhibited */
        case 15U: put_u32(trace + 80U, 2U); break;  /* decoded */
        case 16U: put_u32(trace + 84U, UINT32_C(0x1000)); break; /* mask */
        case 17U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_A_SOURCE);
            put_u32(trace + 44U, 1024U);
            break;
        case 18U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_M_SOURCE);
            put_u32(trace + 176U, 2U);
            break;
        case 19U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_M_SOURCE);
            put_u32(trace + 48U, 32U);
            break;
        case 20U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_DESTINATION);
            break;
        case 21U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_DESTINATION);
            put_u32(trace + 180U, 1U);
            put_u32(trace + 184U, 1024U);
            break;
        case 22U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_DESTINATION);
            put_u32(trace + 180U, 2U);
            put_u32(trace + 184U, 32U);
            break;
        case 23U: put_u32(trace + 180U, 1U); break; /* value without valid */
        case 24U: put_u32(trace + 200U, UINT32_C(0x10000)); break;
        case 25U: put_u32(trace + 136U, 1U); break; /* pending mismatch */
        case 26U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_CLASS_OUTCOME);
            break;
        case 27U: put_u32(trace + 140U, 1U); break; /* outcome without valid */
        case 28U:
            put_u32(trace + 84U, CADR_TRACE_LATCH_VALID_CLASS_OUTCOME);
            put_u32(trace + 140U, 5U);
            break;
        case 29U: put_u32(trace + 128U, 2U); break; /* post fault */
        case 30U: put_u32(trace + 196U, 2U); break; /* fault code */
        case 31U: put_u32(trace + 136U, 2U); break; /* post pending */
        case 32U: put_u32(trace + 176U, 1U); break; /* M tuple without valid */
        default: break;
        }
        reseal_chunk(mutated, length, 8U);
        context.rebuild_calls = 0U;
        context.validate_calls = 0U;
        assert_rejected(mutated, length, &hooks);
        CHECK(context.rebuild_calls == 0U);
        CHECK(context.validate_calls == 0U);
        free(mutated);
    }
    free(bytes);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_sha256_and_chunk_integrity_vectors();
    test_descriptor_wire_round_trips();
    test_zero_length_queued_completion();
    test_deterministic_round_trip_and_queued_completion();
    test_pending_request_and_rejection_atomicity();
    test_integrity_directory_and_extension_rejections();
    test_self_consistent_semantic_negative_matrix();
    test_derived_storage_and_pointer_are_omitted();
    test_shared_trace_latch_negative_matrix();
    if (failures != 0) return 1;
    (void)puts("cadr_snapshot: ok");
    return 0;
}
