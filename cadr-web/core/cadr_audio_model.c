#include "cadr_audio_model.h"

#include <stddef.h>
#include <string.h>

#define CADR_AUDIO_AUTHORITY_LIVE UINT32_C(1)
#define CADR_AUDIO_AUTHORITY_RETIRED UINT32_C(2)
#define CADR_AUDIO_INCARNATION_ALLOCATOR_LIVE UINT32_C(1)

typedef struct cadr_audio_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t used;
} cadr_audio_sha256;

static uint32_t rotr32(uint32_t value, uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void sha256_transform(cadr_audio_sha256 *context,
                             const uint8_t block[64])
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
    uint32_t a;
    uint32_t b;
    uint32_t c;
    uint32_t d;
    uint32_t e;
    uint32_t f;
    uint32_t g;
    uint32_t h;
    uint32_t index;

    for (index = 0U; index < 16U; ++index) {
        const uint32_t at = index * 4U;
        words[index] = ((uint32_t)block[at] << 24U) |
            ((uint32_t)block[at + 1U] << 16U) |
            ((uint32_t)block[at + 2U] << 8U) | (uint32_t)block[at + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = rotr32(words[index - 15U], 7U) ^
            rotr32(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
        const uint32_t s1 = rotr32(words[index - 2U], 17U) ^
            rotr32(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2];
    d = context->state[3]; e = context->state[4]; f = context->state[5];
    g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t s1 = rotr32(e, 6U) ^ rotr32(e, 11U) ^ rotr32(e, 25U);
        const uint32_t choice = (e & f) ^ ((~e) & g);
        const uint32_t temp1 = h + s1 + choice + constants[index] + words[index];
        const uint32_t s0 = rotr32(a, 2U) ^ rotr32(a, 13U) ^ rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temp2 = s0 + majority;
        h = g; g = f; f = e; e = d + temp1;
        d = c; c = b; b = a; a = temp1 + temp2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c;
    context->state[3] += d; context->state[4] += e; context->state[5] += f;
    context->state[6] += g; context->state[7] += h;
}

static void sha256_initialize(cadr_audio_sha256 *context)
{
    static const uint32_t initial[8] = {
        UINT32_C(0x6a09e667),UINT32_C(0xbb67ae85),UINT32_C(0x3c6ef372),UINT32_C(0xa54ff53a),
        UINT32_C(0x510e527f),UINT32_C(0x9b05688c),UINT32_C(0x1f83d9ab),UINT32_C(0x5be0cd19)
    };
    (void)memset(context, 0, sizeof(*context));
    (void)memcpy(context->state, initial, sizeof(initial));
}

static void sha256_update(cadr_audio_sha256 *context, const uint8_t *bytes,
                          uint64_t count)
{
    while (count != 0U) {
        const uint32_t room = UINT32_C(64) - context->used;
        const uint32_t take = count < (uint64_t)room ? (uint32_t)count : room;
        (void)memcpy(context->block + context->used, bytes, take);
        context->used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        count -= take;
        if (context->used == 64U) {
            sha256_transform(context, context->block);
            context->used = 0U;
        }
    }
}

static void sha256_finish(cadr_audio_sha256 *context,
                          uint8_t digest[CADR_AUDIO_WITNESS_BYTES])
{
    const uint64_t bit_count = context->bit_count;
    uint32_t index;
    context->block[context->used++] = UINT8_C(0x80);
    if (context->used > 56U) {
        (void)memset(context->block + context->used, 0, 64U - context->used);
        sha256_transform(context, context->block);
        context->used = 0U;
    }
    (void)memset(context->block + context->used, 0, 56U - context->used);
    for (index = 0U; index < 8U; ++index) {
        context->block[63U - index] = (uint8_t)(bit_count >> (index * 8U));
    }
    sha256_transform(context, context->block);
    for (index = 0U; index < 8U; ++index) {
        digest[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        digest[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        digest[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        digest[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

static void put32(uint8_t *bytes, uint32_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
    bytes[2] = (uint8_t)(value >> 16U);
    bytes[3] = (uint8_t)(value >> 24U);
}

static void put64(uint8_t *bytes, uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        bytes[index] = (uint8_t)(value >> (index * 8U));
    }
}

static uint32_t get32(const uint8_t *bytes)
{
    return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
        ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t get64(const uint8_t *bytes)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)bytes[index] << (index * 8U);
    }
    return value;
}

void cadr_audio_event_encode(const cadr_audio_event *event,
                             uint8_t bytes[CADR_AUDIO_CANONICAL_EVENT_BYTES])
{
    if (event == NULL || bytes == NULL) return;
    put64(bytes, event->sequence);
    put64(bytes + 8U, event->generation);
    put64(bytes + 16U, event->post_slot);
    put32(bytes + 24U, event->intra_slot);
    put32(bytes + 28U, event->kind);
    put32(bytes + 32U, event->frame_count);
    put32(bytes + 36U, event->flags);
    put32(bytes + 40U, event->primary);
    put32(bytes + 44U, event->secondary);
    put64(bytes + 48U, event->payload);
    put32(bytes + 56U, event->source_profile);
    put32(bytes + 60U, event->reserved0);
}

static cadr_audio_status total_frames_for_duration(
    uint32_t duration_us, uint64_t *out_total_frames)
{
    const uint64_t rounding = UINT64_C(999999);
    uint64_t product;
    if (duration_us == 0U || out_total_frames == NULL ||
        (uint64_t)duration_us > (UINT64_MAX - rounding) / CADR_AUDIO_SAMPLE_RATE) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    product = (uint64_t)duration_us * CADR_AUDIO_SAMPLE_RATE;
    *out_total_frames = (product + rounding) / UINT64_C(1000000);
    return *out_total_frames == 0U ? CADR_AUDIO_STATUS_OVERFLOW :
        CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_event_validate(
    const uint8_t bytes[CADR_AUDIO_CANONICAL_EVENT_BYTES])
{
    const uint32_t kind = bytes == NULL ? 0U : get32(bytes + 28U);
    if (bytes == NULL || get64(bytes + 8U) == 0U || get32(bytes + 60U) != 0U) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (kind == CADR_AUDIO_EVENT_BEEP) {
        uint64_t total_frames = 0U;
        const uint32_t duration_us = get32(bytes + 44U);
        const uint64_t frame_offset = get64(bytes + 48U);
        uint64_t remaining;
        uint32_t expected_frames;
        if (total_frames_for_duration(duration_us, &total_frames) !=
                CADR_AUDIO_STATUS_OK ||
            frame_offset >= total_frames ||
            frame_offset % CADR_AUDIO_FRAMES_PER_PACKET != 0U) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
        remaining = total_frames - frame_offset;
        expected_frames = remaining > CADR_AUDIO_FRAMES_PER_PACKET ?
            CADR_AUDIO_FRAMES_PER_PACKET : (uint32_t)remaining;
        if (get32(bytes + 32U) != expected_frames ||
            get32(bytes + 56U) != CADR_AUDIO_SOURCE_BEEPER_303 ||
            get32(bytes + 36U) != (CADR_AUDIO_EVENT_SYNTHETIC |
                                    CADR_AUDIO_EVENT_WAVEFORM_NOT_READY) ||
            get32(bytes + 40U) == 0U) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
        return CADR_AUDIO_STATUS_OK;
    }
    if (kind == CADR_AUDIO_EVENT_VOTRAX_UART) {
        const uint32_t source = get32(bytes + 56U);
        const uint32_t format = get32(bytes + 44U);
        if (get32(bytes + 32U) != 0U || get64(bytes + 48U) != UINT64_C(300) ||
            get32(bytes + 40U) > UINT32_C(255) ||
            (source != CADR_AUDIO_SOURCE_VOTRAX_303 &&
             source != CADR_AUDIO_SOURCE_VOTRAX_S46) ||
            (format != CADR_AUDIO_UART_8E2 && format != CADR_AUDIO_UART_7E1) ||
            ((source == CADR_AUDIO_SOURCE_VOTRAX_303 &&
              format != CADR_AUDIO_UART_8E2) ||
             (source == CADR_AUDIO_SOURCE_VOTRAX_S46 &&
              format != CADR_AUDIO_UART_7E1)) ||
            get32(bytes + 36U) != (CADR_AUDIO_EVENT_SYNTHETIC |
                                    CADR_AUDIO_EVENT_UART)) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
        return CADR_AUDIO_STATUS_OK;
    }
    return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
}

static void witness_initial(uint64_t generation,
                            uint8_t witness[CADR_AUDIO_WITNESS_BYTES])
{
    static const uint8_t domain[] = "CDRAUDW1";
    cadr_audio_sha256 hash;
    uint8_t header[16];
    put32(header, CADR_AUDIO_ABI_MAJOR);
    put32(header + 4U, CADR_AUDIO_ABI_MINOR);
    put64(header + 8U, generation);
    sha256_initialize(&hash);
    sha256_update(&hash, domain, sizeof(domain) - 1U);
    sha256_update(&hash, header, sizeof(header));
    sha256_finish(&hash, witness);
}

static void witness_step(const uint8_t previous[CADR_AUDIO_WITNESS_BYTES],
                         const uint8_t event[CADR_AUDIO_CANONICAL_EVENT_BYTES],
                         uint8_t witness[CADR_AUDIO_WITNESS_BYTES])
{
    static const uint8_t domain[] = "CDRAUDW1";
    cadr_audio_sha256 hash;
    sha256_initialize(&hash);
    sha256_update(&hash, domain, sizeof(domain) - 1U);
    sha256_update(&hash, previous, CADR_AUDIO_WITNESS_BYTES);
    sha256_update(&hash, event, CADR_AUDIO_CANONICAL_EVENT_BYTES);
    sha256_finish(&hash, witness);
}

static int renderer_valid(uint32_t renderer_profile)
{
    return renderer_profile == CADR_AUDIO_RENDERER_NO_AUDIO ||
        renderer_profile == CADR_AUDIO_RENDERER_USIM_SDL3_SINE;
}

static uint32_t queue_index(const cadr_audio_model *model, uint32_t offset)
{
    return (model->head + offset) % CADR_AUDIO_QUEUE_PACKETS;
}

static int model_self_valid(const cadr_audio_model *model)
{
    return model != NULL && model->self_address_token != 0U &&
        model->self_address_token == (uintptr_t)(const void *)model;
}

static int authority_self_valid(const cadr_audio_authority *authority)
{
    const cadr_audio_incarnation_allocator *allocator;
    uint32_t slot;
    if (authority == NULL || authority->self_address_token == 0U ||
        authority->self_address_token !=
            (uintptr_t)(const void *)authority) {
        return 0;
    }
    allocator = authority->incarnation_allocator;
    slot = authority->incarnation_slot;
    return allocator != NULL &&
        allocator->self_address_token ==
            (uintptr_t)(const void *)allocator &&
        allocator->lifecycle == CADR_AUDIO_INCARNATION_ALLOCATOR_LIVE &&
        slot < CADR_AUDIO_INCARNATION_SLOTS &&
        allocator->authority_active[slot] == UINT8_C(1) &&
        allocator->authority_addresses[slot] ==
            authority->self_address_token &&
        allocator->authority_incarnations[slot] ==
            authority->incarnation;
}

static int authority_valid(const cadr_audio_model *model)
{
    return model_self_valid(model) && model->authority != NULL &&
        authority_self_valid(model->authority) &&
        model->authority->lifecycle == CADR_AUDIO_AUTHORITY_LIVE &&
        model->authority->attached == 1U &&
        model->authority->owner == model &&
        model->authority->identity != 0U &&
        model->authority->incarnation != 0U &&
        model->authority->consumer_epoch != 0U;
}

static int stream_position_valid(const cadr_audio_model *model)
{
    const cadr_audio_event *head_event;
    const cadr_audio_event *tail;
    if (!authority_valid(model) ||
        model->next_sequence !=
            model->authority->accepted_sequence_high_water ||
        model->head_sequence > model->next_sequence ||
        model->next_sequence - model->head_sequence != model->count) {
        return 0;
    }
    if (model->count == 0U) return 1;
    head_event = &model->queue[model->head];
    tail = &model->queue[queue_index(model, model->count - 1U)];
    return head_event->sequence == model->head_sequence &&
        tail->sequence != UINT64_MAX &&
        model->next_sequence == tail->sequence + UINT64_C(1);
}

static cadr_audio_status cursor_current(const cadr_audio_model *model,
                                        const cadr_audio_cursor *cursor)
{
    cadr_audio_event event;
    uint8_t encoded[CADR_AUDIO_CANONICAL_EVENT_BYTES];
    if (model == NULL || cursor == NULL) return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    if (!stream_position_valid(model) ||
        cursor->generation != model->generation ||
        cursor->authority_identity != model->authority->identity ||
        cursor->authority_address_token !=
            (uintptr_t)(void *)model->authority ||
        cursor->authority_incarnation != model->authority->incarnation ||
        cursor->consumer_epoch != model->authority->consumer_epoch) {
        return CADR_AUDIO_STATUS_STALE;
    }
    if (model->count == 0U) return CADR_AUDIO_STATUS_EMPTY;
    event = model->queue[model->head];
    cadr_audio_event_encode(&event, encoded);
    if (cursor->sequence != event.sequence ||
        cursor->frame_offset != model->head_frame_offset ||
        cursor->frames_remaining != event.frame_count - model->head_frame_offset ||
        memcmp(cursor->event, encoded, sizeof(encoded)) != 0) {
        return CADR_AUDIO_STATUS_STALE;
    }
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_authority_initialize(
    cadr_audio_authority *authority,
    cadr_audio_incarnation_allocator *incarnation_allocator,
    uint64_t identity,
    uint64_t consumer_epoch, uint64_t accepted_sequence_high_water)
{
    static const cadr_audio_authority zero_authority = { 0 };
    uint64_t incarnation;
    uint32_t slot;
    if (authority == NULL || incarnation_allocator == NULL ||
        identity == 0U || consumer_epoch == 0U ||
        incarnation_allocator->self_address_token !=
            (uintptr_t)(void *)incarnation_allocator ||
        incarnation_allocator->lifecycle !=
            CADR_AUDIO_INCARNATION_ALLOCATOR_LIVE) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (memcmp(authority, &zero_authority, sizeof(*authority)) != 0) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (incarnation_allocator->next_incarnation == UINT64_MAX) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    for (slot = 0U; slot < CADR_AUDIO_INCARNATION_SLOTS; ++slot) {
        if (incarnation_allocator->authority_active[slot] == 0U) break;
    }
    if (slot == CADR_AUDIO_INCARNATION_SLOTS) {
        return CADR_AUDIO_STATUS_BACKPRESSURE;
    }
    incarnation = incarnation_allocator->next_incarnation;
    incarnation_allocator->next_incarnation += UINT64_C(1);
    incarnation_allocator->authority_addresses[slot] =
        (uintptr_t)(void *)authority;
    incarnation_allocator->authority_incarnations[slot] = incarnation;
    incarnation_allocator->authority_active[slot] = UINT8_C(1);
    authority->identity = identity;
    authority->consumer_epoch = consumer_epoch;
    authority->accepted_sequence_high_water =
        accepted_sequence_high_water;
    authority->incarnation = incarnation;
    authority->self_address_token = (uintptr_t)(void *)authority;
    authority->incarnation_allocator = incarnation_allocator;
    authority->incarnation_slot = slot;
    authority->lifecycle = CADR_AUDIO_AUTHORITY_LIVE;
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_incarnation_allocator_initialize(
    cadr_audio_incarnation_allocator *allocator,
    uint64_t first_incarnation)
{
    static const cadr_audio_incarnation_allocator zero_allocator = { 0 };
    if (allocator == NULL || first_incarnation == 0U ||
        memcmp(allocator, &zero_allocator, sizeof(*allocator)) != 0) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    allocator->next_incarnation = first_incarnation;
    allocator->self_address_token = (uintptr_t)(void *)allocator;
    allocator->lifecycle = CADR_AUDIO_INCARNATION_ALLOCATOR_LIVE;
    return CADR_AUDIO_STATUS_OK;
}

static void model_semantic_initialize(cadr_audio_model *model,
                                      cadr_audio_authority *authority,
                                      uint64_t generation,
                                      uint32_t renderer_profile)
{
    (void)memset(model, 0, sizeof(*model));
    model->self_address_token = (uintptr_t)(void *)model;
    model->authority = authority;
    model->generation = generation == 0U ? UINT64_C(1) : generation;
    if (authority != NULL) {
        model->head_sequence = authority->accepted_sequence_high_water;
        model->next_sequence = authority->accepted_sequence_high_water;
    }
    model->renderer_profile = renderer_valid(renderer_profile) ? renderer_profile :
        CADR_AUDIO_RENDERER_NO_AUDIO;
    witness_initial(model->generation, model->witness);
    (void)memcpy(model->head_witness, model->witness,
                 CADR_AUDIO_WITNESS_BYTES);
}

cadr_audio_status cadr_audio_authority_destroy(
    cadr_audio_authority *authority)
{
    if (authority == NULL ||
        !authority_self_valid(authority) ||
        authority->lifecycle != CADR_AUDIO_AUTHORITY_LIVE ||
        authority->attached != 0U || authority->owner != NULL) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    authority->incarnation_allocator->
        authority_active[authority->incarnation_slot] = UINT8_C(0);
    authority->lifecycle = CADR_AUDIO_AUTHORITY_RETIRED;
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_initialize(
    cadr_audio_model *model, cadr_audio_authority *authority,
    uint64_t generation, uint32_t renderer_profile)
{
    static const cadr_audio_model zero_model = { 0 };
    if (model == NULL || authority == NULL ||
        memcmp(model, &zero_model, sizeof(*model)) != 0 ||
        !authority_self_valid(authority) ||
        authority->lifecycle != CADR_AUDIO_AUTHORITY_LIVE ||
        authority->attached != 0U || authority->owner != NULL ||
        authority->identity == 0U || authority->consumer_epoch == 0U) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    authority->attached = 1U;
    authority->owner = model;
    model_semantic_initialize(model, authority, generation, renderer_profile);
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_destroy(cadr_audio_model *model)
{
    cadr_audio_authority *authority;
    if (!authority_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    authority = model->authority;
    authority->attached = 0U;
    authority->owner = NULL;
    (void)memset(model, 0, sizeof(*model));
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_reset(cadr_audio_model *model)
{
    uint32_t renderer_profile;
    uint64_t generation;
    cadr_audio_authority *authority;
    if (!model_self_valid(model)) return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    if (!authority_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    renderer_profile = model->renderer_profile;
    generation = model->generation;
    authority = model->authority;
    if (generation == UINT64_MAX ||
        authority->consumer_epoch == UINT64_MAX) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    authority->consumer_epoch += UINT64_C(1);
    model_semantic_initialize(model, authority,
                              generation + UINT64_C(1),
                              renderer_profile);
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_start_consumer_session(
    cadr_audio_model *model)
{
    if (!authority_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->authority->consumer_epoch == UINT64_MAX) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    model->authority->consumer_epoch += UINT64_C(1);
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_begin_slot(cadr_audio_model *model,
                                              uint64_t post_slot)
{
    if (!model_self_valid(model) ||
        !renderer_valid(model->renderer_profile) ||
        !stream_position_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->count == CADR_AUDIO_QUEUE_PACKETS ||
        model->pending_active != 0U) {
        return CADR_AUDIO_STATUS_BACKPRESSURE;
    }
    if ((model->slot_open != 0U && post_slot <= model->active_post_slot) ||
        (model->have_last != 0U && post_slot < model->last_post_slot)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    model->active_post_slot = post_slot;
    model->slot_open = 1U;
    return CADR_AUDIO_STATUS_OK;
}

static cadr_audio_status append_event(cadr_audio_model *model,
                                      cadr_audio_event *event)
{
    uint8_t encoded[CADR_AUDIO_CANONICAL_EVENT_BYTES];
    uint8_t next_witness[CADR_AUDIO_WITNESS_BYTES];
    uint32_t index;
    if (model == NULL || event == NULL || model->slot_open == 0U ||
        model->count >= CADR_AUDIO_QUEUE_PACKETS) {
        return model != NULL && model->count >= CADR_AUDIO_QUEUE_PACKETS ?
            CADR_AUDIO_STATUS_BACKPRESSURE : CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (!stream_position_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->next_sequence == UINT64_MAX ||
        (model->have_last != 0U && model->active_post_slot < model->last_post_slot)) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    event->sequence = model->next_sequence;
    event->generation = model->generation;
    event->post_slot = model->active_post_slot;
    if (model->have_last != 0U && event->post_slot == model->last_post_slot) {
        if (model->last_intra_slot == UINT32_MAX) return CADR_AUDIO_STATUS_OVERFLOW;
        event->intra_slot = model->last_intra_slot + 1U;
    } else {
        event->intra_slot = 0U;
    }
    cadr_audio_event_encode(event, encoded);
    if (cadr_audio_event_validate(encoded) != CADR_AUDIO_STATUS_OK) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    witness_step(model->witness, encoded, next_witness);
    index = queue_index(model, model->count);
    model->queue[index] = *event;
    model->count += 1U;
    model->queued_frames += event->frame_count;
    model->next_sequence += UINT64_C(1);
    model->authority->accepted_sequence_high_water += UINT64_C(1);
    model->last_post_slot = event->post_slot;
    model->last_intra_slot = event->intra_slot;
    model->have_last = 1U;
    (void)memcpy(model->witness, next_witness, sizeof(next_witness));
    return CADR_AUDIO_STATUS_OK;
}

static void clear_pending_job(cadr_audio_model *model)
{
    model->pending_active = 0U;
    model->pending_half_wavelength_us = 0U;
    model->pending_duration_us = 0U;
    model->pending_total_frames = 0U;
    model->pending_next_frame = 0U;
    model->pending_post_slot = 0U;
}

static cadr_audio_status pump_pending_job(cadr_audio_model *model)
{
    while (model->pending_active != 0U &&
           model->count < CADR_AUDIO_QUEUE_PACKETS) {
        cadr_audio_event event;
        const uint64_t remaining =
            model->pending_total_frames - model->pending_next_frame;
        cadr_audio_status status;
        (void)memset(&event, 0, sizeof(event));
        event.kind = CADR_AUDIO_EVENT_BEEP;
        event.frame_count = remaining > CADR_AUDIO_FRAMES_PER_PACKET ?
            CADR_AUDIO_FRAMES_PER_PACKET : (uint32_t)remaining;
        event.flags = CADR_AUDIO_EVENT_SYNTHETIC |
            CADR_AUDIO_EVENT_WAVEFORM_NOT_READY;
        event.primary = model->pending_half_wavelength_us;
        event.secondary = model->pending_duration_us;
        event.payload = model->pending_next_frame;
        event.source_profile = CADR_AUDIO_SOURCE_BEEPER_303;
        status = append_event(model, &event);
        if (status != CADR_AUDIO_STATUS_OK) return status;
        model->pending_next_frame += event.frame_count;
        if (model->pending_next_frame == model->pending_total_frames) {
            clear_pending_job(model);
        }
    }
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_accept_beep_job(
    cadr_audio_model *model, uint64_t post_slot,
    uint32_t half_wavelength_us, uint32_t duration_us)
{
    cadr_audio_model before;
    cadr_audio_authority authority_before;
    uint64_t total_frames = 0U;
    uint64_t packet_count;
    cadr_audio_status status;
    if (!model_self_valid(model) || half_wavelength_us == 0U ||
        duration_us == 0U || !renderer_valid(model->renderer_profile) ||
        !authority_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->pending_active != 0U ||
        model->count == CADR_AUDIO_QUEUE_PACKETS) {
        return CADR_AUDIO_STATUS_BACKPRESSURE;
    }
    if ((model->slot_open != 0U && post_slot <= model->active_post_slot) ||
        (model->have_last != 0U && post_slot <= model->last_post_slot)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    status = total_frames_for_duration(duration_us, &total_frames);
    if (status != CADR_AUDIO_STATUS_OK) return status;
    packet_count =
        (total_frames + CADR_AUDIO_FRAMES_PER_PACKET - UINT64_C(1)) /
        CADR_AUDIO_FRAMES_PER_PACKET;
    if (packet_count > UINT64_MAX - model->next_sequence ||
        packet_count - UINT64_C(1) > UINT32_MAX) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    before = *model;
    authority_before = *model->authority;
    model->active_post_slot = post_slot;
    model->slot_open = 1U;
    model->pending_active = 1U;
    model->pending_half_wavelength_us = half_wavelength_us;
    model->pending_duration_us = duration_us;
    model->pending_total_frames = total_frames;
    model->pending_next_frame = 0U;
    model->pending_post_slot = post_slot;
    status = pump_pending_job(model);
    if (status != CADR_AUDIO_STATUS_OK) {
        *model->authority = authority_before;
        *model = before;
        return status;
    }
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_enqueue_votrax(cadr_audio_model *model,
                                                  uint32_t source_profile,
                                                  uint32_t serial_byte)
{
    cadr_audio_event event;
    if (!model_self_valid(model) || model->slot_open == 0U ||
        (source_profile != CADR_AUDIO_SOURCE_VOTRAX_303 &&
         source_profile != CADR_AUDIO_SOURCE_VOTRAX_S46) ||
        serial_byte > UINT32_C(255)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->pending_active != 0U) {
        return CADR_AUDIO_STATUS_BACKPRESSURE;
    }
    (void)memset(&event, 0, sizeof(event));
    event.kind = CADR_AUDIO_EVENT_VOTRAX_UART;
    event.flags = CADR_AUDIO_EVENT_SYNTHETIC | CADR_AUDIO_EVENT_UART;
    event.primary = serial_byte;
    event.secondary = source_profile == CADR_AUDIO_SOURCE_VOTRAX_303 ?
        CADR_AUDIO_UART_8E2 : CADR_AUDIO_UART_7E1;
    event.payload = UINT64_C(300);
    event.source_profile = source_profile;
    return append_event(model, &event);
}

cadr_audio_status cadr_audio_model_peek(const cadr_audio_model *model,
                                        cadr_audio_cursor *out_cursor)
{
    const cadr_audio_event *event;
    if (out_cursor != NULL) (void)memset(out_cursor, 0, sizeof(*out_cursor));
    if (model == NULL || out_cursor == NULL) return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    if (!stream_position_valid(model)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->count == 0U) return CADR_AUDIO_STATUS_EMPTY;
    event = &model->queue[model->head];
    out_cursor->generation = model->generation;
    out_cursor->authority_identity = model->authority->identity;
    out_cursor->authority_address_token =
        (uintptr_t)(void *)model->authority;
    out_cursor->authority_incarnation = model->authority->incarnation;
    out_cursor->consumer_epoch = model->authority->consumer_epoch;
    out_cursor->sequence = event->sequence;
    out_cursor->frame_offset = model->head_frame_offset;
    out_cursor->frames_remaining = event->frame_count - model->head_frame_offset;
    cadr_audio_event_encode(event, out_cursor->event);
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_copy(const cadr_audio_model *model,
                                        const cadr_audio_cursor *cursor,
                                        uint8_t *bytes, uint64_t capacity,
                                        uint64_t *written)
{
    cadr_audio_status status;
    if (written != NULL) *written = 0U;
    if (model == NULL || cursor == NULL || bytes == NULL || written == NULL) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (capacity < CADR_AUDIO_CANONICAL_EVENT_BYTES) return CADR_AUDIO_STATUS_WRONG_LENGTH;
    status = cursor_current(model, cursor);
    if (status != CADR_AUDIO_STATUS_OK) return status;
    (void)memmove(bytes, cursor->event, CADR_AUDIO_CANONICAL_EVENT_BYTES);
    *written = CADR_AUDIO_CANONICAL_EVENT_BYTES;
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_ack(cadr_audio_model *model,
                                       const cadr_audio_cursor *cursor,
                                       uint32_t frames)
{
    cadr_audio_status status = cursor_current(model, cursor);
    cadr_audio_model before;
    cadr_audio_authority authority_before;
    cadr_audio_event *event;
    if (status != CADR_AUDIO_STATUS_OK) return status;
    before = *model;
    authority_before = *model->authority;
    event = &model->queue[model->head];
    if ((event->frame_count == 0U && frames != 0U) ||
        (event->frame_count != 0U && (frames == 0U ||
         frames > event->frame_count - model->head_frame_offset))) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (event->frame_count == 0U ||
        frames == event->frame_count - model->head_frame_offset) {
        uint8_t encoded[CADR_AUDIO_CANONICAL_EVENT_BYTES];
        uint8_t next_head_witness[CADR_AUDIO_WITNESS_BYTES];
        if (model->head_sequence == UINT64_MAX) {
            return CADR_AUDIO_STATUS_OVERFLOW;
        }
        cadr_audio_event_encode(event, encoded);
        witness_step(model->head_witness, encoded, next_head_witness);
        model->queued_frames -= event->frame_count - model->head_frame_offset;
        model->head = (model->head + 1U) % CADR_AUDIO_QUEUE_PACKETS;
        model->count -= 1U;
        model->head_frame_offset = 0U;
        model->head_sequence += UINT64_C(1);
        (void)memcpy(model->head_witness, next_head_witness,
                     CADR_AUDIO_WITNESS_BYTES);
        status = pump_pending_job(model);
        if (status != CADR_AUDIO_STATUS_OK) {
            *model->authority = authority_before;
            *model = before;
            return status;
        }
    } else {
        model->queued_frames -= frames;
        model->head_frame_offset += frames;
    }
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_render_pcm_s16le(
    const cadr_audio_model *model, const cadr_audio_cursor *cursor,
    int16_t *samples, uint32_t sample_capacity, uint32_t *frames_written)
{
    cadr_audio_status status;
    (void)samples;
    (void)sample_capacity;
    if (frames_written != NULL) *frames_written = 0U;
    if (model == NULL || cursor == NULL || frames_written == NULL) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    status = cursor_current(model, cursor);
    if (status != CADR_AUDIO_STATUS_OK) return status;
    return CADR_AUDIO_STATUS_NOT_READY;
}

void cadr_audio_model_witness_copy(const cadr_audio_model *model,
                                   uint8_t witness[CADR_AUDIO_WITNESS_BYTES])
{
    if (!model_self_valid(model) || witness == NULL) return;
    (void)memcpy(witness, model->witness, CADR_AUDIO_WITNESS_BYTES);
}

void cadr_audio_model_head_witness_copy(
    const cadr_audio_model *model,
    uint8_t witness[CADR_AUDIO_WITNESS_BYTES])
{
    if (!model_self_valid(model) || witness == NULL) return;
    (void)memcpy(witness, model->head_witness, CADR_AUDIO_WITNESS_BYTES);
}

cadr_audio_status cadr_audio_model_verify_witness(
    const cadr_audio_model *model)
{
    uint8_t recomputed[CADR_AUDIO_WITNESS_BYTES];
    uint8_t next[CADR_AUDIO_WITNESS_BYTES];
    uint64_t queued_frames = 0U;
    uint32_t index;
    if (!model_self_valid(model) || model->generation == 0U ||
        !authority_valid(model) ||
        !renderer_valid(model->renderer_profile) ||
        model->head >= CADR_AUDIO_QUEUE_PACKETS ||
        model->count > CADR_AUDIO_QUEUE_PACKETS ||
        model->have_last > 1U || model->slot_open > 1U ||
        model->pending_active > 1U) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    (void)memcpy(recomputed, model->head_witness, sizeof(recomputed));
    for (index = 0U; index < model->count; ++index) {
        const cadr_audio_event *event =
            &model->queue[queue_index(model, index)];
        uint8_t encoded[CADR_AUDIO_CANONICAL_EVENT_BYTES];
        cadr_audio_event_encode(event, encoded);
        if (cadr_audio_event_validate(encoded) != CADR_AUDIO_STATUS_OK ||
            event->generation != model->generation) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
        if (index != 0U) {
            const cadr_audio_event *previous =
                &model->queue[queue_index(model, index - 1U)];
            if (event->sequence != previous->sequence + UINT64_C(1) ||
                event->post_slot < previous->post_slot ||
                (event->post_slot == previous->post_slot &&
                 (previous->intra_slot == UINT32_MAX ||
                  event->intra_slot != previous->intra_slot + 1U)) ||
                (event->post_slot != previous->post_slot &&
                 event->intra_slot != 0U)) {
                return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
            }
        }
        if (index == 0U) {
            if ((event->frame_count == 0U &&
                 model->head_frame_offset != 0U) ||
                (event->frame_count != 0U &&
                 model->head_frame_offset >= event->frame_count)) {
                return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
            }
            queued_frames += event->frame_count -
                model->head_frame_offset;
        } else {
            queued_frames += event->frame_count;
        }
        witness_step(recomputed, encoded, next);
        (void)memcpy(recomputed, next, sizeof(recomputed));
    }
    if (!stream_position_valid(model) ||
        (model->count == 0U && model->head_frame_offset != 0U) ||
        queued_frames != model->queued_frames ||
        memcmp(recomputed, model->witness, sizeof(recomputed)) != 0) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    if (model->count != 0U) {
        const cadr_audio_event *tail =
            &model->queue[queue_index(model, model->count - 1U)];
        if (model->have_last == 0U ||
            model->last_post_slot != tail->post_slot ||
            model->last_intra_slot != tail->intra_slot) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
    }
    if (model->pending_active != 0U) {
        uint64_t total_frames = 0U;
        uint64_t expected_offset = 0U;
        uint32_t pending_packets = 0U;
        if (model->count != CADR_AUDIO_QUEUE_PACKETS ||
            model->pending_half_wavelength_us == 0U ||
            total_frames_for_duration(model->pending_duration_us,
                                      &total_frames) !=
                CADR_AUDIO_STATUS_OK ||
            total_frames != model->pending_total_frames ||
            model->pending_next_frame == 0U ||
            model->pending_next_frame >= total_frames ||
            model->pending_next_frame % CADR_AUDIO_FRAMES_PER_PACKET != 0U ||
            model->pending_post_slot != model->active_post_slot ||
            model->slot_open == 0U) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
        for (index = 0U; index < model->count; ++index) {
            const cadr_audio_event *event =
                &model->queue[queue_index(model, index)];
            if (event->post_slot == model->pending_post_slot) {
                if (event->kind != CADR_AUDIO_EVENT_BEEP ||
                    event->primary != model->pending_half_wavelength_us ||
                    event->secondary != model->pending_duration_us ||
                    event->payload != expected_offset ||
                    event->frame_count != CADR_AUDIO_FRAMES_PER_PACKET) {
                    return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
                }
                expected_offset += event->frame_count;
                pending_packets += 1U;
            } else if (pending_packets != 0U ||
                       event->post_slot > model->pending_post_slot) {
                return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
            }
        }
        if (pending_packets == 0U ||
            expected_offset != model->pending_next_frame) {
            return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
        }
    } else if (model->pending_half_wavelength_us != 0U ||
               model->pending_duration_us != 0U ||
               model->pending_total_frames != 0U ||
               model->pending_next_frame != 0U ||
               model->pending_post_slot != 0U) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    return CADR_AUDIO_STATUS_OK;
}

cadr_audio_status cadr_audio_model_adopt_semantic_state(
    cadr_audio_model *destination, const cadr_audio_model *decoded)
{
    cadr_audio_model before;
    cadr_audio_authority *authority;
    cadr_audio_status status;
    if (destination == NULL || decoded == NULL ||
        !authority_valid(destination)) {
        return CADR_AUDIO_STATUS_INVALID_ARGUMENT;
    }
    authority = destination->authority;
    if (authority->consumer_epoch == UINT64_MAX) {
        return CADR_AUDIO_STATUS_OVERFLOW;
    }
    before = *destination;
    *destination = *decoded;
    destination->self_address_token =
        (uintptr_t)(void *)destination;
    destination->authority = authority;
    status = cadr_audio_model_verify_witness(destination);
    if (status != CADR_AUDIO_STATUS_OK) {
        *destination = before;
        return status;
    }
    authority->consumer_epoch += UINT64_C(1);
    return CADR_AUDIO_STATUS_OK;
}
