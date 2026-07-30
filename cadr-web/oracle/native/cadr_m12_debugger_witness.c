/* Disposable public-usim debugger witness; not a maintained-usim API. */
#include "cadr_m12_debugger_witness.h"

#include <err.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define CADR_M12_QMLP UINT32_C(0164)
#define CADR_M12_DMLP UINT32_C(0200)

static FILE *cadr_m12_witness_stream;
static uint64_t cadr_m12_witness_sequence;
static int cadr_m12_witness_open_attempted;

static int
cadr_m12_witness_control_state(void)
{
    const char *const path = getenv("CADR_M12_DEBUGGER_WITNESS_CONTROL");
    FILE *stream;
    char value[16] = { 0 };
    int read_ok;
    if (path == NULL || path[0] == '\0') return 0;
    stream = fopen(path, "r");
    if (stream == NULL) return 0;
    read_ok = fgets(value, sizeof(value), stream) != NULL;
    if (!read_ok || fclose(stream) != 0) return 0;
    if (strcmp(value, "pause\n") == 0) return 1;
    return strcmp(value, "resume\n") == 0 ? 2 : 0;
}

static void
cadr_m12_witness_control_event(const char *const event, const char *const label,
                               const uint64_t machine_cycles, const uint32_t p0_pc,
                               const uint32_t p1_pc, const uint32_t next_pc,
                               const uint32_t location_counter)
{
    if (fprintf(cadr_m12_witness_stream,
                "{\"event\":\"%s\",\"label\":\"%s\","
                "\"location_counter\":%" PRIu32 ",\"machine_cycles\":%" PRIu64
                ",\"next_pc\":%" PRIu32 ",\"p0_pc\":%" PRIu32
                ",\"p1_pc\":%" PRIu32 ",\"sequence\":%" PRIu64 "}\n",
                event, label, location_counter, machine_cycles, next_pc, p0_pc, p1_pc,
                cadr_m12_witness_sequence++) < 0 || fflush(cadr_m12_witness_stream) != 0) {
        err(1, "CDRM12USIM1 candidate pause/resume");
    }
}

static void
cadr_m12_witness_open(void)
{
    const char *const path = getenv("CADR_M12_DEBUGGER_WITNESS");
    int descriptor;
    if (cadr_m12_witness_open_attempted != 0) return;
    cadr_m12_witness_open_attempted = 1;
    if (path == NULL || path[0] == '\0') return;
    descriptor = open(path, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (descriptor < 0) err(1, "CDRM12USIM1 cannot create witness");
    cadr_m12_witness_stream = fdopen(descriptor, "w");
    if (cadr_m12_witness_stream == NULL) err(1, "CDRM12USIM1 fdopen");
    if (fprintf(cadr_m12_witness_stream,
                "{\"schema\":\"CDRM12USIM1\",\"schema_version\":1}\n") < 0 ||
        fflush(cadr_m12_witness_stream) != 0) err(1, "CDRM12USIM1 header");
}

void
cadr_m12_native_debugger_witness_boundary(const uint64_t machine_cycles,
                                          const uint32_t p0_pc,
                                          const uint32_t p1_pc,
                                          const uint32_t next_pc,
                                          const uint32_t location_counter)
{
    const char *label;
    const struct timespec delay = { 0, 1000000L };
    if (p1_pc == CADR_M12_QMLP) label = "QMLP";
    else if (p1_pc == CADR_M12_DMLP) label = "DMLP";
    else return;
    cadr_m12_witness_open();
    if (cadr_m12_witness_stream == NULL) return;
    if (fprintf(cadr_m12_witness_stream,
                "{\"event\":\"candidate-loop\",\"label\":\"%s\","
                "\"location_counter\":%" PRIu32 ",\"machine_cycles\":%" PRIu64
                ",\"next_pc\":%" PRIu32 ",\"p0_pc\":%" PRIu32
                ",\"p1_pc\":%" PRIu32 ",\"sequence\":%" PRIu64 "}\n",
                label, location_counter, machine_cycles, next_pc, p0_pc, p1_pc,
                cadr_m12_witness_sequence++) < 0 || fflush(cadr_m12_witness_stream) != 0) {
                err(1, "CDRM12USIM1 candidate loop");
    }
    if (cadr_m12_witness_control_state() != 1) return;
    cadr_m12_witness_control_event("candidate-pause-enter", label, machine_cycles,
                                   p0_pc, p1_pc, next_pc, location_counter);
    while (cadr_m12_witness_control_state() == 1) (void)nanosleep(&delay, NULL);
    if (cadr_m12_witness_control_state() == 2) {
        cadr_m12_witness_control_event("candidate-pause-resume", label, machine_cycles,
                                       p0_pc, p1_pc, next_pc, location_counter);
    }
}
