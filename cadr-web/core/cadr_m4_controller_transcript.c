#include "cadr_m4_controller_transcript.h"
#include "cadr_m4_media.h"
#include "cadr_state_v4.h"
#include <string.h>
static void p32(uint8_t*p,uint32_t v){p[0]=(uint8_t)v;p[1]=(uint8_t)(v>>8U);p[2]=(uint8_t)(v>>16U);p[3]=(uint8_t)(v>>24U);}static void p64(uint8_t*p,uint64_t v){uint32_t i;for(i=0U;i<8U;++i)p[i]=(uint8_t)(v>>(i*8U));}
static void h(const char*s,uint8_t*d){uint64_t n=0U;while(s[n]!='\0')n++;cadr_m4_media_sha256((const uint8_t*)s,n,d);}static void tuple(uint8_t*p,const cadr_disk_evidence_tuple*t){p64(p,t->lba);p64(p+8U,t->generation);p64(p+16U,t->request_id);p64(p+24U,t->expected_completion);p32(p+32U,t->command);p32(p+36U,t->clp);p32(p+40U,t->da);p32(p+44U,t->lma);p32(p+48U,t->ccw_address);p32(p+52U,t->ccw_index);p32(p+56U,t->status);p32(p+60U,t->transfer_reset_enables);p32(p+64U,t->bus_irq);p32(p+68U,t->operation);p32(p+72U,t->completion_queued);}
cadr_status cadr_m4_controller_transcript_size(const cadr_disk_evidence_log*l,uint64_t*n){if(l==NULL||n==NULL||l->overflowed!=0U||l->count==0U||l->count>512U)return CADR_STATUS_NOT_READY;*n=512U+(uint64_t)l->count*384U;return CADR_STATUS_OK;}
static uint32_t selected_evidence_valid(const cadr_disk_evidence_log *log)
{
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
    uint32_t index;
    if (log->count != 67U) return 0U;
    for (index = 0U; index < 67U; ++index) {
        if (log->events[index].kind != kinds[index]) return 0U;
    }
    for (index = 0U; index < 3U; ++index) {
        const cadr_disk_evidence_event *request =
            &log->events[request_indices[index]];
        const cadr_disk_evidence_event *delivery =
            &log->events[delivery_indices[index]];
        const cadr_disk_evidence_event *application =
            &log->events[application_indices[index]];
        const cadr_disk_evidence_event *page =
            &log->events[page_indices[index]];
        if (request->after.command != commands[index] ||
            request->after.lba != blocks[index] ||
            request->after.operation != operations[index] ||
            request->after.request_id != (uint64_t)index + 1U ||
            delivery->after.command != commands[index] ||
            delivery->after.lba != blocks[index] ||
            delivery->after.operation != operations[index] ||
            delivery->after.request_id != (uint64_t)index + 1U ||
            application->after.command != commands[index] ||
            application->after.lba != blocks[index] ||
            application->after.operation != operations[index] ||
            application->after.request_id != (uint64_t)index + 1U ||
            page->after.command != commands[index] ||
            page->second != blocks[index] ||
            page->value != 1024U ||
            page->flags != (index == 0U ? 1U : 0U)) {
            return 0U;
        }
    }
    if (log->events[4].flags != 0U ||
        log->events[15].flags != 0U ||
        log->events[27].flags != 0U ||
        log->events[41].flags != 0U) {
        return 0U;
    }
    return 1U;
}
cadr_status cadr_m4_controller_transcript_serialize(const cadr_m4_controller_transcript_config*c,const cadr_machine_state*s,const cadr_disk_evidence_log*l,uint8_t*b,uint64_t cap,uint64_t*w){cadr_m4_media_header base;uint64_t n,r,i,lastslot=0U;uint32_t intra=0U,started=0U;uint8_t st[32],rh[32],ph[32],th[32],tuple_bytes[80];cadr_status x;if(w!=NULL)*w=0U;if(c==NULL||s==NULL||l==NULL||b==NULL||w==NULL)return CADR_STATUS_INVALID_ARGUMENT;if(c->terminal_reached!=1U||c->terminal_boundary!=1029996U||c->p0_pc!=0355U||c->p1_pc!=0356U||c->next_micro_pc!=0357U||s->clock_slots_completed!=1030044U||s->events.outstanding_request_id!=0U||s->events.completion_queued!=0U)return CADR_STATUS_NOT_READY;x=cadr_m4_controller_transcript_size(l,&n);if(x!=0U)return x;if(selected_evidence_valid(l)==0U)return CADR_STATUS_INVALID_ARGUMENT;if(cap<n)return CADR_STATUS_WRONG_LENGTH;for(i=0U;i<l->count;++i){const cadr_disk_evidence_event*e=&l->events[i];if(e->sequence!=i||e->post_slot>1029996U||(i!=0U&&(e->post_slot<lastslot||(e->post_slot==lastslot&&e->intra_slot!=intra+1U)||(e->post_slot!=lastslot&&e->intra_slot!=0U))))return CADR_STATUS_INVALID_ARGUMENT;lastslot=e->post_slot;intra=e->intra_slot;if(e->kind==CADR_DISK_EVIDENCE_REGISTER_WRITE&&e->first==3U&&e->value==0U&&e->before.command==0405U)started=1U;}if(started==0U)return CADR_STATUS_INVALID_ARGUMENT;x=cadr_state_v4_digest(s,st);if(x!=0U)return x;cadr_m4_media_selected_base(&base);r=(uint64_t)l->count*384U;(void)memset(b,0,(size_t)n);(void)memcpy(b,"CDRM4CTRL1",10U);p32(b+12U,1U);p32(b+16U,256U);p32(b+20U,384U);p32(b+24U,256U);p32(b+28U,512U);p64(b+32U,base.base_byte_count);p64(b+40U,s->clock_slots_completed);p64(b+48U,l->count);(void)memcpy(b+64U,c->profile_sha256,32U);(void)memcpy(b+96U,c->artifact_set_sha256,32U);(void)memcpy(b+128U,base.base_sha256,32U);h("C-M4-ZERO-TICK-SCHEDULE-v1",b+160U);h("FIRST-START-0405-v1",b+192U);h("FIRST-START-0405-v1/EXECUTED-0355-P1-0356-NEXT-0357-v1",b+224U);for(i=0U;i<l->count;++i){const cadr_disk_evidence_event*e=&l->events[i];uint8_t*p=b+256U+i*384U;p64(p,e->sequence);p64(p+8U,e->post_slot);p32(p+16U,e->intra_slot);p32(p+20U,e->kind);p32(p+24U,e->flags);p32(p+28U,e->value);p32(p+32U,e->detail);p64(p+40U,e->first);p64(p+48U,e->second);p64(p+56U,e->delivered_completion);tuple(p+64U,&e->before);tuple(p+144U,&e->after);(void)memcpy(p+224U,e->descriptor_sha256,32U);(void)memcpy(p+256U,e->payload_sha256,32U);(void)memcpy(p+288U,e->delivery_sha256,32U);(void)memcpy(p+320U,e->page_sha256,32U);}cadr_m4_media_sha256(b+256U,r,rh);cadr_m4_media_sha256(b,256U+r,ph);(void)memset(tuple_bytes,0,sizeof(tuple_bytes));tuple(tuple_bytes,&l->events[l->count-1U].after);cadr_m4_media_sha256(tuple_bytes,sizeof(tuple_bytes),th);{uint8_t*f=b+256U+r;(void)memset(f,0,256U);(void)memcpy(f,"CDRM4END1",9U);p32(f+12U,1U);p64(f+16U,l->count);p64(f+24U,s->clock_slots_completed);p64(f+32U,1029996U);p64(f+40U,0355U);p64(f+48U,0356U);p64(f+56U,0357U);p64(f+64U,0U);p64(f+72U,31U);(void)memcpy(f+96U,st,32U);(void)memcpy(f+128U,rh,32U);(void)memcpy(f+160U,ph,32U);(void)memcpy(f+192U,th,32U);}*w=n;return CADR_STATUS_OK;}
