
# ================================================================ PART 2 — КРАХ: shots
RED = (0.92, 0.27, 0.25)
import glob as _glob

def opt_img(pattern):
    fs = sorted(_glob.glob(IMG + pattern))
    return os.path.basename(fs[0]) if fs else None

def date_stamp(f, txt, lt, x=110, y=120, color=GOLD, size=96, t0=0.2, dur=0.9):
    n = int(len(txt) * ramp(lt, t0, t0 + dur))
    a = ease(ramp(lt, t0 - 0.1, t0 + 0.3))
    put_text(f, txt[:n] + ("▌" if n < len(txt) and (lt * 2) % 1 < 0.5 else ""), x, y, "InterDisplay-Black", size, color, a, glow=color)

def p2_coindesk(lt, d):
    f = dark_bg().copy() * 0.8
    grid(f, 0.03, 70, lt * 6)
    date_stamp(f, "2 НОЯБРЯ 2022", lt, 110, 130)
    # document card (reconstruction of a balance sheet, not the publication's page)
    a = ease(ramp(lt, 0.8, 1.5)); x0, y0 = 1060 + int(60 * (1 - a)), 160
    cv2.rectangle(f, (x0, y0), (x0 + 700, y0 + 640), (0.08, 0.085, 0.095), -1)
    cv2.rectangle(f, (x0, y0), (x0 + 700, y0 + 640), (0.25, 0.25, 0.27), 1, cv2.LINE_AA)
    put_text(f, "БАЛАНС ALAMEDA RESEARCH", x0 + 40, y0 + 40, "Inter-Bold", 32, WHITE, a, spacing=2)
    put_text(f, "по данным публикации CoinDesk", x0 + 40, y0 + 90, "Inter-Regular", 24, (0.6, 0.6, 0.6), a)
    rows = [("Активы всего", "$14,6 млрд", WHITE), ("FTT (свободные)", "$3,66 млрд", GOLD), ("FTT (в залоге)", "$2,16 млрд", GOLD),
            ("Прочие токены", "…", (0.7, 0.7, 0.7)), ("Обязательства", "$8 млрд", (0.85, 0.5, 0.45))]
    for i, (k, v, c) in enumerate(rows):
        aa = a * ease(ramp(lt, 1.3 + i * 0.35, 1.8 + i * 0.35)); yy = y0 + 170 + i * 85
        cv2.line(f, (x0 + 40, yy + 62), (x0 + 660, yy + 62), (0.18, 0.18, 0.2), 1, cv2.LINE_AA)
        put_text(f, k, x0 + 40, yy, "Inter-Medium", 32, (0.85, 0.85, 0.85), aa)
        put_text(f, v, x0 + 660, yy, "InterDisplay-Bold", 36, c, aa, anchor="rt")
    put_text(f, "ПУБЛИКАЦИЯ\nCOINDESK", 114, 300, "InterDisplay-Bold", 64, WHITE, ease(ramp(lt, 1.0, 1.6)))
    tag(f, "РЕКОНСТРУКЦИЯ ДАННЫХ · ИСТОЧНИК: COINDESK", fadeio(lt, d, 0.4, 0.4), y=50)
    return f

def p2_donut(lt, d):
    f = dark_bg().copy()
    cx, cy, R, r = 1300, 520, 300, 190
    p = eout(ramp(lt, 0.3, 2.0))
    share = 5.82 / 14.6
    g = np.zeros((H, W, 3), np.float32)
    cv2.ellipse(g, (cx, cy), (R, R), -90, 0, 360 * p, (0.22, 0.24, 0.27), -1, cv2.LINE_AA)
    cv2.ellipse(g, (cx, cy), (R, R), -90, 0, 360 * share * p, GOLD, -1, cv2.LINE_AA)
    cv2.circle(g, (cx, cy), r, (0, 0, 0), -1, cv2.LINE_AA)
    m = (g.sum(2) > 0)[..., None]
    f = np.where(m, g, f)
    f += cv2.GaussianBlur(g * np.array(GOLD, np.float32) / 0.9 * (g[..., :1] > 0.5), (0, 0), 25) * 0.25
    put_text(f, f"{int(round(40 * ease(ramp(lt, 0.6, 2.0))))}%", cx, cy - 10, "InterDisplay-Black", 110, GOLD, ease(ramp(lt, 0.5, 1.2)), anchor="mm", glow=GOLD)
    put_text(f, "активов — токен FTT", cx, cy + 80, "Inter-Medium", 30, WHITE, ease(ramp(lt, 0.8, 1.4)), anchor="mm")
    put_text(f, "FTT", 110, 260, "InterDisplay-Black", 150, GOLD, ease(ramp(lt, 0.2, 0.8)), glow=GOLD)
    put_text(f, "токен, выпущенный\nсамой FTX", 116, 450, "Inter-SemiBold", 44, WHITE, ease(ramp(lt, 0.6, 1.3)))
    put_text(f, "≈ $5,8 млрд из $14,6 млрд · по данным CoinDesk", 116, 620, "Inter-Regular", 26, (0.65, 0.65, 0.65), ease(ramp(lt, 1.4, 2.0)))
    tag(f, "ИНФОГРАФИКА", fadeio(lt, d, 0.4, 0.4))
    return f

def p2_crack(lt, d):
    s = make_logo_shot("FTX_logo.svg.png", "ИМПЕРИЯ НА СОБСТВЕННОЙ ВАЛЮТЕ", "white", 1000, H / 2 - 60, (0.4, 0.5, 0.55), glitch=True)
    f = s(lt + 1.5, d + 1.5)
    # crack lines growing over the logo
    rng = random.Random(3); p = ease(ramp(lt, 0.6, d - 0.2))
    for k in range(5):
        x, y = W / 2 + rng.uniform(-300, 300), H / 2 - 60 + rng.uniform(-80, 80); ang = rng.uniform(0, 6.28)
        pts = [(x, y)]
        for s_ in range(int(14 * p)):
            ang += rng.uniform(-0.6, 0.6); x += 28 * math.cos(ang); y += 28 * math.sin(ang); pts.append((x, y))
        if len(pts) > 1: cv2.polylines(f, [np.int32(pts)], False, (0.9, 0.9, 0.9), 2, cv2.LINE_AA)
    return f

def p2_cz(lt, d):
    img = opt_img("Changpeng_Zhao*")
    if img:
        f = portrait(img, lt, d, fx=1300)
        credit(f, CREDITS.get(img, ""), ease(ramp(lt, 0.3, 1.0)))
    else:
        f = dark_bg().copy()
        put_text(f, "BINANCE", 1380, H / 2 - 40, "InterDisplay-Black", 170, (0.95, 0.75, 0.2), 0.18 * ease(ramp(lt, 0.2, 1.0)), anchor="mm", spacing=8)
    date_stamp(f, "6 НОЯБРЯ", lt, 110, 150, GOLD, 90)
    lower_third(f, "ЧАНПЭН ЧЖАО", "глава Binance", lt - 0.5, 110, 360)
    a = ease(ramp(lt, 1.6, 2.3))
    cv2.line(f, (110, 600), (110, 700), GOLD, 4, cv2.LINE_AA) if a > 0.05 else None
    put_text(f, "Binance продаст все\nоставшиеся токены FTT", 140, 590, "Inter-SemiBold", 40, WHITE, a)
    put_text(f, "заявление в соцсети X · пересказ", 142, 710, "Inter-Regular", 22, (0.6, 0.6, 0.6), a)
    return f

def p2_bankrun(lt, d):
    f = dark_bg().copy() * 0.7
    rng = random.Random(int(lt * 12))
    rows = 16; speed = 140
    off = (lt * speed) % 56
    for i in range(rows + 1):
        y = int(160 + i * 56 - off)
        if y < 140 or y > 1020: continue
        r2 = random.Random(int(lt * speed / 56) + i)
        amt = r2.choice([0.4, 1.2, 2.5, 7.9, 12.0, 25.0, 48.0, 150.0, 320.0])
        coin = r2.choice(["BTC", "ETH", "USDT", "SOL", "USD"])
        cv2.rectangle(f, (560, y), (1360, y + 48), (0.06, 0.04, 0.045), -1)
        put_text(f, f"ВЫВОД  ·  {coin}", 590, y + 8, "Inter-SemiBold", 26, (0.85, 0.85, 0.85), 1)
        put_text(f, f"−{amt:,.1f}".replace(",", " "), 1330, y + 8, "Inter-Bold", 26, RED, 1, anchor="rt")
    f = f * 0.75
    put_text(f, "КЛИЕНТЫ ВЫВОДЯТ ДЕНЬГИ", W / 2, 90, "InterDisplay-Bold", 56, WHITE, ease(ramp(lt, 0.2, 0.8)), anchor="mm", spacing=4)
    tag(f, "РЕКОНСТРУКЦИЯ", fadeio(lt, d, 0.3, 0.3), y=150)
    return f

def p2_sixbn(lt, d):
    f = dark_bg((0.03, 0.01, 0.01)).copy()
    k = eout(ramp(lt, 0.3, d * 0.8))
    v = int(6_000_000_000 * k)
    put_text(f, "$" + f"{v:,}".replace(",", " "), W / 2, H / 2 - 80, "InterDisplay-Black", 140, RED, ease(ramp(lt, 0.1, 0.5)), anchor="mm", glow=RED)
    put_text(f, "ЗА 72 ЧАСА", W / 2, H / 2 + 60, "InterDisplay-Bold", 60, WHITE, ease(ramp(lt, 0.6, 1.2)), anchor="mm", spacing=8)
    put_text(f, "по данным Reuters", W / 2, H / 2 + 150, "Inter-Regular", 28, (0.6, 0.6, 0.6), ease(ramp(lt, 1.0, 1.6)), anchor="mm")
    return f

FTT_PX = [(0, 25.5), (1, 25.0), (2, 24.0), (3, 23.5), (4, 23.0), (5, 22.5), (6, 22.0), (6.6, 20.0), (7, 15.0), (7.4, 9.0), (7.7, 5.5), (8, 4.5), (8.5, 3.5), (9, 2.8)]
def p2_halt(lt, d):
    sp = d * 0.42
    if lt < sp:
        f = dark_bg().copy() * 0.6
        a = ease(ramp(lt, 0.15, 0.5))
        blink = 0.75 + 0.25 * (math.sin(lt * 9) > 0)
        cv2.rectangle(f, (460, 330), (1460, 690), tuple(c * 0.25 for c in RED), -1)
        cv2.rectangle(f, (460, 330), (1460, 690), RED, 3, cv2.LINE_AA)
        put_text(f, "8 НОЯБРЯ 2022", W / 2, 400, "Inter-SemiBold", 34, (0.9, 0.9, 0.9), a, anchor="mm", spacing=6)
        put_text(f, "ВЫВОД СРЕДСТВ\nПРИОСТАНОВЛЕН", W / 2, 540, "InterDisplay-Black", 76, WHITE, a * blink, anchor="mm", align="center", glow=RED)
        tag(f, "РЕКОНСТРУКЦИЯ", a)
        return f
    t = lt - sp; dd = d - sp
    f = dark_bg().copy(); grid(f, 0.03, 90)
    xs = np.array([p[0] for p in FTT_PX]); ys = np.array([p[1] for p in FTT_PX])
    xi = np.linspace(0, 9, 180); yi = np.interp(xi, xs, ys)
    vals = yi / 26.0
    end = line_chart(f, vals, eout(ramp(t, 0.1, dd * 0.75)), 160, 260, 1500, 880, RED, thick=5)
    for lab, day in [("1 НОЯ", 0), ("6 НОЯ", 5), ("8 НОЯ", 7), ("10 НОЯ", 9)]:
        x = int(160 + (1500 - 160) * day / 9)
        put_text(f, lab, x, 905, "Inter-Medium", 22, (0.6, 0.6, 0.6), 1, anchor="mt")
    put_text(f, "КУРС FTT", 160, 140, "Inter-SemiBold", 36, WHITE, ease(ramp(t, 0, 0.5)), spacing=6)
    put_text(f, "−70%+", 1520, 600, "InterDisplay-Black", 120, RED, ease(ramp(t, dd * 0.55, dd * 0.75)), glow=RED)
    put_text(f, "за сутки", 1530, 740, "Inter-Medium", 34, WHITE, ease(ramp(t, dd * 0.6, dd * 0.8)))
    tag(f, "ГРАФИК ПРИБЛИЗИТЕЛЬНЫЙ · ДАННЫЕ БИРЖЕВЫХ КОТИРОВОК", fadeio(t, dd, 0.3, 0.3))
    return f

def p2_deal(lt, d):
    f = dark_bg().copy()
    a = ease(ramp(lt, 0.2, 0.8))
    put_text(f, "BINANCE", 560, H / 2 - 60, "InterDisplay-Black", 110, (0.95, 0.75, 0.2), a, anchor="mm")
    put_text(f, "FTX", 1380, H / 2 - 60, "InterDisplay-Black", 110, TEAL, a, anchor="mm")
    p = ease(ramp(lt, 0.8, 1.8))
    if p > 0: cv2.arrowedLine(f, (820, H // 2 - 60), (int(820 + 380 * p), H // 2 - 60), WHITE, 4, cv2.LINE_AA, tipLength=0.1 if p > 0.9 else 0.001)
    put_text(f, "НАМЕРЕНИЕ КУПИТЬ", W / 2, H / 2 + 60, "InterDisplay-Bold", 50, WHITE, ease(ramp(lt, 1.2, 1.8)), anchor="mm", spacing=4)
    put_text(f, "8 ноября 2022 · необязывающее письмо о намерениях", W / 2, H / 2 + 140, "Inter-Regular", 28, (0.65, 0.65, 0.65), ease(ramp(lt, 1.6, 2.2)), anchor="mm")
    return f

def p2_dealoff(lt, d):
    f = p2_deal(3.0, 4.0) * 0.22
    a = eout(ramp(lt, 0.3, 0.7)); sc = 1.4 - 0.4 * a
    L = text_layer("СДЕЛКА ОТМЕНЕНА", "InterDisplay-Black", 104, RED, 6, False)
    L = np.pad(L, ((140, 140), (40, 40), (0, 0)))
    cv2.rectangle(L, (40 + 10, 140 + 2), (L.shape[1] - 50, L.shape[0] - 142), (RED[0], RED[1], RED[2], 1.0), 6, cv2.LINE_AA)
    Ls = cv2.resize(L, (int(L.shape[1] * sc), int(L.shape[0] * sc)))
    M = cv2.getRotationMatrix2D((Ls.shape[1] / 2, Ls.shape[0] / 2), 6, 1.0)
    Ls = cv2.warpAffine(Ls, M, (Ls.shape[1], Ls.shape[0]))
    comp(f, Ls, W / 2 - Ls.shape[1] / 2, H / 2 - 40 - Ls.shape[0] / 2, a)
    put_text(f, "9 НОЯБРЯ 2022", W / 2, 180, "InterDisplay-Bold", 60, WHITE, ease(ramp(lt, 0.1, 0.5)), anchor="mm", spacing=6)
    put_text(f, "«по итогам проверки и с учётом сообщений СМИ\nо неправильном обращении со средствами клиентов»",
             W / 2, 800, "Inter-Medium", 34, (0.85, 0.85, 0.85), ease(ramp(lt, 1.4, 2.2)), anchor="mm", align="center")
    put_text(f, "заявление Binance · пересказ", W / 2, 905, "Inter-Regular", 22, (0.6, 0.6, 0.6), ease(ramp(lt, 1.8, 2.4)), anchor="mm")
    return f

def p2_transfer(lt, d):
    f = dark_bg().copy(); grid(f, 0.025, 80, lt * 5)
    a = ease(ramp(lt, 0.2, 0.8))
    for x, name, col, sub in [(420, "FTX", TEAL, "средства клиентов"), (1500, "ALAMEDA", GOLD, "торговая фирма Сэма")]:
        cv2.rectangle(f, (x - 230, 360), (x + 230, 620), tuple(c * 0.18 for c in col), -1)
        cv2.rectangle(f, (x - 230, 360), (x + 230, 620), col, 2, cv2.LINE_AA)
        put_text(f, name, x, 460, "InterDisplay-Black", 76, col, a, anchor="mm")
        put_text(f, sub, x, 560, "Inter-Medium", 28, (0.8, 0.8, 0.8), a, anchor="mm")
    rng = random.Random(9)
    for k in range(40):
        ph = (lt * 0.55 + k / 40) % 1.0
        if lt < 0.8 + k * 0.03: continue
        x = 650 + (1270 - 650) * ph; y = 490 + 60 * math.sin(ph * math.pi * 2 + k) * 0.5
        cv2.circle(f, (int(x), int(y)), 7, GOLD, -1, cv2.LINE_AA)
    put_text(f, "≈ $10 МЛРД", W / 2, 300, "InterDisplay-Black", 96, WHITE, ease(ramp(lt, 1.0, 1.6)), anchor="mm", glow=GOLD)
    put_text(f, "по данным источников Reuters, ноябрь 2022", W / 2, 720, "Inter-Regular", 28, (0.65, 0.65, 0.65), ease(ramp(lt, 1.4, 2.0)), anchor="mm")
    tag(f, "ИНФОГРАФИКА", fadeio(lt, d, 0.4, 0.4))
    return f

def p2_missing(lt, d):
    f = dark_bg((0.0, 0.0, 0.0)).copy() * 0.4
    s = "$1 000 000 000"
    fnt = font("InterDisplay-Black", 150); total = fnt.getlength(s); x = W / 2 - total / 2
    for i, ch in enumerate(s):
        p = ease(ramp(lt, 1.0 + i * 0.07, 2.2 + i * 0.07))
        a = ease(ramp(lt, 0.1, 0.5)) * (1 - p * 0.9)
        if ch != " ": put_text(f, ch, x, H / 2 - 130 + 40 * p, "InterDisplay-Black", 150, WHITE, a)
        x += fnt.getlength(ch)
    put_text(f, "ИСЧЕЗЛИ", W / 2, H / 2 + 110, "InterDisplay-Bold", 64, RED, ease(ramp(lt, 1.6, 2.2)), anchor="mm", spacing=14, glow=RED)
    return f

def p2_networth(lt, d):
    f = portrait("Sam_Bankman-Fried.png", lt, d, fx=1300)
    g = f.mean(axis=2, keepdims=True); f = (g + (f - g) * 0.15) * 0.85
    k = eout(ramp(lt, 0.8, d - 0.6))
    v = 16.0 * (1 - k) + 0.0 * k
    put_text(f, "СОСТОЯНИЕ", 110, 260, "Inter-SemiBold", 36, (0.8, 0.8, 0.8), ease(ramp(lt, 0.2, 0.7)), spacing=6)
    put_text(f, f"${v:.1f} МЛРД".replace(".", ","), 106, 320, "InterDisplay-Black", 120, RED if k > 0.5 else GOLD, ease(ramp(lt, 0.2, 0.7)), glow=RED if k > 0.5 else GOLD)
    put_text(f, "оценка Forbes и Bloomberg до краха", 112, 480, "Inter-Regular", 26, (0.65, 0.65, 0.65), ease(ramp(lt, 0.5, 1.0)))
    credit(f, "Фото: Cointelegraph · CC BY 3.0 · Wikimedia Commons", 1)
    return f

def p2_bankruptcy(lt, d):
    img = opt_img("*Caleb_Boggs*") or opt_img("*Wilmington*")
    if img:
        f = kenburns(load(img), lt, d, 1.0, 1.1) * 0.2
        credit(f, CREDITS.get(img, ""), 1)
    else:
        f = dark_bg().copy()
    date_stamp(f, "11 НОЯБРЯ 2022", lt, 110, 110, WHITE, 80)
    put_text(f, "ГЛАВА 11", 110, 250, "InterDisplay-Black", 130, RED, ease(ramp(lt, 0.8, 1.3)), glow=RED)
    put_text(f, "заявление о банкротстве\nсуд по делам о банкротстве, штат Делавэр", 116, 420, "Inter-Medium", 34, WHITE, ease(ramp(lt, 1.1, 1.7)))
    # ~130 companies grid
    n = 130; cols = 13; s = 34
    for i in range(n):
        p = ramp(lt, 1.4 + i * 0.018, 1.6 + i * 0.018)
        if p <= 0: continue
        x = 1180 + (i % cols) * (s + 6); y = 240 + (i // cols) * (s + 6)
        cv2.rectangle(f, (x, y), (x + s, y + s), tuple(c * (0.35 + 0.65 * p) for c in RED), -1)
    put_text(f, "≈130 КОМПАНИЙ ГРУППЫ", 1180 + cols * (s + 6) / 2, 680, "Inter-SemiBold", 32, WHITE, ease(ramp(lt, 3.0, 3.6)), anchor="mt", spacing=3)
    return f

def p2_resign(lt, d):
    f = portrait("MIT_Bitcoin_Expo_2022_-_Sam_Bankman.png", lt, d, fx=1300)
    g = f.mean(axis=2, keepdims=True); f = (g + (f - g) * 0.1) * 0.8
    lower_third(f, "СЭМ БЭНКМАН-ФРИД", "уходит с поста\nгенерального директора FTX", lt - 0.2, 110, 380, RED)
    credit(f, "Кадр: MIT Bitcoin Club · CC BY 3.0 · Wikimedia Commons (2022)", 1)
    return f

def p2_ray(lt, d):
    f = dark_bg().copy()
    lower_third(f, "ДЖОН ДЖ. РЭЙ III", "новый генеральный директор FTX\nруководил ликвидацией Enron", lt - 0.1, 110, 330)
    a = ease(ramp(lt, 1.0, 1.6))
    put_text(f, "ENRON", 1450, 500, "InterDisplay-Black", 150, (0.35, 0.35, 0.38), a * 0.7, anchor="mm", spacing=10)
    put_text(f, "банкротство 2001 года", 1450, 610, "Inter-Medium", 30, (0.55, 0.55, 0.55), a, anchor="mm")
    return f

def p2_quote(lt, d):
    f = dark_bg((0.01, 0.01, 0.015)).copy()
    a = ease(ramp(lt, 0.2, 0.9))
    put_text(f, "“", 200, 160, "InterDisplay-Black", 260, GOLD, a * 0.8)
    q = "Никогда за свою карьеру\nя не видел такого полного провала\nкорпоративного контроля"
    put_text(f, q, 300, 330, "InterDisplay-SemiBold", 62, WHITE, a)
    put_text(f, "— Джон Дж. Рэй III, заявление в суд, 17 ноября 2022 (перевод, сокращено)", 304, 640, "Inter-Regular", 28, (0.65, 0.65, 0.65), ease(ramp(lt, 0.8, 1.4)))
    return f

def p2_tenday(lt, d):
    f = dark_bg().copy()
    x0, x1, y = 200, 1720, 640
    p = eout(ramp(lt, 0.3, d * 0.7))
    cv2.line(f, (x0, y), (int(x0 + (x1 - x0) * p), y), (0.5, 0.5, 0.5), 3, cv2.LINE_AA)
    ev = [(2, "CoinDesk"), (6, "Binance"), (8, "стоп выводов"), (9, "отказ от сделки"), (11, "банкротство")]
    for day, lab in ev:
        x = int(x0 + (x1 - x0) * (day - 2) / 9)
        if (day - 2) / 9 <= p + 1e-3:
            cv2.circle(f, (x, y), 12, RED if day == 11 else GOLD, -1, cv2.LINE_AA)
            up = day == 8
            put_text(f, f"{day} НОЯ", x, (y - 120) if up else (y + 30), "Inter-Bold", 28, WHITE, 1, anchor="mt")
            put_text(f, lab, x, (y - 75) if up else (y + 75), "Inter-Regular", 24, (0.7, 0.7, 0.7), 1, anchor="mt")
    k = eout(ramp(lt, 0.5, d * 0.8))
    put_text(f, f"${32 * (1 - k):.0f} МЛРД", W / 2, 330, "InterDisplay-Black", 150, RED if k > 0.6 else GOLD, 1, anchor="mm", glow=RED if k > 0.6 else GOLD)
    put_text(f, "МЕНЬШЕ ЧЕМ ЗА 10 ДНЕЙ", W / 2, 470, "InterDisplay-Bold", 48, WHITE, ease(ramp(lt, 0.8, 1.4)), anchor="mm", spacing=8)
    return f

def p2_night(lt, d):
    img = opt_img("*Nassau*")
    if img:
        f = kenburns(load(img), lt, d, 1.0, 1.12) * 0.5
        g = f.mean(axis=2, keepdims=True); f = g + (f - g) * 0.3
        credit(f, CREDITS.get(img, ""), 1)
        lower_third(f, "БАГАМЫ", "здесь жил Сэм Бэнкман-Фрид", lt - 0.3, 110, 330)
    else:
        f = portrait("Sam_Bankman-Fried.png", lt, d, fx=W / 2, z0=1.0, z1=1.12)
        g = f.mean(axis=2, keepdims=True); f = np.repeat(g, 3, axis=2) * 0.45 * (1 - 0.4 * ease(ramp(lt, 0, d)))
        credit(f, "Фото: Cointelegraph · CC BY 3.0 · Wikimedia Commons", 0.8)
    return f

def p2_final(lt, d):
    f = dark_bg((0.0, 0.0, 0.0)).copy() * 0.4
    a = ease(ramp(lt, 0.3, 1.3))
    put_text(f, "FTX", W / 2, H / 2 - 170, "InterDisplay-Black", 200, WHITE, a, spacing=30, anchor="mm", glow=RED)
    ln = int(560 * eout(ramp(lt, 0.8, 1.8)))
    cv2.line(f, (W // 2 - ln, H // 2 - 40), (W // 2 + ln, H // 2 - 40), RED, 2, cv2.LINE_AA)
    put_text(f, "ЧАСТЬ 2 — КРАХ", W / 2, H / 2 + 30, "InterDisplay-SemiBold", 56, GOLD, ease(ramp(lt, 1.0, 1.8)), spacing=6, anchor="mm")
    put_text(f, "ПРОДОЛЖЕНИЕ В ЧАСТИ 3.", W / 2, H / 2 + 135, "Inter-Medium", 36, (0.85, 0.85, 0.85), ease(ramp(lt, 2.0, 2.7)), spacing=8, anchor="mm")
    f *= 1 - ease(ramp(lt, d - 0.5, d))
    return f

import json as _json
try: CREDITS = _json.load(open(IMG + "credits2.json"))
except Exception: CREDITS = {}

S = lambda i: SENTS[i]["start"] - 0.35
def chunk_start(si, ci): return SENTS[si]["chunks"][ci][0] - 0.3

EDL = [
    (0.0, p2_coindesk, "cut"),
    (S(1), p2_donut, "x"),
    (S(2), p2_crack, "x"),
    (S(3), p2_cz, "black"),
    (S(4), p2_bankrun, "x"),
    (S(5), p2_sixbn, "x"),
    (S(6), p2_halt, "x"),
    (S(7), p2_deal, "black"),
    (S(8), p2_dealoff, "x"),
    (S(9), p2_transfer, "black"),
    (S(10), p2_missing, "x"),
    (S(11), p2_networth, "x"),
    (S(12), p2_bankruptcy, "black"),
    (S(13), p2_resign, "x"),
    (S(14), p2_ray, "x"),
    (S(15), p2_quote, "x"),
    (S(16), p2_tenday, "black"),
    (S(17), p2_night, "x"),
    (S(18) - 0.2, p2_final, "black"),
]
SHOTS = []
for i, (st, fn, tr) in enumerate(EDL):
    en = (EDL[i + 1][0] + XF) if i + 1 < len(EDL) else DUR
    SHOTS.append((st, en, fn, tr))

