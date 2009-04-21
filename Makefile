# You'll need to change the below to match your setup
MOZ_OBJDIR := /src/build/trunk/browser
MOZ_SRCDIR := /src/trunk/mozilla

INCLUDE := -I$(MOZ_OBJDIR)/dist/include/js/ \
		   -I$(MOZ_OBJDIR)/dist/include/nspr/ -DXP_UNIX \
		   -I$(MOZ_SRCDIR)/js/src/
LINK := -L$(MOZ_OBJDIR)/dist/lib -lnspr4 -lm

OBJS := jsapi.o jsarena.o jsarray.o jsatom.o jsbool.o jscntxt.o jsdate.o \
	jsdbgapi.o jsdhash.o jsdtoa.o jsemit.o jsexn.o jsfun.o jsgc.o jshash.o \
	jsinterp.o jsinvoke.o jsiter.o jslock.o jslog2.o jslong.o jsmath.o jsnum.o \
   	jsobj.o json.o jsopcode.o jsparse.o jsprf.o jsregexp.o jsscan.o jsscope.o \
	jsscript.o jsstr.o jsutil.o jsxdrapi.o jsxml.o prmjtime.o jstracer.o \
	Assembler.o Fragmento.o LIR.o RegAlloc.o avmplus.o Nativei386.o jsbuiltins.o

OBJS := $(addprefix $(MOZ_OBJDIR)/js/src/, $(OBJS))

jshydra: jshydra.o jshydra_funcs.o jshydra_bridge.o
	g++ -o jshydra jshydra.o jshydra_funcs.o jshydra_bridge.o $(OBJS) $(LINK)

jshydra.o: jshydra.cpp
	g++ -o jshydra.o -g $(INCLUDE) -c jshydra.cpp

jshydra_funcs.o: jshydra_funcs.cpp
	g++ -o jshydra_funcs.o -g $(INCLUDE) -c jshydra_funcs.cpp
jshydra_bridge.o: jshydra_bridge.cpp
	g++ -o jshydra_bridge.o -g $(INCLUDE) -c jshydra_bridge.cpp -DDEBUG

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
