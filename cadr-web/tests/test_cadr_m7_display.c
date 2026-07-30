#include "cadr_boundary_state.h"
#include "cadr_bus_device.h"
#include "cadr_display.h"
#include "cadr_machine.h"
#include "cadr_state_v2.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failures;
#define CHECK(x) do { if (!(x)) { (void)fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #x); ++failures; } } while (0)

static uint32_t get32(const uint8_t *p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8U) | ((uint32_t)p[2] << 16U) | ((uint32_t)p[3] << 24U); }
static uint64_t get64(const uint8_t *p)
{
    uint64_t value = 0U;
    uint32_t index;
    for (index = 0U; index < 8U; ++index) {
        value |= (uint64_t)p[index] << (index * 8U);
    }
    return value;
}
static void put32(uint8_t *p, uint32_t v) { p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8U); p[2] = (uint8_t)(v >> 16U); p[3] = (uint8_t)(v >> 24U); }

static void test_abi_literal_values(void)
{
    cadr_abi_info abi = { 0U, 0U, 0U, 0U };
    CHECK(CADR_ABI_MINOR_M5 == UINT32_C(4));
    CHECK(CADR_ABI_MINOR_M6 == UINT32_C(4));
    CHECK(CADR_ABI_MINOR_M7 == UINT32_C(5));
    CHECK(CADR_ABI_MINOR == UINT32_C(5));
    cadr_get_abi_info(&abi);
    CHECK(abi.abi_major == UINT32_C(1) && abi.abi_minor == UINT32_C(5));
}

static cadr_machine *machine(void)
{
    static const uint8_t empty_mutation_sha256[CADR_SHA256_BYTES] = {
        0xd2U,0xb2U,0x1aU,0x8fU,0xbbU,0xb3U,0x1eU,0xa2U,
        0xdaU,0x26U,0xe9U,0x43U,0x97U,0x86U,0x5bU,0x79U,
        0xa2U,0x2fU,0x06U,0x20U,0xa2U,0xedU,0x2dU,0xc9U,
        0xeeU,0x50U,0x92U,0x4dU,0x4aU,0xe2U,0x1eU,0x86U
    };
    cadr_machine_config config = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_machine_config), 0U, CADR_PROFILE_CADR_WEB_303, 0U };
    cadr_machine *result = NULL;
    CHECK(cadr_machine_create(&config, &result) == CADR_STATUS_OK);
    if (result != NULL) {
        result->state.lifecycle = CADR_MACHINE_RUNNING;
        result->state.scheduler.phase = CADR_SCHEDULER_PHASE_BOUNDARY_READY;
        result->state.scheduler.hidden_policy = CADR_SCHEDULER_HIDDEN_PAUSE;
        result->state.devices.initialized = 1U;
        result->state.devices.disk.compatibility_profile = CADR_DISK_COMPAT_SYSTEM_303;
        result->state.devices.disk.status = CADR_DISK_STATUS_NOT_ACTIVE;
        CHECK(cadr_canonical_rebuild(&result->state) == CADR_STATUS_OK);
        (void)memcpy(result->state.canonical.mutation_sha256, empty_mutation_sha256,
                     sizeof(empty_mutation_sha256));
        result->state.canonical.initialized = 1U;
        CHECK(cadr_state_v2_rebuild(&result->state) == CADR_STATUS_OK);
    }
    return result;
}

static cadr_display_info info(cadr_machine *machine)
{
    cadr_display_info result = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_display_info), 0U, 0U, 0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U };
    CHECK(cadr_machine_display_info(machine, &result) == CADR_STATUS_OK);
    return result;
}

static uint8_t *take(cadr_machine *machine, cadr_display_info view, uint64_t *out_size)
{
    uint8_t *bytes;
    uint64_t size = 0U;
    uint64_t written = 0U;
    CHECK(cadr_machine_display_update_size(machine, &size) == CADR_STATUS_OK);
    bytes = malloc((size_t)size);
    if (bytes == NULL) return NULL;
    CHECK(cadr_machine_display_update_take(machine, view.machine_generation,
          view.framebuffer_generation, bytes, size, &written) == CADR_STATUS_OK);
    CHECK(written == size);
    CHECK(cadr_display_record_validate(bytes, written) == CADR_STATUS_OK);
    *out_size = written;
    return bytes;
}

static void test_full_and_word_boundaries(void)
{
    cadr_machine *m = machine();
    cadr_display_info view;
    uint8_t *bytes;
    uint64_t size;
    if (m == NULL) return;
    view = info(m);
    CHECK(view.framebuffer_generation == 1U && view.full_refresh == 1U);
    bytes = take(m, view, &size);
    if (bytes != NULL) {
        CHECK(size == 92544U &&
              get32(bytes + 12U) ==
                  (CADR_DISPLAY_FLAG_FULL | CADR_DISPLAY_FLAG_ZERO_IS_BLACK));
        CHECK(get32(bytes + 56U) == 1U && get32(bytes + 60U) == CADR_DISPLAY_ACTIVE_WORDS);
        free(bytes);
    }
    CHECK(cadr_tv_write(&m->state, 0U, UINT32_C(0x80000001)) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.framebuffer_generation == 2U && view.full_refresh == 0U);
    bytes = take(m, view, &size);
    if (bytes != NULL) {
        CHECK(get32(bytes + 56U) == 1U && get32(bytes + 80U) == 0U && get32(bytes + 84U) == 0U);
        CHECK(get32(bytes + 88U) == 32U && get32(bytes + 92U) == 1U && get32(bytes + 96U) == UINT32_C(0x80000001));
        free(bytes);
    }
    view = info(m);
    CHECK(view.framebuffer_generation == 2U);
    CHECK(cadr_tv_write(&m->state, CADR_DISPLAY_ACTIVE_WORDS - 1U, UINT32_C(0x80000001)) == CADR_STATUS_OK);
    CHECK(cadr_tv_write(&m->state, CADR_DISPLAY_ACTIVE_WORDS, UINT32_C(0xffffffff)) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.framebuffer_generation == 3U);
    bytes = take(m, view, &size);
    if (bytes != NULL) {
        CHECK(get32(bytes + 80U) == 736U && get32(bytes + 84U) == 962U &&
              get32(bytes + 88U) == 32U && get32(bytes + 92U) == 1U);
        free(bytes);
    }
    cadr_machine_destroy(m);
}

static void test_polarity_spans_and_failures(void)
{
    cadr_machine *m = machine();
    cadr_display_info view;
    uint8_t *bytes;
    uint64_t size;
    uint64_t written = 99U;
    if (m == NULL) return;
    bytes = take(m, info(m), &size); free(bytes);
    CHECK(cadr_tv_control_write(&m->state, 0U, UINT32_C(4)) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.framebuffer_generation == 2U && view.full_refresh == 1U);
    bytes = take(m, view, &size);
    if (bytes != NULL) { CHECK(get32(bytes + 12U) == CADR_DISPLAY_FLAG_FULL); free(bytes); }
    CHECK(cadr_tv_control_write(&m->state, 0U, UINT32_C(12)) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.framebuffer_generation == 2U);
    CHECK(cadr_tv_write(&m->state, 10U * 24U + 1U, 1U) == CADR_STATUS_OK);
    CHECK(cadr_tv_write(&m->state, 10U * 24U + 3U, 3U) == CADR_STATUS_OK);
    CHECK(cadr_tv_write(&m->state, 11U * 24U + 1U, 5U) == CADR_STATUS_OK);
    CHECK(cadr_tv_write(&m->state, 11U * 24U + 3U, 7U) == CADR_STATUS_OK);
    view = info(m);
    CHECK(cadr_machine_display_update_size(m, &size) == CADR_STATUS_OK);
    bytes = malloc((size_t)size);
    if (bytes == NULL) { cadr_machine_destroy(m); return; }
    CHECK(cadr_machine_display_update_take(m, view.machine_generation + 1U,
          view.framebuffer_generation, bytes, size, &written) == CADR_STATUS_STALE_GENERATION && written == 0U);
    CHECK(cadr_machine_display_update_take(m, view.machine_generation,
          view.framebuffer_generation, bytes, 1U, &written) == CADR_STATUS_WRONG_LENGTH && written == 0U);
    free(bytes);
    bytes = take(m, view, &size);
    if (bytes != NULL) {
        uint8_t overlap[120] = { 0U };
        CHECK(get32(bytes + 56U) == 1U && get32(bytes + 80U) == 32U && get32(bytes + 84U) == 10U &&
              get32(bytes + 88U) == 96U && get32(bytes + 92U) == 2U && get32(bytes + 60U) == 6U);
        bytes[0] ^= 1U; CHECK(cadr_display_record_validate(bytes, size) == CADR_STATUS_INVALID_ARGUMENT); bytes[0] ^= 1U;
        bytes[12] |= UINT8_C(0x80); CHECK(cadr_display_record_validate(bytes, size) == CADR_STATUS_INVALID_ARGUMENT);
        bytes[12] &= UINT8_C(0x7f);
        (void)memcpy(overlap, bytes, 96U);
        put32(overlap + 56U, 2U); put32(overlap + 60U, 2U); put32(overlap + 64U, 8U); put32(overlap + 72U, 120U);
        put32(overlap + 88U, 32U); put32(overlap + 92U, 1U);
        (void)memcpy(overlap + 96U, overlap + 80U, 16U);
        CHECK(cadr_display_record_validate(overlap, sizeof(overlap)) == CADR_STATUS_INVALID_ARGUMENT);
        free(bytes);
    }
    cadr_machine_destroy(m);
}

static void test_derived_digest_reset_and_restore(void)
{
    cadr_machine *m = machine();
    cadr_machine *restored = NULL;
    cadr_display_info view;
    cadr_snapshot_request request = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_snapshot_request), 0U };
    cadr_reset_request reset = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_reset_request), 0U };
    uint8_t before[32], after[32];
    uint8_t *snapshot = NULL;
    uint64_t snapshot_size = 0U;
    uint64_t written = 0U;
    if (m == NULL) return;
    CHECK(cadr_tv_write(&m->state, 24U + 1U, UINT32_C(0x80000001)) == CADR_STATUS_OK);
    CHECK(cadr_machine_state_v5_digest(m, before) == CADR_STATUS_OK);
    view = info(m);
    { uint8_t *bytes = take(m, view, &written); free(bytes); }
    CHECK(cadr_machine_state_v5_digest(m, after) == CADR_STATUS_OK && memcmp(before, after, 32U) == 0);
    CHECK(cadr_machine_snapshot_size(m, &request, &snapshot_size) == CADR_STATUS_OK);
    snapshot = malloc((size_t)snapshot_size);
    if (snapshot != NULL) {
        CHECK(cadr_machine_snapshot_save(m, &request, snapshot, snapshot_size, &written) == CADR_STATUS_OK);
        {
            const cadr_status restore_status = cadr_machine_snapshot_restore(
                &request, snapshot, written, &restored);
            if (restore_status != CADR_STATUS_OK) {
                (void)fprintf(stderr, "restore status %u\n", restore_status);
            }
            CHECK(restore_status == CADR_STATUS_OK);
        }
        if (restored != NULL) {
            view = info(restored);
            CHECK(view.full_refresh == 1U && view.framebuffer_generation == 1U &&
                  restored->state.devices.tv_screen[25U] == UINT32_C(0x80000001));
        }
    }
    CHECK(cadr_machine_reset(m, &reset) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.full_refresh == 1U && view.framebuffer_generation == 3U &&
          m->state.devices.tv_screen[25U] == UINT32_C(0x80000001));
    m->display.framebuffer_generation = UINT64_MAX;
    CHECK(cadr_tv_write(&m->state, 0U, m->state.devices.tv_screen[0] ^ 1U) == CADR_STATUS_OK);
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_NOT_READY);
    free(snapshot); cadr_machine_destroy(restored); cadr_machine_destroy(m);
}

static void test_cold_power_requires_a_full_replacement(void)
{
    cadr_machine_config config = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_machine_config), 0U, CADR_PROFILE_CADR_WEB_303, 0U };
    cadr_machine *m = NULL;
    cadr_display_info view;
    CHECK(cadr_machine_create(&config, &m) == CADR_STATUS_OK);
    if (m == NULL) return;
    /* Synchronize a changed cold-state framebuffer first.  The host-instance
     * counter must advance across cold power-on and require a full. */
    m->state.devices.tv_screen[0U] = UINT32_C(1);
    view = info(m);
    CHECK(view.framebuffer_generation == UINT64_C(2) && view.full_refresh == 1U);
    m->state.artifacts.boot_configuration_ingressed = 1U;
    m->state.artifacts.control_store_ingressed = 1U;
    m->state.artifacts.base_disk_verified = 1U;
    CHECK(cadr_machine_cold_power_on(m) == CADR_STATUS_OK);
    view = info(m);
    CHECK(view.framebuffer_generation == UINT64_C(3) && view.full_refresh == 1U);
    cadr_machine_destroy(m);
}

static void test_abi_and_transfer_failure_semantics(void)
{
    cadr_machine *m = machine();
    cadr_display_info view = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_display_info), 0U, 0U, 0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U };
    uint8_t byte = 0U;
    uint8_t *bytes;
    uint64_t size = 99U;
    uint64_t written = 99U;
    if (m == NULL) return;

    CHECK(cadr_machine_display_info(NULL, &view) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_machine_display_info(m, NULL) == CADR_STATUS_INVALID_ARGUMENT);
    view.abi_major = CADR_ABI_MAJOR + 1U;
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_ABI_MISMATCH);
    view.abi_major = CADR_ABI_MAJOR;
    view.abi_minor = CADR_ABI_MINOR + 1U;
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_ABI_MISMATCH);
    view.abi_minor = CADR_ABI_MINOR_M6;
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_ABI_MISMATCH);
    view.struct_size = (uint32_t)sizeof(cadr_display_info) - 1U;
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_INVALID_ARGUMENT);
    view.abi_minor = CADR_ABI_MINOR_M7;
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_INVALID_ARGUMENT);
    view.struct_size = (uint32_t)sizeof(cadr_display_info);
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_OK);

    CHECK(cadr_machine_display_update_size(NULL, &size) ==
          CADR_STATUS_INVALID_ARGUMENT && size == 0U);
    CHECK(cadr_machine_display_update_size(m, NULL) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_machine_display_full_size(NULL, &size) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_machine_display_full_size(m, NULL) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(cadr_machine_display_update_take(NULL, 1U, 1U, &byte, 1U, &written) ==
          CADR_STATUS_INVALID_ARGUMENT && written == 0U);
    written = 99U;
    CHECK(cadr_machine_display_update_take(m, 1U, 1U, NULL, 1U, &written) ==
          CADR_STATUS_INVALID_ARGUMENT && written == 0U);
    CHECK(cadr_machine_display_update_take(m, 1U, 1U, &byte, 1U, NULL) ==
          CADR_STATUS_INVALID_ARGUMENT);
    written = 99U;
    CHECK(cadr_machine_display_full_copy(NULL, &byte, 1U, &written) ==
          CADR_STATUS_INVALID_ARGUMENT && written == 0U);
    written = 99U;
    CHECK(cadr_machine_display_full_copy(m, NULL, 1U, &written) ==
          CADR_STATUS_INVALID_ARGUMENT && written == 0U);
    CHECK(cadr_machine_display_full_copy(m, &byte, 1U, NULL) ==
          CADR_STATUS_INVALID_ARGUMENT);

    CHECK(cadr_machine_display_full_size(m, &size) == CADR_STATUS_OK);
    bytes = malloc((size_t)size);
    if (bytes != NULL) {
        written = 99U;
        CHECK(cadr_machine_display_full_copy(m, bytes, size - 1U, &written) ==
              CADR_STATUS_WRONG_LENGTH && written == 0U);
        CHECK(cadr_machine_display_full_copy(m, bytes, size, &written) ==
              CADR_STATUS_OK && written == size);
        CHECK(get32(bytes + 12U) ==
              (CADR_DISPLAY_FLAG_FULL | CADR_DISPLAY_FLAG_ZERO_IS_BLACK));
        CHECK(get64(bytes + 24U) == UINT64_C(2));
        view = info(m);
        CHECK(view.framebuffer_generation == 2U && view.full_refresh == 0U);
        CHECK(cadr_machine_display_update_size(m, &written) ==
              CADR_STATUS_OK &&
              written == CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
        free(bytes);
    }

    bytes = take(m, info(m), &size);
    free(bytes);
    view = info(m);
    CHECK(view.full_refresh == 0U);
    CHECK(cadr_machine_display_update_size(m, &size) ==
          CADR_STATUS_OK && size == CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
    bytes = malloc((size_t)size);
    if (bytes != NULL) {
        written = 0U;
        CHECK(cadr_machine_display_update_take(
                  m, view.machine_generation, view.framebuffer_generation,
                  bytes, size, &written) == CADR_STATUS_OK &&
              written == CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
        CHECK(cadr_display_record_validate(bytes, written) == CADR_STATUS_OK);
        CHECK(get32(bytes + 12U) == CADR_DISPLAY_FLAG_ZERO_IS_BLACK);
        CHECK(get32(bytes + 56U) == 0U && get32(bytes + 60U) == 0U);
        free(bytes);
    }
    cadr_machine_destroy(m);
}

static void test_generation_overflow_is_transactional(void)
{
    cadr_machine *m = machine();
    cadr_machine *cold = NULL;
    cadr_machine_state *before_state;
    cadr_display_tracker before_display;
    cadr_reset_request reset = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
        (uint32_t)sizeof(cadr_reset_request), 0U };
    uint8_t *bytes;
    uint64_t size = 0U;
    uint64_t written = 99U;
    if (m == NULL) return;
    before_state = malloc(sizeof(*before_state));
    if (before_state == NULL) {
        cadr_machine_destroy(m);
        return;
    }

    /* Two pending word changes cannot fit in the remaining counter space.
     * Sync may latch failure, but may not partially update mirror/dirty state. */
    m->display.framebuffer_generation = UINT64_MAX - UINT64_C(1);
    m->state.devices.tv_screen[0U] = UINT32_C(1);
    m->state.devices.tv_screen[1U] = UINT32_C(2);
    before_display = m->display;
    CHECK(cadr_display_tracker_sync(&m->display, &m->state) ==
          CADR_STATUS_NOT_READY);
    CHECK(m->display.failed == 1U);
    m->display.failed = before_display.failed;
    CHECK(memcmp(&m->display, &before_display, sizeof(before_display)) == 0);

    /* Reset reserves its display generation before touching core state. */
    m->display.framebuffer_generation = UINT64_MAX;
    *before_state = m->state;
    before_display = m->display;
    CHECK(cadr_machine_reset(m, &reset) == CADR_STATUS_NOT_READY);
    CHECK(memcmp(&m->state, before_state, sizeof(*before_state)) == 0);
    CHECK(m->display.failed == 1U);
    m->display.failed = before_display.failed;
    CHECK(memcmp(&m->display, &before_display, sizeof(before_display)) == 0);

    /* Recovery full also preflights before writing or consuming dirty state. */
    m->display.failed = 0U;
    m->display.framebuffer_generation = UINT64_MAX;
    m->state.devices.tv_screen[0U] = m->display.mirror[0U];
    m->state.devices.tv_screen[1U] = m->display.mirror[1U];
    CHECK(cadr_machine_display_full_size(m, &size) == CADR_STATUS_OK);
    bytes = malloc((size_t)size);
    if (bytes != NULL) {
        (void)memset(bytes, 0xa5, (size_t)size);
        before_display = m->display;
        CHECK(cadr_machine_display_full_copy(m, bytes, size, &written) ==
              CADR_STATUS_NOT_READY && written == 0U);
        CHECK(bytes[0] == UINT8_C(0xa5));
        CHECK(m->display.failed == 1U);
        m->display.failed = before_display.failed;
        CHECK(memcmp(&m->display, &before_display, sizeof(before_display)) == 0);
        free(bytes);
    }
    {
        cadr_machine_config config = { CADR_ABI_MAJOR, CADR_ABI_MINOR_M7,
            (uint32_t)sizeof(cadr_machine_config), 0U,
            CADR_PROFILE_CADR_WEB_303, 0U };
        CHECK(cadr_machine_create(&config, &cold) == CADR_STATUS_OK);
    }
    if (cold != NULL) {
        cold->state.artifacts.boot_configuration_ingressed = 1U;
        cold->state.artifacts.control_store_ingressed = 1U;
        cold->state.artifacts.base_disk_verified = 1U;
        cold->display.framebuffer_generation = UINT64_MAX;
        *before_state = cold->state;
        before_display = cold->display;
        CHECK(cadr_machine_cold_power_on(cold) == CADR_STATUS_NOT_READY);
        CHECK(memcmp(&cold->state, before_state, sizeof(*before_state)) == 0);
        CHECK(cold->display.failed == 1U);
        cold->display.failed = before_display.failed;
        CHECK(memcmp(&cold->display, &before_display,
                     sizeof(before_display)) == 0);
    }
    free(before_state);
    cadr_machine_destroy(cold);
    cadr_machine_destroy(m);
}

static void test_empty_update_and_same_value_write(void)
{
    cadr_machine *m = machine();
    cadr_display_info view;
    uint8_t *bytes;
    uint64_t size = 0U;
    uint64_t written = 0U;
    if (m == NULL) return;

    /* Drain the initial required full refresh.  Rewriting its existing value
     * is a guest-visible bus operation but is not a framebuffer mutation, so
     * M7 must emit a canonical empty delta without advancing its generation. */
    bytes = take(m, info(m), &size);
    free(bytes);
    view = info(m);
    CHECK(cadr_tv_write(&m->state, 0U, 0U) == CADR_STATUS_OK);
    CHECK(cadr_machine_display_info(m, &view) == CADR_STATUS_OK);
    CHECK(view.framebuffer_generation == 1U && view.full_refresh == 0U);
    CHECK(cadr_machine_display_update_size(m, &size) == CADR_STATUS_OK &&
          size == CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
    bytes = malloc((size_t)size);
    if (bytes != NULL) {
        CHECK(cadr_machine_display_update_take(
                  m, view.machine_generation, view.framebuffer_generation,
                  bytes, size, &written) == CADR_STATUS_OK &&
              written == CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
        CHECK(cadr_display_record_validate(bytes, written) == CADR_STATUS_OK);
        CHECK(get32(bytes + 56U) == 0U && get32(bytes + 60U) == 0U &&
              get32(bytes + 12U) == CADR_DISPLAY_FLAG_ZERO_IS_BLACK);
        free(bytes);
    }
    cadr_machine_destroy(m);
}

int main(void)
{
    test_abi_literal_values();
    test_full_and_word_boundaries();
    test_polarity_spans_and_failures();
    test_derived_digest_reset_and_restore();
    test_cold_power_requires_a_full_replacement();
    test_abi_and_transfer_failure_semantics();
    test_empty_update_and_same_value_write();
    test_generation_overflow_is_transactional();
    if (failures != 0) return 1;
    (void)puts("cadr M7 display tests passed");
    return 0;
}
