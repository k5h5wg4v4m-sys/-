"""FTX Part 1 — frame renderer. Renders 1920x1080@30 frames with numpy/OpenCV/Pillow and pipes them to FFmpeg."""
import sys, os, math, random, functools, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from timeline import SENTS, FPS, DUR

W, H = 1920, 1080
IMG = "/tmp/claude-0/img/"
GOLD = (0.89, 0.69, 0.30)
TEAL = (0.37, 0.79, 0.87)
WHITE = (0.96, 0.96, 0.95)
XF = 0.6

def font(name, size):
    p = f"/usr/share/fonts/opentype/inter/{name}.otf"
    if not os.path.exists(p): p = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, size)

MATHF = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s)

def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def eout(x): x = min(max(x, 0.0), 1.0); return 1 - (1 - x) ** 3
def ramp(t, a, b): return min(max((t - a) / (b - a), 0.0), 1.0) if b > a else float(t >= a)
def fadeio(t, d, fi=0.5, fo=0.5): return ease(ramp(t, 0, fi)) * (1 - ease(ramp(t, d - fo, d)))

# ---------------------------------------------------------------- layers
def to_layer(pil_rgba):
    a = np.asarray(pil_rgba, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a

def comp(dst, L, x, y, alpha=1.0):
    if alpha <= 0.002: return
    h, w = L.shape[:2]; x, y = int(round(x)), int(round(y))
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0: return
    s = L[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    d *= (1 - s[..., 3:4] * alpha); d += s[..., :3] * alpha

def add_glow(dst, L, x, y, color, radius=25, strength=0.8):
    pad = int(radius * 3)
    a = np.pad(L[..., 3], pad)
    a = cv2.GaussianBlur(a, (0, 0), radius)
    G = a[..., None] * np.array(color, np.float32)
    h, w = a.shape; x, y = int(x) - pad, int(y) - pad
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0: return
    dst[y0:y1, x0:x1] += G[y0 - y:y1 - y, x0 - x:x1 - x] * strength

@functools.lru_cache(maxsize=512)
def text_layer(text, fname, size, color=(1, 1, 1), spacing=0, shadow=True, align="left"):
    f = font(fname, size) if fname != "MATH" else MATHF(size)
    lines = text.split("\n")
    widths = []
    for ln in lines:
        if spacing:
            widths.append(sum(f.getlength(c) + spacing for c in ln) - spacing)
        else:
            widths.append(f.getlength(ln))
    lh = int(size * 1.22)
    w = int(max(widths)) + 40; h = lh * len(lines) + 30
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    col = tuple(int(c * 255) for c in color) + (255,)
    for i, ln in enumerate(lines):
        x = 20 + (0 if align == "left" else (max(widths) - widths[i]) / (2 if align == "center" else 1))
        y = 10 + i * lh
        if spacing:
            for c in ln:
                d.text((x, y), c, font=f, fill=col); x += f.getlength(c) + spacing
        else:
            d.text((x, y), ln, font=f, fill=col)
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh.putalpha(im.getchannel("A").filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * 0.75)))
        sh2 = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh2.alpha_composite(sh, (3, 4)); sh2.alpha_composite(im); im = sh2
    return to_layer(im)

def put_text(dst, text, x, y, fname="Inter-SemiBold", size=40, color=WHITE, alpha=1.0, spacing=0, anchor="lt", glow=None, align="left"):
    L = text_layer(text, fname, size, color, spacing, True, align)
    h, w = L.shape[:2]
    if anchor[0] == "m": x -= w / 2
    elif anchor[0] == "r": x -= w
    if anchor[1] == "m": y -= h / 2
    elif anchor[1] == "b": y -= h
    if glow: add_glow(dst, L, x, y, glow, 18, 0.6 * alpha)
    comp(dst, L, x - 20, y - 10, alpha)
    return w - 40, h

def tag(dst, text, alpha=1.0, x=60, y=50):
    """Small top-left label like РЕКОНСТРУКЦИЯ / ИЛЛЮСТРАЦИЯ."""
    if alpha <= 0: return
    L = text_layer(text, "Inter-SemiBold", 22, (0.85, 0.85, 0.85), 3, False)
    h, w = L.shape[:2]
    box = dst[y - 2:y + 36, x - 6:x + w - 20]
    box *= (1 - 0.55 * alpha)
    cv2.rectangle(dst, (x - 6, y - 2), (x + w - 20, y + 36), tuple(c * 0.6 * alpha for c in GOLD), 1, cv2.LINE_AA)
    comp(dst, L, x - 10, y - 4, alpha)

def credit(dst, text, alpha=1.0):
    L = text_layer(text, "Inter-Regular", 19, (0.8, 0.8, 0.8), 0, True)
    comp(dst, L, W - L.shape[1] - 30, 40, alpha * 0.85)

def lower_third(dst, title, sub, lt, x=110, y=640, color=GOLD):
    a = ease(ramp(lt, 0.2, 0.9))
    ln = int(380 * eout(ramp(lt, 0.1, 0.9)))
    if ln > 2: cv2.line(dst, (x, y), (x + ln, y), color, 3, cv2.LINE_AA)
    put_text(dst, title, x - 2 - 30 * (1 - a), y + 18, "InterDisplay-Bold", 64, WHITE, a)
    if sub: put_text(dst, sub, x, y + 105, "Inter-Medium", 34, (0.85, 0.85, 0.85), ease(ramp(lt, 0.6, 1.3)))

# ---------------------------------------------------------------- images
def grade(img, sat=0.78, contrast=1.08, warm=0.03):
    g = img.mean(axis=2, keepdims=True)
    img = g + (img - g) * sat
    img = np.clip((img - 0.5) * contrast + 0.5, 0, 1)
    lum = img.mean(axis=2, keepdims=True)
    img = img + np.concatenate([warm * lum, 0.0 * lum, -warm * lum + 0.02 * (1 - lum)], axis=2) * 1.0
    img[..., 1:] += 0.012 * (1 - lum)  # teal shadows
    return np.clip(img, 0, 1).astype(np.float32)

@functools.lru_cache(maxsize=32)
def load(name, g=True):
    im = Image.open(IMG + name).convert("RGB")
    a = np.asarray(im, dtype=np.float32) / 255.0
    return grade(a) if g else a

@functools.lru_cache(maxsize=32)
def load_logo(name, mode="white", width=900):
    im = Image.open(IMG + name).convert("RGBA")
    r = width / im.width; im = im.resize((width, int(im.height * r)), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    if mode == "white":
        lum = a[..., :3].mean(axis=2)
        dark = lum < 0.45
        a[dark, :3] = 0.97
    elif mode == "invertgray":
        a[..., :3] = 1 - a[..., :3] * 0.7
    a[..., :3] *= a[..., 3:4]
    return a

def kenburns(img, lt, dur, z0=1.0, z1=1.12, c0=(0.5, 0.5), c1=(0.5, 0.5)):
    h, w = img.shape[:2]
    base = max(W / w, H / h)
    k = ease(lt / dur) * 0.85 + (lt / dur) * 0.15
    z = z0 + (z1 - z0) * k
    s = base * z
    cx = (c0[0] + (c1[0] - c0[0]) * k) * w; cy = (c0[1] + (c1[1] - c0[1]) * k) * h
    hw, hh = W / 2 / s, H / 2 / s
    cx = min(max(cx, hw), w - hw); cy = min(max(cy, hh), h - hh)
    M = np.float32([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

@functools.lru_cache(maxsize=16)
def blurred_bg(name):
    img = load(name)
    h, w = img.shape[:2]; s = max(W / w, H / h) * 1.15
    im = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    y0 = (im.shape[0] - H) // 2; x0 = (im.shape[1] - W) // 2
    im = im[y0:y0 + H, x0:x0 + W]
    im = cv2.GaussianBlur(im, (0, 0), 40) * 0.30
    return im.astype(np.float32)

def portrait(name, lt, dur, fx=1180, fh=780, z0=1.0, z1=1.07):
    bg = blurred_bg(name).copy()
    img = load(name)
    h, w = img.shape[:2]
    z = z0 + (z1 - z0) * (lt / dur)
    th = int(fh * z); tw = int(w * th / h)
    fg = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
    # crop to frame box fh tall
    box_h, box_w = fh, int(w * fh / h)
    y0 = (th - box_h) // 2; x0 = (tw - box_w) // 2
    fg = fg[y0:y0 + box_h, x0:x0 + box_w]
    bx = int(fx - box_w / 2 + 20 * (lt / dur)); by = (H - box_h) // 2 - 70
    # shadow
    sh = np.zeros((H, W), np.float32); sh[by + 20:by + box_h + 20, bx + 10:bx + box_w + 10] = 1
    sh = cv2.GaussianBlur(sh, (0, 0), 30)
    bg *= (1 - 0.7 * sh[..., None])
    x0c, x1c = max(bx, 0), min(bx + box_w, W)
    bg[by:by + box_h, x0c:x1c] = fg[:, x0c - bx:x1c - bx]
    cv2.rectangle(bg, (bx, by), (bx + box_w, by + box_h), (0.25, 0.25, 0.25), 1, cv2.LINE_AA)
    return bg

# ---------------------------------------------------------------- generic backgrounds
@functools.lru_cache(maxsize=4)
def dark_bg(tint=(0.02, 0.03, 0.045)):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    base = np.clip(1.0 - r * 1.3, 0, 1)[..., None]
    return (np.array(tint, np.float32) + base * np.array([0.035, 0.05, 0.065], np.float32)).astype(np.float32)

def grid(dst, alpha=0.08, step=80, off=0.0):
    c = (alpha, alpha * 1.1, alpha * 1.25)
    o = int(off) % step
    for x in range(-o, W, step): cv2.line(dst, (x, 0), (x, H), c, 1)
    for y in range(0, H, step): cv2.line(dst, (0, y), (W, y), c, 1)

def walk(n, seed, trend=1.0, vol=1.0):
    rng = np.random.default_rng(seed)
    v = np.cumsum(rng.normal(0.0, 1.0, n) * vol) + np.linspace(0, trend * n * 0.25, n)
    v = np.convolve(v, np.ones(5) / 5, mode="same")
    v[:3] = v[3]; v[-3:] = v[-4]
    return (v - v.min()) / (v.max() - v.min() + 1e-6)

def line_chart(dst, vals, prog, x0, y0, x1, y1, color=GOLD, fill=True, thick=4, glow=True):
    n = len(vals); k = max(2, int(n * prog))
    xs = np.linspace(x0, x1, n)[:k]; ys = (y1 - vals[:k] * (y1 - y0))
    pts = np.stack([xs, ys], 1).astype(np.int32)
    if fill:
        poly = np.vstack([pts, [[pts[-1][0], y1], [pts[0][0], y1]]]).astype(np.int32)
        m = np.zeros((H, W), np.float32); cv2.fillPoly(m, [poly], 1.0)
        grad = np.linspace(0, 1, H, dtype=np.float32)[:, None]
        gm = m * np.clip((grad * H - y0) / (y1 - y0), 0, 1)
        gm = m * (1 - np.clip((np.arange(H)[:, None] - y0) / (y1 - y0 + 1), 0, 1)) * 0.22
        dst += gm[..., None] * np.array(color, np.float32)
    if glow:
        g = np.zeros((H, W), np.float32); cv2.polylines(g, [pts], False, 1.0, thick * 3, cv2.LINE_AA)
        g = cv2.GaussianBlur(g, (0, 0), 14)
        dst += g[..., None] * np.array(color, np.float32) * 0.7
    cv2.polylines(dst, [pts], False, color, thick, cv2.LINE_AA)
    cv2.circle(dst, tuple(pts[-1]), thick + 5, tuple(min(1, c * 1.3) for c in color), -1, cv2.LINE_AA)
    return pts[-1]

# ---------------------------------------------------------------- shots
def shot_counter(lt, d):
    f = dark_bg().copy() * 0.55
    grid(f, 0.035, 96, lt * 12)
    vals = walk(160, 7, 1.4)
    line_chart(f, vals, ease(ramp(lt, 0.2, d)), 0, 620, W, 1000, (0.35, 0.30, 0.18), fill=False, thick=2, glow=False)
    k = eout(ramp(lt, 0.5, 2.0))
    a = ease(ramp(lt, 0.35, 0.8))
    num = f"${int(round(32 * k))}"
    w, h = put_text(f, num, W / 2 - 40, H / 2 - 40, "InterDisplay-Black", 230, GOLD, a, anchor="rm", glow=GOLD)
    put_text(f, "BILLION", W / 2 - 10, H / 2 - 38, "InterDisplay-Bold", 150, WHITE, ease(ramp(lt, 1.6, 2.3)), spacing=10, anchor="lm")
    put_text(f, "ДОКУМЕНТАЛЬНЫЙ ЦИКЛ  ·  ЧАСТЬ 1", W / 2, H / 2 + 130, "Inter-Medium", 30, (0.7, 0.7, 0.7), ease(ramp(lt, 2.0, 2.8)), spacing=6, anchor="mm")
    # light streak
    sx = -400 + 2600 * ramp(lt, 1.5, 2.6)
    yy = np.arange(H, dtype=np.float32)[:, None]; xx = np.arange(W, dtype=np.float32)[None, :]
    if 0 < ramp(lt, 1.5, 2.6) < 1:
        band = np.exp(-((xx - sx) / 220) ** 2) * np.exp(-((yy - H / 2 + 40) / 120) ** 2) * 0.25
        f += band[..., None] * np.array([1.0, 0.85, 0.6], np.float32)
    return f

def shot_chart(lt, d):
    f = dark_bg().copy()
    grid(f, 0.05, 90, lt * 20)
    vals = walk(220, 21, 2.2, 1.1)
    end = line_chart(f, vals, eout(ramp(lt, 0.2, d * 0.8)), 140, 230, 1600, 900, GOLD, thick=5)
    for i, y in enumerate(range(230, 901, 134)):
        cv2.line(f, (140, y), (1600, y), (0.12, 0.12, 0.13), 1, cv2.LINE_AA)
    a = ease(ramp(lt, d * 0.55, d * 0.75))
    put_text(f, "$32 МЛРД", 1640, 250, "InterDisplay-Black", 92, GOLD, a, anchor="rm", glow=GOLD)
    put_text(f, "ОЦЕНКА FTX · ЯНВАРЬ 2022", 1640, 330, "Inter-SemiBold", 30, WHITE, a, spacing=3, anchor="rm")
    tag(f, "ИЛЛЮСТРАЦИЯ · ГРАФИК УСЛОВНЫЙ", fadeio(lt, d, 0.6, 0.4))
    z = 1.0 + 0.05 * lt / d
    M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z)
    return cv2.warpAffine(f, M, (W, H), borderMode=cv2.BORDER_REFLECT)

def make_portrait_shot(name, title, sub, cred, fx=1250, text_y=430):
    def s(lt, d):
        f = portrait(name, lt, d, fx=fx)
        lower_third(f, title, sub, lt - 0.3, x=110, y=text_y)
        credit(f, cred, ease(ramp(lt, 0.3, 1.0)))
        return f
    return s

def make_logo_shot(name, sub, mode="white", width=1000, y=H / 2 - 60, color=TEAL, glitch=False, extra=None):
    def s(lt, d):
        f = dark_bg().copy() * (0.7 if not glitch else 0.45)
        L = load_logo(name, mode, width)
        sc = 1.0 + 0.06 * (1 - eout(ramp(lt, 0, 2.0))) + 0.025 * lt / d
        Ls = cv2.resize(L, (int(L.shape[1] * sc), int(L.shape[0] * sc)), interpolation=cv2.INTER_AREA)
        a = ease(ramp(lt, 0.15, 1.0))
        if glitch:
            a *= 0.75 + 0.25 * (0.5 + 0.5 * math.sin(lt * 23)) * (random.Random(int(lt * 15)).random() > 0.25)
            g = Ls.mean(axis=2, keepdims=True); Ls = Ls.copy(); Ls[..., :3] = Ls[..., :3] * 0.35 + g[..., :1] * 0.65 * Ls[..., 3:4] / np.maximum(Ls[..., 3:4], 1e-3) * Ls[..., 3:4]
        x = W / 2 - Ls.shape[1] / 2; yy = y - Ls.shape[0] / 2
        add_glow(f, Ls, x, yy, color, 40, 0.5 * a)
        comp(f, Ls, x, yy, a)
        # light sweep across logo
        p = ramp(lt, 0.6, 1.8)
        if 0 < p < 1:
            sx = x + (Ls.shape[1] + 600) * p - 300
            xx = np.arange(Ls.shape[1], dtype=np.float32)[None, :] + x
            yy2 = np.arange(Ls.shape[0], dtype=np.float32)[:, None]
            band = np.exp(-((xx - sx + (yy2 - Ls.shape[0] / 2) * 0.5) / 60) ** 2)
            hl = Ls[..., 3] * band * 0.9
            ix, iy = int(x), int(yy)
            f[iy:iy + Ls.shape[0], ix:ix + Ls.shape[1]] += hl[..., None]
        if sub: put_text(f, sub, W / 2, y + Ls.shape[0] / 2 + 70, "Inter-Medium", 34, (0.8, 0.8, 0.8), ease(ramp(lt, 1.0, 1.8)) * (0.6 if glitch else 1), spacing=8, anchor="mm")
        if extra: extra(f, lt, d)
        return f
    return s

def shot_stanford(lt, d):
    img = load("Stanford_Oval_May_2011_panorama.jpg")
    f = kenburns(img, lt, d, 1.05, 1.1, (0.25, 0.55), (0.75, 0.5))
    f *= 0.82
    # gradient on left for text
    gx = np.clip(1 - np.arange(W, dtype=np.float32) / 1100, 0, 1)[None, :, None]
    f *= (1 - 0.55 * gx)
    s5 = SENTS[5]["start"] - SENTS[4]["start"] + 0.35
    a1 = ease(ramp(lt, 0.4, 1.0)) * (1 - ease(ramp(lt, s5 - 0.4, s5)))
    txt = "6 МАРТА 1992"
    n = int(len(txt) * ramp(lt, 0.5, 1.6))
    put_text(f, txt[:n] + ("▌" if (lt * 2) % 1 < 0.5 and n < len(txt) else ""), 110, 330, "InterDisplay-Black", 110, GOLD, a1, glow=GOLD)
    put_text(f, "СТЭНФОРД, КАЛИФОРНИЯ, США", 114, 480, "Inter-SemiBold", 38, WHITE, a1 * ease(ramp(lt, 1.4, 2.0)), spacing=4)
    a2 = ease(ramp(lt, s5, s5 + 0.7))
    lower_third(f, "СТЭНФОРД", "Родители — профессора\nСтэнфордской школы права", lt - s5, 110, 330)  if a2 > 0 else None
    credit(f, "Фото: King of Hearts · CC BY-SA 3.0 · Wikimedia Commons (2011)", 1)
    return f

FORMULAS = ["E[X] = Σ pᵢ·xᵢ", "∇·E = ρ/ε₀", "∫ e^(−x²) dx = √π", "P(A|B) = P(B|A)·P(A) / P(B)", "F = m·a", "Σ 1/n² = π²/6", "iħ ∂ψ/∂t = Ĥψ", "eⁱᵖ + 1 = 0"]
FORMULAS[-1] = "e^(iπ) + 1 = 0"
def shot_mit(lt, d):
    img = load("MIT_Dome_night1_Edit.jpg")
    f = kenburns(img, lt, d, 1.0, 1.14, (0.5, 0.45), (0.5, 0.4)) * 0.85
    gx = np.clip(1 - np.arange(W, dtype=np.float32) / 1150, 0, 1)[None, :, None] ** 0.8
    f *= (1 - 0.7 * gx)
    rng = random.Random(5)
    for i, fm in enumerate(FORMULAS):
        x = rng.uniform(80, 1500); y = rng.uniform(80, 760)
        a = 0.33 * fadeio(lt - i * 0.35, d - i * 0.35 + 0.3, 0.9, 0.6)
        put_text(f, fm, x + lt * rng.uniform(-14, 14), y - lt * rng.uniform(4, 12), "MATH", rng.choice([34, 40, 48]), (0.92, 0.92, 1.0), a)
    lower_third(f, "MIT", "Массачусетский технологический институт\nфизика · выпуск 2014", lt - 0.2, 110, 520)
    credit(f, "Фото: Fcb981 / Thermos · CC BY-SA 3.0 · Wikimedia Commons", 1)
    return f

def ticker(dst, y, lt, speed=120, seed=1, alpha=1.0):
    rng = random.Random(seed)
    items = []
    for i in range(24):
        sym = "".join(rng.choice("ABCDEFGHKLMNPRSTVXZ") for _ in range(rng.choice([3, 4])))
        ch = rng.uniform(-3, 3)
        items.append((sym, f"{rng.uniform(10, 400):.2f}", ch))
    x = W - (lt * speed) % 3000 - 200
    cv2.rectangle(dst, (0, y - 30), (W, y + 30), (0.03, 0.035, 0.04), -1)
    for sym, px, ch in items * 2:
        col = (0.35, 0.85, 0.5) if ch >= 0 else (0.95, 0.35, 0.35)
        w1, _ = put_text(dst, sym, x, y, "Inter-Bold", 26, WHITE, alpha, anchor="lm")
        w2, _ = put_text(dst, f"{px}  {'▲' if ch>=0 else '▼'}{abs(ch):.2f}%", x + w1 + 14, y, "Inter-Medium", 26, col, alpha, anchor="lm")
        x += w1 + w2 + 70
        if x > W + 100: break

def order_book(dst, x, y, lt, rows=12, seed=3, mid=100.0, scale=1.0):
    rng = random.Random(seed + int(lt * 6))
    cv2.rectangle(dst, (x, y), (x + 420, y + rows * 2 * 34 + 70), (0.035, 0.04, 0.05), -1)
    cv2.rectangle(dst, (x, y), (x + 420, y + rows * 2 * 34 + 70), (0.12, 0.13, 0.15), 1, cv2.LINE_AA)
    put_text(dst, "ЦЕНА        ОБЪЁМ", x + 20, y + 14, "Inter-SemiBold", 22, (0.6, 0.6, 0.6), 1)
    for i in range(rows * 2):
        ask = i < rows
        px = mid + (rows - i) * 0.5 * scale if ask else mid - (i - rows + 1) * 0.5 * scale
        vol = rng.uniform(0.1, 9.9)
        yy = y + 60 + i * 34
        col = (0.95, 0.38, 0.38) if ask else (0.35, 0.85, 0.5)
        bw = int(vol / 10 * 200)
        cv2.rectangle(dst, (x + 420 - bw, yy), (x + 418, yy + 30), tuple(c * 0.22 for c in col), -1)
        put_text(dst, f"{px:,.2f}".replace(",", " ") + f"     {vol:.3f}", x + 20, yy + 1, "Inter-Medium", 22, col, 1)

def candles(dst, x0, y0, x1, y1, lt, seed=9, n=46, speed=1.6, trend=0.6):
    vals = walk(n + 40, seed, trend, 1.3)
    off = lt * speed; i0 = int(off)
    cw = (x1 - x0) / n
    rng = np.random.default_rng(seed)
    noise = rng.uniform(0.01, 0.05, n + 40)
    seg = vals[i0:i0 + n + 1]
    lo, hi = seg.min() - 0.08, seg.max() + 0.08
    Y = lambda v: int(y1 - (v - lo) / (hi - lo) * (y1 - y0))
    for k in range(n):
        o, c = vals[i0 + k], vals[i0 + k + 1]
        h, l = max(o, c) + noise[i0 + k], min(o, c) - noise[i0 + k + 1]
        col = (0.35, 0.85, 0.5) if c >= o else (0.95, 0.38, 0.38)
        cx = int(x0 + (k - (off - i0)) * cw + cw / 2)
        if cx < x0: continue
        cv2.line(dst, (cx, Y(h)), (cx, Y(l)), col, 2, cv2.LINE_AA)
        cv2.rectangle(dst, (int(cx - cw * 0.32), Y(max(o, c))), (int(cx + cw * 0.32), max(Y(min(o, c)), Y(max(o, c)) + 2)), col, -1)

def shot_janestreet(lt, d):
    f = dark_bg().copy() * 0.8
    grid(f, 0.03, 60)
    ticker(f, 60, lt, 140, 11)
    candles(f, 80, 160, 1300, 640, lt, 4, 50, 2.2, 0.2)
    order_book(f, 1400, 140, lt, 11, 5, 248.0)
    # depth-of-field style blur of background terminal
    f = cv2.GaussianBlur(f, (0, 0), 2.2 + 1.2 * ease(ramp(lt, 0.5, 1.5)))
    f *= 0.6
    lower_third(f, "JANE STREET", "Нью-Йорк · трейдер · 2014–2017", lt - 0.2, 110, 680)
    tag(f, "РЕКОНСТРУКЦИЯ · ТОРГОВЫЙ ТЕРМИНАЛ", fadeio(lt, d, 0.5, 0.4), y=120)
    z = 1.04 + 0.05 * lt / d
    M = cv2.getRotationMatrix2D((W / 2, H / 2), -0.8 + 1.2 * lt / d, z)
    return cv2.warpAffine(f, M, (W, H), borderMode=cv2.BORDER_REFLECT)

def alameda_extra(f, lt, d):
    lower = "КОЛИЧЕСТВЕННАЯ ТОРГОВЛЯ КРИПТОВАЛЮТАМИ"
    put_text(f, lower, W / 2, H / 2 + 120, "Inter-SemiBold", 30, GOLD, ease(ramp(lt, 2.4, 3.2)), spacing=5, anchor="mm")

def shot_alameda(lt, d):
    if lt < 1.8:
        f = dark_bg().copy() * 0.5
        a = fadeio(lt, 1.9, 0.3, 0.45)
        sc = 1 + 0.08 * lt
        put_text(f, "2017", W / 2, H / 2 - 40, "InterDisplay-Black", int(300 * sc), GOLD, a, anchor="mm", glow=GOLD)
        return f
    s = make_logo_shot("Alameda_Research_logo.svg.png", "БЕРКЛИ, КАЛИФОРНИЯ  ·  2017", "white", 1100, H / 2 - 70, GOLD, extra=alameda_extra)
    return s(lt - 1.8, d - 1.8)

def exch_card(f, x, y, name, price, lt, hl=False, a=1.0):
    cv2.rectangle(f, (x, y), (x + 560, y + 330), (0.04, 0.05, 0.06), -1)
    cv2.rectangle(f, (x, y), (x + 560, y + 330), GOLD if hl else (0.2, 0.22, 0.25), 2, cv2.LINE_AA)
    put_text(f, name, x + 40, y + 30, "Inter-SemiBold", 34, (0.75, 0.75, 0.75), a, spacing=4)
    L = load_logo("Bitcoin.svg.png", "none", 90)
    comp(f, L, x + 40, y + 110, a)
    put_text(f, price, x + 150, y + 112, "InterDisplay-Bold", 76, WHITE, a)
    put_text(f, "BTC / USD", x + 40, y + 240, "Inter-Medium", 28, (0.6, 0.6, 0.6), a, spacing=2)

def shot_arbitrage(lt, d):
    f = dark_bg().copy()
    grid(f, 0.03, 80, lt * 8)
    k = eout(ramp(lt, 0.3, 1.5))
    pa = 10000; pb = 10000 + 300 * eout(ramp(lt, 1.0, 2.8))
    exch_card(f, int(160 - 200 * (1 - k)), 300, "БИРЖА  A", f"${pa:,.0f}".replace(",", " "), lt, False, k)
    exch_card(f, int(1200 + 200 * (1 - k)), 300, "БИРЖА  B", f"${pb:,.0f}".replace(",", " "), lt, pb > 10200, k)
    p = ease(ramp(lt, 2.2, 3.4))
    if p > 0:
        x0, x1 = 740, int(740 + (1180 - 740) * p)
        cv2.arrowedLine(f, (x0, 470), (x1, 470), GOLD, 5, cv2.LINE_AA, tipLength=0.08 if p > 0.9 else 0.001)
        put_text(f, "купить → продать", 960, 400, "Inter-SemiBold", 32, GOLD, p, anchor="mm")
        put_text(f, "РАЗНИЦА ЦЕН  +3%", 960, 560, "InterDisplay-Bold", 44, WHITE, ease(ramp(lt, 3.0, 3.8)), anchor="mm", glow=GOLD)
    tag(f, "ИЛЛЮСТРАЦИЯ · ПРИНЦИП АРБИТРАЖА · ЦИФРЫ УСЛОВНЫЕ", fadeio(lt, d, 0.4, 0.4))
    return f

def shot_bitcoin(lt, d):
    f = dark_bg().copy() * 0.9
    candles(f, 0, 250, W, 1000, lt, 13, 60, 3.0, 1.0)
    f = cv2.GaussianBlur(f, (0, 0), 3) * 0.45
    L = load_logo("Bitcoin.svg.png", "none", 460)
    ang = lt * 1.6
    sx = abs(math.cos(ang)) * 0.85 + 0.15
    Ls = cv2.resize(L, (max(4, int(L.shape[1] * sx)), L.shape[0]), interpolation=cv2.INTER_AREA)
    x = W / 2 - Ls.shape[1] / 2; y = H / 2 - Ls.shape[0] / 2 - 60
    add_glow(f, Ls, x, y, (1.0, 0.6, 0.15), 50, 0.55)
    comp(f, Ls, x, y, ease(ramp(lt, 0, 0.6)))
    put_text(f, "КРИПТОРЫНОК РАСТЁТ", W / 2, H / 2 + 240, "InterDisplay-Bold", 52, WHITE, ease(ramp(lt, 0.6, 1.3)), spacing=6, anchor="mm")
    tag(f, "ИЛЛЮСТРАЦИЯ", fadeio(lt, d, 0.4, 0.4))
    return f

def ftx_found_extra(f, lt, d):
    a = ease(ramp(lt, 1.6, 2.3))
    for i, (n, r) in enumerate([("СЭМ БЭНКМАН-ФРИД", "сооснователь, CEO"), ("ГЭРИ ВАН", "сооснователь, CTO")]):
        aa = ease(ramp(lt, 1.6 + i * 0.5, 2.3 + i * 0.5))
        x = 520 + i * 560
        cv2.line(f, (x, 760), (x + int(380 * aa), 760), GOLD, 2, cv2.LINE_AA)
        put_text(f, n, x, 780, "InterDisplay-Bold", 44, WHITE, aa)
        put_text(f, r, x, 840, "Inter-Medium", 30, (0.75, 0.75, 0.75), aa)

def shot_ftx_found(lt, d):
    if lt < 1.7:
        f = dark_bg().copy() * 0.5
        a = fadeio(lt, 1.8, 0.3, 0.45)
        put_text(f, "2019", W / 2, H / 2 - 40, "InterDisplay-Black", int(300 * (1 + 0.08 * lt)), TEAL, a, anchor="mm", glow=TEAL)
        return f
    s = make_logo_shot("FTX_logo.svg.png", "КРИПТОВАЛЮТНАЯ БИРЖА", "white", 900, H / 2 - 170, TEAL, extra=ftx_found_extra)
    return s(lt - 1.7, d - 1.7)

def platform_ui(lt):
    ui = np.zeros((H, W, 3), np.float32) + np.array([0.035, 0.04, 0.05], np.float32)
    cv2.rectangle(ui, (0, 0), (W, 70), (0.05, 0.06, 0.075), -1)
    put_text(ui, "ТОРГОВАЯ ПЛАТФОРМА", 40, 18, "Inter-Bold", 28, TEAL, 1, spacing=3)
    pairs = [("BTC/USD", "Bitcoin.svg.png"), ("ETH/USD", "Ethereum_logo_2014.svg.png"), ("BTC-PERP", "Bitcoin.svg.png"), ("ETH-PERP", "Ethereum_logo_2014.svg.png")]
    for i, (p, logo) in enumerate(pairs):
        y = 110 + i * 90
        cv2.rectangle(ui, (20, y), (330, y + 74), (0.06, 0.08, 0.1) if i == 0 else (0.045, 0.05, 0.06), -1)
        L = load_logo(logo, "none" if "Bitcoin" in logo else "invertgray", 40 if "Bitcoin" in logo else 30)
        comp(ui, L, 40, y + 37 - L.shape[0] / 2)
        put_text(ui, p, 100, y + 18, "Inter-SemiBold", 28, WHITE, 1)
    put_text(ui, "Спот · Фьючерсы · Деривативы", 30, 500, "Inter-Medium", 22, (0.55, 0.55, 0.55), 1)
    cv2.rectangle(ui, (360, 100), (1440, 900), (0.03, 0.035, 0.045), -1)
    candles(ui, 380, 140, 1420, 860, lt, 31, 42, 2.0, 0.8)
    order_book(ui, 1470, 100, lt, 11, 8, 100.0)
    return ui

def shot_platform(lt, d):
    ui = platform_ui(lt)
    # cinematic perspective tilt
    k = lt / d
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    dx = 120 + 60 * k
    dst = np.float32([[160 + dx * 0.3, 140], [W - 120, 60 + 30 * k], [W - 60, H - 40], [80 + dx * 0.2, H - 160]])
    M = cv2.getPerspectiveTransform(src, dst)
    f = dark_bg().copy() * 0.5
    warped = cv2.warpPerspective(ui, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.ones((H, W), np.float32), M, (W, H))
    f = f * (1 - mask[..., None]) + warped
    tag(f, "РЕКОНСТРУКЦИЯ ИНТЕРФЕЙСА", fadeio(lt, d, 0.4, 0.4), y=50)
    return f

def shot_globe(lt, d):
    f = dark_bg((0.01, 0.015, 0.03)).copy()
    cx, cy, R = W / 2 + 260, H / 2 + 30, 420
    rot = lt * 0.35
    g = np.zeros((H, W, 3), np.float32)
    cv2.circle(g, (int(cx), int(cy)), R, (0.05, 0.12, 0.16), -1, cv2.LINE_AA)
    def proj(lat, lon):
        x = math.cos(lat) * math.sin(lon + rot); z = math.cos(lat) * math.cos(lon + rot); y = math.sin(lat)
        return (cx + R * x, cy - R * y, z)
    for latd in range(-60, 90, 30):
        pts = [proj(math.radians(latd), math.radians(lo)) for lo in range(0, 361, 4)]
        for a, b in zip(pts, pts[1:]):
            if a[2] > 0 and b[2] > 0: cv2.line(g, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), (0.12, 0.35, 0.42), 1, cv2.LINE_AA)
    for lod in range(0, 360, 20):
        pts = [proj(math.radians(la), math.radians(lod)) for la in range(-90, 91, 4)]
        for a, b in zip(pts, pts[1:]):
            if a[2] > 0 and b[2] > 0: cv2.line(g, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), (0.12, 0.35, 0.42), 1, cv2.LINE_AA)
    rng = random.Random(4)
    nodes = [(math.radians(rng.uniform(-45, 60)), math.radians(rng.uniform(0, 360))) for _ in range(16)]
    hub = nodes[0]
    for i, n in enumerate(nodes[1:]):
        p = ease(ramp(lt, 0.3 + i * 0.22, 1.2 + i * 0.22))
        if p <= 0: continue
        steps = 30
        arc = []
        for s in range(int(steps * p) + 1):
            t = s / steps
            la = hub[0] + (n[0] - hub[0]) * t; lo = hub[1] + (n[1] - hub[1]) * t
            x, y, z = proj(la, lo); lift = 1 + 0.18 * math.sin(math.pi * t)
            arc.append((cx + (x - cx) * lift, cy + (y - cy) * lift, z))
        for a, b in zip(arc, arc[1:]):
            if a[2] > -0.1: cv2.line(g, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), TEAL, 2, cv2.LINE_AA)
    for n in nodes:
        x, y, z = proj(*n)
        if z > 0: cv2.circle(g, (int(x), int(y)), 6, GOLD, -1, cv2.LINE_AA)
    f += g + cv2.GaussianBlur(g, (0, 0), 12) * 0.8
    lower_third(f, "ЭКСПАНСИЯ", "Международные рынки\n2021 — штаб-квартира переезжает\nиз Гонконга на Багамы", lt - 0.2, 110, 300)
    tag(f, "ИНФОГРАФИКА", fadeio(lt, d, 0.4, 0.4))
    return f

INVESTORS = ["SEQUOIA CAPITAL", "SOFTBANK", "PARADIGM", "TEMASEK"]
def shot_investors(lt, d):
    f = dark_bg().copy()
    grid(f, 0.03, 90, lt * 10)
    put_text(f, "СРЕДИ ИНВЕСТОРОВ FTX", 140, 200, "Inter-SemiBold", 36, GOLD, ease(ramp(lt, 0.2, 0.8)), spacing=6)
    for i, n in enumerate(INVESTORS):
        a = ease(ramp(lt, 0.6 + i * 0.45, 1.2 + i * 0.45))
        put_text(f, n, 140 + 40 * (1 - a), 300 + i * 130, "InterDisplay-Bold", 88, WHITE, a)
    put_text(f, "раунды финансирования 2021–2022 гг.", 140, 860, "Inter-Medium", 28, (0.6, 0.6, 0.6), ease(ramp(lt, 2.0, 2.6)))
    return f

def shot_arena(lt, d):
    img = load("AAArena_Night.jpg")
    f = kenburns(img, lt, d, 1.02, 1.16, (0.45, 0.55), (0.55, 0.5)) * 0.85
    gx = np.clip(1 - np.arange(W, dtype=np.float32) / 1200, 0, 1)[None, :, None]
    gy = np.clip(1 - np.arange(H, dtype=np.float32) / 520, 0, 1)[:, None, None]
    f *= (1 - 0.55 * gx) * (1 - 0.6 * gy)
    lower_third(f, "FTX ARENA", "Арена «Майами Хит», Майами\n2021: права на название — $135 млн на 19 лет", lt - 0.2, 110, 110)
    put_text(f, "архивное фото, до переименования", 112, 340, "Inter-Regular", 24, (0.65, 0.65, 0.65), ease(ramp(lt, 1.2, 1.8)))
    credit(f, "Фото: Edgar Serrano · CC BY 3.0 · Wikimedia Commons", 1)
    return f

VAL = [("ИЮЛЬ 2021", 18), ("ОКТЯБРЬ 2021", 25), ("ЯНВАРЬ 2022", 32)]
def shot_valuation(lt, d):
    f = dark_bg().copy()
    grid(f, 0.03, 90)
    put_text(f, "ОЦЕНКА FTX", 140, 120, "Inter-SemiBold", 38, GOLD, ease(ramp(lt, 0.1, 0.6)), spacing=6)
    base = 900; maxh = 560
    for i, (lab, v) in enumerate(VAL):
        p = eout(ramp(lt, 0.4 + i * 0.7, 1.6 + i * 0.7))
        x = 420 + i * 420; h = int(maxh * v / 32 * p)
        col = GOLD if i == 2 else (0.55, 0.5, 0.4)
        if h > 0:
            cv2.rectangle(f, (x, base - h), (x + 220, base), tuple(c * 0.85 for c in col), -1)
            if i == 2:
                g = np.zeros((H, W), np.float32); cv2.rectangle(g, (x, base - h), (x + 220, base), 1.0, -1)
                f += cv2.GaussianBlur(g, (0, 0), 30)[..., None] * np.array(GOLD, np.float32) * 0.35
        put_text(f, f"${int(round(v * p))} МЛРД", x + 110, base - h - 60, "InterDisplay-Bold", 56, WHITE, ease(ramp(lt, 0.4 + i * 0.7, 0.9 + i * 0.7)), anchor="mm")
        put_text(f, lab, x + 110, base + 45, "Inter-SemiBold", 28, (0.75, 0.75, 0.75), ease(ramp(lt, 0.3 + i * 0.7, 0.8 + i * 0.7)), anchor="mm", spacing=3)
    cv2.line(f, (360, base), (1620, base), (0.4, 0.4, 0.4), 2, cv2.LINE_AA)
    put_text(f, "Источники: Reuters, CNBC (раунды B, B-1, C)", 140, 975, "Inter-Regular", 22, (0.55, 0.55, 0.55), ease(ramp(lt, 1.0, 1.6)))
    return f

def shot_dark_logo(lt, d):
    s = make_logo_shot("FTX_logo.svg.png", None, "white", 1000, H / 2 - 40, (0.3, 0.45, 0.5), glitch=True)
    f = s(lt + 2.2, d + 2.2)
    f *= (1 - 0.35 * ease(ramp(lt, 0, d)))
    return f

def shot_dissolve(lt, d):
    f = dark_bg((0.0, 0.0, 0.0)).copy() * 0.35
    s = "$32 000 000 000"
    fnt = font("InterDisplay-Bold", 150)
    total = fnt.getlength(s); x = W / 2 - total / 2
    rng = random.Random(12)
    order = list(range(len(s))); rng.shuffle(order)
    for i, ch in enumerate(s):
        k = order.index(i)
        t0 = 0.6 + k * (d - 1.2) / len(s)
        p = ease(ramp(lt, t0, t0 + 1.2))
        a = ease(ramp(lt, 0, 0.6)) * (1 - p)
        if ch != " " and a > 0.01:
            put_text(f, ch, x, H / 2 - 120 - 60 * p, "InterDisplay-Bold", 150, (0.9, 0.9, 0.9), a)
            if p > 0:
                L = text_layer(ch, "InterDisplay-Bold", 150, (0.9, 0.9, 0.9), 0, False, "left")
                bl = cv2.GaussianBlur(L, (0, 0), 6 + 20 * p)
                comp(f, bl, x - 20 + 10 * p, H / 2 - 130 - 120 * p, 0.6 * (1 - p) * ease(ramp(lt, 0, 0.6)))
        x += fnt.getlength(ch)
    return f

def shot_final(lt, d):
    f = dark_bg((0.0, 0.0, 0.0)).copy() * 0.4
    a = ease(ramp(lt, 0.3, 1.3))
    put_text(f, "FTX", W / 2, H / 2 - 170, "InterDisplay-Black", 200, WHITE, a, spacing=30, anchor="mm", glow=TEAL)
    ln = int(560 * eout(ramp(lt, 0.8, 1.8)))
    cv2.line(f, (W // 2 - ln, H // 2 - 40), (W // 2 + ln, H // 2 - 40), GOLD, 2, cv2.LINE_AA)
    put_text(f, "ЧАСТЬ 1 — РОЖДЕНИЕ КРИПТОИМПЕРИИ", W / 2, H / 2 + 30, "InterDisplay-SemiBold", 52, GOLD, ease(ramp(lt, 1.0, 1.8)), spacing=4, anchor="mm")
    put_text(f, "ПРОДОЛЖЕНИЕ В ЧАСТИ 2.", W / 2, H / 2 + 135, "Inter-Medium", 36, (0.85, 0.85, 0.85), ease(ramp(lt, 2.2, 2.9)), spacing=8, anchor="mm")
    f *= 1 - ease(ramp(lt, d - 0.5, d))
    return f

