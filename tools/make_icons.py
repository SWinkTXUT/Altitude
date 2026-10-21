"""Draw the app icon (gradient sky, glowing orb, mountain peak) at the sizes iOS/PWA need."""
import os
from PIL import Image, ImageDraw, ImageFilter

def icon(size):
    S = 1024
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        t = y / S
        top, bot = (42, 31, 110), (10, 10, 31)
        c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3))
        for x in range(S):
            px[x, y] = c
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((262, 150, 762, 650), fill=(62, 230, 193, 150))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img.paste(glow, (0, 0), glow)
    orb = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    o = ImageDraw.Draw(orb)
    for r in range(190, 0, -2):
        k = r / 190
        c = (int(62 + (185 - 62) * (1 - k)), int(230 + (255 - 230) * (1 - k)), int(193 + (240 - 193) * (1 - k)), 255)
        o.ellipse((512 - r - 30 * (1 - k), 400 - r - 30 * (1 - k), 512 + r - 30 * (1 - k), 400 + r - 30 * (1 - k)), fill=c)
    img.paste(orb, (0, 0), orb)
    d = ImageDraw.Draw(img)
    d.polygon([(20, 1024), (420, 470), (560, 640), (660, 540), (1024, 1000), (1024, 1024)], fill=(255, 61, 129))
    d.polygon([(0, 1024), (0, 780), (250, 650), (560, 880), (780, 780), (1024, 900), (1024, 1024)], fill=(99, 102, 241))
    d.polygon([(420, 470), (480, 548), (450, 535), (420, 560), (390, 530), (365, 541)], fill=(255, 225, 235))
    return img.resize((size, size), Image.LANCZOS)

out = os.path.join(os.path.dirname(__file__), "..", "icons")
for s in (180, 192, 512):
    icon(s).save(os.path.join(out, f"icon-{s}.png"), optimize=True)
