# You'll need to change the below to match your setup
# If you're doing a raw spidermonkey build, the two paths should be the same,
# pointing to the directory that contains js/ from mozilla-central.
MOZ_OBJDIR := /src/build/trunk/browser
MOZ_SRCDIR := /src/trunk/mozilla

INCLUDE := -I$(MOZ_OBJDIR)/dist/include/js/ \
		   -I$(MOZ_OBJDIR)/dist/include/nspr/ -DXP_UNIX \
		   -I$(MOZ_SRCDIR)/js/src/
LINK := -L$(MOZ_OBJDIR)/dist/lib -lnspr4 -lm

jshydra: jshydra.o jshydra_funcs.o jshydra_bridge.o
	g++ -o jshydra jshydra.o jshydra_funcs.o jshydra_bridge.o $(MOZ_OBJDIR)/js/src/libjs_static.a $(LINK)

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
