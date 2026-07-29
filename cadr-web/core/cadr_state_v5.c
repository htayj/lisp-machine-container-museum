#include "cadr_state_v5.h"

#include "cadr_m4_media.h"
#include "cadr_state_v4.h"

#include <string.h>

static void put32(uint8_t *bytes, uint64_t *used, uint32_t value)
{
    uint32_t index;
    for (index = 0U; index < 4U; ++index) bytes[*used + index] = (uint8_t)(value >> (index * 8U));
    *used += 4U;
}

static void put64(uint8_t *bytes, uint64_t *used, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[*used + index] = (uint8_t)(value >> (index * 8U));
    *used += 8U;
}

cadr_status cadr_state_v5_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES])
{
    uint8_t bytes[16384];
    uint8_t v4[CADR_SHA256_BYTES];
    uint64_t used = 0U;
    uint32_t index;
    cadr_status status;
    const cadr_iob_state *iob;
    const cadr_scheduler_state *scheduler;
    static const uint8_t domain[] = "CDRSTATE5";
    if (state == NULL || digest == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    iob = &state->devices.iob;
    scheduler = &state->scheduler;
    if (scheduler->count > CADR_SCHEDULER_EVENT_CAPACITY ||
        iob->key_queue_count > CADR_IOB_KEY_QUEUE_LEN || iob->usec_phase >= 60U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_state_v4_digest(state, v4);
    if (status != CADR_STATUS_OK) return status;
    (void)memcpy(bytes + used, domain, sizeof(domain) - 1U); used += sizeof(domain) - 1U;
    put32(bytes, &used, CADR_STATE_V5_SCHEMA_VERSION);
    (void)memcpy(bytes + used, v4, sizeof(v4)); used += sizeof(v4);
    put32(bytes, &used, iob->csr); put32(bytes, &used, iob->scancode);
    put32(bytes, &used, iob->usec_clock); put32(bytes, &used, iob->usec_latched);
    put32(bytes, &used, iob->usec_phase); put32(bytes, &used, iob->sixty_cycle_clock);
    put32(bytes, &used, iob->key_queue_read); put32(bytes, &used, iob->key_queue_write);
    put32(bytes, &used, iob->key_queue_count);
    for (index = 0U; index < CADR_IOB_KEY_QUEUE_LEN; ++index) put32(bytes, &used, iob->key_queue[index]);
    put64(bytes, &used, scheduler->next_insertion_sequence);
    put32(bytes, &used, scheduler->count); put32(bytes, &used, scheduler->phase);
    put32(bytes, &used, scheduler->hidden_policy); put32(bytes, &used, scheduler->reserved0);
    for (index = 0U; index < scheduler->count; ++index) {
        const cadr_scheduler_event_state *event = &scheduler->events[index];
        put64(bytes, &used, event->due_tick); put64(bytes, &used, event->generation);
        put64(bytes, &used, event->insertion_sequence); put32(bytes, &used, event->kind);
        put32(bytes, &used, event->flags); put32(bytes, &used, event->value);
        put32(bytes, &used, event->reserved0);
    }
    if (scheduler->transcript_count > CADR_SCHEDULER_TRANSCRIPT_CAPACITY ||
        scheduler->transcript_reserved0 != 0U ||
        scheduler->transcript_capture_enabled > 1U ||
        (scheduler->transcript_capture_enabled == 0U && scheduler->transcript_count != 0U) ||
        scheduler->transcript_total_count < scheduler->transcript_count) return CADR_STATUS_INVALID_ARGUMENT;
    /* Draining the host-facing records is deliberately not a guest-state
     * transition.  CDRSTATE5 commits the cumulative witness only. */
    put64(bytes, &used, scheduler->transcript_total_count);
    (void)memcpy(bytes + used, scheduler->transcript_witness_sha256,
                 sizeof(scheduler->transcript_witness_sha256));
    used += sizeof(scheduler->transcript_witness_sha256);
    cadr_m4_media_sha256(bytes, used, digest);
    return CADR_STATUS_OK;
}
