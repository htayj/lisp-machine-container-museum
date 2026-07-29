#include "cadr_disk_evidence.h"
#include "cadr_m6_disk_evidence.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

/* Emits one CDRM6E1 summary followed by the exact canonical records for
 * accepted events 512 and 513.  The Node test independently does all SHA-256
 * chaining over these C-produced bytes. */
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
    cadr_m6_disk_evidence_state state;
    cadr_disk_evidence_log prefix;
    cadr_disk_evidence_event event_512;
    cadr_disk_evidence_event event_513;
    uint8_t summary[CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES];
    uint8_t record_512[CADR_DISK_EVIDENCE_RECORD_BYTES];
    uint8_t record_513[CADR_DISK_EVIDENCE_RECORD_BYTES];
    uint64_t written = 0U;
    uint64_t index;

    (void)memset(&prefix, 0, sizeof(prefix));
    cadr_m6_disk_evidence_cold_power_on(&state);
    for (index = 0U; index < UINT64_C(514); ++index) {
        const cadr_disk_evidence_event event = event_at(index);
        assert(cadr_m6_disk_evidence_append(&state, &prefix, &event) ==
               CADR_STATUS_OK);
    }
    assert(cadr_m6_disk_evidence_summary_serialize(
               &state, &prefix, summary, sizeof(summary), &written) ==
           CADR_STATUS_OK);
    assert(written == sizeof(summary));

    event_512 = event_at(UINT64_C(512));
    event_512.sequence = UINT64_C(512);
    event_512.intra_slot = 0U;
    event_513 = event_at(UINT64_C(513));
    event_513.sequence = UINT64_C(513);
    event_513.intra_slot = 1U;
    cadr_m6_disk_evidence_encode_event(record_512, &event_512);
    cadr_m6_disk_evidence_encode_event(record_513, &event_513);
    assert(fwrite(summary, 1U, sizeof(summary), stdout) == sizeof(summary));
    assert(fwrite(record_512, 1U, sizeof(record_512), stdout) == sizeof(record_512));
    assert(fwrite(record_513, 1U, sizeof(record_513), stdout) == sizeof(record_513));
    return fflush(stdout) == 0 ? 0 : 1;
}
