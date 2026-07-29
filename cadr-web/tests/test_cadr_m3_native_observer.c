#include "cadr_m3_native_observer_sink.h"
#include "cadr_m3_native_observer.h"
#include "cadr_state.h"

#include <stdio.h>
#include <string.h>

static int read_all(FILE *stream, char *out, size_t size)
{
    size_t count;
    if (fflush(stream) != 0 || fseek(stream, 0L, SEEK_SET) != 0) return 0;
    count = fread(out, 1U, size - 1U, stream);
    if (ferror(stream) != 0) return 0;
    out[count] = '\0';
    return 1;
}

int main(void)
{
    static cadr_machine_state state;
    static cadr_machine_state before;
    FILE *bus = tmpfile();
    FILE *disk = tmpfile();
    char bus_bytes[1024];
    char disk_bytes[2048];
    const char expected_bus[] =
        "{\"requested_slots\":2,\"schema\":\"CDRM3BUS1\",\"schema_version\":1}\n"
        "{\"bus_error_after\":0,\"direction\":\"read\",\"interrupt_status_after\":0,\"intra_slot_sequence\":0,\"physical_word_address\":3,\"post_slot_s\":1,\"read_result\":7,\"record\":\"bus\",\"write_value\":0}\n";
    const char expected_disk[] =
        "{\"requested_slots\":2,\"schema\":\"CDRM3DISK1\",\"schema_version\":1}\n"
        "{\"action\":\"register\",\"attention_interrupt_enable\":0,\"clp\":0,\"command\":0,\"da\":0,\"done_interrupt_enable\":0,\"input_value\":0,\"interrupt_action\":\"none\",\"intra_slot_sequence\":0,\"lma\":0,\"media_action\":\"none\",\"post_slot_s\":1,\"record\":\"disk\",\"register_direction\":\"read\",\"register_offset\":0,\"request_block\":0,\"request_clp\":0,\"request_cylinder\":0,\"request_direction\":\"none\",\"request_head\":0,\"request_ready\":0,\"reset\":0,\"returned_value\":1,\"selected_attention\":0,\"selected_configured\":1,\"selected_cylinder\":0,\"selected_fault\":0,\"selected_head\":0,\"selected_lba\":0,\"selected_online\":1,\"selected_read_only\":0,\"selected_seek_error\":0,\"selected_unit\":0,\"status\":1}\n";
    if (bus == NULL || disk == NULL) return 1;
    (void)memset(&state, 0, sizeof(state));
    state.devices.disk.status = 1U;
    before = state;
    if (!cadr_m3_native_observer_open(bus, disk, 2U)) return 1;
    cadr_m3_native_observer_slot(1U);
    cadr_m3_native_observer_bus(&state, "read", 3U, 0U, 7U);
    cadr_m3_native_observer_disk(&state, "register", "read", 0U, 0U, 1U);
    if (cadr_m3_native_observer_failed() || memcmp(&state, &before, sizeof(state)) != 0 ||
        !read_all(bus, bus_bytes, sizeof(bus_bytes)) ||
        !read_all(disk, disk_bytes, sizeof(disk_bytes)) ||
        strcmp(bus_bytes, expected_bus) != 0 || strcmp(disk_bytes, expected_disk) != 0) return 1;
    cadr_m3_native_observer_close();
    return fclose(bus) == 0 && fclose(disk) == 0 ? 0 : 1;
}
