#!/usr/bin/env python3
"""Builds the AVENOIR pages from src/site.html and data/catalog.json.

  python3 tools/build.py preview   -> preview/index.html + preview/watch/<model>/index.html  (noindex)
  python3 tools/build.py live      -> index.html + watch/<model>/index.html

Every watch gets its own address, title, description and share image, so a link to /watch/monti/
opens MONTI directly (also from Instagram), and refreshing or pressing Back works.
Prices in the page come from data/catalog.json at build time and are replaced at runtime by the
products table (the same table checkout charges from)."""
import glob, html, json, os, re, sys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://avenoirlab.com/'
target = sys.argv[1] if len(sys.argv) > 1 else 'preview'
cat = json.load(open(f'{ROOT}/data/catalog.json'))
tpl = open(f'{ROOT}/src/site.html').read()

# ---------- image map: sizes on disk, aspect ratio, and how much real detail each photo holds ----------
cache_p = f'{ROOT}/data/img-detail.json'
cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
def effective(path):
    """Width at which the photo stops losing detail when downscaled: anything above it is upscaling."""
    if path in cache: return cache[path]
    im = Image.open(path).convert('L'); w, h = im.size; a = np.asarray(im).astype(float)
    eff = w
    for f in (0.35, 0.5, 0.6, 0.7, 0.85):
        sm = im.resize((int(w * f), int(h * f)), Image.LANCZOS).resize((w, h), Image.LANCZOS)
        if np.abs(np.asarray(sm).astype(float) - a).mean() < 0.9: eff = int(w * f); break
    cache[path] = eff; return eff
img = {}
for d in ('catalogue', 'editorial'):
    for f in glob.glob(f'{ROOT}/img/{d}/*.webp'):
        m = re.match(r'(.+)-(\d+)\.webp$', os.path.basename(f))
        if not m: continue
        e = img.setdefault(m[1], {'d': d, 'w': [], 'r': 1, 'j': None, 'e': 0}); e['w'].append(int(m[2]))
for k, e in img.items():
    e['w'].sort(); big = f"{ROOT}/img/{e['d']}/{k}-{e['w'][-1]}.webp"
    w, h = Image.open(big).size; e['r'] = round(h / w, 4); e['e'] = effective(big)
    jp = [x for x in e['w'] if os.path.exists(f"{ROOT}/img/{e['d']}/{k}-{x}.jpg")]
    e['j'] = 768 if 768 in jp else (jp[-1] if jp else None)
json.dump(cache, open(cache_p, 'w'), indent=0)

# ---------- share images: a real front photograph per watch, 1200x630 ----------
SHARE = {'monti': 'monte-front-black-leather', 'lumi': 'lumi-front-blue-hands', 'rayo': 'rayo-front-silver-black-steel', 'bloom': 'bloom-front-pink'}
def og(k, src):
    out = f'{ROOT}/img/share/{k}.jpg'; os.makedirs(os.path.dirname(out), exist_ok=True)
    e = img[src]; im = Image.open(f"{ROOT}/img/{e['d']}/{src}-{e['w'][-1]}.webp").convert('RGB')
    canvas = Image.new('RGB', (1200, 630), (244, 241, 234))
    s = im.resize((630, 630), Image.LANCZOS); canvas.paste(s, (285, 0))
    canvas.save(out, quality=88); return f'img/share/{k}.jpg'
og_img = {k: og(k, v) for k, v in SHARE.items()}

M = cat['models']
def price(k):
    p = M[k]['price']; return f"AED {p:,}" if p is not None else ''
DESC = {
    'home': ('AVENOIR · Steel watches assembled in the UAE',
             'MONTI, LUMI, RAYO and BLOOM: steel watches assembled in the UAE after you order. Card or Apple Pay, delivered in 2–3 weeks. · ساعات ستيل تُجمَّع في الإمارات بعد طلبك.'),
    'monti': ('MONTI 38 · {p} · AVENOIR', 'Square steel case, TIME IS MONEY in red, blue cabochon crown. Steel bracelet or six leathers. Assembled in the UAE, delivered in 2–3 weeks. · علبة ستيل مربعة وعبارة TIME IS MONEY بالأحمر.'),
    'lumi': ('LUMI 33.5 · {p} · AVENOIR', 'The smaller square: steel bracelet and TIME IS MONEY in light pink. Assembled in the UAE, delivered in 2–3 weeks. · المربع الأصغر بسوار ستيل.'),
    'rayo': ('RAYO 40 · {p} · AVENOIR', 'A steel chronograph with three sub-dials and a tachymeter bezel. Assembled in the UAE, delivered in 2–3 weeks. · كرونوغراف ستيل بثلاث موانئ فرعية.'),
    'bloom': ('BLOOM 31 · {p} · AVENOIR', 'Fluted bezel, Roman numerals and a date at three. Assembled in the UAE, delivered in 2–3 weeks. · إطار مضلّع وأرقام رومانية.'),
}
def meta(page, url, robots):
    t, d = DESC[page]; t = t.format(p=price(page) if page in M else '')
    im = SITE + og_img.get(page, og_img['monti'])
    alt = {'home': 'AVENOIR MONTI 38 on black leather'}.get(page, f"AVENOIR {M[page]['name']} {M[page]['size']}" if page in M else 'AVENOIR')
    tags = [f'<title>{html.escape(t)}</title>', f'<meta name="description" content="{html.escape(d)}">', f'<link rel="canonical" href="{url}">']
    if robots: tags.append('<meta name="robots" content="noindex">')
    tags += [f'<meta property="og:{k}" content="{html.escape(v)}">' for k, v in [('type', 'product' if page in M else 'website'), ('site_name', 'AVENOIR'), ('url', url), ('title', t), ('description', d),
             ('image', im), ('image:secure_url', im), ('image:type', 'image/jpeg'), ('image:width', '1200'), ('image:height', '630'), ('image:alt', alt), ('locale', 'en_US'), ('locale:alternate', 'ar_AE')]]
    tags += ['<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{html.escape(t)}">', f'<meta name="twitter:image" content="{im}">']
    if page in M and M[page]['price'] is not None:
        tags += [f'<meta property="product:price:amount" content="{M[page]["price"]}">', '<meta property="product:price:currency" content="AED">']
    return '\n'.join(tags)

def page(out, A, H, page_key, url, robots):
    data = json.dumps({'catalog': cat, 'img': img}, separators=(',', ':'), ensure_ascii=False)
    pre = '' if page_key != 'home' else ''
    s = (tpl.replace('%%META%%', meta(page_key, url, robots)).replace('%%PRELOAD%%', pre).replace('%%DATA%%', data)
            .replace('%%OPEN%%', page_key if page_key in M else '').replace('%%A%%', A).replace('%%H%%', H))
    os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'w').write(s); print('wrote', os.path.relpath(out, ROOT))

if target == 'preview':
    base, A0, robots = f'{ROOT}/preview', '../', True; url0 = SITE + 'preview/'
else:
    base, A0, robots = ROOT, '', False; url0 = SITE
page(f'{base}/index.html', A0, './', 'home', url0, robots)
for k in ('monti', 'lumi', 'rayo', 'bloom'):
    page(f'{base}/watch/{k}/index.html', '../../' + A0, '../../', k, f'{url0}watch/{k}/', robots)
