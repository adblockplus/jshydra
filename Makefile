include config.mk

# Defines for the mozilla build system
DEPTH := $(MOZ_OBJDIR)/js/src
topsrcdir := $(MOZ_SRCDIR)/js/src
srcdir := $(MOZ_SRCDIR)/js/src
MODULE := js

include $(MOZ_OBJDIR)/js/src/config/autoconf.mk
include $(MOZ_SRCDIR)/js/src/config/config.mk

jshydra$(BIN_SUFFIX): jshydra.$(OBJ_SUFFIX) jshydra_funcs.$(OBJ_SUFFIX) jshydra_bridge.$(OBJ_SUFFIX) $(MOZ_OBJDIR)/js/src/$(LIB_PREFIX)js_static.$(LIB_SUFFIX)
ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
	$(LD) -nologo -out:$@ $^ $(LDFLAGS) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
else
	g++ -o $@ $^ $(LDFLAGS) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS) -lnspr4
endif

.deps:
	@if [ ! -e .deps ]; then mkdir .deps; fi

%.$(OBJ_SUFFIX): %.cpp .deps $(MOZ_OBJDIR)/js/src/$(LIB_PREFIX)js_static.$(LIB_SUFFIX)
	$(CXX) -o $@ -c $(COMPILE_CXXFLAGS) $<

clean:
	@rm -rf jshydra$(BIN_SUFFIX) *.$(OBJ_SUFFIX) *.$(LIB_SUFFIX) .deps

-include $(wildcard .deps/*.pp)

TESTS := $(notdir $(wildcard autotest/test_*.js))
check:: jshydra$(BIN_SUFFIX)
	@cd autotest && for f in $(TESTS); do \
		eval $$(cat $$f | sed -e '/^\/\/ [A-Za-z]*:/!q' -e 's+^// \([A-Za-z]*\): \(.*\)$$+export \1="\2"+'); \
		echo -n "$$Name... "; \
		../jshydra$(BIN_SUFFIX) $$f $$Arguments &> .$$f.out; \
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

full-check:: jshydra$(BIN_SUFFIX)
	@cp -R $(MOZ_SRCDIR)/js/src/tests jstest
	@echo "Decompiling JS ASTs.."
	set -e; \
	for f in $$(find jstest -name '*.js'); do \
		echo $$f; \
		./jshydra$(BIN_SUFFIX) scripts/astDecompile.js --trueast "$(MOZ_SRCDIR)/js/src/tests$${f#jstest}" >$$f; \
	done
	#python jstest/jstests.py --tinderbox fake_js.sh
