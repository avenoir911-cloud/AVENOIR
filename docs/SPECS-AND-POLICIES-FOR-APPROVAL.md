# Specifications and policies waiting for your approval (31 Oct 2026)

Nothing below is shown to customers until you confirm it. Edit `data/specs.json` (set `status` to `confirmed` with the value) or tell me the values and I will add them.

## 1. Specifications

What is shown now, from `data/specs.json` (status = confirmed):

| | MONTI | LUMI | RAYO | BLOOM |
|---|---|---|---|---|
| Case material | Steel | Steel | Steel | Steel |
| Movement | Japanese automatic | Japanese automatic | **not shown** | Japanese automatic |
| Strap | Steel bracelet or black leather | Steel bracelet | Rubber or steel bracelet, by colourway | **not shown** |
| Warranty | 1 year on the movement | same | same | same |

The sources for these:
- "Steel", "Japanese automatic" and "1 year on the movement" are your instructions in chat.
- The straps come from your answers of 19 Oct and the Standard package.

**Please confirm.**

1. Is BLOOM really a Japanese automatic? It was on the site before, but I have no supplier document for it.
2. Is RAYO's movement automatic, quartz or a chronograph calibre? It stays hidden until you answer.

**Missing or unconfirmed: hidden from customers.** Ask MR.TIME for all of these in writing:

| Field | MONTI | LUMI | RAYO | BLOOM |
|---|---|---|---|---|
| Case size (mm) | 38 on old site, 40 in old notes | 33.5 (old site) | 40 (old site) | 31 (old site) |
| Case thickness | ? | ? | ? | ? |
| Steel grade (e.g. 316L) | ? | ? | ? | ? |
| Crystal | "Sapphire" in old copy, unconfirmed | same | ? | same |
| Exact calibre | NH35 in internal images (you asked not to publish it) | NH05 in supplier screenshot | ? | ? |
| Water resistance | ? | ? | ? | ? |
| Strap width | ? | ? | ? | ? |
| Wrist size range | ? | ? | ? | ? |
| Caseback | Exhibition back in REAL_01 (photo or AI?) | Exhibition back in supplier screenshot | ? | ? |
| BLOOM bracelet type | | | | ? |

Two lines removed from the home page because they depend on unconfirmed facts:
- "and you see it through the back" (the caseback is not confirmed).
- "stainless" (the steel grade is not confirmed).

## 2. Delivery, Warranty & Returns page

The page is `preview/delivery.html`, bilingual, and its source is `src/delivery.html`. Every undecided sentence is marked in the code as `OWNER_APPROVAL_REQUIRED` and highlighted in yellow on the preview. **The live build refuses to publish this page and hides every link to it while any mark is left.**

Decisions needed (each one is highlighted on the page):

1. **Delivery time**: 2–3 weeks? After how many days can the customer cancel for lateness (21 days in the draft)?
2. **Cancelling before assembly**: until when can a customer cancel? How fast is the refund (14 days in the draft)?
3. **Change-of-mind returns**: within how many days (7 in the draft)? Who pays return shipping? How fast is the refund? Are exchanges allowed?
4. **What the warranty covers**: stopping, irregular timekeeping, anything else?
5. **What the warranty does not cover**: impacts, water, glass, strap wear, opened by others?
6. **Warranty remedy**: repair or replace, and within how many days?
7. **Seller details**: legal name, trade licence number, emirate, WhatsApp number. Online sellers in the UAE must show these.

These sections are **not marked**, because they state legal rights or facts already on the site:
- Faulty, damaged or wrong watch → repair, replacement or refund under UAE consumer law.
- The warranty is "in addition to your legal rights".
- Free UAE delivery.
- Payment.

**Legal check:** I have not claimed this page complies with UAE Federal Law 15/2020 or Cabinet Resolution 66/2023. A UAE lawyer, or the Department of Economy guidance, should review it before publishing.

## 3. Consent banner

"Accept analytics" and "Necessary only" are technically enforced (tested): nothing goes to Meta or to AVENOIR analytics until the visitor accepts. **Not a legal opinion:** whether the wording meets the UAE data protection law (PDPL) needs a specialist.

One business decision for you: right now **AVENOIR's own visit counter is also off until a visitor accepts**. Visitors who ignore the banner will not be counted, so the dashboard will show fewer visits than before. Do you want to keep that, or count anonymous visits without consent? The second option needs legal advice.

## 4. Other approvals (production; not done)

| # | What | Why | Risk |
|---|---|---|---|
| A | Deploy `docs/patches/checkout.ts` | Fixes the garbled page on direct checkout links: it now redirects to `order-issue.html` with a real Back link. The server also accepts only UAE mobiles and requires an address of 10+ characters. 10 of 10 offline tests passed. | Payment function. Rollback: `docs/rollback-checkout-v15.ts`, the exact deployed v15. |
| B | Deploy `docs/patches/api.ts` | The catalogue API stops sending switched-off packages (Exclusive), and the amount and currency check runs before an order is marked paid. | Rollback: `docs/rollback-api.ts`. |
| C | Remove the `exclusive` key from `products.tiers` in the database | "Do not mention Exclusive in the data". It is switched off today, so nothing changes for customers. | One SQL line; restoring is one SQL line. |
| D | Google Shopping feed: `availability` is `in_stock` | Watches are made to order. Google accepts in_stock with a longer handling time; the page's structured data now says `MadeToOrder`. | Decide whether to add a handling time of 14–21 days to the feed. |
