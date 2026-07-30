#ifndef CADR_M12_DEBUGGER_WITNESS_H
#define CADR_M12_DEBUGGER_WITNESS_H

#include <stdint.h>

/* Disposable public-usim candidate-loop witness.  It records only the named
 * source labels; it does not assert that they completely define a macro step.
 * When the separately controlled private file named by
 * CADR_M12_DEBUGGER_WITNESS_CONTROL contains exactly "pause\n", the hook waits
 * at a candidate loop until it contains exactly "resume\n" and records both
 * witness-only transitions.  This is a capture control, not CADR debugger
 * behavior or a claim about a historical breakpoint facility. */
void cadr_m12_native_debugger_witness_boundary(uint64_t machine_cycles,
                                               uint32_t p0_pc,
                                               uint32_t p1_pc,
                                               uint32_t next_pc,
                                               uint32_t location_counter);

#endif
