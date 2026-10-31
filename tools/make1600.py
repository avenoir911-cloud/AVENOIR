#!/usr/bin/env python3
"""Adds a 1600 px WebP + AVIF for every catalogue photo that already exists at 1800 px (downscale only, never upscale).
Photos whose largest file is smaller than 1600 px are left alone and listed in docs/MISSING-ASSETS.md."""
import glob, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for f in sorted(glob.glob(f'{ROOT}/img/catalogue/*-1800.webp')):
    base = f[:-len('-1800.webp')]
    if os.path.exists(base + '-1600.webp') and os.path.exists(base + '-1600.avif'): continue
    im = Image.open(f).convert('RGB').resize((1600, 1600), Image.LANCZOS)
    im.save(base + '-1600.webp', quality=88, method=6)
    im.save(base + '-1600.avif', quality=72, speed=4)
    print('1600:', os.path.basename(base))
