# MISSING-ASSETS — AVENOIR product photos (preview, 31 Oct 2026)

Every watch now has the same five gallery slots: **1 Front · 2 Side and crown · 3 Caseback · 4 Clasp or buckle · 5 Macro dial detail**.
A slot is filled only with an existing original image of **that exact build**. Nothing was generated, nothing is repeated as a different angle, and no photo of another strap, hand colour or watch fills a gap. Empty slots are left out of the gallery (the customer never sees an empty box) and are listed here. Source of truth: `data/images.json` (provenance) and the `slots` in `src/site.html`.

## 1. Missing angles (to photograph)

✅ = original image in use · ❌ = missing

| Build | Front | Side and crown | Caseback | Clasp/buckle | Dial macro |
|---|---|---|---|---|---|
| MONTI, steel bracelet, blue hands (Standard) | ✅ | ❌ | ❌ | ❌ bracelet clasp | ✅ |
| MONTI, black leather, blue hands (Standard) | ✅ | ✅ | ✅ | ✅ | ✅ |
| MONTI, silver hands (not sold in Standard) | ✅ bracelet only | ❌ | ❌ | ❌ | ❌ (macro shows blue hands) |
| MONTI, brown, navy, green, ivory and white leather | ❌ | ❌ | ❌ | ❌ | (dial ✅) |
| LUMI, blue hands | ✅ | ✅ (top-edge view with crown) | ❌ | ✅ | ✅ dial artwork before assembly |
| LUMI, silver hands | ✅ | ✅ | ❌ | ✅ | ✅ dial artwork |
| RAYO, each of 6 colourways | ✅ | ❌ | ❌ | ❌ | ❌ |
| BLOOM, pink / ivory / ice blue | ✅ | ❌ | ❌ | ❌ | ❌ |

To complete what is on sale now: **4 photos** finish MONTI Standard and LUMI (MONTI bracelet side, caseback and clasp, plus the LUMI caseback). RAYO and BLOOM need 4 more each (side, caseback, clasp, macro) for one colourway.

## 2. Removed from the site: 15 digitally recoloured images

`monte-front-`, `monte-caseback-` and `monte-strap-` **brown / navy / green / cream / white -leather** were made on 20 Oct by recolouring the black-leather image (measured: the dial area is pixel-identical to the black-leather photo, and the strap files match a recolour mask). They are not photos of those straps.
- In the preview they are **never shown**. The colours appear as a labelled colour sample ("Navy leather", "colour sample") in the strap row, the second-strap choice and the home page strap chapter.
- **They are still on the live site** until the preview is published.
- Needed: one real photo per leather colour, ideally front + caseback.

## 3. Images in use that are not camera photos (your decision)

| Image | What it is |
|---|---|
| `monte-dial-macro` | AI concept render (dial text checked: ASSEMBLE IN UAE) |
| `lumi-crown-profile`, `lumi-clasp` | AI concept renders |
| All fronts for MONTI bracelet, LUMI, RAYO, BLOOM | Cut-outs from the previous website, source unknown |
| `monte-*-black-leather` | "REAL" reference files; you said these are a mix of photos and AI images |

These existed before and were not generated now. If only camera photos are allowed, these slots become ❌ too.

## 4. Size, framing and resolution

- **Square 1:1:** all ✅.
- **Background:** all ✅ the same ivory (244, 241, 233), measured in the corners of every file.
- **Watch size in frame:** the case width is the same within each model (MONTI 46% of frame width, LUMI 41%, RAYO 43%, BLOOM 40%).
- **Light and shadow:** only the RAYO and BLOOM cut-outs share the same studio light. MONTI REAL photos and the renders differ.
- **Formats and sizes:** AVIF + WebP, served at 480, 768, 1200 and 1600 px (new 1600 files are downscaled from 1800, never upscaled). Every image has width and height set. The first photo is preloaded; the others load lazily.
- **Real detail is lower than 1400–1600 px for most images.** The table below shows the width at which each file stops gaining detail; anything above it is enlargement. These need a re-shoot at 2000 px or more to meet the 1400–1600 requirement honestly:

| Real detail | Images |
|---|---|
| ≥ 1400 ✅ | 6 RAYO fronts (1530) |
| 1000–1300 | `monte-dial-macro` 1260, `monte-front-black-leather` 1080, `monte-caseback-black-leather` 1020 (file only 1200 px) |
| 700–900 | MONTI bracelet fronts, MONTI side and clasp, 3 BLOOM fronts, LUMI crown and clasp (900); LUMI fronts 720 (files only 1200 px); LUMI dial 768 |

Zoom on the product page is limited to the real detail, so the dial text never turns into a blur.

## 5. Re-shoot brief (one session covers most of this)

The same ivory background (#F4F1EA), the same lens and distance per model, soft light from the top-left, square framing, and the case at about 45% of frame width. Shoot at 3000 px or more.
1. MONTI bracelet: side and crown, caseback, bracelet clasp.
2. MONTI on each leather colour: front and caseback.
3. LUMI: caseback.
4. RAYO and BLOOM: side, caseback, clasp, dial macro (one colour each to start).
5. Wrist shots and packaging for the editorial sections.
