/* Disposable public-usim audio witness; not a maintained-usim API. */
#include "cadr_m11_audio_witness.h"

#include <err.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static FILE *cadr_m11_witness_stream;
static uint64_t cadr_m11_witness_sequence;
static int cadr_m11_witness_open_attempted;

/* Small local SHA-256 implementation.  It hashes compact canonical witness
 * bytes, never serializes or retains licensed sound output. */
typedef struct cadr_m11_sha256 {
    uint32_t state[8];
    uint64_t byte_count;
    uint8_t block[64];
    uint32_t block_count;
} cadr_m11_sha256;

static uint32_t
cadr_m11_rotr(const uint32_t value, const uint32_t count)
{
    return (value >> count) | (value << (32U - count));
}

static uint32_t
cadr_m11_get32be(const uint8_t bytes[4])
{
    return ((uint32_t)bytes[0] << 24U) | ((uint32_t)bytes[1] << 16U) |
        ((uint32_t)bytes[2] << 8U) | (uint32_t)bytes[3];
}

static void
cadr_m11_put32le(uint8_t bytes[4], const uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void
cadr_m11_sha256_compress(cadr_m11_sha256 *context, const uint8_t block[64])
{
    static const uint32_t constants[64] = {
        0x428a2f98U,0x71374491U,0xb5c0fbcfU,0xe9b5dba5U,0x3956c25bU,0x59f111f1U,0x923f82a4U,0xab1c5ed5U,
        0xd807aa98U,0x12835b01U,0x243185beU,0x550c7dc3U,0x72be5d74U,0x80deb1feU,0x9bdc06a7U,0xc19bf174U,
        0xe49b69c1U,0xefbe4786U,0x0fc19dc6U,0x240ca1ccU,0x2de92c6fU,0x4a7484aaU,0x5cb0a9dcU,0x76f988daU,
        0x983e5152U,0xa831c66dU,0xb00327c8U,0xbf597fc7U,0xc6e00bf3U,0xd5a79147U,0x06ca6351U,0x14292967U,
        0x27b70a85U,0x2e1b2138U,0x4d2c6dfcU,0x53380d13U,0x650a7354U,0x766a0abbU,0x81c2c92eU,0x92722c85U,
        0xa2bfe8a1U,0xa81a664bU,0xc24b8b70U,0xc76c51a3U,0xd192e819U,0xd6990624U,0xf40e3585U,0x106aa070U,
        0x19a4c116U,0x1e376c08U,0x2748774cU,0x34b0bcb5U,0x391c0cb3U,0x4ed8aa4aU,0x5b9cca4fU,0x682e6ff3U,
        0x748f82eeU,0x78a5636fU,0x84c87814U,0x8cc70208U,0x90befffaU,0xa4506cebU,0xbef9a3f7U,0xc67178f2U
    };
    uint32_t words[64];
    uint32_t a, b, c, d, e, f, g, h, index;
    for (index = 0U; index < 16U; ++index) words[index] = cadr_m11_get32be(block + index * 4U);
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = cadr_m11_rotr(words[index - 15U], 7U) ^ cadr_m11_rotr(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
        const uint32_t s1 = cadr_m11_rotr(words[index - 2U], 17U) ^ cadr_m11_rotr(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t s1 = cadr_m11_rotr(e, 6U) ^ cadr_m11_rotr(e, 11U) ^ cadr_m11_rotr(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temp1 = h + s1 + choose + constants[index] + words[index];
        const uint32_t s0 = cadr_m11_rotr(a, 2U) ^ cadr_m11_rotr(a, 13U) ^ cadr_m11_rotr(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temp2 = s0 + majority;
        h = g; g = f; f = e; e = d + temp1; d = c; c = b; b = a; a = temp1 + temp2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void
cadr_m11_sha256_init(cadr_m11_sha256 *context)
{
    static const uint32_t initial[8] = { 0x6a09e667U,0xbb67ae85U,0x3c6ef372U,0xa54ff53aU,
        0x510e527fU,0x9b05688cU,0x1f83d9abU,0x5be0cd19U };
    (void)memcpy(context->state, initial, sizeof(initial));
    context->byte_count = 0U; context->block_count = 0U;
}

static void
cadr_m11_sha256_update(cadr_m11_sha256 *context, const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t take = (uint32_t)((count < (uint64_t)(64U - context->block_count)) ? count : (uint64_t)(64U - context->block_count));
        (void)memcpy(context->block + context->block_count, bytes, take);
        context->block_count += take; context->byte_count += take; bytes += take; count -= take;
        if (context->block_count == 64U) { cadr_m11_sha256_compress(context, context->block); context->block_count = 0U; }
    }
}

static void
cadr_m11_sha256_final(cadr_m11_sha256 *context, char output[65])
{
    static const char hexadecimal[] = "0123456789abcdef";
    uint8_t tail[128] = { 0U };
    uint8_t digest[32];
    const uint64_t bit_count = context->byte_count * UINT64_C(8);
    uint32_t tail_count = context->block_count < 56U ? 64U : 128U;
    uint32_t index;
    (void)memcpy(tail, context->block, context->block_count); tail[context->block_count] = UINT8_C(0x80);
    for (index = 0U; index < 8U; ++index) tail[tail_count - 1U - index] = (uint8_t)(bit_count >> (index * 8U));
    cadr_m11_sha256_compress(context, tail);
    if (tail_count == 128U) cadr_m11_sha256_compress(context, tail + 64U);
    for (index = 0U; index < 8U; ++index) {
        digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        digest[index * 4U + 3U] = (uint8_t)context->state[index];
    }
    for (index = 0U; index < sizeof(digest); ++index) {
        output[index * 2U] = hexadecimal[digest[index] >> 4U];
        output[index * 2U + 1U] = hexadecimal[digest[index] & 15U];
    }
    output[64] = '\0';
}

static void
cadr_m11_hash_job(const uint32_t half_wavelength_us, const uint32_t wavelength_us,
                  const uint32_t duration_us, char output[65])
{
    uint8_t bytes[20] = { 'C','D','R','M','1','1','E','1' };
    cadr_m11_sha256 context;
    cadr_m11_put32le(bytes + 8U, half_wavelength_us);
    cadr_m11_put32le(bytes + 12U, wavelength_us);
    cadr_m11_put32le(bytes + 16U, duration_us);
    cadr_m11_sha256_init(&context); cadr_m11_sha256_update(&context, bytes, sizeof(bytes));
    cadr_m11_sha256_final(&context, output);
}

static void
cadr_m11_hash_pcm_s16le(const int16_t *samples, const uint32_t frame_count,
                        char output[65])
{
    cadr_m11_sha256 context;
    uint32_t index;
    cadr_m11_sha256_init(&context);
    for (index = 0U; index < frame_count; ++index) {
        uint8_t bytes[2];
        const uint16_t sample = (uint16_t)samples[index];
        bytes[0] = (uint8_t)sample; bytes[1] = (uint8_t)(sample >> 8U);
        cadr_m11_sha256_update(&context, bytes, sizeof(bytes));
    }
    cadr_m11_sha256_final(&context, output);
}

static void
cadr_m11_witness_open(void)
{
    const char *const path = getenv("CADR_M11_AUDIO_WITNESS");
    int descriptor;
    if (cadr_m11_witness_open_attempted != 0) return;
    cadr_m11_witness_open_attempted = 1;
    if (path == NULL || path[0] == '\0') return;
    descriptor = open(path, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (descriptor < 0) err(1, "CDRM11USIM1 cannot create witness");
    cadr_m11_witness_stream = fdopen(descriptor, "w");
    if (cadr_m11_witness_stream == NULL) err(1, "CDRM11USIM1 fdopen");
    if (fprintf(cadr_m11_witness_stream,
                "{\"schema\":\"CDRM11USIM1\",\"schema_version\":2}\n") < 0 ||
        fflush(cadr_m11_witness_stream) != 0) err(1, "CDRM11USIM1 header");
}

void
cadr_m11_native_audio_witness_job(const uint32_t half_wavelength_us,
                                  const uint32_t wavelength_us,
                                  const uint32_t duration_us)
{
    char event_sha256[65];
    cadr_m11_witness_open();
    if (cadr_m11_witness_stream == NULL) return;
    cadr_m11_hash_job(half_wavelength_us, wavelength_us, duration_us, event_sha256);
    if (fprintf(cadr_m11_witness_stream,
                "{\"duration_us\":%" PRIu32 ",\"event\":\"beep-job\","
                "\"event_sha256\":\"%s\",\"half_wavelength_us\":%" PRIu32 ",\"sequence\":%" PRIu64
                ",\"wavelength_us\":%" PRIu32 "}\n",
                duration_us, event_sha256, half_wavelength_us, cadr_m11_witness_sequence++,
                wavelength_us) < 0 || fflush(cadr_m11_witness_stream) != 0) {
        err(1, "CDRM11USIM1 job");
    }
}

void
cadr_m11_native_audio_witness_pcm(const int16_t *samples,
                                  const uint32_t frame_count,
                                  const uint32_t sample_rate)
{
    char pcm_s16le_sha256[65];
    cadr_m11_witness_open();
    if (cadr_m11_witness_stream == NULL || samples == NULL || frame_count == 0U) return;
    cadr_m11_hash_pcm_s16le(samples, frame_count, pcm_s16le_sha256);
    if (fprintf(cadr_m11_witness_stream,
                "{\"event\":\"pcm-block\",\"frame_count\":%" PRIu32
                ",\"pcm_s16le_sha256\":\"%s\",\"sample_bytes\":%" PRIu32
                ",\"sample_rate\":%" PRIu32 ",\"sequence\":%" PRIu64 "}\n",
                frame_count, pcm_s16le_sha256, frame_count * UINT32_C(2), sample_rate,
                cadr_m11_witness_sequence++) < 0 ||
        fflush(cadr_m11_witness_stream) != 0) {
        err(1, "CDRM11USIM1 pcm");
    }
}
