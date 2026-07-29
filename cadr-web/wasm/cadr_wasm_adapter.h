/* Fixed-width M3 wasm export surface.  No C structure crosses this boundary. */
#ifndef CADR_WASM_ADAPTER_H
#define CADR_WASM_ADAPTER_H

#include <stdint.h>

uint32_t cadr_wasm_create(void);
uint32_t cadr_wasm_input_reserve(uint32_t byte_count);
uint32_t cadr_wasm_stream_begin(uint32_t artifact_kind, uint32_t byte_count_low,
                                uint32_t byte_count_high);
uint32_t cadr_wasm_stream_chunk(uint32_t offset_low, uint32_t offset_high,
                                uint32_t byte_count);
uint32_t cadr_wasm_stream_finish(void);
uint32_t cadr_wasm_stream_abort(void);
uint32_t cadr_wasm_import(uint32_t artifact_kind, uint32_t byte_count);
uint32_t cadr_wasm_cold_power_on(void);
uint32_t cadr_wasm_boot(void);
uint32_t cadr_wasm_reset(void);
uint32_t cadr_wasm_run(uint32_t clock_slots);
uint32_t cadr_wasm_schedule_event(uint32_t kind, uint32_t flags,
                                  uint32_t due_low, uint32_t due_high,
                                  uint32_t generation_low, uint32_t generation_high,
                                  uint32_t value, uint32_t reserved0);
uint32_t cadr_wasm_schedule_events(uint32_t event_count, uint32_t byte_count);
uint32_t cadr_wasm_scheduler_transcript_start(void);
uint32_t cadr_wasm_scheduler_transcript(void);
uint32_t cadr_wasm_scheduler_transcript_finish(void);
#if defined(CADR_M5_ORACLE_TEST)
uint32_t cadr_wasm_m5_oracle_latch_disk_result(void);
uint32_t cadr_wasm_m5_oracle_observation(void);
#endif
uint32_t cadr_wasm_output_pointer(void);
uint32_t cadr_wasm_meta_pointer(void);
uint32_t cadr_wasm_boundary_digest(void);
uint32_t cadr_wasm_state_v2_digest(void);
uint32_t cadr_wasm_state_v3_digest(void);
uint32_t cadr_wasm_state_v4_digest(void);
uint32_t cadr_wasm_state_v5_digest(void);
uint32_t cadr_wasm_scheduler_digest(void);
uint32_t cadr_wasm_state_v5_failure_digest(void);
uint32_t cadr_wasm_boot_witness(void);
uint32_t cadr_wasm_boot_witness_meta(void);
uint32_t cadr_wasm_host_next_request(void);
uint32_t cadr_wasm_host_complete(uint32_t operation, uint32_t host_status,
                                 uint32_t generation_low, uint32_t generation_high,
                                 uint32_t request_low, uint32_t request_high,
                                 uint32_t byte_count);
uint32_t cadr_wasm_disk_observation(void);
uint32_t cadr_wasm_boot_media_observation(void);
uint32_t cadr_wasm_disk_evidence(void);
#if defined(CADR_M6_DEVID_WASM)
uint32_t cadr_wasm_m6_disk_evidence_summary(void);
#endif
uint32_t cadr_wasm_machine_info(void);
uint32_t cadr_wasm_trace_start(uint32_t transport_mode, uint32_t capacity,
                               uint32_t selector_low, uint32_t selector_high,
                               uint32_t event_low, uint32_t event_high);
uint32_t cadr_wasm_trace_header(void);
uint32_t cadr_wasm_trace_drain(void);
uint32_t cadr_wasm_trace_digest(void);
uint32_t cadr_wasm_trace_count(void);
uint32_t cadr_wasm_trace_finish(uint32_t reason);
uint32_t cadr_wasm_snapshot_size(void);
uint32_t cadr_wasm_snapshot_save(void);
uint32_t cadr_wasm_snapshot_pointer(void);
uint32_t cadr_wasm_snapshot_input_reserve(uint32_t byte_count);
uint32_t cadr_wasm_snapshot_restore_import(uint32_t byte_count);
uint32_t cadr_wasm_snapshot_restore(void);
uint32_t cadr_wasm_portability_probe(void);

#endif
