#include "cadr_bus_device.h"

static uint16_t low16(const uint64_t value, const uint32_t shift) { return (uint16_t)(value >> shift); }

void cadr_diagnostic_set_latches(cadr_machine_state *const state,
                                 const cadr_diagnostic_latches *const latches)
{
    const uint64_t debug_instruction = state->bus.diagnostic.debug_instruction;
    cadr_diagnostic_latches *const destination = &state->bus.diagnostic;
    destination->instruction = latches->instruction;
    destination->debug_instruction = debug_instruction;
    destination->opc = latches->opc;
    destination->next_micro_pc = latches->next_micro_pc;
    destination->output_bus = latches->output_bus;
    destination->m_source = latches->m_source;
    destination->a_source = latches->a_source;
    destination->machine_error = latches->machine_error;
    destination->single_step_done = latches->single_step_done;
    destination->running = latches->running;
    destination->write_map = latches->write_map;
    destination->destination_spc = latches->destination_spc;
    destination->instruction_write = latches->instruction_write;
    destination->instruction_modify = latches->instruction_modify;
    destination->pdl_write = latches->pdl_write;
    destination->spc_push = latches->spc_push;
    destination->instruction_parity = latches->instruction_parity;
    destination->nop = latches->nop;
    destination->vma_ok = latches->vma_ok;
    destination->jump_condition = latches->jump_condition;
    destination->next_pc_source = latches->next_pc_source;
    destination->reserved0 = 0U;
}

uint64_t cadr_diagnostic_debug_instruction(const cadr_machine_state *const state)
{
    return state->bus.diagnostic.debug_instruction & UINT64_C(0xffffffffffff);
}

static uint16_t flag_register_1(const cadr_diagnostic_latches *const latches)
{
    uint16_t value = UINT16_C(0xf8ff);
    if (latches->machine_error != 0U) value |= UINT16_C(0x0400);
    if (latches->single_step_done != 0U) value |= UINT16_C(0x0200);
    if (latches->running != 0U) value |= UINT16_C(0x0100);
    return value;
}

static uint16_t flag_register_2(const cadr_diagnostic_latches *const latches)
{
    uint16_t value = 0U;
    if (latches->write_map != 0U) value |= UINT16_C(0x2000);
    if (latches->destination_spc != 0U) value |= UINT16_C(0x1000);
    if (latches->instruction_write != 0U) value |= UINT16_C(0x0800);
    if (latches->instruction_modify != 0U) value |= UINT16_C(0x0400);
    if (latches->pdl_write != 0U) value |= UINT16_C(0x0200);
    if (latches->spc_push != 0U) value |= UINT16_C(0x0100);
    if (latches->instruction_parity != 0U) value |= UINT16_C(0x0020);
    if (latches->nop != 0U) value |= UINT16_C(0x0010);
    if (latches->vma_ok != 0U) value |= UINT16_C(0x0008);
    if (latches->jump_condition != 0U) value |= UINT16_C(0x0004);
    value |= (uint16_t)(latches->next_pc_source & UINT8_C(3));
    return value;
}

cadr_status cadr_diagnostic_read(cadr_machine_state *const state, const uint32_t uaddr,
                                 uint16_t *const out_value)
{
    const cadr_diagnostic_latches *const latches = &state->bus.diagnostic;
    if (out_value == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    switch (uaddr) {
    case 0766000U: *out_value = low16(latches->instruction, 0U); break;
    case 0766002U: *out_value = low16(latches->instruction, 16U); break;
    case 0766004U: *out_value = low16(latches->instruction, 32U); break;
    case 0766006U: return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    case 0766010U: *out_value = (uint16_t)latches->opc; break;
    case 0766012U: *out_value = (uint16_t)latches->next_micro_pc; break;
    case 0766014U: *out_value = (uint16_t)latches->output_bus; break;
    case 0766016U: *out_value = (uint16_t)(latches->output_bus >> 16U); break;
    case 0766020U: *out_value = flag_register_1(latches); break;
    case 0766022U: *out_value = flag_register_2(latches); break;
    case 0766024U: *out_value = (uint16_t)latches->m_source; break;
    case 0766026U: *out_value = (uint16_t)(latches->m_source >> 16U); break;
    case 0766030U: *out_value = (uint16_t)latches->a_source; break;
    case 0766032U: *out_value = (uint16_t)(latches->a_source >> 16U); break;
    default: *out_value = 0U; cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    return CADR_STATUS_OK;
}

cadr_status cadr_diagnostic_write(cadr_machine_state *const state, const uint32_t uaddr,
                                  const uint16_t value)
{
    const uint64_t mask = UINT64_C(0xffff);
    switch (uaddr) {
    case 0766000U: state->bus.diagnostic.debug_instruction = (state->bus.diagnostic.debug_instruction & ~mask) | value; break;
    case 0766002U: state->bus.diagnostic.debug_instruction = (state->bus.diagnostic.debug_instruction & ~(mask << 16U)) | ((uint64_t)value << 16U); break;
    case 0766004U: state->bus.diagnostic.debug_instruction = (state->bus.diagnostic.debug_instruction & ~(mask << 32U)) | ((uint64_t)value << 32U); break;
    case 0766006U: if (value != UINT16_C(1)) return CADR_STATUS_UNIMPLEMENTED_DEVICE; break;
    case 0766012U: state->cpu.prom_disabled = (uint8_t)((value >> 5U) & UINT16_C(1)); break;
    default: cadr_bus_set_unibus_nxm(state); return CADR_STATUS_UNIMPLEMENTED_DEVICE;
    }
    return CADR_STATUS_OK;
}
