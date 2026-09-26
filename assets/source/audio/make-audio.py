"""Build DEEP PRESS game sounds from CC0 Freesound recordings.

Usage: python3 assets/source/audio/make-audio.py
Needs ffmpeg with libmp3lame. Downloads each preview listed in sources.json (checked against its
sha256) into a cache, cuts the chosen region, and writes mono 44.1 kHz MP3s to public/assets/audio.

Loops are made seamless with an equal-power crossfade, then padded on both sides with their own
wrapped audio. Any window of the loop length inside the padded region is seamless, so MP3 encoder
delay cannot put a gap in it. The app loops from LOOP_PAD to LOOP_PAD + length (see loops.json).
"""
import array
import hashlib
import json
import math
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/audio'
CACHE = HERE / '.cache'
RATE = 44100
LOOP_PAD = 0.25

# key: (source key, start s, length s, kind, fade in s, fade out s, level)
# kind 'loop' is normalized by RMS, 'shot' by peak. Levels are dBFS targets.
CUTS = {
    'bed-sea': ('ambience-sea', 12.0, 20.0, 'loop', 0, 0, -22),
    'bed-hull': ('ambience-hull', 46.0, 20.0, 'loop', 0, 0, -24),
    'press': ('press-loop', 4.0, 8.0, 'loop', 0, 0, -18),
    'creak': ('creak', 1.5, 12.0, 'loop', 0, 0, -18),
    'break-glass': ('break-glass', 0.0, 1.9, 'shot', 0.0, 0.3, -2),
    'break-metal': ('break-metal', 2.4, 2.0, 'shot', 0.01, 0.5, -2),
    'release': ('release', 0.0, 2.2, 'shot', 0.0, 0.6, -6),
    'store': ('store', 0.0, 0.44, 'shot', 0.0, 0.08, -3),
    'discard': ('discard', 0.0, 1.6, 'shot', 0.0, 0.5, -4),
    'hull-groan': ('hull-groan', 9.0, 4.0, 'shot', 0.3, 1.0, -4),
    'drip': ('drip', 5.8, 2.5, 'shot', 0.05, 0.4, -8),
    'alarm': ('alarm', 4.25, 3.35, 'shot', 0.05, 0.5, -6),
    'click': ('click', 0.0, 0.29, 'shot', 0.0, 0.05, -6),
}


def fetch(source):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{source['key']}.mp3"
    if not path.exists():
        subprocess.run(['curl', '-sSfL', '-o', str(path), source['preview']], check=True)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source['sha256']:
        raise SystemExit(f"{source['key']}: sha256 mismatch ({digest})")
    return path


def decode(path, start, length):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(length), '-i', str(path),
                          '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return [x / 32768 for x in array.array('h', raw)]


def seamless(samples, fade):
    """Crossfade the tail into the head so the result loops without a click."""
    n = int(fade * RATE)
    body = samples[:len(samples) - n]
    for i in range(n):
        t = i / n
        body[i] = samples[len(samples) - n + i] * math.cos(t * math.pi / 2) + body[i] * math.sin(t * math.pi / 2)
    return body


def fades(samples, fade_in, fade_out):
    n_in, n_out = int(fade_in * RATE), int(fade_out * RATE)
    for i in range(n_in):
        samples[i] *= i / n_in
    for i in range(n_out):
        samples[len(samples) - 1 - i] *= i / n_out
    return samples


def normalize(samples, kind, level):
    gain_to = 10 ** (level / 20)
    if kind == 'loop':
        rms = math.sqrt(sum(x * x for x in samples) / len(samples))
        gain = gain_to / max(rms, 1e-9)
    else:
        gain = gain_to / max(max(abs(x) for x in samples), 1e-9)
    peak = max(abs(x) for x in samples) * gain
    if peak > 0.98:
        gain *= 0.98 / peak
    return [x * gain for x in samples]


def encode(samples, path):
    pcm = array.array('h', (max(-32767, min(32767, int(x * 32767))) for x in samples)).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '96k', str(path)], input=pcm, check=True)


def main():
    sources = {item['key']: item for item in json.loads((HERE / 'sources.json').read_text())}
    OUT.mkdir(parents=True, exist_ok=True)
    loops = {}
    for name, (key, start, length, kind, fade_in, fade_out, level) in CUTS.items():
        path = fetch(sources[key])
        if kind == 'loop':
            samples = seamless(decode(path, start, length + 0.5), 0.5)
            pad = int(LOOP_PAD * RATE)
            samples = samples[-pad:] + samples + samples[:pad]
            loops[name] = {'start': LOOP_PAD, 'end': LOOP_PAD + length}
        else:
            samples = fades(decode(path, start, length), fade_in, fade_out)
        encode(normalize(samples, kind, level), OUT / f'{name}.mp3')
        print(f'{name:12} {(OUT / f"{name}.mp3").stat().st_size / 1024:6.1f} KB')
    (HERE / 'loops.json').write_text(json.dumps(loops, indent=1) + '\n')


if __name__ == '__main__':
    main()
