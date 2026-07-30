#ifndef CADR_M11_AUDIO_WITNESS_H
#define CADR_M11_AUDIO_WITNESS_H

#include <stdint.h>

/* Disposable public-usim witness hooks.  They are inert unless
 * CADR_M11_AUDIO_WITNESS names an as-yet nonexistent output file. */
void cadr_m11_native_audio_witness_job(uint32_t half_wavelength_us,
                                       uint32_t wavelength_us,
                                       uint32_t duration_us);
/* Samples are hashed as canonical little-endian signed-16 values before the
 * host audio backend receives them.  The witness never writes PCM bytes. */
void cadr_m11_native_audio_witness_pcm(const int16_t *samples,
                                       uint32_t frame_count,
                                       uint32_t sample_rate);

#endif
