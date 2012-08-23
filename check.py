#!/usr/bin/python

banned = ["js1_5/Regress/regress-31255.js",
	"js1_5/Regress/regress-351515.js",
	"js1_5/Regress/regress-89443.js",
	"js1_5/Regress/regress-98901.js",
	"js1_8/regress/regress-366941.js",
	"js1_8/regress/regress-459185.js",
	"js1_8_1/regress/regress-452498-052.js",
	"js1_8_1/regress/regress-452498-053.js",
	"js1_8_1/regress/regress-452498-098.js",
	"js1_8_1/regress/regress-452498-117.js"]

import manifest
xul_tester = manifest.NullXULInfoTester()
test_list = manifest.parse('jstests.list', xul_tester)
for test in test_list:
	if test.enable and test.path[-5:] != '-n.js' and test.path not in banned:
		print test.path
