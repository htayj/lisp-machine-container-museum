#include "cadr_bus_device.h"
#include "cadr_m3_native_observer_sink.h"
#include "cadr_machine.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CADR_M7_PROM_IOB_CSR_PADDR UINT32_C(017772045)
#define CADR_M7_PROM_IOB_CSR_UADDR UINT32_C(0764112)
/* System 46 documents CSR<5> as Keyboard Ready: the PROM branches to its
 * cold-boot path when this bit is clear. */
#define CADR_M7_PROM_IOB_CSR_VALUE UINT32_C(040)

static int read_all(FILE *stream, char *out, size_t size)
{
    size_t count;
    if (fflush(stream) != 0 || fseek(stream, 0L, SEEK_SET) != 0) return 0;
    count = fread(out, 1U, size - 1U, stream);
    if (ferror(stream) != 0) return 0;
    out[count] = '\0';
    return 1;
}

/* This is the pinned cadr_bus_read32 Unibus formula, kept explicit so the
 * PROM physical-word identity is checked rather than inferred from the CSR. */
static uint32_t physical_to_unibus(const uint32_t paddr)
{
    const uint32_t page = paddr >> 8U;
    return (((page - UINT32_C(037000)) << 8U) |
            (paddr & UINT32_C(255))) << 1U;
}

static int test_cdrm7u1_iob_csr_read(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    FILE *bus = tmpfile();
    FILE *disk = tmpfile();
    char observed[2048];
    const char expected[] =
        "{\"requested_slots\":1,\"schema\":\"CDRM3BUS1\",\"schema_version\":1}\n"
        "{\"bus_error_after\":0,\"direction\":\"read\",\"interrupt_status_after\":0,\"intra_slot_sequence\":0,\"physical_word_address\":4191269,\"post_slot_s\":0,\"read_result\":32,\"record\":\"bus\",\"write_value\":0}\n"
        "{\"bus_error_after\":0,\"direction\":\"write\",\"interrupt_status_after\":0,\"intra_slot_sequence\":1,\"physical_word_address\":4191269,\"post_slot_s\":0,\"read_result\":0,\"record\":\"bus\",\"write_value\":15}\n"
        "{\"bus_error_after\":0,\"direction\":\"read\",\"interrupt_status_after\":0,\"intra_slot_sequence\":2,\"physical_word_address\":4191268,\"post_slot_s\":0,\"read_result\":0,\"record\":\"bus\",\"write_value\":0}\n"
        "{\"bus_error_after\":0,\"direction\":\"read\",\"interrupt_status_after\":0,\"intra_slot_sequence\":3,\"physical_word_address\":4191270,\"post_slot_s\":0,\"read_result\":0,\"record\":\"bus\",\"write_value\":0}\n";
    uint32_t value = UINT32_MAX;
    int result = 1;

    if (state == NULL || bus == NULL || disk == NULL) goto done;
    if (physical_to_unibus(CADR_M7_PROM_IOB_CSR_PADDR) !=
        CADR_M7_PROM_IOB_CSR_UADDR) goto done;
    cadr_bus_device_cold_power_on(state);
    /* This is the modeled IOB CSR latch; a CSR read must not consume it. */
    if (state->devices.iob.csr != 0U) goto done;
    state->devices.iob.csr = CADR_M7_PROM_IOB_CSR_VALUE;
    if (!cadr_m3_native_observer_open(bus, disk, 1U)) goto done;
    cadr_m3_native_observer_slot(0U);

    /* ((037764 - 037000) << 8 | 045) << 1 == 0764112. */
    if (cadr_m3_test_guarded_bus_read(state, CADR_M7_PROM_IOB_CSR_PADDR,
                                      &value) != CADR_STATUS_OK ||
        value != CADR_M7_PROM_IOB_CSR_VALUE ||
        state->devices.iob.csr != CADR_M7_PROM_IOB_CSR_VALUE ||
        state->bus.error_status != 0U || state->bus.interrupt_status != 0U ||
        state->events.unexpected_bus_operation != 0U) goto done;

    /* The M7 exception is read-only: an exact-address write remains rejected
     * before it can reach the normal IOB CSR write implementation. */
    if (cadr_m3_test_guarded_bus_write(state, CADR_M7_PROM_IOB_CSR_PADDR,
                                       UINT32_C(017)) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        state->events.unexpected_bus_operation != 1U ||
        state->devices.iob.csr != CADR_M7_PROM_IOB_CSR_VALUE) goto done;

    state->events.unexpected_bus_operation = 0U;
    value = UINT32_MAX;
    if (cadr_m3_test_guarded_bus_read(state,
                                      CADR_M7_PROM_IOB_CSR_PADDR - UINT32_C(1),
                                      &value) != CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        value != 0U || state->events.unexpected_bus_operation != 1U ||
        state->bus.error_status != 0U ||
        state->devices.iob.csr != CADR_M7_PROM_IOB_CSR_VALUE) goto done;

    state->events.unexpected_bus_operation = 0U;
    value = UINT32_MAX;
    if (cadr_m3_test_guarded_bus_read(state,
                                      CADR_M7_PROM_IOB_CSR_PADDR + UINT32_C(1),
                                      &value) != CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        value != 0U || state->events.unexpected_bus_operation != 1U ||
        state->bus.error_status != 0U ||
        state->devices.iob.csr != CADR_M7_PROM_IOB_CSR_VALUE) goto done;

    if (cadr_m3_native_observer_failed() ||
        !read_all(bus, observed, sizeof(observed)) ||
        strcmp(observed, expected) != 0) goto done;
    result = 0;

done:
    cadr_m3_native_observer_close();
    if (bus != NULL && fclose(bus) != 0) result = 1;
    if (disk != NULL && fclose(disk) != 0) result = 1;
    free(state);
    return result;
}

int main(void)
{
    if (test_cdrm7u1_iob_csr_read() != 0) return 1;
    (void)puts("cadr_m7_iob_csr_route: ok");
    return 0;
}
