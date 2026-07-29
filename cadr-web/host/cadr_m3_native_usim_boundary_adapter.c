/*
 * Inclusion-only CDRM3AD1 writer for the disposable upstream-usim oracle.
 *
 * This file is textually included at the end of cadr_oracle_native.c.  The
 * containing translation unit supplies state_scalars(), the SHA-256 codec,
 * little-endian encoders, boundary_ordinal, and fatal().  It is not compiled
 * into the portable core.
 */
#include <stdio.h>
#include <stdlib.h>

#define CADR_M3_ADAPTER_SCHEMA 1u
#define CADR_M3_ADAPTER_DIGEST_BYTES 32u

static FILE *cadr_m3_adapter_stream;
static uint64_t cadr_m3_adapter_observed;

static void
cadr_m3_native_usim_adapter_open(void)
{
    const char *path = getenv("CADR_M3_UPSTREAM_ADAPTER");
    uint8_t header[32];
    if (path == NULL || *path == '\0')
        fatal("CADR_M3_UPSTREAM_ADAPTER is required");
    cadr_m3_adapter_stream = fopen(path, "wb");
    if (cadr_m3_adapter_stream == NULL)
        fatal("cannot open CDRM3AD1 output");
    memset(header, 0, sizeof(header));
    memcpy(header, "CDRM3AD1", 8);
    put32(header + 8, CADR_M3_ADAPTER_SCHEMA);
    put32(header + 12, CADR_M3_ADAPTER_DIGEST_BYTES);
    put64(header + 16, slot_limit + 1u);
    put64(header + 24, slot_limit);
    if (fwrite(header, 1, sizeof(header), cadr_m3_adapter_stream) != sizeof(header))
        fatal("cannot write CDRM3AD1 header");
}

static void
cadr_m3_native_usim_adapter_boundary(uint32_t flags)
{
    static const uint8_t domain[] = "CDRM3AD1\0";
    struct state_scalar scalars[60];
    struct sha256 digest;
    uint8_t encoded[8];
    uint8_t result[32];
    uint32_t phase;
    size_t count;

    if (cadr_m3_adapter_stream == NULL)
        cadr_m3_native_usim_adapter_open();
    if (boundary_ordinal != cadr_m3_adapter_observed)
        fatal("CDRM3AD1 boundary ordinal is not contiguous");
    if (flags & ORACLE_BOUNDARY_S0)
        phase = 0u;
    else if (flags & ORACLE_BOUNDARY_EXECUTED)
        phase = 1u;
    else if (flags & ORACLE_BOUNDARY_INHIBITED)
        phase = 2u;
    else
        fatal("CDRM3AD1 boundary phase is not defined");

    count = state_scalars(scalars);
    sha_init(&digest);
    sha_update(&digest, domain, sizeof(domain) - 1u);
    put32(encoded, CADR_M3_ADAPTER_SCHEMA);
    sha_update(&digest, encoded, 4);
    put64(encoded, boundary_ordinal);
    sha_update(&digest, encoded, 8);
    put32(encoded, phase);
    sha_update(&digest, encoded, 4);
    for (size_t index = 0; index < count; ++index) {
        put32(encoded, scalars[index].tag);
        sha_update(&digest, encoded, 4);
        put32(encoded, scalars[index].width);
        sha_update(&digest, encoded, 4);
        put64(encoded, scalars[index].value);
        sha_update(&digest, encoded, scalars[index].width);
    }
    sha_final(&digest, result);
    if (fwrite(result, 1, sizeof(result), cadr_m3_adapter_stream) != sizeof(result))
        fatal("cannot write CDRM3AD1 boundary digest");
    ++cadr_m3_adapter_observed;
}

static void
cadr_m3_native_usim_adapter_finish(uint32_t terminal_status)
{
    uint8_t footer[32];
    if (cadr_m3_adapter_stream == NULL)
        fatal("CDRM3AD1 has no output stream");
    if (cadr_m3_adapter_observed != slot_limit + 1u)
        fatal("CDRM3AD1 observed boundary count is incomplete");
    memset(footer, 0, sizeof(footer));
    memcpy(footer, "CDRM3AE1", 8);
    put64(footer + 8, cadr_m3_adapter_observed);
    put32(footer + 16, terminal_status);
    if (fwrite(footer, 1, sizeof(footer), cadr_m3_adapter_stream) != sizeof(footer) ||
            fflush(cadr_m3_adapter_stream) != 0 ||
            fclose(cadr_m3_adapter_stream) != 0)
        fatal("cannot finalize CDRM3AD1 output");
    cadr_m3_adapter_stream = NULL;
}
