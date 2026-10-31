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
PROV = json.load(open(f'{ROOT}/data/images.json'))
EXCLUDED = set(PROV['excluded'])          # e.g. digital recolours: never put on a page
img = {}
for d in ('catalogue', 'editorial'):
    for f in glob.glob(f'{ROOT}/img/{d}/*.webp'):
        m = re.match(r'(.+)-(\d+)\.webp$', os.path.basename(f))
        if not m or m[1] in EXCLUDED or int(m[2]) > 1600: continue   # 1600 px is the largest size served
        e = img.setdefault(m[1], {'d': d, 'w': [], 'r': 1, 'j': None, 'e': 0}); e['w'].append(int(m[2]))
for k, e in img.items():
    e['w'].sort(); big = f"{ROOT}/img/{e['d']}/{k}-{e['w'][-1]}.webp"
    if os.path.exists(f"{ROOT}/img/{e['d']}/{k}-1800.webp"): big = f"{ROOT}/img/{e['d']}/{k}-1800.webp"
    w, h = Image.open(big).size; e['r'] = round(h / w, 4); e['e'] = min(effective(big), e['w'][-1])
    jp = [x for x in e['w'] if os.path.exists(f"{ROOT}/img/{e['d']}/{k}-{x}.jpg")]
    e['j'] = 768 if 768 in jp else (jp[-1] if jp else None)
json.dump(cache, open(cache_p, 'w'), indent=0)
# iPhone Safari only decodes AVIF in AV1 main profile without an alpha layer: refuse to build with any other kind
for f in glob.glob(f'{ROOT}/img/**/*.avif', recursive=True):
    b = open(f, 'rb').read(); i = b.find(b'av1C')
    assert i > 0 and b[i + 5] >> 5 == 0 and b.find(b'auxC') < 0, f'AVIF not readable on iPhone: {f}'

# ---------- share images: a real front photograph per watch, 1200x630 ----------
SHARE = {'monti': 'monte-front-black-leather', 'lumi': 'lumi-front-blue-hands', 'rayo': 'rayo-front-silver-black-steel', 'bloom': 'bloom-front-pink'}
def og(k, src):
    out = f'{ROOT}/img/share/{k}.jpg'; os.makedirs(os.path.dirname(out), exist_ok=True)
    e = img[src]; big = f"{ROOT}/img/{e['d']}/{src}-1800.webp"
    im = Image.open(big if os.path.exists(big) else f"{ROOT}/img/{e['d']}/{src}-{e['w'][-1]}.webp").convert('RGB')
    canvas = Image.new('RGB', (1200, 630), (244, 241, 234))
    s = im.resize((630, 630), Image.LANCZOS); canvas.paste(s, (285, 0))
    canvas.save(out, quality=88); return f'img/share/{k}.jpg'
og_img = {k: og(k, v) for k, v in SHARE.items()}

M = cat['models']
TIERS = cat.get('tiers', {})
# a package that is not switched on is not sold, so it is not written into the page at all
cat_pub = {**cat, 'tiers': {k: {t: v for t, v in tt.items() if v.get('enabled')} for k, tt in TIERS.items()}}
SPECS = json.load(open(f'{ROOT}/data/specs.json'))
# only confirmed facts go into the page; open points and their notes stay in the review file
SPECS_PUB = {'fields': SPECS['fields'], 'labels': SPECS['labels'],
             'models': {k: {f: {'en': v['en'], 'ar': v['ar']} for f, v in fs.items() if v['status'] == 'confirmed'} for k, fs in SPECS['models'].items()}}
POLICY_SRC = open(f'{ROOT}/src/delivery.html').read()
POLICY_READY = 'OWNER_APPROVAL_REQUIRED' not in POLICY_SRC   # the policy page is only published once every open point is approved
def amount(k):
    """The price a visitor actually pays by default: the enabled Standard package if the model has packages."""
    on = [v for v in TIERS.get(k, {}).values() if v.get('enabled')]
    return on[0]['price'] if on else M[k]['price']
def price(k):
    p = amount(k); return f"AED {p:,}" if p is not None else ''
DESC = {
    'home': ('AVENOIR · Steel watches assembled in the UAE',
             'MONTI, LUMI, RAYO and BLOOM: steel watches assembled in the UAE after you order. Card or Apple Pay, delivered in 2–3 weeks. · ساعات ستيل تُجمَّع في الإمارات بعد طلبك.'),
    'monti': ('MONTI · {p} · AVENOIR', 'Square steel case, TIME IS MONEY in red, blue cabochon crown. Standard: steel bracelet or black leather. Assembled in the UAE, delivered in 2–3 weeks. · علبة ستيل مربعة وعبارة TIME IS MONEY بالأحمر.'),
    'lumi': ('LUMI · {p} · AVENOIR', 'The smaller square: steel bracelet and TIME IS MONEY in light pink. Assembled in the UAE, delivered in 2–3 weeks. · المربع الأصغر بسوار ستيل.'),
    'rayo': ('RAYO · {p} · AVENOIR', 'A steel chronograph with three sub-dials and a tachymeter bezel. Assembled in the UAE, delivered in 2–3 weeks. · كرونوغراف ستيل بثلاث موانئ فرعية.'),
    'bloom': ('BLOOM · {p} · AVENOIR', 'Fluted bezel, Roman numerals and a date at three. Assembled in the UAE, delivered in 2–3 weeks. · إطار مضلّع وأرقام رومانية.'),
}
DESC_AR = {
    'home': 'مونتي ولومي ورايو وبلوم: ساعات من الستيل تُجمَّع في الإمارات بعد طلبك. الدفع بالبطاقة أو Apple Pay، والتوصيل خلال 2 إلى 3 أسابيع.',
    'monti': 'مونتي: هيكل مربع من الستيل، وعبارة TIME IS MONEY بالأحمر، وتاج بحجر أزرق. تُجمَّع في الإمارات وتصل خلال 2 إلى 3 أسابيع.',
    'lumi': 'لومي: المربع الأصغر بسوار من الستيل وعبارة TIME IS MONEY بالوردي الفاتح. تُجمَّع في الإمارات وتصل خلال 2 إلى 3 أسابيع.',
    'rayo': 'رايو: كرونوغراف من الستيل بثلاث موانئ فرعية وإطار تاكيميتر. تُجمَّع في الإمارات وتصل خلال 2 إلى 3 أسابيع.',
    'bloom': 'بلوم: إطار مضلّع وأرقام رومانية وتاريخ عند الساعة الثالثة. تُجمَّع في الإمارات وتصل خلال 2 إلى 3 أسابيع.'}
AR_NAME = {'monti': 'مونتي', 'lumi': 'لومي', 'rayo': 'رايو', 'bloom': 'بلوم'}
def meta_title(page, lang='en'):
    if page not in M: return 'AVENOIR · Steel watches assembled in the UAE' if lang == 'en' else 'AVENOIR · ساعات ستيل تُجمَّع في الإمارات'
    return f"{M[page]['name']} · {price(page)} · AVENOIR" if lang == 'en' else f"{AR_NAME[page]} {M[page]['name']} · {amount(page):,} درهم · AVENOIR"
def meta(page, url, robots):
    t, d = DESC[page]; t = t.format(p=price(page) if page in M else '')
    im = SITE + og_img.get(page, og_img['monti'])
    alt = {'home': 'AVENOIR MONTI on black leather'}.get(page, f"AVENOIR {M[page]['name']}" if page in M else 'AVENOIR')
    tags = [f'<title>{html.escape(t)}</title>', f'<meta name="description" content="{html.escape(d)}">', f'<link rel="canonical" href="{url}">']
    if robots: tags.append('<meta name="robots" content="noindex">')
    tags += [f'<meta property="og:{k}" content="{html.escape(v)}">' for k, v in [('type', 'product' if page in M else 'website'), ('site_name', 'AVENOIR'), ('url', url), ('title', t), ('description', d),
             ('image', im), ('image:secure_url', im), ('image:type', 'image/jpeg'), ('image:width', '1200'), ('image:height', '630'), ('image:alt', alt), ('locale', 'en_US'), ('locale:alternate', 'ar_AE')]]
    tags += ['<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{html.escape(t)}">', f'<meta name="twitter:image" content="{im}">']
    if page in M and amount(page) is not None:
        tags += [f'<meta property="product:price:amount" content="{amount(page)}">', '<meta property="product:price:currency" content="AED">']
    return '\n'.join(tags)

FIRST = {'home': 'monte-front-black-leather', 'monti': 'monte-front-bracelet-blue-hands', 'lumi': 'lumi-front-blue-hands', 'rayo': 'rayo-front-gold-ice-black', 'bloom': 'bloom-front-pink'}
def preload(page_key, A):
    k = FIRST[page_key]; e = img[k]
    srcset = ', '.join(f"{A}img/{e['d']}/{k}-{w}.webp {w}w" for w in e['w'])
    sizes = '(min-width:900px) 560px, 92vw' if page_key == 'home' else '(min-width:960px) 52vw, 100vw'
    return f'<link rel="preload" as="image" type="image/webp" imagesrcset="{srcset}" imagesizes="{sizes}" fetchpriority="high">'

def jsonld(k, url):
    e = img[FIRST[k]]; d = DESC[k][1].split(' · ')[0]
    data = {'@context': 'https://schema.org', '@type': 'Product', 'name': f"AVENOIR {M[k]['name']}", 'sku': k, 'brand': {'@type': 'Brand', 'name': 'AVENOIR'},
            'description': d, 'url': url, 'image': [f"{SITE}img/{e['d']}/{FIRST[k]}-{e['j'] or 768}.jpg"],
            'offers': {'@type': 'Offer', 'url': url, 'priceCurrency': 'AED', 'price': str(amount(k)), 'itemCondition': 'https://schema.org/NewCondition',
                       # every watch is assembled after the order is paid, so it is made to order, not in stock
                       'availability': 'https://schema.org/MadeToOrder', 'seller': {'@type': 'Organization', 'name': 'AVENOIR'},
                       'shippingDetails': {'@type': 'OfferShippingDetails', 'shippingRate': {'@type': 'MonetaryAmount', 'value': '0', 'currency': 'AED'},
                                           'shippingDestination': {'@type': 'DefinedRegion', 'addressCountry': 'AE'}}}}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'

def page(out, A, H, page_key, url, robots):
    data = json.dumps({'catalog': cat_pub, 'img': img, 'specs': SPECS_PUB, 'policy': POLICY_READY or robots,
                       'meta': {'en': [meta_title(page_key), DESC[page_key][1].split(' · ')[0]], 'ar': [meta_title(page_key, 'ar'), DESC_AR[page_key]]}}, separators=(',', ':'), ensure_ascii=False)
    s = (tpl.replace('%%META%%', meta(page_key, url, robots)).replace('%%PRELOAD%%', preload(page_key, A)).replace('%%DATA%%', data)
            .replace('%%OPEN%%', page_key if page_key in M else '').replace('data-price="monti">AED 999<', f'data-price="monti">{price("monti")}<').replace('%%A%%', A).replace('%%H%%', H))
    if page_key in M:
        # a watch page is a page of its own: the product is the one <h1>, it is visible without JavaScript, and it is not a dialog
        s = s.replace('<html lang="en">', '<html lang="en" class="solo">', 1)
        s = s.replace('<h1 id="hero-h"', '<h2 id="hero-h"', 1).replace('</h1>\n        <p class="lede"', '</h2>\n        <p class="lede"', 1)
        s = s.replace('<div class="pv" id="pv" role="dialog" aria-modal="true" aria-labelledby="pv-name" hidden>', '<div class="pv" id="pv" aria-labelledby="pv-name">', 1)
        s = s.replace('<h1 id="pv-name" tabindex="-1" style="outline:none">MONTI 38</h1>', f'<h1 id="pv-name" tabindex="-1" style="outline:none">{M[page_key]["name"]}</h1>', 1)
        s = s.replace('<p class="pv-sub" id="pv-sub"></p>', f'<p class="pv-sub" id="pv-sub">{html.escape(DESC[page_key][1].split(" · ")[0])}</p>', 1)
        s = s.replace('</head>', jsonld(page_key, url) + '\n</head>', 1)
        # the product comes first in the page, before the rest of the collection
        i = s.index('<!-- product view:'); j = s.index('<!-- after payment -->'); block = s[i:j]; s = s[:i] + s[j:]
        s = s.replace('<main id="main">', '<main id="main">\n' + block, 1)
        assert s.count('<h1') == 1, 'one h1 per watch page'
    else:
        s = s.replace('<h1 id="pv-name" tabindex="-1" style="outline:none">MONTI 38</h1>', '<h2 id="pv-name" tabindex="-1" style="outline:none"></h2>', 1)
        assert s.count('<h1') == 1, 'one h1 on the home page'
    os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'w').write(s); print('wrote', os.path.relpath(out, ROOT))

if target == 'preview':
    base, A0, robots = f'{ROOT}/preview', '../', True; url0 = SITE + 'preview/'
else:
    base, A0, robots = ROOT, '', False; url0 = SITE
page(f'{base}/index.html', A0, './', 'home', url0, robots)
if POLICY_READY or robots:
    open(f'{base}/delivery.html', 'w').write(POLICY_SRC.replace('%%A%%', A0).replace('%%H%%', './').replace('%%ROBOTS%%', '<meta name="robots" content="noindex">' if robots or not POLICY_READY else '')); print('wrote delivery.html')
else: print('delivery.html NOT written: OWNER_APPROVAL_REQUIRED still in src/delivery.html')
open(f'{base}/order-issue.html', 'w').write(open(f'{ROOT}/src/order-issue.html').read().replace('%%A%%', A0).replace('%%H%%', './')); print('wrote order-issue.html')
for k in ('monti', 'lumi', 'rayo', 'bloom'):
    page(f'{base}/watch/{k}/index.html', '../../' + A0, '../../', k, f'{url0}watch/{k}/', robots)
