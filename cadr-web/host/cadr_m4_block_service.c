#include "cadr_m4_block_service.h"

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
    event->first_block = service->first_block;
    event->block_count = service->block_count;
    event->block_bytes = service->block_bytes;
    event->completion_byte_count = service->request.completion_byte_count;
    event->host_status = service->host_status;
}

static uint32_t request_is_valid(cadr_m4_block_service *service,
                                 const uint8_t descriptor[sizeof(cadr_block_read_descriptor)])
{
    uint64_t byte_offset;
    uint64_t range_bytes;
    service->first_block = read_u64_le(descriptor);
    service->block_count = read_u32_le(descriptor + 8U);
    service->block_bytes = read_u32_le(descriptor + 12U);
    if (service->request.operation != CADR_HOST_OPERATION_BLOCK_READ ||
        service->request.descriptor_byte_count != sizeof(cadr_block_read_descriptor) ||
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
    (void)memcpy(service->completion_bytes, service->image_bytes + byte_offset,
                 (size_t)range_bytes);
    return 1U;
}

cadr_status cadr_m4_block_service_init(
    cadr_m4_block_service *service,
    const cadr_m4_block_service_config *config)
{
    if (service == NULL || config == NULL || config->image_bytes == NULL ||
        config->image_byte_count == 0U ||
        config->image_byte_count != config->expected_image_byte_count ||
        config->block_bytes != CADR_M4_BLOCK_SERVICE_BLOCK_BYTES ||
        (config->fault_mask & ~CADR_M4_BLOCK_FAULT_KNOWN) != 0U ||
        (config->latency_ticks == UINT64_MAX &&
         (config->fault_mask & CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) != 0U)) {
        return CADR_STATUS_ARTIFACT_MISMATCH;
    }
    (void)memset(service, 0, sizeof(*service));
    service->image_bytes = config->image_bytes;
    service->image_byte_count = config->image_byte_count;
    service->latency_ticks = config->latency_ticks;
    service->fault_mask = config->fault_mask;
    return CADR_STATUS_OK;
}

cadr_status cadr_m4_block_service_poll(
    cadr_m4_block_service *service, cadr_machine *machine, uint64_t guest_tick,
    cadr_m4_block_service_event *event)
{
    uint8_t descriptor[sizeof(cadr_block_read_descriptor)];
    cadr_host_completion completion;
    cadr_status status;
    uint64_t latency;

    if (service == NULL || machine == NULL || event == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    clear_event(event);
    if (service->pending == 0U) {
        cadr_host_request request = {
            CADR_ABI_MAJOR, CADR_ABI_MINOR,
            (uint32_t)sizeof(cadr_host_request), CADR_HOST_OPERATION_NONE,
            0U, 0U, 0U, 0U
        };
        status = cadr_machine_next_host_request(machine, &request, descriptor,
                                                sizeof(descriptor));
        if (status == CADR_STATUS_NOT_READY) return CADR_STATUS_OK;
        if (status != CADR_STATUS_OK) return status;
        service->request = request;
        service->issue_tick = guest_tick;
        latency = service->latency_ticks;
        if ((service->fault_mask & CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) != 0U) {
            if (latency == UINT64_MAX) return CADR_STATUS_INVALID_ARGUMENT;
            latency += UINT64_C(1);
        }
        if (guest_tick > UINT64_MAX - latency) return CADR_STATUS_INVALID_ARGUMENT;
        service->due_tick = guest_tick + latency;
        service->host_status = request_is_valid(service, descriptor) != 0U &&
                               (service->fault_mask & CADR_M4_BLOCK_FAULT_STATUS_FAILED) == 0U
            ? CADR_HOST_RESULT_OK : CADR_HOST_RESULT_FAILED;
        if (service->host_status == CADR_HOST_RESULT_FAILED) {
            (void)memset(service->completion_bytes, 0,
                         (size_t)request.completion_byte_count);
        } else if ((service->fault_mask & CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE) != 0U) {
            service->completion_bytes[0] ^= UINT8_C(1);
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
        status = cadr_machine_complete_host_request(machine, &completion,
                                                    service->completion_bytes,
                                                    completion.completion_byte_count);
        if (status != CADR_STATUS_OK) return status;
        event->completion_delivered = 1U;
        event->delivery_tick = guest_tick;
        event_from_service(service, event);
        service->pending = 0U;
    }
    return CADR_STATUS_OK;
}
