CC ?= cc
AR ?= ar
NM ?= nm

CPPFLAGS := -Iinclude -Icore -Icore/usim-port -Itrace
CFLAGS := -std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2
ARFLAGS := rcs

PORT_SOURCES := \
	core/usim-port/cadr_processor_memory.c \
	core/usim-port/bus-adaptor.c \
	core/usim-port/bus-interface.c \
	core/usim-port/unibus-mapping.c \
	core/usim-port/diagnostic-interface.c \
	core/usim-port/tv.c \
	core/usim-port/colortv.c \
	core/usim-port/iob.c \
	core/usim-port/disk-controller.c \
	core/usim-port/tape-controller.c \
	core/usim-port/uch11.c
CORE_SOURCES := \
	core/cadr_core.c \
	core/cadr_state_v2.c \
	core/cadr_snapshot.c \
	trace/cadr_trace_engine.c \
	$(PORT_SOURCES)
CORE_HEADERS := $(sort $(wildcard core/*.h) $(wildcard core/usim-port/*.h) $(wildcard trace/*.h)) include/cadr_host_api.h
CORE_OBJECTS := $(CORE_SOURCES:.c=.o)
LIBRARY := build/libcadr_core.a
TEST_BINARIES := \
	build/test_cadr_host_api \
	build/test_cadr_machine_state \
	build/test_cadr_processor_microengine \
	build/test_cadr_memory_maps \
	build/test_cadr_bus_device \
	build/test_cadr_core_integration \
	build/test_cadr_state_v2 \
	build/test_cadr_trace_engine \
	build/test_cadr_snapshot \
	build/test_cadr_m2_public
MUTANT_TARGETS := 0 1 2 3
MUTANT_BASE_BINARIES := $(MUTANT_TARGETS:%=build/test_cadr_m2_mutant_base_%)
MUTANT_BINARIES := $(MUTANT_TARGETS:%=build/test_cadr_m2_mutant_%)
HOST_BINARY := build/cadr-headless
M2_HOST_BINARY := build/cadr-snapshot-inspect

.PHONY: all test clean audit forbidden-symbols exported-symbols mutable-globals dependency-audit header-audit mutant-audit python-cross-parse

all: $(LIBRARY) $(HOST_BINARY) $(M2_HOST_BINARY)

$(LIBRARY): $(CORE_OBJECTS) | build
	$(AR) $(ARFLAGS) $@ $^

build:
	mkdir -p $@

core/%.o: core/%.c $(CORE_HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

trace/%.o: trace/%.c $(CORE_HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

build/test_%: tests/test_%.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

build/test_cadr_state_v2: tests/test_cadr_state_v2.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_STATE_V2_TESTING -o $@ tests/test_cadr_state_v2.c $(CORE_SOURCES)

build/test_cadr_trace_engine: tests/test_cadr_trace_engine.c core/cadr_state_v2.c trace/cadr_trace_engine.c $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_STATE_V2_TESTING -DCADR_TRACE_ENGINE_TESTING -o $@ tests/test_cadr_trace_engine.c core/cadr_state_v2.c trace/cadr_trace_engine.c

build/test_cadr_m2_mutant_base_%: tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_MUTANT_TARGET=$* -o $@ tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES)

build/test_cadr_m2_mutant_%: tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	@mutation_flag="$$(case "$*" in 0) echo -DCADR_TRACE_MUTANT_ALU;; 1) echo -DCADR_TRACE_MUTANT_JUMP;; 2) echo -DCADR_TRACE_MUTANT_DISPATCH;; 3) echo -DCADR_TRACE_MUTANT_BYTE;; *) exit 1;; esac)"; \
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_MUTANT_TARGET=$* $$mutation_flag -o $@ tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES)

$(HOST_BINARY): host/cadr_headless.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

$(M2_HOST_BINARY): host/cadr_snapshot_inspect.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

test: $(TEST_BINARIES) $(HOST_BINARY) $(M2_HOST_BINARY) mutant-audit python-cross-parse audit
	./build/test_cadr_host_api
	./build/test_cadr_machine_state
	./build/test_cadr_processor_microengine
	./build/test_cadr_memory_maps
	./build/test_cadr_bus_device
	./build/test_cadr_core_integration
	./build/test_cadr_state_v2
	./build/test_cadr_trace_engine
	./build/test_cadr_snapshot
	./build/test_cadr_m2_public

mutant-audit: $(MUTANT_BASE_BINARIES) $(MUTANT_BINARIES)
	@for target in $(MUTANT_TARGETS); do \
		baseline="$$(./build/test_cadr_m2_mutant_base_$$target)" || exit 1; \
		mutant="$$(./build/test_cadr_m2_mutant_$$target)" || exit 1; \
		if test "$$baseline" = "$$mutant"; then \
			echo "mutant $$target did not diverge at its first exercised boundary" >&2; \
			exit 1; \
		fi; \
	done

python-cross-parse: build/test_cadr_m2_public
	CADR_M2_PUBLIC_BINARY="$(CURDIR)/build/test_cadr_m2_public" \
		python ../tests/test_cadr_m2_public_trace.py
	python ../tests/test_cadr_general_trace.py
	python ../tests/test_cadr_trace_engine.py

audit: forbidden-symbols exported-symbols mutable-globals dependency-audit header-audit

forbidden-symbols: $(LIBRARY)
	@bad_symbols="$$( $(NM) $(CORE_OBJECTS) | awk \
		'$$1 == "U" { u[$$2] = 1 } $$2 ~ /^[TtRrWwVv]$$/ { d[$$3] = 1 } \
		 END { for (s in u) if (!(s in d)) print s }' | \
		sed 's/^_//' | grep -Ev '^(_stack_chk_fail|calloc|free|malloc|memcmp|memcpy|memset)$$' || true)"; \
	if test -n "$$bad_symbols"; then \
		echo "$$bad_symbols" >&2; \
		echo "unapproved external symbol referenced by CADR core" >&2; \
		exit 1; \
	fi

exported-symbols: $(LIBRARY)
	@bad_symbols="$$( $(NM) -g --defined-only $(LIBRARY) | \
		awk 'NF >= 3 && $$NF !~ /:$$/ { print $$NF }' | grep -Ev '^cadr_' || true)"; \
	if test -n "$$bad_symbols"; then \
		echo "$$bad_symbols" >&2; \
		echo "unexpected exported CADR core symbol" >&2; \
		exit 1; \
	fi

mutable-globals: $(LIBRARY)
	@bad_symbols="$$( $(NM) -a $(LIBRARY) | \
		awk '$$2 ~ /^[BbDdCcGgSs]$$/ { print $$3 }' | \
		grep -Ev '^($$|\.|cadr_state_v2_schema$$)' || true)"; \
	if test -n "$$bad_symbols"; then \
		echo "$$bad_symbols" >&2; \
		echo "mutable global or thread-local CADR core state is forbidden" >&2; \
		exit 1; \
	fi

dependency-audit: $(CORE_SOURCES) $(CORE_HEADERS)
	@bad_dependencies="$$( $(CC) $(CPPFLAGS) -MM $(CORE_SOURCES) | tr ' ' '\n' | \
		grep -E '(^|/)(X11|SDL|emscripten|pthread|sys|unistd|arpa|netinet|signal|time)($$|/|\.)' || true)"; \
	if test -n "$$bad_dependencies"; then \
		echo "$$bad_dependencies" >&2; \
		echo "host/backend header dependency in CADR core" >&2; \
		exit 1; \
	fi

header-audit:
	@bad_tokens="$$(grep -nE '\<(FILE|time_t|pthread|SDL|X11|socket|callback|pathname|fd)\>' include/cadr_host_api.h || true)"; \
	if test -n "$$bad_tokens"; then \
		echo "$$bad_tokens" >&2; \
		echo "host resource or callback surface in public CADR ABI" >&2; \
		exit 1; \
	fi
	@! grep -q 'cadr_machine_issue_host_request' include/cadr_host_api.h

clean:
	rm -rf build $(CORE_OBJECTS)
