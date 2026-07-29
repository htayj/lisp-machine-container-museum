#include "cadr_m3_projection.h"

#include <string.h>

typedef struct cadr_m3_projection_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t used;
} cadr_m3_projection_sha256;

static uint32_t ror32(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void transform(cadr_m3_projection_sha256 *ctx, const uint8_t block[64])
{
    static const uint32_t k[64] = {
        UINT32_C(0x428a2f98),UINT32_C(0x71374491),UINT32_C(0xb5c0fbcf),UINT32_C(0xe9b5dba5),UINT32_C(0x3956c25b),UINT32_C(0x59f111f1),UINT32_C(0x923f82a4),UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98),UINT32_C(0x12835b01),UINT32_C(0x243185be),UINT32_C(0x550c7dc3),UINT32_C(0x72be5d74),UINT32_C(0x80deb1fe),UINT32_C(0x9bdc06a7),UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1),UINT32_C(0xefbe4786),UINT32_C(0x0fc19dc6),UINT32_C(0x240ca1cc),UINT32_C(0x2de92c6f),UINT32_C(0x4a7484aa),UINT32_C(0x5cb0a9dc),UINT32_C(0x76f988da),
        UINT32_C(0x983e5152),UINT32_C(0xa831c66d),UINT32_C(0xb00327c8),UINT32_C(0xbf597fc7),UINT32_C(0xc6e00bf3),UINT32_C(0xd5a79147),UINT32_C(0x06ca6351),UINT32_C(0x14292967),
        UINT32_C(0x27b70a85),UINT32_C(0x2e1b2138),UINT32_C(0x4d2c6dfc),UINT32_C(0x53380d13),UINT32_C(0x650a7354),UINT32_C(0x766a0abb),UINT32_C(0x81c2c92e),UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1),UINT32_C(0xa81a664b),UINT32_C(0xc24b8b70),UINT32_C(0xc76c51a3),UINT32_C(0xd192e819),UINT32_C(0xd6990624),UINT32_C(0xf40e3585),UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116),UINT32_C(0x1e376c08),UINT32_C(0x2748774c),UINT32_C(0x34b0bcb5),UINT32_C(0x391c0cb3),UINT32_C(0x4ed8aa4a),UINT32_C(0x5b9cca4f),UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee),UINT32_C(0x78a5636f),UINT32_C(0x84c87814),UINT32_C(0x8cc70208),UINT32_C(0x90befffa),UINT32_C(0xa4506ceb),UINT32_C(0xbef9a3f7),UINT32_C(0xc67178f2)
    };
    uint32_t w[64]; uint32_t a; uint32_t b; uint32_t c; uint32_t d;
    uint32_t e; uint32_t f; uint32_t g; uint32_t h; uint32_t i;
    for (i = 0U; i < 16U; ++i) {
        const uint32_t o = i * 4U;
        w[i] = ((uint32_t)block[o] << 24U) | ((uint32_t)block[o + 1U] << 16U) |
               ((uint32_t)block[o + 2U] << 8U) | block[o + 3U];
    }
    for (i = 16U; i < 64U; ++i) {
        w[i] = (ror32(w[i - 15U], 7U) ^ ror32(w[i - 15U], 18U) ^ (w[i - 15U] >> 3U)) +
               w[i - 16U] + (ror32(w[i - 2U], 17U) ^ ror32(w[i - 2U], 19U) ^ (w[i - 2U] >> 10U)) + w[i - 7U];
    }
    a=ctx->state[0]; b=ctx->state[1]; c=ctx->state[2]; d=ctx->state[3]; e=ctx->state[4]; f=ctx->state[5]; g=ctx->state[6]; h=ctx->state[7];
    for (i = 0U; i < 64U; ++i) { const uint32_t t1=h+(ror32(e,6U)^ror32(e,11U)^ror32(e,25U))+((e&f)^(~e&g))+k[i]+w[i]; const uint32_t t2=(ror32(a,2U)^ror32(a,13U)^ror32(a,22U))+((a&b)^(a&c)^(b&c)); h=g;g=f;f=e;e=d+t1;d=c;c=b;b=a;a=t1+t2; }
    ctx->state[0]+=a;ctx->state[1]+=b;ctx->state[2]+=c;ctx->state[3]+=d;ctx->state[4]+=e;ctx->state[5]+=f;ctx->state[6]+=g;ctx->state[7]+=h;
}

static void update(cadr_m3_projection_sha256 *ctx, const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) { const uint32_t room=64U-ctx->used; const uint32_t take=count<room?(uint32_t)count:room; (void)memcpy(ctx->block+ctx->used,bytes,take);ctx->used+=take;ctx->bit_count+=(uint64_t)take*8U;bytes+=take;count-=take;if(ctx->used==64U){transform(ctx,ctx->block);ctx->used=0U;} }
}

static void u32le(cadr_m3_projection_sha256 *ctx, uint32_t value)
{ uint8_t b[4]={(uint8_t)value,(uint8_t)(value>>8U),(uint8_t)(value>>16U),(uint8_t)(value>>24U)}; update(ctx,b,sizeof(b)); }
static void u64le(cadr_m3_projection_sha256 *ctx, uint64_t value)
{ uint8_t b[8];uint32_t i;for(i=0U;i<8U;++i)b[i]=(uint8_t)(value>>(i*8U));update(ctx,b,sizeof(b)); }
static void scalar32(cadr_m3_projection_sha256 *ctx, uint32_t tag, uint32_t value)
{ u32le(ctx,tag);u32le(ctx,4U);u32le(ctx,value); }
static void scalar64(cadr_m3_projection_sha256 *ctx, uint32_t tag, uint64_t value)
{ u32le(ctx,tag);u32le(ctx,8U);u64le(ctx,value); }
static uint32_t boolean(uint32_t value) { return value != 0U ? 1U : 0U; }

cadr_status cadr_m3_projection_digest(const cadr_machine_state *state,
                                      uint64_t boundary, uint32_t phase,
                                      uint8_t digest[CADR_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRM3AD1\0";
    static const uint32_t initial[8] = { UINT32_C(0x6a09e667),UINT32_C(0xbb67ae85),UINT32_C(0x3c6ef372),UINT32_C(0xa54ff53a),UINT32_C(0x510e527f),UINT32_C(0x9b05688c),UINT32_C(0x1f83d9ab),UINT32_C(0x5be0cd19) };
    cadr_m3_projection_sha256 ctx; uint32_t i; const cadr_cpu_state *cpu;
    if (state == NULL || digest == NULL || phase > CADR_M3_PROJECTION_PHASE_INHIBITED) return CADR_STATUS_INVALID_ARGUMENT;
    (void)memset(&ctx,0,sizeof(ctx));(void)memcpy(ctx.state,initial,sizeof(initial));update(&ctx,domain,9U);u32le(&ctx,CADR_M3_PROJECTION_SCHEMA);u64le(&ctx,boundary);u32le(&ctx,phase);cpu=&state->cpu;
    scalar64(&ctx,1U,state->clock_slots_completed); scalar64(&ctx,2U,cpu->p0&UINT64_C(0xffffffffffff)); scalar64(&ctx,3U,cpu->p1&UINT64_C(0xffffffffffff)); scalar64(&ctx,4U,cpu->debug_ir&UINT64_C(0xffffffffffff)); scalar64(&ctx,5U,cpu->instruction_write_register&UINT64_C(0xffffffffffff));
    scalar32(&ctx,6U,cpu->p0_pc);scalar32(&ctx,7U,cpu->p1_pc);scalar32(&ctx,8U,cpu->next_micro_pc);scalar32(&ctx,9U,cpu->p0_imem);scalar32(&ctx,10U,cpu->p1_imem);scalar32(&ctx,11U,cpu->location_counter);scalar32(&ctx,12U,cpu->q);scalar32(&ctx,13U,cpu->old_q);scalar32(&ctx,14U,cpu->vma);scalar32(&ctx,15U,cpu->md);scalar32(&ctx,16U,cpu->pending_md);scalar32(&ctx,17U,cpu->pending_md_delay);scalar32(&ctx,18U,cpu->dispatch_constant);scalar32(&ctx,19U,cpu->interrupt_control);scalar32(&ctx,20U,state->bus.interrupt_status);scalar32(&ctx,21U,boolean(cpu->interrupt_pending));scalar32(&ctx,22U,cpu->micro_stack_pointer);scalar32(&ctx,23U,cpu->pdl_pointer);scalar32(&ctx,24U,cpu->pdl_index);scalar32(&ctx,25U,cpu->oa_low);scalar32(&ctx,26U,cpu->oa_high);scalar32(&ctx,27U,boolean(cpu->oa_low_pending));scalar32(&ctx,28U,boolean(cpu->oa_high_pending));scalar32(&ctx,29U,cpu->decoded_a_address);scalar32(&ctx,30U,cpu->decoded_m_address);scalar32(&ctx,31U,cpu->decoded_a_data);scalar32(&ctx,32U,cpu->decoded_m_data);scalar32(&ctx,33U,cpu->decoded_class);scalar32(&ctx,34U,boolean(cpu->effective_popj));scalar32(&ctx,35U,cpu->alu_out);scalar32(&ctx,36U,cpu->alu_carry);scalar32(&ctx,37U,cpu->out);scalar32(&ctx,38U,boolean(cpu->inhibit));scalar32(&ctx,39U,cpu->opc);scalar32(&ctx,40U,boolean(cpu->halted));scalar32(&ctx,41U,boolean(cpu->vma_ok));scalar32(&ctx,42U,boolean(cpu->prom_disabled));scalar32(&ctx,43U,state->memory.main_memory_pages);scalar32(&ctx,44U,0U);scalar32(&ctx,45U,0U);scalar32(&ctx,46U,state->bus.error_status);scalar64(&ctx,47U,state->trace.raw_fetched_word&UINT64_C(0xffffffffffff));scalar64(&ctx,48U,state->trace.effective_word&UINT64_C(0xffffffffffff));scalar32(&ctx,49U,state->trace.pc);scalar32(&ctx,50U,state->trace.store_selector);scalar32(&ctx,51U,state->trace.operation);scalar32(&ctx,52U,state->trace.a_address);scalar32(&ctx,53U,state->trace.m_address);scalar32(&ctx,54U,state->trace.a_value);scalar32(&ctx,55U,state->trace.m_value);scalar32(&ctx,56U,boolean(state->trace.instruction_memory));scalar32(&ctx,57U,boolean(state->trace.functional_m_source));scalar32(&ctx,58U,boolean(state->trace.effective_popj));scalar32(&ctx,59U,boolean(state->trace.last_slot_inhibited));scalar32(&ctx,60U,boolean(state->trace.decoded));
    ctx.block[ctx.used++]=UINT8_C(0x80);if(ctx.used>56U){(void)memset(ctx.block+ctx.used,0,64U-ctx.used);transform(&ctx,ctx.block);ctx.used=0U;}(void)memset(ctx.block+ctx.used,0,56U-ctx.used);for(i=0U;i<8U;++i)ctx.block[63U-i]=(uint8_t)(ctx.bit_count>>(i*8U));transform(&ctx,ctx.block);for(i=0U;i<8U;++i){digest[i*4U]=(uint8_t)(ctx.state[i]>>24U);digest[i*4U+1U]=(uint8_t)(ctx.state[i]>>16U);digest[i*4U+2U]=(uint8_t)(ctx.state[i]>>8U);digest[i*4U+3U]=(uint8_t)ctx.state[i];}return CADR_STATUS_OK;
}
