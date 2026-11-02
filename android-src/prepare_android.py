# Rulat automat de GitHub dupa "npx cap add android": pune pluginul de tiparire, cheia stabila si iconita Trikker.
import os, shutil
from PIL import Image, ImageDraw

pkg = 'android/app/src/main/java/com/diazelectricite/trikker'
for f in ('PrintPlugin.java', 'MainActivity.java'):
    shutil.copy('android-src/' + f, pkg + '/' + f)

res = 'android/app/src/main/res'
src = Image.open('build/icon.png').convert('RGBA')
def mask(px, circle):
    m = Image.new('L', (px * 4, px * 4), 0); dd = ImageDraw.Draw(m)
    if circle: dd.ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    else: dd.rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=int(px * 4 * 0.22), fill=255)
    return m.resize((px, px), Image.LANCZOS)
for dens, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    im = src.resize((px, px), Image.LANCZOS)
    for name, circ in (('ic_launcher.png', False), ('ic_launcher_round.png', True)):
        out = Image.new('RGBA', (px, px), (0, 0, 0, 0)); out.paste(im, (0, 0), mask(px, circ))
        out.save('%s/mipmap-%s/%s' % (res, dens, name))
# fara iconite adaptive: Android foloseste direct PNG-urile de mai sus
shutil.rmtree(res + '/mipmap-anydpi-v26', ignore_errors=True)

# aceeasi cheie de semnare la fiecare versiune => noul .apk se instaleaza peste cel vechi, fara sa pierzi datele
home = os.path.expanduser('~/.android')
os.makedirs(home, exist_ok=True)
shutil.copy('android-keystore/debug.keystore', home + '/debug.keystore')
print('Android pregatit')
