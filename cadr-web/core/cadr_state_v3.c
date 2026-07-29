#include "cadr_state_v3.h"

#include "cadr_state_v2.h"

#include <string.h>

typedef struct cadr_state_v3_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t used;
} cadr_state_v3_sha256;

static uint32_t ror32(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (32U - count));
}

static void transform(cadr_state_v3_sha256 *ctx, const uint8_t block[64])
{
    static const uint32_t k[64] = {
        UINT32_C(0x428a2f98), UINT32_C(0x71374491), UINT32_C(0xb5c0fbcf), UINT32_C(0xe9b5dba5), UINT32_C(0x3956c25b), UINT32_C(0x59f111f1), UINT32_C(0x923f82a4), UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98), UINT32_C(0x12835b01), UINT32_C(0x243185be), UINT32_C(0x550c7dc3), UINT32_C(0x72be5d74), UINT32_C(0x80deb1fe), UINT32_C(0x9bdc06a7), UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1), UINT32_C(0xefbe4786), UINT32_C(0x0fc19dc6), UINT32_C(0x240ca1cc), UINT32_C(0x2de92c6f), UINT32_C(0x4a7484aa), UINT32_C(0x06ca6351), UINT32_C(0x14292967),
        UINT32_C(0x27b70a85), UINT32_C(0x2e1b2138), UINT32_C(0x4d2c6dfc), UINT32_C(0x53380d13), UINT32_C(0x650a7354), UINT32_C(0x766a0abb), UINT32_C(0x81c2c92e), UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1), UINT32_C(0xa81a664b), UINT32_C(0xc24b8b70), UINT32_C(0xc76c51a3), UINT32_C(0xd192e819), UINT32_C(0xd6990624), UINT32_C(0xf40e3585), UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116), UINT32_C(0x1e376c08), UINT32_C(0x2748774c), UINT32_C(0x34b0bcb5), UINT32_C(0x391c0cb3), UINT32_C(0x4ed8aa4a), UINT32_C(0x5b9cca4f), UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee), UINT32_C(0x78a5636f), UINT32_C(0x84c87814), UINT32_C(0x8cc70208), UINT32_C(0x90befffa), UINT32_C(0xa4506ceb), UINT32_C(0xbef9a3f7), UINT32_C(0xc67178f2)
    };
    uint32_t w[64], a, b, c, d, e, f, g, h, index;
    for (index = 0U; index < 16U; ++index) {
        const uint32_t o = index * 4U;
        w[index] = ((uint32_t)block[o] << 24U) | ((uint32_t)block[o + 1U] << 16U) |
            ((uint32_t)block[o + 2U] << 8U) | block[o + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        w[index] = (ror32(w[index - 15U], 7U) ^ ror32(w[index - 15U], 18U) ^ (w[index - 15U] >> 3U)) + w[index - 16U] +
            (ror32(w[index - 2U], 17U) ^ ror32(w[index - 2U], 19U) ^ (w[index - 2U] >> 10U)) + w[index - 7U];
    }
    a = ctx->state[0]; b = ctx->state[1]; c = ctx->state[2]; d = ctx->state[3];
    e = ctx->state[4]; f = ctx->state[5]; g = ctx->state[6]; h = ctx->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t t1 = h + (ror32(e, 6U) ^ ror32(e, 11U) ^ ror32(e, 25U)) + ((e & f) ^ (~e & g)) + k[index] + w[index];
        const uint32_t t2 = (ror32(a, 2U) ^ ror32(a, 13U) ^ ror32(a, 22U)) + ((a & b) ^ (a & c) ^ (b & c));
        h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }
    ctx->state[0] += a; ctx->state[1] += b; ctx->state[2] += c; ctx->state[3] += d;
    ctx->state[4] += e; ctx->state[5] += f; ctx->state[6] += g; ctx->state[7] += h;
}

static void init(cadr_state_v3_sha256 *ctx)
{
    static const uint32_t initial[8] = { UINT32_C(0x6a09e667), UINT32_C(0xbb67ae85), UINT32_C(0x3c6ef372), UINT32_C(0xa54ff53a), UINT32_C(0x510e527f), UINT32_C(0x9b05688c), UINT32_C(0x1f83d9ab), UINT32_C(0x5be0cd19) };
    (void)memset(ctx, 0, sizeof(*ctx));
    (void)memcpy(ctx->state, initial, sizeof(initial));
}

static void update(cadr_state_v3_sha256 *ctx, const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t room = 64U - ctx->used;
        const uint32_t take = count < room ? (uint32_t)count : room;
        (void)memcpy(ctx->block + ctx->used, bytes, take);
        ctx->used += take; bytes += take; count -= take; ctx->bit_count += (uint64_t)take * 8U;
        if (ctx->used == 64U) { transform(ctx, ctx->block); ctx->used = 0U; }
    }
}

static void u32le(cadr_state_v3_sha256 *ctx, uint32_t value)
{
    uint8_t bytes[4] = { (uint8_t)value, (uint8_t)(value >> 8U), (uint8_t)(value >> 16U), (uint8_t)(value >> 24U) };
    update(ctx, bytes, sizeof(bytes));
}

static void u64le(cadr_state_v3_sha256 *ctx, uint64_t value)
{
    uint8_t bytes[8]; uint32_t index;
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
    update(ctx, bytes, sizeof(bytes));
}

static void finish(cadr_state_v3_sha256 *ctx, uint8_t digest[CADR_SHA256_BYTES])
{
    uint32_t index; const uint64_t bits = ctx->bit_count;
    ctx->block[ctx->used++] = UINT8_C(0x80);
    if (ctx->used > 56U) { while (ctx->used < 64U) ctx->block[ctx->used++] = 0U; transform(ctx, ctx->block); ctx->used = 0U; }
    while (ctx->used < 56U) ctx->block[ctx->used++] = 0U;
    for (index = 0U; index < 8U; ++index) ctx->block[56U + index] = (uint8_t)(bits >> ((7U - index) * 8U));
    transform(ctx, ctx->block);
    for (index = 0U; index < 8U; ++index) { digest[index * 4U] = (uint8_t)(ctx->state[index] >> 24U); digest[index * 4U + 1U] = (uint8_t)(ctx->state[index] >> 16U); digest[index * 4U + 2U] = (uint8_t)(ctx->state[index] >> 8U); digest[index * 4U + 3U] = (uint8_t)ctx->state[index]; }
}

cadr_status cadr_state_v3_digest(const cadr_machine_state *state,
                                 uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_state_v3_sha256 ctx; uint8_t v2[CADR_SHA256_BYTES];
    const cadr_disk_state *disk;
    static const uint8_t domain[] = "CDRSTATE3";
    cadr_status status;
    if (state == NULL || digest == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_state_v2_digest(state, v2);
    if (status != CADR_STATUS_OK) return status;
    disk = &state->devices.disk;
    init(&ctx); update(&ctx, domain, sizeof(domain) - 1U); u32le(&ctx, CADR_STATE_V3_SCHEMA_VERSION); update(&ctx, v2, sizeof(v2));
    u64le(&ctx, disk->pending_first_block); u32le(&ctx, disk->compatibility_profile); u32le(&ctx, disk->command); u32le(&ctx, disk->command_list_pointer); u32le(&ctx, disk->disk_address); u32le(&ctx, disk->last_memory_address); u32le(&ctx, disk->pending_ccw_address); u32le(&ctx, disk->pending_memory_address); u32le(&ctx, disk->pending_ccw); u32le(&ctx, disk->status); u32le(&ctx, disk->transfer_active); u32le(&ctx, disk->reset_condition); u32le(&ctx, disk->done_interrupt_enable); u32le(&ctx, disk->attention_interrupt_enable); u32le(&ctx, disk->reserved0);
    finish(&ctx, digest); return CADR_STATUS_OK;
}
