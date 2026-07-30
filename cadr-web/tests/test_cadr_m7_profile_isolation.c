#include "cadr_host_api.h"
#include "cadr_machine.h"

#include <stdio.h>

int main(void)
{
    cadr_abi_info abi = { 0U, 0U, 0U, 0U };
    cadr_get_abi_info(&abi);
    if (CADR_ABI_MINOR != CADR_ABI_MINOR_M6 ||
        abi.abi_minor != CADR_ABI_MINOR_M6 ||
        sizeof(cadr_machine) != sizeof(cadr_machine_state)) {
        (void)fprintf(stderr, "M7 changed the pre-M7 native profile\n");
        return 1;
    }
    (void)puts("cadr M7 native profile isolation passed");
    return 0;
}
