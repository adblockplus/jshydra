# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import os
import subprocess

import utils


def rewrite_js(args, script=None):
    jsshell = utils.ensureJSShell()
    env = {'LD_LIBRARY_PATH': os.path.relpath(os.path.dirname(jsshell))}
    base_dir = os.path.dirname(__file__)

    if not script:
        script = os.path.join(base_dir, 'scripts', 'abprewrite.js')

    command = [jsshell, os.path.join(base_dir, 'jshydra.js'), script] + args
    return subprocess.check_output(command, env=env, universal_newlines=True)
