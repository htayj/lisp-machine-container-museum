#include "cadr_state_v4.h"

#include "cadr_m4_media.h"
#include "cadr_state_v3.h"

#include <string.h>

static void put32(uint8_t *bytes, uint64_t *used, uint32_t value)
{ bytes[*used]=(uint8_t)value; bytes[*used+1U]=(uint8_t)(value>>8U); bytes[*used+2U]=(uint8_t)(value>>16U); bytes[*used+3U]=(uint8_t)(value>>24U); *used+=4U; }
static void put64(uint8_t *bytes, uint64_t *used, uint64_t value)
{ uint32_t i; for(i=0U;i<8U;++i)bytes[*used+i]=(uint8_t)(value>>(i*8U));*used+=8U; }
static int event_is_well_formed(const cadr_event_state *event)
{
    if (event->request_descriptor_byte_count > CADR_MAX_HOST_DESCRIPTOR_BYTES ||
        event->request_payload_byte_count > CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES ||
        event->completion_queued > 1U ||
        (event->completion_byte_count != 0U && event->completion_bytes == NULL) ||
        event->last_completed_request_id >= event->next_request_id) return 0;
    if (event->outstanding_request_id == 0U) {
        return event->request_descriptor_byte_count == 0U &&
            event->request_payload_byte_count == 0U &&
            event->expected_completion_byte_count == 0U &&
            event->completion_byte_count == 0U && event->completion_bytes == NULL &&
            event->completion_queued == 0U &&
            event->outstanding_operation == CADR_HOST_OPERATION_NONE;
    }
    if (event->generation == 0U || event->outstanding_request_id >= event->next_request_id ||
        event->outstanding_operation == CADR_HOST_OPERATION_NONE ||
        event->request_descriptor_byte_count == 0U) return 0;
    if (event->completion_queued == 0U) {
        if (event->completion_byte_count != 0U || event->completion_bytes != NULL) return 0;
    } else if (event->completion_byte_count != event->expected_completion_byte_count ||
               (event->completion_host_status != CADR_HOST_RESULT_OK &&
                event->completion_host_status != CADR_HOST_RESULT_FAILED)) return 0;
    if (event->request_payload_byte_count != 0U &&
        (event->outstanding_operation != CADR_HOST_OPERATION_BLOCK_WRITE ||
         event->request_payload_byte_count != CADR_MAX_HOST_REQUEST_PAYLOAD_BYTES ||
         event->expected_completion_byte_count != 0U)) return 0;
    return 1;
}

cadr_status cadr_state_v4_digest(const cadr_machine_state *state, uint8_t digest[CADR_SHA256_BYTES])
{
    /* 9+4+32 + 4*u64 + 64+1024 + 4*u64 + 5*u32 + 32 leaves margin. */
    uint8_t bytes[1280], v3[CADR_SHA256_BYTES], completion[CADR_SHA256_BYTES];
    uint64_t used=0U; const cadr_event_state *event; cadr_status status;
    static const uint8_t domain[]="CDRSTATE4";
    if(state==NULL||digest==NULL)return CADR_STATUS_INVALID_ARGUMENT;
    event=&state->events;
    if (!event_is_well_formed(event)) return CADR_STATUS_INVALID_ARGUMENT;
    status=cadr_state_v3_digest(state,v3);if(status!=CADR_STATUS_OK)return status;
    cadr_m4_media_sha256(event->completion_bytes,event->completion_byte_count,completion);
    (void)memcpy(bytes+used,domain,sizeof(domain)-1U);used+=sizeof(domain)-1U;put32(bytes,&used,CADR_STATE_V4_SCHEMA_VERSION);(void)memcpy(bytes+used,v3,sizeof(v3));used+=sizeof(v3);
    put64(bytes,&used,event->generation);put64(bytes,&used,event->next_request_id);put64(bytes,&used,event->outstanding_request_id);put64(bytes,&used,event->last_completed_request_id);
    put64(bytes,&used,event->request_descriptor_byte_count);(void)memcpy(bytes+used,event->request_descriptor,(size_t)event->request_descriptor_byte_count);used+=event->request_descriptor_byte_count;
    put64(bytes,&used,event->request_payload_byte_count);(void)memcpy(bytes+used,event->request_payload,(size_t)event->request_payload_byte_count);used+=event->request_payload_byte_count;
    put64(bytes,&used,event->expected_completion_byte_count);put64(bytes,&used,event->completion_byte_count);(void)memcpy(bytes+used,completion,sizeof(completion));used+=sizeof(completion);
    put32(bytes,&used,event->outstanding_operation);put32(bytes,&used,event->completion_host_status);put32(bytes,&used,event->completion_queued);put32(bytes,&used,event->persistent_status);put32(bytes,&used,event->unexpected_bus_operation);put32(bytes,&used,event->reserved0);
    cadr_m4_media_sha256(bytes,used,digest);return CADR_STATUS_OK;
}
