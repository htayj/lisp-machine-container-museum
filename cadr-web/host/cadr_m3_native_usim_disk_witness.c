/*
 * Inclusion-only CDRM3DISK1 writer for the upstream-usim disk controller.
 *
 * The extended oracle runner copies this file into its disposable patched
 * source tree and includes it at the end of disk-controller.c.  That gives
 * this code read-only access to the controller's file-local state without
 * widening the public emulator interface or changing the pinned checkout.
 */
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>

enum cadr_m3_native_usim_disk_witness_kind {
    CADR_M3_DISK_REGISTER = 1,
    CADR_M3_DISK_REQUEST = 2,
    CADR_M3_DISK_COMPLETION = 3,
    CADR_M3_DISK_INTERRUPT_ASSERT = 4,
    CADR_M3_DISK_INTERRUPT_DEASSERT = 5,
    CADR_M3_DISK_BLOCK = 6
};

static FILE *cadr_m3_native_usim_disk_witness_stream;
static uint64_t cadr_m3_native_usim_disk_witness_cycle = UINT64_MAX;
static uint64_t cadr_m3_native_usim_disk_witness_sequence;

static void
cadr_m3_native_usim_disk_witness(const uint32_t kind,
                                 const uint32_t register_direction,
                                 const uint32_t register_offset,
                                 const uint32_t input_value,
                                 const uint32_t returned_value)
{
    const struct disk_unit_s *selected;
    const struct disk_unit_s *request;
    const char *action;
    const char *interrupt_action = "none";
    const char *media_action = "none";
    const char *register_name = "none";
    const char *request_direction = "none";

    if (cadr_m3_native_usim_disk_witness_stream == NULL) {
        const char *path = getenv("CADR_M3_UPSTREAM_DISK");
        if (path == NULL || *path == '\0')
            errx(1, "CADR_M3_UPSTREAM_DISK is required");
        cadr_m3_native_usim_disk_witness_stream = fopen(path, "wb");
        if (cadr_m3_native_usim_disk_witness_stream == NULL)
            errx(1, "cannot open CDRM3DISK1 output");
        (void)fputs("{\"requested_slots\":1000000,\"schema\":\"CDRM3DISK1\",\"schema_version\":1}\n",
                    cadr_m3_native_usim_disk_witness_stream);
    }
    if (cadr_m3_native_usim_disk_witness_cycle != machine_cycles) {
        cadr_m3_native_usim_disk_witness_cycle = machine_cycles;
        cadr_m3_native_usim_disk_witness_sequence = 0;
    }

    selected = SELECTED_UNIT_PTR();
    request = xfer_req.p;
    action = kind == CADR_M3_DISK_REGISTER ? "register" :
        kind == CADR_M3_DISK_REQUEST ? "request" :
        kind == CADR_M3_DISK_COMPLETION ? "completion" :
        kind == CADR_M3_DISK_BLOCK ? "block" : "interrupt";
    if (kind == CADR_M3_DISK_INTERRUPT_ASSERT)
        interrupt_action = "assert";
    else if (kind == CADR_M3_DISK_INTERRUPT_DEASSERT)
        interrupt_action = "deassert";
    if (kind == CADR_M3_DISK_REQUEST)
        media_action = "request";
    else if (kind == CADR_M3_DISK_BLOCK)
        media_action = "block";
    else if (kind == CADR_M3_DISK_COMPLETION)
        media_action = "completion";
    if (register_direction == 1u)
        register_name = "read";
    else if (register_direction == 2u)
        register_name = "write";
    if (xfer_req.ready && xfer_req.read)
        request_direction = xfer_req.compare ? "compare" : "read";

    (void)fprintf(cadr_m3_native_usim_disk_witness_stream,
        "{\"action\":\"%s\",\"attention_interrupt_enable\":%u,"
        "\"clp\":%" PRIu32 ",\"command\":%" PRIu32 ",\"da\":%" PRIu32 ","
        "\"done_interrupt_enable\":%u,\"input_value\":%" PRIu32 ","
        "\"interrupt_action\":\"%s\",\"intra_slot_sequence\":%" PRIu64 ","
        "\"lma\":%" PRIu32 ",\"media_action\":\"%s\","
        "\"post_slot_s\":%" PRIu64 ",\"record\":\"disk\","
        "\"register_direction\":\"%s\",\"register_offset\":%" PRIu32 ","
        "\"request_block\":%" PRIu32 ",\"request_clp\":%" PRIu32 ","
        "\"request_cylinder\":%" PRIu32 ",\"request_direction\":\"%s\","
        "\"request_head\":%" PRIu32 ",\"request_ready\":%u,\"reset\":%u,"
        "\"returned_value\":%" PRIu32 ",\"selected_attention\":%u,"
        "\"selected_configured\":%u,\"selected_cylinder\":%" PRIu32 ","
        "\"selected_fault\":%u,\"selected_head\":%" PRIu32 ","
        "\"selected_lba\":%" PRIu32 ",\"selected_online\":%u,"
        "\"selected_read_only\":%u,\"selected_seek_error\":%u,"
        "\"selected_unit\":%" PRIu32 ",\"status\":%" PRIu32 "}\n",
        action, attention_interrupt_enable ? 1u : 0u, clp, cmd, da,
        done_interrupt_enable ? 1u : 0u, input_value, interrupt_action,
        cadr_m3_native_usim_disk_witness_sequence++,
        selected->last_memory_address, media_action, machine_cycles + 1u,
        register_name, register_direction ? register_offset : 0u,
        xfer_req.block, xfer_req.clp, xfer_req.cylinder, request_direction,
        xfer_req.head, xfer_req.ready ? 1u : 0u, reset_condition ? 1u : 0u,
        returned_value, selected->attention ? 1u : 0u,
        selected->configured ? 1u : 0u, selected->cylinder,
        selected->has_fault ? 1u : 0u, selected->head, selected->lba,
        selected->online ? 1u : 0u, selected->read_only ? 1u : 0u,
        selected->seek_error ? 1u : 0u,
        request == NULL ? selected->unit : request->unit, encode_status());
    (void)fflush(cadr_m3_native_usim_disk_witness_stream);
}
