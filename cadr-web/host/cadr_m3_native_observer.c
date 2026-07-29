#include "cadr_m3_native_observer_sink.h"
#include "cadr_m3_native_observer.h"
#include "cadr_disk_state.h"

#include <string.h>

static FILE *bus_file;
static FILE *disk_file;
static uint64_t slot;
static uint64_t bus_seq;
static uint64_t disk_seq;
static int write_failed;

static void note_write(int result)
{
    if (result < 0) write_failed = 1;
}

static uint32_t disk_unit(const cadr_disk_state *disk)
{
    return (disk->disk_address >> 28U) & UINT32_C(7);
}

static uint32_t disk_cylinder(const cadr_disk_state *disk)
{
    return (disk->disk_address >> 16U) & UINT32_C(07777);
}

static uint32_t disk_head(const cadr_disk_state *disk)
{
    return (disk->disk_address >> 8U) & UINT32_C(0377);
}

static uint64_t disk_lba(const cadr_disk_state *disk)
{
    return (uint64_t)disk_cylinder(disk) *
               (CADR_DISK_T300_HEADS * CADR_DISK_T300_BLOCKS_PER_TRACK) +
           (uint64_t)disk_head(disk) * CADR_DISK_T300_BLOCKS_PER_TRACK +
           (uint64_t)(disk->disk_address & UINT32_C(0377));
}

int cadr_m3_native_observer_open(FILE *bus, FILE *disk, uint64_t slots)
{
    bus_file = bus;
    disk_file = disk;
    slot = 0U;
    bus_seq = 0U;
    disk_seq = 0U;
    write_failed = 0;
    if (bus_file == NULL || disk_file == NULL) return 0;
    note_write(fprintf(bus_file,
        "{\"requested_slots\":%llu,\"schema\":\"CDRM3BUS1\",\"schema_version\":1}\n",
        (unsigned long long)slots));
    note_write(fprintf(disk_file,
        "{\"requested_slots\":%llu,\"schema\":\"CDRM3DISK1\",\"schema_version\":1}\n",
        (unsigned long long)slots));
    return write_failed == 0 && ferror(bus_file) == 0 && ferror(disk_file) == 0;
}

void cadr_m3_native_observer_slot(uint64_t value)
{
    slot = value;
    bus_seq = 0U;
    disk_seq = 0U;
}

int cadr_m3_native_observer_failed(void)
{
    return write_failed != 0 || (bus_file != NULL && ferror(bus_file) != 0) ||
        (disk_file != NULL && ferror(disk_file) != 0);
}

void cadr_m3_native_observer_close(void)
{
    bus_file = NULL;
    disk_file = NULL;
}

void cadr_m3_native_observer_bus(const cadr_machine_state *state,
                                 const char *direction, uint32_t address,
                                 uint32_t write_value, uint32_t read_result)
{
    if (bus_file == NULL || state == NULL) return;
    note_write(fprintf(bus_file,
        "{\"bus_error_after\":%u,\"direction\":\"%s\",\"interrupt_status_after\":%u,\"intra_slot_sequence\":%llu,\"physical_word_address\":%u,\"post_slot_s\":%llu,\"read_result\":%u,\"record\":\"bus\",\"write_value\":%u}\n",
        state->bus.error_status, direction, state->bus.interrupt_status,
        (unsigned long long)bus_seq++, address, (unsigned long long)slot,
        read_result, write_value));
}

static void emit_disk(const cadr_machine_state *state, const char *action,
                      const char *direction, uint32_t offset, uint32_t input,
                      uint32_t returned, const char *interrupt_action,
                      const char *media_action)
{
    const cadr_disk_state *disk;
    const uint32_t status = state->devices.disk.status;
    const uint32_t unit = disk_unit(&state->devices.disk);
    const uint32_t request_ready = state->events.outstanding_request_id != 0U ? 1U : 0U;
    const uint32_t compare = (state->devices.disk.command & UINT32_C(017)) == UINT32_C(010);
    const char *request_direction = request_ready != 0U ? (compare != 0U ? "compare" : "read") : "none";
    disk = &state->devices.disk;
    if (disk_file == NULL) return;
    note_write(fprintf(disk_file,
        "{\"action\":\"%s\",\"attention_interrupt_enable\":%u,\"clp\":%u,\"command\":%u,\"da\":%u,\"done_interrupt_enable\":%u,\"input_value\":%u,\"interrupt_action\":\"%s\",\"intra_slot_sequence\":%llu,\"lma\":%u,\"media_action\":\"%s\",\"post_slot_s\":%llu,\"record\":\"disk\",\"register_direction\":\"%s\",\"register_offset\":%u,\"request_block\":%u,\"request_clp\":%u,\"request_cylinder\":%u,\"request_direction\":\"%s\",\"request_head\":%u,\"request_ready\":%u,\"reset\":%u,\"returned_value\":%u,\"selected_attention\":%u,\"selected_configured\":%u,\"selected_cylinder\":%u,\"selected_fault\":%u,\"selected_head\":%u,\"selected_lba\":%llu,\"selected_online\":%u,\"selected_read_only\":0,\"selected_seek_error\":%u,\"selected_unit\":%u,\"status\":%u}\n",
        action, disk->attention_interrupt_enable, disk->command_list_pointer,
        disk->command, disk->disk_address, disk->done_interrupt_enable, input,
        interrupt_action, (unsigned long long)disk_seq++, disk->last_memory_address,
        media_action, (unsigned long long)slot, direction, offset,
        request_ready != 0U ? (uint32_t)(disk->pending_first_block % CADR_DISK_T300_BLOCKS_PER_TRACK) : 0U,
        request_ready != 0U ? disk->command_list_pointer : 0U,
        request_ready != 0U ? disk_cylinder(disk) : 0U, request_direction,
        request_ready != 0U ? disk_head(disk) : 0U, request_ready,
        disk->reset_condition, returned,
        (status & CADR_DISK_STATUS_ATTENTION) != 0U ? 1U : 0U,
        unit == 0U ? 1U : 0U, disk_cylinder(disk),
        (status & CADR_DISK_STATUS_FAULT) != 0U ? 1U : 0U, disk_head(disk),
        (unsigned long long)disk_lba(disk), unit == 0U ? 1U : 0U,
        (status & CADR_DISK_STATUS_SEEK_ERROR) != 0U ? 1U : 0U, unit, status));
}

void cadr_m3_native_observer_disk(const cadr_machine_state *state,
                                  const char *action, const char *direction,
                                  uint32_t offset, uint32_t input,
                                  uint32_t returned)
{
    const char *media_action = "none";
    if (state == NULL) return;
    if (strcmp(action, "request") == 0 || strcmp(action, "block") == 0 ||
        strcmp(action, "completion") == 0) media_action = action;
    emit_disk(state, action, direction, offset, input, returned, "none", media_action);
}

void cadr_m3_native_observer_disk_interrupt(const cadr_machine_state *state,
                                            const char *action)
{
    if (state == NULL) return;
    emit_disk(state, "interrupt", "none", 0U, 0U, 0U, action, "none");
}
