#include "cadr_m6_disk_evidence.h"
#include "cadr_m4_media.h"

#include <string.h>

typedef struct cadr_m6_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t used;
} cadr_m6_sha256;

static uint32_t rotr(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void transform(cadr_m6_sha256 *context, const uint8_t block[64])
{
    static const uint32_t constants[64] = {
        UINT32_C(0x428a2f98),UINT32_C(0x71374491),UINT32_C(0xb5c0fbcf),UINT32_C(0xe9b5dba5),
        UINT32_C(0x3956c25b),UINT32_C(0x59f111f1),UINT32_C(0x923f82a4),UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98),UINT32_C(0x12835b01),UINT32_C(0x243185be),UINT32_C(0x550c7dc3),
        UINT32_C(0x72be5d74),UINT32_C(0x80deb1fe),UINT32_C(0x9bdc06a7),UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1),UINT32_C(0xefbe4786),UINT32_C(0x0fc19dc6),UINT32_C(0x240ca1cc),
        UINT32_C(0x2de92c6f),UINT32_C(0x4a7484aa),UINT32_C(0x5cb0a9dc),UINT32_C(0x76f988da),
        UINT32_C(0x983e5152),UINT32_C(0xa831c66d),UINT32_C(0xb00327c8),UINT32_C(0xbf597fc7),
        UINT32_C(0xc6e00bf3),UINT32_C(0xd5a79147),UINT32_C(0x06ca6351),UINT32_C(0x14292967),
        UINT32_C(0x27b70a85),UINT32_C(0x2e1b2138),UINT32_C(0x4d2c6dfc),UINT32_C(0x53380d13),
        UINT32_C(0x650a7354),UINT32_C(0x766a0abb),UINT32_C(0x81c2c92e),UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1),UINT32_C(0xa81a664b),UINT32_C(0xc24b8b70),UINT32_C(0xc76c51a3),
        UINT32_C(0xd192e819),UINT32_C(0xd6990624),UINT32_C(0xf40e3585),UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116),UINT32_C(0x1e376c08),UINT32_C(0x2748774c),UINT32_C(0x34b0bcb5),
        UINT32_C(0x391c0cb3),UINT32_C(0x4ed8aa4a),UINT32_C(0x5b9cca4f),UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee),UINT32_C(0x78a5636f),UINT32_C(0x84c87814),UINT32_C(0x8cc70208),
        UINT32_C(0x90befffa),UINT32_C(0xa4506ceb),UINT32_C(0xbef9a3f7),UINT32_C(0xc67178f2)
    };
    uint32_t words[64];
    uint32_t a,b,c,d,e,f,g,h,index;
    for (index = 0U; index < 16U; ++index) {
        const uint32_t at = index * 4U;
        words[index] = ((uint32_t)block[at] << 24U) |
            ((uint32_t)block[at + 1U] << 16U) |
            ((uint32_t)block[at + 2U] << 8U) | (uint32_t)block[at + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = rotr(words[index - 15U],7U)^rotr(words[index - 15U],18U)^(words[index - 15U]>>3U);
        const uint32_t s1 = rotr(words[index - 2U],17U)^rotr(words[index - 2U],19U)^(words[index - 2U]>>10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a=context->state[0]; b=context->state[1]; c=context->state[2]; d=context->state[3];
    e=context->state[4]; f=context->state[5]; g=context->state[6]; h=context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t s1=rotr(e,6U)^rotr(e,11U)^rotr(e,25U);
        const uint32_t choose=(e&f)^((~e)&g);
        const uint32_t temp1=h+s1+choose+constants[index]+words[index];
        const uint32_t s0=rotr(a,2U)^rotr(a,13U)^rotr(a,22U);
        const uint32_t majority=(a&b)^(a&c)^(b&c);
        const uint32_t temp2=s0+majority;
        h=g; g=f; f=e; e=d+temp1; d=c; c=b; b=a; a=temp1+temp2;
    }
    context->state[0]+=a; context->state[1]+=b; context->state[2]+=c; context->state[3]+=d;
    context->state[4]+=e; context->state[5]+=f; context->state[6]+=g; context->state[7]+=h;
}

static void sha_init(cadr_m6_sha256 *context)
{
    static const uint32_t initial[8]={UINT32_C(0x6a09e667),UINT32_C(0xbb67ae85),UINT32_C(0x3c6ef372),UINT32_C(0xa54ff53a),UINT32_C(0x510e527f),UINT32_C(0x9b05688c),UINT32_C(0x1f83d9ab),UINT32_C(0x5be0cd19)};
    (void)memset(context,0,sizeof(*context)); (void)memcpy(context->state,initial,sizeof(initial));
}

static void sha_update(cadr_m6_sha256 *context, const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t room=64U-context->used;
        const uint32_t take=count<(uint64_t)room?(uint32_t)count:room;
        (void)memcpy(context->block+context->used,bytes,take);
        context->used+=take; context->bit_count+=(uint64_t)take*8U; bytes+=take; count-=take;
        if(context->used==64U){transform(context,context->block);context->used=0U;}
    }
}

static void sha_final(cadr_m6_sha256 *context, uint8_t digest[CADR_SHA256_BYTES])
{
    const uint64_t bits=context->bit_count; uint32_t index;
    context->block[context->used++]=UINT8_C(0x80);
    if(context->used>56U){(void)memset(context->block+context->used,0,64U-context->used);transform(context,context->block);context->used=0U;}
    (void)memset(context->block+context->used,0,56U-context->used);
    for(index=0U;index<8U;++index)context->block[63U-index]=(uint8_t)(bits>>(index*8U));
    transform(context,context->block);
    for(index=0U;index<8U;++index){digest[index*4U]=(uint8_t)(context->state[index]>>24U);digest[index*4U+1U]=(uint8_t)(context->state[index]>>16U);digest[index*4U+2U]=(uint8_t)(context->state[index]>>8U);digest[index*4U+3U]=(uint8_t)context->state[index];}
}

static void put32(uint8_t *bytes,uint32_t value){bytes[0]=(uint8_t)value;bytes[1]=(uint8_t)(value>>8U);bytes[2]=(uint8_t)(value>>16U);bytes[3]=(uint8_t)(value>>24U);}
static void put64(uint8_t *bytes,uint64_t value){uint32_t index;for(index=0U;index<8U;++index)bytes[index]=(uint8_t)(value>>(index*8U));}

static void encode_tuple(uint8_t *bytes,const cadr_disk_evidence_tuple *tuple)
{
    put64(bytes,tuple->lba);put64(bytes+8U,tuple->generation);put64(bytes+16U,tuple->request_id);put64(bytes+24U,tuple->expected_completion);
    put32(bytes+32U,tuple->command);put32(bytes+36U,tuple->clp);put32(bytes+40U,tuple->da);put32(bytes+44U,tuple->lma);
    put32(bytes+48U,tuple->ccw_address);put32(bytes+52U,tuple->ccw_index);put32(bytes+56U,tuple->status);put32(bytes+60U,tuple->transfer_reset_enables);
    put32(bytes+64U,tuple->bus_irq);put32(bytes+68U,tuple->operation);put32(bytes+72U,tuple->completion_queued);put32(bytes+76U,tuple->reserved0);
}

void cadr_m6_disk_evidence_encode_event(uint8_t bytes[CADR_DISK_EVIDENCE_RECORD_BYTES],const cadr_disk_evidence_event *event)
{
    (void)memset(bytes,0,CADR_DISK_EVIDENCE_RECORD_BYTES);
    put64(bytes,event->sequence);put64(bytes+8U,event->post_slot);put32(bytes+16U,event->intra_slot);put32(bytes+20U,event->kind);
    put32(bytes+24U,event->flags);put32(bytes+28U,event->value);put32(bytes+32U,event->detail);put64(bytes+40U,event->first);put64(bytes+48U,event->second);put64(bytes+56U,event->delivered_completion);
    encode_tuple(bytes+64U,&event->before);encode_tuple(bytes+144U,&event->after);
    (void)memcpy(bytes+224U,event->descriptor_sha256,CADR_SHA256_BYTES);
    (void)memcpy(bytes+256U,event->payload_sha256,CADR_SHA256_BYTES);
    (void)memcpy(bytes+288U,event->delivery_sha256,CADR_SHA256_BYTES);
    (void)memcpy(bytes+320U,event->page_sha256,CADR_SHA256_BYTES);
}

static void tail_initial(uint8_t digest[CADR_SHA256_BYTES])
{
    /* The implicit terminator is part of each domain-separated input. */
    static const uint8_t domain[]="CDRM6TAIL1";
    static const uint8_t policy[]=CADR_M6_DISK_EVIDENCE_POLICY_ID;
    cadr_m6_sha256 hash; uint8_t capacity[8];
    put64(capacity,CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);sha_init(&hash);sha_update(&hash,domain,sizeof(domain));sha_update(&hash,policy,sizeof(policy));sha_update(&hash,capacity,sizeof(capacity));sha_final(&hash,digest);
}

static void tail_step(const uint8_t previous[CADR_SHA256_BYTES],const uint8_t event[CADR_DISK_EVIDENCE_RECORD_BYTES],uint8_t next[CADR_SHA256_BYTES])
{
    static const uint8_t domain[]="CDRM6TAIL1";
    cadr_m6_sha256 hash;sha_init(&hash);sha_update(&hash,domain,sizeof(domain));sha_update(&hash,previous,CADR_SHA256_BYTES);sha_update(&hash,event,CADR_DISK_EVIDENCE_RECORD_BYTES);sha_final(&hash,next);
}

static int all_zero(const uint8_t *bytes,uint64_t count){uint64_t index;for(index=0U;index<count;++index)if(bytes[index]!=0U)return 0;return 1;}
static int tuple_valid(const cadr_disk_evidence_tuple *tuple){return tuple->reserved0==0U;}

void cadr_m6_disk_evidence_cold_power_on(cadr_m6_disk_evidence_state *state)
{
    if (state == NULL) return;
    (void)memset(state, 0, sizeof(*state));
    state->selected_maximum = CADR_M6_DEVID_MAX_TOTAL_EVENTS;
    tail_initial(state->tail_sha256);
}

int cadr_m6_disk_evidence_tail_started(const cadr_m6_disk_evidence_state *state){return state!=NULL&&state->tail_started!=0U;}
int cadr_m6_disk_evidence_limit_exceeded(const cadr_m6_disk_evidence_state *state){return state!=NULL&&state->limit_exceeded!=0U;}

cadr_status cadr_m6_disk_evidence_append(cadr_m6_disk_evidence_state *state,cadr_disk_evidence_log *prefix,const cadr_disk_evidence_event *event)
{
    cadr_disk_evidence_event accepted;uint8_t encoded[CADR_DISK_EVIDENCE_RECORD_BYTES],next_tail[CADR_SHA256_BYTES];
    uint64_t previous_slot;uint32_t intra;
    if(state==NULL||prefix==NULL||event==NULL||state->selected_maximum!=CADR_M6_DEVID_MAX_TOTAL_EVENTS||prefix->overflowed!=0U||prefix->count>CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY)return CADR_STATUS_INVALID_ARGUMENT;
    if(state->total_accepted>state->selected_maximum||state->tail_event_count>state->total_accepted||state->have_last>1U||state->tail_started>1U||state->limit_exceeded>1U||event->kind<CADR_DISK_EVIDENCE_REGISTER_READ||event->kind>CADR_DISK_EVIDENCE_INTERRUPT||!tuple_valid(&event->before)||!tuple_valid(&event->after))return CADR_STATUS_INVALID_ARGUMENT;
    previous_slot=state->last_post_slot;
    if(state->have_last==0U){if(state->total_accepted!=0U)return CADR_STATUS_INVALID_ARGUMENT;intra=0U;}else{if(event->post_slot<previous_slot)return CADR_STATUS_INVALID_ARGUMENT;intra=event->post_slot==previous_slot?state->last_intra_slot+1U:0U;if(event->post_slot==previous_slot&&state->last_intra_slot==UINT32_MAX)return CADR_STATUS_GUEST_FAULT;}
    accepted=*event;accepted.sequence=state->total_accepted;accepted.intra_slot=intra;
    if(accepted.post_slot!=event->post_slot)return CADR_STATUS_INVALID_ARGUMENT;
    cadr_m6_disk_evidence_encode_event(encoded,&accepted);
    if(state->limit_exceeded!=0U||state->total_accepted==state->selected_maximum){
        if(state->limit_exceeded==0U){state->limit_exceeded=1U;state->limit_attempt_post_slot=accepted.post_slot;state->limit_attempt_intra_slot=accepted.intra_slot;state->limit_reason=1U;
            { cadr_m6_sha256 hash;sha_init(&hash);sha_update(&hash,encoded,sizeof(encoded));sha_final(&hash,state->limit_rejected_event_sha256); }
        }
        return CADR_STATUS_GUEST_FAULT;
    }
    if(state->total_accepted<CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY){
        if(prefix->count!=state->total_accepted||prefix->next_sequence!=state->total_accepted)return CADR_STATUS_INVALID_ARGUMENT;
        prefix->events[prefix->count]=accepted;prefix->count+=1U;prefix->next_sequence+=1U;prefix->last_slot=accepted.post_slot;prefix->intra_slot=accepted.intra_slot;prefix->last_after=accepted.after;prefix->observed_before=accepted.before;prefix->observed_after=accepted.after;prefix->have_last=1U;
    }else{
        if(prefix->count!=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY||prefix->next_sequence!=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY)return CADR_STATUS_INVALID_ARGUMENT;
        tail_step(state->tail_sha256,encoded,next_tail);
    }
    state->per_kind[accepted.kind-1U]+=1U;state->total_accepted+=1U;state->last_sequence=accepted.sequence;state->last_post_slot=accepted.post_slot;state->last_intra_slot=accepted.intra_slot;state->last_after=accepted.after;state->have_last=1U;
    if(accepted.sequence>=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY){if(state->tail_started==0U){state->tail_started=1U;state->first_omitted_sequence=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY;}state->tail_event_count+=1U;(void)memcpy(state->tail_sha256,next_tail,CADR_SHA256_BYTES);}
    return CADR_STATUS_OK;
}

cadr_status cadr_m6_disk_evidence_produce_final_event(
    cadr_m6_disk_evidence_state *state, cadr_disk_evidence_log *prefix,
    uint64_t post_slot, const cadr_disk_evidence_tuple *after,
    uint32_t kind, uint32_t flags, uint64_t first, uint64_t second,
    uint32_t value, uint32_t detail, uint32_t operation,
    const uint8_t *request_descriptor, uint64_t request_descriptor_byte_count,
    const uint8_t *request_payload, uint64_t request_payload_byte_count,
    const uint8_t *event_bytes, uint64_t event_byte_count)
{
    cadr_disk_evidence_event event;
    if (state == NULL || prefix == NULL || after == NULL ||
        (request_descriptor_byte_count != 0U && request_descriptor == NULL) ||
        (request_payload_byte_count != 0U && request_payload == NULL) ||
        (event_byte_count != 0U && event_bytes == NULL)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    (void)memset(&event, 0, sizeof(event));
    event.post_slot = post_slot;
    event.kind = kind;
    event.flags = flags;
    event.first = first;
    event.second = second;
    event.value = value;
    event.detail = detail;
    event.before = state->have_last != 0U ? state->last_after : *after;
    event.after = *after;
    event.delivered_completion = event_byte_count;
    cadr_m4_media_sha256(request_descriptor, request_descriptor_byte_count,
                         event.descriptor_sha256);
    cadr_m4_media_sha256(request_payload, request_payload_byte_count,
                         event.payload_sha256);
    cadr_m4_media_sha256(event_bytes, event_byte_count, event.page_sha256);
    if (kind == CADR_DISK_EVIDENCE_DELIVERY) {
        (void)memcpy(event.delivery_sha256, event.page_sha256,
                     CADR_SHA256_BYTES);
    } else {
        cadr_m4_media_sha256(NULL, 0U, event.delivery_sha256);
    }
    if ((kind == CADR_DISK_EVIDENCE_DELIVERY ||
         kind == CADR_DISK_EVIDENCE_APPLICATION) &&
        operation == CADR_HOST_OPERATION_BLOCK_WRITE) {
        cadr_m4_media_sha256(request_payload, request_payload_byte_count,
                             event.page_sha256);
    }
    return cadr_m6_disk_evidence_append(state, prefix, &event);
}

static cadr_status validate(const cadr_m6_disk_evidence_state *state,const cadr_disk_evidence_log *prefix)
{
    uint64_t sum=0U,index;uint8_t initial[CADR_SHA256_BYTES];
    if(state==NULL||prefix==NULL||state->selected_maximum!=CADR_M6_DEVID_MAX_TOTAL_EVENTS||prefix->overflowed!=0U||prefix->count>CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY||state->have_last>1U||state->tail_started>1U||state->limit_exceeded>1U||state->total_accepted>state->selected_maximum)return CADR_STATUS_INVALID_ARGUMENT;
    if(prefix->next_sequence!=prefix->count)return CADR_STATUS_INVALID_ARGUMENT;
    if(prefix->count==0U){if(prefix->have_last!=0U||prefix->last_slot!=0U||prefix->intra_slot!=0U||!all_zero((const uint8_t *)&prefix->last_after,sizeof(prefix->last_after))||!all_zero((const uint8_t *)&prefix->observed_before,sizeof(prefix->observed_before))||!all_zero((const uint8_t *)&prefix->observed_after,sizeof(prefix->observed_after)))return CADR_STATUS_INVALID_ARGUMENT;}else{
        const cadr_disk_evidence_event *last=&prefix->events[prefix->count-1U];
        if(prefix->have_last!=1U||prefix->last_slot!=last->post_slot||prefix->intra_slot!=last->intra_slot||memcmp(&prefix->last_after,&last->after,sizeof(last->after))!=0||memcmp(&prefix->observed_before,&last->before,sizeof(last->before))!=0||memcmp(&prefix->observed_after,&last->after,sizeof(last->after))!=0)return CADR_STATUS_INVALID_ARGUMENT;
        for(index=0U;index<prefix->count;++index){const cadr_disk_evidence_event *event=&prefix->events[index];if(event->sequence!=index||event->kind<CADR_DISK_EVIDENCE_REGISTER_READ||event->kind>CADR_DISK_EVIDENCE_INTERRUPT||!tuple_valid(&event->before)||!tuple_valid(&event->after))return CADR_STATUS_INVALID_ARGUMENT;if(index==0U){if(event->intra_slot!=0U)return CADR_STATUS_INVALID_ARGUMENT;}else{const cadr_disk_evidence_event *previous=&prefix->events[index-1U];if(event->post_slot<previous->post_slot||((event->post_slot==previous->post_slot&&(previous->intra_slot==UINT32_MAX||event->intra_slot!=previous->intra_slot+1U))||(event->post_slot!=previous->post_slot&&event->intra_slot!=0U)))return CADR_STATUS_INVALID_ARGUMENT;}}
    }
    for(index=0U;index<9U;++index){if(UINT64_MAX-sum<state->per_kind[index])return CADR_STATUS_INVALID_ARGUMENT;sum+=state->per_kind[index];}
    if(sum!=state->total_accepted)return CADR_STATUS_INVALID_ARGUMENT;
    if(state->total_accepted<=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY){if(prefix->count!=state->total_accepted||state->tail_started!=0U||state->tail_event_count!=0U||state->first_omitted_sequence!=0U)return CADR_STATUS_INVALID_ARGUMENT;}else{if(prefix->count!=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY||state->tail_event_count!=state->total_accepted-CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY||state->tail_started==0U||state->first_omitted_sequence!=CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY)return CADR_STATUS_INVALID_ARGUMENT;}
    if(state->total_accepted==0U){if(state->have_last!=0U||state->last_sequence!=0U||state->last_post_slot!=0U||state->last_intra_slot!=0U||!all_zero((const uint8_t *)&state->last_after,sizeof(state->last_after)))return CADR_STATUS_INVALID_ARGUMENT;}else if(state->have_last==0U||state->last_sequence!=state->total_accepted-1U||!tuple_valid(&state->last_after))return CADR_STATUS_INVALID_ARGUMENT;
    if(state->tail_started==0U&&state->total_accepted!=0U){const cadr_disk_evidence_event *last=&prefix->events[prefix->count-1U];if(state->last_post_slot!=last->post_slot||state->last_intra_slot!=last->intra_slot||memcmp(&state->last_after,&last->after,sizeof(last->after))!=0)return CADR_STATUS_INVALID_ARGUMENT;}
    tail_initial(initial);if(state->tail_started==0U&&memcmp(initial,state->tail_sha256,CADR_SHA256_BYTES)!=0)return CADR_STATUS_INVALID_ARGUMENT;
    if(state->limit_exceeded==0U){if(state->limit_attempt_post_slot!=0U||state->limit_attempt_intra_slot!=0U||state->limit_reason!=0U||!all_zero(state->limit_rejected_event_sha256,CADR_SHA256_BYTES))return CADR_STATUS_INVALID_ARGUMENT;}else if(state->limit_reason!=1U||state->total_accepted!=state->selected_maximum||all_zero(state->limit_rejected_event_sha256,CADR_SHA256_BYTES))return CADR_STATUS_INVALID_ARGUMENT;
    return CADR_STATUS_OK;
}

static void prefix_digest(const cadr_disk_evidence_log *prefix,uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_m6_sha256 hash;uint8_t header[CADR_DISK_EVIDENCE_HEADER_BYTES],event[CADR_DISK_EVIDENCE_RECORD_BYTES];uint32_t index;
    (void)memset(header,0,sizeof(header));(void)memcpy(header,"CDRDISKEVID1",12U);put32(header+12U,prefix->count);sha_init(&hash);sha_update(&hash,header,sizeof(header));for(index=0U;index<prefix->count;++index){cadr_m6_disk_evidence_encode_event(event,&prefix->events[index]);sha_update(&hash,event,sizeof(event));}sha_final(&hash,digest);
}

cadr_status cadr_m6_disk_evidence_summary_serialize(const cadr_m6_disk_evidence_state *state,const cadr_disk_evidence_log *prefix,uint8_t *bytes,uint64_t capacity,uint64_t *written)
{
    uint8_t prefix_sha256[CADR_SHA256_BYTES];cadr_status status;
    if (written != NULL) *written = 0U;
    if (bytes == NULL || written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status=validate(state,prefix);if(status!=CADR_STATUS_OK)return status;if(capacity<CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES)return CADR_STATUS_WRONG_LENGTH;
    (void)memset(bytes,0,(size_t)CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES);(void)memcpy(bytes,"CDRM6E1",7U);put32(bytes+8U,1U);put32(bytes+12U,(uint32_t)CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES);put32(bytes+16U,CADR_M6_DISK_EVIDENCE_POLICY_CODE);put32(bytes+20U,state->tail_started|(state->limit_exceeded<<1U));put32(bytes+24U,CADR_M6_DISK_EVIDENCE_PREFIX_CAPACITY);put32(bytes+28U,prefix->count);put64(bytes+32U,state->selected_maximum);put64(bytes+40U,state->total_accepted);put64(bytes+48U,state->tail_event_count);put64(bytes+56U,state->first_omitted_sequence);put64(bytes+64U,state->last_sequence);put64(bytes+72U,state->last_post_slot);put32(bytes+80U,state->last_intra_slot);put32(bytes+84U,state->have_last);{uint32_t index;for(index=0U;index<9U;++index)put64(bytes+88U+index*8U,state->per_kind[index]);}encode_tuple(bytes+160U,&state->last_after);prefix_digest(prefix,prefix_sha256);(void)memcpy(bytes+240U,prefix_sha256,CADR_SHA256_BYTES);(void)memcpy(bytes+272U,state->tail_sha256,CADR_SHA256_BYTES);put64(bytes+304U,state->limit_attempt_post_slot);put32(bytes+312U,state->limit_attempt_intra_slot);put32(bytes+316U,state->limit_reason);(void)memcpy(bytes+320U,state->limit_rejected_event_sha256,CADR_SHA256_BYTES);*written=CADR_M6_DISK_EVIDENCE_SUMMARY_BYTES;return CADR_STATUS_OK;
}
