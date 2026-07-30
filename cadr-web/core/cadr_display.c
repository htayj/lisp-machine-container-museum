#include "cadr_display.h"

#include "cadr_machine.h"

#include <stddef.h>
#include <string.h>

static uint16_t get16(const uint8_t *bytes)
{
    return (uint16_t)((uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8U));
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
    for (index = 0U; index < 8U; ++index) value |= (uint64_t)bytes[index] << (index * 8U);
    return value;
}

static void put16(uint8_t *bytes, uint16_t value)
{
    bytes[0] = (uint8_t)value;
    bytes[1] = (uint8_t)(value >> 8U);
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
    for (index = 0U; index < 8U; ++index) bytes[index] = (uint8_t)(value >> (index * 8U));
}

static uint32_t polarity(const cadr_machine_state *state)
{
    return (state->devices.tv_mode >> 2U) & UINT32_C(1);
}

static void clean_rows(cadr_display_tracker *tracker)
{
    uint32_t row;
    for (row = 0U; row < CADR_DISPLAY_HEIGHT; ++row) {
        tracker->min_word[row] = CADR_DISPLAY_CLEAN_WORD;
        tracker->max_word[row] = 0U;
    }
}

void cadr_display_tracker_initialize(cadr_display_tracker *tracker,
                                     const cadr_machine_state *state)
{
    uint32_t index;
    if (tracker == NULL || state == NULL) return;
    (void)memset(tracker, 0, sizeof(*tracker));
    for (index = 0U; index < CADR_DISPLAY_ACTIVE_WORDS; ++index) {
        tracker->mirror[index] = state->devices.tv_screen[index];
    }
    clean_rows(tracker);
    tracker->last_tv_polarity = polarity(state);
    tracker->framebuffer_generation = UINT64_C(1);
    tracker->full_refresh = 1U;
}

cadr_status cadr_display_tracker_prepare_reinitialize(
    cadr_display_tracker *tracker, uint64_t *out_generation)
{
    if (tracker == NULL || out_generation == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (tracker->failed != 0U) return CADR_STATUS_NOT_READY;
    if (tracker->framebuffer_generation == UINT64_MAX) {
        tracker->failed = 1U;
        return CADR_STATUS_NOT_READY;
    }
    *out_generation = tracker->framebuffer_generation + UINT64_C(1);
    return CADR_STATUS_OK;
}

void cadr_display_tracker_commit_reinitialize(
    cadr_display_tracker *tracker, const cadr_machine_state *state,
    uint64_t generation)
{
    uint32_t index;
    if (tracker == NULL || state == NULL || generation == 0U) return;
    for (index = 0U; index < CADR_DISPLAY_ACTIVE_WORDS; ++index) {
        tracker->mirror[index] = state->devices.tv_screen[index];
    }
    clean_rows(tracker);
    tracker->last_tv_polarity = polarity(state);
    tracker->framebuffer_generation = generation;
    tracker->full_refresh = 1U;
    tracker->failed = 0U;
}

static void note_word(cadr_display_tracker *tracker, uint32_t index)
{
    const uint32_t row = index / CADR_DISPLAY_STRIDE_WORDS;
    const uint32_t word = index % CADR_DISPLAY_STRIDE_WORDS;
    if (tracker->min_word[row] == CADR_DISPLAY_CLEAN_WORD ||
        word < tracker->min_word[row]) tracker->min_word[row] = (uint8_t)word;
    if (word + 1U > tracker->max_word[row]) tracker->max_word[row] = (uint8_t)(word + 1U);
}

cadr_status cadr_display_tracker_sync(cadr_display_tracker *tracker,
                                      const cadr_machine_state *state)
{
    uint32_t index;
    uint32_t new_polarity;
    uint64_t changes = 0U;
    if (tracker == NULL || state == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (tracker->failed != 0U) return CADR_STATUS_NOT_READY;
    for (index = 0U; index < CADR_DISPLAY_ACTIVE_WORDS; ++index) {
        const uint32_t value = state->devices.tv_screen[index];
        if (tracker->mirror[index] != value) ++changes;
    }
    new_polarity = polarity(state);
    if (new_polarity != tracker->last_tv_polarity) ++changes;
    if (changes > UINT64_MAX - tracker->framebuffer_generation) {
        tracker->failed = 1U;
        return CADR_STATUS_NOT_READY;
    }
    for (index = 0U; index < CADR_DISPLAY_ACTIVE_WORDS; ++index) {
        const uint32_t value = state->devices.tv_screen[index];
        if (tracker->mirror[index] == value) continue;
        tracker->mirror[index] = value;
        note_word(tracker, index);
    }
    if (new_polarity != tracker->last_tv_polarity) {
        tracker->last_tv_polarity = new_polarity;
        tracker->full_refresh = 1U;
        clean_rows(tracker);
    }
    tracker->framebuffer_generation += changes;
    return CADR_STATUS_OK;
}

static uint32_t record_flags(const cadr_machine_state *state, uint32_t full)
{
    uint32_t flags = full != 0U ? CADR_DISPLAY_FLAG_FULL : 0U;
    if (polarity(state) == 0U) flags |= CADR_DISPLAY_FLAG_ZERO_IS_BLACK;
    return flags;
}

static cadr_status rects(const cadr_display_tracker *tracker,
                         uint32_t full, cadr_display_rect *out,
                         uint32_t *out_count, uint64_t *out_words)
{
    uint32_t row;
    uint32_t count = 0U;
    uint64_t words = 0U;
    if (tracker == NULL || out == NULL || out_count == NULL || out_words == NULL) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (full != 0U) {
        out[0].x = 0U; out[0].y = 0U;
        out[0].width = CADR_DISPLAY_WIDTH; out[0].height = CADR_DISPLAY_HEIGHT;
        *out_count = 1U; *out_words = CADR_DISPLAY_ACTIVE_WORDS;
        return CADR_STATUS_OK;
    }
    for (row = 0U; row < CADR_DISPLAY_HEIGHT;) {
        uint32_t end;
        uint32_t min;
        uint32_t max;
        if (tracker->min_word[row] == CADR_DISPLAY_CLEAN_WORD) { ++row; continue; }
        min = tracker->min_word[row]; max = tracker->max_word[row]; end = row + 1U;
        while (end < CADR_DISPLAY_HEIGHT && tracker->min_word[end] == min &&
               tracker->max_word[end] == max) ++end;
        if (min >= max || max > CADR_DISPLAY_STRIDE_WORDS || count >= CADR_DISPLAY_HEIGHT) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        out[count].x = min * 32U; out[count].y = row;
        out[count].width = (max - min) * 32U; out[count].height = end - row;
        words += (uint64_t)(max - min) * (uint64_t)(end - row);
        ++count; row = end;
    }
    *out_count = count; *out_words = words;
    return CADR_STATUS_OK;
}

static cadr_status encoded_size(uint32_t rect_count, uint64_t word_count,
                                uint64_t *out_size)
{
    uint64_t payload;
    if (out_size == NULL || word_count > UINT64_MAX / UINT64_C(4)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    payload = word_count * UINT64_C(4);
    if ((uint64_t)rect_count > (UINT64_MAX - CADR_DISPLAY_CDRDISP1_HEADER_BYTES - payload) /
        CADR_DISPLAY_CDRDISP1_RECT_BYTES) return CADR_STATUS_INVALID_ARGUMENT;
    *out_size = CADR_DISPLAY_CDRDISP1_HEADER_BYTES +
        (uint64_t)rect_count * CADR_DISPLAY_CDRDISP1_RECT_BYTES + payload;
    return CADR_STATUS_OK;
}

static void encode(const cadr_machine *machine, const cadr_display_rect *rectangles,
                   uint32_t rect_count, uint64_t word_count, uint32_t full,
                   uint64_t framebuffer_generation,
                   uint8_t *bytes, uint64_t total)
{
    uint64_t offset = CADR_DISPLAY_CDRDISP1_HEADER_BYTES;
    uint32_t rect;
    (void)memset(bytes, 0, (size_t)total);
    (void)memcpy(bytes, "CDRDISP1", 8U);
    put16(bytes + 8U, CADR_DISPLAY_CDRDISP1_VERSION);
    put16(bytes + 10U, (uint16_t)CADR_DISPLAY_CDRDISP1_HEADER_BYTES);
    put32(bytes + 12U, record_flags(&machine->state, full));
    put64(bytes + 16U, machine->state.events.generation);
    put64(bytes + 24U, framebuffer_generation);
    put32(bytes + 32U, CADR_DISPLAY_WIDTH); put32(bytes + 36U, CADR_DISPLAY_HEIGHT);
    put32(bytes + 40U, CADR_DISPLAY_STRIDE_WORDS); put32(bytes + 44U, CADR_DISPLAY_BACKING_WORDS);
    put32(bytes + 48U, CADR_DISPLAY_ACTIVE_WORDS); put32(bytes + 52U, machine->state.devices.tv_mode);
    put32(bytes + 56U, rect_count); put32(bytes + 60U, (uint32_t)word_count);
    put64(bytes + 64U, word_count * UINT64_C(4)); put64(bytes + 72U, total);
    for (rect = 0U; rect < rect_count; ++rect) {
        put32(bytes + offset, rectangles[rect].x); put32(bytes + offset + 4U, rectangles[rect].y);
        put32(bytes + offset + 8U, rectangles[rect].width); put32(bytes + offset + 12U, rectangles[rect].height);
        offset += CADR_DISPLAY_CDRDISP1_RECT_BYTES;
    }
    for (rect = 0U; rect < rect_count; ++rect) {
        uint32_t row;
        const uint32_t first_word = rectangles[rect].x / 32U;
        const uint32_t words_per_row = rectangles[rect].width / 32U;
        for (row = rectangles[rect].y; row < rectangles[rect].y + rectangles[rect].height; ++row) {
            uint32_t word;
            for (word = 0U; word < words_per_row; ++word) {
                put32(bytes + offset, machine->state.devices.tv_screen[
                    row * CADR_DISPLAY_STRIDE_WORDS + first_word + word]);
                offset += 4U;
            }
        }
    }
}

cadr_status cadr_display_record_validate(const uint8_t *bytes, uint64_t byte_count)
{
    uint64_t offset;
    uint64_t words = 0U;
    uint64_t payload;
    uint64_t total;
    uint32_t flags;
    uint32_t rect_count;
    uint32_t previous_end = 0U;
    uint32_t previous_x = 0U;
    uint32_t previous_width = 0U;
    uint32_t index;
    if (bytes == NULL || byte_count < CADR_DISPLAY_CDRDISP1_HEADER_BYTES ||
        memcmp(bytes, "CDRDISP1", 8U) != 0 || get16(bytes + 8U) != CADR_DISPLAY_CDRDISP1_VERSION ||
        get16(bytes + 10U) != CADR_DISPLAY_CDRDISP1_HEADER_BYTES) return CADR_STATUS_INVALID_ARGUMENT;
    flags = get32(bytes + 12U); rect_count = get32(bytes + 56U);
    payload = get64(bytes + 64U); total = get64(bytes + 72U);
    if ((flags & ~(CADR_DISPLAY_FLAG_FULL | CADR_DISPLAY_FLAG_ZERO_IS_BLACK)) != 0U ||
        get64(bytes + 16U) == 0U || get64(bytes + 24U) == 0U ||
        get32(bytes + 32U) != CADR_DISPLAY_WIDTH || get32(bytes + 36U) != CADR_DISPLAY_HEIGHT ||
        get32(bytes + 40U) != CADR_DISPLAY_STRIDE_WORDS || get32(bytes + 44U) != CADR_DISPLAY_BACKING_WORDS ||
        get32(bytes + 48U) != CADR_DISPLAY_ACTIVE_WORDS ||
        (((get32(bytes + 52U) >> 2U) & 1U) == 0U) !=
            ((flags & CADR_DISPLAY_FLAG_ZERO_IS_BLACK) != 0U) ||
        payload != (uint64_t)get32(bytes + 60U) * UINT64_C(4) ||
        rect_count > CADR_DISPLAY_HEIGHT ||
        total != byte_count || total < CADR_DISPLAY_CDRDISP1_HEADER_BYTES ||
        total - CADR_DISPLAY_CDRDISP1_HEADER_BYTES < (uint64_t)rect_count * CADR_DISPLAY_CDRDISP1_RECT_BYTES ||
        total - CADR_DISPLAY_CDRDISP1_HEADER_BYTES - (uint64_t)rect_count * CADR_DISPLAY_CDRDISP1_RECT_BYTES != payload) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if ((flags & CADR_DISPLAY_FLAG_FULL) != 0U && rect_count != 1U) return CADR_STATUS_INVALID_ARGUMENT;
    offset = CADR_DISPLAY_CDRDISP1_HEADER_BYTES;
    for (index = 0U; index < rect_count; ++index) {
        const uint32_t x = get32(bytes + offset); const uint32_t y = get32(bytes + offset + 4U);
        const uint32_t width = get32(bytes + offset + 8U); const uint32_t height = get32(bytes + offset + 12U);
        if (width == 0U || height == 0U || x % 32U != 0U || width % 32U != 0U ||
            x >= CADR_DISPLAY_WIDTH || y >= CADR_DISPLAY_HEIGHT || width > CADR_DISPLAY_WIDTH - x ||
            height > CADR_DISPLAY_HEIGHT - y || y < previous_end ||
            (y == previous_end && x == previous_x && width == previous_width) ||
            words > UINT64_MAX - (uint64_t)(width / 32U) * height) return CADR_STATUS_INVALID_ARGUMENT;
        if ((flags & CADR_DISPLAY_FLAG_FULL) != 0U &&
            (x != 0U || y != 0U || width != CADR_DISPLAY_WIDTH || height != CADR_DISPLAY_HEIGHT)) {
            return CADR_STATUS_INVALID_ARGUMENT;
        }
        words += (uint64_t)(width / 32U) * height;
        previous_end = y + height; previous_x = x; previous_width = width;
        offset += CADR_DISPLAY_CDRDISP1_RECT_BYTES;
    }
    if (words != get32(bytes + 60U)) return CADR_STATUS_INVALID_ARGUMENT;
    return CADR_STATUS_OK;
}

static cadr_status synchronize(cadr_machine *machine)
{
    if (machine == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    return cadr_display_tracker_sync(&machine->display, &machine->state);
}

cadr_status cadr_machine_display_info(cadr_machine *machine, cadr_display_info *out_info)
{
    cadr_status status;
    if (machine == NULL || out_info == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    if (out_info->abi_major != CADR_ABI_MAJOR ||
        out_info->abi_minor > CADR_ABI_MINOR) return CADR_STATUS_ABI_MISMATCH;
    if ((size_t)out_info->struct_size < sizeof(*out_info)) {
        return CADR_STATUS_INVALID_ARGUMENT;
    }
    if (out_info->abi_minor < CADR_ABI_MINOR_M7) return CADR_STATUS_ABI_MISMATCH;
    status = synchronize(machine);
    if (status != CADR_STATUS_OK) return status;
    out_info->abi_major = CADR_ABI_MAJOR; out_info->abi_minor = CADR_ABI_MINOR;
    out_info->struct_size = (uint32_t)sizeof(*out_info); out_info->machine_generation = machine->state.events.generation;
    out_info->framebuffer_generation = machine->display.framebuffer_generation;
    out_info->width = CADR_DISPLAY_WIDTH; out_info->height = CADR_DISPLAY_HEIGHT;
    out_info->stride_words = CADR_DISPLAY_STRIDE_WORDS; out_info->backing_words = CADR_DISPLAY_BACKING_WORDS;
    out_info->active_words = CADR_DISPLAY_ACTIVE_WORDS; out_info->tv_mode = machine->state.devices.tv_mode;
    out_info->full_refresh = machine->display.full_refresh; out_info->failed = machine->display.failed;
    out_info->reserved0 = 0U;
    return CADR_STATUS_OK;
}

static cadr_status update_shape(cadr_machine *machine, cadr_display_rect rectangles[CADR_DISPLAY_HEIGHT],
                                uint32_t *rect_count, uint64_t *word_count, uint64_t *byte_count)
{
    cadr_status status = synchronize(machine);
    if (status != CADR_STATUS_OK) return status;
    status = rects(&machine->display, machine->display.full_refresh, rectangles, rect_count, word_count);
    if (status != CADR_STATUS_OK) return status;
    return encoded_size(*rect_count, *word_count, byte_count);
}

cadr_status cadr_machine_display_update_size(cadr_machine *machine, uint64_t *out_byte_count)
{
    cadr_display_rect rectangles[CADR_DISPLAY_HEIGHT];
    uint32_t rect_count;
    uint64_t words;
    if (out_byte_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_byte_count = 0U;
    return update_shape(machine, rectangles, &rect_count, &words, out_byte_count);
}

static void clear_taken(cadr_display_tracker *tracker)
{
    tracker->full_refresh = 0U;
    clean_rows(tracker);
}

cadr_status cadr_machine_display_update_take(
    cadr_machine *machine, uint64_t expected_machine_generation,
    uint64_t expected_framebuffer_generation, uint8_t *bytes,
    uint64_t capacity, uint64_t *out_written)
{
    cadr_display_rect rectangles[CADR_DISPLAY_HEIGHT];
    uint32_t rect_count;
    uint64_t words;
    uint64_t size;
    cadr_status status;
    if (out_written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_written = 0U;
    if (machine == NULL || bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = update_shape(machine, rectangles, &rect_count, &words, &size);
    if (status != CADR_STATUS_OK) return status;
    if (machine->state.events.generation != expected_machine_generation ||
        machine->display.framebuffer_generation != expected_framebuffer_generation) {
        return CADR_STATUS_STALE_GENERATION;
    }
    if (capacity < size) return CADR_STATUS_WRONG_LENGTH;
    encode(machine, rectangles, rect_count, words, machine->display.full_refresh,
           machine->display.framebuffer_generation, bytes, size);
    status = cadr_display_record_validate(bytes, size);
    if (status != CADR_STATUS_OK) return status;
    clear_taken(&machine->display);
    *out_written = size;
    return CADR_STATUS_OK;
}

cadr_status cadr_machine_display_full_size(cadr_machine *machine, uint64_t *out_byte_count)
{
    cadr_status status;
    if (machine == NULL || out_byte_count == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = synchronize(machine);
    if (status != CADR_STATUS_OK) return status;
    return encoded_size(1U, CADR_DISPLAY_ACTIVE_WORDS, out_byte_count);
}

cadr_status cadr_machine_display_full_copy(cadr_machine *machine,
                                           uint8_t *bytes, uint64_t capacity,
                                           uint64_t *out_written)
{
    cadr_display_rect rectangle;
    uint64_t generation;
    uint64_t size;
    cadr_status status;
    if (out_written == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    *out_written = 0U;
    if (machine == NULL || bytes == NULL) return CADR_STATUS_INVALID_ARGUMENT;
    status = synchronize(machine);
    if (status != CADR_STATUS_OK) return status;
    status = encoded_size(1U, CADR_DISPLAY_ACTIVE_WORDS, &size);
    if (status != CADR_STATUS_OK || capacity < size) return status != CADR_STATUS_OK ? status : CADR_STATUS_WRONG_LENGTH;
    status = cadr_display_tracker_prepare_reinitialize(&machine->display, &generation);
    if (status != CADR_STATUS_OK) return status;
    rectangle.x = 0U; rectangle.y = 0U; rectangle.width = CADR_DISPLAY_WIDTH; rectangle.height = CADR_DISPLAY_HEIGHT;
    encode(machine, &rectangle, 1U, CADR_DISPLAY_ACTIVE_WORDS, 1U,
           generation, bytes, size);
    status = cadr_display_record_validate(bytes, size);
    if (status != CADR_STATUS_OK) return status;
    machine->display.framebuffer_generation = generation;
    clear_taken(&machine->display);
    *out_written = size;
    return CADR_STATUS_OK;
}
