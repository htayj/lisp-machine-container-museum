#include <stdbool.h>
#include <stdint.h>

#include "cadr_oracle_native.h"

int lashup_read_timeout;
char *lashup_debugger_addr;
int lashup_debugger_port;
char *lashup_target_addr;
int lashup_target_port;

static bool forbidden(uint32_t event)
{
    cadr_oracle_external_event(1, event, "lashup debugger access");
    return false;
}

bool lashup_debugger_read(uint32_t address, uint16_t *value)
{ (void)address; (void)value; return forbidden(1); }
bool lashup_debugger_write(uint32_t address, uint16_t value)
{ (void)address; (void)value; return forbidden(2); }
bool lashup_debugger_inhibit_nxm(bool value)
{ (void)value; return forbidden(3); }
bool lashup_debugger_reset_unibus_and_bus_interface(void)
{ return forbidden(4); }
bool lashup_debugger_mark_debuggee(uint8_t symbol)
{ (void)symbol; return forbidden(5); }
bool lashup_debugger_mark_debugger(uint8_t symbol)
{ (void)symbol; return forbidden(6); }
bool lashup_debugger_ping(void)
{ return forbidden(7); }
bool lashup_debugger_usim(uint8_t command, uint8_t parameter)
{ (void)command; (void)parameter; return forbidden(8); }
