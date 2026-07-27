#include "cadr_processor_memory.h"

#include <stdio.h>
#include <string.h>

static int failures;
static cadr_machine_state state;
static uint32_t bus_read_count;
static uint32_t bus_write_count;
static uint32_t bus_last_address;
static uint32_t bus_read_value;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static void setup(void)
{
    (void)memset(&state, 0, sizeof(state));
    bus_read_count = 0U;
    bus_write_count = 0U;
    bus_last_address = 0U;
    bus_read_value = UINT32_C(0xfeedface);
    cadr_processor_memory_set_main_memory_pages(&state, 2U);
}

static cadr_status test_bus_read(cadr_machine_state *const machine,
                                 const uint32_t paddr, uint32_t *const value)
{
    (void)machine;
    bus_read_count += 1U;
    bus_last_address = paddr;
    *value = bus_read_value;
    return CADR_PROCESSOR_MEMORY_OK;
}

static cadr_status test_bus_write(cadr_machine_state *const machine,
                                  const uint32_t paddr, const uint32_t value)
{
    (void)machine;
    bus_write_count += 1U;
    bus_last_address = paddr;
    bus_read_value = value;
    return CADR_PROCESSOR_MEMORY_OK;
}

static void test_map_translation_and_permissions(void)
{
    uint32_t value = 0U;
    uint32_t page = 0U;
    uint32_t write_allowed = 0U;
    uint32_t access_allowed = 0U;

    setup();
    cadr_processor_memory_write_map(&state, (UINT32_C(3) << 27U) | (UINT32_C(1) << 26U),
                                    UINT32_C(0x00006000));
    CHECK(state.memory.l1_map[3] == 3U);
    cadr_processor_memory_write_map(&state, (UINT32_C(1) << 25U) | (UINT32_C(1) << 23U) |
                                    (UINT32_C(1) << 22U) | 1U, UINT32_C(0x00006055));
    CHECK(cadr_processor_memory_vtop(&state, UINT32_C(0x00006055), NULL, NULL, &page,
                                     &write_allowed, &access_allowed) == UINT32_C(0x155));
    CHECK(page == 1U);
    CHECK(write_allowed == 1U);
    CHECK(access_allowed == 1U);
    CHECK(cadr_processor_memory_main_write(&state, UINT32_C(0x155), UINT32_C(0xa5a5a5a5)) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(cadr_processor_memory_main_read(&state, UINT32_C(0x155), &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(value == UINT32_C(0xa5a5a5a5));
}

static void test_nxm_is_instance_local_and_fail_closed(void)
{
    uint32_t value = 0U;

    setup();
    CHECK(cadr_processor_memory_main_read(&state, UINT32_C(2) << 8U, &value) ==
          CADR_PROCESSOR_MEMORY_NXM);
    CHECK(value == UINT32_MAX);
    CHECK(state.cpu.main_memory_nxm == 1U);
    state.cpu.main_memory_nxm = 0U;
    CHECK(cadr_processor_memory_main_write(&state, UINT32_C(3) << 8U, UINT32_C(1)) ==
          CADR_PROCESSOR_MEMORY_NXM);
    CHECK(state.cpu.main_memory_nxm == 1U);
}

static void test_virtual_bus_amem_and_tv_routes(void)
{
    static const cadr_processor_memory_bus bus = {
        test_bus_read,
        test_bus_write
    };
    uint32_t value;

    setup();
    state.memory.l2_map[0] = (UINT32_C(1) << 23U) |
        (UINT32_C(1) << 22U) | 036001U;
    value = 0U;
    CHECK(cadr_processor_memory_virtual_access(&state, &bus, 0U, 0U, &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(bus_read_count == 1U);
    CHECK(bus_last_address == (036001U << 8U));
    CHECK(value == UINT32_C(0xfeedface));

    setup();
    state.memory.l2_map[0] = (UINT32_C(1) << 23U) |
        (UINT32_C(1) << 22U) | 035774U;
    value = UINT32_C(0x10203040);
    CHECK(cadr_processor_memory_virtual_access(&state, &bus, 1U, 7U, &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(state.cpu.a_memory[7] == UINT32_C(0x10203040));
    CHECK(bus_write_count == 0U);
    value = 0U;
    CHECK(cadr_processor_memory_virtual_access(&state, &bus, 0U, 7U, &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(value == UINT32_C(0x10203040));
    CHECK(bus_read_count == 0U);

    setup();
    state.memory.l2_map[(012345U >> 8U) & 037U] =
        (UINT32_C(1) << 23U) |
        (UINT32_C(1) << 22U) | 036000U;
    value = 0U;
    CHECK(cadr_processor_memory_virtual_access(&state, &bus, 0U, 012345U, &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(bus_read_count == 1U);
    CHECK(bus_last_address == (017000000U | 012345U));
}

static void test_default_ram_profile_enforces_configured_pages(void)
{
    uint32_t value;

    setup();
    state.memory.l2_map[1] = (UINT32_C(1) << 23U) |
        (UINT32_C(1) << 22U) | 1U;
    value = UINT32_C(0x55667788);
    CHECK(cadr_processor_memory_virtual_access(&state, NULL, 1U,
                                               UINT32_C(0x100), &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    value = 0U;
    CHECK(cadr_processor_memory_virtual_access(&state, NULL, 0U,
                                               UINT32_C(0x100), &value) ==
          CADR_PROCESSOR_MEMORY_OK);
    CHECK(value == UINT32_C(0x55667788));
    state.memory.main_memory_pages = 1U;
    value = 0U;
    CHECK(cadr_processor_memory_virtual_access(&state, NULL, 0U,
                                               UINT32_C(0x100), &value) ==
          CADR_PROCESSOR_MEMORY_NXM);
    CHECK(value == UINT32_MAX);
}

int main(void)
{
    test_map_translation_and_permissions();
    test_nxm_is_instance_local_and_fail_closed();
    test_virtual_bus_amem_and_tv_routes();
    test_default_ram_profile_enforces_configured_pages();
    if (failures != 0) { return 1; }
    (void)puts("cadr_memory_maps: ok");
    return 0;
}
