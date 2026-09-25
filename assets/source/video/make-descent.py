"""Render the intro-to-workbench transition video from the shipped plate.

Usage: python3 assets/source/video/make-descent.py
Needs Pillow and ffmpeg (libx264). Output: public/assets/video/descent.mp4

Shot: the camera starts on the flooded porthole, pulls back while the lab
power comes on, then settles on the real first gameplay frame
(game-first-frame.png, captured from the running game at 720x1080 with UI hidden).
"""
import math
import random
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
W, H, FPS, SECONDS = 720, 1080, 30, 6.0
FRAMES = int(FPS * SECONDS)
OUT = ROOT / 'public/assets/video/descent.mp4'

plate = Image.open(ROOT / 'public/assets/textures/workshop-v4.webp').convert('RGB')
game = Image.open(Path(__file__).with_name('game-first-frame.png')).convert('RGB').resize((W, H), Image.LANCZOS)
PW, PH = plate.size
START = (600.0, 20.0, 900.0, 470.0)  # porthole close-up, 2:3
END = (0.0, 0.0, float(PW), float(PH))

rng = random.Random(7)
bubbles = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(2, 7), rng.uniform(40, 120)) for _ in range(46)]


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def frame(i: int) -> Image.Image:
    s = i / FPS
    pull = ease((s - 0.9) / 3.1)
    box = tuple(lerp(a, b, pull) for a, b in zip(START, END))
    img = plate.resize((W, H), Image.BICUBIC, box=box)
    if pull < 0.35:
        img = img.filter(ImageFilter.GaussianBlur(1.2 * (1 - pull / 0.35)))

    # Bubbles drift up past the glass while the camera is still at the porthole.
    bubble_alpha = 1 - ease(pull / 0.45)
    if bubble_alpha > 0:
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        for x, y, r, speed in bubbles:
            by = (y - speed * s) % (H + 40) - 20
            bx = x + math.sin(s * 1.7 + y) * 6
            a = int(110 * bubble_alpha)
            draw.ellipse((bx - r, by - r, bx + r, by + r), outline=(190, 235, 240, a), width=1)
        img = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')

    # Power comes back: dim, one flicker, then full light.
    light = lerp(0.68, 1.0, ease((s - 1.4) / 2.2))
    if 2.05 < s < 2.25:
        light *= 0.6
    img = ImageEnhance.Brightness(img).enhance(light)

    # Dip to dark, then come up on the real first gameplay frame (no ghosted press).
    if s >= 4.0:
        dip = ease((s - 4.0) / 0.4)
        rise = ease((s - 4.4) / 0.6)
        img = game if s >= 4.4 else img
        img = ImageEnhance.Brightness(img).enhance(lerp(1.0, 0.18, dip) if s < 4.4 else lerp(0.18, 1.0, rise))

    fade_in = ease(s / 0.8)
    if fade_in < 1:
        img = Image.blend(Image.new('RGB', (W, H)), img, fade_in)
    return img


ffmpeg = subprocess.Popen([
    'ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow',
    '-movflags', '+faststart', str(OUT),
], stdin=subprocess.PIPE)
for n in range(FRAMES):
    ffmpeg.stdin.write(frame(n).tobytes())
ffmpeg.stdin.close()
if ffmpeg.wait() != 0:
    raise SystemExit('ffmpeg failed')
print(OUT, OUT.stat().st_size)
