#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "cadr_m8_m9_input_driver.h"

static uint32_t keyboard_count;
static uint32_t pointer_count;
static int keyboard_code;
static int keyboard_down;
static int pointer_x;
static int pointer_y;
static int pointer_buttons;
static int keyboard_dispatch_active;
static int pointer_dispatch_active;

void kbd_event(int code, int keydown)
{
    keyboard_count += 1U; keyboard_code = code; keyboard_down = keydown;
    keyboard_dispatch_active = cadr_m8_m9_input_driver_dispatch_active();
}

void mouse_event(int x, int y, int buttons)
{
    pointer_count += 1U; pointer_x = x; pointer_y = y; pointer_buttons = buttons;
    pointer_dispatch_active = cadr_m8_m9_input_driver_dispatch_active();
}

int main(int argc, char **argv)
{
    FILE *stream;
    if (argc != 2) return 2;
    stream = fopen(argv[1], "w");
    if (stream == NULL || fprintf(stream, "CADR-M8-M9-INPUT-v1\n10 keyboard 65 1 0\n12 pointer 123 456 3\n") < 0 ||
        fclose(stream) != 0 || setenv("CADR_M8_M9_INPUT_SCRIPT", argv[1], 1) != 0 ||
        cadr_m8_m9_input_driver_init() != 0 ||
        cadr_m8_m9_input_driver_complete() != 0 ||
        cadr_m8_m9_input_driver_boundary(UINT64_C(9)) != 0 || keyboard_count != 0U ||
        cadr_m8_m9_input_driver_boundary(UINT64_C(10)) != 0 || keyboard_count != 1U ||
        keyboard_code != 65 || keyboard_down != 1 || keyboard_dispatch_active != 1 ||
        cadr_m8_m9_input_driver_dispatch_active() != 0 ||
        cadr_m8_m9_input_driver_boundary(UINT64_C(11)) != 0 || pointer_count != 0U ||
        cadr_m8_m9_input_driver_boundary(UINT64_C(12)) != 0 || pointer_count != 1U ||
        pointer_x != 123 || pointer_y != 456 || pointer_buttons != 3 || pointer_dispatch_active != 1 ||
        cadr_m8_m9_input_driver_dispatch_active() != 0 ||
        cadr_m8_m9_input_driver_boundary(UINT64_C(13)) != 0 ||
        cadr_m8_m9_input_driver_complete() != 1) return 1;
    return 0;
}
