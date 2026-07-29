#include "cadr_machine.h"
#include "cadr_bus_device.h"

#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    uint32_t value = UINT32_MAX;
    if (state == NULL) {
        return 1;
    }
    cadr_bus_device_cold_power_on(state);
    if (cadr_m3_test_guarded_bus_read(state, UINT32_C(017377400), &value) !=
            CADR_STATUS_OK ||
        value != 0U || state->events.unexpected_bus_operation != 0U ||
        state->bus.error_status != CADR_BUS_ERROR_XBUS_NXM) {
        free(state);
        return 1;
    }
    state->bus.error_status = 0U;
    if (cadr_m3_test_guarded_bus_write(state, UINT32_C(017377400),
                                       UINT32_C(0)) != CADR_STATUS_OK ||
        state->events.unexpected_bus_operation != 0U ||
        state->bus.error_status != CADR_BUS_ERROR_XBUS_NXM) {
        free(state);
        return 1;
    }
    state->cpu.prom_disabled = 1U;
    if (cadr_m3_test_guarded_bus_write(state, UINT32_C(017773005),
                                       UINT32_C(04)) != CADR_STATUS_OK ||
        state->cpu.prom_disabled != 0U ||
        state->events.unexpected_bus_operation != 0U) {
        free(state);
        return 1;
    }
    if (cadr_m3_test_guarded_bus_write(state, UINT32_C(017773005),
                                       UINT32_C(046)) != CADR_STATUS_OK ||
        state->cpu.prom_disabled != 1U ||
        state->events.unexpected_bus_operation != 0U) {
        free(state);
        return 1;
    }
    state->bus.error_status = UINT16_C(0177777);
    if (cadr_m3_test_guarded_bus_write(state, UINT32_C(017773022),
                                       UINT32_C(0)) != CADR_STATUS_OK ||
        state->bus.error_status != 0U ||
        state->events.unexpected_bus_operation != 0U) {
        free(state);
        return 1;
    }
    /* D0's exact four-word XBUS window is delegated to the normal traced
     * device route.  Both adjacent words remain fail closed below. */
    value = UINT32_MAX;
    if (cadr_m3_test_guarded_bus_read(state, UINT32_C(017377774), &value) !=
            CADR_STATUS_OK || value != CADR_DISK_STATUS_NOT_ACTIVE ||
        cadr_m3_test_guarded_bus_write(state, UINT32_C(017377774),
                                       UINT32_C(04000)) != CADR_STATUS_OK ||
        cadr_m3_test_guarded_bus_write(state, UINT32_C(017377775),
                                       UINT32_C(0)) != CADR_STATUS_OK ||
        cadr_m3_test_guarded_bus_write(state, UINT32_C(017377776),
                                       UINT32_C(0)) != CADR_STATUS_OK ||
        cadr_m3_test_guarded_bus_write(state, UINT32_C(017377777),
                                       UINT32_C(0)) != CADR_STATUS_OK ||
        cadr_m3_test_guarded_bus_read(state, UINT32_C(017377775), &value) !=
            CADR_STATUS_OK || value != 0U ||
        cadr_m3_test_guarded_bus_read(state, UINT32_C(017377776), &value) !=
            CADR_STATUS_OK || value != 0U ||
        cadr_m3_test_guarded_bus_read(state, UINT32_C(017377777), &value) !=
            CADR_STATUS_OK || value != 0U ||
        state->events.unexpected_bus_operation != 0U) {
        free(state);
        return 1;
    }
    value = UINT32_MAX;
    if (cadr_m3_test_guarded_bus_read(state, UINT32_C(017377404), &value) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        value != 0U || state->events.unexpected_bus_operation != 1U) {
        free(state);
        return 1;
    }
    state->events.unexpected_bus_operation = 0U;
    if (cadr_m3_test_guarded_bus_write(state, UINT32_C(017377404),
                                       UINT32_C(0)) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        state->events.unexpected_bus_operation != 1U) {
        free(state);
        return 1;
    }
    free(state);
    (void)puts("cadr_m3_page_zero_probe: ok");
    return 0;
}
