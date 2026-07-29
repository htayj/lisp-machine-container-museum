/*
 * Inclusion-only CDRM3BUS1 writer.  This file is textually included at the
 * end of the disposable bus-adaptor.c so each top-level physical bus operation
 * is recorded after its result and error/interrupt state are known.
 */
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>

static FILE *cadr_m3_bus_stream;
static uint64_t cadr_m3_bus_cycle = UINT64_MAX;
static uint64_t cadr_m3_bus_sequence;

static void
cadr_m3_native_usim_bus_witness(const uint32_t direction,
                                const uint32_t physical_word_address,
                                const uint32_t write_value,
                                const uint32_t read_result)
{
    if (cadr_m3_bus_stream == NULL) {
        const char *path = getenv("CADR_M3_UPSTREAM_BUS");
        if (path == NULL || *path == '\0')
            errx(1, "CADR_M3_UPSTREAM_BUS is required");
        cadr_m3_bus_stream = fopen(path, "wb");
        if (cadr_m3_bus_stream == NULL)
            errx(1, "cannot open CDRM3BUS1 output");
        (void)fputs("{\"requested_slots\":1000000,\"schema\":\"CDRM3BUS1\",\"schema_version\":1}\n",
                    cadr_m3_bus_stream);
    }
    if (cadr_m3_bus_cycle != machine_cycles) {
        cadr_m3_bus_cycle = machine_cycles;
        cadr_m3_bus_sequence = 0;
    }
    (void)fprintf(cadr_m3_bus_stream,
        "{\"bus_error_after\":%" PRIu32 ",\"direction\":\"%s\","
        "\"interrupt_status_after\":%" PRIu32 ","
        "\"intra_slot_sequence\":%" PRIu64 ","
        "\"physical_word_address\":%" PRIu32 ","
        "\"post_slot_s\":%" PRIu64 ",\"read_result\":%" PRIu32 ","
        "\"record\":\"bus\",\"write_value\":%" PRIu32 "}\n",
        bus_interface_get_bus_error_status(), direction ? "write" : "read",
        (uint32_t)interrupt_status_reg, cadr_m3_bus_sequence++,
        physical_word_address, machine_cycles + 1u,
        direction ? 0u : read_result, direction ? write_value : 0u);
    if (ferror(cadr_m3_bus_stream))
        errx(1, "cannot write CDRM3BUS1 event");
}
