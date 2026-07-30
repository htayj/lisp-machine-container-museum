#include "cadr_disk_evidence.h"
#include "cadr_m4_media.h"
#include "cadr_m6_disk_evidence.h"

#include <assert.h>
#include <stdint.h>
#include <string.h>

typedef struct differential_context {
    cadr_disk_evidence_log frozen_m4;
    cadr_disk_evidence_log m6_prefix;
    cadr_m6_disk_evidence_state m6;
    uint64_t next_post_slot;
} differential_context;

static cadr_disk_evidence_tuple tuple_for(uint64_t ordinal,
                                          uint32_t operation)
{
    cadr_disk_evidence_tuple tuple;
    (void)memset(&tuple, 0, sizeof(tuple));
    tuple.lba = ordinal + UINT64_C(40);
    tuple.generation = UINT64_C(7);
    tuple.request_id = ordinal + UINT64_C(101);
    tuple.expected_completion = operation == CADR_HOST_OPERATION_BLOCK_READ ?
        UINT64_C(1024) : 0U;
    tuple.command = UINT32_C(010) + (uint32_t)ordinal;
    tuple.clp = UINT32_C(0123400) + (uint32_t)ordinal;
    tuple.da = UINT32_C(0456000) + (uint32_t)ordinal;
    tuple.lma = UINT32_C(01000) + (uint32_t)ordinal;
    tuple.ccw_address = UINT32_C(02000) + (uint32_t)ordinal;
    tuple.ccw_index = (uint32_t)ordinal;
    tuple.status = UINT32_C(0100000) | (uint32_t)ordinal;
    tuple.transfer_reset_enables = UINT32_C(1);
    tuple.bus_irq = (uint32_t)(ordinal & UINT64_C(1));
    tuple.operation = operation;
    tuple.completion_queued = ordinal == 0U ? 0U : 1U;
    return tuple;
}

static void compare_prefixes(const differential_context *context)
{
    uint8_t frozen[16U + 16U * 384U];
    uint8_t m6[16U + 16U * 384U];
    uint64_t frozen_written = 0U;
    uint64_t m6_written = 0U;
    assert(cadr_disk_evidence_serialize(&context->frozen_m4, frozen,
                                         sizeof(frozen), &frozen_written) ==
           CADR_STATUS_OK);
    assert(cadr_disk_evidence_serialize(&context->m6_prefix, m6, sizeof(m6),
                                         &m6_written) == CADR_STATUS_OK);
    assert(frozen_written == m6_written);
    assert(memcmp(frozen, m6, (size_t)frozen_written) == 0);
}

/* Model the literal frozen M4 controller sequence: record first, enrich the
 * descriptor/payload hashes, copy a delivery's original page hash, then (for
 * write delivery/application) replace only page_sha256 with request payload. */
static void emit_pair(differential_context *context, uint32_t kind,
                      uint32_t flags, uint64_t first, uint64_t second,
                      uint32_t value, uint32_t detail,
                      uint32_t operation,
                      const uint8_t *request_descriptor,
                      uint64_t request_descriptor_bytes,
                      const uint8_t *request_payload,
                      uint64_t request_payload_bytes,
                      const uint8_t *event_bytes,
                      uint64_t event_byte_count,
                      int write_page_after)
{
    cadr_disk_evidence_tuple tuple = tuple_for(context->frozen_m4.count,
                                                operation);
    cadr_disk_evidence_event *m4_event;
    const uint64_t post_slot = context->next_post_slot;
    cadr_status status;

    cadr_disk_evidence_observe(&context->frozen_m4, post_slot, &tuple);
    assert(cadr_disk_evidence_record(&context->frozen_m4, kind, flags, first,
                                     second, value, detail, event_bytes,
                                     event_byte_count) == CADR_STATUS_OK);
    m4_event = &context->frozen_m4.events[context->frozen_m4.count - 1U];
    cadr_m4_media_sha256(request_descriptor, request_descriptor_bytes,
                         m4_event->descriptor_sha256);
    cadr_m4_media_sha256(request_payload, request_payload_bytes,
                         m4_event->payload_sha256);
    if (kind == CADR_DISK_EVIDENCE_DELIVERY) {
        (void)memcpy(m4_event->delivery_sha256, m4_event->page_sha256,
                     CADR_SHA256_BYTES);
    }
    if (write_page_after) {
        cadr_m4_media_sha256(request_payload, request_payload_bytes,
                             m4_event->page_sha256);
    }

    status = cadr_m6_disk_evidence_produce_final_event(
        &context->m6, &context->m6_prefix, post_slot, &tuple, kind, flags,
        first, second, value, detail, operation, request_descriptor,
        request_descriptor_bytes, request_payload, request_payload_bytes,
        event_bytes, event_byte_count);
    assert(status == CADR_STATUS_OK);
    compare_prefixes(context);
    context->next_post_slot +=
        kind == CADR_DISK_EVIDENCE_DELIVERY ? UINT64_C(1) : 0U;
}

int main(void)
{
    differential_context context;
    uint8_t read_descriptor[16];
    uint8_t write_descriptor[24];
    uint8_t read_page[1024];
    uint8_t write_payload[1024];
    uint32_t index;

    (void)memset(&context, 0, sizeof(context));
    cadr_m6_disk_evidence_cold_power_on(&context.m6);
    for (index = 0U; index < sizeof(read_descriptor); ++index) {
        read_descriptor[index] = (uint8_t)(UINT32_C(0x10) + index);
    }
    for (index = 0U; index < sizeof(write_descriptor); ++index) {
        write_descriptor[index] = (uint8_t)(UINT32_C(0x40) + index);
    }
    for (index = 0U; index < sizeof(read_page); ++index) {
        read_page[index] = (uint8_t)(index * UINT32_C(3));
        write_payload[index] = (uint8_t)(UINT32_C(0xff) - index);
    }

    emit_pair(&context, CADR_DISK_EVIDENCE_REGISTER_READ, 0U, 0U, 0U,
              UINT32_C(0123), 0U, CADR_HOST_OPERATION_NONE,
              NULL, 0U, NULL, 0U, NULL, 0U, 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_STATE, 1U, 0U, 0U,
              UINT32_C(0100000), UINT32_C(040), CADR_HOST_OPERATION_NONE,
              NULL, 0U, NULL, 0U, NULL, 0U, 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_INTERRUPT, 1U,
              UINT32_C(1), UINT32_C(0), UINT32_C(1), 0U,
              CADR_HOST_OPERATION_NONE, NULL, 0U, NULL, 0U, NULL, 0U, 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_CCW_READ, 0U, 02000U, 0U,
              UINT32_C(077), 0U, CADR_HOST_OPERATION_NONE,
              NULL, 0U, NULL, 0U, NULL, 0U, 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_BLOCK_REQUEST, 0U, 40U, 02000U,
              CADR_HOST_OPERATION_BLOCK_READ, 1024U,
              CADR_HOST_OPERATION_BLOCK_READ, read_descriptor,
              sizeof(read_descriptor), NULL, 0U, NULL, 0U, 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_DELIVERY, 0U, 40U, 02000U, 0U,
              sizeof(read_page), CADR_HOST_OPERATION_BLOCK_READ,
              read_descriptor, sizeof(read_descriptor), NULL, 0U, read_page,
              sizeof(read_page), 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_PAGE_TRANSFER, 0U, 02000U, 40U,
              sizeof(read_page), 0U, CADR_HOST_OPERATION_BLOCK_READ,
              read_descriptor, sizeof(read_descriptor), NULL, 0U, read_page,
              sizeof(read_page), 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_APPLICATION, 0U, 40U, 02000U, 0U,
              sizeof(read_page), CADR_HOST_OPERATION_BLOCK_READ,
              read_descriptor, sizeof(read_descriptor), NULL, 0U, read_page,
              sizeof(read_page), 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_BLOCK_REQUEST, 0U, 41U, 03000U,
              CADR_HOST_OPERATION_BLOCK_WRITE, 0U,
              CADR_HOST_OPERATION_BLOCK_WRITE, write_descriptor,
              sizeof(write_descriptor), write_payload, sizeof(write_payload),
              write_payload, sizeof(write_payload), 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_PAGE_TRANSFER, 1U, 03000U, 41U,
              sizeof(write_payload), 0U, CADR_HOST_OPERATION_BLOCK_WRITE,
              write_descriptor, sizeof(write_descriptor), write_payload,
              sizeof(write_payload), write_payload, sizeof(write_payload), 0);
    emit_pair(&context, CADR_DISK_EVIDENCE_DELIVERY, 1U, 41U, 03000U, 0U, 0U,
              CADR_HOST_OPERATION_BLOCK_WRITE, write_descriptor,
              sizeof(write_descriptor), write_payload, sizeof(write_payload),
              NULL, 0U, 1);
    emit_pair(&context, CADR_DISK_EVIDENCE_APPLICATION, 1U, 41U, 03000U, 0U,
              0U, CADR_HOST_OPERATION_BLOCK_WRITE, write_descriptor,
              sizeof(write_descriptor), write_payload, sizeof(write_payload),
              NULL, 0U, 1);
    emit_pair(&context, CADR_DISK_EVIDENCE_REGISTER_WRITE, 0U, 0U, 0U,
              UINT32_C(0777), 0U, CADR_HOST_OPERATION_NONE,
              NULL, 0U, NULL, 0U, NULL, 0U, 0);
    return 0;
}
