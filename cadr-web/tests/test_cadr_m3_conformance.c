/*
 * CADR-WEB M3 processor conformance vectors (CADR-U01 through CADR-U05).
 *
 * This is deliberately a black-box test of cadr_processor_memory_step.  The
 * reference side describes the bit-level instruction contract; it does not
 * call or copy the production helpers.
 */
#include "cadr_processor_memory.h"

#if !defined(CADR_M3_WASM_CONFORMANCE)
#include <stdio.h>
#endif
#include <string.h>

static cadr_machine_state state;
static unsigned failures;

#if defined(CADR_M3_WASM_CONFORMANCE)
uint32_t cadr_m3_conformance_failures(void);
#endif

#if defined(CADR_M3_WASM_CONFORMANCE)
#define CHECK(e) do { if (!(e)) { \
    ++failures; \
} } while (0)
#else
#define CHECK(e) do { if (!(e)) { \
    (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #e); \
    ++failures; \
} } while (0)
#endif

static uint64_t instruction(uint32_t class_, uint32_t a, uint32_t functional,
                            uint32_t m, uint32_t destination, uint32_t low)
{
    return ((uint64_t)class_ << 43U) | ((uint64_t)a << 32U) |
        ((uint64_t)functional << 31U) | ((uint64_t)m << 26U) |
        ((uint64_t)destination << 14U) | low;
}

static uint32_t rol32(uint32_t value, uint32_t count)
{
    count &= 31U;
    return count == 0U ? value : (value << count) | (value >> (32U - count));
}

static void fresh(void)
{
    /*
     * The vectors execute only processor slots.  Reset their complete scalar
     * owner state plus every non-CPU storage location the vectors can fetch,
     * alter, or observe.  Do not clear the 16 MiB main-RAM backing store for
     * every vector: U05 is its sole user and resets page 0, word 0 below.
     */
    (void)memset(&state.cpu, 0, sizeof(state.cpu));
    (void)memset(&state.bus, 0, sizeof(state.bus));
    (void)memset(&state.trace, 0, sizeof(state.trace));
    state.memory.mapped_words = 0U;
    state.memory.initialized = 0U;
    state.memory.main_memory_pages = 0U;
    state.memory.prom[UINT32_C(0x1ff)] = 0U;
    state.memory.imem[1U] = 0U;
    state.memory.imem[UINT32_C(0x123)] = 0U;
    state.memory.l1_map[0U] = 0U;
    state.memory.l2_map[0U] = 0U;
    state.memory.main_memory[0U][0U] = 0U;
    state.cpu.prom_disabled = 1U;
}

/* Execute exactly the instruction in p1, after the pipeline advance. */
static void run(uint64_t word)
{
    state.cpu.p1 = word;
    state.cpu.p1_imem = 1U;
    state.cpu.next_micro_pc = 1U;
    cadr_processor_memory_step(&state);
}

/* Boolean opcodes are a four-row truth table: row = (M-bit << 1) | A-bit. */
static uint32_t boolean_truth_table(uint32_t opcode, uint32_t m, uint32_t a)
{
    uint32_t bit;
    uint32_t out = 0U;
    if (opcode == 9U) return m == a ? 1U : 0U;
    for (bit = 0U; bit < 32U; ++bit) {
        /* The microinstruction table numbers rows 11,10,01,00 as bits 0..3. */
        const uint32_t row = UINT32_C(3) - ((((m >> bit) & 1U) << 1U) |
                                            ((a >> bit) & 1U));
        out |= ((opcode >> row) & 1U) << bit;
    }
    return out;
}

static uint32_t signed_high_nonzero(int64_t value)
{
    return ((uint64_t)value >> 32U) != 0U ? 1U : 0U;
}

static uint32_t magnitude32(uint32_t value)
{
    return (value & UINT32_C(0x80000000)) == 0U ? value : (~value + 1U);
}

/*
 * Pinned usim 330d8248 m32.h:3-16 defines ADD's carry as the signed
 * comparison b > ~a (or b >= ~a when CIN is set), not host unsigned
 * overflow.  uexec.c:51,54 declares the M and A latches as int, and
 * uexec.c:621-622 selects that equation for ALU opcode 031.  Express the
 * source signed comparison in bits so this oracle does not depend on the
 * host's implementation-defined uint32_t-to-int32_t conversion.
 */
static uint32_t signed_gt32(uint32_t left, uint32_t right)
{
    return (left ^ UINT32_C(0x80000000)) >
           (right ^ UINT32_C(0x80000000)) ? 1U : 0U;
}

static uint32_t signed_ge32(uint32_t left, uint32_t right)
{
    return (left ^ UINT32_C(0x80000000)) >=
           (right ^ UINT32_C(0x80000000)) ? 1U : 0U;
}

static void add32(uint32_t a, uint32_t b, uint32_t cin,
                  uint32_t *out, uint32_t *carry)
{
    *out = a + b + (cin != 0U ? 1U : 0U);
    *carry = cin != 0U ? (signed_ge32(b, ~a) != 0U ? 0U : 1U)
                         : (signed_gt32(b, ~a) != 0U ? 0U : 1U);
}

static void sub32(uint32_t a, uint32_t b, uint32_t cin,
                  uint32_t *out, uint32_t *carry)
{
    *out = a - b - (cin == 0U ? 1U : 0U);
    *carry = *out < a ? 1U : 0U;
}

/* Arithmetic opcodes are specified in widened arithmetic, not production code. */
static void alu_reference(uint32_t opcode, uint32_t m, uint32_t a, uint32_t q,
                          uint32_t cin, uint32_t initial,
                          uint32_t *out, uint32_t *carry)
{
    int64_t value = 0;
    *out = initial;
    *carry = 0U;
    if (opcode < 16U) {
        *out = boolean_truth_table(opcode, m, a);
        return;
    }
    switch (opcode) {
    case 16U: *out = cin != 0U ? 0U : UINT32_MAX; break;
    case 17U: value = (int64_t)(int32_t)(m & a) - (cin != 0U ? 0 : 1); goto signed_result;
    case 18U: value = (int64_t)(int32_t)(m & ~a) - (cin != 0U ? 0 : 1); goto signed_result;
    case 19U: value = (int64_t)(int32_t)m - (cin != 0U ? 0 : 1); goto signed_result;
    case 20U: value = (int64_t)(int32_t)(m | ~a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 21U: value = (int64_t)(int32_t)(m | ~a) + (int32_t)(m & a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 22U: sub32(m, a, cin, out, carry); break;
    case 23U: value = (int64_t)(int32_t)(m | ~a) + (int32_t)m + (cin != 0U ? 1 : 0); goto signed_result;
    case 24U: value = (int64_t)(int32_t)(m | a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 25U: add32(m, a, cin, out, carry); break;
    case 26U: value = (int64_t)(int32_t)(m | a) + (int32_t)(m & ~a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 27U: value = (int64_t)(int32_t)(m | a) + (int32_t)m + (cin != 0U ? 1 : 0); goto signed_result;
    /*
     * U303 uexec.c:634-638 gives M+1 its own carry equation: only
     * 0xffffffff plus asserted CIN carries.  It is not the generic ADD
     * comparator used by opcode 031.
     */
    case 28U:
        *out = m + (cin != 0U ? 1U : 0U);
        *carry = m == UINT32_MAX && cin != 0U ? 1U : 0U;
        break;
    case 29U: value = (int64_t)(int32_t)m + (int32_t)(m & a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 30U: value = (int64_t)(int32_t)m + (int32_t)(m | ~a) + (cin != 0U ? 1 : 0); goto signed_result;
    case 31U: add32(m, m, cin, out, carry); break;
    case 32U: if ((q & 1U) != 0U) add32(a, m, cin, out, carry); else { *out = m; *carry = m >> 31U; } break;
    case 33U: if ((q & 1U) != 0U) sub32(m, magnitude32(a), cin == 0U ? 1U : 0U, out, carry); else add32(m, magnitude32(a), cin, out, carry); break;
    case 37U: if ((q & 1U) == 0U) add32(initial, magnitude32(a), cin, out, carry); break;
    case 41U: sub32(m, magnitude32(a), cin == 0U ? 1U : 0U, out, carry); break;
    default: break;
    }
    return;
signed_result:
    *out = (uint32_t)value;
    *carry = signed_high_nonzero(value);
}

static void cadr_u01_alu(void)
{
    static const uint32_t values[] = { 0U, 1U, UINT32_MAX, UINT32_C(0x80000000), UINT32_C(0x13579bdf) };
    uint32_t op, mi, ai, cin, q;
    for (op = 0U; op < 64U; ++op) for (mi = 0U; mi < 5U; ++mi)
    for (ai = 0U; ai < 5U; ++ai) for (cin = 0U; cin < 2U; ++cin)
    for (q = 0U; q < 2U; ++q) {
        uint32_t expected, carry;
        fresh();
        state.cpu.m_memory[0] = values[mi]; state.cpu.a_memory[1] = values[ai];
        state.cpu.q = q; state.cpu.alu_out = UINT32_C(0x89abcdef);
        alu_reference(op, values[mi], values[ai], q, cin, state.cpu.alu_out, &expected, &carry);
        run(instruction(0U, 1U, 0U, 0U, UINT32_C(0x802),
                        (UINT32_C(1) << 12U) | (op << 3U) | (cin << 2U)));
        CHECK(state.cpu.a_memory[2] == expected);
        CHECK(state.cpu.alu_out == expected);
        CHECK(state.cpu.alu_carry == carry);
    }
}

static uint32_t jump_condition(uint32_t selector, uint32_t m, uint32_t a,
                               uint32_t vma_ok, uint32_t interrupt_control,
                               uint32_t interrupt_pending)
{
    switch (selector) {
    case 0U: return 0U;
    case 1U: return (int32_t)m < (int32_t)a;
    case 2U: return (int32_t)m <= (int32_t)a;
    case 3U: return m == a;
    case 4U: return vma_ok == 0U;
    case 5U: return vma_ok == 0U || (((interrupt_control >> 27U) & 1U) != 0U && interrupt_pending != 0U);
    case 6U: return vma_ok == 0U || (((interrupt_control >> 27U) & 1U) != 0U && interrupt_pending != 0U) || (((interrupt_control >> 26U) & 1U) != 0U);
    default: return 1U;
    }
}

static void cadr_u02_jump(void)
{
    uint32_t selector, n, p, r, invert, which;
    static const uint32_t m_values[] = { 0U, UINT32_C(0x80000000) };
    static const uint32_t a_values[] = { 1U, UINT32_C(0x7fffffff) };
    for (selector = 0U; selector < 8U; ++selector) for (which = 0U; which < 2U; ++which)
    for (n = 0U; n < 2U; ++n) for (p = 0U; p < 2U; ++p)
    for (r = 0U; r < 2U; ++r) for (invert = 0U; invert < 2U; ++invert) {
        const uint32_t target = UINT32_C(0x123);
        uint32_t condition;
        fresh();
        state.cpu.m_memory[0] = m_values[which]; state.cpu.a_memory[1] = a_values[which];
        state.cpu.vma_ok = (uint8_t)which; state.cpu.interrupt_control = which != 0U ? (UINT32_C(3) << 26U) : 0U;
        state.cpu.interrupt_pending = which;
        state.cpu.micro_stack[0] = UINT32_C(0x222); state.cpu.micro_stack_pointer = 0U;
        condition = jump_condition(selector, m_values[which], a_values[which], state.cpu.vma_ok,
                                   state.cpu.interrupt_control, state.cpu.interrupt_pending);
        if (invert != 0U) condition ^= 1U;
        run(instruction(1U, 1U, 0U, 0U, 0U,
                        (target << 12U) | (r << 9U) | (p << 8U) | (n << 7U) |
                        (invert << 6U) | (UINT32_C(1) << 5U) | selector));
        if (p != 0U && r != 0U) {
            CHECK(state.memory.imem[target] == ((uint64_t)(a_values[which] & UINT32_C(0xffff)) << 32U | m_values[which]));
        } else if (condition != 0U) {
            CHECK(state.cpu.next_micro_pc == (r != 0U ? UINT32_C(0x222) : target));
            CHECK(state.cpu.inhibit == n);
            CHECK(state.cpu.micro_stack_pointer == (r != 0U ? 31U : (p != 0U ? 1U : 0U)));
        } else {
            CHECK(state.cpu.next_micro_pc == 2U);
            CHECK(state.cpu.micro_stack_pointer == 0U);
        }
    }
}

static void cadr_u03_dispatch(void)
{
    uint32_t position, width, map, n, p, r;
    for (position = 0U; position < 32U; ++position) for (width = 0U; width < 8U; ++width)
    for (map = 0U; map < 4U; ++map) for (n = 0U; n < 2U; ++n)
    for (p = 0U; p < 2U; ++p) for (r = 0U; r < 2U; ++r) {
        const uint32_t base = UINT32_C(0x140);
        const uint32_t m = UINT32_C(0x89abcdef);
        const uint32_t l2 = (map & 1U ? UINT32_C(1) << 18U : 0U) | (map & 2U ? UINT32_C(1) << 19U : 0U);
        const uint32_t index = (base | (rol32(m, position) & ((UINT32_C(1) << width) - 1U)) |
                                (map & 1U ? 1U : 0U) | (map & 2U ? 1U : 0U)) & UINT32_C(0x7ff);
        fresh(); state.cpu.m_memory[0] = m; state.cpu.md = 0U; state.memory.l1_map[0] = 0U;
        state.memory.l2_map[0] = l2; state.cpu.dispatch_memory[index] = UINT32_C(0x345) | (n << 14U) | (p << 15U) | (r << 16U);
        state.cpu.micro_stack[0] = UINT32_C(0x234);
        run(instruction(2U, UINT32_C(0x155), 0U, 0U, 0U,
                        (base << 12U) | (map << 8U) | (width << 5U) | position));
        CHECK(state.cpu.dispatch_constant == UINT32_C(0x155));
        CHECK(state.cpu.decoded_m_data == rol32(m, position));
        if (p != 0U && r != 0U) CHECK(state.cpu.next_micro_pc == 2U);
        else CHECK(state.cpu.next_micro_pc == (r != 0U ? UINT32_C(0x234) : UINT32_C(0x345)));
        CHECK(state.cpu.inhibit == n);
    }
}

static void cadr_u04_byte(void)
{
    uint32_t position, width, mode;
    for (position = 0U; position < 32U; ++position) for (width = 0U; width < 32U; ++width)
    for (mode = 0U; mode < 4U; ++mode) {
        const uint32_t m = UINT32_C(0x9abcdef0), a = UINT32_C(0x13579bdf);
        const uint32_t mask_position = (mode & 2U) != 0U ? position : 0U;
        const uint32_t left = (mask_position + width) & 31U;
        const uint32_t mask = (UINT32_MAX >> (31U - left)) & (UINT32_MAX << mask_position);
        const uint32_t source = (mode == 1U || mode == 3U) ? rol32(m, position) : m;
        const uint32_t expected = mode == 0U ? 0U : (source & mask) | (a & ~mask);
        fresh(); state.cpu.m_memory[0] = m; state.cpu.a_memory[1] = a;
        run(instruction(3U, 1U, 0U, 0U, UINT32_C(0x802),
                        (mode << 12U) | (width << 5U) | position));
        CHECK(state.cpu.a_memory[2] == expected);
    }
}

static void cadr_u05_pipeline_edges(void)
{
    fresh(); state.cpu.oa_low = UINT32_C(0x0007c000); state.cpu.oa_low_pending = 1U;
    run(UINT64_C(0x000008001018));
    CHECK(state.trace.raw_fetched_word == UINT64_C(0x000008001018));
    CHECK(state.trace.effective_word == UINT64_C(0x00000807d018));
    CHECK(state.cpu.oa_low_pending == 0U);

    fresh(); state.cpu.oa_high = UINT32_C(0x003fffff); state.cpu.oa_high_pending = 1U;
    run(0U);
    CHECK(state.cpu.p0 <= UINT64_C(0x0000ffffffffffff));
    CHECK(state.cpu.oa_high_pending == 0U);

    fresh(); cadr_processor_memory_set_main_memory_pages(&state, 1U);
    state.memory.l2_map[0] = (UINT32_C(1) << 23U) | (UINT32_C(1) << 22U);
    state.memory.main_memory[0][0] = UINT32_C(0x76543210);
    run(instruction(0U, 0U, 0U, 0U, UINT32_C(17) << 5U, UINT32_C(1) << 12U | UINT32_C(3) << 3U));
    CHECK(state.cpu.pending_md_delay == 2U); cadr_processor_memory_step(&state);
    CHECK(state.cpu.pending_md_delay == 1U); cadr_processor_memory_step(&state);
    CHECK(state.cpu.pending_md_delay == 0U && state.cpu.md == UINT32_C(0x76543210));

    fresh(); state.cpu.prom_disabled = 0U; state.memory.prom[UINT32_C(0x1ff)] = UINT64_C(0x123456789abc);
    state.cpu.next_micro_pc = UINT32_C(0x3fff); cadr_processor_memory_step(&state);
    CHECK(state.cpu.p1 == UINT64_C(0x123456789abc));
    CHECK(state.cpu.p1_pc == UINT32_C(0x3fff) && state.cpu.next_micro_pc == 0U);
}

static unsigned cadr_m3_conformance_run(void)
{
    failures = 0U;
    cadr_u01_alu(); cadr_u02_jump(); cadr_u03_dispatch(); cadr_u04_byte(); cadr_u05_pipeline_edges();
    return failures;
}

#if defined(CADR_M3_WASM_CONFORMANCE)
__attribute__((export_name("cadr_m3_conformance_failures")))
uint32_t cadr_m3_conformance_failures(void)
{
    return cadr_m3_conformance_run();
}
#else
int main(void)
{
    if (cadr_m3_conformance_run() != 0U) return 1;
    (void)puts("cadr_m3_conformance: ok");
    return 0;
}
#endif
