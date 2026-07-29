#ifndef CADR_DISK_EVIDENCE_H
#define CADR_DISK_EVIDENCE_H

/*
 * Per-machine, host-free disk-controller evidence.  This record is expressly
 * diagnostic: it is not guest state, is omitted from CDRSTATE1/2/3 and all
 * snapshots, survives an in-guest controller reset, and is cleared by the
 * machine's cold-power-on evidence reset.  It stores hashes, never disk page
 * bytes.  CDRDISKEVID1 serialization is a 16-byte header followed by
 * 384-byte records in sequence order; all integers are little-endian.  Each
 * record has post-slot/intra-slot order, reversible controller tuples, request
 * identity and four hashes (descriptor, payload, delivery, page).  The host
 * framing layer supplies media identity and terminal/stable witnesses.
 */
#include <stdint.h>
#include "cadr_host_api.h"

#define CADR_DISK_EVIDENCE_CAPACITY UINT32_C(512)
#define CADR_DISK_EVIDENCE_HEADER_BYTES UINT64_C(16)
#define CADR_DISK_EVIDENCE_RECORD_BYTES UINT64_C(384)
enum cadr_disk_evidence_kind { CADR_DISK_EVIDENCE_REGISTER_READ=1, CADR_DISK_EVIDENCE_REGISTER_WRITE=2, CADR_DISK_EVIDENCE_CCW_READ=3, CADR_DISK_EVIDENCE_BLOCK_REQUEST=4, CADR_DISK_EVIDENCE_DELIVERY=5, CADR_DISK_EVIDENCE_APPLICATION=6, CADR_DISK_EVIDENCE_PAGE_TRANSFER=7, CADR_DISK_EVIDENCE_STATE=8, CADR_DISK_EVIDENCE_INTERRUPT=9 };
typedef struct cadr_disk_evidence_tuple { uint64_t lba; uint64_t generation; uint64_t request_id; uint64_t expected_completion; uint32_t command,clp,da,lma,ccw_address,ccw_index,status,transfer_reset_enables,bus_irq,operation,completion_queued,reserved0; } cadr_disk_evidence_tuple;
typedef struct cadr_disk_evidence_event { uint64_t sequence,post_slot; uint32_t intra_slot,kind,flags,value,detail; uint64_t first,second,delivered_completion; cadr_disk_evidence_tuple before,after; uint8_t descriptor_sha256[32],payload_sha256[32],delivery_sha256[32],page_sha256[32]; } cadr_disk_evidence_event;
typedef struct cadr_disk_evidence_log { uint64_t next_sequence,last_slot; uint32_t count,overflowed,intra_slot,have_last; cadr_disk_evidence_tuple last_after,observed_before,observed_after; cadr_disk_evidence_event events[CADR_DISK_EVIDENCE_CAPACITY]; } cadr_disk_evidence_log;
void cadr_disk_evidence_reset(cadr_disk_evidence_log *log);
void cadr_disk_evidence_observe(cadr_disk_evidence_log *log,uint64_t post_slot,const cadr_disk_evidence_tuple *after);
cadr_status cadr_disk_evidence_record(cadr_disk_evidence_log *log,uint32_t kind,uint32_t flags,uint64_t first,uint64_t second,uint32_t value,uint32_t detail,const uint8_t *hashed_bytes,uint64_t hashed_byte_count);
cadr_status cadr_disk_evidence_serialized_size(const cadr_disk_evidence_log *log,uint64_t *byte_count);
cadr_status cadr_disk_evidence_serialize(const cadr_disk_evidence_log *log,uint8_t *bytes,uint64_t capacity,uint64_t *written);

#endif
