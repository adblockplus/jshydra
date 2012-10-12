#!/usr/bin/env python
# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import sys, os, subprocess, urllib, zipfile
from StringIO import StringIO

def ensureJSShell(basedir):
  shell_dir = os.path.join(basedir, 'mozilla')
  if not os.path.exists(shell_dir):
    os.makedirs(shell_dir)
  if sys.platform == 'win32':
    path = os.path.join(shell_dir, 'js.exe')
  else:
    path = os.path.join(shell_dir, 'js')
  if os.path.exists(path):
    return path

  platform_map = {
    'win32': 'win32',
    'linux2': 'linux-i686',
    'darwin': 'mac',
  }
  if sys.platform not in platform_map:
    raise Exception('Unknown platform, is there a JS shell version for it?')

  download_url = 'http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/16.0.1-candidates/build1/jsshell-%s.zip' % platform_map[sys.platform]
  data = StringIO(urllib.urlopen(download_url).read())
  zip = zipfile.ZipFile(data)
  zip.extractall(shell_dir)
  zip.close()

  if not os.path.exists(path):
    raise Exception('Downloaded package didn\'t contain JS shell executable')
  return path

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
  command = [application, os.path.join(basedir, 'jshydra.js'), os.path.join(basedir, 'scripts', 'abprewrite.js'), '--arg', 'module=true source_repo=https://hg.adblockplus.org/adblockplus/']
  for module in ('filterNotifier', 'filterClasses', 'subscriptionClasses', 'filterStorage', 'elemHide', 'matcher', 'filterListener', 'synchronizer'):
    sourceFile = os.path.join(sourceDir, 'lib', module + '.js')
    if not os.path.exists(sourceFile):
      print 'Source file %s could not be found' % sourceFile
      sys.exit(2)
    command.append(sourceFile)

  out = open(os.path.join(targetDir, 'lib', 'adblockplus.js'), 'wb')
  subprocess.Popen(command, stdout=out).communicate()

  command = [application, os.path.join(basedir, 'jshydra.js'), os.path.join(basedir, 'scripts', 'abprewrite.js'), '--arg', 'source_repo=https://hg.adblockplus.org/adblockplustests/']
  for test in ('domainRestrictions', 'filterClasses', 'filterNotifier', 'filterStorage', 'matcher', 'regexpFilters_matching', 'subscriptionClasses'):
    sourceFile = os.path.join(testsDir, 'chrome', 'content', 'tests', test + '.js')
    if not os.path.exists(sourceFile):
      print 'Source file %s could not be found' % sourceFile
      sys.exit(2)
    command.append(sourceFile)

  out = open(os.path.join(targetDir, 'qunit', 'tests', 'adblockplus.js'), 'wb')
  subprocess.Popen(command, stdout=out).communicate()

if __name__ == '__main__':
  doRewrite()
