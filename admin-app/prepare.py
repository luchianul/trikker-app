# Rulat dupa "npx cap add android", din folderul admin-app: iconita, cheia de semnare, numar de versiune.
import os, re, shutil
from PIL import Image, ImageDraw, ImageFont

res = 'android/app/src/main/res'
S = 1024
im = Image.new('RGBA', (S, S), (16, 35, 63, 255)); d = ImageDraw.Draw(im)
for y in range(S):                                   # degrade albastru
    t = y / S; d.line([(0, y), (S, y)], fill=(int(16 + 14 * t), int(35 + 80 * t), int(63 + 150 * t), 255))
bolt = [(560, 120), (270, 560), (470, 560), (400, 900), (760, 430), (550, 430), (640, 120)]
d.polygon(bolt, fill=(255, 150, 40, 255))
try: f = ImageFont.load_default(size=150)
except TypeError: f = ImageFont.load_default()
w = d.textlength('ADMIN', font=f); d.text(((S - w) / 2, 800), 'ADMIN', fill=(255, 255, 255, 255), font=f)

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
