#include "cadr_m4_controller_transcript.h"
#include "cadr_m4_media.h"
#include "cadr_state_v2.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\n", \
                      __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static uint64_t u64le(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

static cadr_machine_state *valid_state(void)
{
    cadr_machine_state *state = calloc(1U, sizeof(*state));
    if (state == NULL) return NULL;
    state->memory.main_memory_pages = 1U;
    state->memory.mapped_words = CADR_MAIN_MEMORY_WORDS_PER_PAGE;
    state->canonical.initialized = 1U;
    state->canonical.mutation_count = 1U;
    state->canonical.mutation_events[0][0] = UINT8_C(0x31);
    state->events.generation = 17U;
    state->events.next_request_id = 4U;
    state->clock_slots_completed = CADR_M4_CTRL_QUIET_BOUNDARY;
    if (cadr_state_v2_rebuild(state) != CADR_STATUS_OK) {
        free(state);
        return NULL;
    }
    return state;
}

static void test_success_and_failures(void)
{
    cadr_machine_state *state = valid_state();
    cadr_m4_controller_transcript_config config;
    static const uint8_t kinds[67] = {
        1U,2U,1U,1U,9U,2U,2U,2U,8U,8U,8U,8U,2U,1U,1U,9U,
        2U,2U,2U,8U,8U,8U,8U,2U,1U,1U,1U,9U,2U,2U,2U,8U,
        3U,4U,7U,2U,5U,6U,8U,1U,1U,9U,2U,2U,2U,8U,3U,4U,
        2U,5U,7U,6U,8U,1U,1U,2U,2U,2U,8U,3U,4U,2U,5U,7U,
        6U,8U,1U
    };
    static const uint32_t request_indices[3] = {33U, 47U, 60U};
    static const uint32_t delivery_indices[3] = {36U, 49U, 62U};
    static const uint32_t application_indices[3] = {37U, 51U, 64U};
    static const uint32_t page_indices[3] = {34U, 50U, 63U};
    static const uint32_t commands[3] = {011U, 010U, 0U};
    static const uint64_t blocks[3] = {1U, 1U, 0U};
    static const uint32_t operations[3] = {
        CADR_HOST_OPERATION_BLOCK_WRITE,
        CADR_HOST_OPERATION_BLOCK_READ,
        CADR_HOST_OPERATION_BLOCK_READ
    };
    cadr_disk_evidence_event *event;
    uint8_t blob[256U + 67U * 384U + 256U];
    uint8_t digest[32];
    uint64_t size = 0U;
    uint64_t written = UINT64_MAX;
    uint32_t index;
    if (state == NULL) {
        CHECK(0);
        return;
    }
    (void)memset(&config, 0, sizeof(config));
    config.terminal_reached = 1U;
    config.terminal_boundary = CADR_M4_CTRL_TERMINAL_BOUNDARY;
    config.p0_pc = UINT64_C(0355);
    config.p1_pc = UINT64_C(0356);
    config.next_micro_pc = UINT64_C(0357);
    state->disk_evidence.count = 67U;
    state->disk_evidence.next_sequence = 67U;
    for (index = 0U; index < 67U; ++index) {
        event = &state->disk_evidence.events[index];
        (void)memset(event, 0, sizeof(*event));
        event->sequence = index;
        event->post_slot = UINT64_C(505000) + index;
        event->kind = kinds[index];
    }
    event = &state->disk_evidence.events[1];
    event->first = 3U;
    event->before.command = UINT32_C(0405);
    for (index = 0U; index < 3U; ++index) {
        cadr_disk_evidence_event *request =
            &state->disk_evidence.events[request_indices[index]];
        cadr_disk_evidence_event *delivery =
            &state->disk_evidence.events[delivery_indices[index]];
        cadr_disk_evidence_event *application =
            &state->disk_evidence.events[application_indices[index]];
        cadr_disk_evidence_event *page =
            &state->disk_evidence.events[page_indices[index]];
        request->after.command = commands[index];
        request->after.lba = blocks[index];
        request->after.operation = operations[index];
        request->after.request_id = (uint64_t)index + 1U;
        delivery->after = request->after;
        application->after = request->after;
        page->after.command = commands[index];
        page->second = blocks[index];
        page->value = 1024U;
        page->flags = index == 0U ? 1U : 0U;
    }
    state->disk_evidence.last_after =
        state->disk_evidence.events[66].after;

    CHECK(cadr_m4_controller_transcript_size(
              &state->disk_evidence, &size) == CADR_STATUS_OK);
    CHECK(size == sizeof(blob));
    CHECK(cadr_m4_controller_transcript_serialize(
              &config, state, &state->disk_evidence, blob, sizeof(blob),
              &written) == CADR_STATUS_OK);
    CHECK(written == sizeof(blob));
    CHECK(memcmp(blob, "CDRM4CTRL1", 10U) == 0);
    CHECK(u64le(blob + 40U) == CADR_M4_CTRL_QUIET_BOUNDARY);
    CHECK(memcmp(blob + 256U + 67U * 384U, "CDRM4END1", 9U) == 0);
    cadr_m4_media_sha256(blob + 256U, 67U * 384U, digest);
    CHECK(memcmp(digest, blob + 256U + 67U * 384U + 128U, 32U) == 0);
    cadr_m4_media_sha256(blob + 256U + 66U * 384U + 144U, 80U, digest);
    CHECK(memcmp(digest, blob + 256U + 67U * 384U + 192U, 32U) == 0);

    event = &state->disk_evidence.events[66];
    event->post_slot = CADR_M4_CTRL_TERMINAL_BOUNDARY + 1U;
    written = UINT64_MAX;
    CHECK(cadr_m4_controller_transcript_serialize(
              &config, state, &state->disk_evidence, blob, sizeof(blob),
              &written) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(written == 0U);
    event->post_slot = UINT64_C(505066);
    state->disk_evidence.events[34].kind =
        CADR_DISK_EVIDENCE_REGISTER_READ;
    CHECK(cadr_m4_controller_transcript_serialize(
              &config, state, &state->disk_evidence, blob, sizeof(blob),
              &written) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(written == 0U);
    state->disk_evidence.events[34].kind =
        CADR_DISK_EVIDENCE_PAGE_TRANSFER;
    config.terminal_reached = 0U;
    CHECK(cadr_m4_controller_transcript_serialize(
              &config, state, &state->disk_evidence, blob, sizeof(blob),
              &written) == CADR_STATUS_NOT_READY);
    CHECK(written == 0U);
    config.terminal_reached = 1U;
    CHECK(cadr_m4_controller_transcript_serialize(
              &config, state, &state->disk_evidence, blob,
              sizeof(blob) - 1U, &written) == CADR_STATUS_WRONG_LENGTH);
    CHECK(written == 0U);
    free(state);
}

int main(void)
{
    test_success_and_failures();
    if (failures != 0) return 1;
    (void)puts("cadr M4 controller transcript tests passed");
    return 0;
}
