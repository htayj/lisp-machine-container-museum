#ifndef CADR_M13_AUDIO_TRANSPORT_H
#define CADR_M13_AUDIO_TRANSPORT_H

#include "cadr_audio_model.h"
#include <stdint.h>

#define CADR_M13_AUDIO_OPEN_BYTES UINT32_C(48)

/* ABI1.11 wrapper status values: 0 OK, 2 invalid, 9 not ready, 22 resource
 * limit.  In particular, consumer-epoch exhaustion is 22 and nonmutating. */
uint32_t cadr_m13_audio_open_model(cadr_audio_model *model,
                                  uint8_t output[CADR_M13_AUDIO_OPEN_BYTES]);

#endif
