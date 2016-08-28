# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

from __future__ import print_function

import sys
import os
import re
import difflib

import abp_rewrite


def run_tests():
    testDir = os.path.join(os.path.dirname(__file__), 'autotest')
    succeed = True

    for file in os.listdir(testDir):
        if not re.search(r'^test_.*\.js$', file):
            continue

        file = os.path.join(testDir, file)
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

        output = abp_rewrite.rewrite_js(arguments, file)
        expected = open(file + '.expected', 'rU').read()
        if output == expected:
            print(name + ' passed')
        else:
            succeed = False
            print(name + ' failed! Log:')
            for line in difflib.unified_diff(expected.splitlines(),
                                             output.splitlines(),
                                             fromfile=file + '.expected',
                                             tofile=file + '.output'):
                print(line)
            print()

    return succeed

if __name__ == '__main__':
    sys.exit(not run_tests())
