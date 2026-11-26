"""Prepare ElevenLabs clips: trim silence, speed up slightly, find chunk boundaries at real pauses,
and write vo/index.json in the format timeline.py expects."""
import subprocess, json, wave, numpy as np, os
from narration import SCENES

EL = "/tmp/claude-0/el2"; VO = "/tmp/claude-0/ftx2/vo_el"; os.makedirs(VO, exist_ok=True)
TEMPO = 1.0; SR = 48000

def load(fn):
    w = wave.open(fn); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x

out = []; k = 0
for si, (_, _, sents) in enumerate(SCENES):
    for ji, (disp, spk) in enumerate(sents):
        src = f"{EL}/s{k:02d}.mp3"; dst = f"{VO}/s{si}_{ji}.wav"
        if not os.path.exists(src):  # placeholder slot, filled later with the real clip stretched to fit
            PH = round(len(spk.replace("|", " ")) * 0.066 / TEMPO, 2)
            chunks = [c.strip() for c in spk.split("|")]; lens = np.array([len(c) for c in chunks], float)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", str(PH), dst], check=True)
            out.append(dict(scene=si, idx=ji, file=dst, dur=PH, chunks=list(lens / lens.sum() * PH), disp=disp, spk=spk, placeholder=k))
            k += 1; continue
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af",
            f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={TEMPO}",
            "-ar", str(SR), "-ac", "1", dst], check=True)
        x = load(dst); dur = len(x) / SR
        # energy envelope (10 ms) to locate pauses
        hop = SR // 100; e = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)])
        db = 20 * np.log10(e + 1e-6); quiet = db < (db.max() - 32)
        pauses = []; i = 0
        while i < len(quiet):
            if quiet[i]:
                j = i
                while j < len(quiet) and quiet[j]: j += 1
                if j - i >= 8 and i > 5 and j < len(quiet) - 5: pauses.append((i + j) / 2 / 100)
                i = j
            else: i += 1
        chunks = [c.strip() for c in spk.split("|")]
        n = len(chunks); lens = np.array([len(c) for c in chunks], float)
        est = np.cumsum(lens)[:-1] / lens.sum() * dur
        bounds = []
        for b in est:  # snap each boundary to nearest real pause within 1.2 s
            cand = [p for p in pauses if abs(p - b) < 1.2 and (not bounds or p > bounds[-1] + 0.3)]
            bounds.append(min(cand, key=lambda p: abs(p - b)) if cand else b)
        edges = [0.0] + bounds + [dur]
        out.append(dict(scene=si, idx=ji, file=dst, dur=dur, chunks=[edges[c + 1] - edges[c] for c in range(n)],
                        disp=disp, spk=spk, snapped=[bool(b in pauses) for b in bounds]))
        k += 1
json.dump(out, open(f"{VO}/index.json", "w"), ensure_ascii=False, indent=1)
print("speech total", round(sum(o["dur"] for o in out), 1))
for o in out:
    if len(o["chunks"]) > 1: print(o["scene"], o["idx"], [round(c, 2) for c in o["chunks"]], o.get("snapped", "PLACEHOLDER"))
