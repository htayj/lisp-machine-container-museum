#ifndef CADR_M4_MEDIA_H
#define CADR_M4_MEDIA_H

#include <stdint.h>

#include "cadr_host_api.h"
#include "cadr_state.h"

#define CADR_M4_MEDIA_SCHEMA_VERSION UINT32_C(1)
#define CADR_M4_MEDIA_HEADER_BYTES UINT64_C(64)
#define CADR_M4_MEDIA_TURN_BYTES UINT64_C(352)
#define CADR_M4_MEDIA_DESCRIPTOR_BYTES UINT64_C(64)
#define CADR_M4_MEDIA_PAGE_BYTES UINT64_C(1024)
#define CADR_M4_MEDIA_SELECTED_BASE_BYTES UINT64_C(269562880)

enum cadr_m4_media_actor { CADR_M4_MEDIA_ACTOR_ISSUE = 1, CADR_M4_MEDIA_ACTOR_CAPTURE = 2, CADR_M4_MEDIA_ACTOR_DELIVERY = 3, CADR_M4_MEDIA_ACTOR_APPLY = 4, CADR_M4_MEDIA_ACTOR_STABLE = 5 };
enum cadr_m4_media_disposition { CADR_M4_MEDIA_DISPOSITION_NONE = 0, CADR_M4_MEDIA_DISPOSITION_COMMIT = 1, CADR_M4_MEDIA_DISPOSITION_ABORT = 2 };

typedef struct cadr_m4_media_header { uint64_t base_byte_count; uint8_t base_sha256[CADR_SHA256_BYTES]; } cadr_m4_media_header;
typedef struct cadr_m4_media_turn {
    uint64_t ordinal; uint32_t actor; uint32_t disposition; uint32_t operation; uint32_t actor_status;
    uint64_t guest_tick; uint64_t generation; uint64_t request_id;
    uint64_t descriptor_byte_count; uint64_t request_payload_byte_count;
    uint64_t expected_completion_byte_count; uint64_t delivered_completion_byte_count;
    uint8_t descriptor[CADR_M4_MEDIA_DESCRIPTOR_BYTES];
    uint8_t descriptor_sha256[CADR_SHA256_BYTES]; uint8_t request_payload_sha256[CADR_SHA256_BYTES]; uint8_t page_sha256[CADR_SHA256_BYTES];
    uint64_t overlay_generation; uint8_t overlay_root_sha256[CADR_SHA256_BYTES]; uint8_t stabilized_state_sha256[CADR_SHA256_BYTES];
} cadr_m4_media_turn;
typedef struct cadr_m4_media_difference { uint64_t turn_ordinal; uint64_t byte_offset; uint8_t left_byte; uint8_t right_byte; } cadr_m4_media_difference;

void cadr_m4_media_selected_base(cadr_m4_media_header *header);
void cadr_m4_media_sha256(const uint8_t *bytes, uint64_t byte_count, uint8_t digest[CADR_SHA256_BYTES]);
cadr_status cadr_m4_media_overlay_root(const cadr_m4_media_header *header, const cadr_m4_media_turn *turns, uint64_t through_turn_count, uint8_t root[CADR_SHA256_BYTES]);
cadr_status cadr_m4_media_build_stable_turn(const cadr_machine_state *state, uint64_t ordinal, uint64_t guest_tick, uint64_t overlay_generation, const uint8_t overlay_root[CADR_SHA256_BYTES], cadr_m4_media_turn *turn);
cadr_status cadr_m4_media_serialized_size(uint64_t turn_count, uint64_t *byte_count);
cadr_status cadr_m4_media_serialize(const cadr_m4_media_header *header, const cadr_m4_media_turn *turns, uint64_t turn_count, uint8_t *bytes, uint64_t capacity, uint64_t *written);
cadr_status cadr_m4_media_compare(const uint8_t *left, uint64_t left_count, const uint8_t *right, uint64_t right_count, cadr_m4_media_difference *difference);

#endif
