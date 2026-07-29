#include "cadr_m3_projection.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;
#define CHECK(expression) do { if (!(expression)) { \
    (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #expression); failures += 1; } } while (0)

int main(void)
{
    cadr_machine_state *state;
    cadr_machine_state *before;
    uint8_t first[CADR_SHA256_BYTES];
    uint8_t second[CADR_SHA256_BYTES];
    state = calloc(1U, sizeof(*state)); before = malloc(sizeof(*before));
    CHECK(state != NULL && before != NULL);
    if (state == NULL || before == NULL) { free(state); free(before); return 1; }
    state->clock_slots_completed = 17U;
    state->cpu.p0 = UINT64_C(0x123456789abc);
    state->cpu.vma_ok = 1U;
    *before = *state;
    CHECK(cadr_m3_projection_digest(state, 0U, CADR_M3_PROJECTION_PHASE_S0, first) == CADR_STATUS_OK);
    CHECK(memcmp(state, before, sizeof(*state)) == 0);
    CHECK(cadr_m3_projection_digest(state, 0U, CADR_M3_PROJECTION_PHASE_S0, second) == CADR_STATUS_OK);
    CHECK(memcmp(first, second, sizeof(first)) == 0);
    state->cpu.p0 ^= UINT64_C(1);
    CHECK(cadr_m3_projection_digest(state, 0U, CADR_M3_PROJECTION_PHASE_S0, second) == CADR_STATUS_OK);
    CHECK(memcmp(first, second, sizeof(first)) != 0);
    CHECK(cadr_m3_projection_digest(state, 1U, CADR_M3_PROJECTION_PHASE_EXECUTED, second) == CADR_STATUS_OK);
    CHECK(memcmp(first, second, sizeof(first)) != 0);
    free(before); free(state);
    if (failures != 0) return 1;
    (void)puts("cadr_m3_projection: ok");
    return 0;
}
