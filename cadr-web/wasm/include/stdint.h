/* Minimal freestanding C11 integer definitions for the CADR-WEB wasm32 build. */
#ifndef CADR_WASM_STDINT_H
#define CADR_WASM_STDINT_H

typedef signed char int8_t;
typedef unsigned char uint8_t;
typedef short int16_t;
typedef unsigned short uint16_t;
typedef int int32_t;
typedef unsigned int uint32_t;
typedef long long int64_t;
typedef unsigned long long uint64_t;
typedef unsigned int uintptr_t;

#define INT32_MIN (-2147483647 - 1)
#define INT32_MAX 2147483647
#define UINT8_MAX 255U
#define UINT16_MAX 65535U
#define UINT32_MAX 4294967295U
#define UINT64_MAX 18446744073709551615ULL
#define UINT8_C(value) value
#define UINT16_C(value) value
#define UINT32_C(value) value##U
#define UINT64_C(value) value##ULL

#endif
