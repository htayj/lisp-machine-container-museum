#ifndef CADR_DISK_STATE_H
#define CADR_DISK_STATE_H

#include <stdint.h>

/*
 * D0 is a state-only adaptation of pinned usim 330d8248 disk-controller.c
 * for the System 303 T-300 boot disk.  The external disk-unit's mmap, file
 * descriptor, and worker thread deliberately do not enter this record.
 */
#define CADR_DISK_COMPAT_SYSTEM_303 UINT32_C(1)
#define CADR_DISK_COMPAT_USIM_330D  UINT32_C(2)

#define CADR_DISK_BLOCK_BYTES UINT32_C(1024)
#define CADR_DISK_BLOCK_WORDS UINT32_C(256)
#define CADR_DISK_T300_CYLINDERS UINT32_C(815)
#define CADR_DISK_T300_HEADS UINT32_C(19)
#define CADR_DISK_T300_BLOCKS_PER_TRACK UINT32_C(17)

/* Bits are the observable 32-bit controller status register. */
#define CADR_DISK_STATUS_READ_COMPARE (UINT32_C(1) << 22U)
#define CADR_DISK_STATUS_CCW_CYCLE    (UINT32_C(1) << 21U)
#define CADR_DISK_STATUS_NXM          (UINT32_C(1) << 20U)
#define CADR_DISK_STATUS_SEEK_ERROR   (UINT32_C(1) << 10U)
#define CADR_DISK_STATUS_OFFLINE      (UINT32_C(1) << 9U)
#define CADR_DISK_STATUS_READ_ONLY    (UINT32_C(1) << 7U)
#define CADR_DISK_STATUS_FAULT        (UINT32_C(1) << 6U)
#define CADR_DISK_STATUS_INTERRUPT    (UINT32_C(1) << 3U)
#define CADR_DISK_STATUS_ATTENTION    (UINT32_C(1) << 2U)
#define CADR_DISK_STATUS_ANY_ATTENTION (UINT32_C(1) << 1U)
#define CADR_DISK_STATUS_NOT_ACTIVE   (UINT32_C(1))

typedef struct cadr_disk_state {
    uint64_t pending_first_block;
    uint32_t compatibility_profile;
    uint32_t command;
    uint32_t command_list_pointer;
    uint32_t disk_address;
    uint32_t last_memory_address;
    uint32_t pending_ccw_address;
    uint32_t pending_memory_address;
    uint32_t pending_ccw;
    uint32_t status;
    uint32_t transfer_active;
    uint32_t reset_condition;
    uint32_t done_interrupt_enable;
    uint32_t attention_interrupt_enable;
    uint32_t reserved0;
} cadr_disk_state;

#endif
