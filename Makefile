include config.mk

# Defines for the mozilla build system
DEPTH := $(MOZ_OBJDIR)/js/src
topsrcdir := $(MOZ_SRCDIR)/js/src
srcdir := $(MOZ_SRCDIR)/js/src
MODULE := js

include $(MOZ_OBJDIR)/js/src/config/autoconf.mk
include $(MOZ_SRCDIR)/js/src/config/config.mk

LINK := -L$(MOZ_OBJDIR)/dist/lib -lnspr4 -lm

jshydra: jshydra.o jshydra_funcs.o jshydra_bridge.o
	g++ -o $@ $^ $(MOZ_OBJDIR)/js/src/libjs_static.a $(LINK)

.deps:
	@if [ ! -e .deps ]; then mkdir .deps; fi

%.o: %.cpp .deps $(MOZ_OBJDIR)/js/src/libjs_static.a
	$(CXX) -o $@ -c $(COMPILE_CXXFLAGS) $<

clean:
	@rm -rf jshydra *.o .deps

TESTS := $(notdir $(wildcard autotest/test_*.js))
check: jshydra
	@cd autotest && for f in $(TESTS); do \
		eval $$(cat $$f | sed -e '/^\/\/ [A-Za-z]*:/!q' -e 's+^// \([A-Za-z]*\): \(.*\)$$+export \1="\2"+'); \
		echo -n "$$Name... "; \
		../jshydra $$f $$Arguments &> .$$f.out; \
		if diff -q ".$$f.out" "$$f.expected" &>/dev/null; then \
			echo ' passed!'; \
		else \
		echo ' failed! Log:'; \
			cat .$$f.out; \
		fi \
	done && rm .*.out

.PHONY: check

echo-variable-%:
	@echo "$($*)"
