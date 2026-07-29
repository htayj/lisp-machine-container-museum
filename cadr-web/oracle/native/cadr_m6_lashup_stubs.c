#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

int lashup_read_timeout;
char *lashup_debugger_addr;
int lashup_debugger_port;
char *lashup_target_addr;
int lashup_target_port;

bool lashup_debugger_read(uint32_t a, uint16_t *v) { (void)a; (void)v; return false; }
bool lashup_debugger_write(uint32_t a, uint16_t v) { (void)a; (void)v; return false; }
bool lashup_debugger_inhibit_nxm(bool v) { (void)v; return false; }
bool lashup_debugger_reset_unibus_and_bus_interface(void) { return false; }
bool lashup_debugger_mark_debuggee(uint8_t v) { (void)v; return false; }
bool lashup_debugger_mark_debugger(uint8_t v) { (void)v; return false; }
bool lashup_debugger_ping(void) { return false; }
bool lashup_debugger_usim(uint8_t a, uint8_t b) { (void)a; (void)b; return false; }

void cadr_oracle_snapshot_begin(uint32_t x) { (void)x; }
void cadr_oracle_snapshot_u32(uint32_t x, uint32_t y) { (void)x; (void)y; }
void cadr_oracle_snapshot_u64(uint32_t x, uint64_t y) { (void)x; (void)y; }
void cadr_oracle_snapshot_bytes(uint32_t x, const void *y, size_t z) { (void)x; (void)y; (void)z; }
void cadr_oracle_snapshot_end(void) {}
void cadr_oracle_snapshot_keyboard_fields(void) {}
