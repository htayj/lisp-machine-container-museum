#include "cadr_bus_device.h"
#include "cadr_machine.h"
#include "cadr_processor_memory.h"
#include "cadr_m3_native_observer.h"

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

static void cadr_disk_set_active(cadr_machine_state *state)
{
    state->devices.disk.status &= ~CADR_DISK_STATUS_NOT_ACTIVE;
}

static void cadr_disk_set_inactive(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    disk->status |= CADR_DISK_STATUS_NOT_ACTIVE;
    if (disk->done_interrupt_enable != 0U) {
        disk->status |= CADR_DISK_STATUS_INTERRUPT;
        cadr_bus_assert_xbus_interrupt(state);
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
    const uint32_t unit = disk->disk_address & UINT32_C(070000000);
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
    cadr_block_read_descriptor descriptor;
    uint32_t ccw;
    cadr_status status;

    disk->pending_ccw_address = cadr_disk_ccw_address(disk);
    disk->last_memory_address = disk->pending_ccw_address;
    disk->status |= CADR_DISK_STATUS_CCW_CYCLE;
    status = cadr_processor_memory_main_read(state, disk->pending_ccw_address, &ccw);
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_NXM);
        return CADR_STATUS_OK;
    }
    disk->status &= ~CADR_DISK_STATUS_CCW_CYCLE;
    disk->pending_memory_address = ccw & UINT32_C(0x00ffff00);
    disk->last_memory_address = disk->pending_memory_address;
    disk->pending_first_block = cadr_disk_lba(disk);
    descriptor.first_block = disk->pending_first_block;
    descriptor.block_count = 1U;
    descriptor.block_bytes = CADR_DISK_BLOCK_BYTES;
    status = cadr_core_issue_host_request(state, CADR_HOST_OPERATION_BLOCK_READ,
                                          (const uint8_t *)&descriptor,
                                          sizeof(descriptor),
                                          CADR_DISK_BLOCK_BYTES);
    if (status != CADR_STATUS_OK) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
    } else {
        cadr_m3_native_observer_disk(state, "request", "none", 0U, 0U, 0U);
    }
    return status;
}

static cadr_status cadr_disk_start_read(cadr_machine_state *state)
{
    cadr_disk_state *disk = &state->devices.disk;
    if (!cadr_disk_address_is_valid(disk)) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_OFFLINE | CADR_DISK_STATUS_SEEK_ERROR);
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
    disk = &state->devices.disk;
    if (disk->transfer_active == 0U) return CADR_STATUS_OK;
    cadr_m3_native_observer_disk(state, "block", "none", 0U, 0U, 0U);
    if (host_status != CADR_HOST_RESULT_OK || byte_count != CADR_DISK_BLOCK_BYTES) {
        cadr_disk_finish_error(state, CADR_DISK_STATUS_FAULT);
        cadr_m3_native_observer_disk(state, "completion", "none", 0U, 0U, 0U);
        return CADR_STATUS_OK;
    }
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
    /* Core clears the just-consumed immutable completion before continuing. */
    return CADR_STATUS_WAITING_FOR_HOST;
}

cadr_status cadr_disk_continue(cadr_machine_state *state)
{
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
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
    cadr_m3_native_observer_disk(state,"register","read",offset,0U,*out_value); return CADR_STATUS_OK;
}

cadr_status cadr_disk_write(cadr_machine_state *state, uint32_t offset,
                            uint32_t value)
{
    cadr_disk_state *disk;
    cadr_status status = CADR_STATUS_OK;
    if (state == NULL || offset > 3U) return CADR_STATUS_INVALID_ARGUMENT;
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
                disk->status &= ~CADR_DISK_STATUS_INTERRUPT;
                cadr_bus_deassert_xbus_interrupt(state);
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
            /* Immutable verified base media: source's writable-unit path is excluded. */
            cadr_disk_finish_error(state, CADR_DISK_STATUS_READ_ONLY | CADR_DISK_STATUS_FAULT);
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
    cadr_m3_native_observer_disk(state,"register","write",offset,value,0U); return status;
}
