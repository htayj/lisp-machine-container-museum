#include "cadr_host_api.h"

#include <stdio.h>
#include <string.h>

static int failures = 0;

#define CHECK(expression) do { \
    if (!(expression)) { \
        (void)fprintf(stderr, "FAIL %s:%d: %s\\n", __FILE__, __LINE__, #expression); \
        failures += 1; \
    } \
} while (0)

static cadr_machine_config config(void)
{
    cadr_machine_config value;
    (void)memset(&value, 0, sizeof(value));
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.profile = CADR_PROFILE_CADR_WEB_303;
    return value;
}

static cadr_host_request host_request(void)
{
    cadr_host_request value;
    (void)memset(&value, 0, sizeof(value));
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    return value;
}

static cadr_host_completion completion(void)
{
    cadr_host_completion value;
    (void)memset(&value, 0, sizeof(value));
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.host_status = CADR_HOST_RESULT_OK;
    return value;
}

static cadr_run_request run_request(void)
{
    cadr_run_request value;
    (void)memset(&value, 0, sizeof(value));
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    value.clock_slot_budget = UINT64_C(1);
    return value;
}

static cadr_run_result run_result(void)
{
    cadr_run_result value;
    (void)memset(&value, 0, sizeof(value));
    value.abi_major = CADR_ABI_MAJOR;
    value.abi_minor = CADR_ABI_MINOR;
    value.struct_size = (uint32_t)sizeof(value);
    return value;
}

static void test_abi_negotiation(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config value = config();
    cadr_abi_info info;

    cadr_get_abi_info(&info);
    CHECK(info.abi_major == CADR_ABI_MAJOR);
    CHECK(info.abi_minor == CADR_ABI_MINOR);
    CHECK(info.struct_size == sizeof(info));

    value.abi_major += 1U;
    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_ABI_MISMATCH);
    CHECK(machine == NULL);
    value = config();
    value.abi_minor += 1U;
    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_ABI_MISMATCH);
    CHECK(machine == NULL);
    value = config();
    value.struct_size = (uint32_t)(sizeof(value) - 1U);
    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_INVALID_ARGUMENT);
    CHECK(machine == NULL);
    value = config();
    value.profile += 1U;
    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_PROFILE_MISMATCH);
}

static void test_host_cannot_invent_requests_or_reenter_execution(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config value = config();
    cadr_host_request request = host_request();
    cadr_host_request before = request;
    cadr_host_completion host_completion = completion();
    cadr_run_request run = run_request();
    cadr_run_result result = run_result();

    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_OK);
    CHECK(cadr_machine_next_host_request(machine, &request, NULL, 0U) ==
          CADR_STATUS_NOT_READY);
    CHECK(memcmp(&request, &before, sizeof(request)) == 0);
    host_completion.operation = CADR_HOST_OPERATION_BLOCK_READ;
    host_completion.generation = UINT64_C(1);
    host_completion.request_id = UINT64_C(1);
    CHECK(cadr_machine_complete_host_request(machine, &host_completion, NULL, 0U) ==
          CADR_STATUS_WRONG_COMPLETION);
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_NOT_READY);
    CHECK(result.terminal_status == CADR_STATUS_NOT_READY);
    CHECK(result.clock_slots_completed == 0U);
    CHECK(result.microinstructions_executed == 0U);
    CHECK(result.completions_applied == 0U);
    cadr_machine_destroy(machine);
}

static void test_malformed_public_records_fail_closed(void)
{
    cadr_machine *machine = NULL;
    cadr_machine_config value = config();
    cadr_host_request request = host_request();
    cadr_run_request run = run_request();
    cadr_run_result result = run_result();

    CHECK(cadr_machine_create(&value, &machine) == CADR_STATUS_OK);
    request.struct_size = (uint32_t)(sizeof(request) - 1U);
    CHECK(cadr_machine_next_host_request(machine, &request, NULL, 0U) ==
          CADR_STATUS_INVALID_ARGUMENT);
    result.abi_major += 1U;
    CHECK(cadr_machine_run(machine, &run, &result) == CADR_STATUS_ABI_MISMATCH);
    cadr_machine_destroy(machine);
}

int main(void)
{
    test_abi_negotiation();
    test_host_cannot_invent_requests_or_reenter_execution();
    test_malformed_public_records_fail_closed();
    if (failures != 0) {
        return 1;
    }
    (void)puts("cadr_host_api: ok");
    return 0;
}
