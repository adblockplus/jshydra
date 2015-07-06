# coding: utf-8

# This Source Code is subject to the terms of the Mozilla Public License
# version 2.0 (the "License"). You can obtain a copy of the License at
# http://mozilla.org/MPL/2.0/.

import os
import platform
from StringIO import StringIO
import sys
import urllib
import zipfile

def ensureJSShell():
  baseDir = os.path.dirname(__file__)
  shell_dir = os.path.join(baseDir, 'mozilla')
  if not os.path.exists(shell_dir):
    os.makedirs(shell_dir)
  if sys.platform == 'win32':
    path = os.path.join(shell_dir, 'js.exe')
  else:
    path = os.path.join(shell_dir, 'js')
  if os.path.exists(path):
    return path

  supported_platforms = {
    'win32': 'win32',
    'linux2': {
      'i686': 'linux-i686',
      'x86_64': 'linux-x86_64'
    },
    'darwin': 'mac',
  }
  try:
    build = supported_platforms[sys.platform]
    if isinstance(build, dict):
      build = build[platform.machine()]
  except KeyError:
    raise Exception('Platform %s (%s) not supported by JS shell' % (
      sys.platform, platform.machine()
    ))

  download_url = 'https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/2015/02/2015-02-25-00-22-19-mozilla-esr31/jsshell-%s.zip' % build
  data = StringIO(urllib.urlopen(download_url).read())
  zip = zipfile.ZipFile(data)
  zip.extractall(shell_dir)
  zip.close()

  if not os.path.exists(path):
    raise Exception('Downloaded package didn\'t contain JS shell executable')

  try:
    os.chmod(path, 0700)
  except:
    pass

  return path
