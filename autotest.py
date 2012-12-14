#!/usr/bin/env python
# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import sys, os, subprocess, re, difflib
from utils import ensureJSShell

def run_tests():
  basedir = os.path.dirname(sys.argv[0])
  if not basedir:
    basedir = '.'

  application = ensureJSShell(basedir)
  env = {
    'LD_LIBRARY_PATH': os.path.dirname(application),
  }
  testdir = os.path.join(basedir, 'autotest')
  for file in os.listdir(testdir):
    if not re.search(r'^test_.*\.js$', file):
      continue

    file = os.path.join(testdir, file)
    handle = open(file, 'r')
    name = None
    arguments = None
    for line in handle:
      match = re.search(r'^//\s*([A-Za-z]+):\s*(.*?)\s*$', line)
      if match and match.group(1).lower() == 'name':
        name = match.group(2)
      elif match and match.group(1).lower() == 'arguments':
        arguments = match.group(2).split(' ')
    handle.close()

    if arguments == None:
      continue

    command = [application, '-U', os.path.join(basedir, 'jshydra.js'), file] + arguments
    out = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env).communicate()[0].replace('\r', '')
    expected = open(file + '.expected', 'r').read().replace('\r', '')
    if out == expected:
      print '%s passed' % name
    else:
      print '%s failed! Log:' % name
      for line in difflib.unified_diff(expected.split('\n'), out.split('\n'), fromfile=file + '.expected', tofile=file + '.output'):
        print line
      print

if __name__ == '__main__':
  run_tests()
