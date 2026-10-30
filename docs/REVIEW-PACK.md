# AVENOIR — review pack (preview only, nothing published)

## A. Supplier specification checklist (send to MR.TIME, per model)
Shown on the site only after written confirmation. Ask for photos of the part/marking where possible.
| Item | MONTI | LUMI | RAYO | BLOOM |
|---|---|---|---|---|
| Case width × length × thickness (mm), lug width | ? (site had 38; old notes 40) | ? (33.5) | ? (40) | ? (31) |
| Case material (grade, e.g. 316L) | ? | ? | ? | ? |
| Crystal (sapphire / mineral / coated?) | ? | ? | ? | ? |
| Movement calibre and origin (Japanese automatic? which one) | ? | ? | ? | ? |
| Water resistance (rating) | ? | ? | ? | ? |
| Hands finish (painted blue / heat-blued) | ? | ? | — | ? |
| Dial text exactly as printed (ASSEMBLE vs ASSEMBLED IN UAE) | ? | ? | ? | ? |
| Strap/bracelet material, width, clasp type; strap + clasp unit cost | ? | ? | ? | ? |
| Weight | ? | ? | ? | ? |
| Lead time per piece | ? | ? | ? | ? |
| Exclusive: parts, engraving (letters vs logo, position, font, min qty, cost), sample | ? | — | — | — |

Model names: IDs stay monti / lumi / rayo / bloom (links, orders, admin). Displayed names: MONTI, LUMI, RAYO, BLOOM; Arabic مونتي. Sizes are not appended to names until confirmed. Orders store model id + options + tier.

## B. ADMIN_KEY — safe setup (do it yourself; never paste it in chat or code)
1. Make a long password in a password manager (at least 24 random characters).
2. Supabase dashboard → project uktmzygjaqnkizamrvij → Edge Functions → Secrets → Add secret: name `ADMIN_KEY`, value = that password. Save.
3. Open https://avenoirlab.com/admin.html and type the password there; it is sent only in the `x-admin-key` header to the admin function, never stored in the site code.
4. Before that works on avenoirlab.com, the admin function needs the domain fix in `docs/patches/admin.ts` (today it only accepts the old github.io address) — needs your OK to deploy.
5. Tests to run after: wrong password → "Wrong password" (401, delayed); no password → refused; orders list loads; change a test order's delivery status; change a price on a test product only.
Current state, tested: with no ADMIN_KEY the admin function refuses everything (503 for POST, 405 for GET).

## C. iPhone / Safari / Instagram test script (I cannot run Safari; please do this on your iPhone)
For both English and Arabic:
1. Safari → avenoirlab.com/preview/ : first screen shows the watch, price AED 799 and the button without scrolling.
2. Tap MONTI in the collection → swipe the photos left/right; tap Black leather; price stays 799; add Navy as second strap → 948; remove → 799.
3. Press Back (swipe from edge) → closes the watch. Refresh on the watch page → same choices.
4. Tap Buy → the form opens from the bottom; tap each field: the keyboard must not hide the field you type in; the Pay button shows the total.
5. Do NOT pay. Close the form.
6. Instagram: send yourself avenoirlab.com/preview/watch/monti/ in a DM, open it inside Instagram → it must open MONTI directly; Back button returns.
7. WhatsApp: paste the same link → preview card shows the watch and "AED 799".
Send me screenshots of anything that looks wrong.

## D. Ziina test-mode payment (no money moves) — needs you, about 3 minutes
Two staging orders exist (test: true, created by the pay-staging function, marked STAGING in orders):
- AV-LM82MM — AED 948 (Standard, black leather + navy strap) → pay with test card 4242 4242 4242 4242, any future date, any CVC.
- AV-BYA8A6 — AED 799 (Standard, bracelet) → open, then press back/cancel (failure/cancel path).
Links are in the chat. After you do it, I run the status check twice on each (success, cancel, repeated notification) and report.
