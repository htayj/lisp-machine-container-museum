#include "cadr_machine.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

int main(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    uint32_t value = UINT32_C(0xffffffff);
    assert(state != NULL);
    assert(cadr_m3_test_guarded_bus_read(state, UINT32_C(012345), &value) ==
           CADR_STATUS_UNIMPLEMENTED_DEVICE);
    assert(value == 0U);
    assert(state->m7_devid_failure.valid == 1U);
    assert(state->m7_devid_failure.site ==
           CADR_M7_DEVID_FAILURE_SITE_GUARDED_BUS_READ);
    assert(state->m7_devid_failure.direction ==
           CADR_M7_DEVID_FAILURE_DIRECTION_READ);
    assert(state->m7_devid_failure.address == UINT32_C(012345));
    assert(state->m7_devid_failure.value == 0U);
    assert(state->m7_devid_failure.result == 0U);
    assert(cadr_m3_test_guarded_bus_write(state, UINT32_C(076543),
                                         UINT32_C(0x12345678)) ==
           CADR_STATUS_UNIMPLEMENTED_DEVICE);
    assert(state->m7_devid_failure.site ==
           CADR_M7_DEVID_FAILURE_SITE_GUARDED_BUS_READ);
    assert(state->m7_devid_failure.address == UINT32_C(012345));
    (void)memset(&state->m7_devid_failure, 0,
                 sizeof(state->m7_devid_failure));
    assert(cadr_m3_test_guarded_bus_write(state, UINT32_C(076543),
                                         UINT32_C(0x12345678)) ==
           CADR_STATUS_UNIMPLEMENTED_DEVICE);
    assert(state->m7_devid_failure.site ==
           CADR_M7_DEVID_FAILURE_SITE_GUARDED_BUS_WRITE);
    assert(state->m7_devid_failure.direction ==
           CADR_M7_DEVID_FAILURE_DIRECTION_WRITE);
    assert(state->m7_devid_failure.address == UINT32_C(076543));
    assert(state->m7_devid_failure.value == UINT32_C(0x12345678));
    assert(state->m7_devid_failure.result == 0U);
    free(state);
    return 0;
}
