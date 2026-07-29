#include "cadr_bus_device.h"
#include "cadr_machine.h"
#include "cadr_processor_memory.h"
#include "cadr_m3_native_observer.h"
#include "cadr_disk_evidence.h"
#include "cadr_m4_media.h"

#include <string.h>

/*
 * State-only D0 adaptation of usim 330d8248 disk-controller.c.
 *
 * System 303 uses the four XBUS words at 017377774: status/MA/DA/ECC on
 * reads and command/CLP/DA/START on writes.  The maintained usim controller
 * then follows CCWs one page at a time.  We retain that register and CCW
 * contract, but replace its disk-unit mmap and optional worker thread with a
 * copied BLOCK_READ completion.  There are no host pointers, files, threads,
 * or wall-clock decisions in this module.
 *
 * Compatibility profiles deliberately stay distinct.  SYSTEM_303 applies the
 * hardware statement that only CLP bits <15:0> count; USIM_330D preserves the
 * pinned implementation's unmasked `clp + uint16_t offset` expression.  The
 * selected CADR-WEB-303 profile initializes SYSTEM_303.  Tests and a future
 * profile selector may set the stored field to USIM_330D; do not average them.
 */

static uint32_t cadr_disk_read32le(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
           ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static void cadr_disk_write32le(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void cadr_disk_write64le(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static void cadr_disk_evidence(cadr_machine_state *state, uint32_t kind,
                               uint32_t flags, uint64_t first, uint64_t second,
                               uint32_t value, uint32_t detail,
                               const uint8_t *bytes, uint64_t byte_count)
{
    cadr_disk_evidence_tuple tuple;
    const cadr_disk_state *disk = &state->devices.disk;
    (void)memset(&tuple, 0, sizeof(tuple));
    tuple.lba = disk->pending_first_block;
    tuple.generation = state->events.generation;
    tuple.request_id = state->events.outstanding_request_id;
    tuple.expected_completion = state->events.expected_completion_byte_count;
    tuple.command = disk->command; tuple.clp = disk->command_list_pointer;
    tuple.da = disk->disk_address; tuple.lma = disk->last_memory_address;
    tuple.ccw_address = disk->pending_ccw_address; tuple.ccw_index = disk->pending_ccw;
    tuple.status = disk->status;
    tuple.transfer_reset_enables = disk->transfer_active | (disk->reset_condition << 1U) |
        (disk->done_interrupt_enable << 2U) | (disk->attention_interrupt_enable << 3U);
    tuple.bus_irq = state->bus.interrupt_status;
    tuple.operation = state->events.outstanding_operation;
    tuple.completion_queued = state->events.completion_queued;
    cadr_disk_evidence_observe(
        &state->disk_evidence,
        state->clock_slots_completed +
            (state->in_host_completion == 0U ? UINT64_C(1) : UINT64_C(0)),
        &tuple);
    if (cadr_disk_evidence_record(&state->disk_evidence, kind, flags, first,
                                  second, value, detail, bytes, byte_count) !=
        CADR_STATUS_OK) {
        state->devices.disk.status |= CADR_DISK_STATUS_FAULT;
        state->devices.disk.transfer_active = 0U;
        state->events.persistent_status = CADR_STATUS_GUEST_FAULT;
        state->lifecycle = CADR_MACHINE_GUEST_FAULTED;
    } else {
        cadr_disk_evidence_event *event =
            &state->disk_evidence.events[state->disk_evidence.count - 1U];
        cadr_m4_media_sha256(state->events.request_descriptor,
                             state->events.request_descriptor_byte_count,
                             event->descriptor_sha256);
        cadr_m4_media_sha256(state->events.request_payload,
                             state->events.request_payload_byte_count,
                             event->payload_sha256);
        if (kind == CADR_DISK_EVIDENCE_DELIVERY) {
            (void)memcpy(event->delivery_sha256, event->page_sha256,
                         CADR_SHA256_BYTES);
        }
    }
}

static void cadr_disk_evidence_write_page(cadr_machine_state *state)
{
    cadr_disk_evidence_event *event;
    if (state->disk_evidence.count == 0U) return;
    event = &state->disk_evidence.events[state->disk_evidence.count - 1U];
    cadr_m4_media_sha256(state->events.request_payload,
                         state->events.request_payload_byte_count,
                         event->page_sha256);
}

static void cadr_disk_set_active(cadr_machine_state *state)
{
    state->devices.disk.status &= ~CADR_DISK_STATUS_NOT_ACTIVE;
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_STATE, 1U, 0U, 0U,
                       state->devices.disk.status, state->devices.disk.disk_address,
                       NULL, 0U);
}

static void cadr_disk_set_inactive(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    disk->status |= CADR_DISK_STATUS_NOT_ACTIVE;
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_STATE, 0U, 0U, 0U,
                       disk->status, disk->disk_address, NULL, 0U);
    if (disk->done_interrupt_enable != 0U) {
        disk->status |= CADR_DISK_STATUS_INTERRUPT;
        cadr_bus_assert_xbus_interrupt(state);
        cadr_disk_evidence(state, CADR_DISK_EVIDENCE_INTERRUPT, 1U, 0U, 0U,
                           disk->status, 0U, NULL, 0U);
        cadr_m3_native_observer_disk_interrupt(state, "assert");
    }
}

static void cadr_disk_reset(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    const uint32_t compatibility_profile = disk->compatibility_profile;
    (void)memset(disk, 0, sizeof(*disk));
    disk->compatibility_profile = compatibility_profile == CADR_DISK_COMPAT_USIM_330D
        ? CADR_DISK_COMPAT_USIM_330D : CADR_DISK_COMPAT_SYSTEM_303;
    disk->status = CADR_DISK_STATUS_NOT_ACTIVE;
}

static int cadr_disk_selected_unit_is_available(const cadr_disk_state *disk)
{
    return ((disk->disk_address >> 28U) & UINT32_C(7)) == 0U;
}

static uint64_t cadr_disk_lba(const cadr_disk_state *disk)
{
    const uint32_t cylinder = (disk->disk_address >> 16U) & UINT32_C(07777);
    const uint32_t head = (disk->disk_address >> 8U) & UINT32_C(0377);
    const uint32_t block = disk->disk_address & UINT32_C(0377);
    return (uint64_t)cylinder *
               (CADR_DISK_T300_HEADS * CADR_DISK_T300_BLOCKS_PER_TRACK) +
           (uint64_t)head * CADR_DISK_T300_BLOCKS_PER_TRACK + block;
}

static int cadr_disk_address_is_valid(const cadr_disk_state *disk)
{
    const uint32_t cylinder = (disk->disk_address >> 16U) & UINT32_C(07777);
    const uint32_t head = (disk->disk_address >> 8U) & UINT32_C(0377);
    const uint32_t block = disk->disk_address & UINT32_C(0377);
    return cadr_disk_selected_unit_is_available(disk) &&
           cylinder < CADR_DISK_T300_CYLINDERS &&
           head < CADR_DISK_T300_HEADS && block < CADR_DISK_T300_BLOCKS_PER_TRACK;
}

static void cadr_disk_advance_address(cadr_disk_state *disk)
{
    uint32_t cylinder = (disk->disk_address >> 16U) & UINT32_C(07777);
    uint32_t head = (disk->disk_address >> 8U) & UINT32_C(0377);
    uint32_t block = disk->disk_address & UINT32_C(0377);
    const uint32_t unit = disk->disk_address & UINT32_C(0x70000000);
    block += 1U;
    if (block == CADR_DISK_T300_BLOCKS_PER_TRACK) {
        block = 0U;
        head += 1U;
        if (head == CADR_DISK_T300_HEADS) {
            head = 0U;
            cylinder += 1U;
        }
    }
    disk->disk_address = unit | (cylinder << 16U) | (head << 8U) | block;
}

static uint32_t cadr_disk_ccw_address(const cadr_disk_state *disk)
{
    const uint32_t offset = disk->pending_ccw;
    if (disk->compatibility_profile == CADR_DISK_COMPAT_USIM_330D) {
        return disk->command_list_pointer + offset;
    }
    return (disk->command_list_pointer & UINT32_C(0xffff0000)) |
           ((disk->command_list_pointer + offset) & UINT32_C(0xffff));
}

static void cadr_disk_finish_error(cadr_machine_state *state, uint32_t status_bit)
{
    cadr_disk_state *disk = &state->devices.disk;
    disk->status |= status_bit;
    disk->transfer_active = 0U;
    disk->pending_ccw = 0U;
    cadr_disk_set_inactive(state);
}

static cadr_status cadr_disk_issue_current_ccw(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    uint8_t descriptor[sizeof(cadr_block_read_descriptor)];
    uint8_t write_descriptor[sizeof(cadr_block_write_descriptor)];
    uint8_t write_payload[CADR_DISK_BLOCK_BYTES];
    uint32_t ccw;
    uint32_t index;
    cadr_status status;

    disk->pending_ccw_address = cadr_disk_ccw_address(disk);
    disk->last_memory_address = disk->pending_ccw_address;
    disk->status |= CADR_DISK_STATUS_CCW_CYCLE;
    status = cadr_processor_memory_main_read(state, disk->pending_ccw_address, &ccw);
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
        return CADR_STATUS_OK;
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_CCW_READ, 0U,
                       disk->pending_ccw_address, disk->pending_ccw, ccw, 0U,
                       NULL, 0U);
    disk->status &= ~CADR_DISK_STATUS_CCW_CYCLE;
    disk->pending_memory_address = ccw & UINT32_C(0x00ffff00);
    disk->last_memory_address = disk->pending_memory_address;
    disk->pending_first_block = cadr_disk_lba(disk);
    if ((disk->command & UINT32_C(017)) == UINT32_C(011)) {
        for (index = 0U; index < CADR_DISK_BLOCK_WORDS; ++index) {
            uint32_t word;
            status = cadr_processor_memory_main_read(
                state, disk->pending_memory_address + index, &word);
            if (status != CADR_STATUS_OK) {
                cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
                return CADR_STATUS_OK;
            }
            write_payload[index * 4U] = (uint8_t)word;
            write_payload[index * 4U + 1U] = (uint8_t)(word >> 8U);
            write_payload[index * 4U + 2U] = (uint8_t)(word >> 16U);
            write_payload[index * 4U + 3U] = (uint8_t)(word >> 24U);
        }
        /*
         * The core will assign this same monotonically increasing value as
         * the request ID.  Binding it into the descriptor gives the host a
         * nonzero transaction identity before it stages volatile media.
         */
        cadr_disk_write64le(write_descriptor,
                            state->events.next_request_id);
        cadr_disk_write64le(write_descriptor + 8U,
                            disk->pending_first_block);
        cadr_disk_write32le(write_descriptor + 16U, 1U);
        cadr_disk_write32le(write_descriptor + 20U,
                            CADR_DISK_BLOCK_BYTES);
        status = cadr_core_issue_host_request_m4(
            state, CADR_HOST_OPERATION_BLOCK_WRITE,
            write_descriptor, sizeof(write_descriptor),
            write_payload, sizeof(write_payload), 0U);
    } else {
        cadr_disk_write64le(descriptor, disk->pending_first_block);
        cadr_disk_write32le(descriptor + 8U, 1U);
        cadr_disk_write32le(descriptor + 12U,
                            CADR_DISK_BLOCK_BYTES);
        status = cadr_core_issue_host_request(state, CADR_HOST_OPERATION_BLOCK_READ,
                                              descriptor,
                                              sizeof(descriptor),
                                              CADR_DISK_BLOCK_BYTES);
    }
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
    } else {
        cadr_disk_evidence(state, CADR_DISK_EVIDENCE_BLOCK_REQUEST, 0U,
                           disk->pending_first_block, disk->pending_memory_address,
                           state->events.outstanding_operation,
                           (uint32_t)state->events.expected_completion_byte_count,
                           state->events.request_payload,
                           state->events.request_payload_byte_count);
        if (state->events.request_payload_byte_count != 0U) {
            cadr_disk_evidence(state, CADR_DISK_EVIDENCE_PAGE_TRANSFER, 1U,
                               disk->pending_memory_address, disk->pending_first_block,
                               CADR_DISK_BLOCK_BYTES, 0U, state->events.request_payload,
                               state->events.request_payload_byte_count);
        }
        cadr_m3_native_observer_disk(state, "request", "none", 0U, 0U, 0U);
    }
    return status;
}

cadr_status cadr_disk_apply_block_write_completion(cadr_machine_state *state,
                                                    uint32_t host_status,
                                                    const uint8_t *bytes,
                                                    uint64_t byte_count)
{
    cadr_disk_state *disk;
    uint32_t ccw;
    cadr_status status;
    if (state == NULL || (byte_count != 0U && bytes == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    disk = &state->devices.disk;
    if (disk->transfer_active == 0U) return CADR_STATUS_OK;
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_DELIVERY, 1U,
                       disk->pending_first_block, disk->pending_memory_address,
                       host_status, (uint32_t)byte_count, bytes, byte_count);
    cadr_disk_evidence_write_page(state);
    cadr_m3_native_observer_disk(state, "block", "none", 0U, 0U, 0U);
    if (host_status != CADR_HOST_RESULT_OK || byte_count != 0U) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
        cadr_m3_native_observer_disk(state, "completion", "none", 0U, 0U, 0U);
        return CADR_STATUS_OK;
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_APPLICATION, 1U,
                       disk->pending_first_block, disk->pending_memory_address,
                       host_status, (uint32_t)byte_count, bytes, byte_count);
    cadr_disk_evidence_write_page(state);
    disk->last_memory_address = disk->pending_memory_address + CADR_DISK_BLOCK_WORDS - 1U;
    status = cadr_processor_memory_main_read(state, disk->pending_ccw_address, &ccw);
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
        return CADR_STATUS_OK;
    }
    if ((ccw & UINT32_C(1)) == 0U) {
        disk->transfer_active = 0U;
        cadr_disk_set_inactive(state);
        cadr_m3_native_observer_disk(state, "completion", "none", 0U, 0U, 0U);
        return CADR_STATUS_OK;
    }
    disk->pending_ccw += 1U;
    cadr_disk_advance_address(disk);
    if (!cadr_disk_address_is_valid(disk)) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_SEEK_ERROR);
        return CADR_STATUS_OK;
    }
    return CADR_STATUS_WAITING_FOR_HOST;
}

static cadr_status cadr_disk_start_read(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    if (!cadr_disk_selected_unit_is_available(disk)) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_OFFLINE);
        return CADR_STATUS_OK;
    }
    if (!cadr_disk_address_is_valid(disk)) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_SEEK_ERROR);
        return CADR_STATUS_OK;
    }
    disk->transfer_active = 1U;
    disk->pending_ccw = 0U;
    cadr_disk_set_active(state);
    return cadr_disk_issue_current_ccw(state);
}

cadr_status cadr_disk_apply_block_read_completion(cadr_machine_state *state,
                                                   uint32_t host_status,
                                                   const uint8_t *bytes,
                                                   uint64_t byte_count)
{
    cadr_disk_state *disk;
    uint32_t word;
    uint32_t index;
    uint32_t ccw;
    cadr_status status;
    if (state == NULL || (byte_count != 0U && bytes == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    disk = &state->devices.disk;
    if (disk->transfer_active == 0U) return CADR_STATUS_OK;
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_DELIVERY, 0U,
                       disk->pending_first_block, disk->pending_memory_address,
                       host_status, (uint32_t)byte_count, bytes, byte_count);
    cadr_m3_native_observer_disk(state, "block", "none", 0U, 0U, 0U);
    if (host_status != CADR_HOST_RESULT_OK || byte_count != CADR_DISK_BLOCK_BYTES) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
        cadr_m3_native_observer_disk(state, "completion", "none", 0U, 0U, 0U);
        return CADR_STATUS_OK;
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_PAGE_TRANSFER, 0U,
                       disk->pending_memory_address, disk->pending_first_block,
                       (uint32_t)byte_count, 0U, bytes, byte_count);
    if ((disk->command & UINT32_C(017)) == UINT32_C(010)) {
        for (index = 0U; index < CADR_DISK_BLOCK_WORDS; ++index) {
            status = cadr_processor_memory_main_read(state,
                                                     disk->pending_memory_address + index,
                                                     &word);
            if (status != CADR_STATUS_OK) {
                cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
                return CADR_STATUS_OK;
            }
            if (word != cadr_disk_read32le(bytes + index * 4U)) {
                disk->status |= CADR_DISK_STATUS_READ_COMPARE;
            }
        }
    } else {
        for (index = 0U; index < CADR_DISK_BLOCK_WORDS; ++index) {
            status = cadr_processor_memory_main_write(state,
                                                      disk->pending_memory_address + index,
                                                      cadr_disk_read32le(bytes + index * 4U));
            if (status != CADR_STATUS_OK) {
                cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
                return CADR_STATUS_OK;
            }
        }
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_APPLICATION, 0U,
                       disk->pending_first_block, disk->pending_memory_address,
                       host_status, (uint32_t)byte_count, bytes, byte_count);
    disk->last_memory_address = disk->pending_memory_address + CADR_DISK_BLOCK_WORDS - 1U;
    status = cadr_processor_memory_main_read(state, disk->pending_ccw_address, &ccw);
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
        return CADR_STATUS_OK;
    }
    if ((ccw & UINT32_C(1)) == 0U) {
        disk->transfer_active = 0U;
        cadr_disk_set_inactive(state);
        cadr_m3_native_observer_disk(state, "completion", "none", 0U, 0U, 0U);
        return CADR_STATUS_OK;
    }
    disk->pending_ccw += 1U;
    cadr_disk_advance_address(disk);
    if (!cadr_disk_address_is_valid(disk)) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_SEEK_ERROR);
        return CADR_STATUS_OK;
    }
    /* Core clears the just-consumed immutable completion before continuing. */
    return CADR_STATUS_WAITING_FOR_HOST;
}

cadr_status cadr_disk_continue(cadr_machine_state *state)
{
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    if (state->devices.disk.transfer_active == 0U) return CADR_STATUS_OK;
    return cadr_disk_issue_current_ccw(state);
}

cadr_status cadr_disk_read(cadr_machine_state *state, uint32_t offset,
                           uint32_t *out_value)
{
    cadr_disk_state *disk;
    if (state == NULL || out_value == NULL || offset > 3U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    disk = &state->devices.disk;
    if (disk->reset_condition != 0U) {
        *out_value = 0U;
    } else {
        switch (offset) {
        case 0U: *out_value = disk->status; break;
        case 1U: *out_value = disk->last_memory_address; break;
        case 2U: *out_value = disk->disk_address; break;
        default: *out_value = 0U; break;
        }
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_REGISTER_READ, 0U, offset, 0U,
                       *out_value, disk->status, NULL, 0U);
    cadr_m3_native_observer_disk(state,"register","read",offset,0U,*out_value); return CADR_STATUS_OK;
}

cadr_status cadr_disk_write(cadr_machine_state *state, uint32_t offset,
                            uint32_t value)
{
    cadr_disk_state *disk;
    cadr_status status = CADR_STATUS_OK;
    if (state == NULL || offset > 3U) return CADR_STATUS_INVALID_ARGUMENT;
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    disk = &state->devices.disk;
    switch (offset) {
    case 0U:
        if (value == 0U) {
            disk->command = 0U;
            disk->reset_condition = 0U;
        } else if (value == UINT32_C(016)) {
            cadr_disk_reset(state);
            disk->reset_condition = 1U;
        } else if (disk->reset_condition == 0U) {
            disk->command = value;
            disk->done_interrupt_enable = (value & UINT32_C(04000)) != 0U ? 1U : 0U;
            disk->attention_interrupt_enable = (value & UINT32_C(02000)) != 0U ? 1U : 0U;
            if (disk->done_interrupt_enable == 0U && disk->attention_interrupt_enable == 0U) {
                const uint32_t interrupt_before = state->bus.interrupt_status;
                disk->status &= ~CADR_DISK_STATUS_INTERRUPT;
                cadr_bus_deassert_xbus_interrupt(state);
                cadr_disk_evidence(
                    state, CADR_DISK_EVIDENCE_INTERRUPT, 0U,
                    interrupt_before, state->bus.interrupt_status,
                    interrupt_before != state->bus.interrupt_status ? 1U : 0U,
                    0U, NULL, 0U);
                cadr_m3_native_observer_disk_interrupt(state, "deassert");
            }
        }
        break;
    case 1U:
        if (disk->reset_condition == 0U) disk->command_list_pointer = value;
        break;
    case 2U:
        if (disk->reset_condition == 0U) disk->disk_address = value;
        break;
    default:
        if (disk->reset_condition != 0U) break;
        switch (disk->command & UINT32_C(017)) {
        case 0U:
        case UINT32_C(010):
            status = cadr_disk_start_read(state);
            break;
        case UINT32_C(011):
            status = cadr_disk_start_read(state);
            break;
        case 5U:
            /* Pinned usim orders compound command 5 as at-ease, recalibrate,
             * then fault-clear.  Recalibrate completes by re-raising
             * attention, which fault-clear must not erase. */
            cadr_disk_set_active(state);
            disk->status &= ~(CADR_DISK_STATUS_ATTENTION | CADR_DISK_STATUS_ANY_ATTENTION);
            cadr_disk_set_inactive(state);
            if ((disk->command & UINT32_C(01000)) != 0U) {
                cadr_disk_set_active(state);
                disk->disk_address &= UINT32_C(0x70000000);
                disk->status &= ~CADR_DISK_STATUS_SEEK_ERROR;
                disk->status |= CADR_DISK_STATUS_ATTENTION | CADR_DISK_STATUS_ANY_ATTENTION;
                cadr_disk_set_inactive(state);
            }
            if ((disk->command & UINT32_C(00400)) != 0U) {
                cadr_disk_set_active(state);
                /* usim's fault-clear helper resets has_fault, not seek_error. */
                disk->status &= ~CADR_DISK_STATUS_FAULT;
                cadr_disk_set_inactive(state);
            }
            if ((disk->command & UINT32_C(01000)) != 0U) {
                /* The later fault-clear must preserve recalibrate attention. */
                disk->status |= CADR_DISK_STATUS_ATTENTION |
                    CADR_DISK_STATUS_ANY_ATTENTION;
            }
            break;
        case 4U:
            cadr_disk_set_active(state);
            if (!cadr_disk_address_is_valid(disk)) {
                disk->status |= CADR_DISK_STATUS_SEEK_ERROR;
            } else {
                disk->status |= CADR_DISK_STATUS_ATTENTION | CADR_DISK_STATUS_ANY_ATTENTION;
            }
            cadr_disk_set_inactive(state);
            break;
        case 6U:
            cadr_disk_set_active(state);
            cadr_disk_set_inactive(state); /* offset-clear: source-visible no-op */
            break;
        default:
            cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
            status = CADR_STATUS_UNIMPLEMENTED_DEVICE;
            break;
        }
        break;
    }
    cadr_disk_evidence(state, CADR_DISK_EVIDENCE_REGISTER_WRITE, 0U, offset, 0U,
                       value, disk->status, NULL, 0U);
    if (state->disk_evidence.overflowed != 0U) return CADR_STATUS_GUEST_FAULT;
    cadr_m3_native_observer_disk(state,"register","write",offset,value,0U); return status;
}
