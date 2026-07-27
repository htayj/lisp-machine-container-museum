/*
 * Deterministic conformance fixture for the native oracle ledger.
 *
 * This is compiled only by tests.  It supplies the emulator globals consumed
 * by cadr_oracle_native.c, performs one write through every mutable canonical
 * family, changes every device root, and emits a one-slot CDRTRC1 witness.
 */

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "cadr_oracle_native.h"
#include "machine-control.h"

uint64_t machine_cycles, p0, p1, debug_ir, iwr;
uint32_t p0_pc, p1_pc, npc, lc, q, old_q, vma_reg, md_reg;
uint32_t new_md, new_md_delay, dispatch_constant, interrupt_control;
int interrupt_status_reg, interrupt_pending_flag;
uint32_t spcptr, pdl_pointer, pdl_index, oa_reg_low, oa_reg_high;
uint32_t aaddr, maddr, op, alu_carry, alu_out, out, opc;
int adata, mdata;
bool p0_imem, p1_imem, popj, oal, oah, inhibit;
struct machine_state_s machine_state;

uint64_t prom[512], imem[16384];
uint32_t amem[1024], mmem[32], dmem[2048], pdl[1024], spc[32];
uint32_t l1_map[2048], l2_map[1024];
uint32_t main_memory_npages = 1;
static uint32_t main_words[256];
uint32_t tv_screen_buffer[32768], colortv_screen_buffer[32768];
uint32_t colortv_color_map[64];
uint16_t unibus_mapping_registers[16], unibus_mapping_buffers[16];
uint32_t iob_csr;
uint16_t the_60_cycle_clock;

static uint32_t device_values[7];

uint16_t bus_interface_get_bus_error_status(void) { return 0; }
uint32_t cadr_oracle_main_memory_word(uint32_t address) { return main_words[address]; }

static void device(uint32_t family, unsigned index)
{
    cadr_oracle_snapshot_begin(family);
    cadr_oracle_snapshot_u32(1,device_values[index]);
    cadr_oracle_snapshot_end();
}
void cadr_oracle_snapshot_bus_interface(void) { device(CADR_ORACLE_BUS_INTERFACE_STATE,0); }
void cadr_oracle_snapshot_disk(void) { device(CADR_ORACLE_DISK_STATE,1); }
void cadr_oracle_snapshot_tv(void) { device(CADR_ORACLE_TV_STATE,2); }
void cadr_oracle_snapshot_colortv(void) { device(CADR_ORACLE_COLOR_TV_STATE,3); }
void cadr_oracle_snapshot_chaos(void) { device(CADR_ORACLE_CHAOS_STATE,4); }
void cadr_oracle_snapshot_tape(void) { device(CADR_ORACLE_TAPE_STATE,5); }
void cadr_oracle_snapshot_iob(void) { device(CADR_ORACLE_IOB_STATE,6); }

int main(int argc, char **argv)
{
    bool unhandled = false, latch_variant = false;
    for (int i=1;i<argc;++i) {
        if (!strcmp(argv[i],"--unhandled-device")) unhandled=true;
        else if (!strcmp(argv[i],"--latch-variant")) latch_variant=true;
    }
    cadr_oracle_start(1);
    cadr_oracle_slot_begin(false);
    cadr_oracle_latch_fetched(latch_variant?0123456701234566ULL:0123456701234567ULL,
                              0123,false);
    cadr_oracle_latch_decoded(0765432107654321ULL,0,false,1,2,false,
                              latch_variant?2:3,4);
    alu_out=cadr_oracle_alu_behavior(0123,031,0x10);

#define WRITE32(FAMILY, ARRAY, INDEX, VALUE) do { \
    uint32_t old=(ARRAY)[INDEX]; (ARRAY)[INDEX]=(VALUE); \
    cadr_oracle_write_u32((FAMILY),(INDEX),old,(ARRAY)[INDEX]); \
} while (0)
    uint64_t old_imem=imem[3]; imem[3]=1;
    cadr_oracle_write_u64(CADR_ORACLE_IMEM,3,old_imem,imem[3]);
    WRITE32(CADR_ORACLE_AMEM,amem,1,1);
    WRITE32(CADR_ORACLE_MMEM,mmem,2,1);
    WRITE32(CADR_ORACLE_DMEM,dmem,3,1);
    WRITE32(CADR_ORACLE_PDL,pdl,4,1);
    WRITE32(CADR_ORACLE_SPC,spc,5,1);
    WRITE32(CADR_ORACLE_L1_MAP,l1_map,6,1);
    WRITE32(CADR_ORACLE_L2_MAP,l2_map,7,1);
    main_words[8]=1; cadr_oracle_main_memory_page_changed(0);
    WRITE32(CADR_ORACLE_TV_MEMORY,tv_screen_buffer,9,1);
    WRITE32(CADR_ORACLE_COLOR_TV_MEMORY,colortv_screen_buffer,10,1);
    WRITE32(CADR_ORACLE_COLOR_MAP,colortv_color_map,11,1);
    WRITE32(CADR_ORACLE_UNIBUS_MAP,unibus_mapping_registers,12,1);
    WRITE32(CADR_ORACLE_UNIBUS_BUFFER,unibus_mapping_buffers,13,1);

    for (uint32_t family=CADR_ORACLE_INTERRUPT;family<=CADR_ORACLE_CHAOS_WRITE;++family)
        cadr_oracle_event_u32(family,family,1,0);
    for (unsigned i=0;i<7;++i) ++device_values[i];
    if (!unhandled) cadr_oracle_refresh_device_states();

    machine_cycles=1;
    cadr_oracle_slot_end(false);
    cadr_oracle_finish(false);
    return 0;
}
