#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

bool idle_enabled = false;
size_t idle_cycles;
size_t idle_quantum;
size_t idle_timeout;

void idle_init(void) {}
void idle_quit(void) {}
void idle_check(uint64_t cycle) { (void)cycle; }
void idle_activity(void) {}
bool idle_is_idle(void) { return false; }
