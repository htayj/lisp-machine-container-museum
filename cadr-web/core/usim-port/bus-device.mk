CC ?= cc

CPPFLAGS += -Iinclude -Icore -Icore/usim-port
CFLAGS += -std=c11 -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wformat=2

CADR_BUS_DEVICE_SOURCES := core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c core/usim-port/uch11.c
CADR_BUS_DEVICE_OBJECTS := $(patsubst core/usim-port/%.c,build/bus-device/%.o,$(CADR_BUS_DEVICE_SOURCES))
CADR_BUS_DEVICE_SUPPORT_OBJECT := build/bus-device/cadr_processor_memory.o
CADR_BUS_DEVICE_CLOSURE_OBJECT := build/bus-device/bus-device-closure.o
CADR_BUS_DEVICE_TEST := build/test_cadr_bus_device

.PHONY: bus-device-test bus-device-audit bus-device-dependency-audit

build/bus-device:
	mkdir -p $@

build/bus-device/%.o: core/usim-port/%.c core/usim-port/cadr_bus_device.h core/cadr_state.h core/cadr_bus_state.h core/cadr_device_state.h include/cadr_host_api.h | build/bus-device
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

$(CADR_BUS_DEVICE_SUPPORT_OBJECT): core/usim-port/cadr_processor_memory.c core/usim-port/cadr_processor_memory.h | build/bus-device
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<

$(CADR_BUS_DEVICE_CLOSURE_OBJECT): $(CADR_BUS_DEVICE_OBJECTS) $(CADR_BUS_DEVICE_SUPPORT_OBJECT)
	$(CC) -r -o $@ $^

$(CADR_BUS_DEVICE_TEST): tests/test_cadr_bus_device.c $(CADR_BUS_DEVICE_OBJECTS) $(CADR_BUS_DEVICE_SUPPORT_OBJECT) | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -o $@ $< $(CADR_BUS_DEVICE_OBJECTS) $(CADR_BUS_DEVICE_SUPPORT_OBJECT)

bus-device-dependency-audit:
	@bad_dependencies="$$( $(CC) $(CPPFLAGS) -MM $(CADR_BUS_DEVICE_SOURCES) | tr ' ' '\n' | \
		grep -E '(^|/)(X11|SDL|emscripten|pthread|sys|unistd|arpa|netinet|signal|time)($$|/|\\.)' || true)"; \
	if test -n "$$bad_dependencies"; then echo "$$bad_dependencies" >&2; exit 1; fi
	@bad_tokens="$$(grep -nE '\<(FILE|time_t|pthread|SDL|X11|socket|pathname|poll|errx|warnx)\>' $(CADR_BUS_DEVICE_SOURCES) || true)"; \
	if test -n "$$bad_tokens"; then echo "$$bad_tokens" >&2; exit 1; fi

bus-device-audit: $(CADR_BUS_DEVICE_CLOSURE_OBJECT) bus-device-dependency-audit
	@bad_symbols="$$(nm -a $(CADR_BUS_DEVICE_CLOSURE_OBJECT) | awk '$$2 ~ /^[BbDdCc]$$/ { print $$3 }' | grep -Ev '^\.(bss|data)$$|^$$' || true)"; \
	if test -n "$$bad_symbols"; then echo "$$bad_symbols" >&2; exit 1; fi
	@bad_undefined="$$(nm -u $(CADR_BUS_DEVICE_CLOSURE_OBJECT) | awk '{ sub(/^_/, "", $$NF); print $$NF }' | \
		grep -Ev '^(_stack_chk_fail|stack_chk_fail|memset)$$' || true)"; \
	if test -n "$$bad_undefined"; then echo "$$bad_undefined" >&2; exit 1; fi

bus-device-test: $(CADR_BUS_DEVICE_TEST) bus-device-audit
	./$(CADR_BUS_DEVICE_TEST)

test: bus-device-test
