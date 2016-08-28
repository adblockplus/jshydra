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
    test_dir = os.path.join(os.path.dirname(__file__), 'autotest')
    succeed = True

    for filename in os.listdir(test_dir):
        if not re.search(r'^test_.*\.js$', filename):
            continue

        filename = os.path.join(test_dir, filename)
        name = None
        args = None

        with open(filename, 'r') as file:
            for line in file:
                match = re.search(r'^//\s*([A-Za-z]+):\s*(.*?)\s*$', line)
                if match:
                    key = match.group(1).lower()
                    if key == 'name':
                        name = match.group(2)
                    elif key == 'arguments':
                        args = match.group(2).split()

        if args is None:
            continue

        output = abp_rewrite.rewrite_js(args, filename)
        with open(filename + '.expected', 'rU') as file:
            expected = file.read()

        if output == expected:
            print(name + ' passed')
        else:
            succeed = False
            print(name + ' failed! Log:')
            for line in difflib.unified_diff(expected.splitlines(),
                                             output.splitlines(),
                                             fromfile=filename + '.expected',
                                             tofile=filename + '.output'):
                print(line)
            print()

    return succeed

if __name__ == '__main__':
    sys.exit(not run_tests())
