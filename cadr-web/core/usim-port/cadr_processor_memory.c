/*
 * CADR-WEB U303 processor and memory core.
 *
 * Derived from Brad Parker's usim at Fossil 330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d:
 * uexec.c, m32.c, ucode.c, machine-control.c, uvmem.c, and main-memory.c.
 * Copyright 2004-2011 Brad Parker.  BSD-2-Clause terms: COPYING.md.
 *
 * Deliberate boundary: this unit owns no host resources and replaces the upstream
 * bus adaptor with only instance-owned main RAM.  Device physical ranges are NXM
 * until a typed deterministic bus/device layer attaches them.
 */

#include "cadr_processor_memory.h"
#include "cadr_bus_device.h"
#include "cadr_m3_native_observer.h"
#include "cadr_state_v2.h"

#include <stddef.h>

#define CADR_U48_MASK UINT64_C(0x0000ffffffffffff)
#define CADR_MICRO_PC_MASK UINT32_C(0x3fff)
#define CADR_LOCATION_COUNTER_MASK UINT32_C(0x03ffffff)

static uint32_t cadr_rol32(const uint32_t value, const uint32_t bitstorotate)
{
    const uint32_t count = bitstorotate & UINT32_C(31);
    uint32_t result;

    if (count == 0U) {
        result = value;
    } else {
        result = (value << count) | (value >> (UINT32_C(32) - count));
    }
#ifdef CADR_PROCESSOR_MEMORY_NEGATIVE_CONTROL
    result ^= UINT32_C(1);
#endif
    return result;
}

/* Return two's-complement magnitude bits; INT32_MIN remains 0x80000000. */
static uint32_t cadr_abs32_bits(const int32_t value)
{
    const uint32_t bits = (uint32_t)value;
    return value < 0 ? ~bits + UINT32_C(1) : bits;
}

/* Signed int32 ordering on raw two's-complement bit patterns, without casts. */
static uint32_t cadr_signed32_ge(const uint32_t left, const uint32_t right)
{
    const uint32_t left_negative = left >> 31U;
    const uint32_t right_negative = right >> 31U;
    if (left_negative != right_negative) return left_negative == 0U ? 1U : 0U;
    return left >= right ? 1U : 0U;
}

static uint32_t cadr_signed32_gt(const uint32_t left, const uint32_t right)
{
    const uint32_t left_negative = left >> 31U;
    const uint32_t right_negative = right >> 31U;
    if (left_negative != right_negative) return left_negative == 0U ? 1U : 0U;
    return left > right ? 1U : 0U;
}

static void cadr_add32(const uint32_t a, const uint32_t b, const uint32_t carry_in,
                       uint32_t *const result, uint32_t *const carry_out)
{
    *result = a + b + (carry_in != 0U ? 1U : 0U);
    *carry_out = carry_in != 0U
        ? (cadr_signed32_ge(b, ~a) != 0U ? 0U : 1U)
        : (cadr_signed32_gt(b, ~a) != 0U ? 0U : 1U);
}

static void cadr_sub32(const uint32_t a, const uint32_t b, const uint32_t carry_in,
                       uint32_t *const result, uint32_t *const carry_out)
{
    *result = a - b - (carry_in != 0U ? 0U : 1U);
    *carry_out = *result < a ? 1U : 0U;
}

/* Equivalent to testing a nonzero arithmetic high half, without signed shift. */
static uint32_t cadr_signed_wide_carry(const int64_t value)
{
    return value < 0 || (uint64_t)value > UINT64_C(0xffffffff) ? 1U : 0U;
}

static uint32_t cadr_ir(const cadr_cpu_state *const cpu, const uint32_t pos,
                        const uint32_t length)
{
    const uint64_t mask = (UINT64_C(1) << length) - UINT64_C(1);
    return (uint32_t)((cpu->p0 >> pos) & mask);
}

static void cadr_push_spc(cadr_machine_state *const state, const uint32_t pc)
{
    cadr_cpu_state *const cpu = &state->cpu;
    uint32_t old_value;
    cpu->micro_stack_pointer = (cpu->micro_stack_pointer + UINT32_C(1)) & UINT32_C(31);
    old_value = cpu->micro_stack[cpu->micro_stack_pointer];
    cpu->micro_stack[cpu->micro_stack_pointer] = pc;
    cadr_canonical_write_u32(state, 6U, cpu->micro_stack_pointer,
                             old_value, pc);
    cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_SPC,
                                 cpu->micro_stack_pointer);
}

static uint32_t cadr_pop_spc(cadr_cpu_state *const cpu)
{
    const uint32_t value = cpu->micro_stack[cpu->micro_stack_pointer];
    cpu->micro_stack_pointer = (cpu->micro_stack_pointer - UINT32_C(1)) & UINT32_C(31);
    return value;
}

void cadr_processor_memory_reset(cadr_machine_state *const state)
{
    state->cpu.halted = 0U;
    state->cpu.vma_ok = 0U;
    state->cpu.main_memory_nxm = 0U;
    state->cpu.prom_disabled = 0U;
    state->cpu.pending_md_delay = 0U;
}

void cadr_processor_memory_boot(cadr_machine_state *const state)
{
    cadr_processor_memory_reset(state);
    state->cpu.prom_disabled = 0U;
    state->cpu.next_micro_pc = 0U;
    state->cpu.inhibit = 1U;
}

void cadr_processor_memory_set_main_memory_pages(cadr_machine_state *const state,
                                                  const uint32_t page_count)
{
    state->memory.main_memory_pages = page_count > CADR_MAIN_MEMORY_MAX_PAGES
        ? CADR_MAIN_MEMORY_MAX_PAGES : page_count;
    state->memory.mapped_words = (uint64_t)state->memory.main_memory_pages *
        CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    state->memory.initialized = 1U;
}

cadr_status cadr_processor_memory_main_access(cadr_machine_state *const state,
                                              const uint32_t write,
                                              const uint32_t paddr,
                                              uint32_t *const value)
{
    const uint32_t page = (paddr >> 8U) & UINT32_C(0x3fff);
    if (page < state->memory.main_memory_pages) {
        if (write != 0U) {
            state->memory.main_memory[page][paddr & UINT32_C(0xff)] = *value;
            cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_MAIN_RAM,
                                         (page << 8U) | (paddr & UINT32_C(0xff)));
        } else {
            *value = state->memory.main_memory[page][paddr & UINT32_C(0xff)];
        }
        return CADR_PROCESSOR_MEMORY_OK;
    }
    if (write == 0U) {
        *value = UINT32_MAX;
    }
    state->cpu.main_memory_nxm = 1U;
    return CADR_PROCESSOR_MEMORY_NXM;
}

cadr_status cadr_processor_memory_main_read(cadr_machine_state *const state,
                                            const uint32_t paddr,
                                            uint32_t *const value)
{
    return cadr_processor_memory_main_access(state, 0U, paddr, value);
}

cadr_status cadr_processor_memory_main_write(cadr_machine_state *const state,
                                             const uint32_t paddr,
                                             const uint32_t value)
{
    uint32_t mutable_value = value;
    return cadr_processor_memory_main_access(state, 1U, paddr, &mutable_value);
}

uint32_t cadr_processor_memory_vtop(const cadr_machine_state *const state,
                                    uint32_t vaddr, uint32_t *const out_l1,
                                    uint32_t *const out_l2, uint32_t *const out_page,
                                    uint32_t *const out_write, uint32_t *const out_access)
{
    uint32_t l1_index;
    uint32_t l1_data;
    uint32_t l2_index;
    uint32_t l2_data;
    uint32_t page;

    vaddr &= UINT32_C(0x00ffffff);
    l1_index = (vaddr >> 13U) & UINT32_C(0x7ff);
    l1_data = state->memory.l1_map[l1_index] & UINT32_C(0x1f);
    l2_index = (l1_data << 5U) | ((vaddr >> 8U) & UINT32_C(0x1f));
    l2_data = state->memory.l2_map[l2_index] & UINT32_C(0x00ffffff);
    page = l2_data & UINT32_C(0x3fff);
    if (out_l1 != NULL) { *out_l1 = l1_data; }
    if (out_l2 != NULL) { *out_l2 = l2_data; }
    if (out_page != NULL) { *out_page = page; }
    if (out_write != NULL) { *out_write = (l2_data >> 22U) & UINT32_C(1); }
    if (out_access != NULL) { *out_access = (l2_data >> 23U) & UINT32_C(1); }
    return (page << 8U) | (vaddr & UINT32_C(0xff));
}

void cadr_processor_memory_write_map(cadr_machine_state *const state, const uint32_t vma,
                                     const uint32_t md)
{
    if ((vma & UINT32_C(1) << 26U) != 0U) {
        const uint32_t index = (md >> 13U) & UINT32_C(0x7ff);
        const uint32_t old_value = state->memory.l1_map[index];
        state->memory.l1_map[index] = (vma >> 27U) & UINT32_C(0x1f);
        cadr_canonical_write_u32(state, 7U, index, old_value,
                                 state->memory.l1_map[index]);
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_L1, index);
    }
    if ((vma & UINT32_C(1) << 25U) != 0U) {
        const uint32_t l1_index = (md >> 13U) & UINT32_C(0x7ff);
        const uint32_t l1_data = state->memory.l1_map[l1_index] & UINT32_C(0x1f);
        const uint32_t l2_index = (l1_data << 5U) | ((md >> 8U) & UINT32_C(0x1f));
        const uint32_t old_value = state->memory.l2_map[l2_index];
        state->memory.l2_map[l2_index] = vma & UINT32_C(0x00ffffff);
        cadr_canonical_write_u32(state, 8U, l2_index, old_value,
                                 state->memory.l2_map[l2_index]);
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_L2, l2_index);
    }
}

cadr_status cadr_processor_memory_virtual_access(
    cadr_machine_state *const state,
    const cadr_processor_memory_bus *const bus,
    const uint32_t write, uint32_t vaddr, uint32_t *const value)
{
    uint32_t paddr;
    uint32_t page;
    uint32_t write_allowed;
    uint32_t access_allowed;

    vaddr &= UINT32_C(0x00ffffff);
    paddr = cadr_processor_memory_vtop(state, vaddr, NULL, NULL, &page,
                                       &write_allowed, &access_allowed);
    state->cpu.vma_ok = (uint8_t)(access_allowed != 0U &&
        (write == 0U || write_allowed != 0U));
    if (state->cpu.vma_ok == 0U) {
        *value = 0U;
        return CADR_PROCESSOR_MEMORY_OK;
    }
    if (page >= 035774U && page <= 035777U) {
        const uint32_t offset = ((page - 035774U) << 8U) |
            (vaddr & UINT32_C(0xff));
        if (write != 0U) {
            const uint32_t old_value = state->cpu.a_memory[offset];
            state->cpu.a_memory[offset] = *value;
            cadr_canonical_write_u32(state, 2U, offset, old_value,
                                     state->cpu.a_memory[offset]);
            cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_AMEM, offset);
        } else {
            *value = state->cpu.a_memory[offset];
        }
        return CADR_PROCESSOR_MEMORY_OK;
    }
    if (page == 036000U) {
        paddr = 017000000U | (vaddr & 077777U);
    }
    if (page <= 035773U) {
        const cadr_status status = cadr_processor_memory_main_access(state, write, paddr, value);
        /* Main RAM transfers bypass the XBUS adaptor but are still physical
         * transfers in the upstream observer contract. */
        cadr_m3_native_observer_bus(state, write != 0U ? "write" : "read",
                                    paddr, write != 0U ? *value : 0U,
                                    write != 0U ? 0U : *value);
        return status;
    }
    if (bus != NULL && ((write != 0U && bus->write32 != NULL) ||
                        (write == 0U && bus->read32 != NULL))) {
        return write != 0U ? bus->write32(state, paddr, *value)
                           : bus->read32(state, paddr, value);
    }
    if (write == 0U) {
        *value = UINT32_MAX;
    }
    state->cpu.main_memory_nxm = 1U;
    return CADR_PROCESSOR_MEMORY_NXM;
}

static void cadr_vm(cadr_machine_state *const state,
                    const cadr_processor_memory_bus *const bus,
                    const uint32_t write, const uint32_t vaddr,
                    uint32_t *const value)
{
    if (cadr_processor_memory_virtual_access(state, bus, write, vaddr, value) !=
        CADR_PROCESSOR_MEMORY_OK) {
        state->cpu.main_memory_nxm = 1U;
    }
}

static uint32_t cadr_lc_byte_mode(const cadr_cpu_state *const cpu)
{
    if ((cpu->interrupt_control & (UINT32_C(1) << 29U)) != 0U) {
        const uint32_t pos = (uint32_t)cpu->p0 & UINT32_C(7);
        return pos | ((((uint32_t)cpu->p0 >> 4U) ^
                       ((cpu->location_counter >> 1U) ^ cpu->location_counter)) & UINT32_C(1)) << 4U |
            ((((uint32_t)cpu->p0 >> 3U) ^ cpu->location_counter) & UINT32_C(1)) << 3U;
    }
    return ((uint32_t)cpu->p0 & UINT32_C(0xf)) |
        ((((((uint32_t)cpu->p0 >> 4U) ^ (cpu->location_counter >> 1U)) & UINT32_C(1)) == 0U)
            ? UINT32_C(0x10) : 0U);
}

static uint32_t cadr_advance_lc(cadr_machine_state *const state,
                                const cadr_processor_memory_bus *const bus,
                                uint32_t pc)
{
    cadr_cpu_state *const cpu = &state->cpu;
    const uint32_t old_lc = cpu->location_counter & CADR_LOCATION_COUNTER_MASK;
    uint32_t last_byte;

    cpu->location_counter += (cpu->interrupt_control & (UINT32_C(1) << 29U)) != 0U ? 1U : 2U;
    if ((cpu->location_counter & (UINT32_C(1) << 31U)) != 0U) {
        cpu->location_counter &= ~(UINT32_C(1) << 31U);
        cpu->vma = old_lc >> 2U;
        cadr_vm(state, bus, 0U, cpu->vma, &cpu->pending_md);
        cpu->pending_md_delay = 2U;
    } else {
        pc |= 2U;
    }
    last_byte = (((cpu->interrupt_control & (UINT32_C(1) << 29U)) != 0U) ?
        (cpu->location_counter & UINT32_C(1)) : 0U) == 0U &&
        (cpu->location_counter & UINT32_C(2)) == 0U;
    if (last_byte != 0U) { cpu->location_counter |= UINT32_C(1) << 31U; }
    return pc;
}

static uint32_t cadr_mfread(cadr_machine_state *const state, const uint32_t address)
{
    cadr_cpu_state *const cpu = &state->cpu;
    uint32_t l1_data;
    uint32_t l2_data;
    uint32_t write_allowed;
    uint32_t access_allowed;

    switch (address & UINT32_C(0x1f)) {
    case 0U: return cpu->dispatch_constant;
    case 1U: return (cpu->micro_stack_pointer << 24U) |
        (cpu->micro_stack[cpu->micro_stack_pointer] & UINT32_C(0x00ffffff));
    case 2U: return cpu->pdl_pointer & UINT32_C(0x3ff);
    case 3U: return cpu->pdl_index & UINT32_C(0x3ff);
    case 5U: return cpu->pdl[cpu->pdl_index];
    case 6U: return cpu->opc;
    case 7U: return cpu->q;
    case 8U: return cpu->vma;
    case 9U:
        (void)cadr_processor_memory_vtop(state, cpu->md, &l1_data, &l2_data,
                                         NULL, &write_allowed, &access_allowed);
        return (write_allowed == 0U ? UINT32_C(1) << 31U : 0U) |
            (access_allowed == 0U ? UINT32_C(1) << 30U : 0U) |
            (UINT32_C(1) << 29U) | ((l1_data & UINT32_C(0x1f)) << 24U) |
            (l2_data & UINT32_C(0x00ffffff));
    case 10U: return cpu->md;
    case 11U: return (cpu->interrupt_control & (UINT32_C(1) << 29U)) != 0U
        ? cpu->location_counter : cpu->location_counter & ~UINT32_C(1);
    case 12U:
        { const uint32_t value = (cpu->micro_stack_pointer << 24U) |
              (cpu->micro_stack[cpu->micro_stack_pointer] & UINT32_C(0x00ffffff));
          cpu->micro_stack_pointer = (cpu->micro_stack_pointer - 1U) & UINT32_C(31);
          return value; }
    case 13U: return 0U;
    case 20U:
        { const uint32_t value = cpu->pdl[cpu->pdl_pointer];
          cpu->pdl_pointer = (cpu->pdl_pointer - 1U) & UINT32_C(0x3ff); return value; }
    case 21U: return cpu->pdl[cpu->pdl_pointer];
    case 22U: return 0U;
    default: return 0U;
    }
}

static void cadr_mfwrite(cadr_machine_state *const state,
                         const cadr_processor_memory_bus *const bus,
                         const uint32_t destination, const uint32_t data)
{
    cadr_cpu_state *const cpu = &state->cpu;
    switch (destination >> 5U) {
    case 0U: return;
    case 1U:
        cpu->location_counter = (cpu->location_counter & ~CADR_LOCATION_COUNTER_MASK) |
            (data & CADR_LOCATION_COUNTER_MASK);
        if ((cpu->interrupt_control & (UINT32_C(1) << 29U)) == 0U) {
            cpu->location_counter &= ~UINT32_C(1);
        }
        cpu->location_counter |= UINT32_C(1) << 31U;
        return;
    case 2U:
        cadr_processor_interrupt_control_write(state, data);
        return;
    case 8U:
        { const uint32_t index = cpu->pdl_pointer;
          const uint32_t old_value = cpu->pdl[index];
          cpu->pdl[index] = data;
          cadr_canonical_write_u32(state, 5U, index, old_value, data);
          cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_PDL, index);
          return; }
    case 9U: cpu->pdl_pointer = (cpu->pdl_pointer + 1U) & UINT32_C(0x3ff);
        { const uint32_t index = cpu->pdl_pointer;
          const uint32_t old_value = cpu->pdl[index];
          cpu->pdl[index] = data;
          cadr_canonical_write_u32(state, 5U, index, old_value, data);
          cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_PDL, index);
          return; }
    case 10U:
        { const uint32_t index = cpu->pdl_index;
          const uint32_t old_value = cpu->pdl[index];
          cpu->pdl[index] = data;
          cadr_canonical_write_u32(state, 5U, index, old_value, data);
          cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_PDL, index);
          return; }
    case 11U: cpu->pdl_index = data & UINT32_C(0x3ff); return;
    case 12U: cpu->pdl_pointer = data & UINT32_C(0x3ff); return;
    case 13U: cadr_push_spc(state, data); return;
    case 14U: cpu->oa_low = data & CADR_LOCATION_COUNTER_MASK; cpu->oa_low_pending = 1U; return;
    case 15U: cpu->oa_high = data & UINT32_C(0x003fffff); cpu->oa_high_pending = 1U; return;
    case 16U: cpu->vma = data; return;
    case 17U: cpu->vma = data; cadr_vm(state, bus, 0U, cpu->vma, &cpu->pending_md);
        cpu->pending_md_delay = 2U; return;
    case 18U: cpu->vma = data; cadr_vm(state, bus, 1U, cpu->vma, &cpu->md); return;
    case 19U: cpu->vma = data; cadr_processor_memory_write_map(state, cpu->vma, cpu->md); return;
    case 24U: cpu->md = data; return;
    case 25U: cpu->md = data; cadr_vm(state, bus, 0U, cpu->vma, &cpu->pending_md);
        cpu->pending_md_delay = 2U; return;
    case 26U: cpu->md = data; cadr_vm(state, bus, 1U, cpu->vma, &cpu->md); return;
    case 27U: cpu->md = data; cadr_processor_memory_write_map(state, cpu->vma, cpu->md); return;
    default: return;
    }
}

static void cadr_write_destination(cadr_machine_state *const state,
                                   const cadr_processor_memory_bus *const bus,
                                   const uint32_t destination, const uint32_t value)
{
    cadr_cpu_state *const cpu = &state->cpu;
    if ((destination & UINT32_C(0x800)) != 0U) {
        const uint32_t index = destination & UINT32_C(0x3ff);
        const uint32_t old_value = cpu->a_memory[index];
        cpu->a_memory[index] = value;
        cadr_canonical_write_u32(state, 2U, index, old_value, value);
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_AMEM, index);
    } else {
        const uint32_t index = destination & UINT32_C(0x1f);
        const uint32_t old_a = cpu->a_memory[index];
        const uint32_t old_m = cpu->m_memory[index];
        cadr_mfwrite(state, bus, destination, value);
        cpu->m_memory[index] = value;
        cpu->a_memory[index] = value;
        cadr_canonical_write_u32(state, 2U, index, old_a, value);
        cadr_canonical_write_u32(state, 3U, index, old_m, value);
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_AMEM, index);
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_MMEM, index);
    }
}

static void cadr_alu(cadr_machine_state *const state,
                     const cadr_processor_memory_bus *const bus,
                     uint32_t mdata, const uint32_t adata)
{
    cadr_cpu_state *const cpu = &state->cpu;
    const uint32_t operation = cadr_ir(cpu, 3U, 6U);
    const uint32_t cin = cadr_ir(cpu, 2U, 1U);
    const uint32_t destination = cadr_ir(cpu, 14U, 12U);
    const int32_t signed_mdata = (int32_t)mdata;
    const int32_t signed_adata = (int32_t)adata;
    int64_t long_value;

    cpu->alu_carry = 0U;
    switch (operation) {
    case 0U: cpu->alu_out = 0U; break;
    case 1U: cpu->alu_out = mdata & adata; break;
    case 2U: cpu->alu_out = mdata & ~adata; break;
    case 3U: cpu->alu_out = mdata; break;
    case 4U: cpu->alu_out = ~mdata & adata; break;
    case 5U: cpu->alu_out = adata; break;
    case 6U: cpu->alu_out = mdata ^ adata; break;
    case 7U: cpu->alu_out = mdata | adata; break;
    case 8U: cpu->alu_out = ~adata & ~mdata; break;
    case 9U: cpu->alu_out = adata == mdata ? 1U : 0U; break;
    case 10U: cpu->alu_out = ~adata; break;
    case 11U: cpu->alu_out = mdata | ~adata; break;
    case 12U: cpu->alu_out = ~mdata; break;
    case 13U: cpu->alu_out = ~mdata | adata; break;
    case 14U: cpu->alu_out = ~mdata | ~adata; break;
    case 15U: cpu->alu_out = UINT32_MAX; break;
    case 16U: cpu->alu_out = cin != 0U ? 0U : UINT32_MAX; break;
    case 17U: long_value = (int64_t)(int32_t)(mdata & adata) - (cin != 0U ? 0 : 1); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 18U: long_value = (int64_t)(int32_t)(mdata & ~adata) - (cin != 0U ? 0 : 1); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 19U: long_value = (int64_t)signed_mdata - (cin != 0U ? 0 : 1); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 20U: long_value = (int64_t)(int32_t)(mdata | ~adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 21U: long_value = (int64_t)(int32_t)(mdata | ~adata) + (int32_t)(mdata & adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 22U: cadr_sub32(mdata, adata, cin, &cpu->alu_out, &cpu->alu_carry); break;
    case 23U: long_value = (int64_t)(int32_t)(mdata | ~adata) + signed_mdata + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 24U: long_value = (int64_t)(int32_t)(mdata | adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 25U: cadr_add32(mdata, adata, cin, &cpu->alu_out, &cpu->alu_carry); break;
    case 26U: long_value = (int64_t)(int32_t)(mdata | adata) + (int32_t)(mdata & ~adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 27U: long_value = (int64_t)(int32_t)(mdata | adata) + signed_mdata + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 28U: cpu->alu_out = mdata + (cin != 0U ? 1U : 0U); cpu->alu_carry = (mdata == UINT32_MAX && cin != 0U) ? 1U : 0U; break;
    case 29U: long_value = (int64_t)signed_mdata + (int32_t)(mdata & adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 30U: long_value = (int64_t)signed_mdata + (int32_t)(mdata | ~adata) + (cin != 0U ? 1 : 0); cpu->alu_out = (uint32_t)long_value; cpu->alu_carry = cadr_signed_wide_carry(long_value); break;
    case 31U: cadr_add32(mdata, mdata, cin, &cpu->alu_out, &cpu->alu_carry); break;
    case 32U:
        if ((cpu->q & 1U) != 0U) { cadr_add32(adata, mdata, cin, &cpu->alu_out, &cpu->alu_carry); }
        else { cpu->alu_out = mdata; cpu->alu_carry = (mdata >> 31U) & 1U; }
        break;
    case 33U:
        if ((cpu->q & 1U) != 0U) { cadr_sub32(mdata, cadr_abs32_bits(signed_adata), cin == 0U ? 1U : 0U, &cpu->alu_out, &cpu->alu_carry); }
        else { cadr_add32(mdata, cadr_abs32_bits(signed_adata), cin, &cpu->alu_out, &cpu->alu_carry); }
        break;
    case 37U:
        if ((cpu->q & 1U) != 0U) { cpu->alu_carry = 0U; }
        else { cadr_add32(cpu->alu_out, cadr_abs32_bits(signed_adata), cin, &cpu->alu_out, &cpu->alu_carry); }
        break;
    case 41U:
        cadr_sub32(mdata, cadr_abs32_bits(signed_adata),
                   cin == 0U ? 1U : 0U, &cpu->alu_out, &cpu->alu_carry);
        break;
    default: break;
    }
    cpu->old_q = cpu->q;
    switch (cadr_ir(cpu, 0U, 2U)) {
    case 1U: cpu->q = (cpu->q << 1U) | ((cpu->alu_out & (UINT32_C(1) << 31U)) == 0U ? 1U : 0U); break;
    case 2U: cpu->q = (cpu->q >> 1U) | ((cpu->alu_out & 1U) != 0U ? (UINT32_C(1) << 31U) : 0U); break;
    case 3U: cpu->q = cpu->alu_out; break;
    default: break;
    }
    switch (cadr_ir(cpu, 12U, 2U)) {
    case 0U: cpu->out = cadr_rol32(mdata, cadr_ir(cpu, 0U, 5U)); break;
    case 1U: cpu->out = cpu->alu_out; break;
    case 2U: cpu->out = (cpu->alu_out >> 1U) |
        (cpu->alu_carry != 0U ? (UINT32_C(1) << 31U) : 0U); break;
    default: cpu->out = (cpu->alu_out << 1U) |
        ((cpu->old_q & (UINT32_C(1) << 31U)) != 0U ? 1U : 0U); break;
    }
#ifdef CADR_TRACE_MUTANT_ALU
    /* Test-only semantic mutant: alter the real ALU result before writeback. */
    cpu->out ^= UINT32_C(1);
#endif
    cadr_write_destination(state, bus, destination, cpu->out);
}

static uint32_t cadr_jump_condition(cadr_machine_state *const state, uint32_t *const mdata,
                                    const uint32_t adata)
{
    const cadr_cpu_state *const cpu = &state->cpu;
    if (cadr_ir(cpu, 5U, 1U) == 0U) {
        *mdata = cadr_rol32(*mdata, cadr_ir(cpu, 0U, 5U));
        state->cpu.decoded_m_data = *mdata;
        return *mdata & 1U;
    }
    switch (cadr_ir(cpu, 0U, 4U)) {
    case 1U: return (int32_t)*mdata < (int32_t)adata ? 1U : 0U;
    case 2U: return (int32_t)*mdata <= (int32_t)adata ? 1U : 0U;
    case 3U: return *mdata == adata ? 1U : 0U;
    case 4U: return state->cpu.vma_ok == 0U ? 1U : 0U;
    case 5U: return state->cpu.vma_ok == 0U ||
        ((state->cpu.interrupt_control & (UINT32_C(1) << 27U)) != 0U &&
         state->cpu.interrupt_pending != 0U) ? 1U : 0U;
    case 6U: return state->cpu.vma_ok == 0U ||
        ((state->cpu.interrupt_control & (UINT32_C(1) << 27U)) != 0U &&
         state->cpu.interrupt_pending != 0U) ||
        (state->cpu.interrupt_control & (UINT32_C(1) << 26U)) != 0U ? 1U : 0U;
    case 7U: return 1U;
    default: return 0U;
    }
}

static void cadr_jump(cadr_machine_state *const state,
                      const cadr_processor_memory_bus *const bus,
                      uint32_t mdata, const uint32_t adata)
{
    cadr_cpu_state *const cpu = &state->cpu;
    uint32_t target = cadr_ir(cpu, 12U, 14U);
    const uint32_t r = cadr_ir(cpu, 9U, 1U);
    const uint32_t p = cadr_ir(cpu, 8U, 1U);
    const uint32_t n = cadr_ir(cpu, 7U, 1U);
    uint32_t condition;
    if (cadr_ir(cpu, 10U, 2U) == 1U) { cpu->halted = 1U; }
    if (p != 0U && r != 0U) {
        state->memory.imem[target] = cpu->instruction_write_register & CADR_U48_MASK;
        cadr_state_v2_note_u64_write(state, CADR_STATE_V2_ROOT_IMEM, target);
        return;
    }
    condition = cadr_jump_condition(state, &mdata, adata);
    if (cadr_ir(cpu, 6U, 1U) != 0U) { condition = condition == 0U ? 1U : 0U; }
    if (p != 0U && condition != 0U) { cadr_push_spc(state, n == 0U ? cpu->next_micro_pc : cpu->next_micro_pc - 1U); }
    if (r != 0U && condition != 0U) {
        target = cadr_pop_spc(cpu);
        if ((target & (UINT32_C(1) << 14U)) != 0U) { target = cadr_advance_lc(state, bus, target); }
        target &= CADR_MICRO_PC_MASK;
    }
    if (condition != 0U) {
#ifdef CADR_TRACE_MUTANT_JUMP
        /* Test-only semantic mutant: perturb the chosen jump destination. */
        target ^= UINT32_C(1);
#endif
        if (n != 0U) { cpu->inhibit = 1U; }
        cpu->next_micro_pc = target;
        cpu->effective_popj = 0U;
    }
}

static void cadr_dispatch(cadr_machine_state *const state,
                          const cadr_processor_memory_bus *const bus,
                          uint32_t mdata, const uint32_t adata)
{
    cadr_cpu_state *const cpu = &state->cpu;
    uint32_t position = cadr_ir(cpu, 0U, 5U);
    const uint32_t length = cadr_ir(cpu, 5U, 3U);
    const uint32_t map = cadr_ir(cpu, 8U, 2U);
    uint32_t address = cadr_ir(cpu, 12U, 11U);
    uint32_t entry;
    uint32_t target;
    uint32_t n;
    uint32_t p;
    uint32_t r;
    uint32_t mask;
    uint32_t l2;
    if (cadr_ir(cpu, 10U, 2U) == 2U) {
        state->cpu.dispatch_memory[address] = adata;
        cadr_state_v2_note_u32_write(state, CADR_STATE_V2_ROOT_DISPATCH, address);
        return;
    }
    if (cadr_ir(cpu, 10U, 2U) == 3U) { position = cadr_lc_byte_mode(cpu); }
    mdata = cadr_rol32(mdata, position);
    cpu->decoded_m_data = mdata;
    mask = length == 0U ? 0U : ((UINT32_C(1) << length) - 1U);
    address |= mdata & mask;
    if (map != 0U) {
        (void)cadr_processor_memory_vtop(state, cpu->md, NULL, &l2, NULL, NULL, NULL);
        if ((map & 1U) != 0U) { address |= (l2 >> 18U) & 1U; }
        if ((map & 2U) != 0U) { address |= (l2 >> 19U) & 1U; }
    }
    entry = state->cpu.dispatch_memory[address & UINT32_C(0x7ff)];
    cpu->dispatch_constant = cadr_ir(cpu, 32U, 10U);
    target = entry & CADR_MICRO_PC_MASK;
    n = (entry >> 14U) & 1U;
    p = (entry >> 15U) & 1U;
    r = (entry >> 16U) & 1U;
    if (cadr_ir(cpu, 25U, 1U) != 0U && n != 0U) { cpu->next_micro_pc -= 1U; }
    if (cadr_ir(cpu, 24U, 1U) != 0U) { (void)cadr_advance_lc(state, bus, 0U); }
    if (n != 0U) { cpu->inhibit = 1U; }
    if (p != 0U && r != 0U) { return; }
    if (p != 0U) { cadr_push_spc(state, n == 0U ? cpu->next_micro_pc : cpu->next_micro_pc - 1U); }
    if (r != 0U) { target = cadr_pop_spc(cpu); if ((target & (UINT32_C(1) << 14U)) != 0U) { target = cadr_advance_lc(state, bus, target); } target &= CADR_MICRO_PC_MASK; }
 #ifdef CADR_TRACE_MUTANT_DISPATCH
    /* Test-only semantic mutant: perturb the dispatch-table outcome. */
    target ^= UINT32_C(1);
 #endif
    cpu->next_micro_pc = target;
    cpu->effective_popj = 0U;
}

static void cadr_byte(cadr_machine_state *const state,
                      const cadr_processor_memory_bus *const bus,
                      uint32_t mdata, const uint32_t adata)
{
    cadr_cpu_state *const cpu = &state->cpu;
    const uint32_t destination = cadr_ir(cpu, 14U, 12U);
    const uint32_t mode = cadr_ir(cpu, 12U, 2U);
    uint32_t position = cadr_ir(cpu, 0U, 5U);
    uint32_t mask_position;
    uint32_t left;
    uint32_t mask;
    if (cadr_ir(cpu, 10U, 2U) == 3U) { position = cadr_lc_byte_mode(cpu); }
    mask_position = (mode & 2U) != 0U ? position : 0U;
    left = (mask_position + cadr_ir(cpu, 5U, 5U)) & UINT32_C(31);
    mask = (UINT32_MAX >> (31U - left)) &
        (UINT32_MAX << mask_position);
    if (mode == 0U) { cpu->out = 0U; }
    else { if (mode == 1U || mode == 3U) {
               mdata = cadr_rol32(mdata, position);
               cpu->decoded_m_data = mdata;
           }
           cpu->out = (mdata & mask) | (adata & ~mask); }
#ifdef CADR_TRACE_MUTANT_BYTE
    /* Test-only semantic mutant: alter byte insertion before writeback. */
    cpu->out ^= UINT32_C(1);
#endif
    cadr_write_destination(state, bus, destination, cpu->out);
}

static void cadr_inc_npc(cadr_machine_state *const state)
{
    cadr_cpu_state *const cpu = &state->cpu;
    cpu->p0_imem = cpu->p1_imem;
    cpu->p0 = cpu->p1;
    cpu->p0_pc = cpu->p1_pc;
    cpu->p1_imem = cpu->prom_disabled;
    cpu->p1 = cpu->p1_imem != 0U ? state->memory.imem[cpu->next_micro_pc] :
        state->memory.prom[cpu->next_micro_pc & UINT32_C(0x1ff)];
    cpu->p1_pc = cpu->next_micro_pc;
    cpu->next_micro_pc = (cpu->next_micro_pc + 1U) & CADR_MICRO_PC_MASK;
    cpu->opc = cpu->p0_pc;
}

static void cadr_trace_latch_begin(cadr_machine_state *const state)
{
    cadr_cpu_state *const cpu = &state->cpu;
    cadr_trace_state *const trace = &state->trace;
    trace->valid_mask = CADR_TRACE_LATCH_VALID_PIPELINE |
        CADR_TRACE_LATCH_VALID_Q | CADR_TRACE_LATCH_VALID_VMA |
        CADR_TRACE_LATCH_VALID_MD | CADR_TRACE_LATCH_VALID_MACRO_PC |
        CADR_TRACE_LATCH_VALID_FAULT | CADR_TRACE_LATCH_VALID_INTERRUPT;
    trace->pre_p0_pc = cpu->p0_pc;
    trace->pre_p1_pc = cpu->p1_pc;
    trace->pre_next_micro_pc = cpu->next_micro_pc;
    trace->pre_opc = cpu->opc;
    trace->pre_q = cpu->q;
    trace->pre_vma = cpu->vma;
    trace->pre_md = cpu->md;
    trace->pre_macro_pc = cpu->location_counter;
    trace->pre_fault = cpu->guest_fault;
    trace->fault_code = cpu->guest_fault;
    trace->pre_interrupt_status = state->bus.interrupt_status;
    trace->pre_interrupt_pending =
        (state->bus.interrupt_status & UINT16_C(0140000)) != 0U ? 1U : 0U;
    trace->interrupt_level = state->bus.interrupt_status & UINT16_C(01774);
    trace->pre_destination = 0U;
    trace->destination_kind = 0U;
    trace->destination_address = 0U;
    trace->post_destination_value = 0U;
    trace->m_source_kind = 0U;
    trace->m_address = 0U;
    trace->m_value = 0U;
    trace->class_outcome = 0U;
}

static void cadr_trace_latch_end(cadr_machine_state *const state,
                                 const uint32_t executed)
{
    cadr_cpu_state *const cpu = &state->cpu;
    cadr_trace_state *const trace = &state->trace;
    trace->post_p0_pc = cpu->p0_pc;
    trace->post_p1_pc = cpu->p1_pc;
    trace->post_next_micro_pc = cpu->next_micro_pc;
    trace->post_opc = cpu->opc;
    trace->post_q = cpu->q;
    trace->post_vma = cpu->vma;
    trace->post_md = cpu->md;
    trace->md_delayed_phase = cpu->pending_md_delay != 0U ? 1U : 0U;
    trace->post_macro_pc = cpu->location_counter;
    trace->post_fault = cpu->guest_fault;
    trace->post_interrupt_status = state->bus.interrupt_status;
    trace->post_interrupt_pending =
        (state->bus.interrupt_status & UINT16_C(0140000)) != 0U ? 1U : 0U;
    trace->interrupt_level = state->bus.interrupt_status & UINT16_C(01774);
    trace->class_outcome = executed != 0U ? cpu->decoded_class + 1U : 0U;
    if (executed != 0U) {
        trace->valid_mask |= CADR_TRACE_LATCH_VALID_DECODED_WORD |
            CADR_TRACE_LATCH_VALID_A_SOURCE | CADR_TRACE_LATCH_VALID_M_SOURCE |
            CADR_TRACE_LATCH_VALID_CLASS_OUTCOME;
    }
}

void cadr_processor_memory_step_with_bus(
    cadr_machine_state *const state,
    const cadr_processor_memory_bus *const bus)
{
    cadr_cpu_state *const cpu = &state->cpu;
    uint32_t mdata;
    uint32_t adata;
    uint32_t msource;
    uint32_t maddress;
    uint32_t aaddress;
    uint64_t raw_fetched_word;

    cadr_trace_latch_begin(state);
    cadr_inc_npc(state);
    raw_fetched_word = cpu->p0 & CADR_U48_MASK;
    state->trace.raw_fetched_word = raw_fetched_word;
    state->trace.effective_word = raw_fetched_word;
    if (cpu->pending_md_delay != 0U) { cpu->pending_md_delay -= 1U; if (cpu->pending_md_delay == 0U) { cpu->md = cpu->pending_md; } }
    if (cpu->inhibit != 0U) {
        cpu->inhibit = 0U;
        cadr_trace_latch_end(state, 0U);
        return;
    }
    if (cpu->oa_low_pending != 0U) { cpu->oa_low_pending = 0U; cpu->p0 |= cpu->oa_low; }
    if (cpu->oa_high_pending != 0U) { cpu->oa_high_pending = 0U; cpu->p0 |= (uint64_t)cpu->oa_high << 26U; }
    cpu->p0 &= CADR_U48_MASK;
    aaddress = cadr_ir(cpu, 32U, 10U);
    msource = cadr_ir(cpu, 31U, 1U);
    maddress = cadr_ir(cpu, 26U, 5U);
    mdata = msource == 0U ? cpu->m_memory[maddress] : cadr_mfread(state, maddress);
    adata = cpu->a_memory[aaddress];
    cpu->decoded_a_address = aaddress;
    cpu->decoded_m_address = maddress;
    cpu->decoded_a_data = adata;
    cpu->decoded_m_data = mdata;
    cpu->decoded_initial_m_data = mdata;
    cpu->decoded_class = cadr_ir(cpu, 43U, 2U);
    cpu->effective_popj = cadr_ir(cpu, 42U, 1U);
    cpu->instruction_write_register =
        ((uint64_t)(adata & UINT32_C(0xffff)) << 32U) | mdata;
    state->trace.effective_word = cpu->p0 & CADR_U48_MASK;
    state->trace.pc = cpu->p0_pc;
    state->trace.store_selector = cpu->p0_imem;
    state->trace.operation = cpu->decoded_class;
    state->trace.a_address = aaddress;
    state->trace.m_address = maddress;
    state->trace.a_value = adata;
    state->trace.m_value = mdata;
    state->trace.instruction_memory = cpu->p0_imem;
    state->trace.functional_m_source = msource;
    state->trace.effective_popj = cpu->effective_popj;
    state->trace.decoded = 1U;
    state->trace.m_source_kind = msource;
    state->trace.pre_destination = cadr_ir(cpu, 14U, 12U);
    if (cpu->decoded_class == 0U || cpu->decoded_class == 3U) {
        state->trace.destination_kind =
            (state->trace.pre_destination & UINT32_C(0x800)) != 0U ? 1U : 2U;
        state->trace.destination_address = state->trace.pre_destination &
            ((state->trace.destination_kind == 1U) ? UINT32_C(0x3ff) : UINT32_C(0x1f));
    }
    switch (cpu->decoded_class) {
    case 0U: cadr_alu(state, bus, mdata, adata); break;
    case 1U: cadr_jump(state, bus, mdata, adata); break;
    case 2U: cadr_dispatch(state, bus, mdata, adata); break;
    default: cadr_byte(state, bus, mdata, adata); break;
    }
    if (cpu->effective_popj != 0U) {
        uint32_t target = cadr_pop_spc(cpu);
        if ((target & (UINT32_C(1) << 14U)) != 0U) {
            target = cadr_advance_lc(state, bus, target);
        }
        cpu->next_micro_pc = target & CADR_MICRO_PC_MASK;
    }
    if (cpu->decoded_class == 0U || cpu->decoded_class == 3U) {
        state->trace.post_destination_value = cpu->out;
        state->trace.valid_mask |= CADR_TRACE_LATCH_VALID_DESTINATION;
    }
    cpu->microinstructions_executed += 1U;
    cadr_trace_latch_end(state, 1U);
}

void cadr_processor_memory_step(cadr_machine_state *const state)
{
    cadr_processor_memory_step_with_bus(state, NULL);
}
