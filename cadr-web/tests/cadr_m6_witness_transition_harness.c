#define _POSIX_C_SOURCE 200809L

#include "cadr_m6_debug_ir_witness.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Supply the native projection symbols that the production witness requires
 * when it serializes a selected boundary.  This is intentionally a linked
 * exercise of the production state machine, not a JSON fixture mutation. */
uint64_t p0, p1;
uint32_t p0_pc, p1_pc, npc, lc, interrupt_control, iob_csr, kbd_scancode;
int interrupt_status_reg, interrupt_pending_flag;
bool colortv_enabled;
uint16_t the_60_cycle_clock;

/* These are deliberately mutable only in the linked transition harness.  The
 * production witness receives the corresponding projections from the native
 * simulator; this fixture varies one projection at a time after the real C
 * marker transition so each direct cleanup guard can be observed. */
static uint32_t keyboard_fifo_count;

uint32_t cadr_m6_keyboard_fifo_count(void) { return keyboard_fifo_count; }
uint32_t cadr_m6_disk_status(void) { return 3; }
uint32_t cadr_m6_disk_outstanding_operation(void) { return 0; }
uint32_t cadr_m6_disk_interrupt_request(void) { return 1; }
void tv_assert_interrupt(void) {}
void colortv_assert_interrupt(void) {}

static const uint64_t form_a = UINT64_C(0xa55a41314d36);
static const uint64_t form_b = UINT64_C(0x5aa542324d36);
static const uint64_t form_c = UINT64_C(0x4c4549444d36);

static void set_environment(const char *schedule, const char *capture,
                            const char *samples)
{
    (void)setenv("CADR_M6_RAW_SCHEDULE", schedule, 1);
    (void)setenv("CADR_M6_NATIVE_LOG", capture, 1);
    (void)setenv("CADR_M6_IDLE_SAMPLES", samples, 1);
    (void)setenv("CADR_M6_SESSION_ID", "strict-transition-harness", 1);
}

static void write_a(uint64_t boundary)
{
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_LOW,
                                CADR_M6_FORM_A_WORD0, 0);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_MID,
                                CADR_M6_FORM_A_WORD1, 0);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_HIGH,
                                CADR_M6_FORM_A_WORD2, form_a);
}

static void write_b(uint64_t boundary)
{
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_LOW,
                                CADR_M6_FORM_B_WORD0, form_a);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_MID,
                                CADR_M6_FORM_B_WORD1, form_a);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_HIGH,
                                CADR_M6_FORM_B_WORD2, form_b);
}

static void write_c(uint64_t boundary)
{
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_LOW,
                                CADR_M6_FORM_C_WORD0, form_b);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_MID,
                                CADR_M6_FORM_C_WORD1, form_b);
    cadr_m6_witness_debug_write(boundary, CADR_M6_DEBUG_IR_HIGH,
                                CADR_M6_FORM_C_WORD2, form_c);
}

static void boundary(uint64_t ordinal, uint64_t debug_ir, uint32_t iob,
                     uint32_t scancode, uint32_t disk_busy,
                     uint32_t host_request_pending)
{
    (void)cadr_m6_witness_boundary(ordinal, debug_ir, iob, scancode,
                                   0, disk_busy, host_request_pending);
}

static void stable_boundary(uint64_t ordinal)
{
    boundary(ordinal, form_c, 0, UINT32_C(0x18000), 0, 0);
}

static void begin_c_cleanup(void)
{
    keyboard_fifo_count = 0;
    write_a(10); write_b(10); write_c(10);
    stable_boundary(10);
}

int main(int argc, char **argv)
{
    if (argc != 5) return 64;
    set_environment(argv[2], argv[3], argv[4]);
    if (strcmp(argv[1], "missing-environment") == 0)
        (void)unsetenv("CADR_M6_SESSION_ID");
    cadr_m6_witness_init();

    if (strcmp(argv[1], "missing-environment") == 0 ||
               strcmp(argv[1], "invalid-schedule-header") == 0 ||
               strcmp(argv[1], "malformed-schedule") == 0 ||
               strcmp(argv[1], "noncanonical-schedule-phase") == 0 ||
               strcmp(argv[1], "noncanonical-schedule-scancode") == 0 ||
               strcmp(argv[1], "noncanonical-schedule-ordinal") == 0) {
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "incomplete") == 0) {
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "duplicate") == 0) {
        cadr_m6_witness_debug_write(0, CADR_M6_DEBUG_IR_LOW,
                                    CADR_M6_FORM_A_WORD0, 0);
        /* LOW is required only once; this second LOW is a real duplicate. */
        cadr_m6_witness_debug_write(1, CADR_M6_DEBUG_IR_LOW,
                                    CADR_M6_FORM_A_WORD0, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "partial") == 0) {
        cadr_m6_witness_debug_write(0, CADR_M6_DEBUG_IR_LOW,
                                    CADR_M6_FORM_A_WORD0, 0);
        cadr_m6_witness_debug_write(0, CADR_M6_DEBUG_IR_MID,
                                    CADR_M6_FORM_A_WORD1, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "reordered") == 0) {
        cadr_m6_witness_debug_write(0, CADR_M6_DEBUG_IR_HIGH,
                                    CADR_M6_FORM_A_WORD2, form_a);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "late-c") == 0) {
        write_a(0); write_b(0);
        boundary(CADR_M6_C_LISTENER_IDLE_TIMEOUT + 1, form_b, 0,
                 UINT32_C(0x18000), 0, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-debug-ir") == 0) {
        begin_c_cleanup();
        boundary(11, form_b, 0, UINT32_C(0x18000), 0, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-kbd-scancode") == 0) {
        begin_c_cleanup();
        boundary(11, form_c, 0, UINT32_C(0x18001), 0, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-kbd-fifo") == 0) {
        begin_c_cleanup();
        keyboard_fifo_count = 1;
        stable_boundary(11);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-iob-ready") == 0) {
        begin_c_cleanup();
        boundary(11, form_c, UINT32_C(1) << 5, UINT32_C(0x18000), 0, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-disk-busy") == 0) {
        begin_c_cleanup();
        boundary(11, form_c, 0, UINT32_C(0x18000), 1, 0);
        cadr_m6_witness_finish(1);
    } else if (strcmp(argv[1], "cleanup-host-request") == 0) {
        begin_c_cleanup();
        boundary(11, form_c, 0, UINT32_C(0x18000), 0, 1);
        cadr_m6_witness_finish(1);
    } else {
        return 65;
    }
    return 0;
}
