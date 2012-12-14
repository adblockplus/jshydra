#!/usr/bin/env python
# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import sys, os, subprocess
from utils import ensureJSShell

def doRewrite():
  if len(sys.argv) < 4:
    print '''Usage:

%s <abp_firefox_dir> <abptests_dir> <abp_chrome_dir>
''' % sys.argv[0]
    sys.exit(2)

  sourceDir = sys.argv[1]
  testsDir = sys.argv[2]
  targetDir = sys.argv[3]

  basedir = os.path.dirname(sys.argv[0])
  if not basedir:
    basedir = '.'

  application = ensureJSShell(basedir)
  env = {
    'LD_LIBRARY_PATH': os.path.dirname(application),
  }
  command = [application, '-U', os.path.join(basedir, 'jshydra.js'), os.path.join(basedir, 'scripts', 'abprewrite.js'), '--arg', 'module=true source_repo=https://hg.adblockplus.org/adblockplus/']
  for module in ('filterNotifier', 'filterClasses', 'subscriptionClasses', 'filterStorage', 'elemHide', 'matcher', 'filterListener', 'synchronizer'):
    sourceFile = os.path.join(sourceDir, 'lib', module + '.js')
    if not os.path.exists(sourceFile):
      print 'Source file %s could not be found' % sourceFile
      sys.exit(2)
    command.append(sourceFile)

  out = open(os.path.join(targetDir, 'lib', 'adblockplus.js'), 'wb')
  subprocess.Popen(command, stdout=out, env=env).communicate()

  command = [application, '-U', os.path.join(basedir, 'jshydra.js'), os.path.join(basedir, 'scripts', 'abprewrite.js'), '--arg', 'source_repo=https://hg.adblockplus.org/adblockplustests/']
  for test in ('domainRestrictions', 'filterClasses', 'filterNotifier', 'filterStorage', 'matcher', 'regexpFilters_matching', 'subscriptionClasses'):
    sourceFile = os.path.join(testsDir, 'chrome', 'content', 'tests', test + '.js')
    if not os.path.exists(sourceFile):
      print 'Source file %s could not be found' % sourceFile
      sys.exit(2)
    command.append(sourceFile)

  out = open(os.path.join(targetDir, 'qunit', 'tests', 'adblockplus.js'), 'wb')
  subprocess.Popen(command, stdout=out, env=env).communicate()

if __name__ == '__main__':
  doRewrite()
