#include "cadr_m13_audio_transport.h"

#include <string.h>

static void put32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value; bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U); bytes[3] = (uint8_t)(value >> 24U);
}

static void put64(uint8_t *bytes, uint64_t value)
{
    put32(bytes, (uint32_t)value); put32(bytes + 4U, (uint32_t)(value >> 32U));
}

uint32_t cadr_m13_audio_open_model(cadr_audio_model *model,
                                  uint8_t output[CADR_M13_AUDIO_OPEN_BYTES])
{
    cadr_audio_status status;
    if (model == NULL || output == NULL || model->authority == NULL) return UINT32_C(9);
    status = cadr_audio_model_start_consumer_session(model);
    if (status == CADR_AUDIO_STATUS_OVERFLOW) return UINT32_C(22);
    if (status != CADR_AUDIO_STATUS_OK) return UINT32_C(2);
    (void)memset(output, 0, CADR_M13_AUDIO_OPEN_BYTES);
    (void)memcpy(output, "CDRM11O1", 8U);
    put32(output + 8U, UINT32_C(1)); put32(output + 12U, CADR_M13_AUDIO_OPEN_BYTES);
    put64(output + 16U, model->generation);
    put64(output + 24U, model->authority->consumer_epoch);
    put64(output + 32U, model->queued_frames);
    put32(output + 40U, model->count);
    put32(output + 44U, model->renderer_profile);
    return UINT32_C(0);
}
