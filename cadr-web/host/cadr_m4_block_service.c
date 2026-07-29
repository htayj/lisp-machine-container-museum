#include "cadr_m4_block_service.h"
#include "cadr_m4_media.h"

#include <string.h>

static uint32_t read_u32_le(const uint8_t bytes[4])
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
           ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t read_u64_le(const uint8_t bytes[8])
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

static void clear_event(cadr_m4_block_service_event *event)
{
    (void)memset(event, 0, sizeof(*event));
}

static void event_from_service(const cadr_m4_block_service *service,
                               cadr_m4_block_service_event *event)
{
    event->issue_tick = service->issue_tick;
    event->due_tick = service->due_tick;
    event->generation = service->request.generation;
    event->request_id = service->request.request_id;
    event->operation = service->request.operation;
    event->first_block = service->first_block;
    event->block_count = service->block_count;
    event->block_bytes = service->block_bytes;
    event->completion_byte_count = service->request.completion_byte_count;
    event->descriptor_byte_count = service->request.descriptor_byte_count;
    event->request_payload_byte_count =
        service->request.request_payload_byte_count;
    event->transaction_id = service->transaction_id;
    event->overlay_generation = service->overlay_generation;
    event->host_status = service->host_status;
    event->fault_mask = service->active_fault_mask;
    (void)memcpy(event->descriptor, service->descriptor,
                 sizeof(event->descriptor));
    (void)memcpy(event->descriptor_sha256, service->descriptor_sha256,
                 sizeof(event->descriptor_sha256));
    (void)memcpy(event->request_payload_sha256,
                 service->request_payload_sha256,
                 sizeof(event->request_payload_sha256));
    (void)memcpy(event->page_sha256, service->page_sha256,
                 sizeof(event->page_sha256));
}

static uint32_t read_request_is_valid(
    cadr_m4_block_service *service,
    const uint8_t descriptor[sizeof(cadr_block_read_descriptor)])
{
    uint64_t byte_offset;
    uint64_t range_bytes;
    service->first_block = read_u64_le(descriptor);
    service->block_count = read_u32_le(descriptor + 8U);
    service->block_bytes = read_u32_le(descriptor + 12U);
    if (service->request.descriptor_byte_count !=
            sizeof(cadr_block_read_descriptor) ||
        service->request.request_payload_byte_count != 0U ||
        service->block_bytes != CADR_M4_BLOCK_SERVICE_BLOCK_BYTES ||
        service->block_count == 0U ||
        service->block_count >
            CADR_M4_BLOCK_SERVICE_MAX_COMPLETION_BYTES / service->block_bytes) {
        return 0U;
    }
    range_bytes = (uint64_t)service->block_count * service->block_bytes;
    if (range_bytes != service->request.completion_byte_count ||
        service->first_block > UINT64_MAX / service->block_bytes) {
        return 0U;
    }
    byte_offset = service->first_block * service->block_bytes;
    if (byte_offset > service->image_byte_count ||
        range_bytes > service->image_byte_count - byte_offset) {
        return 0U;
    }
    if (service->first_block == 1U && service->block_count == 1U &&
        service->overlay_valid != 0U) {
        (void)memcpy(service->completion_bytes, service->overlay_bytes,
                     CADR_M4_BLOCK_SERVICE_BLOCK_BYTES);
        return 1U;
    }
    return service->read_range(
               service->read_context, byte_offset,
               service->completion_bytes, range_bytes) == CADR_STATUS_OK;
}

static uint32_t write_request_is_valid(
    cadr_m4_block_service *service,
    const uint8_t descriptor[sizeof(cadr_block_write_descriptor)],
    const uint8_t payload[CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES])
{
    service->transaction_id = read_u64_le(descriptor);
    service->first_block = read_u64_le(descriptor + 8U);
    service->block_count = read_u32_le(descriptor + 16U);
    service->block_bytes = read_u32_le(descriptor + 20U);
    if (service->request.descriptor_byte_count !=
            sizeof(cadr_block_write_descriptor) ||
        service->request.request_payload_byte_count !=
            CADR_M4_BLOCK_SERVICE_BLOCK_BYTES ||
        service->request.completion_byte_count != 0U ||
        service->first_block != 1U || service->block_count != 1U ||
        service->block_bytes != CADR_M4_BLOCK_SERVICE_BLOCK_BYTES ||
        service->transaction_id == 0U ||
        service->transaction_id != service->request.request_id ||
        service->overlay_generation == UINT64_MAX) {
        return 0U;
    }
    if (service->overlay_valid != 0U &&
        service->committed_generation == service->request.generation &&
        service->committed_request_id == service->request.request_id &&
        service->committed_transaction_id == service->transaction_id) {
        if (memcmp(service->overlay_bytes, payload,
                   CADR_M4_BLOCK_SERVICE_BLOCK_BYTES) != 0) {
            return 0U;
        }
        service->replay = 1U;
        return 1U;
    }
    if (service->overlay_valid != 0U) {
        if (service->request.generation < service->committed_generation ||
            (service->request.generation ==
                 service->committed_generation &&
             service->request.request_id <=
                 service->committed_request_id)) {
            return 0U;
        }
    }
    (void)memcpy(service->staged_bytes, payload,
                 CADR_M4_BLOCK_SERVICE_BLOCK_BYTES);
    service->staged = 1U;
    return 1U;
}

static uint32_t selected_fault_mask(cadr_m4_block_service *service)
{
    if ((service->fault_operation != CADR_HOST_OPERATION_NONE &&
         service->fault_operation != service->request.operation) ||
        (service->fault_first_block != UINT64_MAX &&
         service->fault_first_block != service->first_block)) {
        return CADR_M4_BLOCK_FAULT_NONE;
    }
    service->fault_match_count += 1U;
    if (service->fault_occurrence != 0U &&
        service->fault_occurrence != service->fault_match_count) {
        return CADR_M4_BLOCK_FAULT_NONE;
    }
    return service->fault_mask;
}

cadr_status cadr_m4_block_service_init(
    cadr_m4_block_service *service,
    const cadr_m4_block_service_config *config)
{
    if (service == NULL || config == NULL || config->read_range == NULL ||
        config->image_byte_count == 0U ||
        config->image_byte_count != config->expected_image_byte_count ||
        config->block_bytes != CADR_M4_BLOCK_SERVICE_BLOCK_BYTES ||
        (config->fault_mask & ~CADR_M4_BLOCK_FAULT_KNOWN) != 0U ||
        (config->fault_operation != CADR_HOST_OPERATION_NONE &&
         config->fault_operation != CADR_HOST_OPERATION_BLOCK_READ &&
         config->fault_operation != CADR_HOST_OPERATION_BLOCK_WRITE) ||
        (config->latency_ticks == UINT64_MAX &&
         (config->fault_mask & CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) != 0U)) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    (void)memset(service, 0, sizeof(*service));
    service->read_range = config->read_range;
    service->read_context = config->read_context;
    service->image_byte_count = config->image_byte_count;
    service->latency_ticks = config->latency_ticks;
    service->fault_mask = config->fault_mask;
    service->fault_operation = config->fault_operation;
    service->fault_first_block = config->fault_first_block;
    service->fault_occurrence = config->fault_occurrence;
    return CADR_STATUS_OK;
}

cadr_status cadr_m4_block_service_poll(
    cadr_m4_block_service *service, cadr_machine *machine, uint64_t guest_tick,
    cadr_m4_block_service_event *event)
{
    uint8_t descriptor[sizeof(cadr_block_write_descriptor)];
    uint8_t payload[CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES];
    cadr_host_completion completion;
    cadr_status status;
    uint64_t latency;

    if (service == NULL || machine == NULL || event == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    clear_event(event);
    if (service->pending == 0U) {
        cadr_host_request_m4 request = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR_M4,
            (uint32_t)sizeof(cadr_host_request_m4),
            CADR_HOST_OPERATION_NONE, 0U, 0U, 0U, 0U, 0U
        };
        status = cadr_machine_next_host_request_m4(
            machine, &request, descriptor, sizeof(descriptor),
            payload, sizeof(payload));
        if (status == CADR_STATUS_NOT_READY) return CADR_STATUS_OK;
        if (status != CADR_STATUS_OK) return status;
        service->request = request;
        (void)memset(service->descriptor, 0, sizeof(service->descriptor));
        (void)memcpy(service->descriptor, descriptor,
                     (size_t)request.descriptor_byte_count);
        cadr_m4_media_sha256(descriptor, request.descriptor_byte_count,
                             service->descriptor_sha256);
        cadr_m4_media_sha256(payload, request.request_payload_byte_count,
                             service->request_payload_sha256);
        cadr_m4_media_sha256(NULL, 0U, service->page_sha256);
        service->issue_tick = guest_tick;
        service->replay = 0U;
        if (request.operation == CADR_HOST_OPERATION_BLOCK_READ) {
            service->host_status =
                read_request_is_valid(service, descriptor) != 0U
                ? CADR_HOST_RESULT_OK : CADR_HOST_RESULT_FAILED;
        } else if (request.operation == CADR_HOST_OPERATION_BLOCK_WRITE) {
            service->host_status =
                write_request_is_valid(service, descriptor, payload) != 0U
                ? CADR_HOST_RESULT_OK : CADR_HOST_RESULT_FAILED;
            event->overlay_prepared = service->staged;
            if (service->host_status == CADR_HOST_RESULT_OK) {
                (void)memcpy(service->page_sha256,
                             service->request_payload_sha256,
                             sizeof(service->page_sha256));
            }
        } else {
            service->host_status = CADR_HOST_RESULT_FAILED;
        }
        service->active_fault_mask = selected_fault_mask(service);
        latency = service->latency_ticks;
        if ((service->active_fault_mask &
             CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) != 0U) {
            if (latency == UINT64_MAX) return CADR_STATUS_INVALID_ARGUMENT;
            latency += UINT64_C(1);
        }
        if (guest_tick > UINT64_MAX - latency) return CADR_STATUS_INVALID_ARGUMENT;
        service->due_tick = guest_tick + latency;
        if ((service->active_fault_mask &
             CADR_M4_BLOCK_FAULT_STATUS_FAILED) != 0U) {
            service->host_status = CADR_HOST_RESULT_FAILED;
        }
        if (service->host_status == CADR_HOST_RESULT_FAILED) {
            (void)memset(service->completion_bytes, 0,
                         (size_t)request.completion_byte_count);
            if (service->staged != 0U) {
                service->staged = 0U;
                (void)memset(service->staged_bytes, 0,
                             sizeof(service->staged_bytes));
                event->overlay_discarded = 1U;
            }
        } else if (request.operation == CADR_HOST_OPERATION_BLOCK_READ &&
                   (service->active_fault_mask &
                    CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE) != 0U) {
            service->completion_bytes[0] ^= UINT8_C(1);
        }
        if (request.operation == CADR_HOST_OPERATION_BLOCK_READ) {
            cadr_m4_media_sha256(
                service->completion_bytes, request.completion_byte_count,
                service->page_sha256);
        }
        service->pending = 1U;
        event->request_seen = 1U;
        event_from_service(service, event);
    }
    if (service->pending != 0U && guest_tick >= service->due_tick) {
        completion.abi_major = CADR_ABI_MAJOR;
        completion.abi_minor = CADR_ABI_MINOR;
        completion.struct_size = (uint32_t)sizeof(completion);
        completion.operation = service->request.operation;
        completion.host_status = service->host_status;
        completion.reserved0 = 0U;
        completion.generation = service->request.generation;
        completion.request_id = service->request.request_id;
        completion.completion_byte_count = service->request.completion_byte_count;
        status = cadr_machine_complete_host_request(
            machine, &completion, service->completion_bytes,
            completion.completion_byte_count);
        if (status != CADR_STATUS_OK) {
            if (service->staged != 0U) {
                service->staged = 0U;
                (void)memset(service->staged_bytes, 0,
                             sizeof(service->staged_bytes));
                event->overlay_discarded = 1U;
            }
            service->pending = 0U;
            return status;
        }
        event->completion_delivered = 1U;
        event->delivery_tick = guest_tick;
        if (service->request.operation == CADR_HOST_OPERATION_BLOCK_WRITE &&
            service->host_status == CADR_HOST_RESULT_OK &&
            service->staged != 0U) {
            (void)memcpy(service->overlay_bytes, service->staged_bytes,
                         sizeof(service->overlay_bytes));
            service->overlay_valid = 1U;
            service->overlay_generation += 1U;
            service->committed_generation = service->request.generation;
            service->committed_request_id = service->request.request_id;
            service->committed_transaction_id = service->transaction_id;
            service->staged = 0U;
            (void)memset(service->staged_bytes, 0,
                         sizeof(service->staged_bytes));
            event->overlay_committed = 1U;
        } else if (service->request.operation ==
                       CADR_HOST_OPERATION_BLOCK_WRITE &&
                   service->host_status == CADR_HOST_RESULT_OK &&
                   service->replay != 0U) {
            event->overlay_replayed = 1U;
        }
        event_from_service(service, event);
        service->pending = 0U;
    }
    return CADR_STATUS_OK;
}

uint64_t cadr_m4_block_service_overlay_generation(
    const cadr_m4_block_service *service)
{
    return service == NULL ? 0U : service->overlay_generation;
}

cadr_status cadr_m4_block_service_snapshot_status(
    const cadr_m4_block_service *service)
{
    if (service == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    return service->pending != 0U || service->staged != 0U ||
        service->overlay_valid != 0U ||
        (service->fault_mask != CADR_M4_BLOCK_FAULT_NONE &&
         service->fault_occurrence != 0U &&
         service->fault_match_count != 0U) ?
        CADR_STATUS_NOT_READY : CADR_STATUS_OK;
}

cadr_status cadr_m4_block_service_snapshot_size(
    const cadr_m4_block_service *service, cadr_machine *machine,
    const cadr_snapshot_request *request, uint64_t *out_size)
{
    cadr_status status = cadr_m4_block_service_snapshot_status(service);
    return status == CADR_STATUS_OK ?
        cadr_machine_snapshot_size(machine, request, out_size) : status;
}

cadr_status cadr_m4_block_service_snapshot_save(
    const cadr_m4_block_service *service, cadr_machine *machine,
    const cadr_snapshot_request *request, uint8_t *bytes, uint64_t capacity,
    uint64_t *out_written)
{
    cadr_status status = cadr_m4_block_service_snapshot_status(service);
    return status == CADR_STATUS_OK ?
        cadr_machine_snapshot_save(machine, request, bytes, capacity,
                                   out_written) : status;
}

cadr_status cadr_m4_block_service_snapshot_restore(
    const cadr_m4_block_service *service,
    const cadr_snapshot_request *request, const uint8_t *bytes,
    uint64_t byte_count, cadr_machine **out_machine)
{
    cadr_status status = cadr_m4_block_service_snapshot_status(service);
    return status == CADR_STATUS_OK ?
        cadr_machine_snapshot_restore(request, bytes, byte_count, out_machine) :
        status;
}

void cadr_m4_block_service_discard(cadr_m4_block_service *service)
{
    if (service == NULL) return;
    (void)memset(service->staged_bytes, 0, sizeof(service->staged_bytes));
    (void)memset(service->overlay_bytes, 0, sizeof(service->overlay_bytes));
    service->staged = 0U;
    service->overlay_valid = 0U;
    service->overlay_generation = 0U;
    service->committed_generation = 0U;
    service->committed_request_id = 0U;
    service->committed_transaction_id = 0U;
    service->fault_match_count = 0U;
    service->active_fault_mask = 0U;
    service->replay = 0U;
    service->transaction_id = 0U;
    service->pending = 0U;
}
