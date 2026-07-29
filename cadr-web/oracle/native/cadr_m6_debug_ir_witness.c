#include "cadr_m6_debug_ir_witness.h"

#include <inttypes.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Kept weak so the tiny C conformance test can link this translation unit on
 * its own.  In the patched usim executable the real keyboard entry point is
 * present and a missing entry point is a fatal capture error. */
extern void kbd_event(int code, int keydown) __attribute__((weak));
extern void cadet_allup_event(int mods) __attribute__((weak));

struct schedule_event {
    uint64_t due;
    unsigned ordinal;
    unsigned scancode;
    unsigned phase;                 /* 0 boot, 1 A, 2 B (requires A). */
};

static FILE *schedule_file, *capture_file;
static FILE *samples_file;
static struct schedule_event next_event;
static unsigned expected_events, consumed_events, write_count, suffix_count;
static int have_event, initialized, failed, seen_a, seen_b, seen_c, capture_a, capture_b, capture_c, cleanup_settled, capture_settled;
static uint64_t c_listener_idle_deadline, c_cleanup_start;
static char session_id[129];
static void fail(const char *message);
static const uint32_t expected_write_addresses[] = {
    CADR_M6_DEBUG_IR_LOW, CADR_M6_DEBUG_IR_MID, CADR_M6_DEBUG_IR_HIGH,
    CADR_M6_DEBUG_IR_LOW, CADR_M6_DEBUG_IR_MID, CADR_M6_DEBUG_IR_HIGH,
    CADR_M6_DEBUG_IR_LOW, CADR_M6_DEBUG_IR_MID, CADR_M6_DEBUG_IR_HIGH,
};
static const uint16_t expected_write_values[] = {
    CADR_M6_FORM_A_WORD0, CADR_M6_FORM_A_WORD1, CADR_M6_FORM_A_WORD2,
    CADR_M6_FORM_B_WORD0, CADR_M6_FORM_B_WORD1, CADR_M6_FORM_B_WORD2,
    CADR_M6_FORM_C_WORD0, CADR_M6_FORM_C_WORD1, CADR_M6_FORM_C_WORD2,
};

extern uint64_t p0 __attribute__((weak)), p1 __attribute__((weak));
extern uint32_t p0_pc __attribute__((weak)), p1_pc __attribute__((weak)), npc __attribute__((weak)), lc __attribute__((weak)), interrupt_control __attribute__((weak));
extern int interrupt_status_reg __attribute__((weak)), interrupt_pending_flag __attribute__((weak));
extern uint32_t iob_csr __attribute__((weak)), kbd_scancode __attribute__((weak));
extern uint32_t cadr_m6_keyboard_fifo_count(void) __attribute__((weak));
extern uint32_t cadr_m6_disk_status(void) __attribute__((weak));
extern uint32_t cadr_m6_disk_outstanding_operation(void) __attribute__((weak));
extern uint32_t cadr_m6_disk_interrupt_request(void) __attribute__((weak));
extern void tv_assert_interrupt(void) __attribute__((weak));
extern void colortv_assert_interrupt(void) __attribute__((weak));
extern bool colortv_enabled __attribute__((weak));
extern uint16_t the_60_cycle_clock __attribute__((weak));
extern void tv_save_screenshot(char *filename) __attribute__((weak));
static uint64_t clock_events;

static void put32le(unsigned char *at, uint32_t value)
{ unsigned index; for (index = 0; index != 4; ++index) at[index] = (unsigned char)(value >> (8U * index)); }
static void put64le(unsigned char *at, uint64_t value)
{ unsigned index; for (index = 0; index != 8; ++index) at[index] = (unsigned char)(value >> (8U * index)); }

static int c_cleanup_state_is_stable(uint64_t debug_ir, uint32_t observed_iob_csr,
                                     uint32_t observed_kbd_scancode,
                                     uint32_t disk_busy, uint32_t host_request_pending)
{
    if ((debug_ir & UINT64_C(0xffffffffffff)) !=
        ((uint64_t)CADR_M6_FORM_C_WORD0 | ((uint64_t)CADR_M6_FORM_C_WORD1 << 16) |
         ((uint64_t)CADR_M6_FORM_C_WORD2 << 32))) {
        fail("C-cleanup-debug-ir-changed"); return 0;
    }
    if (cadr_m6_keyboard_fifo_count == NULL) {
        fail("missing-C-cleanup-keyboard-projection"); return 0;
    }
    if ((observed_iob_csr & (1U << 5)) != 0 || observed_kbd_scancode != 0x18000U ||
        cadr_m6_keyboard_fifo_count() != 0 ||
        disk_busy != 0 || host_request_pending != 0) {
        fail("C-cleanup-invariant-changed"); return 0;
    }
    return 1;
}

static void write_idle_sample(uint64_t debug_ir, uint32_t iob_csr, uint32_t kbd_scancode,
                              uint32_t disk_busy, uint32_t host_request_pending)
{
    unsigned char sample[96] = {0};
    if (samples_file == NULL) { fail("missing-idle-sample-file"); return; }
    if (&p0 == NULL || &p1 == NULL || &p0_pc == NULL || &p1_pc == NULL ||
        &npc == NULL || &lc == NULL || &interrupt_control == NULL ||
        &interrupt_status_reg == NULL || &interrupt_pending_flag == NULL) {
        fail("missing-native-projection-state"); return;
    }
    if (cadr_m6_keyboard_fifo_count == NULL || cadr_m6_disk_status == NULL ||
        cadr_m6_disk_outstanding_operation == NULL || cadr_m6_disk_interrupt_request == NULL) {
        fail("missing-native-projection-getter"); return;
    }
    memcpy(sample, "CDRM6I1", 8);
    put64le(sample + 8, debug_ir & UINT64_C(0xffffffffffff));
    put64le(sample + 16, p0 & UINT64_C(0xffffffffffff));
    put64le(sample + 24, p1 & UINT64_C(0xffffffffffff));
    put32le(sample + 32, p0_pc); put32le(sample + 36, p1_pc);
    put32le(sample + 40, npc); put32le(sample + 44, lc);
    put32le(sample + 48, interrupt_control); put32le(sample + 52, (uint32_t)interrupt_status_reg);
    put32le(sample + 56, (uint32_t)interrupt_pending_flag); put32le(sample + 60, iob_csr);
    put32le(sample + 64, cadr_m6_keyboard_fifo_count()); put32le(sample + 68, kbd_scancode);
    put32le(sample + 72, cadr_m6_disk_status()); put32le(sample + 76, disk_busy);
    put32le(sample + 80, cadr_m6_disk_outstanding_operation());
    put32le(sample + 84, cadr_m6_disk_interrupt_request());
    /* M6 has no deferred host completion queue. */
    put32le(sample + 88, host_request_pending); put32le(sample + 92, 0);
    if (fwrite(sample, 1, sizeof(sample), samples_file) != sizeof(sample)) fail("cannot-write-idle-sample");
}

static void fail(const char *message)
{
    const char *screenshot = getenv("CADR_M6_FAILURE_SCREENSHOT");
    if (screenshot != NULL && tv_save_screenshot != NULL && !failed)
        tv_save_screenshot((char *)screenshot);
    if (!failed && capture_file != NULL) {
        (void)fprintf(capture_file, "{\"kind\":\"failure\",\"reason\":\"%s\"}\n", message);
        (void)fflush(capture_file);
    }
    failed = 1;
}

static void emit(const char *format, ...)
{
    va_list arguments;
    if (capture_file == NULL) return;
    va_start(arguments, format);
    (void)vfprintf(capture_file, format, arguments);
    va_end(arguments);
    (void)fputc('\n', capture_file);
    (void)fflush(capture_file);
}

static int valid_session_id(const char *value)
{
    size_t index, length;
    if (value == NULL || (length = strlen(value)) == 0 || length >= sizeof(session_id)) return 0;
    for (index = 0; index != length; ++index) {
        const unsigned char character = (unsigned char)value[index];
        if (!((character >= 'a' && character <= 'z') ||
              (character >= 'A' && character <= 'Z') ||
              (character >= '0' && character <= '9') ||
              character == '-' || character == '_')) return 0;
    }
    return 1;
}

static void read_next(void)
{
    unsigned long long due;
    unsigned scancode, phase, ordinal;
    if (schedule_file == NULL) return;
    if (fscanf(schedule_file, "%llu %u %o %u", &due, &ordinal, &scancode, &phase) == 4) {
        if (phase > 2 || scancode > 0177777 || ordinal != consumed_events) {
            fail("malformed-or-noncanonical-schedule"); return;
        }
        next_event.due = (uint64_t)due; next_event.ordinal = ordinal;
        next_event.scancode = scancode; next_event.phase = phase; have_event = 1;
        return;
    }
    if (!feof(schedule_file)) fail("malformed-schedule");
    have_event = 0;
    (void)fclose(schedule_file); schedule_file = NULL;
}

void cadr_m6_witness_init(void)
{
    const char *schedule = getenv("CADR_M6_RAW_SCHEDULE");
    const char *capture = getenv("CADR_M6_NATIVE_LOG");
    const char *samples = getenv("CADR_M6_IDLE_SAMPLES");
    const char *session = getenv("CADR_M6_SESSION_ID");
    char digest[65] = {0};
    if (initialized) { fail("witness-initialized-twice"); return; }
    initialized = 1;
    if (schedule == NULL || capture == NULL || samples == NULL || !valid_session_id(session)) { fail("missing-witness-environment"); return; }
    (void)memcpy(session_id, session, strlen(session) + 1U);
    schedule_file = fopen(schedule, "r"); capture_file = fopen(capture, "w"); samples_file = fopen(samples, "wb");
    if (schedule_file == NULL || capture_file == NULL || samples_file == NULL) { fail("cannot-open-witness-file"); return; }
    if (fscanf(schedule_file, "CADR-M6-SCHEDULE-v1 %64[0-9a-f] %u", digest, &expected_events) != 2 ||
        strlen(digest) != 64 || expected_events == 0) { fail("invalid-schedule-header"); return; }
    emit("{\"kind\":\"meta\",\"schema\":\"cadr-m6-native-raw-v2\",\"schedule_sha256\":\"%s\",\"schedule_events\":%u,\"session_id\":\"%s\"}", digest, expected_events, session_id);
    read_next();
}

uint32_t cadr_m6_debug_ir_address_allowed(uint32_t address)
{
    return address == CADR_M6_DEBUG_IR_LOW || address == CADR_M6_DEBUG_IR_MID ||
           address == CADR_M6_DEBUG_IR_HIGH ? 1U : 0U;
}

uint32_t cadr_m6_debug_ir_match(uint16_t low, uint16_t middle, uint16_t high)
{
    if (low == CADR_M6_FORM_A_WORD0 && middle == CADR_M6_FORM_A_WORD1 && high == CADR_M6_FORM_A_WORD2) return CADR_M6_WITNESS_A;
    if (low == CADR_M6_FORM_B_WORD0 && middle == CADR_M6_FORM_B_WORD1 && high == CADR_M6_FORM_B_WORD2) return CADR_M6_WITNESS_B;
    if (low == CADR_M6_FORM_C_WORD0 && middle == CADR_M6_FORM_C_WORD1 && high == CADR_M6_FORM_C_WORD2) return CADR_M6_WITNESS_C;
    return CADR_M6_WITNESS_NONE;
}

void cadr_m6_witness_debug_write(uint64_t boundary, uint32_t address, uint16_t value, uint64_t debug_ir)
{
    uint32_t match;
    if (!initialized || failed) return;
    if (write_count >= sizeof(expected_write_addresses) / sizeof(expected_write_addresses[0]) ||
        address != expected_write_addresses[write_count] ||
        value != expected_write_values[write_count]) {
        fail("noncanonical-debug-ir-write"); return;
    }
    ++write_count;
    emit("{\"kind\":\"write\",\"boundary\":%" PRIu64 ",\"address\":%u,\"value\":%u}", boundary, address, value);
    /* The first low-word write for B retains A's middle/high words.  Do not
     * classify any partial DEBUG-IR value: recognize only the complete,
     * source-ordered triplet. */
    if (write_count != 3 && write_count != 6 && write_count != 9) return;
    match = cadr_m6_debug_ir_match((uint16_t)debug_ir, (uint16_t)(debug_ir >> 16), (uint16_t)(debug_ir >> 32));
    if (write_count == 3) {
        if (match != CADR_M6_WITNESS_A || seen_a) fail("invalid-A-write-sequence");
        else { seen_a = 1; capture_a = 1; }
    } else if (write_count == 6) {
        if (match != CADR_M6_WITNESS_B || !seen_a || seen_b) fail("invalid-B-write-sequence");
        else {
            seen_b = 1; capture_b = 1;
            c_listener_idle_deadline = boundary + CADR_M6_C_LISTENER_IDLE_TIMEOUT;
        }
    } else {
        if (match != CADR_M6_WITNESS_C || !seen_b || seen_c) fail("invalid-C-listener-idle-write-sequence");
        else { seen_c = 1; capture_c = 1; }
    }
}

int cadr_m6_witness_boundary(uint64_t boundary, uint64_t debug_ir, uint32_t observed_iob_csr,
                              uint32_t observed_kbd_scancode, uint16_t sixty_cycle_clock,
                              uint32_t disk_busy, uint32_t host_request_pending)
{
    int selected = capture_a || capture_b || capture_c;
    if (!initialized || failed) return 0;
    /* M5 policy: dispatch the guest 60 Hz edge before a coincident key. */
    while (((clock_events + 1U) * UINT64_C(1000000) + 59U) / 60U == boundary) {
        if (tv_assert_interrupt == NULL || colortv_assert_interrupt == NULL || &colortv_enabled == NULL || &the_60_cycle_clock == NULL) { fail("missing-60hz-device"); return 0; }
        ++the_60_cycle_clock; tv_assert_interrupt(); if (colortv_enabled) colortv_assert_interrupt(); ++clock_events;
        emit("{\"kind\":\"clock\",\"ordinal\":%" PRIu64 ",\"due_boundary\":%" PRIu64 ",\"color_enabled\":%u,\"policy\":\"ceil(n*1000000/60)\"}", clock_events, boundary, colortv_enabled ? 1U : 0U);
    }
    if (have_event && boundary > next_event.due) { fail("missed-strict-guest-boundary"); return 0; }
    if (seen_b && !seen_c && boundary > c_listener_idle_deadline) {
        fail("missing-C-listener-idle-marker"); return 0;
    }
    if (have_event && boundary == next_event.due) {
        if (next_event.phase == 2 && !seen_a) { fail("B-before-A-gate"); return 0; }
        if (kbd_event == NULL || cadet_allup_event == NULL) { fail("missing-native-keyboard-entrypoint"); return 0; }
        if (&iob_csr == NULL || &kbd_scancode == NULL || &interrupt_status_reg == NULL || cadr_m6_keyboard_fifo_count == NULL) { fail("missing-keyboard-projection-state"); return 0; }
        (void)observed_iob_csr; (void)observed_kbd_scancode;
        if (next_event.scancode & 0x8000U) cadet_allup_event((int)(next_event.scancode & 01777U));
        else kbd_event((int)(next_event.scancode & 0177U), 1);
        emit("{\"kind\":\"event\",\"ordinal\":%u,\"due_boundary\":%" PRIu64 ",\"scancode\":%u,\"phase\":%u}", next_event.ordinal, boundary, next_event.scancode, next_event.phase);
        ++consumed_events; read_next();
    }
    if (capture_a) { selected = 1; capture_a = 0; }
    if (capture_b) { selected = 1; capture_b = 0; }
    if (capture_c) {
        selected = 1; capture_c = 0;
        c_cleanup_start = boundary;
    } else if (seen_c && !cleanup_settled) {
        if (!c_cleanup_state_is_stable(debug_ir, iob_csr, kbd_scancode,
                                       disk_busy, host_request_pending)) return 0;
        if (boundary - c_cleanup_start == CADR_M6_C_LISTENER_IDLE_CLEANUP_HOLD) {
            cleanup_settled = 1; capture_settled = 1;
        }
    }
    if (capture_settled) {
        emit("{\"kind\":\"settled\",\"ordinal\":%" PRIu64 ",\"cleanup_hold_boundaries\":%" PRIu64 ",\"debug_ir_words\":[%u,%u,%u],\"state\":{\"scheduler\":{\"machine_cycles\":%" PRIu64 ",\"halted\":0,\"pending_count\":0},\"keyboard\":{\"scancode\":%u,\"ready\":%u,\"fifo_count\":%u},\"iob\":{\"csr\":%u,\"sixty_cycle_clock\":%u},\"disk\":{\"status\":%u,\"busy\":%u,\"outstanding_operation\":%u,\"interrupt_request\":%u,\"fault\":0},\"host\":{\"request_pending\":%u,\"completion_queued\":0,\"outstanding_request_id\":0},\"completion\":{\"schedule_consumed\":%u,\"debug_ir_writes\":%u}}}", boundary, CADR_M6_C_LISTENER_IDLE_CLEANUP_HOLD, (unsigned)(debug_ir & UINT64_C(0xffff)), (unsigned)((debug_ir >> 16) & UINT64_C(0xffff)), (unsigned)((debug_ir >> 32) & UINT64_C(0xffff)), boundary, kbd_scancode, (iob_csr >> 5) & 1U, cadr_m6_keyboard_fifo_count(), iob_csr, sixty_cycle_clock, cadr_m6_disk_status(), disk_busy, cadr_m6_disk_outstanding_operation(), cadr_m6_disk_interrupt_request(), host_request_pending, consumed_events, write_count);
        capture_settled = 0;
    } else if (cleanup_settled && suffix_count < 64) {
        ++suffix_count; selected = 1;
        write_idle_sample(debug_ir, iob_csr, kbd_scancode, disk_busy, host_request_pending);
    }
    if (selected) emit("{\"kind\":\"boundary\",\"ordinal\":%" PRIu64 ",\"debug_ir_words\":[%u,%u,%u],\"state\":{\"scheduler\":{\"machine_cycles\":%" PRIu64 ",\"halted\":0,\"pending_count\":0},\"keyboard\":{\"scancode\":%u,\"ready\":%u,\"fifo_count\":%u},\"iob\":{\"csr\":%u,\"sixty_cycle_clock\":%u},\"disk\":{\"status\":%u,\"busy\":%u,\"outstanding_operation\":%u,\"interrupt_request\":%u,\"fault\":0},\"host\":{\"request_pending\":%u,\"completion_queued\":0,\"outstanding_request_id\":0},\"completion\":{\"schedule_consumed\":%u,\"debug_ir_writes\":%u}}}", boundary, (unsigned)(debug_ir & UINT64_C(0xffff)), (unsigned)((debug_ir >> 16) & UINT64_C(0xffff)), (unsigned)((debug_ir >> 32) & UINT64_C(0xffff)), boundary, kbd_scancode, (iob_csr >> 5) & 1U, cadr_m6_keyboard_fifo_count(), iob_csr, sixty_cycle_clock, cadr_m6_disk_status(), disk_busy, cadr_m6_disk_outstanding_operation(), cadr_m6_disk_interrupt_request(), host_request_pending, consumed_events, write_count);
    if (seen_c && cleanup_settled && suffix_count == 64 && !have_event && consumed_events == expected_events && write_count == 9 && !disk_busy && !host_request_pending) return 1;
    return 0;
}

void cadr_m6_witness_finish(int halted)
{
    if (capture_file == NULL) return;
    if (!failed && (!halted || !seen_a || !seen_b || !seen_c || !cleanup_settled || suffix_count != 64 || have_event || consumed_events != expected_events || write_count != 9)) fail("incomplete-witness");
    if (!failed) emit("{\"kind\":\"complete\",\"clean_shutdown\":true,\"schedule_consumed\":%u,\"debug_ir_writes\":%u}", consumed_events, write_count);
    (void)fclose(capture_file); capture_file = NULL;
    if (samples_file != NULL) { (void)fclose(samples_file); samples_file = NULL; }
}
