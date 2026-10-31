# AVENOIR preview: report (31 Oct 2026)

**Preview:** https://avenoirlab.com/preview/ (noindex) · watch pages: /preview/watch/monti/, /lumi/, /rayo/, /bloom/ · policy draft: /preview/delivery.html
**Live site:** unchanged. `index.html` and `watch/` were not rebuilt; the live pages still load `order-v2.js` and `track-v7.js`. No payment function was changed. No payment was made.

## 1. What changed, by brief item

1. **Product images:**
   - Each watch has one gallery system with five fixed slots, filled only with original images of that exact build. Missing slots are left out and listed in MISSING-ASSETS.md.
   - **15 digitally recoloured leather images were removed** from the preview and replaced with labelled colour samples.
   - Images are 1:1, the same ivory background, AVIF and WebP up to 1600 px (never upscaled), with width and height set.
   - The first photo is preloaded and the rest load lazily.
   - The LUMI design illustration now names LUMI in its alt text and caption.
2. **Collection:**
   - Thumbnails are now 168 px on desktop, 132 px on mobile and 112 px at 320.
   - The name, line, price and "View →" sit together, with no empty gap.
   - The whole row is the link. Hover is a light 4% image scale, the name turns navy and the arrow moves 4 px.
   - An ivory skeleton shows while images load.
3. **Specifications:**
   - A table with the 12 requested fields, showing confirmed facts only (`data/specs.json`).
   - RAYO movement is not shown.
   - Open fields are listed in SPECS-AND-POLICIES-FOR-APPROVAL.md.
4. **Policies:**
   - "Delivery, Warranty & Returns" page in English and Arabic, with 7 sections plus seller details.
   - Every undecided text is marked `OWNER_APPROVAL_REQUIRED`.
   - Linked next to Buy, in the delivery form, in the FAQ and in the footer.
   - The live build cannot publish the page, or show its links, while any mark remains.
5. **Arabic:**
   - "Nº 01" became الإصدار 01.
   - "Standard" became الأساسية / النسخة الأساسية.
   - The Arabic order summary uses Arabic words only, with the watch name مونتي.
   - TIME IS MONEY and number ranges are isolated so 2–3 never reads 3–2.
   - The page title and description switch to Arabic.
   - The language carries across pages (`?lang=` and the saved choice).
6. **Watch pages and SEO:**
   - Each watch/<model>/ is a page of its own, not a dialog over the home page: the product comes first, then the collection and the FAQ.
   - Exactly one h1 (the watch).
   - Canonical and Open Graph tags per watch.
   - Product and Offer JSON-LD in AED with `MadeToOrder` (not InStock) and free UAE shipping.
   - Real alt text on product and option images.
   - "Exclusive" no longer appears anywhere in the page or its data.
7. **Order and payment:**
   - The flow is kept; the server price check passed for every model (section 3).
   - The fix for direct checkout links is ready but **not deployed** (approval A).
8. **Delivery form:**
   - Rules: name at least 2 letters; UAE mobile only, starting 05 or +9715 (Arabic digits accepted); emirate required; address at least 10 characters; email optional but checked.
   - The message appears under each field.
   - One request per tap, with a spinner while it sends.
   - The customer's input is kept on error.
   - Delivery details are **no longer saved in the browser**, and the old saved copy is deleted.
9. **Consent:**
   - A banner with "Accept analytics", "Necessary only" and a Privacy link.
   - Meta Pixel and AVENOIR analytics load only after Accept, when the browser is idle.
   - The shop and the order work fully on "Necessary only".
   - The choice can be changed from the footer.
   - Not a legal compliance claim.
10. **Performance:**
    - The first image is preloaded.
    - srcset and sizes are set everywhere.
    - The home page does not load option photos.
    - Layout shift is under 0.05 on the home and watch pages.
    - No new libraries.

## 2. Files changed

- **New:**
  - `js/order-v3.js` and `js/track-v8.js`.
  - `src/delivery.html` and `src/order-issue.html`.
  - `data/images.json` (image provenance) and `data/specs.json`.
  - `tools/make1600.py`.
  - 40 files of the form `img/catalogue/*-1600.{webp,avif}`.
  - `docs/tests/preview-v2.js`.
  - `docs/patches/checkout.ts` and `docs/rollback-checkout-v15.ts`.
  - The three reports in `docs/`.
- **Changed:**
  - `src/site.html`, `tools/build.py`.
  - `data/catalog.json` (switched-off package removed).
  - `docs/patches/api.ts`.
  - `preview/**` (rebuilt).

## 3. Test results: `docs/tests/preview-v2.js`, 479 of 479 passed (Chromium)

- **Widths** 320, 375, 390, 430, 768, 1366 and 1440, in English and Arabic, on the home page and all 4 watch pages:
  - No horizontal scroll.
  - The buy button is visible and not covered; the price is not covered.
  - One h1; RTL direction is correct.
  - Options are at least 40 px tall.
  - Every product image has alt text.
  - No console errors.
- **Every product and option:**
  - MONTI bracelet and black, each with all 5–6 second straps (948 each), then removed (799).
  - LUMI blue and silver.
  - RAYO in all 6 colours (899), and with a steel bracelet (1,048).
  - BLOOM in all 3 dials (799).
  - Gallery photos always match the build, and no recolour is ever shown.
  - A non-Standard MONTI link is corrected to Standard.
- **Language and Back:**
  - The build survives a language switch.
  - Policy page → Back link → same build; the browser Back gives the same build.
  - Home → watch → Back → Forward keeps the choices.
- **Order flow up to payment** (the checkout request is captured; nothing is sent to Ziina):
  - Summary and total are correct; the policy link is in the form.
  - An empty submit gives 4 errors.
  - A UK number is refused and the other fields are kept; a bad email is refused.
  - **Three fast taps send one request.**
  - The request carries m, tier, strap, hands and x, and no price.
  - Nothing is stored in the browser.
  - The return page shows the order number in the page language.
- **Consent:**
  - Nothing is sent before a choice or with "Necessary only".
  - "Accept" loads the Pixel and counts the product view.
  - The banner never covers the buy bar.
- **SEO:** JSON-LD, canonical, its own og:image, and the product is not a dialog, on all 4 pages.
- **Server pricing** on the real checkout function, price-only `dry=1` mode (nothing is created):

| Build | Result |
|---|---|
| MONTI Standard, bracelet or black | 799 |
| MONTI Standard + extra strap | 948 |
| MONTI with `price=1` in the link | 799 (ignored) |
| LUMI, blue or silver | 799 |
| RAYO | 899 |
| RAYO + steel bracelet | 1,048 |
| BLOOM, all 3 dials | 799 |

- **Checkout patch (offline):** 10 of 10.
  - A direct link goes to order-issue with a Back link to the same build, and nothing is stored.
  - Bad details are refused before any database write.
  - Arabic digits are accepted.
  - Silver hands and two extra straps are refused.

## 4. Not done / left open

1. **iPhone Safari is not tested.** Playwright here has Chromium only. Use the iPhone script in REVIEW-PACK C on /preview/.
2. **The checkout fix is not live** (approval A). Until then, opening a checkout link directly still shows the garbled text page, because Supabase serves function pages as text/plain. The website flow itself never shows it.
3. **The API filter and the database `exclusive` key** are waiting for approvals B and C.
4. **Recoloured images are still on the live site** until the preview is published.
5. **Most photos hold 700–1080 px of real detail.** Only RAYO meets 1400–1600 honestly; a re-shoot is needed.
6. Older test files (`t3.js`, `nav.js`, `combo2.js`) were written for the dialog-only watch pages and are replaced by `preview-v2.js`.
7. Visit counts will drop with consent enabled (see the approvals file, section 3).
