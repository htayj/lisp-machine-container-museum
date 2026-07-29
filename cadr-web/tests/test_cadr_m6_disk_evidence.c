#include "cadr_disk_evidence.h"
#include "cadr_m6_disk_evidence.h"

#include <assert.h>
#include <stdint.h>
#include <string.h>

static uint32_t get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t get64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

static cadr_disk_evidence_event event_at(uint64_t sequence)
{
    cadr_disk_evidence_event event;
    uint32_t index;
    (void)memset(&event, 0, sizeof(event));
    event.post_slot = sequence / UINT64_C(2);
    event.kind = CADR_DISK_EVIDENCE_REGISTER_WRITE;
    event.flags = (uint32_t)(sequence & UINT64_C(1));
    event.first = sequence;
    event.second = sequence + UINT64_C(17);
    event.value = (uint32_t)sequence;
    event.detail = UINT32_C(0x6d360000) | (uint32_t)sequence;
    event.before.lba = sequence;
    event.after.lba = sequence + UINT64_C(1);
    event.after.generation = UINT64_C(9);
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        event.descriptor_sha256[index] = (uint8_t)(sequence + index);
        event.payload_sha256[index] = (uint8_t)(sequence + index + UINT64_C(1));
        event.delivery_sha256[index] = (uint8_t)(sequence + index + UINT64_C(2));
        event.page_sha256[index] = (uint8_t)(sequence + index + UINT64_C(3));
    }
    return event;
}

int main(void)
{
    static const uint8_t expected_initial_tail[CADR_SHA256_BYTES] = {
        0x9bU,0x02U,0x08U,0xc0U,0x42U,0xfeU,0xbaU,0x70U,
        0xdfU,0x85U,0x04U,0xc3U,0xf2U,0x52U,0xf0U,0x65U,
        0xffU,0x0dU,0xeeU,0x56U,0xd5U,0x07U,0x85U,0xc4U,
        0x0eU,0x94U,0x39U,0xceU,0xfeU,0x04U,0x79U,0x82U,
    };
    static const uint8_t expected_first_tail[CADR_SHA256_BYTES] = {
        0x57U,0x26U,0xa3U,0xceU,0x18U,0x44U,0x8cU,0x2cU,
        0x3fU,0xa3U,0x56U,0x24U,0x1fU,0x72U,0x1eU,0x81U,
        0x49U,0x00U,0xb1U,0x72U,0xc3U,0x3fU,0x4aU,0x91U,
        0xcaU,0x81U,0x79U,0x3eU,0x5cU,0xdeU,0x44U,0x84U,
    };
    cadr_m6_disk_evidence_state state;
    cadr_m6_disk_evidence_state full_prefix_state;
    cadr_disk_evidence_log prefix;
    cadr_disk_evidence_log full_prefix;
    cadr_disk_evidence_event preserved;
    uint8_t summary[CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES];
    uint8_t initial_tail[CADR_SHA256_BYTES];
    uint64_t written = 0U;
    uint64_t index;

    (void)memset(&prefix, 0, sizeof(prefix));
    cadr_m6_disk_evidence_cold_power_on(&state);
    (void)memcpy(initial_tail, state.tail_sha256, sizeof(initial_tail));
    assert(memcmp(initial_tail, expected_initial_tail, sizeof(initial_tail)) == 0);
    assert(state.selected_maximum == CADR_M6_DEVID_MAX_TOTAL_EVENTS);

    (void)memset(&full_prefix, 0, sizeof(full_prefix));
    cadr_m6_disk_evidence_cold_power_on(&full_prefix_state);
    for (index = 0U; index < CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY; ++index) {
        const cadr_disk_evidence_event event = event_at(index);
        assert(cadr_m6_disk_evidence_append(&full_prefix_state, &full_prefix,
                                             &event) == CADR_STATUS_OK);
    }
    assert(cadr_m6_disk_evidence_summary_serialize(
               &full_prefix_state, &full_prefix, summary, sizeof(summary), &written) ==
           CADR_STATUS_OK);
    assert(get32(summary + 20U) == 0U && get64(summary + 48U) == 0U &&
           get64(summary + 56U) == 0U);
    assert(memcmp(summary + 272U, expected_initial_tail,
                  sizeof(expected_initial_tail)) == 0);

    for (index = 0U; index < CADR_M6_DEVID_MAX_TOTAL_EVENTS; ++index) {
        const cadr_disk_evidence_event event = event_at(index);
        assert(cadr_m6_disk_evidence_append(&state, &prefix, &event) ==
               CADR_STATUS_OK);
    }
    assert(prefix.count == CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);
    assert(prefix.overflowed == 0U);
    assert(state.total_accepted == CADR_M6_DEVID_MAX_TOTAL_EVENTS);
    assert(state.tail_started == 1U);
    assert(state.tail_event_count == 1U);
    assert(state.first_omitted_sequence == CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);
    assert(memcmp(initial_tail, state.tail_sha256, CADR_SHA256_BYTES) != 0);
    assert(prefix.events[CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U].sequence ==
           CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U);

    preserved = prefix.events[CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U];
    {
        const cadr_disk_evidence_event rejected =
            event_at(CADR_M6_DEVID_MAX_TOTAL_EVENTS);
        assert(cadr_m6_disk_evidence_append(&state, &prefix, &rejected) ==
               CADR_STATUS_GUEST_FAULT);
    }
    assert(cadr_m6_disk_evidence_limit_exceeded(&state));
    assert(state.limit_reason == 1U);
    assert(memcmp(&preserved,
                  &prefix.events[CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U],
                  sizeof(preserved)) == 0);

    prefix.events[CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U].intra_slot ^= 1U;
    assert(cadr_m6_disk_evidence_summary_serialize(
               &state, &prefix, summary, sizeof(summary), &written) ==
           CADR_STATUS_INVALID_ARGUMENT);
    prefix.events[CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY - 1U] = preserved;

    assert(cadr_m6_disk_evidence_summary_serialize(
               &state, &prefix, summary, sizeof(summary), &written) ==
           CADR_STATUS_OK);
    assert(written == CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES);
    assert(memcmp(summary, "CDRM6E1", 7U) == 0 && summary[7] == 0U);
    assert(get32(summary + 8U) == 1U);
    assert(get32(summary + 12U) == CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES);
    assert(get32(summary + 16U) == CADR_M6_DISK_EVIDENCE_POLICY_CODE);
    assert(get32(summary + 20U) == 3U);
    assert(get32(summary + 24U) == CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);
    assert(get32(summary + 28U) == CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);
    assert(get64(summary + 32U) == CADR_M6_DEVID_MAX_TOTAL_EVENTS);
    assert(get64(summary + 40U) == CADR_M6_DEVID_MAX_TOTAL_EVENTS);
    assert(get64(summary + 48U) == 1U);
    assert(get64(summary + 56U) == CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);
    assert(get64(summary + 64U) == CADR_M6_DEVID_MAX_TOTAL_EVENTS - 1U);
    assert(memcmp(summary + 272U, expected_first_tail,
                  sizeof(expected_first_tail)) == 0);
    assert(get64(summary + 304U) ==
           CADR_M6_DEVID_MAX_TOTAL_EVENTS / UINT64_C(2));
    assert(get32(summary + 316U) == 1U);
    for (index = 352U; index < CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES; ++index) {
        assert(summary[index] == 0U);
    }
    return 0;
}
