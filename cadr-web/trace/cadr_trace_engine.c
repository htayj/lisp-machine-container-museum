/*
 * Bounded CDRGTRC1 producer.  The raw ring is an observation projection; the
 * semantic chain is held separately and never changes when records are drained.
 */

#include "cadr_trace_engine.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define CADR_TRACE_HEADER_BYTES UINT32_C(256)
#define CADR_TRACE_RECORD_ENVELOPE_BYTES UINT32_C(48)
#define CADR_TRACE_TLV_HEADER_BYTES UINT32_C(8)
#define CADR_TRACE_SHA256_BYTES UINT32_C(32)

#define CADR_TRACE_KIND_BOUNDARY UINT16_C(1)
#define CADR_TRACE_KIND_EVENT UINT16_C(2)
#define CADR_TRACE_KIND_TERMINAL UINT16_C(3)
#define CADR_TRACE_KIND_INITIAL UINT16_C(4)

#define CADR_TRACE_TLV_STATE UINT16_C(100)
#define CADR_TRACE_TLV_PREVIOUS UINT16_C(101)
#define CADR_TRACE_TLV_SEMANTIC UINT16_C(102)
#define CADR_TRACE_TLV_EVENT_CODE UINT16_C(110)
#define CADR_TRACE_TLV_EVENT_BYTES UINT16_C(111)
#define CADR_TRACE_TLV_EVENT_DIGEST UINT16_C(112)
#define CADR_TRACE_TLV_FINAL_COUNT UINT16_C(120)
#define CADR_TRACE_TLV_REASON UINT16_C(121)
#define CADR_TRACE_TLV_FINAL_STATE UINT16_C(122)

typedef struct cadr_trace_sha256 {
    uint32_t state[8];
    uint64_t bit_count;
    uint8_t block[64];
    uint32_t block_used;
} cadr_trace_sha256;

typedef struct cadr_trace_tlv {
    uint16_t type;
    const uint8_t *value;
    uint32_t byte_count;
} cadr_trace_tlv;

struct cadr_trace_engine {
    uint64_t first_boundary;
    uint64_t selector_mask;
    uint64_t event_mask;
    uint32_t transport_mode;
    uint8_t profile_sha256[CADR_TRACE_SHA256_BYTES];
    uint8_t artifact_set_sha256[CADR_TRACE_SHA256_BYTES];
    uint8_t initial_state_sha256[CADR_TRACE_SHA256_BYTES];
    uint8_t input_schedule_sha256[CADR_TRACE_SHA256_BYTES];
    uint8_t semantic_seed[CADR_TRACE_SHA256_BYTES];
    uint8_t semantic_previous[CADR_TRACE_SHA256_BYTES];
    uint64_t record_count;
    uint64_t boundary_count;
    uint64_t last_boundary;
    uint64_t last_cycle;
    uint16_t last_boundary_flags;
    uint16_t reserved_flags;
    uint32_t capacity;
    uint32_t ring_head;
    uint32_t ring_count;
    uint32_t reserved_boundary;
    uint32_t reserved_clock;
    uint32_t reserved_interrupt;
    uint32_t reserved_device;
    uint32_t reserved_fault;
    uint32_t reserved_halt;
    uint32_t pending_device_transaction_count;
    uint32_t slot_open;
    uint32_t slot_boundary_recorded;
    uint32_t slot_closing;
    uint32_t finished;
    uint32_t halt_event_recorded;
    cadr_trace_device_transaction pending_device_transactions[CADR_TRACE_MAX_DEVICE_TRANSACTIONS];
    uint32_t *record_lengths;
    uint8_t *record_bytes;
};

_Static_assert(offsetof(cadr_trace_device_transaction, error_after) + sizeof(uint32_t) ==
               CADR_TRACE_DEVICE_TRANSACTION_BYTES,
               "CDRGTRC1 normalized transaction field layout");
_Static_assert(4U + CADR_TRACE_MAX_DEVICE_TRANSACTIONS *
               CADR_TRACE_DEVICE_TRANSACTION_BYTES + 512U <=
               CADR_TRACE_MAX_RECORD_BYTES,
               "fixed-64 transaction list fits boundary and event records");

static uint32_t cadr_trace_rotr32(const uint32_t value, const uint32_t count)
{
    return (value >> count) | (value << (UINT32_C(32) - count));
}

static void cadr_trace_sha256_transform(cadr_trace_sha256 *context,
                                        const uint8_t block[64])
{
    static const uint32_t constants[64] = {
        UINT32_C(0x428a2f98), UINT32_C(0x71374491), UINT32_C(0xb5c0fbcf), UINT32_C(0xe9b5dba5),
        UINT32_C(0x3956c25b), UINT32_C(0x59f111f1), UINT32_C(0x923f82a4), UINT32_C(0xab1c5ed5),
        UINT32_C(0xd807aa98), UINT32_C(0x12835b01), UINT32_C(0x243185be), UINT32_C(0x550c7dc3),
        UINT32_C(0x72be5d74), UINT32_C(0x80deb1fe), UINT32_C(0x9bdc06a7), UINT32_C(0xc19bf174),
        UINT32_C(0xe49b69c1), UINT32_C(0xefbe4786), UINT32_C(0x0fc19dc6), UINT32_C(0x240ca1cc),
        UINT32_C(0x2de92c6f), UINT32_C(0x4a7484aa), UINT32_C(0x5cb0a9dc), UINT32_C(0x76f988da),
        UINT32_C(0x983e5152), UINT32_C(0xa831c66d), UINT32_C(0xb00327c8), UINT32_C(0xbf597fc7),
        UINT32_C(0xc6e00bf3), UINT32_C(0xd5a79147), UINT32_C(0x06ca6351), UINT32_C(0x14292967),
        UINT32_C(0x27b70a85), UINT32_C(0x2e1b2138), UINT32_C(0x4d2c6dfc), UINT32_C(0x53380d13),
        UINT32_C(0x650a7354), UINT32_C(0x766a0abb), UINT32_C(0x81c2c92e), UINT32_C(0x92722c85),
        UINT32_C(0xa2bfe8a1), UINT32_C(0xa81a664b), UINT32_C(0xc24b8b70), UINT32_C(0xc76c51a3),
        UINT32_C(0xd192e819), UINT32_C(0xd6990624), UINT32_C(0xf40e3585), UINT32_C(0x106aa070),
        UINT32_C(0x19a4c116), UINT32_C(0x1e376c08), UINT32_C(0x2748774c), UINT32_C(0x34b0bcb5),
        UINT32_C(0x391c0cb3), UINT32_C(0x4ed8aa4a), UINT32_C(0x5b9cca4f), UINT32_C(0x682e6ff3),
        UINT32_C(0x748f82ee), UINT32_C(0x78a5636f), UINT32_C(0x84c87814), UINT32_C(0x8cc70208),
        UINT32_C(0x90befffa), UINT32_C(0xa4506ceb), UINT32_C(0xbef9a3f7), UINT32_C(0xc67178f2)
    };
    uint32_t words[64];
    uint32_t a, b, c, d, e, f, g, h, index;
    for (index = 0U; index < 16U; ++index) {
        const uint32_t offset = index * 4U;
        words[index] = ((uint32_t)block[offset] << 24U) |
                       ((uint32_t)block[offset + 1U] << 16U) |
                       ((uint32_t)block[offset + 2U] << 8U) |
                       (uint32_t)block[offset + 3U];
    }
    for (index = 16U; index < 64U; ++index) {
        const uint32_t s0 = cadr_trace_rotr32(words[index - 15U], 7U) ^
            cadr_trace_rotr32(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
        const uint32_t s1 = cadr_trace_rotr32(words[index - 2U], 17U) ^
            cadr_trace_rotr32(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
        words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }
    a = context->state[0]; b = context->state[1]; c = context->state[2]; d = context->state[3];
    e = context->state[4]; f = context->state[5]; g = context->state[6]; h = context->state[7];
    for (index = 0U; index < 64U; ++index) {
        const uint32_t sum1 = cadr_trace_rotr32(e, 6U) ^ cadr_trace_rotr32(e, 11U) ^ cadr_trace_rotr32(e, 25U);
        const uint32_t choose = (e & f) ^ ((~e) & g);
        const uint32_t temporary1 = h + sum1 + choose + constants[index] + words[index];
        const uint32_t sum0 = cadr_trace_rotr32(a, 2U) ^ cadr_trace_rotr32(a, 13U) ^ cadr_trace_rotr32(a, 22U);
        const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const uint32_t temporary2 = sum0 + majority;
        h = g; g = f; f = e; e = d + temporary1;
        d = c; c = b; b = a; a = temporary1 + temporary2;
    }
    context->state[0] += a; context->state[1] += b; context->state[2] += c; context->state[3] += d;
    context->state[4] += e; context->state[5] += f; context->state[6] += g; context->state[7] += h;
}

static void cadr_trace_sha256_init(cadr_trace_sha256 *context)
{
    context->state[0] = UINT32_C(0x6a09e667); context->state[1] = UINT32_C(0xbb67ae85);
    context->state[2] = UINT32_C(0x3c6ef372); context->state[3] = UINT32_C(0xa54ff53a);
    context->state[4] = UINT32_C(0x510e527f); context->state[5] = UINT32_C(0x9b05688c);
    context->state[6] = UINT32_C(0x1f83d9ab); context->state[7] = UINT32_C(0x5be0cd19);
    context->bit_count = 0U;
    context->block_used = 0U;
}

static void cadr_trace_sha256_update(cadr_trace_sha256 *context,
                                     const uint8_t *bytes, uint64_t count)
{
    while (count != 0U) {
        const uint32_t available = UINT32_C(64) - context->block_used;
        const uint32_t take = count < (uint64_t)available ? (uint32_t)count : available;
        (void)memcpy(context->block + context->block_used, bytes, take);
        context->block_used += take;
        context->bit_count += (uint64_t)take * UINT64_C(8);
        bytes += take;
        count -= take;
        if (context->block_used == 64U) {
            cadr_trace_sha256_transform(context, context->block);
            context->block_used = 0U;
        }
    }
}

static void cadr_trace_sha256_final(cadr_trace_sha256 *context,
                                    uint8_t output[CADR_TRACE_SHA256_BYTES])
{
    uint8_t trailer[64];
    uint32_t index;
    const uint64_t bits = context->bit_count;
    trailer[0] = UINT8_C(0x80);
    if (context->block_used < 56U) {
        (void)memset(trailer + 1U, 0, 55U - context->block_used);
        cadr_trace_sha256_update(context, trailer, 56U - context->block_used);
    } else {
        (void)memset(trailer + 1U, 0, 63U - context->block_used);
        cadr_trace_sha256_update(context, trailer, 64U - context->block_used);
        (void)memset(trailer, 0, 56U);
        cadr_trace_sha256_update(context, trailer, 56U);
    }
    for (index = 0U; index < 8U; ++index) trailer[index] = (uint8_t)(bits >> ((7U - index) * 8U));
    cadr_trace_sha256_update(context, trailer, 8U);
    for (index = 0U; index < 8U; ++index) {
        output[index * 4U] = (uint8_t)(context->state[index] >> 24U);
        output[index * 4U + 1U] = (uint8_t)(context->state[index] >> 16U);
        output[index * 4U + 2U] = (uint8_t)(context->state[index] >> 8U);
        output[index * 4U + 3U] = (uint8_t)context->state[index];
    }
}

#ifdef CADR_TRACE_ENGINE_TESTING
static void cadr_trace_sha256_raw(const uint8_t *bytes, uint64_t count,
                                  uint8_t output[CADR_TRACE_SHA256_BYTES])
{
    cadr_trace_sha256 context;
    cadr_trace_sha256_init(&context);
    if (count != 0U) cadr_trace_sha256_update(&context, bytes, count);
    cadr_trace_sha256_final(&context, output);
}

void cadr_trace_engine_test_sha256(const uint8_t *bytes, const uint64_t count,
                                   uint8_t digest[CADR_SHA256_BYTES])
{
    cadr_trace_sha256_raw(bytes, count, digest);
}
#endif

static void cadr_trace_put16(uint8_t output[2], const uint16_t value)
{
    output[0] = (uint8_t)value;
    output[1] = (uint8_t)(value >> 8U);
}

static void cadr_trace_put32(uint8_t output[4], const uint32_t value)
{
    output[0] = (uint8_t)value;
    output[1] = (uint8_t)(value >> 8U);
    output[2] = (uint8_t)(value >> 16U);
    output[3] = (uint8_t)(value >> 24U);
}

static void cadr_trace_put64(uint8_t output[8], const uint64_t value)
{
    uint32_t index;
    for (index = 0U; index < 8U; ++index) output[index] = (uint8_t)(value >> (index * 8U));
}

static uint32_t cadr_trace_crc32c(const uint8_t *bytes, uint32_t count)
{
    uint32_t crc = UINT32_C(0xffffffff);
    uint32_t index;
    for (index = 0U; index < count; ++index) {
        uint32_t bit;
        crc ^= bytes[index];
        for (bit = 0U; bit < 8U; ++bit) {
            crc = (crc >> 1U) ^ ((crc & UINT32_C(1)) != 0U ? UINT32_C(0x82f63b78) : 0U);
        }
    }
    return crc ^ UINT32_C(0xffffffff);
}

static uint32_t cadr_trace_pad8(const uint32_t count)
{
    return (UINT32_C(8) - (count & UINT32_C(7))) & UINT32_C(7);
}

static uint32_t cadr_trace_tlv_size(const cadr_trace_tlv *tlv)
{
    return CADR_TRACE_TLV_HEADER_BYTES + tlv->byte_count +
        cadr_trace_pad8(CADR_TRACE_TLV_HEADER_BYTES + tlv->byte_count);
}

static int cadr_trace_valid_event_class(const uint64_t event_class)
{
    return event_class == CADR_TRACE_EVENT_CLOCK || event_class == CADR_TRACE_EVENT_INTERRUPT ||
        event_class == CADR_TRACE_EVENT_DEVICE || event_class == CADR_TRACE_EVENT_FAULT ||
        event_class == CADR_TRACE_EVENT_HALT;
}

static int cadr_trace_valid_host_operation(const uint32_t operation)
{
    return operation >= CADR_HOST_OPERATION_BLOCK_READ &&
        operation <= CADR_HOST_OPERATION_NETWORK;
}

static int cadr_trace_valid_cadr_status(const uint32_t status)
{
    return status <= CADR_STATUS_HALTED;
}

cadr_status cadr_trace_latches_validate(const cadr_machine_state *state)
{
    const cadr_trace_state *trace;
    const uint32_t destination_valid = CADR_TRACE_LATCH_VALID_DESTINATION;
    const uint32_t class_valid = CADR_TRACE_LATCH_VALID_CLASS_OUTCOME;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    trace = &state->trace;
    if ((trace->valid_mask & ~CADR_TRACE_LATCH_VALID_KNOWN) != 0U ||
        trace->reserved0 != 0U ||
        trace->raw_fetched_word > UINT64_C(0x0000ffffffffffff) ||
        trace->effective_word > UINT64_C(0x0000ffffffffffff) ||
        trace->pre_p0_pc > UINT32_C(0x3fff) ||
        trace->pre_p1_pc > UINT32_C(0x3fff) ||
        trace->pre_next_micro_pc > UINT32_C(0x3fff) ||
        trace->pre_opc > UINT32_C(0x3fff) ||
        trace->post_p0_pc > UINT32_C(0x3fff) ||
        trace->post_p1_pc > UINT32_C(0x3fff) ||
        trace->post_next_micro_pc > UINT32_C(0x3fff) ||
        trace->post_opc > UINT32_C(0x3fff) ||
        trace->a_address > UINT32_C(1023) ||
        trace->m_source_kind > 1U || trace->m_address > 31U ||
        trace->pre_fault > 1U || trace->post_fault > 1U ||
        trace->fault_code > 1U || trace->pre_interrupt_pending > 1U ||
        trace->post_interrupt_pending > 1U || trace->md_delayed_phase > 1U ||
        trace->pre_interrupt_status > UINT16_MAX ||
        trace->post_interrupt_status > UINT16_MAX ||
        trace->pre_interrupt_pending !=
            ((trace->pre_interrupt_status & UINT32_C(0140000)) != 0U ? 1U : 0U) ||
        trace->post_interrupt_pending !=
            ((trace->post_interrupt_status & UINT32_C(0140000)) != 0U ? 1U : 0U) ||
        trace->interrupt_level !=
            (trace->post_interrupt_status & UINT32_C(01774)) ||
        trace->class_outcome > 4U || trace->decoded > 1U ||
        trace->store_selector > 1U || trace->instruction_memory > 1U ||
        trace->functional_m_source > 1U || trace->effective_popj > 1U ||
        trace->last_slot_executed > 1U || trace->last_slot_inhibited > 1U ||
        (trace->last_slot_executed != 0U && trace->last_slot_inhibited != 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if ((trace->valid_mask & destination_valid) == 0U) {
        if (trace->destination_kind != 0U || trace->destination_address != 0U ||
            trace->post_destination_value != 0U) return CADR_STATUS_INVALID_ARGUMENT;
    } else if ((trace->destination_kind != 1U && trace->destination_kind != 2U) ||
               (trace->destination_kind == 1U &&
                trace->destination_address > UINT32_C(1023)) ||
               (trace->destination_kind == 2U &&
                trace->destination_address > UINT32_C(31))) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if ((trace->valid_mask & CADR_TRACE_LATCH_VALID_M_SOURCE) == 0U &&
        (trace->m_source_kind != 0U || trace->m_address != 0U ||
         trace->m_value != 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (((trace->valid_mask & class_valid) == 0U && trace->class_outcome != 0U) ||
        ((trace->valid_mask & class_valid) != 0U && trace->class_outcome == 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return CADR_STATUS_OK;
}

static uint32_t *cadr_trace_reservation_for(cadr_trace_engine *engine,
                                            const uint64_t event_class)
{
    switch (event_class) {
    case CADR_TRACE_EVENT_CLOCK: return &engine->reserved_clock;
    case CADR_TRACE_EVENT_INTERRUPT: return &engine->reserved_interrupt;
    case CADR_TRACE_EVENT_DEVICE: return &engine->reserved_device;
    case CADR_TRACE_EVENT_FAULT: return &engine->reserved_fault;
    case CADR_TRACE_EVENT_HALT: return &engine->reserved_halt;
    default: return NULL;
    }
}

static uint32_t cadr_trace_reserved_count(const cadr_trace_engine *engine)
{
    return engine->reserved_boundary + engine->reserved_clock + engine->reserved_interrupt +
        engine->reserved_device + engine->reserved_fault + engine->reserved_halt;
}

static cadr_status cadr_trace_reserve(cadr_trace_engine *engine, uint32_t *reservation)
{
    const uint64_t outstanding = cadr_trace_reserved_count(engine);
    if (engine->finished != 0U) return CADR_STATUS_NOT_READY;
    /* Every accepted nonterminal reservation must leave room for terminal. */
    if (engine->record_count >= CADR_TRACE_MAX_RECORDS - UINT64_C(1) ||
        outstanding >= (CADR_TRACE_MAX_RECORDS - UINT64_C(1)) -
            engine->record_count) {
        return CADR_STATUS_NOT_READY;
    }
    if (engine->transport_mode == CADR_TRACE_TRANSPORT_FULL &&
        (uint64_t)engine->ring_count + outstanding >= engine->capacity) {
        return CADR_STATUS_NOT_READY;
    }
    *reservation += 1U;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_consume_reservation(uint32_t *reservation)
{
    if (*reservation == 0U) return CADR_STATUS_INVALID_ARGUMENT;
    *reservation -= 1U;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_enqueue(cadr_trace_engine *engine,
                                      const uint8_t *record, uint32_t record_length)
{
    uint32_t slot;
    if (engine->transport_mode == CADR_TRACE_TRANSPORT_HASH_ONLY) {
        return CADR_STATUS_OK;
    }
    if (record_length == 0U || record_length > CADR_TRACE_MAX_RECORD_BYTES ||
        engine->ring_count >= engine->capacity) return CADR_STATUS_NOT_READY;
    slot = (engine->ring_head + engine->ring_count) % engine->capacity;
    (void)memcpy(engine->record_bytes + (size_t)slot * CADR_TRACE_MAX_RECORD_BYTES,
                 record, record_length);
    engine->record_lengths[slot] = record_length;
    engine->ring_count += 1U;
    return CADR_STATUS_OK;
}

static void cadr_trace_hash_domain(cadr_trace_sha256 *context,
                                   const uint8_t *domain, uint32_t domain_length)
{
    cadr_trace_sha256_init(context);
    cadr_trace_sha256_update(context, domain, domain_length);
}

static void cadr_trace_semantic_seed(cadr_trace_engine *engine)
{
    static const uint8_t domain[] = "CDRGHDR1\0";
    cadr_trace_sha256 context;
    uint8_t scalar[8];
    cadr_trace_hash_domain(&context, domain, sizeof(domain) - 1U);
    cadr_trace_sha256_update(&context, engine->profile_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_sha256_update(&context, engine->artifact_set_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_sha256_update(&context, engine->initial_state_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_sha256_update(&context, engine->input_schedule_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_put64(scalar, engine->first_boundary);
    cadr_trace_sha256_update(&context, scalar, sizeof(scalar));
    cadr_trace_put64(scalar, engine->selector_mask);
    cadr_trace_sha256_update(&context, scalar, sizeof(scalar));
    cadr_trace_put64(scalar, engine->event_mask);
    cadr_trace_sha256_update(&context, scalar, sizeof(scalar));
    cadr_trace_sha256_final(&context, engine->semantic_seed);
    (void)memcpy(engine->semantic_previous, engine->semantic_seed, CADR_TRACE_SHA256_BYTES);
}

static cadr_status cadr_trace_encode_tlvs(uint8_t *output, uint32_t capacity,
                                          const cadr_trace_tlv *tlvs, uint32_t count,
                                          uint32_t *written)
{
    uint32_t offset = 0U;
    uint32_t prior_type = 0U;
    uint32_t index;
    if (written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    for (index = 0U; index < count; ++index) {
        const cadr_trace_tlv *tlv = &tlvs[index];
        const uint32_t size = cadr_trace_tlv_size(tlv);
        const uint32_t padding = cadr_trace_pad8(CADR_TRACE_TLV_HEADER_BYTES + tlv->byte_count);
        if (tlv->type == 0U || tlv->type <= prior_type || tlv->value == NULL ||
            size > capacity - offset) return CADR_STATUS_INVALID_ARGUMENT;
        cadr_trace_put16(output + offset, tlv->type);
        cadr_trace_put16(output + offset + 2U, UINT16_C(1));
        cadr_trace_put32(output + offset + 4U, tlv->byte_count);
        (void)memcpy(output + offset + CADR_TRACE_TLV_HEADER_BYTES, tlv->value, tlv->byte_count);
        if (padding != 0U) {
            (void)memset(output + offset + CADR_TRACE_TLV_HEADER_BYTES + tlv->byte_count,
                         0, padding);
        }
        offset += size;
        prior_type = tlv->type;
    }
    *written = offset;
    return CADR_STATUS_OK;
}

static void cadr_trace_record_semantic(const uint8_t previous[CADR_TRACE_SHA256_BYTES],
                                       uint16_t kind, uint16_t flags, uint64_t boundary,
                                       uint64_t cycle, uint64_t selector_mask,
                                       uint32_t event_class,
                                       const uint8_t *encoded_tlvs, uint32_t encoded_tlv_bytes,
                                       uint8_t output[CADR_TRACE_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRGREC1\0";
    cadr_trace_sha256 context;
    uint8_t tuple[32];
    cadr_trace_hash_domain(&context, domain, sizeof(domain) - 1U);
    cadr_trace_sha256_update(&context, previous, CADR_TRACE_SHA256_BYTES);
    cadr_trace_put16(tuple, kind);
    cadr_trace_put16(tuple + 2U, flags);
    cadr_trace_put64(tuple + 4U, boundary);
    cadr_trace_put64(tuple + 12U, cycle);
    cadr_trace_put64(tuple + 20U, selector_mask);
    cadr_trace_put32(tuple + 28U, event_class);
    cadr_trace_sha256_update(&context, tuple, sizeof(tuple));
    cadr_trace_sha256_update(&context, encoded_tlvs, encoded_tlv_bytes);
    cadr_trace_sha256_final(&context, output);
}

static void cadr_trace_event_digest(uint32_t event_class, uint32_t code,
                                    const uint8_t *payload, uint32_t payload_bytes,
                                    uint8_t output[CADR_TRACE_SHA256_BYTES])
{
    static const uint8_t domain[] = "CDRGEVENT1\0";
    cadr_trace_sha256 context;
    uint8_t value[4];
    cadr_trace_hash_domain(&context, domain, sizeof(domain) - 1U);
    cadr_trace_put32(value, event_class);
    cadr_trace_sha256_update(&context, value, sizeof(value));
    cadr_trace_put32(value, code);
    cadr_trace_sha256_update(&context, value, sizeof(value));
    if (payload_bytes != 0U) cadr_trace_sha256_update(&context, payload, payload_bytes);
    cadr_trace_sha256_final(&context, output);
}

static cadr_status cadr_trace_encode_record(uint16_t kind, uint16_t flags,
                                            uint64_t sequence, uint64_t boundary,
                                            uint64_t cycle, uint64_t selector_mask,
                                            uint32_t event_class,
                                            const cadr_trace_tlv *tlvs, uint32_t tlv_count,
                                            uint8_t output[CADR_TRACE_MAX_RECORD_BYTES],
                                            uint32_t *output_bytes)
{
    uint32_t payload_bytes;
    uint32_t padding;
    uint32_t total;
    cadr_status status;
    if (output == NULL || output_bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_trace_encode_tlvs(output + CADR_TRACE_RECORD_ENVELOPE_BYTES,
                                    CADR_TRACE_MAX_RECORD_BYTES - CADR_TRACE_RECORD_ENVELOPE_BYTES - 4U,
                                    tlvs, tlv_count, &payload_bytes);
    if (status != CADR_STATUS_OK) return status;
    padding = cadr_trace_pad8(CADR_TRACE_RECORD_ENVELOPE_BYTES + payload_bytes + 4U);
    total = CADR_TRACE_RECORD_ENVELOPE_BYTES + payload_bytes + padding + 4U;
    if (total > CADR_TRACE_MAX_RECORD_BYTES) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_trace_put32(output, total);
    cadr_trace_put16(output + 4U, kind);
    cadr_trace_put16(output + 6U, flags);
    cadr_trace_put64(output + 8U, sequence);
    cadr_trace_put64(output + 16U, boundary);
    cadr_trace_put64(output + 24U, cycle);
    cadr_trace_put64(output + 32U, selector_mask);
    cadr_trace_put32(output + 40U, event_class);
    cadr_trace_put32(output + 44U, payload_bytes);
    if (padding != 0U) (void)memset(output + CADR_TRACE_RECORD_ENVELOPE_BYTES + payload_bytes, 0, padding);
    cadr_trace_put32(output + total - 4U, cadr_trace_crc32c(output, total - 4U));
    *output_bytes = total;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_emit_nonterminal(cadr_machine_state *state,
                                               cadr_trace_engine *engine,
                                               uint16_t kind, uint16_t flags,
                                               uint64_t boundary, uint64_t cycle,
                                               uint64_t selector_mask, uint32_t event_class,
                                               const cadr_trace_tlv *leading,
                                               uint32_t leading_count,
                                               const cadr_trace_tlv *trailing,
                                               uint32_t trailing_count)
{
    uint8_t state_digest[CADR_TRACE_SHA256_BYTES];
    uint8_t semantic[CADR_TRACE_SHA256_BYTES];
    uint8_t provisional[CADR_TRACE_MAX_RECORD_BYTES];
    uint8_t raw_record[CADR_TRACE_MAX_RECORD_BYTES];
    cadr_trace_tlv semantic_tlvs[20];
    cadr_trace_tlv final_tlvs[21];
    uint32_t provisional_bytes;
    uint32_t index;
    uint32_t record_bytes;
    cadr_status status;

    if (leading_count + trailing_count + 3U >
        (uint32_t)(sizeof(final_tlvs) / sizeof(final_tlvs[0]))) return CADR_STATUS_INVALID_ARGUMENT;
    if ((kind == CADR_TRACE_KIND_INITIAL && engine->record_count != 0U) ||
        (kind != CADR_TRACE_KIND_INITIAL &&
         engine->record_count >= CADR_TRACE_MAX_RECORDS - UINT64_C(1))) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_trace_latches_validate(state);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_state_v2_digest(state, state_digest);
    if (status != CADR_STATUS_OK) return status;
    for (index = 0U; index < leading_count; ++index) semantic_tlvs[index] = leading[index];
    semantic_tlvs[leading_count].type = CADR_TRACE_TLV_STATE;
    semantic_tlvs[leading_count].value = state_digest;
    semantic_tlvs[leading_count].byte_count = CADR_TRACE_SHA256_BYTES;
    semantic_tlvs[leading_count + 1U].type = CADR_TRACE_TLV_PREVIOUS;
    semantic_tlvs[leading_count + 1U].value = engine->semantic_previous;
    semantic_tlvs[leading_count + 1U].byte_count = CADR_TRACE_SHA256_BYTES;
    for (index = 0U; index < trailing_count; ++index) {
        semantic_tlvs[leading_count + 2U + index] = trailing[index];
    }
    status = cadr_trace_encode_tlvs(provisional, sizeof(provisional), semantic_tlvs,
                                    leading_count + trailing_count + 2U, &provisional_bytes);
    if (status != CADR_STATUS_OK) return status;
    cadr_trace_record_semantic(engine->semantic_previous, kind, flags, boundary, cycle,
                               selector_mask, event_class, provisional, provisional_bytes,
                               semantic);
    for (index = 0U; index < leading_count; ++index) final_tlvs[index] = leading[index];
    final_tlvs[leading_count].type = CADR_TRACE_TLV_STATE;
    final_tlvs[leading_count].value = state_digest;
    final_tlvs[leading_count].byte_count = CADR_TRACE_SHA256_BYTES;
    final_tlvs[leading_count + 1U].type = CADR_TRACE_TLV_PREVIOUS;
    final_tlvs[leading_count + 1U].value = engine->semantic_previous;
    final_tlvs[leading_count + 1U].byte_count = CADR_TRACE_SHA256_BYTES;
    final_tlvs[leading_count + 2U].type = CADR_TRACE_TLV_SEMANTIC;
    final_tlvs[leading_count + 2U].value = semantic;
    final_tlvs[leading_count + 2U].byte_count = CADR_TRACE_SHA256_BYTES;
    for (index = 0U; index < trailing_count; ++index) {
        final_tlvs[leading_count + 3U + index] = trailing[index];
    }
    status = cadr_trace_encode_record(kind, flags, engine->record_count, boundary, cycle,
                                      selector_mask, event_class, final_tlvs,
                                      leading_count + trailing_count + 3U,
                                      raw_record, &record_bytes);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_trace_enqueue(engine, raw_record, record_bytes);
    if (status != CADR_STATUS_OK) return status;
    (void)memcpy(engine->semantic_previous, semantic, CADR_TRACE_SHA256_BYTES);
    engine->record_count += UINT64_C(1);
    engine->last_boundary = boundary;
    engine->last_cycle = cycle;
    return CADR_STATUS_OK;
}

static void cadr_trace_transaction_bytes(const cadr_trace_device_transaction *transaction,
                                         uint8_t output[CADR_TRACE_DEVICE_TRANSACTION_BYTES])
{
    cadr_trace_put32(output, transaction->read_write_kind);
    cadr_trace_put32(output + 4U, transaction->address_space);
    cadr_trace_put64(output + 8U, transaction->address);
    cadr_trace_put32(output + 16U, transaction->value);
    cadr_trace_put32(output + 20U, transaction->result);
    cadr_trace_put32(output + 24U, transaction->status);
    cadr_trace_put32(output + 28U, transaction->interrupt_before);
    cadr_trace_put32(output + 32U, transaction->interrupt_after);
    cadr_trace_put32(output + 36U, transaction->error_before);
    cadr_trace_put32(output + 40U, transaction->error_after);
}

static cadr_status cadr_trace_device_list(const cadr_trace_engine *engine,
                                          uint8_t output[4U + CADR_TRACE_MAX_DEVICE_TRANSACTIONS * CADR_TRACE_DEVICE_TRANSACTION_BYTES],
                                          uint32_t *output_bytes)
{
    uint32_t index;
    if (engine->pending_device_transaction_count > CADR_TRACE_MAX_DEVICE_TRANSACTIONS ||
        output_bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_trace_put32(output, engine->pending_device_transaction_count);
    for (index = 0U; index < engine->pending_device_transaction_count; ++index) {
        cadr_trace_transaction_bytes(&engine->pending_device_transactions[index],
                                     output + 4U + index * CADR_TRACE_DEVICE_TRANSACTION_BYTES);
    }
    *output_bytes = 4U + engine->pending_device_transaction_count *
        CADR_TRACE_DEVICE_TRANSACTION_BYTES;
    return CADR_STATUS_OK;
}

static uint64_t cadr_trace_boundary_selector_mask(const cadr_trace_engine *engine,
                                                  uint16_t flags)
{
    if ((flags & CADR_TRACE_BOUNDARY_INHIBITED) != 0U) {
        return engine->selector_mask & ~(CADR_TRACE_SELECTOR_DECODED_WORD |
                                         CADR_TRACE_SELECTOR_A_SOURCE |
                                         CADR_TRACE_SELECTOR_M_SOURCE |
                                         CADR_TRACE_SELECTOR_DESTINATION);
    }
    return engine->selector_mask;
}

static cadr_status cadr_trace_boundary_selectors(
    const cadr_machine_state *state, const cadr_trace_engine *engine,
    uint64_t selector_mask, cadr_trace_tlv output[12], uint32_t *output_count,
    uint8_t storage[12][4U + CADR_TRACE_MAX_DEVICE_TRANSACTIONS * CADR_TRACE_DEVICE_TRANSACTION_BYTES])
{
    const cadr_trace_state *trace = &state->trace;
    uint32_t count = 0U;
    uint32_t bit;
    if (output_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    for (bit = 0U; bit < 12U; ++bit) {
        uint8_t *const value = storage[bit];
        uint32_t length = 0U;
        if ((selector_mask & (UINT64_C(1) << bit)) == 0U) continue;
        switch (bit) {
        case 0U:
            if (trace->pre_p0_pc > UINT32_C(0x3fff) ||
                trace->pre_p1_pc > UINT32_C(0x3fff) ||
                trace->pre_next_micro_pc > UINT32_C(0x3fff) ||
                trace->pre_opc > UINT32_C(0x3fff) ||
                trace->post_p0_pc > UINT32_C(0x3fff) ||
                trace->post_p1_pc > UINT32_C(0x3fff) ||
                trace->post_next_micro_pc > UINT32_C(0x3fff) ||
                trace->post_opc > UINT32_C(0x3fff)) return CADR_STATUS_INVALID_ARGUMENT;
            cadr_trace_put32(value, trace->pre_p0_pc); cadr_trace_put32(value + 4U, trace->pre_p1_pc);
            cadr_trace_put32(value + 8U, trace->pre_next_micro_pc); cadr_trace_put32(value + 12U, trace->pre_opc);
            cadr_trace_put32(value + 16U, trace->post_p0_pc); cadr_trace_put32(value + 20U, trace->post_p1_pc);
            cadr_trace_put32(value + 24U, trace->post_next_micro_pc); cadr_trace_put32(value + 28U, trace->post_opc);
            length = 32U;
            break;
        case 1U:
            cadr_trace_put64(value, trace->raw_fetched_word & UINT64_C(0x0000ffffffffffff));
            cadr_trace_put64(value + 8U, trace->effective_word & UINT64_C(0x0000ffffffffffff));
            length = 16U;
            break;
        case 2U:
            cadr_trace_put32(value, trace->a_address); cadr_trace_put32(value + 4U, trace->a_value);
            length = 8U;
            break;
        case 3U:
            if (trace->m_source_kind > 1U || trace->m_address > UINT32_C(31) ||
                (((trace->valid_mask & CADR_TRACE_LATCH_VALID_M_SOURCE) == 0U) &&
                 (trace->m_source_kind != 0U || trace->m_address != 0U ||
                  trace->m_value != 0U))) return CADR_STATUS_INVALID_ARGUMENT;
            cadr_trace_put32(value, trace->m_source_kind); cadr_trace_put32(value + 4U, trace->m_address);
            cadr_trace_put32(value + 8U, trace->m_value);
            cadr_trace_put32(value + 12U, (trace->valid_mask & CADR_TRACE_LATCH_VALID_M_SOURCE) != 0U ? 1U : 0U);
            length = 16U;
            break;
        case 4U:
            if ((trace->valid_mask & CADR_TRACE_LATCH_VALID_DESTINATION) == 0U) {
                if (trace->destination_kind != 0U || trace->destination_address != 0U ||
                    trace->post_destination_value != 0U) return CADR_STATUS_INVALID_ARGUMENT;
            } else if ((trace->destination_kind != 1U && trace->destination_kind != 2U) ||
                       (trace->destination_kind == 1U && trace->destination_address > UINT32_C(1023)) ||
                       (trace->destination_kind == 2U && trace->destination_address > UINT32_C(31))) {
                return CADR_STATUS_INVALID_ARGUMENT;
            }
            cadr_trace_put32(value, trace->destination_kind); cadr_trace_put32(value + 4U, trace->destination_address);
            cadr_trace_put32(value + 8U, trace->post_destination_value);
            cadr_trace_put32(value + 12U, (trace->valid_mask & CADR_TRACE_LATCH_VALID_DESTINATION) != 0U ? 1U : 0U);
            length = 16U;
            break;
        case 5U:
            cadr_trace_put32(value, trace->pre_q); cadr_trace_put32(value + 4U, trace->post_q);
            length = 8U;
            break;
        case 6U:
            cadr_trace_put32(value, trace->pre_vma); cadr_trace_put32(value + 4U, trace->post_vma);
            length = 8U;
            break;
        case 7U:
            if (trace->md_delayed_phase > 1U) return CADR_STATUS_INVALID_ARGUMENT;
            cadr_trace_put32(value, trace->pre_md); cadr_trace_put32(value + 4U, trace->post_md);
            cadr_trace_put32(value + 8U, trace->md_delayed_phase);
            length = 12U;
            break;
        case 8U:
            cadr_trace_put32(value, trace->pre_macro_pc); cadr_trace_put32(value + 4U, trace->post_macro_pc);
            length = 8U;
            break;
        case 9U:
            if (trace->pre_fault > 1U || trace->post_fault > 1U ||
                trace->fault_code > 1U) return CADR_STATUS_INVALID_ARGUMENT;
            cadr_trace_put32(value, trace->pre_fault); cadr_trace_put32(value + 4U, trace->post_fault);
            cadr_trace_put32(value + 8U, trace->fault_code);
            cadr_trace_put32(value + 12U, (trace->valid_mask & CADR_TRACE_LATCH_VALID_FAULT) != 0U ? 1U : 0U);
            length = 16U;
            break;
        case 10U:
            if (trace->pre_interrupt_status > UINT16_MAX ||
                trace->post_interrupt_status > UINT16_MAX ||
                trace->interrupt_level != (trace->post_interrupt_status & UINT32_C(01774)) ||
                trace->post_interrupt_pending !=
                    ((trace->post_interrupt_status & UINT32_C(0140000)) != 0U ? 1U : 0U)) {
                return CADR_STATUS_INVALID_ARGUMENT;
            }
            cadr_trace_put32(value, trace->pre_interrupt_status);
            cadr_trace_put32(value + 4U, trace->post_interrupt_status);
            cadr_trace_put32(value + 8U, trace->interrupt_level);
            cadr_trace_put32(value + 12U, trace->post_interrupt_pending);
            length = 16U;
            break;
        case 11U:
            if (cadr_trace_device_list(engine, value, &length) != CADR_STATUS_OK) return CADR_STATUS_INVALID_ARGUMENT;
            break;
        default: return CADR_STATUS_INVALID_ARGUMENT;
        }
        output[count].type = (uint16_t)(bit + 1U);
        output[count].value = value;
        output[count].byte_count = length;
        count += 1U;
    }
    *output_count = count;
    return CADR_STATUS_OK;
}

int cadr_trace_engine_active(const cadr_machine_state *state)
{
    return state != NULL && state->trace.engine != NULL;
}

/* One boundary plus one possible record for each selected slot-event class. */
static uint32_t cadr_trace_slot_record_reservations(uint64_t event_mask)
{
    uint32_t reservations = 1U;
    if ((event_mask & CADR_TRACE_EVENT_CLOCK) != 0U) reservations += 1U;
    if ((event_mask & CADR_TRACE_EVENT_INTERRUPT) != 0U) reservations += 1U;
    if ((event_mask & CADR_TRACE_EVENT_DEVICE) != 0U) reservations += 1U;
    if ((event_mask & CADR_TRACE_EVENT_FAULT) != 0U) reservations += 1U;
    if ((event_mask & CADR_TRACE_EVENT_HALT) != 0U) reservations += 1U;
    return reservations;
}

cadr_status cadr_trace_engine_start(cadr_machine_state *state,
                                    const cadr_trace_engine_config *config)
{
    cadr_trace_engine *engine;
    cadr_status status;
    uint8_t state_digest[CADR_TRACE_SHA256_BYTES];
    size_t byte_count;
    if (state == NULL || config == NULL || state->trace.engine != NULL ||
        config->reserved0 != 0U ||
        (config->transport_mode != CADR_TRACE_TRANSPORT_FULL &&
         config->transport_mode != CADR_TRACE_TRANSPORT_HASH_ONLY) ||
        (config->transport_mode == CADR_TRACE_TRANSPORT_FULL &&
         (config->ring_record_capacity == 0U ||
          config->ring_record_capacity <
              cadr_trace_slot_record_reservations(config->event_mask))) ||
        config->ring_record_capacity > CADR_TRACE_MAX_RING_RECORDS ||
        (config->selector_mask & ~CADR_TRACE_SELECTOR_KNOWN) != 0U ||
        (config->event_mask & ~CADR_TRACE_EVENT_KNOWN) != 0U ||
        config->first_boundary != state->clock_slots_completed) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_trace_latches_validate(state);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_state_v2_digest(state, state_digest);
    if (status != CADR_STATUS_OK) return status;
    engine = calloc(1U, sizeof(*engine));
    if (engine == NULL) return CADR_STATUS_NO_MEMORY;
    if (config->transport_mode == CADR_TRACE_TRANSPORT_FULL) {
        byte_count = (size_t)config->ring_record_capacity * CADR_TRACE_MAX_RECORD_BYTES;
        engine->record_lengths = calloc(config->ring_record_capacity,
                                        sizeof(*engine->record_lengths));
        engine->record_bytes = malloc(byte_count);
        if (engine->record_lengths == NULL || engine->record_bytes == NULL) {
            free(engine->record_bytes);
            free(engine->record_lengths);
            free(engine);
            return CADR_STATUS_NO_MEMORY;
        }
    }
    engine->first_boundary = config->first_boundary;
    engine->selector_mask = config->selector_mask;
    engine->event_mask = config->event_mask;
    engine->transport_mode = config->transport_mode;
    engine->capacity = config->transport_mode == CADR_TRACE_TRANSPORT_FULL ?
        config->ring_record_capacity : 0U;
    (void)memcpy(engine->profile_sha256, config->profile_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(engine->artifact_set_sha256, config->artifact_set_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(engine->input_schedule_sha256, config->input_schedule_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(engine->initial_state_sha256, state_digest, CADR_TRACE_SHA256_BYTES);
    cadr_trace_semantic_seed(engine);
    engine->last_boundary = config->first_boundary;
    engine->last_cycle = 0U;
    state->trace.engine = engine;
    status = cadr_trace_emit_nonterminal(state, engine, CADR_TRACE_KIND_INITIAL,
                                         0U, config->first_boundary, 0U, 0U,
                                         0U, NULL, 0U, NULL, 0U);
    if (status != CADR_STATUS_OK) {
        cadr_trace_engine_stop(state);
        return status;
    }
    return CADR_STATUS_OK;
}

void cadr_trace_engine_stop(cadr_machine_state *state)
{
    cadr_trace_engine *engine;
    if (state == NULL || state->trace.engine == NULL) return;
    engine = state->trace.engine;
    state->trace.engine = NULL;
    free(engine->record_bytes);
    free(engine->record_lengths);
    free(engine);
}

cadr_status cadr_trace_engine_slot_preflight(cadr_machine_state *state)
{
    cadr_trace_engine *engine;
    uint64_t reservations;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if (engine->finished != 0U) return CADR_STATUS_NOT_READY;
    if ((engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) != 0U) {
        return CADR_STATUS_NOT_READY;
    }
    if (engine->slot_open != 0U || cadr_trace_reserved_count(engine) != 0U ||
        engine->pending_device_transaction_count != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    reservations = cadr_trace_slot_record_reservations(engine->event_mask);
    if (engine->record_count >= CADR_TRACE_MAX_RECORDS - UINT64_C(1) ||
        reservations > (CADR_TRACE_MAX_RECORDS - UINT64_C(1)) - engine->record_count ||
        (engine->transport_mode == CADR_TRACE_TRANSPORT_FULL &&
         (uint64_t)engine->ring_count + reservations > engine->capacity)) {
        return CADR_STATUS_NOT_READY;
    }
    engine->reserved_boundary = 1U;
    engine->reserved_clock = (engine->event_mask & CADR_TRACE_EVENT_CLOCK) != 0U ? 1U : 0U;
    engine->reserved_interrupt = (engine->event_mask & CADR_TRACE_EVENT_INTERRUPT) != 0U ? 1U : 0U;
    engine->reserved_device = (engine->event_mask & CADR_TRACE_EVENT_DEVICE) != 0U ? 1U : 0U;
    engine->reserved_fault = (engine->event_mask & CADR_TRACE_EVENT_FAULT) != 0U ? 1U : 0U;
    engine->reserved_halt = (engine->event_mask & CADR_TRACE_EVENT_HALT) != 0U ? 1U : 0U;
    engine->slot_open = 1U;
    engine->slot_boundary_recorded = 0U;
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_preflight_event(cadr_machine_state *state,
                                               const uint64_t event_class)
{
    cadr_trace_engine *engine;
    uint32_t *reservation;
    if (state == NULL || !cadr_trace_valid_event_class(event_class)) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if (engine->finished != 0U) return CADR_STATUS_NOT_READY;
    if ((engine->event_mask & event_class) == 0U) return CADR_STATUS_OK;
    if (engine->slot_open != 0U && engine->slot_closing == 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (engine->slot_open != 0U) return CADR_STATUS_INVALID_ARGUMENT;
    if (engine->boundary_count == 0U) {
        return event_class == CADR_TRACE_EVENT_HALT
            ? CADR_STATUS_INVALID_ARGUMENT : CADR_STATUS_NOT_READY;
    }
    if (((engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) != 0U &&
         event_class != CADR_TRACE_EVENT_HALT) ||
        (event_class == CADR_TRACE_EVENT_HALT &&
         ((engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) == 0U ||
          engine->halt_event_recorded != 0U))) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    reservation = cadr_trace_reservation_for(engine, event_class);
    return reservation == NULL ? CADR_STATUS_INVALID_ARGUMENT : cadr_trace_reserve(engine, reservation);
}

cadr_status cadr_trace_engine_record_boundary(cadr_machine_state *state,
                                              const uint16_t boundary_flags)
{
    cadr_trace_engine *engine;
    cadr_trace_tlv selectors[12];
    uint8_t selector_storage[12][4U + CADR_TRACE_MAX_DEVICE_TRANSACTIONS * CADR_TRACE_DEVICE_TRANSACTION_BYTES];
    uint32_t selector_count;
    uint64_t selector_mask;
    cadr_status status;
    const uint16_t activity = boundary_flags &
        (CADR_TRACE_BOUNDARY_EXECUTED | CADR_TRACE_BOUNDARY_INHIBITED);
    if (state == NULL || (boundary_flags & ~(CADR_TRACE_BOUNDARY_EXECUTED |
        CADR_TRACE_BOUNDARY_INHIBITED | CADR_TRACE_BOUNDARY_HALT |
        CADR_TRACE_BOUNDARY_CHECKPOINT)) != 0U ||
        (activity != CADR_TRACE_BOUNDARY_EXECUTED && activity != CADR_TRACE_BOUNDARY_INHIBITED)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if (engine->slot_open == 0U || engine->slot_boundary_recorded != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_trace_consume_reservation(&engine->reserved_boundary);
    if (status != CADR_STATUS_OK) return status;
    if (state->clock_slots_completed != engine->first_boundary + engine->boundary_count + UINT64_C(1)) {
        engine->reserved_boundary += 1U;
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    selector_mask = cadr_trace_boundary_selector_mask(engine, boundary_flags);
    status = cadr_trace_boundary_selectors(state, engine, selector_mask, selectors,
                                           &selector_count, selector_storage);
    if (status == CADR_STATUS_OK) {
        status = cadr_trace_emit_nonterminal(state, engine, CADR_TRACE_KIND_BOUNDARY,
                                             boundary_flags, state->clock_slots_completed,
                                             state->cpu.microinstructions_executed,
                                             selector_mask, 0U, selectors, selector_count,
                                             NULL, 0U);
    }
    if (status != CADR_STATUS_OK) {
        engine->reserved_boundary += 1U;
        return status;
    }
    engine->boundary_count += UINT64_C(1);
    engine->last_boundary_flags = boundary_flags;
    engine->slot_boundary_recorded = 1U;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_record_event(cadr_machine_state *state,
                                           uint64_t event_class, uint32_t code,
                                           const uint8_t *payload, uint32_t payload_bytes)
{
    cadr_trace_engine *engine;
    uint32_t *reservation;
    uint8_t code_bytes[4];
    uint8_t event_digest[CADR_TRACE_SHA256_BYTES];
    cadr_trace_tlv trailing[3];
    cadr_status status;
    if (state == NULL || !cadr_trace_valid_event_class(event_class) ||
        (payload_bytes != 0U && payload == NULL)) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL || (engine->event_mask & event_class) == 0U) return CADR_STATUS_OK;
    if (engine->boundary_count == 0U ||
        ((engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) != 0U &&
         event_class != CADR_TRACE_EVENT_HALT) ||
        (event_class == CADR_TRACE_EVENT_HALT &&
         ((engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) == 0U ||
          engine->halt_event_recorded != 0U))) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    reservation = cadr_trace_reservation_for(engine, event_class);
    if (reservation == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = cadr_trace_consume_reservation(reservation);
    if (status != CADR_STATUS_OK) return status;
    cadr_trace_put32(code_bytes, code);
    cadr_trace_event_digest((uint32_t)event_class, code, payload, payload_bytes, event_digest);
    trailing[0].type = CADR_TRACE_TLV_EVENT_CODE;
    trailing[0].value = code_bytes;
    trailing[0].byte_count = sizeof(code_bytes);
    trailing[1].type = CADR_TRACE_TLV_EVENT_BYTES;
    trailing[1].value = payload;
    trailing[1].byte_count = payload_bytes;
    trailing[2].type = CADR_TRACE_TLV_EVENT_DIGEST;
    trailing[2].value = event_digest;
    trailing[2].byte_count = sizeof(event_digest);
    status = cadr_trace_emit_nonterminal(state, engine, CADR_TRACE_KIND_EVENT, 0U,
                                         engine->last_boundary,
                                         state->cpu.microinstructions_executed,
                                         0U, (uint32_t)event_class, NULL, 0U,
                                         trailing, 3U);
    if (status != CADR_STATUS_OK) {
        *reservation += 1U;
        return status;
    }
    if (event_class == CADR_TRACE_EVENT_HALT) engine->halt_event_recorded = 1U;
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_record_clock(cadr_machine_state *state,
                                           const uint64_t tick_before,
                                           const uint64_t tick_after,
                                           const uint64_t decision)
{
    uint8_t payload[24];
    if (tick_after < tick_before || decision > 1U) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_trace_put64(payload, tick_before);
    cadr_trace_put64(payload + 8U, tick_after);
    cadr_trace_put64(payload + 16U, decision);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_CLOCK, 1U, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_interrupt(cadr_machine_state *state,
                                               const uint32_t before,
                                               const uint32_t after,
                                               const uint32_t level,
                                               const uint32_t pending)
{
    uint8_t payload[16];
    if (before > UINT16_MAX || after > UINT16_MAX ||
        level != (after & UINT32_C(01774)) ||
        pending != ((after & UINT32_C(0140000)) != 0U ? 1U : 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_trace_put32(payload, before); cadr_trace_put32(payload + 4U, after);
    cadr_trace_put32(payload + 8U, level); cadr_trace_put32(payload + 12U, pending);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_INTERRUPT, 1U, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_fault(cadr_machine_state *state,
                                           const uint32_t before,
                                           const uint32_t after,
                                           const uint32_t code,
                                           const uint32_t valid)
{
    uint8_t payload[16];
    if (before > 1U || after > 1U || code > 1U || valid > 1U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_trace_put32(payload, before); cadr_trace_put32(payload + 4U, after);
    cadr_trace_put32(payload + 8U, code); cadr_trace_put32(payload + 12U, valid);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_FAULT, 1U, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_halt(cadr_machine_state *state,
                                          const uint32_t code)
{
    uint8_t payload[4];
    if (code != CADR_STATUS_HALTED) return CADR_STATUS_INVALID_ARGUMENT;
    cadr_trace_put32(payload, code);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_HALT, 1U, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_device_request_issue(
    cadr_machine_state *state, const uint32_t operation, const uint32_t status,
    const uint64_t generation, const uint64_t request_id,
    const uint8_t descriptor_sha256[CADR_SHA256_BYTES],
    const uint64_t descriptor_length, const uint64_t expected_completion_length)
{
    uint8_t payload[72];
    if (!cadr_trace_valid_host_operation(operation) || !cadr_trace_valid_cadr_status(status) ||
        generation == 0U || request_id == 0U || descriptor_sha256 == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_trace_put32(payload, operation); cadr_trace_put32(payload + 4U, status);
    cadr_trace_put64(payload + 8U, generation); cadr_trace_put64(payload + 16U, request_id);
    cadr_trace_put64(payload + 24U, descriptor_length);
    (void)memcpy(payload + 32U, descriptor_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_put64(payload + 64U, expected_completion_length);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_DEVICE, 1U, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_device_request_issue_m4(
    cadr_machine_state *state, const uint32_t operation, const uint32_t status,
    const uint64_t generation, const uint64_t request_id,
    const uint8_t descriptor_sha256[CADR_SHA256_BYTES],
    const uint64_t descriptor_length,
    const uint8_t request_payload_sha256[CADR_SHA256_BYTES],
    const uint64_t request_payload_length,
    const uint64_t expected_completion_length)
{
    uint8_t payload[112];
    if (!cadr_trace_valid_host_operation(operation) ||
        !cadr_trace_valid_cadr_status(status) ||
        generation == 0U || request_id == 0U ||
        descriptor_sha256 == NULL || request_payload_sha256 == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_trace_put32(payload, operation);
    cadr_trace_put32(payload + 4U, status);
    cadr_trace_put64(payload + 8U, generation);
    cadr_trace_put64(payload + 16U, request_id);
    cadr_trace_put64(payload + 24U, descriptor_length);
    (void)memcpy(payload + 32U, descriptor_sha256, CADR_TRACE_SHA256_BYTES);
    cadr_trace_put64(payload + 64U, expected_completion_length);
    cadr_trace_put64(payload + 72U, request_payload_length);
    (void)memcpy(payload + 80U, request_payload_sha256,
                 CADR_TRACE_SHA256_BYTES);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_DEVICE, 6U,
                                   payload, sizeof(payload));
}

cadr_status cadr_trace_engine_record_device_completion(
    cadr_machine_state *state, const uint32_t code, const uint32_t operation,
    const uint32_t result, const uint32_t status, const uint64_t generation,
    const uint64_t request_id,
    const uint8_t payload_sha256[CADR_SHA256_BYTES], const uint64_t payload_length)
{
    uint8_t payload[68];
    if (code < 2U || code > 4U || !cadr_trace_valid_host_operation(operation) ||
        result > CADR_HOST_RESULT_FAILED || !cadr_trace_valid_cadr_status(status) ||
        generation == 0U || request_id == 0U || payload_sha256 == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    cadr_trace_put32(payload, operation); cadr_trace_put32(payload + 4U, result);
    cadr_trace_put32(payload + 8U, status); cadr_trace_put64(payload + 12U, generation);
    cadr_trace_put64(payload + 20U, request_id); cadr_trace_put64(payload + 28U, payload_length);
    (void)memcpy(payload + 36U, payload_sha256, CADR_TRACE_SHA256_BYTES);
    return cadr_trace_record_event(state, CADR_TRACE_EVENT_DEVICE, code, payload, sizeof(payload));
}

cadr_status cadr_trace_engine_stage_device_transaction(
    cadr_machine_state *state, const cadr_trace_device_transaction *transaction)
{
    cadr_trace_engine *engine;
    if (state == NULL || transaction == NULL ||
        (transaction->read_write_kind != CADR_TRACE_TRANSACTION_READ &&
         transaction->read_write_kind != CADR_TRACE_TRANSACTION_WRITE) ||
        transaction->address_space != CADR_TRACE_ADDRESS_SPACE_CADR_PHYSICAL_WORD ||
        transaction->address > UINT32_C(017777777) ||
        (transaction->read_write_kind == CADR_TRACE_TRANSACTION_READ &&
         transaction->value != 0U) ||
        (transaction->read_write_kind == CADR_TRACE_TRANSACTION_WRITE &&
         transaction->result != 0U) ||
        (transaction->status != CADR_STATUS_OK &&
         transaction->status != CADR_STATUS_UNIMPLEMENTED_DEVICE) ||
        transaction->interrupt_before > UINT16_MAX ||
        transaction->interrupt_after > UINT16_MAX ||
        (transaction->error_before & ~CADR_TRACE_ERROR_MASK_KNOWN) != 0U ||
        (transaction->error_after & ~CADR_TRACE_ERROR_MASK_KNOWN) != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if ((engine->selector_mask & CADR_TRACE_SELECTOR_DEVICE_TRANSACTION) == 0U &&
        (engine->event_mask & CADR_TRACE_EVENT_DEVICE) == 0U) return CADR_STATUS_OK;
    if (engine->slot_open == 0U || engine->slot_boundary_recorded != 0U) {
        return CADR_STATUS_GUEST_FAULT;
    }
    if (engine->pending_device_transaction_count >= CADR_TRACE_MAX_DEVICE_TRANSACTIONS) {
        return CADR_STATUS_GUEST_FAULT;
    }
    engine->pending_device_transactions[engine->pending_device_transaction_count] = *transaction;
    engine->pending_device_transaction_count += 1U;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_slot_events_validate(const cadr_trace_engine *engine,
                                                    const cadr_trace_slot_events *events)
{
    const uint32_t halted =
        (engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) != 0U ? 1U : 0U;
    if (events == NULL || events->clock_present > 1U ||
        events->interrupt_present > 1U || events->fault_present > 1U ||
        events->halt_present > 1U || events->reserved0 != 0U ||
        (events->clock_present == 0U &&
         (events->tick_before != 0U || events->tick_after != 0U ||
          events->clock_decision != 0U)) ||
        (events->clock_present != 0U &&
         (events->tick_after < events->tick_before || events->clock_decision > 1U)) ||
        (events->interrupt_present == 0U &&
         (events->interrupt_before != 0U || events->interrupt_after != 0U ||
          events->interrupt_level != 0U || events->interrupt_pending != 0U)) ||
        (events->interrupt_present != 0U &&
         (events->interrupt_before > UINT16_MAX ||
          events->interrupt_after > UINT16_MAX ||
          events->interrupt_level != (events->interrupt_after & UINT32_C(01774)) ||
          events->interrupt_pending !=
              ((events->interrupt_after & UINT32_C(0140000)) != 0U ? 1U : 0U))) ||
        (events->fault_present == 0U &&
         (events->fault_before != 0U || events->fault_after != 0U ||
          events->fault_code != 0U || events->fault_value_valid != 0U)) ||
        (events->fault_present != 0U &&
         (events->fault_before > 1U || events->fault_after > 1U ||
          events->fault_code > 1U || events->fault_value_valid > 1U)) ||
        (events->halt_present == 0U && events->halt_code != 0U) ||
        (events->halt_present != 0U && events->halt_code != CADR_STATUS_HALTED) ||
        (events->halt_present != halted) ||
        (halted != 0U &&
         (((engine->event_mask & CADR_TRACE_EVENT_CLOCK) != 0U && events->clock_present != 0U) ||
          ((engine->event_mask & CADR_TRACE_EVENT_INTERRUPT) != 0U && events->interrupt_present != 0U) ||
          ((engine->event_mask & CADR_TRACE_EVENT_DEVICE) != 0U && engine->pending_device_transaction_count != 0U) ||
          ((engine->event_mask & CADR_TRACE_EVENT_FAULT) != 0U && events->fault_present != 0U)))) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_slot_postflight(cadr_status status)
{
    return status == CADR_STATUS_OK ? CADR_STATUS_OK : CADR_STATUS_GUEST_FAULT;
}

cadr_status cadr_trace_engine_slot_close(cadr_machine_state *state,
                                         const cadr_trace_slot_events *events)
{
    cadr_trace_engine *engine;
    cadr_status status;
    uint8_t device_payload[4U + CADR_TRACE_MAX_DEVICE_TRANSACTIONS *
                           CADR_TRACE_DEVICE_TRANSACTION_BYTES];
    uint32_t device_payload_bytes = 0U;
    uint8_t digest[CADR_SHA256_BYTES];
    if (state == NULL || events == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if (engine->slot_open == 0U || engine->slot_boundary_recorded == 0U ||
        engine->reserved_boundary != 0U || engine->slot_closing != 0U ||
        engine->reserved_clock !=
            ((engine->event_mask & CADR_TRACE_EVENT_CLOCK) != 0U ? 1U : 0U) ||
        engine->reserved_interrupt !=
            ((engine->event_mask & CADR_TRACE_EVENT_INTERRUPT) != 0U ? 1U : 0U) ||
        engine->reserved_device !=
            ((engine->event_mask & CADR_TRACE_EVENT_DEVICE) != 0U ? 1U : 0U) ||
        engine->reserved_fault !=
            ((engine->event_mask & CADR_TRACE_EVENT_FAULT) != 0U ? 1U : 0U) ||
        engine->reserved_halt !=
            ((engine->event_mask & CADR_TRACE_EVENT_HALT) != 0U ? 1U : 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    status = cadr_trace_slot_events_validate(engine, events);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_trace_latches_validate(state);
    if (status != CADR_STATUS_OK || cadr_state_v2_digest(state, digest) != CADR_STATUS_OK) {
        return CADR_STATUS_GUEST_FAULT;
    }
    if (engine->pending_device_transaction_count != 0U &&
        (engine->event_mask & CADR_TRACE_EVENT_DEVICE) != 0U) {
        status = cadr_trace_device_list(engine, device_payload, &device_payload_bytes);
        if (status != CADR_STATUS_OK) return CADR_STATUS_GUEST_FAULT;
    }
    engine->slot_closing = 1U;
    if ((engine->event_mask & CADR_TRACE_EVENT_CLOCK) != 0U) {
        if (events->clock_present != 0U) {
            status = cadr_trace_engine_record_clock(state, events->tick_before,
                                                    events->tick_after,
                                                    events->clock_decision);
            if (status != CADR_STATUS_OK) return cadr_trace_slot_postflight(status);
        } else engine->reserved_clock = 0U;
    }
    if ((engine->event_mask & CADR_TRACE_EVENT_INTERRUPT) != 0U) {
        if (events->interrupt_present != 0U) {
            status = cadr_trace_engine_record_interrupt(
                state, events->interrupt_before, events->interrupt_after,
                events->interrupt_level, events->interrupt_pending);
            if (status != CADR_STATUS_OK) return cadr_trace_slot_postflight(status);
        } else engine->reserved_interrupt = 0U;
    }
    if ((engine->event_mask & CADR_TRACE_EVENT_DEVICE) != 0U) {
        if (engine->pending_device_transaction_count != 0U) {
            status = cadr_trace_record_event(state, CADR_TRACE_EVENT_DEVICE, 5U,
                                             device_payload, device_payload_bytes);
            if (status != CADR_STATUS_OK) return cadr_trace_slot_postflight(status);
        } else engine->reserved_device = 0U;
    }
    if ((engine->event_mask & CADR_TRACE_EVENT_FAULT) != 0U) {
        if (events->fault_present != 0U) {
            status = cadr_trace_engine_record_fault(
                state, events->fault_before, events->fault_after,
                events->fault_code, events->fault_value_valid);
            if (status != CADR_STATUS_OK) return cadr_trace_slot_postflight(status);
        } else engine->reserved_fault = 0U;
    }
    if ((engine->event_mask & CADR_TRACE_EVENT_HALT) != 0U) {
        if (events->halt_present != 0U) {
            status = cadr_trace_engine_record_halt(state, events->halt_code);
            if (status != CADR_STATUS_OK) return cadr_trace_slot_postflight(status);
        } else engine->reserved_halt = 0U;
    }
    if (cadr_trace_reserved_count(engine) != 0U) return CADR_STATUS_GUEST_FAULT;
    engine->pending_device_transaction_count = 0U;
    engine->slot_closing = 0U;
    engine->slot_boundary_recorded = 0U;
    engine->slot_open = 0U;
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_slot_abort(cadr_machine_state *state)
{
    cadr_trace_engine *engine;
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL) return CADR_STATUS_OK;
    if (engine->slot_open == 0U || engine->slot_boundary_recorded != 0U ||
        engine->pending_device_transaction_count != 0U || engine->slot_closing != 0U) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    engine->reserved_boundary = 0U;
    engine->reserved_clock = 0U;
    engine->reserved_interrupt = 0U;
    engine->reserved_device = 0U;
    engine->reserved_fault = 0U;
    engine->reserved_halt = 0U;
    engine->slot_open = 0U;
    return CADR_STATUS_OK;
}

static cadr_status cadr_trace_terminal(cadr_machine_state *state,
                                       cadr_trace_engine *engine,
                                       uint32_t reason)
{
    uint8_t state_digest[CADR_TRACE_SHA256_BYTES];
    uint8_t count_bytes[8];
    uint8_t reason_bytes[4];
    uint8_t raw_record[CADR_TRACE_MAX_RECORD_BYTES];
    cadr_trace_tlv tlvs[6];
    uint32_t record_bytes;
    cadr_status status;
    if (reason > CADR_TRACE_REASON_FAILURE) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (engine->record_count >= CADR_TRACE_MAX_RECORDS) {
        return CADR_STATUS_NOT_READY;
    }
    if ((reason == CADR_TRACE_REASON_COMPLETE_HALT &&
         (engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) == 0U) ||
        (reason == CADR_TRACE_REASON_COMPLETE_LIMIT &&
         (engine->last_boundary_flags & CADR_TRACE_BOUNDARY_HALT) != 0U)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (engine->slot_open != 0U || engine->slot_boundary_recorded != 0U ||
        engine->slot_closing != 0U ||
        engine->pending_device_transaction_count != 0U ||
        cadr_trace_reserved_count(engine) != 0U) return CADR_STATUS_NOT_READY;
    if (engine->transport_mode == CADR_TRACE_TRANSPORT_FULL &&
        engine->ring_count >= engine->capacity) {
        return CADR_STATUS_NOT_READY;
    }
    status = cadr_trace_latches_validate(state);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_state_v2_digest(state, state_digest);
    if (status != CADR_STATUS_OK) return status;
    cadr_trace_put64(count_bytes, engine->record_count + UINT64_C(1));
    cadr_trace_put32(reason_bytes, reason);
    tlvs[0].type = CADR_TRACE_TLV_STATE; tlvs[0].value = state_digest; tlvs[0].byte_count = sizeof(state_digest);
    tlvs[1].type = CADR_TRACE_TLV_PREVIOUS; tlvs[1].value = engine->semantic_previous; tlvs[1].byte_count = sizeof(engine->semantic_previous);
    tlvs[2].type = CADR_TRACE_TLV_SEMANTIC; tlvs[2].value = engine->semantic_previous; tlvs[2].byte_count = sizeof(engine->semantic_previous);
    tlvs[3].type = CADR_TRACE_TLV_FINAL_COUNT; tlvs[3].value = count_bytes; tlvs[3].byte_count = sizeof(count_bytes);
    tlvs[4].type = CADR_TRACE_TLV_REASON; tlvs[4].value = reason_bytes; tlvs[4].byte_count = sizeof(reason_bytes);
    tlvs[5].type = CADR_TRACE_TLV_FINAL_STATE; tlvs[5].value = state_digest; tlvs[5].byte_count = sizeof(state_digest);
    status = cadr_trace_encode_record(CADR_TRACE_KIND_TERMINAL, 0U, engine->record_count,
                                      engine->last_boundary, state->cpu.microinstructions_executed,
                                      0U, 0U, tlvs, 6U, raw_record, &record_bytes);
    if (status != CADR_STATUS_OK) return status;
    status = cadr_trace_enqueue(engine, raw_record, record_bytes);
    if (status != CADR_STATUS_OK) return status;
    engine->record_count += UINT64_C(1);
    engine->finished = 1U;
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_finish(cadr_machine_state *state, const uint32_t reason)
{
    if (state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (state->trace.engine == NULL) return CADR_STATUS_OK;
    if (state->trace.engine->finished != 0U) return CADR_STATUS_NOT_READY;
    return cadr_trace_terminal(state, state->trace.engine, reason);
}

cadr_status cadr_trace_engine_header(const cadr_machine_state *state,
                                     uint8_t output[CADR_TRACE_HEADER_BYTES])
{
    const cadr_trace_engine *engine;
    uint64_t count;
    if (state == NULL || output == NULL || state->trace.engine == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    engine = state->trace.engine;
    count = engine->finished != 0U ? engine->record_count : UINT64_MAX;
    (void)memset(output, 0, CADR_TRACE_HEADER_BYTES);
    (void)memcpy(output, "CDRGTRC1", 8U);
    cadr_trace_put16(output + 8U, UINT16_C(1));
    cadr_trace_put16(output + 10U, CADR_TRACE_HEADER_BYTES);
    cadr_trace_put32(output + 12U, 0U);
    cadr_trace_put64(output + 16U, engine->first_boundary);
    cadr_trace_put64(output + 24U, count);
    cadr_trace_put64(output + 32U, engine->selector_mask);
    cadr_trace_put64(output + 40U, engine->event_mask);
    (void)memcpy(output + 48U, engine->profile_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(output + 80U, engine->artifact_set_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(output + 112U, engine->initial_state_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(output + 144U, engine->input_schedule_sha256, CADR_TRACE_SHA256_BYTES);
    (void)memcpy(output + 176U, engine->semantic_seed, CADR_TRACE_SHA256_BYTES);
    cadr_trace_put32(output + 252U, cadr_trace_crc32c(output, 252U));
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_drain(cadr_machine_state *state,
                                    uint8_t *output, const uint64_t capacity,
                                    uint64_t *written, uint64_t *records)
{
    cadr_trace_engine *engine;
    uint64_t offset = 0U;
    uint64_t count = 0U;
    if (state == NULL || written == NULL || records == NULL ||
        (capacity != 0U && output == NULL)) return CADR_STATUS_INVALID_ARGUMENT;
    engine = state->trace.engine;
    if (engine == NULL) {
        *written = 0U;
        *records = 0U;
        return CADR_STATUS_OK;
    }
    while (engine->ring_count != 0U) {
        const uint32_t length = engine->record_lengths[engine->ring_head];
        if ((uint64_t)length > capacity - offset) break;
        (void)memcpy(output + offset,
                     engine->record_bytes + (size_t)engine->ring_head * CADR_TRACE_MAX_RECORD_BYTES,
                     length);
        offset += length;
        count += UINT64_C(1);
        engine->record_lengths[engine->ring_head] = 0U;
        engine->ring_head = (engine->ring_head + 1U) % engine->capacity;
        engine->ring_count -= 1U;
    }
    *written = offset;
    *records = count;
    return CADR_STATUS_OK;
}

cadr_status cadr_trace_engine_semantic_digest(const cadr_machine_state *state,
                                              uint8_t digest[CADR_SHA256_BYTES])
{
    if (state == NULL || digest == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (state->trace.engine == NULL) return CADR_STATUS_NOT_READY;
    (void)memcpy(digest, state->trace.engine->semantic_previous, CADR_TRACE_SHA256_BYTES);
    return CADR_STATUS_OK;
}

uint64_t cadr_trace_engine_record_count(const cadr_machine_state *state)
{
    return state == NULL || state->trace.engine == NULL ? 0U : state->trace.engine->record_count;
}

#ifdef CADR_TRACE_ENGINE_TESTING
cadr_status cadr_trace_engine_test_set_record_count(cadr_machine_state *state,
                                                     const uint64_t record_count)
{
    if (state == NULL || state->trace.engine == NULL ||
        state->trace.engine->finished != 0U ||
        record_count < state->trace.engine->record_count ||
        record_count >= CADR_TRACE_MAX_RECORDS) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    state->trace.engine->record_count = record_count;
    return CADR_STATUS_OK;
}
#endif
