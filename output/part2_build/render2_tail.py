# ---------------------------------------------------------------- subtitles
def wrap_words(tokens, f, maxw):
    lines, cur, w = [], [], 0
    space = f.getlength(" ")
    for tok in tokens:
        tw = f.getlength(tok[0])
        if cur and w + space + tw > maxw:
            lines.append(cur); cur, w = [], 0
        cur.append(tok); w += (space if len(cur) > 1 else 0) + tw
    if cur: lines.append(cur)
    return lines

@functools.lru_cache(maxsize=128)
def sub_layer(text):
    f = font("Inter-SemiBold", 50)
    toks = []; gold = False
    for raw in text.split(" "):
        if not raw: continue
        g0 = gold
        if raw.startswith("*"): g0 = True; raw = raw[1:]; gold = True
        end_gold = False
        if raw.endswith("*") or raw.endswith("*,") or raw.endswith("*.") or "*" in raw:
            end_gold = True
        word = raw.replace("*", "")
        toks.append((word, g0 or gold))
        if end_gold: gold = False
    lines = wrap_words(toks, f, 1500)
    assert len(lines) <= 2, text
    lh = 64; Wd = 1700; Ht = lh * len(lines) + 30
    im = Image.new("RGBA", (Wd, Ht), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        lw = sum(f.getlength(t[0]) for t in ln) + f.getlength(" ") * (len(ln) - 1)
        x = (Wd - lw) / 2; y = 8 + i * lh
        for word, g in ln:
            d.text((x, y), word, font=f, fill=(232, 178, 76, 255) if g else (247, 247, 245, 255))
            x += f.getlength(word + " ")
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sh.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(5)).point(lambda v: min(255, int(v * 1.2))))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.alpha_composite(sh, (2, 3)); out.alpha_composite(im)
    return to_layer(out)

SUBS = []
for si, s in enumerate(SENTS):
    ch = s["chunks"]
    for ci, (a, b, txt) in enumerate(ch):
        nxt = ch[ci + 1][0] if ci + 1 < len(ch) else (SENTS[si + 1]["start"] if si + 1 < len(SENTS) else DUR)
        end = min(b + 0.25, nxt - 0.02) if ci + 1 == len(ch) else nxt - 0.02
        SUBS.append((a - 0.05, end, txt))

def draw_subs(f, t):
    for a, b, txt in SUBS:
        if a <= t < b:
            al = ease(ramp(t, a, a + 0.12)) * (1 - ease(ramp(t, b - 0.1, b)))
            L = sub_layer(txt)
            comp(f, L, (W - L.shape[1]) / 2, 1032 - L.shape[0], al)

# ---------------------------------------------------------------- finishing
_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGNETTE = (1 - 0.42 * np.clip((((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2) / 2, 0, 1) ** 1.1)[..., None].astype(np.float32)
BOTTOM = (1 - 0.45 * np.clip((_yy - 800) / 280, 0, 1) ** 1.5)[..., None].astype(np.float32)
_rng = np.random.default_rng(1)
GRAIN = [cv2.resize(_rng.normal(0, 0.022, (H // 2, W // 2)).astype(np.float32), (W, H))[..., None] for _ in range(8)]

def render(t):
    act = [s for s in SHOTS if s[0] <= t < s[1]]
    if not act: return np.zeros((H, W, 3), np.float32)
    if len(act) == 1:
        st, en, fn, tr = act[0]; f = fn(t - st, en - st)
        if tr in ("black",) and t - st < XF and st > 0: f = f * ease((t - st) / XF)
    else:
        (s0, e0, f0, _), (s1, e1, f1, tr) = act[-2], act[-1]
        a = ramp(t, s1, s1 + XF)
        if tr == "black":
            f = f0(t - s0, e0 - s0) * (1 - ease(a * 2)) if a < 0.5 else f1(t - s1, e1 - s1) * ease(a * 2 - 1)
        elif tr == "cut":
            f = f1(t - s1, e1 - s1)
        else:
            f = f0(t - s0, e0 - s0) * (1 - ease(a)) + f1(t - s1, e1 - s1) * ease(a)
    f = f * VIGNETTE
    has = any(a <= t < b for a, b, _ in SUBS)
    if has: f = f * BOTTOM
    draw_subs(f, t)
    f = f + GRAIN[int(t * FPS) % 8] * (0.6 + 0.4 * f.mean())
    return np.clip(f, 0, 1)

def encode(start_frame, end_frame, out):
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS), out], stdin=subprocess.PIPE)
    for i in range(start_frame, end_frame):
        fr = render(i / FPS)
        p.stdin.write((fr * 255 + 0.5).astype(np.uint8).tobytes())
        if (i - start_frame) % 150 == 0: print(out, i, flush=True)
    p.stdin.close(); p.wait()

if __name__ == "__main__":
    if sys.argv[1] == "still":
        for tt in sys.argv[3:]:
            t = float(tt)
            Image.fromarray((render(t) * 255).astype(np.uint8)).save(f"{sys.argv[2]}/f_{t:06.2f}.jpg", quality=88)
    else:
        a, b, out = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        encode(a, b, out)
