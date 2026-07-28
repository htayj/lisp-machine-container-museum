/*
 * CDRSTATE2 logical continuation-state digest and bounded Merkle cache.
 *
 * This is a clean-room deterministic serialization layer.  It deliberately
 * does not serialize C structure padding, allocation addresses, or the cache
 * itself.  The fixed-size trees make a boundary digest proportional to scalar
 * state and root count, not to RAM size.
 */

#include "cadr_state_v2.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define CADR_STATE_V2_U48_MASK UINT64_C(0x0000ffffffffffff)

typedef struct cadr_state_v2_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t block_used;
} cadr_state_v2_sha256;

typedef struct cadr_state_v2_tree {
    uint8_t (*nodes)[CADR_STATE_V2_SHA256_BYTES];
    uint32_t leaves;
} cadr_state_v2_tree;

/*
 * Tags are stable only inside CDRSTATE2.  The table is intentionally explicit:
 * review of a state-structure change must add a ledger entry and a serializer
 * call, otherwise the focused schema test fails.
 */
static const cadr_state_v2_schema_entry cadr_state_v2_schema[] = {
    { 1U, CADR_STATE_V2_SCHEMA_SCALAR, "machine.clock_slots_completed" },
    { 2U, CADR_STATE_V2_SCHEMA_SCALAR, "machine.lifecycle" },
    { 3U, CADR_STATE_V2_SCHEMA_SCALAR, "machine.in_host_completion" },
    { 4U, CADR_STATE_V2_SCHEMA_SCALAR, "machine.profile" },

    { 100U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.microinstructions_executed" },
    { 101U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.guest_fault" },
    { 102U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p0" },
    { 103U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p1" },
    { 104U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.debug_ir" },
    { 105U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.instruction_write_register" },
    { 106U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p0_pc" },
    { 107U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p1_pc" },
    { 108U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.next_micro_pc" },
    { 109U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.micro_stack_pointer" },
    { 110U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.dispatch_constant" },
    { 111U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.pdl_pointer" },
    { 112U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.pdl_index" },
    { 113U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.vma" },
    { 114U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.md" },
    { 115U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.location_counter" },
    { 116U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.oa_low" },
    { 117U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.oa_high" },
    { 118U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.opc" },
    { 119U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.q" },
    { 120U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.old_q" },
    { 121U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.interrupt_control" },
    { 122U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.pending_md" },
    { 123U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.pending_md_delay" },
    { 124U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.alu_carry" },
    { 125U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.alu_out" },
    { 126U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.out" },
    { 127U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.interrupt_pending" },
    { 128U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_a_address" },
    { 129U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_m_address" },
    { 130U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_a_data" },
    { 131U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_m_data" },
    { 132U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_initial_m_data" },
    { 133U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.decoded_class" },
    { 134U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.effective_popj" },
    { 135U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p0_imem" },
    { 136U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.p1_imem" },
    { 137U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.inhibit" },
    { 138U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.oa_low_pending" },
    { 139U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.oa_high_pending" },
    { 140U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.halted" },
    { 141U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.prom_disabled" },
    { 142U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.vma_ok" },
    { 143U, CADR_STATE_V2_SCHEMA_SCALAR, "cpu.main_memory_nxm" },

    { 200U, CADR_STATE_V2_SCHEMA_SCALAR, "memory.mapped_words" },
    { 201U, CADR_STATE_V2_SCHEMA_SCALAR, "memory.initialized" },
    { 202U, CADR_STATE_V2_SCHEMA_SCALAR, "memory.main_memory_pages" },

    { 300U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.guest_tick" },
    { 301U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.interrupt_pending" },
    { 302U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.interrupt_status" },
    { 303U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.error_status" },
    { 304U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.instruction" },
    { 305U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.debug_instruction" },
    { 306U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.opc" },
    { 307U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.next_micro_pc" },
    { 308U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.output_bus" },
    { 309U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.m_source" },
    { 310U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.a_source" },
    { 311U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.machine_error" },
    { 312U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.single_step_done" },
    { 313U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.running" },
    { 314U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.write_map" },
    { 315U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.destination_spc" },
    { 316U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.instruction_write" },
    { 317U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.instruction_modify" },
    { 318U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.pdl_write" },
    { 319U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.spc_push" },
    { 320U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.instruction_parity" },
    { 321U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.nop" },
    { 322U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.vma_ok" },
    { 323U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.jump_condition" },
    { 324U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.diagnostic.next_pc_source" },
    { 325U, CADR_STATE_V2_SCHEMA_SCALAR, "bus.nxm_inhibited" },

    { 400U, CADR_STATE_V2_SCHEMA_SCALAR, "canonical.mutation_ordinal" },
    { 401U, CADR_STATE_V2_SCHEMA_SCALAR, "canonical.first_mutation_ordinal" },
    { 402U, CADR_STATE_V2_SCHEMA_SCALAR, "canonical.mutation_count" },
    { 403U, CADR_STATE_V2_SCHEMA_SCALAR, "canonical.initialized" },
    { 404U, CADR_STATE_V2_SCHEMA_SCALAR, "canonical.overflowed" },
    { 405U, CADR_STATE_V2_SCHEMA_BYTES, "canonical.mutation_events" },
    { 406U, CADR_STATE_V2_SCHEMA_BYTES, "canonical.mutation_sha256" },

    { 500U, CADR_STATE_V2_SCHEMA_SCALAR, "devices.event_sequence" },
    { 501U, CADR_STATE_V2_SCHEMA_SCALAR, "devices.initialized" },
    { 502U, CADR_STATE_V2_SCHEMA_SCALAR, "devices.tv_mode" },
    { 503U, CADR_STATE_V2_SCHEMA_SCALAR, "devices.tv_vert_spacing" },
    { 504U, CADR_STATE_V2_SCHEMA_SCALAR, "devices.tv_sync_ptr" },

    { 600U, CADR_STATE_V2_SCHEMA_SCALAR, "events.generation" },
    { 601U, CADR_STATE_V2_SCHEMA_SCALAR, "events.next_request_id" },
    { 602U, CADR_STATE_V2_SCHEMA_SCALAR, "events.outstanding_request_id" },
    { 603U, CADR_STATE_V2_SCHEMA_SCALAR, "events.last_completed_request_id" },
    { 604U, CADR_STATE_V2_SCHEMA_BYTES, "events.request_descriptor" },
    { 605U, CADR_STATE_V2_SCHEMA_SCALAR, "events.request_descriptor_byte_count" },
    { 606U, CADR_STATE_V2_SCHEMA_SCALAR, "events.expected_completion_byte_count" },
    { 607U, CADR_STATE_V2_SCHEMA_ROOT, "events.completion_bytes" },
    { 608U, CADR_STATE_V2_SCHEMA_SCALAR, "events.completion_byte_count" },
    { 609U, CADR_STATE_V2_SCHEMA_SCALAR, "events.outstanding_operation" },
    { 610U, CADR_STATE_V2_SCHEMA_SCALAR, "events.completion_host_status" },
    { 611U, CADR_STATE_V2_SCHEMA_SCALAR, "events.completion_queued" },
    { 612U, CADR_STATE_V2_SCHEMA_SCALAR, "events.persistent_status" },
    { 613U, CADR_STATE_V2_SCHEMA_SCALAR, "events.unexpected_bus_operation" },

    { 700U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.instruction_ordinal" },
    { 701U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.event_sequence" },
    { 702U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.raw_fetched_word" },
    { 703U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.effective_word" },
    { 704U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pc" },
    { 705U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.store_selector" },
    { 706U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.operation" },
    { 707U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.a_address" },
    { 708U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.m_address" },
    { 709U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.a_value" },
    { 710U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.m_value" },
    { 711U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.instruction_memory" },
    { 712U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.functional_m_source" },
    { 713U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.effective_popj" },
    { 714U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.last_slot_executed" },
    { 715U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.last_slot_inhibited" },
    { 716U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.decoded" },
    { 717U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.valid_mask" },
    { 718U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_destination" },
    { 719U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_q" },
    { 720U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_vma" },
    { 721U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_md" },
    { 722U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_macro_pc" },
    { 723U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_destination_value" },
    { 724U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_q" },
    { 725U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_vma" },
    { 726U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_md" },
    { 727U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_macro_pc" },
    { 728U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_fault" },
    { 729U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_interrupt_status" },
    { 730U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_interrupt_pending" },
    { 731U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.class_outcome" },
    { 732U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_p0_pc" },
    { 733U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_p1_pc" },
    { 734U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_next_micro_pc" },
    { 735U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_opc" },
    { 736U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_p0_pc" },
    { 737U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_p1_pc" },
    { 738U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_next_micro_pc" },
    { 739U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.post_opc" },
    { 740U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.m_source_kind" },
    { 741U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.destination_kind" },
    { 742U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.destination_address" },
    { 743U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.md_delayed_phase" },
    { 744U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_fault" },
    { 745U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.fault_code" },
    { 746U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_interrupt_status" },
    { 747U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.pre_interrupt_pending" },
    { 748U, CADR_STATE_V2_SCHEMA_SCALAR, "trace.interrupt_level" },

    { 800U, CADR_STATE_V2_SCHEMA_SCALAR, "artifacts.boot_configuration_ingressed" },
    { 801U, CADR_STATE_V2_SCHEMA_SCALAR, "artifacts.control_store_ingressed" },
    { 802U, CADR_STATE_V2_SCHEMA_SCALAR, "artifacts.base_disk_verified" },
    { 803U, CADR_STATE_V2_SCHEMA_SCALAR, "artifacts.prom_symbols_verified" },
    { 804U, CADR_STATE_V2_SCHEMA_SCALAR, "artifacts.microcode_symbols_verified" },

    { 900U, CADR_STATE_V2_SCHEMA_ROOT, "root.prom" },
    { 901U, CADR_STATE_V2_SCHEMA_ROOT, "root.imem" },
    { 902U, CADR_STATE_V2_SCHEMA_ROOT, "root.amem" },
    { 903U, CADR_STATE_V2_SCHEMA_ROOT, "root.mmem" },
    { 904U, CADR_STATE_V2_SCHEMA_ROOT, "root.dispatch" },
    { 905U, CADR_STATE_V2_SCHEMA_ROOT, "root.pdl" },
    { 906U, CADR_STATE_V2_SCHEMA_ROOT, "root.spc" },
    { 907U, CADR_STATE_V2_SCHEMA_ROOT, "root.l1" },
    { 908U, CADR_STATE_V2_SCHEMA_ROOT, "root.l2" },
    { 909U, CADR_STATE_V2_SCHEMA_ROOT, "root.main_ram" },
    { 910U, CADR_STATE_V2_SCHEMA_ROOT, "root.tv_sync" },
    { 911U, CADR_STATE_V2_SCHEMA_ROOT, "root.tv_screen" },
    { 912U, CADR_STATE_V2_SCHEMA_ROOT, "root.bus_maps" }
};

static uint32_t cadr_state_v2_rotr32(const uint32_t value, const uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void cadr_state_v2_sha256_transform(cadr_state_v2_sha256 *context,
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
    uint32_t words[64];
    uint32_t a, b, c, d, e, f, g, h, index;

    for (index = 0U; index < 16U; ++index) {
        const uint32_t offset = index * 4U;
        words[index] = ((uint32_t)block[offset] << 24U) |
                       ((uint32_t)block[offset + 1U] << 16U) |
                       ((uint32_t)block[offset + 2U] << 8U) |
                       (uint32_t)block[offset + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = cadr_state_v2_rotr32(words[index - 15U], 7U) ^
            cadr_state_v2_rotr32(words[index - 15U], 18U) ^
            (words[index - 15U] >> 3U);
        const uint32_t s1 = cadr_state_v2_rotr32(words[index - 2U], 17U) ^
            cadr_state_v2_rotr32(words[index - 2U], 19U) ^
            (words[index - 2U] >> 10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t sum1 = cadr_state_v2_rotr32(e, 6U) ^
            cadr_state_v2_rotr32(e, 11U) ^ cadr_state_v2_rotr32(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temporary1 = h + sum1 + choose + constants[index] + words[index];
        const uint32_t sum0 = cadr_state_v2_rotr32(a, 2U) ^
            cadr_state_v2_rotr32(a, 13U) ^ cadr_state_v2_rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary2 = sum0 + majority;
        h = g; g = f; f = e; e = d + temporary1;
        d = c; c = b; b = a; a = temporary1 + temporary2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void cadr_state_v2_sha256_init(cadr_state_v2_sha256 *context)
{
    context->state[0] = UINT32_C(0x6a09e667); context->state[1] = UINT32_C(0xbb67ae85);
    context->state[2] = UINT32_C(0x3c6ef372); context->state[3] = UINT32_C(0xa54ff53a);
    context->state[4] = UINT32_C(0x510e527f); context->state[5] = UINT32_C(0x9b05688c);
    context->state[6] = UINT32_C(0x1f83d9ab); context->state[7] = UINT32_C(0x5be0cd19);
    context->bit_count = 0U;
    context->block_used = 0U;
}

static void cadr_state_v2_sha256_update(cadr_state_v2_sha256 *context,
                                        const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t available = UINT32_C(64) - context->block_used;
        const uint32_t take = count < (uint64_t)available ? (uint32_t)count : available;
        (void)memcpy(context->block + context->block_used, bytes, take);
        context->block_used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        count -= take;
        if (context->block_used == 64U) {
            cadr_state_v2_sha256_transform(context, context->block);
            context->block_used = 0U;
        }
    }
}

static void cadr_state_v2_sha256_final(cadr_state_v2_sha256 *context,
                                       uint8_t output[CADR_STATE_V2_SHA256_BYTES])
{
    uint8_t trailer[64];
    uint32_t index;
    const uint64_t bits = context->bit_count;

    trailer[0] = UINT8_C(0x80);
    if (context->block_used < 56U) {
        (void)memset(trailer + 1U, 0, 55U - context->block_used);
        cadr_state_v2_sha256_update(context, trailer, 56U - context->block_used);
    } else {
        (void)memset(trailer + 1U, 0, 63U - context->block_used);
        cadr_state_v2_sha256_update(context, trailer, 64U - context->block_used);
        (void)memset(trailer, 0, 56U);
        cadr_state_v2_sha256_update(context, trailer, 56U);
    }
    for (index = 0U; index < 8U; ++index) {
        trailer[index] = (uint8_t)(bits >> ((7U - index) * 8U));
    }
    cadr_state_v2_sha256_update(context, trailer, 8U);
    for (index = 0U; index < 8U; ++index) {
        output[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        output[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        output[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        output[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

#ifdef CADR_STATE_V2_TESTING
void cadr_state_v2_test_sha256(const uint8_t *bytes, const uint64_t count,
                               uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_state_v2_sha256 context;
    cadr_state_v2_sha256_init(&context);
    if (count != 0U) cadr_state_v2_sha256_update(&context, bytes, count);
    cadr_state_v2_sha256_final(&context, digest);
}
#endif

static void cadr_state_v2_put16(uint8_t output[2], const uint16_t value)
{
    output[0] = (uint8_t)value;
    output[1] = (uint8_t)(value >> 8U);
}

static void cadr_state_v2_put32(uint8_t output[4], const uint32_t value)
{
    output[0] = (uint8_t)value;
    output[1] = (uint8_t)(value >> 8U);
    output[2] = (uint8_t)(value >> 16U);
    output[3] = (uint8_t)(value >> 24U);
}

static void cadr_state_v2_put64(uint8_t output[8], const uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        output[index] = (uint8_t)(value >> (index * 8U));
    }
}

static uint64_t cadr_state_v2_domain_size(const char *domain)
{
    uint64_t count = 0U;
    while (domain[count] != '\0') count += UINT64_C(1);
    return count + UINT64_C(1);
}

static void cadr_state_v2_hash_begin(cadr_state_v2_sha256 *context,
                                     const char *domain)
{
    cadr_state_v2_sha256_init(context);
    cadr_state_v2_sha256_update(context, (const uint8_t *)domain,
                                cadr_state_v2_domain_size(domain));
}

static void cadr_state_v2_hash_u32(cadr_state_v2_sha256 *context, uint32_t value)
{
    uint8_t bytes[4];
    cadr_state_v2_put32(bytes, value);
    cadr_state_v2_sha256_update(context, bytes, sizeof(bytes));
}

static void cadr_state_v2_hash_u16(cadr_state_v2_sha256 *context, uint16_t value)
{
    uint8_t bytes[2];
    cadr_state_v2_put16(bytes, value);
    cadr_state_v2_sha256_update(context, bytes, sizeof(bytes));
}

static void cadr_state_v2_hash_u64(cadr_state_v2_sha256 *context, uint64_t value)
{
    uint8_t bytes[8];
    cadr_state_v2_put64(bytes, value);
    cadr_state_v2_sha256_update(context, bytes, sizeof(bytes));
}

static void cadr_state_v2_tree_leaf_header(cadr_state_v2_sha256 *context,
                                           uint32_t root, uint32_t block,
                                           uint32_t elements, uint32_t width)
{
    cadr_state_v2_hash_begin(context, "CDRSTATE2-LEAF");
    cadr_state_v2_hash_u32(context, root);
    cadr_state_v2_hash_u32(context, block);
    cadr_state_v2_hash_u32(context, elements);
    cadr_state_v2_hash_u32(context, width);
}

static void cadr_state_v2_hash_parent(uint32_t root, uint32_t level,
                                      const uint8_t left[CADR_STATE_V2_SHA256_BYTES],
                                      const uint8_t right[CADR_STATE_V2_SHA256_BYTES],
                                      uint8_t output[CADR_STATE_V2_SHA256_BYTES])
{
    cadr_state_v2_sha256 context;
    cadr_state_v2_hash_begin(&context, "CDRSTATE2-NODE");
    cadr_state_v2_hash_u32(&context, root);
    cadr_state_v2_hash_u32(&context, level);
    cadr_state_v2_sha256_update(&context, left, CADR_STATE_V2_SHA256_BYTES);
    cadr_state_v2_sha256_update(&context, right, CADR_STATE_V2_SHA256_BYTES);
    cadr_state_v2_sha256_final(&context, output);
}

static cadr_state_v2_tree cadr_state_v2_tree_for(cadr_machine_state *state,
                                                  enum cadr_state_v2_root root)
{
    cadr_state_v2_cache *cache = &state->trace.state_v2;
    cadr_state_v2_tree result;
    result.nodes = NULL;
    result.leaves = 0U;
    switch (root) {
    case CADR_STATE_V2_ROOT_PROM: result.nodes = cache->prom_nodes; result.leaves = CADR_STATE_V2_PROM_LEAVES; break;
    case CADR_STATE_V2_ROOT_IMEM: result.nodes = cache->imem_nodes; result.leaves = CADR_STATE_V2_IMEM_LEAVES; break;
    case CADR_STATE_V2_ROOT_AMEM: result.nodes = cache->amem_nodes; result.leaves = CADR_STATE_V2_AMEM_LEAVES; break;
    case CADR_STATE_V2_ROOT_MMEM: result.nodes = cache->mmem_nodes; result.leaves = CADR_STATE_V2_MMEM_LEAVES; break;
    case CADR_STATE_V2_ROOT_DISPATCH: result.nodes = cache->dispatch_nodes; result.leaves = CADR_STATE_V2_DISPATCH_LEAVES; break;
    case CADR_STATE_V2_ROOT_PDL: result.nodes = cache->pdl_nodes; result.leaves = CADR_STATE_V2_PDL_LEAVES; break;
    case CADR_STATE_V2_ROOT_SPC: result.nodes = cache->spc_nodes; result.leaves = CADR_STATE_V2_SPC_LEAVES; break;
    case CADR_STATE_V2_ROOT_L1: result.nodes = cache->l1_nodes; result.leaves = CADR_STATE_V2_L1_LEAVES; break;
    case CADR_STATE_V2_ROOT_L2: result.nodes = cache->l2_nodes; result.leaves = CADR_STATE_V2_L2_LEAVES; break;
    case CADR_STATE_V2_ROOT_MAIN_RAM: result.nodes = cache->main_ram_nodes; result.leaves = CADR_STATE_V2_MAIN_RAM_LEAVES; break;
    case CADR_STATE_V2_ROOT_TV_SYNC: result.nodes = cache->tv_sync_nodes; result.leaves = CADR_STATE_V2_TV_SYNC_LEAVES; break;
    case CADR_STATE_V2_ROOT_TV_SCREEN: result.nodes = cache->tv_screen_nodes; result.leaves = CADR_STATE_V2_TV_SCREEN_LEAVES; break;
    case CADR_STATE_V2_ROOT_BUS_MAPS: result.nodes = cache->bus_map_nodes; result.leaves = CADR_STATE_V2_BUS_MAP_LEAVES; break;
    default: break;
    }
    return result;
}

static void cadr_state_v2_leaf(cadr_machine_state *state,
                               enum cadr_state_v2_root root,
                               uint32_t block,
                               uint8_t output[CADR_STATE_V2_SHA256_BYTES])
{
    cadr_state_v2_sha256 context;
    uint32_t index;
    switch (root) {
    case CADR_STATE_V2_ROOT_PROM:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 8U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u64(&context, state->memory.prom[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_IMEM:
        cadr_state_v2_tree_leaf_header(&context, root, block, 64U, 8U);
        for (index = 0U; index < 64U; ++index) cadr_state_v2_hash_u64(&context, state->memory.imem[block * 64U + index]);
        break;
    case CADR_STATE_V2_ROOT_AMEM:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->cpu.a_memory[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_MMEM:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->cpu.m_memory[index]);
        break;
    case CADR_STATE_V2_ROOT_DISPATCH:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->cpu.dispatch_memory[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_PDL:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->cpu.pdl[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_SPC:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->cpu.micro_stack[index]);
        break;
    case CADR_STATE_V2_ROOT_L1:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->memory.l1_map[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_L2:
        cadr_state_v2_tree_leaf_header(&context, root, block, 32U, 4U);
        for (index = 0U; index < 32U; ++index) cadr_state_v2_hash_u32(&context, state->memory.l2_map[block * 32U + index]);
        break;
    case CADR_STATE_V2_ROOT_MAIN_RAM:
        cadr_state_v2_tree_leaf_header(&context, root, block, 256U, 4U);
        for (index = 0U; index < 256U; ++index) cadr_state_v2_hash_u32(&context, state->memory.main_memory[block][index]);
        break;
    case CADR_STATE_V2_ROOT_TV_SYNC:
        cadr_state_v2_tree_leaf_header(&context, root, block, 256U, 1U);
        cadr_state_v2_sha256_update(&context, state->devices.tv_sync_ram + block * 256U, 256U);
        break;
    case CADR_STATE_V2_ROOT_TV_SCREEN:
        cadr_state_v2_tree_leaf_header(&context, root, block, 256U, 4U);
        for (index = 0U; index < 256U; ++index) cadr_state_v2_hash_u32(&context, state->devices.tv_screen[block * 256U + index]);
        break;
    case CADR_STATE_V2_ROOT_BUS_MAPS:
        cadr_state_v2_tree_leaf_header(&context, root, block, 2U, 2U);
        cadr_state_v2_hash_u16(&context, state->bus.unibus_map[block]);
        cadr_state_v2_hash_u16(&context, state->bus.unibus_halfword[block]);
        break;
    default:
        cadr_state_v2_hash_begin(&context, "CDRSTATE2-INVALID-ROOT");
        cadr_state_v2_hash_u32(&context, (uint32_t)root);
        cadr_state_v2_hash_u32(&context, block);
        break;
    }
    cadr_state_v2_sha256_final(&context, output);
}

static void cadr_state_v2_tree_build(cadr_machine_state *state,
                                     enum cadr_state_v2_root root)
{
    cadr_state_v2_tree tree = cadr_state_v2_tree_for(state, root);
    uint32_t leaf;
    uint32_t width;
    uint32_t level;
    if (tree.nodes == NULL || tree.leaves == 0U) return;
    for (leaf = 0U; leaf < tree.leaves; ++leaf) {
        cadr_state_v2_leaf(state, root, leaf, tree.nodes[tree.leaves + leaf]);
    }
    level = 0U;
    for (width = tree.leaves; width > 1U; width >>= 1U, ++level) {
        uint32_t parent;
        for (parent = 0U; parent < width / 2U; ++parent) {
            const uint32_t node = (width >> 1U) + parent;
            cadr_state_v2_hash_parent(root, level,
                                      tree.nodes[node * 2U], tree.nodes[node * 2U + 1U],
                                      tree.nodes[node]);
        }
    }
    (void)memcpy(state->trace.state_v2.roots[root], tree.nodes[1], CADR_STATE_V2_SHA256_BYTES);
}

static void cadr_state_v2_tree_update(cadr_machine_state *state,
                                      enum cadr_state_v2_root root,
                                      uint32_t leaf)
{
    cadr_state_v2_tree tree;
    uint32_t node;
    uint32_t level;
    if (state == NULL || state->trace.state_v2.initialized == 0U) return;
    tree = cadr_state_v2_tree_for(state, root);
    if (tree.nodes == NULL || leaf >= tree.leaves) return;
    node = tree.leaves + leaf;
    cadr_state_v2_leaf(state, root, leaf, tree.nodes[node]);
    level = 0U;
    while (node > 1U) {
        const uint32_t parent = node >> 1U;
        cadr_state_v2_hash_parent(root, level,
                                  tree.nodes[parent * 2U], tree.nodes[parent * 2U + 1U],
                                  tree.nodes[parent]);
        node = parent;
        level += 1U;
    }
    (void)memcpy(state->trace.state_v2.roots[root], tree.nodes[1], CADR_STATE_V2_SHA256_BYTES);
}

static int cadr_state_v2_completion_root(cadr_machine_state *state)
{
    cadr_state_v2_sha256 context;
    const cadr_event_state *events = &state->events;
    cadr_state_v2_hash_begin(&context, "CDRSTATE2-COMPLETION");
    cadr_state_v2_hash_u64(&context, events->completion_byte_count);
    if (events->completion_byte_count != 0U) {
        if (events->completion_bytes == NULL) return 0;
        cadr_state_v2_sha256_update(&context, events->completion_bytes,
                                    events->completion_byte_count);
    }
    cadr_state_v2_sha256_final(&context, state->trace.state_v2.completion_root);
    return 1;
}

uint32_t cadr_state_v2_schema_entry_count(void)
{
    return (uint32_t)(sizeof(cadr_state_v2_schema) / sizeof(cadr_state_v2_schema[0]));
}

const cadr_state_v2_schema_entry *cadr_state_v2_schema_entries(void)
{
    return cadr_state_v2_schema;
}

cadr_status cadr_state_v2_rebuild(cadr_machine_state *state)
{
    uint32_t root;
    uint64_t prior_ordinal;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    prior_ordinal = state->trace.state_v2.rebuild_ordinal;
    (void)memset(&state->trace.state_v2, 0, sizeof(state->trace.state_v2));
    for (root = 0U; root < CADR_STATE_V2_ROOT_COUNT; ++root) {
        cadr_state_v2_tree_build(state, (enum cadr_state_v2_root)root);
    }
    if (cadr_state_v2_completion_root(state) == 0) {
        (void)memset(&state->trace.state_v2, 0, sizeof(state->trace.state_v2));
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    state->trace.state_v2.initialized = 1U;
    state->trace.state_v2.schema_version = CADR_STATE_V2_SCHEMA_VERSION;
    state->trace.state_v2.rebuild_ordinal = prior_ordinal + UINT64_C(1);
    return CADR_STATUS_OK;
}

void cadr_state_v2_invalidate(cadr_machine_state *state)
{
    if (state == NULL) return;
    state->trace.state_v2.initialized = 0U;
    state->trace.state_v2.schema_version = 0U;
}

void cadr_state_v2_note_u64_write(cadr_machine_state *state,
                                  enum cadr_state_v2_root root,
                                  uint32_t index)
{
    switch (root) {
    case CADR_STATE_V2_ROOT_PROM: cadr_state_v2_tree_update(state, root, index / 32U); break;
    case CADR_STATE_V2_ROOT_IMEM: cadr_state_v2_tree_update(state, root, index / 64U); break;
    default: break;
    }
}

void cadr_state_v2_note_u32_write(cadr_machine_state *state,
                                  enum cadr_state_v2_root root,
                                  uint32_t index)
{
    switch (root) {
    case CADR_STATE_V2_ROOT_AMEM:
    case CADR_STATE_V2_ROOT_DISPATCH:
    case CADR_STATE_V2_ROOT_PDL:
    case CADR_STATE_V2_ROOT_L1:
    case CADR_STATE_V2_ROOT_L2:
        cadr_state_v2_tree_update(state, root, index / 32U); break;
    case CADR_STATE_V2_ROOT_MMEM:
    case CADR_STATE_V2_ROOT_SPC:
        cadr_state_v2_tree_update(state, root, 0U); break;
    case CADR_STATE_V2_ROOT_MAIN_RAM:
        cadr_state_v2_tree_update(state, root, index / 256U); break;
    case CADR_STATE_V2_ROOT_TV_SCREEN:
        cadr_state_v2_tree_update(state, root, index / 256U); break;
    default: break;
    }
}

void cadr_state_v2_note_u8_write(cadr_machine_state *state,
                                 enum cadr_state_v2_root root,
                                 uint32_t index)
{
    if (root == CADR_STATE_V2_ROOT_TV_SYNC) {
        cadr_state_v2_tree_update(state, root, index / 256U);
    }
}

void cadr_state_v2_note_bus_map_write(cadr_machine_state *state,
                                      uint32_t index)
{
    cadr_state_v2_tree_update(state, CADR_STATE_V2_ROOT_BUS_MAPS, index);
}

void cadr_state_v2_note_completion_changed(cadr_machine_state *state)
{
    if (state == NULL || state->trace.state_v2.initialized == 0U) return;
    if (cadr_state_v2_completion_root(state) == 0) {
        state->trace.state_v2.initialized = 0U;
    }
}

static void cadr_state_v2_field(cadr_state_v2_sha256 *context, const uint32_t tag,
                                const uint8_t *bytes, const uint32_t byte_count)
{
    cadr_state_v2_hash_u32(context, tag);
    cadr_state_v2_hash_u32(context, byte_count);
    if (byte_count != 0U) cadr_state_v2_sha256_update(context, bytes, byte_count);
}

static void cadr_state_v2_field_u32(cadr_state_v2_sha256 *context,
                                    uint32_t tag, uint32_t value)
{
    uint8_t bytes[4];
    cadr_state_v2_put32(bytes, value);
    cadr_state_v2_field(context, tag, bytes, sizeof(bytes));
}

static void cadr_state_v2_field_u64(cadr_state_v2_sha256 *context,
                                    uint32_t tag, uint64_t value)
{
    uint8_t bytes[8];
    cadr_state_v2_put64(bytes, value);
    cadr_state_v2_field(context, tag, bytes, sizeof(bytes));
}

static void cadr_state_v2_field_root(cadr_state_v2_sha256 *context,
                                     uint32_t tag,
                                     const uint8_t root[CADR_STATE_V2_SHA256_BYTES])
{
    cadr_state_v2_field(context, tag, root, CADR_STATE_V2_SHA256_BYTES);
}

static void cadr_state_v2_digest_cpu(cadr_state_v2_sha256 *context,
                                     const cadr_cpu_state *cpu)
{
    cadr_state_v2_field_u64(context, 100U, cpu->microinstructions_executed);
    cadr_state_v2_field_u32(context, 101U, cpu->guest_fault);
    cadr_state_v2_field_u64(context, 102U, cpu->p0 & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u64(context, 103U, cpu->p1 & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u64(context, 104U, cpu->debug_ir & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u64(context, 105U, cpu->instruction_write_register & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u32(context, 106U, cpu->p0_pc); cadr_state_v2_field_u32(context, 107U, cpu->p1_pc);
    cadr_state_v2_field_u32(context, 108U, cpu->next_micro_pc); cadr_state_v2_field_u32(context, 109U, cpu->micro_stack_pointer);
    cadr_state_v2_field_u32(context, 110U, cpu->dispatch_constant); cadr_state_v2_field_u32(context, 111U, cpu->pdl_pointer);
    cadr_state_v2_field_u32(context, 112U, cpu->pdl_index); cadr_state_v2_field_u32(context, 113U, cpu->vma);
    cadr_state_v2_field_u32(context, 114U, cpu->md); cadr_state_v2_field_u32(context, 115U, cpu->location_counter);
    cadr_state_v2_field_u32(context, 116U, cpu->oa_low); cadr_state_v2_field_u32(context, 117U, cpu->oa_high);
    cadr_state_v2_field_u32(context, 118U, cpu->opc); cadr_state_v2_field_u32(context, 119U, cpu->q);
    cadr_state_v2_field_u32(context, 120U, cpu->old_q); cadr_state_v2_field_u32(context, 121U, cpu->interrupt_control);
    cadr_state_v2_field_u32(context, 122U, cpu->pending_md); cadr_state_v2_field_u32(context, 123U, cpu->pending_md_delay);
    cadr_state_v2_field_u32(context, 124U, cpu->alu_carry); cadr_state_v2_field_u32(context, 125U, cpu->alu_out);
    cadr_state_v2_field_u32(context, 126U, cpu->out); cadr_state_v2_field_u32(context, 127U, cpu->interrupt_pending);
    cadr_state_v2_field_u32(context, 128U, cpu->decoded_a_address); cadr_state_v2_field_u32(context, 129U, cpu->decoded_m_address);
    cadr_state_v2_field_u32(context, 130U, cpu->decoded_a_data); cadr_state_v2_field_u32(context, 131U, cpu->decoded_m_data);
    cadr_state_v2_field_u32(context, 132U, cpu->decoded_initial_m_data); cadr_state_v2_field_u32(context, 133U, cpu->decoded_class);
    cadr_state_v2_field_u32(context, 134U, cpu->effective_popj); cadr_state_v2_field_u32(context, 135U, cpu->p0_imem);
    cadr_state_v2_field_u32(context, 136U, cpu->p1_imem); cadr_state_v2_field_u32(context, 137U, cpu->inhibit);
    cadr_state_v2_field_u32(context, 138U, cpu->oa_low_pending); cadr_state_v2_field_u32(context, 139U, cpu->oa_high_pending);
    cadr_state_v2_field_u32(context, 140U, cpu->halted); cadr_state_v2_field_u32(context, 141U, cpu->prom_disabled);
    cadr_state_v2_field_u32(context, 142U, cpu->vma_ok); cadr_state_v2_field_u32(context, 143U, cpu->main_memory_nxm);
}

static void cadr_state_v2_digest_bus(cadr_state_v2_sha256 *context,
                                     const cadr_bus_state *bus)
{
    const cadr_diagnostic_latches *d = &bus->diagnostic;
    cadr_state_v2_field_u64(context, 300U, bus->guest_tick);
    cadr_state_v2_field_u32(context, 301U, bus->interrupt_pending);
    cadr_state_v2_field_u32(context, 302U, bus->interrupt_status);
    cadr_state_v2_field_u32(context, 303U, bus->error_status);
    cadr_state_v2_field_u64(context, 304U, d->instruction & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u64(context, 305U, d->debug_instruction & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u32(context, 306U, d->opc); cadr_state_v2_field_u32(context, 307U, d->next_micro_pc);
    cadr_state_v2_field_u32(context, 308U, d->output_bus); cadr_state_v2_field_u32(context, 309U, d->m_source);
    cadr_state_v2_field_u32(context, 310U, d->a_source); cadr_state_v2_field_u32(context, 311U, d->machine_error);
    cadr_state_v2_field_u32(context, 312U, d->single_step_done); cadr_state_v2_field_u32(context, 313U, d->running);
    cadr_state_v2_field_u32(context, 314U, d->write_map); cadr_state_v2_field_u32(context, 315U, d->destination_spc);
    cadr_state_v2_field_u32(context, 316U, d->instruction_write); cadr_state_v2_field_u32(context, 317U, d->instruction_modify);
    cadr_state_v2_field_u32(context, 318U, d->pdl_write); cadr_state_v2_field_u32(context, 319U, d->spc_push);
    cadr_state_v2_field_u32(context, 320U, d->instruction_parity); cadr_state_v2_field_u32(context, 321U, d->nop);
    cadr_state_v2_field_u32(context, 322U, d->vma_ok); cadr_state_v2_field_u32(context, 323U, d->jump_condition);
    cadr_state_v2_field_u32(context, 324U, d->next_pc_source); cadr_state_v2_field_u32(context, 325U, bus->nxm_inhibited);
}

static void cadr_state_v2_digest_trace(cadr_state_v2_sha256 *context,
                                       const cadr_trace_state *trace)
{
    cadr_state_v2_field_u64(context, 700U, trace->instruction_ordinal);
    cadr_state_v2_field_u64(context, 701U, trace->event_sequence);
    cadr_state_v2_field_u64(context, 702U, trace->raw_fetched_word & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u64(context, 703U, trace->effective_word & CADR_STATE_V2_U48_MASK);
    cadr_state_v2_field_u32(context, 704U, trace->pc); cadr_state_v2_field_u32(context, 705U, trace->store_selector);
    cadr_state_v2_field_u32(context, 706U, trace->operation); cadr_state_v2_field_u32(context, 707U, trace->a_address);
    cadr_state_v2_field_u32(context, 708U, trace->m_address); cadr_state_v2_field_u32(context, 709U, trace->a_value);
    cadr_state_v2_field_u32(context, 710U, trace->m_value); cadr_state_v2_field_u32(context, 711U, trace->instruction_memory);
    cadr_state_v2_field_u32(context, 712U, trace->functional_m_source); cadr_state_v2_field_u32(context, 713U, trace->effective_popj);
    cadr_state_v2_field_u32(context, 714U, trace->last_slot_executed); cadr_state_v2_field_u32(context, 715U, trace->last_slot_inhibited);
    cadr_state_v2_field_u32(context, 716U, trace->decoded); cadr_state_v2_field_u32(context, 717U, trace->valid_mask);
    cadr_state_v2_field_u32(context, 718U, trace->pre_destination); cadr_state_v2_field_u32(context, 719U, trace->pre_q);
    cadr_state_v2_field_u32(context, 720U, trace->pre_vma); cadr_state_v2_field_u32(context, 721U, trace->pre_md);
    cadr_state_v2_field_u32(context, 722U, trace->pre_macro_pc); cadr_state_v2_field_u32(context, 723U, trace->post_destination_value);
    cadr_state_v2_field_u32(context, 724U, trace->post_q); cadr_state_v2_field_u32(context, 725U, trace->post_vma);
    cadr_state_v2_field_u32(context, 726U, trace->post_md); cadr_state_v2_field_u32(context, 727U, trace->post_macro_pc);
    cadr_state_v2_field_u32(context, 728U, trace->post_fault); cadr_state_v2_field_u32(context, 729U, trace->post_interrupt_status);
    cadr_state_v2_field_u32(context, 730U, trace->post_interrupt_pending); cadr_state_v2_field_u32(context, 731U, trace->class_outcome);
    cadr_state_v2_field_u32(context, 732U, trace->pre_p0_pc); cadr_state_v2_field_u32(context, 733U, trace->pre_p1_pc);
    cadr_state_v2_field_u32(context, 734U, trace->pre_next_micro_pc); cadr_state_v2_field_u32(context, 735U, trace->pre_opc);
    cadr_state_v2_field_u32(context, 736U, trace->post_p0_pc); cadr_state_v2_field_u32(context, 737U, trace->post_p1_pc);
    cadr_state_v2_field_u32(context, 738U, trace->post_next_micro_pc); cadr_state_v2_field_u32(context, 739U, trace->post_opc);
    cadr_state_v2_field_u32(context, 740U, trace->m_source_kind); cadr_state_v2_field_u32(context, 741U, trace->destination_kind);
    cadr_state_v2_field_u32(context, 742U, trace->destination_address); cadr_state_v2_field_u32(context, 743U, trace->md_delayed_phase);
    cadr_state_v2_field_u32(context, 744U, trace->pre_fault); cadr_state_v2_field_u32(context, 745U, trace->fault_code);
    cadr_state_v2_field_u32(context, 746U, trace->pre_interrupt_status); cadr_state_v2_field_u32(context, 747U, trace->pre_interrupt_pending);
    cadr_state_v2_field_u32(context, 748U, trace->interrupt_level);
}

cadr_status cadr_state_v2_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_state_v2_sha256 context;
    const cadr_event_state *events;
    uint32_t root;
    if (state == NULL || digest == NULL || state->trace.state_v2.initialized == 0U ||
        state->trace.state_v2.schema_version != CADR_STATE_V2_SCHEMA_VERSION) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    events = &state->events;
    if (events->request_descriptor_byte_count > CADR_MAX_HOST_DESCRIPTOR_BYTES ||
        (events->completion_byte_count != 0U && events->completion_bytes == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_state_v2_hash_begin(&context, "CDRSTATE2");
    cadr_state_v2_field_u32(&context, 0U, CADR_STATE_V2_SCHEMA_VERSION);
    cadr_state_v2_field_u64(&context, 1U, state->clock_slots_completed);
    cadr_state_v2_field_u32(&context, 2U, state->lifecycle);
    cadr_state_v2_field_u32(&context, 3U, state->in_host_completion);
    cadr_state_v2_field_u32(&context, 4U, state->profile);
    cadr_state_v2_digest_cpu(&context, &state->cpu);
    cadr_state_v2_field_u64(&context, 200U, state->memory.mapped_words);
    cadr_state_v2_field_u32(&context, 201U, state->memory.initialized);
    cadr_state_v2_field_u32(&context, 202U, state->memory.main_memory_pages);
    cadr_state_v2_digest_bus(&context, &state->bus);
    cadr_state_v2_field_u64(&context, 400U, state->canonical.mutation_ordinal);
    cadr_state_v2_field_u64(&context, 401U, state->canonical.first_mutation_ordinal);
    cadr_state_v2_field_u32(&context, 402U, state->canonical.mutation_count);
    cadr_state_v2_field_u32(&context, 403U, state->canonical.initialized);
    cadr_state_v2_field_u32(&context, 404U, state->canonical.overflowed);
    if (state->canonical.mutation_count > CADR_CANONICAL_MAX_SLOT_MUTATIONS) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_state_v2_field(&context, 405U, (const uint8_t *)state->canonical.mutation_events,
                        state->canonical.mutation_count * 32U);
    cadr_state_v2_field(&context, 406U, state->canonical.mutation_sha256, CADR_SHA256_BYTES);
    cadr_state_v2_field_u64(&context, 500U, state->devices.event_sequence);
    cadr_state_v2_field_u32(&context, 501U, state->devices.initialized);
    cadr_state_v2_field_u32(&context, 502U, state->devices.tv_mode);
    cadr_state_v2_field_u32(&context, 503U, state->devices.tv_vert_spacing);
    cadr_state_v2_field_u32(&context, 504U, state->devices.tv_sync_ptr);
    cadr_state_v2_field_u64(&context, 600U, events->generation);
    cadr_state_v2_field_u64(&context, 601U, events->next_request_id);
    cadr_state_v2_field_u64(&context, 602U, events->outstanding_request_id);
    cadr_state_v2_field_u64(&context, 603U, events->last_completed_request_id);
    cadr_state_v2_field(&context, 604U, events->request_descriptor,
                        (uint32_t)events->request_descriptor_byte_count);
    cadr_state_v2_field_u64(&context, 605U, events->request_descriptor_byte_count);
    cadr_state_v2_field_u64(&context, 606U, events->expected_completion_byte_count);
    cadr_state_v2_field_root(&context, 607U, state->trace.state_v2.completion_root);
    cadr_state_v2_field_u64(&context, 608U, events->completion_byte_count);
    cadr_state_v2_field_u32(&context, 609U, events->outstanding_operation);
    cadr_state_v2_field_u32(&context, 610U, events->completion_host_status);
    cadr_state_v2_field_u32(&context, 611U, events->completion_queued);
    cadr_state_v2_field_u32(&context, 612U, events->persistent_status);
    cadr_state_v2_field_u32(&context, 613U, events->unexpected_bus_operation);
    cadr_state_v2_digest_trace(&context, &state->trace);
    cadr_state_v2_field_u32(&context, 800U, state->artifacts.boot_configuration_ingressed);
    cadr_state_v2_field_u32(&context, 801U, state->artifacts.control_store_ingressed);
    cadr_state_v2_field_u32(&context, 802U, state->artifacts.base_disk_verified);
    cadr_state_v2_field_u32(&context, 803U, state->artifacts.prom_symbols_verified);
    cadr_state_v2_field_u32(&context, 804U, state->artifacts.microcode_symbols_verified);
    for (root = 0U; root < CADR_STATE_V2_ROOT_COUNT; ++root) {
        cadr_state_v2_field_root(&context, 900U + root, state->trace.state_v2.roots[root]);
    }
    cadr_state_v2_sha256_final(&context, digest);
    return CADR_STATUS_OK;
}

cadr_status cadr_state_v2_verify_cache(const cadr_machine_state *state)
{
    cadr_machine_state *copy;
    cadr_status status;
    uint32_t root;
    if (state == NULL || state->trace.state_v2.initialized == 0U) return CADR_STATUS_INVALID_ARGUMENT;
    copy = malloc(sizeof(*copy));
    if (copy == NULL) return CADR_STATUS_NO_MEMORY;
    (void)memcpy(copy, state, sizeof(*copy));
    status = cadr_state_v2_rebuild(copy);
    if (status == CADR_STATUS_OK) {
        for (root = 0U; root < CADR_STATE_V2_ROOT_COUNT; ++root) {
            if (memcmp(state->trace.state_v2.roots[root], copy->trace.state_v2.roots[root],
                       CADR_STATE_V2_SHA256_BYTES) != 0) {
                status = CADR_STATUS_GUEST_FAULT;
                break;
            }
        }
        if (status == CADR_STATUS_OK &&
            memcmp(state->trace.state_v2.completion_root, copy->trace.state_v2.completion_root,
                   CADR_STATE_V2_SHA256_BYTES) != 0) {
            status = CADR_STATUS_GUEST_FAULT;
        }
    }
    free(copy);
    return status;
}
