"""FTX Part 1 — narration assembly (pydub), original score + SFX synthesis (numpy/scipy), final mix (FFmpeg)."""
import subprocess, numpy as np, os
from pydub import AudioSegment
from scipy.signal import butter, sosfilt, fftconvolve
from timeline import SENTS, DUR
from render2 import EDL, S

SR = 48000
N = int(SR * DUR)
OUT = "/tmp/claude-0/ftx2/audio"; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)

# ------------------------------------------------ 1. narration
vo = AudioSegment.silent(duration=int(DUR * 1000), frame_rate=SR)
for s in SENTS:
    seg = AudioSegment.from_wav(s["file"]).set_frame_rate(SR).set_channels(1)
    vo = vo.overlay(seg, position=int(s["start"] * 1000))
vo.export(f"{OUT}/vo_raw.wav", format="wav")
# deeper/warmer documentary voice: slight pitch drop with preserved formants, EQ, compression, short room
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{OUT}/vo_raw.wav", "-af",
    "highpass=f=60,bass=g=1.5:f=130,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=150:makeup=1.5,"
    "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", str(SR), "-ac", "1", f"{OUT}/vo.wav"], check=True)

# ------------------------------------------------ 2. score
t = np.arange(N) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_seg(n, a, r):
    e = np.ones(n); ai, ri = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    e[:ai] = np.linspace(0, 1, ai) ** 2; e[-ri:] *= np.linspace(1, 0, ri) ** 1.5
    return e

def pad_note(freq, n, bright=6):
    tt = np.arange(n) / SR; out = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        f = freq * 2 ** (det / 12)
        ph = rng.uniform(0, 2 * np.pi)
        for h in range(1, bright + 1):
            out += np.sin(2 * np.pi * f * h * tt + ph * h) / h ** 1.6
    return out / 3

music = np.zeros((N, 2))
# chord progression (D minor), ~7.5 s per chord
prog = [[50, 57, 62, 65], [51, 58, 63, 67], [50, 57, 62, 65], [46, 53, 58, 62],
        [43, 50, 58, 62], [44, 51, 56, 60], [45, 52, 57, 61], [50, 56, 62, 65]]
CH = 7.5
end_main = S(18)  # music changes for the finale
k = 0; pos = 0.0
while pos < end_main:
    ch = prog[k % len(prog)]
    st = int(pos * SR); n = int(min(CH + 2.0, end_main + 1.0 - pos) * SR)
    if st + n > N: n = N - st
    e = env_seg(n, 2.2, 2.2)
    for i, m in enumerate(ch):
        v = pad_note(hz(m), n, 5 if pos < 40 else 7) * e * 0.045
        pan = 0.3 + 0.4 * (i % 2)
        music[st:st + n, 0] += v * (1 - pan); music[st:st + n, 1] += v * pan
    pos += CH; k += 1
# sub drone
drone = (np.sin(2 * np.pi * hz(38) * t) * 0.05 + np.sin(2 * np.pi * hz(26) * t) * 0.04) * np.clip(t / 3, 0, 1)
drone *= np.where(t < end_main, 1.0, np.clip(1 - (t - end_main) / 2, 0, 1))
music += drone[:, None]
# sparse high plucks (piano-like) on chord changes
def pluck(freq, dur=2.5):
    n = int(dur * SR); tt = np.arange(n) / SR
    v = (np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(4 * np.pi * freq * tt) + 0.1 * np.sin(6 * np.pi * freq * tt)) * np.exp(-tt * 2.2)
    v[:200] *= np.linspace(0, 1, 200)
    return v
pos = 0.0; k = 0
while pos < end_main - 2:
    ch = prog[k % len(prog)]
    for j, off in enumerate([0.0, 1.9, 3.75, 5.6]):
        if pos < 18 and j % 2: continue
        m = ch[(j * 2 + 1) % 4] + 24
        st = int((pos + off) * SR); v = pluck(hz(m)) * 0.05
        n = min(len(v), N - st); pan = 0.2 + 0.6 * ((j + k) % 3) / 2
        music[st:st + n, 0] += v[:n] * (1 - pan); music[st:st + n, 1] += v[:n] * pan
    pos += CH; k += 1
# pulse (soft kick) + ticks: energy for the growth story (Alameda -> success)
def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 42 + 60 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
def tick():
    n = int(0.05 * SR); v = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 90)
    return sosfilt(butter(2, 6000, "hp", fs=SR, output="sos"), v)
bpm = 92; beat = 60 / bpm
p0, p1 = S(3) - 0.2, end_main - 0.3
bt = p0; i = 0
while bt < p1:
    st = int(bt * SR); kv = kick() * 0.22 * min(1, (bt - p0) / 6 + 0.35)
    n = min(len(kv), N - st); music[st:st + n] += kv[:n, None]
    if bt > S(6):
        for half in (0.5,):
            st2 = int((bt + beat * half) * SR); tv = tick() * 0.05
            music[st2:st2 + len(tv), 0] += tv * 0.7; music[st2:st2 + len(tv), 1] += tv
    bt += beat; i += 1
# finale: dark cluster swell, then low sustain under the title card
fs, fe = end_main, DUR
n = int((fe - fs) * SR); st = int(fs * SR); tt = np.arange(n) / SR
cl = sum(pad_note(hz(m), n, 4) for m in (38, 50, 51, 57)) * 0.04
cl *= np.clip(tt / 2.5, 0, 1) * np.clip((fe - fs - tt) / 2.5, 0, 1)
music[st:st + n] += cl[:, None]

# reverb (exponential-noise IR)
ir_n = int(2.8 * SR); ir = rng.normal(0, 1, (ir_n, 2)) * np.exp(-np.arange(ir_n) / SR * 2.4)[:, None]
ir = np.stack([sosfilt(butter(2, 5000, "lp", fs=SR, output="sos"), ir[:, c]) for c in range(2)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(music[:, c], ir[:, c])[:N] for c in range(2)], 1)
music = music * 0.65 + wet * 0.9

# ------------------------------------------------ 3. SFX
sfx = np.zeros((N, 2))
def add(v, at, pan=0.5, gain=1.0):
    st = int(at * SR)
    if st >= N: return
    n = min(len(v), N - st)
    if v.ndim == 1:
        sfx[st:st + n, 0] += v[:n] * gain * (1 - pan) * 2 ** 0.5 * 0.7
        sfx[st:st + n, 1] += v[:n] * gain * pan * 2 ** 0.5 * 0.7
    else:
        sfx[st:st + n] += v[:n] * gain
def whoosh(dur=1.1):
    n = int(dur * SR); tt = np.arange(n) / SR
    noise = rng.normal(0, 1, n); out = np.zeros(n)
    bands = [(200, 800), (500, 2000), (1200, 4500), (2500, 8000)]
    shape = np.sin(np.pi * tt / dur) ** 2
    for i, (lo, hi) in enumerate(bands):
        b = sosfilt(butter(2, [lo, hi], "bp", fs=SR, output="sos"), noise)
        w = np.exp(-((tt / dur - (0.3 + 0.15 * i)) / 0.22) ** 2)
        out += b * w
    out *= shape; out /= np.abs(out).max() + 1e-9
    L = out * np.linspace(1.0, 0.3, n); R = out * np.linspace(0.3, 1.0, n)
    return np.stack([L, R], 1)
def boom(dur=3.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 30 + 45 * np.exp(-tt * 6)
    v = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.6)
    nz = sosfilt(butter(2, 400, "lp", fs=SR, output="sos"), rng.normal(0, 1, n)) * np.exp(-tt * 9) * 0.6
    return (v + nz) / 1.3
def click(f0=2400):
    n = int(0.03 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f0 * tt) * np.exp(-tt * 260) + rng.normal(0, 0.3, n) * np.exp(-tt * 400)
def riser(dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    nz = sosfilt(butter(2, [800, 6000], "bp", fs=SR, output="sos"), rng.normal(0, 1, n))
    tone = np.sin(2 * np.pi * np.cumsum(110 + 330 * (tt / dur) ** 2) / SR) * 0.4
    return (nz * 0.6 + tone) * (tt / dur) ** 2.5

for st, fn, tr in EDL[1:]:
    if tr in ("x", "black"): add(whoosh(1.1), st - 0.25, gain=0.16)
add(boom(), 0.3, gain=0.45)
for i in range(13):                     # date typing "2 НОЯБРЯ 2022"
    add(click(1800), 0.2 + i * (0.9 / 13), pan=0.45, gain=0.10)
add(boom(2.5), S(2) + 0.6, gain=0.35)     # cracks
for i in range(8):                      # "6 НОЯБРЯ"
    add(click(1800), S(3) + 0.2 + i * (0.9 / 8), pan=0.45, gain=0.10)
add(boom(), S(3) + 0.1, gain=0.4)
for i in range(30):                     # withdrawals ticking
    add(click(2600 + (i % 4) * 250), S(4) + 0.3 + i * 0.07, pan=0.3 + 0.4 * (i % 2), gain=0.07)
add(boom(), S(6) + 0.2, gain=0.5)         # withdrawals halted
add(boom(3.0), S(8) + 0.4, gain=0.55)     # deal cancelled stamp
add(boom(), S(10) + 1.0, gain=0.35)       # $1bn vanished
add(riser(3.0), S(12) - 3.0, gain=0.15)
add(boom(4.0), S(12) + 0.3, gain=0.6)     # Chapter 11
add(boom(), S(16) + 0.2, gain=0.4)
add(riser(4.0), S(18) - 0.2 - 4.0, gain=0.18)
add(boom(4.0), S(18) + 0.1, gain=0.6)

# ------------------------------------------------ 4. write stems + mix
def wr(x, name):
    x = x / (np.abs(x).max() + 1e-9) * 0.9
    AudioSegment((x * 32767).astype(np.int16).tobytes(), frame_rate=SR, sample_width=2, channels=x.shape[1] if x.ndim > 1 else 1).export(f"{OUT}/{name}", format="wav")
wr(music, "music.wav"); wr(sfx, "sfx.wav")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{OUT}/vo.wav", "-i", f"{OUT}/music.wav", "-i", f"{OUT}/sfx.wav", "-filter_complex",
    "[0:a]aformat=channel_layouts=stereo,asplit=2[v][key];"
    "[1:a]volume=-14dB[m];[m][key]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=600:makeup=1[md];"
    "[2:a]volume=-11dB[s];"
    "[v][md][s]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11[out]",
    "-map", "[out]", "-ar", str(SR), f"{OUT}/mix.wav"], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{OUT}/vo.wav", "-c:a", "libmp3lame", "-b:a", "192k", f"{OUT}/narration.mp3"], check=True)
print("audio done")
