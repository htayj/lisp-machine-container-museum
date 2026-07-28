#include "cadr_host_api.h"
#include "cadr_machine.h"

#include <stdio.h>
#include <string.h>

#ifndef CADR_MUTANT_TARGET
#error "CADR_MUTANT_TARGET must select ALU=0, JUMP=1, DISPATCH=2, or BYTE=3"
#endif

static uint64_t word(uint32_t class_value, uint32_t a, uint32_t functional,
                     uint32_t m, uint32_t destination, uint32_t low)
{
    return ((uint64_t)class_value << 43U) | ((uint64_t)a << 32U) |
        ((uint64_t)functional << 31U) | ((uint64_t)m << 26U) |
        ((uint64_t)destination << 14U) | low;
}

static cadr_machine *machine_for_target(void)
{
    cadr_machine_config config = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(config),
        0U, CADR_PROFILE_CADR_WEB_303, 0U
    };
    cadr_machine *machine = NULL;
    uint64_t instruction;
    if (cadr_machine_create(&config, &machine) != CADR_STATUS_OK) return NULL;
    machine->state.artifacts.boot_configuration_ingressed = 1U;
    machine->state.artifacts.control_store_ingressed = 1U;
    machine->state.artifacts.base_disk_verified = 1U;
    if (cadr_machine_cold_power_on(machine) != CADR_STATUS_OK ||
        cadr_machine_boot(machine) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return NULL;
    }
    machine->state.cpu.prom_disabled = 1U;
    /*
     * Boot deliberately leaves one inhibited pipeline slot.  The mutant
     * fixture primes p1 directly, so clear that boot-only bubble to make the
     * requested instruction class the first exercised boundary.
     */
    machine->state.cpu.inhibit = 0U;
#if CADR_MUTANT_TARGET == 0
    machine->state.cpu.m_memory[0] = UINT32_C(0x12345678);
    instruction = word(0U, 0U, 0U, 0U, UINT32_C(0x801),
                       (UINT32_C(1) << 12U) | (UINT32_C(3) << 3U));
#elif CADR_MUTANT_TARGET == 1
    instruction = word(1U, 0U, 0U, 0U, 0U,
                       (UINT32_C(9) << 12U) | (UINT32_C(1) << 7U) |
                       (UINT32_C(1) << 5U) | UINT32_C(7));
#elif CADR_MUTANT_TARGET == 2
    machine->state.cpu.m_memory[0] = 3U;
    machine->state.cpu.dispatch_memory[3] = 11U;
    instruction = word(2U, UINT32_C(0x155), 0U, 0U, 0U,
                       UINT32_C(2) << 5U);
#elif CADR_MUTANT_TARGET == 3
    machine->state.cpu.m_memory[0] = 1U;
    instruction = word(3U, 0U, 0U, 0U, UINT32_C(0x804),
                       (UINT32_C(3) << 12U) |
                       (UINT32_C(4) << 5U) | UINT32_C(4));
#else
#error "invalid CADR_MUTANT_TARGET"
#endif
    machine->state.cpu.p1 = instruction;
    machine->state.cpu.p1_imem = 1U;
    machine->state.cpu.next_micro_pc = 1U;
    return machine;
}

int main(void)
{
    static const uint8_t profile[CADR_SHA256_BYTES] = {
        0x1bU,0x8dU,0x63U,0xdbU,0x98U,0xacU,0xd4U,0x6eU,
        0x40U,0xadU,0xf9U,0x9aU,0x8aU,0x3cU,0xebU,0x5eU,
        0x05U,0x58U,0xd4U,0xacU,0x02U,0x7cU,0xb2U,0xcbU,
        0x4aU,0x43U,0x96U,0x65U,0xb1U,0x4bU,0x5dU,0x2aU
    };
    static const uint8_t artifacts[CADR_SHA256_BYTES] = {
        0xe9U,0x6eU,0x6fU,0xf9U,0x03U,0xc2U,0x3cU,0xceU,
        0xa7U,0x07U,0xecU,0xe0U,0xe9U,0xa8U,0x72U,0xa8U,
        0xa7U,0x77U,0x71U,0xa6U,0x66U,0x3eU,0x3bU,0x91U,
        0x9eU,0xabU,0xa2U,0x1eU,0x22U,0xf2U,0xf9U,0x41U
    };
    cadr_machine *machine = machine_for_target();
    cadr_trace_config trace;
    cadr_run_request run = {
        CADR_ABI_MAJOR, CADR_ABI_MINOR_M2, (uint32_t)sizeof(run), 0U, 1U
    };
    cadr_run_result result;
    uint8_t digest[CADR_SHA256_BYTES];
    uint32_t index;
    if (machine == NULL) return 1;
    (void)memset(&trace, 0, sizeof(trace));
    trace.abi_major = CADR_ABI_MAJOR;
    trace.abi_minor = CADR_ABI_MINOR_M2;
    trace.struct_size = (uint32_t)sizeof(trace);
    trace.selector_mask = CADR_TRACE_SELECTOR_KNOWN;
    trace.ring_record_capacity = 8U;
    trace.transport_mode = CADR_TRACE_TRANSPORT_HASH_ONLY;
    (void)memcpy(trace.profile_sha256, profile, sizeof(profile));
    (void)memcpy(trace.artifact_set_sha256, artifacts, sizeof(artifacts));
    if (cadr_machine_trace_start(machine, &trace) != CADR_STATUS_OK) return 1;
    (void)memset(&result, 0, sizeof(result));
    result.abi_major = CADR_ABI_MAJOR;
    result.abi_minor = CADR_ABI_MINOR_M2;
    result.struct_size = (uint32_t)sizeof(result);
    if (cadr_machine_run(machine, &run, &result) != CADR_STATUS_OK ||
        result.clock_slots_completed != 1U ||
        cadr_machine_trace_digest(machine, digest) != CADR_STATUS_OK) {
        cadr_machine_destroy(machine);
        return 1;
    }
    for (index = 0U; index < CADR_SHA256_BYTES; ++index) {
        (void)printf("%02x", digest[index]);
    }
    (void)putchar('\n');
    cadr_machine_destroy(machine);
    return 0;
}
