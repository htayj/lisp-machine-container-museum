CC ?= cc
AR ?= ar
NM ?= nm

CPPFLAGS := -Iinclude -Icore -Icore/usim-port -Itrace -Ihost
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
	core/cadr_state_v3.c \
	core/cadr_state_v4.c \
	core/cadr_state_v5.c \
	core/cadr_m4_media.c \
	core/cadr_disk_evidence.c \
	core/cadr_m4_controller_transcript.c \
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
	build/test_cadr_disk_controller \
	build/test_cadr_core_integration \
	build/test_cadr_state_v2 \
	build/test_cadr_trace_engine \
	build/test_cadr_snapshot \
	build/test_cadr_m2_public \
	build/test_cadr_m3_conformance \
	build/test_cadr_m3_page_zero_probe \
	build/test_cadr_m3_projection \
	build/test_cadr_m3_native_observer \
	build/test_cadr_state_v4_media \
	build/test_cadr_m4_controller_transcript \
	build/test_cadr_m4_block_service \
	build/test_cadr_m5_scheduler
MUTANT_TARGETS := 0 1 2 3
MUTANT_BASE_BINARIES := $(MUTANT_TARGETS:%=build/test_cadr_m2_mutant_base_%)
MUTANT_BINARIES := $(MUTANT_TARGETS:%=build/test_cadr_m2_mutant_%)
HOST_BINARY := build/cadr-headless
M2_HOST_BINARY := build/cadr-snapshot-inspect
M3_HOST_BINARY := build/cadr-m3-native
M3_SNAPSHOT_HOST_BINARY := build/cadr-m3-snapshot
M3_SNAPSHOT_RESTORE_HOST_BINARY := build/cadr-m3-snapshot-restore
M3_TRACE_HOST_BINARY := build/cadr-m3-trace-native
M4_HOST_BINARY := build/cadr-m4-native
M4_MEDIA_COMPARE_BINARY := build/cadr-m4-media-compare
M3_WASM_O0 := build/cadr-web-m3-O0.wasm
M4_WASM_O2 := build/cadr-web-m4-O2.wasm
M5_WASM_O0 := build/cadr-web-m5-O0.wasm
M6_DEVID_WASM_O0 := build/cadr-web-m6-devid-O0.wasm

.PHONY: all test clean audit forbidden-symbols exported-symbols mutable-globals dependency-audit header-audit mutant-audit python-cross-parse m3-wasm m3-browser m3-differential m3-conformance m3-snapshot-cross-target m4-unit m4-browser m4-differential m4-media-compare m5-unit m6-devid-wasm

all: $(LIBRARY) $(HOST_BINARY) $(M2_HOST_BINARY) $(M3_HOST_BINARY) $(M3_SNAPSHOT_HOST_BINARY)

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

build/test_cadr_m3_page_zero_probe: tests/test_cadr_m3_page_zero_probe.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_TESTING -o $@ tests/test_cadr_m3_page_zero_probe.c $(CORE_SOURCES)

build/test_cadr_m4_block_service: tests/test_cadr_m4_block_service.c host/cadr_m4_block_service.c host/cadr_m4_block_service.h host/cadr_m4_file_range_reader.c host/cadr_m4_file_range_reader.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ tests/test_cadr_m4_block_service.c host/cadr_m4_block_service.c host/cadr_m4_file_range_reader.c $(LIBRARY)

build/test_cadr_m3_projection: tests/test_cadr_m3_projection.c host/cadr_m3_projection.c host/cadr_m3_projection.h $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ tests/test_cadr_m3_projection.c host/cadr_m3_projection.c

build/test_cadr_m3_native_observer: tests/test_cadr_m3_native_observer.c host/cadr_m3_native_observer.c host/cadr_m3_native_observer_sink.h core/cadr_m3_native_observer.h $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_NATIVE_OBSERVER -o $@ tests/test_cadr_m3_native_observer.c host/cadr_m3_native_observer.c

build/test_cadr_m2_mutant_base_%: tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_MUTANT_TARGET=$* -o $@ tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES)

build/test_cadr_m2_mutant_%: tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	@mutation_flag="$$(case "$*" in 0) echo -DCADR_TRACE_MUTANT_ALU;; 1) echo -DCADR_TRACE_MUTANT_JUMP;; 2) echo -DCADR_TRACE_MUTANT_DISPATCH;; 3) echo -DCADR_TRACE_MUTANT_BYTE;; *) exit 1;; esac)"; \
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_MUTANT_TARGET=$* $$mutation_flag -o $@ tests/test_cadr_m2_mutant_trace.c $(CORE_SOURCES)

$(HOST_BINARY): host/cadr_headless.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

$(M2_HOST_BINARY): host/cadr_snapshot_inspect.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

$(M3_HOST_BINARY): host/cadr_m3_native.c host/cadr_m3_projection.c host/cadr_m3_projection.h host/cadr_m3_native_observer.c host/cadr_m3_native_observer_sink.h $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_NATIVE_OBSERVER -o $@ host/cadr_m3_native.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(CORE_SOURCES)

$(M3_SNAPSHOT_HOST_BINARY): host/cadr_m3_snapshot.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_NATIVE_OBSERVER -o $@ host/cadr_m3_snapshot.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(LIBRARY)

$(M3_SNAPSHOT_RESTORE_HOST_BINARY): host/cadr_m3_snapshot_restore.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_NATIVE_OBSERVER -o $@ host/cadr_m3_snapshot_restore.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(LIBRARY)

$(M3_TRACE_HOST_BINARY): host/cadr_m3_trace_native.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

$(M4_HOST_BINARY): host/cadr_m4_native.c host/cadr_m4_block_service.c host/cadr_m4_block_service.h host/cadr_m4_file_range_reader.c host/cadr_m4_file_range_reader.h host/cadr_m3_projection.c host/cadr_m3_projection.h host/cadr_m3_native_observer.c host/cadr_m3_native_observer_sink.h $(CORE_SOURCES) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M3_NATIVE_OBSERVER -o $@ host/cadr_m4_native.c host/cadr_m4_block_service.c host/cadr_m4_file_range_reader.c host/cadr_m3_projection.c host/cadr_m3_native_observer.c $(CORE_SOURCES)

$(M4_MEDIA_COMPARE_BINARY): host/cadr_m4_media_compare.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

m4-media-compare: $(M4_MEDIA_COMPARE_BINARY)

$(M3_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --opt O0 $@

$(M4_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m4 --opt O2 $@

$(M5_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m5 --opt O0 $@

$(M6_DEVID_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m6-devid --opt O0 $@

build/test_cadr_m6_disk_evidence: tests/test_cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -DCADR_M6_DEVID_MAX_TOTAL_EVENTS=UINT64_C\(513\) -o $@ tests/test_cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.c $(LIBRARY)

build/test_cadr_m6_disk_evidence_differential: tests/test_cadr_m6_disk_evidence_differential.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -o $@ tests/test_cadr_m6_disk_evidence_differential.c core/cadr_m6_disk_evidence.c $(LIBRARY)

build/cadr_m6_tail_fixture: tests/cadr_m6_tail_fixture.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -o $@ tests/cadr_m6_tail_fixture.c core/cadr_m6_disk_evidence.c $(LIBRARY)

test: $(TEST_BINARIES) $(HOST_BINARY) $(M2_HOST_BINARY) $(M3_HOST_BINARY) mutant-audit python-cross-parse m3-wasm m3-conformance m3-browser m4-unit m4-browser m5-unit m6-devid-wasm audit
	./build/test_cadr_host_api
	./build/test_cadr_machine_state
	./build/test_cadr_processor_microengine
	./build/test_cadr_memory_maps
	./build/test_cadr_bus_device
	./build/test_cadr_disk_controller
	./build/test_cadr_core_integration
	./build/test_cadr_state_v2
	./build/test_cadr_trace_engine
	./build/test_cadr_snapshot
	./build/test_cadr_m2_public
	./build/test_cadr_m3_conformance
	./build/test_cadr_m3_page_zero_probe
	./build/test_cadr_m3_projection
	./build/test_cadr_m3_native_observer
	./build/test_cadr_state_v4_media
	./build/test_cadr_m4_block_service
	./build/test_cadr_m5_scheduler

m3-wasm: $(M3_WASM_O0)
	guix shell node -- node --version | grep -x 'v22.14.0'
	guix shell node -- node ../tests/test_cadr_m3_wasm_build.mjs
	guix shell node -- node ../tests/test_cadr_m3_wasm_runner_framing.mjs
	guix shell node -- node ../tests/test_cadr_m3_worker.mjs

m3-conformance:
	../scripts/run-cadr-m3-conformance.sh

m3-browser: $(M3_WASM_O0)
	python3 ../tests/test_cadr_m3_browser.py

m4-browser: $(M4_WASM_O2)
	python3 ../tests/test_cadr_m4_browser.py

# The exact one-million-boundary gate requires the local excluded System 303
# disk and is deliberately explicit rather than silently skipped in `make test`.
m3-differential: $(HOST_BINARY) $(M3_HOST_BINARY) $(M3_WASM_O0)
	../scripts/run-cadr-m3-differential.sh

m3-snapshot-cross-target: $(M3_SNAPSHOT_HOST_BINARY) $(M3_SNAPSHOT_RESTORE_HOST_BINARY) $(M3_TRACE_HOST_BINARY) $(M3_WASM_O0)
	../scripts/run-cadr-m3-snapshot-cross-target.sh

# The M4 host-service gate needs the excluded System 303 disk and is explicit.
m4-unit: build/test_cadr_state_v4_media build/test_cadr_m4_controller_transcript build/test_cadr_m4_block_service m4-media-compare
	./build/test_cadr_state_v4_media
	./build/test_cadr_m4_controller_transcript
	./build/test_cadr_m4_block_service
	guix shell node -- node ../tests/test_cadr_m4_block_service.mjs
	guix shell node -- node ../tests/test_cadr_m4_media.mjs

m4-differential: $(M4_HOST_BINARY) m4-unit
	../scripts/run-cadr-m4-differential.sh

m5-unit: build/test_cadr_m5_scheduler $(M5_WASM_O0)
	./build/test_cadr_m5_scheduler
	python3 ../tests/test_cadr_m5_transcript.py
	python3 ../tests/test_cadr_m5_differential_runner.py
	guix shell node -- node ../tests/test_cadr_m5_worker.mjs
	guix shell node -- node ../tests/test_cadr_m5_worker_protocol.mjs
	guix shell node -- node ../tests/test_cadr_m5_visibility_adapter.mjs
	guix shell node -- node ../tests/test_cadr_m5_wasm_exports.mjs

m6-devid-wasm: build/test_cadr_m6_disk_evidence build/test_cadr_m6_disk_evidence_differential build/cadr_m6_tail_fixture $(M6_DEVID_WASM_O0)
	./build/test_cadr_m6_disk_evidence
	./build/test_cadr_m6_disk_evidence_differential
	guix shell node -- node ../tests/test_cadr_m6_tail_chain.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_wasm_exports.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_worker.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_parser.mjs
	guix shell node -- node ../tests/test_cadr_m6_ready4_binding.mjs
	guix shell node -- node ../scripts/run-cadr-m6-devid-wasm-conformance.mjs --no-build --negative-only
	guix shell node -- node ../tests/test_cadr_m6_devid_o2_canary_runner.mjs

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
