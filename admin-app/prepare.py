# Rulat dupa "npx cap add android", din folderul admin-app: iconita, cheia de semnare, numar de versiune.
import os, re, shutil
import shutil as _sh
from PIL import Image, ImageDraw

res = 'android/app/src/main/res'
im = Image.open('build/icon.png').convert('RGBA')

def mask(px, circle):
    m = Image.new('L', (px * 4, px * 4), 0); dd = ImageDraw.Draw(m)
    if circle: dd.ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    else: dd.rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=int(px * 4 * 0.22), fill=255)
    return m.resize((px, px), Image.LANCZOS)
for dens, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    small = im.resize((px, px), Image.LANCZOS)
    for name, circ in (('ic_launcher.png', False), ('ic_launcher_round.png', True)):
        out = Image.new('RGBA', (px, px), (0, 0, 0, 0)); out.paste(small, (0, 0), mask(px, circ))
        out.save('%s/mipmap-%s/%s' % (res, dens, name))
shutil.rmtree(res + '/mipmap-anydpi-v26', ignore_errors=True)

num = os.environ.get('BUILD_NUM', '1')
g = open('android/app/build.gradle').read()
g = re.sub(r'versionCode \d+', 'versionCode ' + num, g)
g = re.sub(r'versionName "[^"]*"', 'versionName "1.0.' + num + '"', g)
ks = os.path.abspath('../android-keystore/debug.keystore').replace('\\', '/')
sc = "signingConfigs {\n        debug {\n            storeFile file('" + ks + "')\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        }\n    }\n    buildTypes {"
assert 'buildTypes {' in g
g = g.replace('buildTypes {', sc, 1)
open('android/app/build.gradle', 'w').write(g)
print('Admin Android pregatit, versionCode', num)

# actualizari: UpdatePlugin + MainActivity, si permisiunea de instalare
pkg = 'android/app/src/main/java/com/diazelectricite/vertechadmin'
for f in ('UpdatePlugin.java', 'MainActivity.java'):
    shutil.copy('android-src/' + f, pkg + '/' + f)
mf = 'android/app/src/main/AndroidManifest.xml'
m = open(mf).read()
if 'REQUEST_INSTALL_PACKAGES' not in m:
    m = m.replace('<application', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application', 1)
    open(mf, 'w').write(m)
print('Admin: plugin de actualizare adaugat')
