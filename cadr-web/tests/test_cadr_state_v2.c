#include "cadr_state_v2.h"
#include "cadr_bus_device.h"
#include "cadr_processor_memory.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

#define EXPECT_CHANGED(state, change) do { \
    uint8_t before_digest[CADR_SHA256_BYTES]; \
    uint8_t after_digest[CADR_SHA256_BYTES]; \
    CHECK(cadr_state_v2_digest((state), before_digest) == CADR_STATUS_OK); \
    change; \
    CHECK(cadr_state_v2_digest((state), after_digest) == CADR_STATUS_OK); \
    CHECK(memcmp(before_digest, after_digest, CADR_SHA256_BYTES) != 0); \
} while (0)

static cadr_machine_state *new_state(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    uint32_t index;
    if (state == NULL) return NULL;
    state->memory.main_memory_pages = 1U;
    state->memory.mapped_words = CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    state->canonical.initialized = 1U;
    state->canonical.mutation_count = 1U;
    state->canonical.mutation_events[0][0] = UINT8_C(0x31);
    state->events.generation = UINT64_C(1);
    state->events.next_request_id = UINT64_C(1);
    state->events.request_descriptor_byte_count = 4U;
    state->events.request_descriptor[0] = UINT8_C(0x81);
    state->events.request_descriptor[1] = UINT8_C(0x82);
    state->events.request_descriptor[2] = UINT8_C(0x83);
    state->events.request_descriptor[3] = UINT8_C(0x84);
    state->events.completion_byte_count = 4U;
    state->events.completion_bytes = malloc(4U);
    if (state->events.completion_bytes == NULL) {
        free(state);
        return NULL;
    }
    for (index = 0U; index < 4U; ++index) {
        state->events.completion_bytes[index] = (uint8_t)(UINT8_C(0xa0) + index);
    }
    if (cadr_state_v2_rebuild(state) != CADR_STATUS_OK) {
        free(state->events.completion_bytes);
        free(state);
        return NULL;
    }
    return state;
}

static void destroy_state(cadr_machine_state *state)
{
    if (state == NULL) return;
    free(state->events.completion_bytes);
    free(state);
}

static void test_schema_ledger(void)
{
    const cadr_state_v2_schema_entry *entries = cadr_state_v2_schema_entries();
    uint32_t index;
    CHECK(entries != NULL);
    CHECK(cadr_state_v2_schema_entry_count() == 170U);
    for (index = 0U; index < cadr_state_v2_schema_entry_count(); ++index) {
        CHECK(entries[index].tag != 0U);
        CHECK(entries[index].kind >= CADR_STATE_V2_SCHEMA_SCALAR &&
              entries[index].kind <= CADR_STATE_V2_SCHEMA_ROOT);
        CHECK(entries[index].name != NULL && entries[index].name[0] != '\0');
        if (index != 0U) CHECK(entries[index - 1U].tag < entries[index].tag);
    }
}

static void test_scalar_schema_coverage(void)
{
    cadr_machine_state *state = new_state();
    if (state == NULL) {
        CHECK(0);
        return;
    }

    EXPECT_CHANGED(state, state->clock_slots_completed ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->lifecycle ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->in_host_completion ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->profile ^= UINT32_C(1));

    EXPECT_CHANGED(state, state->cpu.microinstructions_executed ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->cpu.guest_fault ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.p0 ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->cpu.p1 ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->cpu.debug_ir ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->cpu.instruction_write_register ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->cpu.p0_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.p1_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.next_micro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.micro_stack_pointer ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.dispatch_constant ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.pdl_pointer ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.pdl_index ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.vma ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.md ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.location_counter ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.oa_low ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.oa_high ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.opc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.q ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.old_q ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.interrupt_control ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.pending_md ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.pending_md_delay ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.alu_carry ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.alu_out ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.out ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.interrupt_pending ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_a_address ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_m_address ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_a_data ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_m_data ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_initial_m_data ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.decoded_class ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.effective_popj ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->cpu.p0_imem ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.p1_imem ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.inhibit ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.oa_low_pending ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.oa_high_pending ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.halted ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.prom_disabled ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.vma_ok ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->cpu.main_memory_nxm ^= UINT8_C(1));

    EXPECT_CHANGED(state, state->memory.mapped_words ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->memory.initialized ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->memory.main_memory_pages ^= UINT32_C(1));

    EXPECT_CHANGED(state, state->bus.guest_tick ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->bus.interrupt_pending ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.interrupt_status ^= UINT16_C(1));
    EXPECT_CHANGED(state, state->bus.error_status ^= UINT16_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.instruction ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.debug_instruction ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.opc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.next_micro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.output_bus ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.m_source ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.a_source ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.machine_error ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.single_step_done ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.running ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.write_map ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.destination_spc ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.instruction_write ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.instruction_modify ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.pdl_write ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.spc_push ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.instruction_parity ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.nop ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.vma_ok ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.jump_condition ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.diagnostic.next_pc_source ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->bus.nxm_inhibited ^= UINT8_C(1));

    EXPECT_CHANGED(state, state->canonical.mutation_ordinal ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->canonical.first_mutation_ordinal ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->canonical.mutation_count = 0U);
    state->canonical.mutation_count = 1U;
    EXPECT_CHANGED(state, state->canonical.initialized ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->canonical.overflowed ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->canonical.mutation_events[0][0] ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->canonical.mutation_sha256[0] ^= UINT8_C(1));

    EXPECT_CHANGED(state, state->devices.event_sequence ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->devices.initialized ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->devices.tv_mode ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->devices.tv_vert_spacing ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->devices.tv_sync_ptr ^= UINT32_C(1));

    EXPECT_CHANGED(state, state->events.generation ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->events.next_request_id ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->events.outstanding_request_id ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->events.last_completed_request_id ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->events.request_descriptor[0] ^= UINT8_C(1));
    EXPECT_CHANGED(state, state->events.request_descriptor_byte_count = 3U);
    state->events.request_descriptor_byte_count = 4U;
    EXPECT_CHANGED(state, state->events.expected_completion_byte_count ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->events.completion_byte_count = 3U; cadr_state_v2_note_completion_changed(state));
    state->events.completion_byte_count = 4U;
    cadr_state_v2_note_completion_changed(state);
    EXPECT_CHANGED(state, state->events.outstanding_operation ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->events.completion_host_status ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->events.completion_queued ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->events.persistent_status ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->events.unexpected_bus_operation ^= UINT32_C(1));

    EXPECT_CHANGED(state, state->trace.instruction_ordinal ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->trace.event_sequence ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->trace.raw_fetched_word ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->trace.effective_word ^= UINT64_C(1));
    EXPECT_CHANGED(state, state->trace.pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.store_selector ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.operation ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.a_address ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.m_address ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.a_value ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.m_value ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.instruction_memory ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.functional_m_source ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.effective_popj ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.last_slot_executed ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.last_slot_inhibited ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.decoded ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.valid_mask ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_destination ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_q ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_vma ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_md ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_macro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_destination_value ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_q ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_vma ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_md ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_macro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_fault ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_interrupt_status ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_interrupt_pending ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.class_outcome ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_p0_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_p1_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_next_micro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_opc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_p0_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_p1_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_next_micro_pc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.post_opc ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.m_source_kind ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.destination_kind ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.destination_address ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.md_delayed_phase ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_fault ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.fault_code ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_interrupt_status ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.pre_interrupt_pending ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->trace.interrupt_level ^= UINT32_C(1));

    EXPECT_CHANGED(state, state->artifacts.boot_configuration_ingressed ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->artifacts.control_store_ingressed ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->artifacts.base_disk_verified ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->artifacts.prom_symbols_verified ^= UINT32_C(1));
    EXPECT_CHANGED(state, state->artifacts.microcode_symbols_verified ^= UINT32_C(1));

    destroy_state(state);
}

static void test_root_coverage_and_incremental_cache(void)
{
    cadr_machine_state *state = new_state();
    if (state == NULL) {
        CHECK(0);
        return;
    }
    EXPECT_CHANGED(state, state->memory.prom[17] ^= UINT64_C(1); cadr_state_v2_note_u64_write(state, CADR_STATE_V2_ROOT_PROM, 17U));
    EXPECT_CHANGED(state, state->memory.imem[71] ^= UINT64_C(1); cadr_state_v2_note_u64_write(state, CADR_STATE_V2_ROOT_IMEM, 71U));
    EXPECT_CHANGED(state, state->cpu.a_memory[33] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_AMEM, 33U));
    EXPECT_CHANGED(state, state->cpu.m_memory[3] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_MMEM, 3U));
    EXPECT_CHANGED(state, state->cpu.dispatch_memory[66] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_DISPATCH, 66U));
    EXPECT_CHANGED(state, state->cpu.pdl[99] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_PDL, 99U));
    EXPECT_CHANGED(state, state->cpu.micro_stack[7] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_SPC, 7U));
    EXPECT_CHANGED(state, state->memory.l1_map[88] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_L1, 88U));
    EXPECT_CHANGED(state, state->memory.l2_map[55] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_L2, 55U));
    EXPECT_CHANGED(state, state->memory.main_memory[7][3] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_MAIN_RAM, (7U << 8U) | 3U));
    EXPECT_CHANGED(state, state->devices.tv_sync_ram[271] ^= UINT8_C(1); cadr_state_v2_note_u8_write(state, CADR_STATE_V2_ROOT_TV_SYNC, 271U));
    EXPECT_CHANGED(state, state->devices.tv_screen[513] ^= UINT32_C(1); cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_TV_SCREEN, 513U));
    EXPECT_CHANGED(state, state->bus.unibus_map[4] ^= UINT16_C(1); cadr_state_v2_note_bus_map_write(state, 4U));
    EXPECT_CHANGED(state, state->bus.unibus_halfword[4] ^= UINT16_C(1); cadr_state_v2_note_bus_map_write(state, 4U));
    EXPECT_CHANGED(state, state->events.completion_bytes[0] ^= UINT8_C(1); cadr_state_v2_note_completion_changed(state));
    CHECK(cadr_state_v2_verify_cache(state) == CADR_STATUS_OK);
    destroy_state(state);
}

static void test_bus_map_root_exact_u16_vector(void)
{
    static const uint8_t expected[CADR_SHA256_BYTES] = {
        0x47U, 0x95U, 0xaaU, 0x1fU, 0x30U, 0xafU, 0x5fU, 0x79U,
        0x48U, 0x00U, 0x8eU, 0x59U, 0xe7U, 0x69U, 0x55U, 0x9aU,
        0x27U, 0x02U, 0x21U, 0xebU, 0xd7U, 0xc2U, 0xf7U, 0x5eU,
        0x89U, 0xeeU, 0x48U, 0x5aU, 0x96U, 0xfeU, 0xd5U, 0x2dU
    };
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    if (state == NULL) {
        CHECK(0);
        return;
    }
    state->bus.unibus_map[4] = UINT16_C(0x1234);
    state->bus.unibus_halfword[4] = UINT16_C(0xabcd);
    CHECK(cadr_state_v2_rebuild(state) == CADR_STATUS_OK);
    CHECK(memcmp(state->trace.state_v2.roots[CADR_STATE_V2_ROOT_BUS_MAPS],
                 expected, sizeof(expected)) == 0);
    free(state);
}

static void test_derived_storage_is_not_logical_state(void)
{
    cadr_machine_state *state = new_state();
    uint8_t before_digest[CADR_SHA256_BYTES];
    uint8_t after_digest[CADR_SHA256_BYTES];
    if (state == NULL) {
        CHECK(0);
        return;
    }
    CHECK(cadr_state_v2_digest(state, before_digest) == CADR_STATUS_OK);
    state->trace.state_v2.rebuild_ordinal += UINT64_C(1);
    state->canonical.amem_nodes[0][0] ^= UINT8_C(1);
    state->trace.engine = (cadr_trace_engine *)(uintptr_t)UINT32_C(1);
    CHECK(cadr_state_v2_digest(state, after_digest) == CADR_STATUS_OK);
    CHECK(memcmp(before_digest, after_digest, CADR_SHA256_BYTES) == 0);
    state->trace.engine = NULL;
    destroy_state(state);
}

/*
 * Exercise the production bounded-write paths after a cache rebuild.  The
 * root-coverage test above proves the hook algorithms; this one catches a
 * future mutation path that forgets to call its hook.
 */
static void test_production_write_hooks(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    if (state == NULL) {
        CHECK(0);
        return;
    }
    cadr_bus_device_cold_power_on(state);
    cadr_processor_memory_set_main_memory_pages(state, 1U);
    CHECK(cadr_state_v2_rebuild(state) == CADR_STATUS_OK);

    CHECK(cadr_processor_memory_main_write(state, UINT32_C(7),
                                            UINT32_C(0x12345678)) ==
          CADR_STATUS_OK);
    CHECK(cadr_state_v2_verify_cache(state) == CADR_STATUS_OK);

    cadr_processor_memory_write_map(state,
                                    (UINT32_C(3) << 27U) |
                                    (UINT32_C(1) << 26U),
                                    UINT32_C(0x00006000));
    cadr_processor_memory_write_map(state,
                                    (UINT32_C(1) << 25U) |
                                    (UINT32_C(1) << 23U) |
                                    (UINT32_C(1) << 22U) | UINT32_C(1),
                                    UINT32_C(0x00006055));
    CHECK(cadr_state_v2_verify_cache(state) == CADR_STATUS_OK);

    CHECK(cadr_unibus_map_write(state, UINT32_C(0766140),
                                 UINT16_C(0140000)) == CADR_STATUS_OK);
    CHECK(cadr_unibus_write16(state, UINT32_C(0140000), UINT16_C(012345)) ==
          CADR_STATUS_OK);
    CHECK(cadr_state_v2_verify_cache(state) == CADR_STATUS_OK);

    CHECK(cadr_tv_write(state, 0U, UINT32_C(0x89abcdef)) == CADR_STATUS_OK);
    state->devices.tv_vert_spacing = UINT32_C(0200);
    state->devices.tv_sync_ptr = 3U;
    CHECK(cadr_tv_control_write(state, 1U, UINT32_C(0x5a)) == CADR_STATUS_OK);
    CHECK(cadr_state_v2_verify_cache(state) == CADR_STATUS_OK);
    free(state);
}

int main(void)
{
    test_schema_ledger();
    test_scalar_schema_coverage();
    test_root_coverage_and_incremental_cache();
    test_bus_map_root_exact_u16_vector();
    test_derived_storage_is_not_logical_state();
    test_production_write_hooks();
    if (failures != 0) return 1;
    (void)puts("cadr_state_v2: ok");
    return 0;
}
