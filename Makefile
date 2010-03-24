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

-include $(wildcard .deps/*.pp)

TESTS := $(notdir $(wildcard autotest/test_*.js))
check:: jshydra
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

full-check:: jshydra
	@cp -R $(MOZ_SRCDIR)/js/src/tests jstest
	@echo "Decompiling JS ASTs.."
	set -e; \
	for f in $$(find jstest -name '*.js'); do \
		echo $$f; \
		./jshydra scripts/decompile.js "$(MOZ_SRCDIR)/js/src/tests$${f#jstest}" >$$f; \
	done
	#python jstest/jstests.py --tinderbox fake_js.sh
