# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

from contextlib import closing
import os
import platform
from StringIO import StringIO
import sys
import urllib
import zipfile

JSSHELL_DIR = "mozilla-esr31"
JSSHELL_URL = ("https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly"
               "/2015/02/2015-02-25-00-22-19-%s/jsshell-%%s.zip" % JSSHELL_DIR)

JSSHELL_SUPPORTED_PLATFORMS = {
    "win32": "win32",
    "linux2": {
        "i686": "linux-i686",
        "x86_64": "linux-x86_64"
    },
    "darwin": "mac"
}


def ensureJSShell():
    baseDir = os.path.dirname(__file__)

    try:
        build = JSSHELL_SUPPORTED_PLATFORMS[sys.platform]
        if isinstance(build, dict):
            build = build[platform.machine()]
    except KeyError:
        raise Exception('Platform %s (%s) not supported by JS shell' % (
            sys.platform, platform.machine()
        ))

    shell_dir = os.path.join(baseDir, JSSHELL_DIR + "-" + build)
    if not os.path.exists(shell_dir):
        os.makedirs(shell_dir)
    if sys.platform == 'win32':
        path = os.path.join(shell_dir, 'js.exe')
    else:
        path = os.path.join(shell_dir, 'js')

    if os.path.exists(path):
        return path
    
    with closing(urllib.urlopen(JSSHELL_URL % build)) as response:
        data = response.read()

    with zipfile.ZipFile(StringIO(data)) as zip:
        zip.extractall(shell_dir)

    if not os.path.exists(path):
        raise Exception('Downloaded package didn\'t contain JS shell executable')

    try:
        os.chmod(path, 0700)
    except:
        pass

    return path
