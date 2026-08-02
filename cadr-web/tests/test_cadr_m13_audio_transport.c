#include "cadr_m13_audio_transport.h"

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define CHECK(value) do { if (!(value)) { fprintf(stderr, "check failed: %s:%d: %s\n", __FILE__, __LINE__, #value); return 1; } } while (0)

static int initialize(cadr_audio_incarnation_allocator *allocator,
                      cadr_audio_authority *authority, cadr_audio_model *model,
                      uint64_t epoch)
{
    return cadr_audio_incarnation_allocator_initialize(allocator, UINT64_C(1)) == CADR_AUDIO_STATUS_OK &&
        cadr_audio_authority_initialize(authority, allocator, UINT64_C(7), epoch, UINT64_C(0)) == CADR_AUDIO_STATUS_OK &&
        cadr_audio_model_initialize(model, authority, UINT64_C(1), CADR_AUDIO_RENDERER_USIM_SDL3_SINE) == CADR_AUDIO_STATUS_OK;
}

int main(void)
{
    static const uint8_t expected[48] = {
        0x43,0x44,0x52,0x4d,0x31,0x31,0x4f,0x31,
        0x01,0x00,0x00,0x00,0x30,0x00,0x00,0x00,
        0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x02,0x00,0x00,0x00
    };
    cadr_audio_incarnation_allocator allocator = { 0 }, exhausted_allocator = { 0 };
    cadr_audio_authority authority = { 0 }, exhausted_authority = { 0 }, authority_before;
    cadr_audio_model model = { 0 }, exhausted_model = { 0 }, model_before;
    uint8_t output[48], unchanged[48];
    CHECK(initialize(&allocator, &authority, &model, UINT64_C(1)));
    (void)memset(output, 0xa5, sizeof(output));
    CHECK(cadr_m13_audio_open_model(&model, output) == UINT32_C(0));
    CHECK(memcmp(output, expected, sizeof(expected)) == 0);

    CHECK(initialize(&exhausted_allocator, &exhausted_authority,
                     &exhausted_model, UINT64_MAX));
    authority_before = exhausted_authority; model_before = exhausted_model;
    (void)memset(output, 0x5a, sizeof(output)); (void)memcpy(unchanged, output, sizeof(output));
    CHECK(cadr_m13_audio_open_model(&exhausted_model, output) == UINT32_C(22));
    CHECK(memcmp(&exhausted_authority, &authority_before, sizeof(authority_before)) == 0);
    CHECK(memcmp(&exhausted_model, &model_before, sizeof(model_before)) == 0);
    CHECK(memcmp(output, unchanged, sizeof(output)) == 0);
    puts("cadr M13 audio open layout and exhaustion tests passed");
    return 0;
}
