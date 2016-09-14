# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import os
import platform
import io
import zipfile
import subprocess

try:
    from urllib.request import urlopen
except ImportError:
    import urllib2
    import contextlib

    def urlopen(*args, **kwargs):
        return contextlib.closing(urllib2.urlopen(*args, **kwargs))

JSSHELL_DIR = 'mozilla-esr45'
JSSHELL_URL = ('https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly'
               '/2016/05/2016-05-29-00-15-03-{}'
               '/jsshell-{{}}.zip'.format(JSSHELL_DIR))

JSSHELL_SUPPORTED_PLATFORMS = {
    'Windows': 'win32',
    'Linux': {
        'i686': 'linux-i686',
        'x86_64': 'linux-x86_64'
    },
    'Darwin': 'mac'
}


def ensure_jsshell():
    path = os.environ.get('SPIDERMONKEY_BINARY')
    if path and os.path.isfile(path):
        return path

    system = platform.system()
    try:
        build = JSSHELL_SUPPORTED_PLATFORMS[system]
        if isinstance(build, dict):
            build = build[platform.machine()]
    except KeyError:
        raise Exception('Platform {} ({}) not supported by JS shell'.format(
            system, platform.machine()
        ))

    shell_dir = os.path.join(os.path.dirname(__file__),
                             '{}-{}'.format(JSSHELL_DIR, build))
    if not os.path.exists(shell_dir):
        os.makedirs(shell_dir)
    if system == 'Windows':
        path = os.path.join(shell_dir, 'js.exe')
    else:
        path = os.path.join(shell_dir, 'js')

    if os.path.exists(path):
        return path

    with urlopen(JSSHELL_URL.format(build)) as response:
        data = response.read()

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        archive.extractall(shell_dir)

    if not os.path.exists(path):
        raise Exception("Downloaded package doesn't contain JS shell")

    try:
        os.chmod(path, 0o700)
    except:
        pass

    return path


def rewrite_js(args, script=None):
    jsshell = ensure_jsshell()
    env = {'LD_LIBRARY_PATH': os.path.relpath(os.path.dirname(jsshell))}
    base_dir = os.path.dirname(__file__)

    if not script:
        script = os.path.join(base_dir, 'scripts', 'abprewrite.js')

    command = [jsshell, os.path.join(base_dir, 'jshydra.js'), script] + args
    return subprocess.check_output(command, env=env, universal_newlines=True)
