#ifndef CADR_M4_CONTROLLER_TRANSCRIPT_H
#define CADR_M4_CONTROLLER_TRANSCRIPT_H
#include "cadr_disk_evidence.h"
#include "cadr_state.h"
#define CADR_M4_CTRL_HEADER_BYTES UINT64_C(256)
#define CADR_M4_CTRL_FOOTER_BYTES UINT64_C(256)
#define CADR_M4_CTRL_TERMINAL_BOUNDARY UINT64_C(1029996)
#define CADR_M4_CTRL_QUIET_BOUNDARY UINT64_C(1030044)
typedef struct cadr_m4_controller_transcript_config { uint8_t profile_sha256[32]; uint8_t artifact_set_sha256[32]; uint32_t terminal_reached; uint64_t terminal_boundary,p0_pc,p1_pc,next_micro_pc; } cadr_m4_controller_transcript_config;
cadr_status cadr_m4_controller_transcript_size(const cadr_disk_evidence_log *log,uint64_t *bytes);
cadr_status cadr_m4_controller_transcript_serialize(const cadr_m4_controller_transcript_config *config,const cadr_machine_state *state,const cadr_disk_evidence_log *log,uint8_t *bytes,uint64_t capacity,uint64_t *written);
#endif
