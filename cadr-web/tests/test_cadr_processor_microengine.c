#include "cadr_processor_memory.h"

#include <stdio.h>
#include <string.h>

static int failures;
static cadr_machine_state state;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static uint64_t word(const uint32_t class, const uint32_t a, const uint32_t functional,
                     const uint32_t m, const uint32_t destination, const uint32_t low)
{
    return ((uint64_t)class << 43U) | ((uint64_t)a << 32U) |
        ((uint64_t)functional << 31U) | ((uint64_t)m << 26U) |
        ((uint64_t)destination << 14U) | low;
}

static void setup(void)
{
    (void)memset(&state, 0, sizeof(state));
    state.cpu.prom_disabled = 1U;
}

static void execute_current(void)
{
    cadr_processor_memory_step(&state);
    cadr_processor_memory_step(&state);
}

static void execute_primed(const uint64_t instruction)
{
    state.cpu.p1 = instruction;
    state.cpu.p1_imem = 1U;
    state.cpu.next_micro_pc = 1U;
    cadr_processor_memory_step(&state);
}

static uint32_t reference_abs32_bits(const int32_t value)
{
    const uint32_t bits = (uint32_t)value;
    return value < 0 ? ~bits + UINT32_C(1) : bits;
}

static uint32_t reference_signed_ge(const uint32_t left, const uint32_t right)
{
    if ((left >> 31U) != (right >> 31U)) return (left >> 31U) == 0U ? 1U : 0U;
    return left >= right ? 1U : 0U;
}

static uint32_t reference_signed_gt(const uint32_t left, const uint32_t right)
{
    if ((left >> 31U) != (right >> 31U)) return (left >> 31U) == 0U ? 1U : 0U;
    return left > right ? 1U : 0U;
}

static void reference_add32(const uint32_t a, const uint32_t b, const uint32_t carry_in,
                            uint32_t *const result, uint32_t *const carry_out)
{
    *result = a + b + (carry_in != 0U ? 1U : 0U);
    *carry_out = carry_in != 0U
        ? (reference_signed_ge(b, ~a) != 0U ? 0U : 1U)
        : (reference_signed_gt(b, ~a) != 0U ? 0U : 1U);
}

static void reference_sub32(const uint32_t a, const uint32_t b, const uint32_t carry_in,
                            uint32_t *const result, uint32_t *const carry_out)
{
    *result = a - b - (carry_in != 0U ? 0U : 1U);
    *carry_out = *result < a ? 1U : 0U;
}

static uint32_t reference_signed_wide_carry(const int64_t value)
{
    return value < 0 || (uint64_t)value > UINT64_C(0xffffffff) ? 1U : 0U;
}

static void reference_alu(const uint32_t operation, const uint32_t carry_in,
                          const uint32_t q, const uint32_t mdata,
                          const uint32_t adata, const uint32_t initial_alu,
                          uint32_t *const alu_out, uint32_t *const carry_out)
{
    const int32_t signed_mdata = (int32_t)mdata;
    const int32_t signed_adata = (int32_t)adata;
    int64_t long_value;

    *alu_out = initial_alu;
    *carry_out = 0U;
    switch (operation) {
    case 0U: *alu_out = 0U; break;
    case 1U: *alu_out = mdata & adata; break;
    case 2U: *alu_out = mdata & ~adata; break;
    case 3U: *alu_out = mdata; break;
    case 4U: *alu_out = ~mdata & adata; break;
    case 5U: *alu_out = adata; break;
    case 6U: *alu_out = mdata ^ adata; break;
    case 7U: *alu_out = mdata | adata; break;
    case 8U: *alu_out = ~adata & ~mdata; break;
    case 9U: *alu_out = adata == mdata ? 1U : 0U; break;
    case 10U: *alu_out = ~adata; break;
    case 11U: *alu_out = mdata | ~adata; break;
    case 12U: *alu_out = ~mdata; break;
    case 13U: *alu_out = ~mdata | adata; break;
    case 14U: *alu_out = ~mdata | ~adata; break;
    case 15U: *alu_out = UINT32_MAX; break;
    case 16U: *alu_out = carry_in != 0U ? 0U : UINT32_MAX; break;
    case 17U: long_value = (int64_t)(int32_t)(mdata & adata) - (carry_in != 0U ? 0 : 1); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 18U: long_value = (int64_t)(int32_t)(mdata & ~adata) - (carry_in != 0U ? 0 : 1); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 19U: long_value = (int64_t)signed_mdata - (carry_in != 0U ? 0 : 1); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 20U: long_value = (int64_t)(int32_t)(mdata | ~adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 21U: long_value = (int64_t)(int32_t)(mdata | ~adata) + (int32_t)(mdata & adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 22U: reference_sub32(mdata, adata, carry_in, alu_out, carry_out); break;
    case 23U: long_value = (int64_t)(int32_t)(mdata | ~adata) + signed_mdata + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 24U: long_value = (int64_t)(int32_t)(mdata | adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 25U: reference_add32(mdata, adata, carry_in, alu_out, carry_out); break;
    case 26U: long_value = (int64_t)(int32_t)(mdata | adata) + (int32_t)(mdata & ~adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 27U: long_value = (int64_t)(int32_t)(mdata | adata) + signed_mdata + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 28U: *alu_out = mdata + (carry_in != 0U ? 1U : 0U); *carry_out = mdata == UINT32_MAX && carry_in != 0U ? 1U : 0U; break;
    case 29U: long_value = (int64_t)signed_mdata + (int32_t)(mdata & adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 30U: long_value = (int64_t)signed_mdata + (int32_t)(mdata | ~adata) + (carry_in != 0U ? 1 : 0); *alu_out = (uint32_t)long_value; *carry_out = reference_signed_wide_carry(long_value); break;
    case 31U: reference_add32(mdata, mdata, carry_in, alu_out, carry_out); break;
    case 32U:
        if ((q & 1U) != 0U) { reference_add32(adata, mdata, carry_in, alu_out, carry_out); }
        else { *alu_out = mdata; *carry_out = (mdata >> 31U) & 1U; }
        break;
    case 33U:
        if ((q & 1U) != 0U) { reference_sub32(mdata, reference_abs32_bits(signed_adata), carry_in == 0U ? 1U : 0U, alu_out, carry_out); }
        else { reference_add32(mdata, reference_abs32_bits(signed_adata), carry_in, alu_out, carry_out); }
        break;
    case 37U:
        if ((q & 1U) != 0U) { *carry_out = 0U; }
        else { reference_add32(*alu_out, reference_abs32_bits(signed_adata), carry_in, alu_out, carry_out); }
        break;
    case 41U:
        reference_sub32(mdata, reference_abs32_bits(signed_adata),
                        carry_in == 0U ? 1U : 0U, alu_out, carry_out);
        break;
    default: break;
    }
}

static void test_pipeline_and_inhibit(void)
{
    setup();
    state.memory.imem[0] = word(0U, 0U, 0U, 0U, UINT32_C(0x801),
                                (UINT32_C(1) << 12U) | (UINT32_C(3) << 3U));
    state.cpu.m_memory[0] = UINT32_C(0x12345678);
    state.cpu.inhibit = 1U;
    cadr_processor_memory_step(&state);
    CHECK(state.cpu.inhibit == 0U);
    CHECK(state.cpu.a_memory[1] == 0U);
    CHECK(state.cpu.microinstructions_executed == 0U);
    cadr_processor_memory_step(&state);
    CHECK(state.cpu.a_memory[1] == UINT32_C(0x12345678));
    CHECK(state.cpu.microinstructions_executed == 1U);
    CHECK(state.cpu.p0_pc == 0U);
    CHECK(state.cpu.p1_pc == 1U);
    CHECK(state.cpu.next_micro_pc == 2U);
    CHECK(state.cpu.opc == 0U);
}

static void test_rotate_and_arithmetic_edges(void)
{
    setup();
    state.cpu.m_memory[0] = UINT32_C(0x80000001);
    state.memory.imem[0] = word(0U, 0U, 0U, 0U, UINT32_C(0x801), 0U);
    execute_current();
    CHECK(state.cpu.a_memory[1] == UINT32_C(0x80000001));

    setup();
    state.cpu.m_memory[0] = UINT32_C(0x80000001);
    state.memory.imem[0] = word(0U, 0U, 0U, 0U, UINT32_C(0x801), UINT32_C(1));
    execute_current();
    CHECK(state.cpu.a_memory[1] == UINT32_C(0x00000003));

    setup();
    state.cpu.m_memory[0] = UINT32_MAX;
    state.cpu.a_memory[2] = 1U;
    state.memory.imem[0] = word(0U, 2U, 0U, 0U, UINT32_C(0x803),
                                (UINT32_C(1) << 12U) | (UINT32_C(25) << 3U));
    execute_current();
    CHECK(state.cpu.a_memory[3] == 0U);
    CHECK(state.cpu.alu_carry == 0U);
}

static void test_every_alu_operation_and_carry_input(void)
{
    static const uint32_t vectors[][2] = {
        { 0U, 0U },
        { UINT32_MAX, 1U },
        { UINT32_C(0x80000000), UINT32_C(0x7fffffff) },
        { UINT32_C(0x13579bdf), UINT32_C(0x2468ace0) }
    };
    uint32_t vector_index;
    uint32_t operation;
    uint32_t carry_in;
    uint32_t q;

    for (vector_index = 0U;
         vector_index < (uint32_t)(sizeof(vectors) / sizeof(vectors[0]));
         ++vector_index) {
        for (operation = 0U; operation < 64U; ++operation) {
            for (carry_in = 0U; carry_in < 2U; ++carry_in) {
                for (q = 0U; q < 2U; ++q) {
                    uint32_t expected_out;
                    uint32_t expected_carry;
                    const uint32_t initial_alu = UINT32_C(0x89abcdef);
                    setup();
                    state.cpu.m_memory[0] = vectors[vector_index][0];
                    state.cpu.a_memory[2] = vectors[vector_index][1];
                    state.cpu.alu_out = initial_alu;
                    state.cpu.q = q;
                    reference_alu(operation, carry_in, q,
                                  state.cpu.m_memory[0], state.cpu.a_memory[2],
                                  initial_alu, &expected_out, &expected_carry);
                    execute_primed(word(0U, 2U, 0U, 0U, UINT32_C(0x803),
                                        (UINT32_C(1) << 12U) |
                                        (operation << 3U) | (carry_in << 2U)));
                    CHECK(state.cpu.alu_out == expected_out);
                    CHECK(state.cpu.alu_carry == expected_carry);
                    CHECK(state.cpu.a_memory[3] == expected_out);
                }
            }
        }
    }
}

static void test_popj_iwr_and_decoded_latches(void)
{
    uint64_t instruction;

    setup();
    state.cpu.m_memory[0] = 0U;
    state.cpu.dispatch_memory[0] = 11U;
    state.cpu.micro_stack[0] = 77U;
    instruction = word(2U, 0U, 0U, 0U, 0U, 0U) |
        (UINT64_C(1) << 42U);
    execute_primed(instruction);
    CHECK(state.cpu.next_micro_pc == 11U);
    CHECK(state.cpu.effective_popj == 0U);

    setup();
    state.cpu.micro_stack[0] = 77U;
    instruction = word(1U, 0U, 0U, 0U, 0U,
                       (UINT32_C(9) << 12U) |
                       (UINT32_C(1) << 5U) | UINT32_C(7)) |
        (UINT64_C(1) << 42U);
    execute_primed(instruction);
    CHECK(state.cpu.next_micro_pc == 9U);
    CHECK(state.cpu.effective_popj == 0U);

    setup();
    state.cpu.m_memory[5] = 1U;
    state.cpu.a_memory[6] = 2U;
    state.cpu.micro_stack[0] = 77U;
    instruction = word(1U, 6U, 0U, 5U, 0U,
                       (UINT32_C(12) << 12U) |
                       (UINT32_C(1) << 5U) | UINT32_C(3)) |
        (UINT64_C(1) << 42U);
    execute_primed(instruction);
    CHECK(state.cpu.next_micro_pc == 77U);
    CHECK(state.cpu.effective_popj == 1U);

    setup();
    state.cpu.debug_ir = UINT64_C(0x123456789abc);
    state.cpu.m_memory[5] = UINT32_C(0x87654321);
    state.cpu.a_memory[UINT32_C(0x2ab)] = UINT32_C(0xabcdecba);
    instruction = word(1U, UINT32_C(0x2ab), 0U, 5U, 0U,
                       (UINT32_C(13) << 12U) |
                       (UINT32_C(1) << 9U) | (UINT32_C(1) << 8U));
    execute_primed(instruction);
    CHECK(state.memory.imem[13] ==
          ((UINT64_C(0xecba) << 32U) | UINT64_C(0x87654321)));
    CHECK(state.cpu.instruction_write_register ==
          ((UINT64_C(0xecba) << 32U) | UINT64_C(0x87654321)));
    CHECK(state.cpu.decoded_a_address == UINT32_C(0x2ab));
    CHECK(state.cpu.decoded_m_address == 5U);
    CHECK(state.cpu.decoded_a_data == UINT32_C(0xabcdecba));
    CHECK(state.cpu.decoded_m_data == UINT32_C(0x87654321));
    CHECK(state.cpu.decoded_class == 1U);
    CHECK(state.cpu.effective_popj == 0U);
    CHECK(state.cpu.debug_ir == UINT64_C(0x123456789abc));
}

static void test_jump_dispatch_and_byte(void)
{
    setup();
    state.memory.imem[0] = word(1U, 0U, 0U, 0U, 0U,
                                (UINT32_C(9) << 12U) | (UINT32_C(1) << 7U) |
                                (UINT32_C(1) << 5U) | UINT32_C(7));
    execute_current();
    CHECK(state.cpu.next_micro_pc == 9U);
    CHECK(state.cpu.inhibit == 1U);

    setup();
    state.cpu.m_memory[0] = 3U;
    state.cpu.dispatch_memory[3] = 11U;
    state.memory.imem[0] = word(2U, UINT32_C(0x155), 0U, 0U, 0U, UINT32_C(2) << 5U);
    execute_current();
    CHECK(state.cpu.next_micro_pc == 11U);
    CHECK(state.cpu.dispatch_constant == UINT32_C(0x155));

    setup();
    state.cpu.m_memory[0] = 1U;
    state.memory.imem[0] = word(3U, 0U, 0U, 0U, UINT32_C(0x804),
                                (UINT32_C(3) << 12U) | (UINT32_C(4) << 5U) | UINT32_C(4));
    execute_current();
    CHECK(state.cpu.a_memory[4] == UINT32_C(0x11));

    /*
     * Exact U303 boundary-83 regression: LDB rotates Q by the instruction
     * position even though mode 1 anchors only the mask at bit zero.
     */
    setup();
    state.cpu.q = UINT32_C(0xfffffffe);
    state.cpu.a_memory[3] = UINT32_MAX;
    execute_primed(UINT64_C(0x18039cc013df));
    CHECK(state.cpu.out == UINT32_MAX);
    CHECK(state.cpu.md == UINT32_MAX);
}

static void test_delayed_md(void)
{
    setup();
    cadr_processor_memory_set_main_memory_pages(&state, 1U);
    state.memory.l2_map[0] = (UINT32_C(1) << 23U) | (UINT32_C(1) << 22U);
    state.memory.main_memory[0][0] = UINT32_C(0x76543210);
    state.cpu.m_memory[0] = 0U;
    state.memory.imem[0] = word(0U, 0U, 0U, 0U, UINT32_C(17) << 5U,
                                (UINT32_C(1) << 12U) | (UINT32_C(3) << 3U));
    execute_current();
    CHECK(state.cpu.pending_md_delay == 2U);
    CHECK(state.cpu.md == 0U);
    cadr_processor_memory_step(&state);
    CHECK(state.cpu.pending_md_delay == 1U);
    cadr_processor_memory_step(&state);
    CHECK(state.cpu.pending_md_delay == 0U);
    CHECK(state.cpu.md == UINT32_C(0x76543210));
}

static void test_trace_raw_word_precedes_oa_overlay(void)
{
    const uint64_t raw = UINT64_C(0x000008001018);
    const uint32_t overlay = UINT32_C(0x0007c000);

    setup();
    state.cpu.oa_low = overlay;
    state.cpu.oa_low_pending = 1U;
    execute_primed(raw);
    CHECK(state.trace.raw_fetched_word == raw);
    CHECK(state.trace.effective_word == (raw | overlay));
}

int main(void)
{
    test_pipeline_and_inhibit();
    test_rotate_and_arithmetic_edges();
    test_every_alu_operation_and_carry_input();
    test_jump_dispatch_and_byte();
    test_popj_iwr_and_decoded_latches();
    test_delayed_md();
    test_trace_raw_word_precedes_oa_overlay();
    if (failures != 0) { return 1; }
    (void)puts("cadr_processor_microengine: ok");
    return 0;
}
