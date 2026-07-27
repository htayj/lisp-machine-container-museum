CC ?= cc
NM ?= nm

CPPFLAGS ?= -Iinclude -Icore -Icore/usim-port
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2

PROCESSOR_MEMORY_SOURCE := core/usim-port/cadr_processor_memory.c
PROCESSOR_MEMORY_HEADER := core/usim-port/cadr_processor_memory.h
PROCESSOR_MEMORY_TESTS := tests/test_cadr_processor_microengine.c tests/test_cadr_memory_maps.c
PROCESSOR_MEMORY_BUILD := build/processor-memory
PROCESSOR_MEMORY_OBJECT := $(PROCESSOR_MEMORY_BUILD)/cadr_processor_memory.o
PROCESSOR_MEMORY_BINARIES := $(PROCESSOR_MEMORY_TESTS:tests/%.c=$(PROCESSOR_MEMORY_BUILD)/%)

.PHONY: all test audit negative-control clean

all: $(PROCESSOR_MEMORY_BINARIES)

$(PROCESSOR_MEMORY_BUILD):
	mkdir -p $@

$(PROCESSOR_MEMORY_OBJECT): $(PROCESSOR_MEMORY_SOURCE) $(PROCESSOR_MEMORY_HEADER) core/cadr_state.h core/cadr_cpu_state.h core/cadr_memory_state.h | $(PROCESSOR_MEMORY_BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

$(PROCESSOR_MEMORY_BUILD)/test_cadr_processor_%: tests/test_cadr_processor_%.c $(PROCESSOR_MEMORY_OBJECT) $(PROCESSOR_MEMORY_HEADER) | $(PROCESSOR_MEMORY_BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(PROCESSOR_MEMORY_OBJECT)

$(PROCESSOR_MEMORY_BUILD)/test_cadr_memory_%: tests/test_cadr_memory_%.c $(PROCESSOR_MEMORY_OBJECT) $(PROCESSOR_MEMORY_HEADER) | $(PROCESSOR_MEMORY_BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(PROCESSOR_MEMORY_OBJECT)

test: all audit
	@for test_binary in $(PROCESSOR_MEMORY_BINARIES); do $$test_binary; done

audit: $(PROCESSOR_MEMORY_OBJECT)
	@bad_symbols="$$( $(NM) -u $(PROCESSOR_MEMORY_OBJECT) | awk '$$1 == "U" { print $$2 }' | grep -Ev '^(__stack_chk_fail|_stack_chk_fail)$$' || true)"; \
	if test -n "$$bad_symbols"; then echo "$$bad_symbols" >&2; exit 1; fi
	@bad_globals="$$( $(NM) -a $(PROCESSOR_MEMORY_OBJECT) | awk '$$2 ~ /^[BbDdCc]$$/ { print $$3 }' | grep -v '^$$' || true)"; \
	if test -n "$$bad_globals"; then echo "$$bad_globals" >&2; exit 1; fi
	@bad_dependencies="$$( $(CC) $(CPPFLAGS) -MM $(PROCESSOR_MEMORY_SOURCE) | tr ' ' '\n' | grep -E '(^|/)(X11|SDL|emscripten|pthread|sys|unistd|arpa|netinet|signal|time)($$|/|\\.)' || true)"; \
	if test -n "$$bad_dependencies"; then echo "$$bad_dependencies" >&2; exit 1; fi
	@! grep -nE '\<(FILE|time_t|pthread|SDL|X11|socket|pathname|fd)\>' $(PROCESSOR_MEMORY_SOURCE) $(PROCESSOR_MEMORY_HEADER)

negative-control: | $(PROCESSOR_MEMORY_BUILD)
	$(CC) $(CPPFLAGS) $(CFLAGS) -DCADR_PROCESSOR_MEMORY_NEGATIVE_CONTROL -o $(PROCESSOR_MEMORY_BUILD)/negative-control tests/test_cadr_processor_microengine.c $(PROCESSOR_MEMORY_SOURCE)
	@if $(PROCESSOR_MEMORY_BUILD)/negative-control >/dev/null 2>&1; then echo "negative control unexpectedly passed" >&2; exit 1; fi
	@echo "negative-control: divergence observed"

clean:
	rm -rf $(PROCESSOR_MEMORY_BUILD)
