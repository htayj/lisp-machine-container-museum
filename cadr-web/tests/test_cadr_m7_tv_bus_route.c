#include "cadr_bus_device.h"
#include "cadr_machine.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define TV_FIRST UINT32_C(017000000)
#define TV_LAST UINT32_C(017077777)
#define OBSERVED_PADDR UINT32_C(017051765)
#define OBSERVED_OFFSET UINT32_C(051765)

static int test_m7_tv_range(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    uint32_t value = 0U;
    if (state == NULL) return 1;
    cadr_bus_device_cold_power_on(state);

    if (cadr_m3_test_guarded_bus_write(state, OBSERVED_PADDR,
                                       UINT32_MAX) != CADR_STATUS_OK ||
        state->devices.tv_screen[OBSERVED_OFFSET] != UINT32_MAX ||
        state->events.unexpected_bus_operation != 0U ||
        state->bus.error_status != 0U ||
        cadr_m3_test_guarded_bus_read(state, OBSERVED_PADDR, &value) !=
            CADR_STATUS_OK ||
        value != UINT32_MAX) goto fail;

    if (cadr_m3_test_guarded_bus_write(state, TV_FIRST,
                                       UINT32_C(0x01234567)) != CADR_STATUS_OK ||
        cadr_m3_test_guarded_bus_write(state, TV_LAST,
                                       UINT32_C(0x89abcdef)) != CADR_STATUS_OK ||
        state->devices.tv_screen[0] != UINT32_C(0x01234567) ||
        state->devices.tv_screen[077777] != UINT32_C(0x89abcdef)) goto fail;

    if (cadr_m3_test_guarded_bus_write(state, TV_FIRST - UINT32_C(1), 0U) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        state->events.unexpected_bus_operation != 1U) goto fail;
    state->events.unexpected_bus_operation = 0U;
    value = UINT32_MAX;
    if (cadr_m3_test_guarded_bus_read(state, TV_LAST + UINT32_C(1), &value) !=
            CADR_STATUS_UNIMPLEMENTED_DEVICE ||
        value != 0U || state->events.unexpected_bus_operation != 1U) goto fail;

    free(state);
    return 0;
fail:
    free(state);
    return 1;
}

int main(void)
{
    if (test_m7_tv_range() != 0) return 1;
    (void)puts("cadr_m7_tv_bus_route: ok");
    return 0;
}
