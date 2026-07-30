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
M7_CORE_SOURCES := $(CORE_SOURCES) core/cadr_display.c
M7_CORE_OBJECTS := $(addprefix build/m7/,$(M7_CORE_SOURCES:.c=.o))
M7_LIBRARY := build/libcadr_core_m7.a
M9_CORE_SOURCES := $(M7_CORE_SOURCES)
M9_CORE_OBJECTS := $(addprefix build/m9/,$(M9_CORE_SOURCES:.c=.o))
M9_LIBRARY := build/libcadr_core_m9.a
M11_CORE_SOURCES := $(M7_CORE_SOURCES) core/cadr_audio_model.c
M11_CORE_OBJECTS := $(addprefix build/m11/,$(M11_CORE_SOURCES:.c=.o))
M11_LIBRARY := build/libcadr_core_m11.a
M12_CORE_SOURCES := $(M11_CORE_SOURCES) core/cadr_m12_debugger.c core/cadr_m12_machine_adapter.c
M12_CORE_OBJECTS := $(addprefix build/m12/,$(M12_CORE_SOURCES:.c=.o))
M12_LIBRARY := build/libcadr_core_m12.a
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
M6_DEVID_WASM_O2 := build/cadr-web-m6-devid-O2.wasm
M7_WASM_O0 := build/cadr-web-m7-O0.wasm
M7_WASM_O2 := build/cadr-web-m7-O2.wasm
M7_DEVID_WASM_O0 := build/cadr-web-m7-devid-O0.wasm
M7_DEVID_WASM_O2 := build/cadr-web-m7-devid-O2.wasm
M9_WASM_O0 := build/cadr-web-m9-O0.wasm
M9_WASM_O2 := build/cadr-web-m9-O2.wasm
M12_WASM_O0 := build/cadr-web-m12-O0.wasm
M12_WASM_O2 := build/cadr-web-m12-O2.wasm

.PHONY: all test clean audit forbidden-symbols exported-symbols mutable-globals dependency-audit header-audit mutant-audit python-cross-parse m3-wasm m3-browser m3-differential m3-conformance m3-snapshot-cross-target m4-unit m4-browser m4-differential m4-media-compare m5-unit m6-devid-wasm m6-diagnostic-receipt-unit m7-unit m7-native-source-pin m7-native-source-unit m10-unit m11-unit m12-unit

all: $(LIBRARY) $(HOST_BINARY) $(M2_HOST_BINARY) $(M3_HOST_BINARY) $(M3_SNAPSHOT_HOST_BINARY)

$(LIBRARY): $(CORE_OBJECTS) | build
	rm -f $@
	$(AR) $(ARFLAGS) $@ $^

$(M7_LIBRARY): $(M7_CORE_OBJECTS) | build
	rm -f $@
	$(AR) $(ARFLAGS) $@ $^

$(M9_LIBRARY): $(M9_CORE_OBJECTS) | build
	rm -f $@
	$(AR) $(ARFLAGS) $@ $^

$(M11_LIBRARY): $(M11_CORE_OBJECTS) | build
	rm -f $@
	$(AR) $(ARFLAGS) $@ $^

$(M12_LIBRARY): $(M12_CORE_OBJECTS) | build
	rm -f $@
	$(AR) $(ARFLAGS) $@ $^

build:
	mkdir -p $@

core/%.o: core/%.c $(CORE_HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

trace/%.o: trace/%.c $(CORE_HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

build/m7/%.o: %.c $(CORE_HEADERS)
	mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -c -o $@ $<

build/m9/%.o: %.c $(CORE_HEADERS)
	mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M9_CORE -c -o $@ $<

build/m11/%.o: %.c $(CORE_HEADERS)
	mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M11_CORE -c -o $@ $<

build/m12/%.o: %.c $(CORE_HEADERS)
	mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M9_CORE -DCADR_M11_CORE -DCADR_M12_CORE -c -o $@ $<

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

# The upstream TV file is deliberately compiled as the pinned historical
# source, whose pre-C11 diagnostic style is not a new CADR-WEB warning debt.
# The test translation unit itself retains the repository's strict flags.
m7-native-source-pin:
	@test -f ../l/usim/tv.c && test ! -L ../l/usim/tv.c && test "$$(sha256sum ../l/usim/tv.c | cut -d' ' -f1)" = 26b017bee040648edd5ade643f5777f819513f71639171207e40c06c3425a7d7
	@test -f ../l/usim/tv.h && test ! -L ../l/usim/tv.h && test "$$(sha256sum ../l/usim/tv.h | cut -d' ' -f1)" = 9e482b23e7f34e59910fd0338c745e886dbd6a2a9f593d2eaaf109f2baeea8f4
	@test -f ../l/usim/bus-interface.h && test ! -L ../l/usim/bus-interface.h && test "$$(sha256sum ../l/usim/bus-interface.h | cut -d' ' -f1)" = 6afb89db8e68661e3dc9b569cc27d91d9d3f37e933dc728e79e7c0e7e89ef23b
	@test -f ../l/usim/ucode.h && test ! -L ../l/usim/ucode.h && test "$$(sha256sum ../l/usim/ucode.h | cut -d' ' -f1)" = c9894ea50d7f307045460b0cfe21d0af36d5e4f1704a539f5c7e0eea3ac0f41c
	@test -f ../l/usim/utrace.h && test ! -L ../l/usim/utrace.h && test "$$(sha256sum ../l/usim/utrace.h | cut -d' ' -f1)" = a9cce84dd5b963f0273b90799f62321290ad05c978efdf46b14992915834626e
	@test -f ../l/usim/usym.h && test ! -L ../l/usim/usym.h && test "$$(sha256sum ../l/usim/usym.h | cut -d' ' -f1)" = 7e804d625b5de406dcb3e553e8c1fdc2c0ab61067e7ede5efe4b3ccd227d09e5
	@test -f ../l/usim/trace.h && test ! -L ../l/usim/trace.h && test "$$(sha256sum ../l/usim/trace.h | cut -d' ' -f1)" = 23123fbffed86585ad29b4645853e4ac44e69ae4b805c439adea96eac16cbb89
	@test -f ../l/usim/COPYING.md && test ! -L ../l/usim/COPYING.md && test "$$(sha256sum ../l/usim/COPYING.md | cut -d' ' -f1)" = 9019d704e2460ec451759ad06b9edc3bc33fc57aedca436c3a77066b38b024af

build/cadr_m7_native_tv_test.o: tests/test_cadr_m7_native_tv.c ../l/usim/tv.h m7-native-source-pin | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DNDEBUG -I../l/usim -c -o $@ $<

build/cadr_m7_native_tv_upstream.o: ../l/usim/tv.c ../l/usim/tv.h m7-native-source-pin | build
	$(CC) -std=c11 -DNDEBUG -w -I../l/usim -c -o $@ $<

build/test_cadr_m7_native_tv: build/cadr_m7_native_tv_test.o build/cadr_m7_native_tv_upstream.o | build
	$(CC) -o $@ $^

build/test_cadr_m7_display: tests/test_cadr_m7_display.c $(M7_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -o $@ $< $(M7_LIBRARY)

build/test_cadr_m7_profile_isolation: tests/test_cadr_m7_profile_isolation.c $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(LIBRARY)

build/test_cadr_m9_input_bridge: tests/test_cadr_m9_input_bridge.c $(M9_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M9_CORE -o $@ $< $(M9_LIBRARY)

build/test_cadr_m12_machine_adapter: tests/test_cadr_m12_machine_adapter.c $(M12_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M9_CORE -DCADR_M11_CORE -DCADR_M12_CORE -o $@ $< $(M12_LIBRARY)

build/test_cadr_m12_composed_m8_m11: tests/test_cadr_m12_composed_m8_m11.c $(M12_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M9_CORE -DCADR_M11_CORE -DCADR_M12_CORE -o $@ $< $(M12_LIBRARY)

build/test_cadr_m11_core_audio: tests/test_cadr_m11_core_audio.c $(M11_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -DCADR_M11_CORE -o $@ $< $(M11_LIBRARY)

build/cadr-m7-frame-fixture: host/cadr_m7_frame_fixture.c $(M7_LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M7_CORE -o $@ $< $(M7_LIBRARY)

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

$(M6_DEVID_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h core/cadr_m6_fast_run.c core/cadr_m6_fast_run.h $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m6-devid --opt O0 $@

$(M6_DEVID_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h core/cadr_m6_fast_run.c core/cadr_m6_fast_run.h $(CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m6-devid --opt O2 $@

build/test_cadr_m6_fast_run: tests/test_cadr_m6_fast_run.c core/cadr_m6_fast_run.c core/cadr_m6_fast_run.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_FAST_RUN_TESTING -o $@ tests/test_cadr_m6_fast_run.c core/cadr_m6_fast_run.c $(LIBRARY)

build/test_cadr_m6_disk_evidence: tests/test_cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -DCADR_M6_DEVID_MAX_TOTAL_EVENTS=UINT64_C\(513\) -o $@ tests/test_cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.c $(LIBRARY)

build/test_cadr_m6_disk_evidence_differential: tests/test_cadr_m6_disk_evidence_differential.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -o $@ tests/test_cadr_m6_disk_evidence_differential.c core/cadr_m6_disk_evidence.c $(LIBRARY)

build/cadr_m6_tail_fixture: tests/cadr_m6_tail_fixture.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h $(LIBRARY) $(CORE_HEADERS) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_M6_DEVID_WASM -o $@ tests/cadr_m6_tail_fixture.c core/cadr_m6_disk_evidence.c $(LIBRARY)

$(M7_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M7_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m7 --opt O0 $@

$(M7_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M7_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m7 --opt O2 $@

$(M7_DEVID_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h core/cadr_m6_fast_run.c core/cadr_m6_fast_run.h $(M7_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m7-devid --opt O0 $@

$(M7_DEVID_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c core/cadr_m6_disk_evidence.c core/cadr_m6_disk_evidence.h core/cadr_m6_fast_run.c core/cadr_m6_fast_run.h $(M7_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m7-devid --opt O2 $@

$(M9_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M9_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m9 --opt O0 $@

$(M9_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M9_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m9 --opt O2 $@

$(M12_WASM_O0): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M12_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m12 --opt O0 $@

$(M12_WASM_O2): wasm/build-wasm.sh wasm/cadr_wasm_adapter.c wasm/cadr_wasm_runtime.c $(M12_CORE_SOURCES) $(CORE_HEADERS) | build
	sh wasm/build-wasm.sh --m12 --opt O2 $@

test: $(TEST_BINARIES) $(HOST_BINARY) $(M2_HOST_BINARY) $(M3_HOST_BINARY) mutant-audit python-cross-parse m3-wasm m3-conformance m3-browser m4-unit m4-browser m5-unit m6-devid-wasm m6-diagnostic-receipt-unit m7-unit m7-native-source-unit audit
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

m6-devid-wasm: build/test_cadr_m2_public build/test_cadr_m6_disk_evidence build/test_cadr_m6_disk_evidence_differential build/cadr_m6_tail_fixture build/test_cadr_m6_fast_run $(M5_WASM_O0) $(M6_DEVID_WASM_O0) $(M6_DEVID_WASM_O2)
	./build/test_cadr_m6_disk_evidence
	./build/test_cadr_m6_disk_evidence_differential
	./build/test_cadr_m6_fast_run
	guix shell node -- node ../tests/test_cadr_m6_tail_chain.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_wasm_exports.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_worker.mjs
	guix shell node -- node ../tests/test_cadr_m6_disk_evidence_parser.mjs
	guix shell node -- node ../tests/test_cadr_m6_worker.mjs
	guix shell node -- node ../tests/test_cadr_m6_headless_boot.mjs
	guix shell node -- node ../tests/test_cadr_m6_wasm_runner_failure.mjs
	guix shell node -- node ../tests/test_cadr_m6_ready4_binding.mjs
	guix shell node -- node ../tests/test_cadr_m6_fast_headless.mjs
	guix shell node -- node ../tests/test_cadr_m6_ready4_aggregator.mjs
	guix shell node -- node ../tests/test_cadr_m6_ready4_runner.mjs
	guix shell node -- node ../tests/test_cadr_m6_ready4_campaign_systemd_benchmark.mjs
	guix shell node -- node ../tests/test_cadr_m6_devid_o2_canary_runner.mjs

# This integration test deliberately resolves and archives an older receipt
# commit.  Keep it in the full checkout test suite, but outside the clean
# git-archive M6-DEVID gate used by the receipt-bound M7 canary.
m6-diagnostic-receipt-unit:
	guix shell node -- node ../tests/test_cadr_m6_diagnostic_worker.mjs

m7-unit: build/test_cadr_m7_display build/test_cadr_m7_profile_isolation build/cadr-m7-frame-fixture $(M5_WASM_O0) $(M6_DEVID_WASM_O0) $(M7_WASM_O0) $(M7_WASM_O2) $(M7_DEVID_WASM_O0) $(M7_DEVID_WASM_O2)
	./build/test_cadr_m7_display
	./build/test_cadr_m7_profile_isolation
	@if $(NM) -g --defined-only $(LIBRARY) | grep -Eq 'cadr_(machine_)?display'; then \
		echo "M7 display symbols leaked into the pre-M7 library" >&2; exit 1; \
	fi
	guix shell node -- node ../tests/test_cadr_m7_profile_isolation.mjs
	guix shell node -- node ../tests/test_cadr_m7_renderer.mjs
	guix shell node -- node ../tests/test_cadr_m7_browser_static.mjs
	guix shell node -- node ../tests/test_cadr_m7_worker.mjs
	guix shell node -- node ../tests/test_cadr_m7_worker.mjs --variant O2
	guix shell node -- node ../tests/test_cadr_m7_frame_checkpoint.mjs
	guix shell node -- node ../tests/test_run_cadr_m7_frame_conformance.mjs
	python3 ../tests/test_run_cadr_m7_browser_conformance.py
	guix shell node -- node ../tests/test_cadr_m7_devid_o2_canary.mjs

# The exact upstream TV comparison deliberately compiles the ignored pinned
# public usim checkout.  The clean archive gate uses the explicit logical
# fixture; the full checkout suite must also pass this source-side comparison.
m7-native-source-unit: build/test_cadr_m7_native_tv $(M7_WASM_O0) $(M7_WASM_O2) build/cadr-m7-frame-fixture
	python3 ../tests/test_cadr_m7_native_frame_witness.py
	python3 ../tests/test_cadr_m7_native_frame_oracle.py
	@set -eu; temporary="$$(mktemp -d)"; trap 'rm -rf "$$temporary"' EXIT; \
		./build/test_cadr_m7_native_tv "$$temporary/native.pbm"; \
		guix shell node -- node ../tests/test_cadr_m7_worker.mjs --native-pbm "$$temporary/native.pbm"; \
		guix shell node -- node ../tests/test_cadr_m7_worker.mjs --variant O2 --native-pbm "$$temporary/native.pbm"

m10-unit:
	guix shell node -- node ../tests/test_cadr_m10_persistence.mjs
	guix shell node -- node ../tests/test_cadr_m10_wrapper.mjs
	guix shell node -- node ../tests/test_cadr_m10_controller.mjs
	guix shell node -- node ../tests/test_cadr_m10_indexeddb_static.mjs
	guix shell node -- node ../scripts/run-cadr-m10-indexeddb-browser.mjs
	guix shell node -- node ../scripts/run-cadr-m10-process-kill-browser.mjs

m12-unit: build/test_cadr_m12_machine_adapter build/test_cadr_m12_composed_m8_m11 $(M12_WASM_O0) $(M12_WASM_O2)
	./build/test_cadr_m12_machine_adapter
	./build/test_cadr_m12_composed_m8_m11
	guix shell node -- node ../tests/test_cadr_m12_debugger.mjs
	guix shell node -- node ../tests/test_cadr_m12_wasm_exports.mjs
	CADR_M12_WASM_VARIANT=O2 guix shell node -- node ../tests/test_cadr_m12_wasm_exports.mjs
	guix shell node -- node ../tests/test_cadr_m12_worker.mjs
	guix shell node -- node ../tests/test_cadr_m11_audio_protocol.mjs
	guix shell node -- node ../tests/test_cadr_m11_audio_worklet.mjs
	python3 ../tests/test_cadr_native_source_witness.py

m11-unit: build/test_cadr_m11_core_audio
	$(CC) $(CPPFLAGS) $(CFLAGS) -Icore -o build/test_cadr_m11_audio_model tests/test_cadr_m11_audio_model.c core/cadr_audio_model.c
	./build/test_cadr_m11_audio_model
	./build/test_cadr_m11_core_audio
	python3 ../tests/test_cadr_native_source_witness.py

# M8/M9's dedicated ABI profile maps CDRINP1 records directly to IOB state,
# rather than smuggling host input through generic scheduler event kinds.
m8-m9-unit: build/test_cadr_m9_input_bridge $(M9_WASM_O0) $(M9_WASM_O2)
	./build/test_cadr_m9_input_bridge
	python3 ../tests/test_cadr_m8_m9_native_input_witness.py
	guix shell node -- node ../tests/test_cadr_m8_m9_campaign.mjs
	guix shell node -- node ../tests/test_run_cadr_m8_m9_input_conformance.mjs
	guix shell node -- node ../tests/test_run_cadr_m8_m9_x11_campaign.mjs
	guix shell node -- node ../tests/test_cadr_m8_keyboard.mjs
	guix shell node -- node ../tests/test_cadr_m9_pointer.mjs
	guix shell node -- node ../tests/test_cadr_m9_interactive_lifecycle.mjs
	guix shell node -- node ../tests/test_cadr_m9_pointer_adapter.mjs
	guix shell node -- node ../tests/test_cadr_m8_m9_deactivation.mjs
	guix shell node -- node ../tests/test_cadr_m8_m9_worker_channel.mjs
	guix shell node -- node ../tests/test_cadr_m8_m9_worker.mjs
	CADR_M9_WASM_VARIANT=O2 guix shell node -- node ../tests/test_cadr_m8_m9_worker.mjs

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
