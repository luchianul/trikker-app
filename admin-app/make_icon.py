# Deseneaza iconita VerTech Admin in build/icon.png (folosita si pentru Android si pentru Windows)
from PIL import Image, ImageDraw, ImageFont
S = 1024
im = Image.new('RGBA', (S, S), (16, 35, 63, 255)); d = ImageDraw.Draw(im)
for y in range(S):
    t = y / S; d.line([(0, y), (S, y)], fill=(int(16 + 14 * t), int(35 + 80 * t), int(63 + 150 * t), 255))
d.polygon([(560, 120), (270, 560), (470, 560), (400, 900), (760, 430), (550, 430), (640, 120)], fill=(255, 150, 40, 255))
try: f = ImageFont.load_default(size=150)
except TypeError: f = ImageFont.load_default()
w = d.textlength('ADMIN', font=f); d.text(((S - w) / 2, 800), 'ADMIN', fill=(255, 255, 255, 255), font=f)
im.save('build/icon.png')
