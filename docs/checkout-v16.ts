// AVENOIR checkout (v16): turns a build + the customer's delivery details into a Ziina payment and redirects to Ziina.
// v16 adds delivery outside the UAE (price per zone from the shipping_zones table; a zone is sold only when it is
// enabled and has a price) and a gift option (gift wrap priced in shop_settings, a card message, no price in the parcel).
// Prices come from the products table (fallback: the catalogue below). Nothing the browser sends can change a price.
// The website POSTs a form, so personal details never appear in a URL. GET is only for the owner's trial link.
// Secrets (Supabase → Edge Functions → Secrets):
//   ZIINA_API_KEY  required. Never put it in the website code.
//   ZIINA_TEST     "false" to take real payments. Anything else (or unset) = test mode.
//   SITE_URL       where customers return after paying.

const EXTRA_STRAP_AED = 149;
const MAX_ORDERS_PER_IP_PER_HOUR = 8;
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Al Ain"];
// ISO 3166 countries we can take an order for (comprehensively sanctioned countries left out). Kept in step with js/order-v4.js.
const COUNTRIES = new Set("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" "));
const ZONE_OF: Record<string, string> = {};
for (const c of "SA KW QA BH OM".split(" ")) ZONE_OF[c] = "GCC";
for (const c of "EG JO LB IQ MA TN DZ LY SD YE PS MR DJ SO KM".split(" ")) ZONE_OF[c] = "ARAB";
for (const c of "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB CH NO IS LI MC AD SM VA AL BA ME MK RS XK MD UA GI GG JE IM FO AX".split(" ")) ZONE_OF[c] = "EUROPE";
const zoneOf = (c: string) => c === "AE" ? "AE" : (ZONE_OF[c] ?? "WORLD");
const GIFT_MSG_MAX = 250;

type Group = { id: string; opts: string[]; extra?: boolean };
type Model = { name: string; price: number | null; groups: Group[]; extras?: string[]; live?: boolean; getOk?: boolean };

const CATALOGUE: Record<string, Model> = {
  monti:  { name: "MONTI 38", price: 999, groups: [
    { id: "hands", opts: ["blue", "silver"] },
    { id: "strap", opts: ["bracelet", "black", "brown", "navy", "green", "cream", "white"], extra: true } ] },
  rayo:   { name: "RAYO 40", price: 899, groups: [
    { id: "colour", opts: ["gold-ice-black", "gold-navy-navy", "silver-black-steel", "silver-white-steel", "silver-ice-steel", "silver-white-bluehands-steel"] } ],
    extras: ["navy-rubber", "steel"] },
  lumi:   { name: "LUMI 33.5", price: 799, groups: [ { id: "hands", opts: ["blue", "silver"] } ] },
  bloom:  { name: "BLOOM 31", price: 799, groups: [ { id: "dial", opts: ["pink", "white", "blue"] } ] },
  timeless: { name: "TIMELESS", price: null, groups: [] }, // not sold online yet
  // Owner's payment check: not shown on the site, reachable only by direct link (?m=trial).
  // Always a real charge (Ziina's minimum is 2 AED) so the owner can see money arrive end to end.
  trial: { name: "TRIAL PAYMENT", price: 2, groups: [], live: true, getOk: true },
};

function allowedExtras(m: Model, chosen: Record<string, string>): string[] {
  if (m.extras) return m.extras;
  const g = m.groups.find((g) => g.extra);
  if (!g) return [];
  return g.opts.filter((o) => o !== chosen[g.id] && o !== "bracelet");
}

// Errors come back as a small branded page (the form opens checkout in a new tab).
const page = (msgEn: string, msgAr: string, status: number) =>
  new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AVENOIR</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1ea;color:#111;font:16px/1.6 system-ui,sans-serif;padding:24px">
<div style="max-width:440px;text-align:center"><div style="letter-spacing:.3em;font-size:13px;margin-bottom:18px">AVENOIR</div>
<p style="font-size:18px;margin:0 0 6px">${msgAr}</p><p dir="ltr" style="color:#555;margin:0 0 22px">${msgEn}</p>
<a href="javascript:history.back()" style="color:#111">رجوع · Back</a></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

function newRef(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(6));
  return "AV-" + Array.from(b, (x) => abc[x % abc.length]).join("");
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
function normPhone(raw: string, uae = true): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (uae && /^05\d{8}$/.test(d)) d = "+971" + d.slice(1);
  if (uae && /^5\d{8}$/.test(d)) d = "+971" + d;
  return /^\+\d{8,15}$/.test(d) ? d : null;
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return page("Method not allowed.", "طريقة غير مسموحة.", 405);
  const url = new URL(req.url);
  let q: URLSearchParams = url.searchParams;
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) q = new URLSearchParams(Object.entries(await req.json().catch(() => ({}))).map(([k, v]) => [k, String(v)]));
    else q = new URLSearchParams(await req.text());
  }

  // info=1: the zones and gift price the order form may offer (no personal data, nothing stored)
  if (q.get("info") === "1") {
    const u = Deno.env.get("SUPABASE_URL")!, k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, h = { apikey: k, Authorization: `Bearer ${k}` };
    const [z, s] = await Promise.all([fetch(`${u}/rest/v1/shipping_zones?select=code,price_aed,days_en,days_ar&enabled=is.true&price_aed=not.is.null&order=sort`, { headers: h }), fetch(`${u}/rest/v1/shop_settings?select=gift_enabled,gift_wrap_aed&id=eq.1`, { headers: h })]);
    const zones = z.ok ? await z.json() : [{ code: "AE", price_aed: 0 }], st = s.ok ? (await s.json())[0] : null;
    return new Response(JSON.stringify({ zones, zone_of: ZONE_OF, countries: [...COUNTRIES], gift: st?.gift_enabled ? { wrap_aed: st.gift_wrap_aed } : null }),
      { headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
  }

  // ---- validate the build against the catalogue ----
  const key = q.get("m") ?? "";
  const model = CATALOGUE[key];
  if (!model) return page("This watch can't be ordered online.", "هذه الساعة غير متوفرة للطلب أونلاين.", 400);
  // dry=1: only validate and price the build (nothing is stored, no payment is created). Used by tests.
  const dry = q.get("dry") === "1";
  if (req.method === "GET" && !model.getOk && !dry) return page("Please order from the website so we can take your delivery details.", "اطلب من الموقع حتى نأخذ بيانات التوصيل.", 400);

  const chosen: Record<string, string> = {};
  for (const g of model.groups) {
    const v = q.get(g.id) ?? g.opts[0];
    if (!g.opts.includes(v)) return page(`Unknown ${g.id}.`, "خيار غير معروف.", 400);
    chosen[g.id] = v;
  }
  const xs = (q.get("x") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const okExtras = allowedExtras(model, chosen);
  if (new Set(xs).size !== xs.length || xs.some((x) => !okExtras.includes(x))) return page("Unknown extra strap.", "سير إضافي غير معروف.", 400);

  // packages (e.g. MONTI Standard / Exclusive) are read from products.tiers below; no tier = the original single price
  const tierId = q.get("tier");
  if (tierId != null && !/^[a-z]{3,20}$/.test(tierId)) return page("Unknown package.", "باقة غير معروفة.", 400);

  // ---- customer details (website orders) ----
  const cust = { customer_name: "", customer_phone: "", customer_email: "", emirate: "", address: "", customer_note: "", city: "" };
  const country = (q.get("country") ?? "AE").toUpperCase();
  if (!COUNTRIES.has(country)) return page("We can't deliver to this country yet.", "لا نوصل لهذه الدولة حالياً.", 400);
  const gift = { gift_wrap: q.get("gift_wrap") === "1", gift_hide_price: q.get("gift_hide") === "1", gift_message: clean(q.get("gift_msg"), GIFT_MSG_MAX) };
  if (req.method === "POST" && !dry) {
    cust.customer_name = clean(q.get("name"), 80);
    const phone = normPhone(clean(q.get("phone"), 30), country === "AE");
    cust.emirate = country === "AE" ? clean(q.get("emirate"), 40) : "";
    cust.city = country === "AE" ? "" : clean(q.get("city"), 80);
    cust.address = clean(q.get("address"), 300);
    cust.customer_email = clean(q.get("email"), 120).toLowerCase();
    cust.customer_note = clean(q.get("note"), 300);
    if (cust.customer_name.length < 2) return page("Please enter your name.", "اكتب اسمك.", 400);
    if (!phone) return page("Please enter a valid mobile number.", "اكتب رقم جوال صحيح.", 400);
    cust.customer_phone = phone;
    if (country === "AE" && !EMIRATES.includes(cust.emirate)) return page("Please choose your emirate.", "اختر الإمارة.", 400);
    if (country !== "AE" && cust.city.length < 2) return page("Please enter your city.", "اكتب المدينة.", 400);
    if (cust.address.length < 5) return page("Please enter your delivery address.", "اكتب عنوان التوصيل.", 400);
    if (cust.customer_email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(cust.customer_email)) return page("Please check your email.", "تأكد من البريد الإلكتروني.", 400);
  }

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = (path: string, init: RequestInit = {}) =>
    fetch(`${sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });

  // ---- price, availability and stock from the products table ----
  let price = model.price, extraPrice = EXTRA_STRAP_AED;
  if (key !== "trial") {
    const pr = await sb(`products?key=eq.${encodeURIComponent(key)}&select=price_aed,extra_strap_aed,active,stock,tiers`, { headers: { Prefer: "" } });
    const row = pr.ok ? (await pr.json())[0] : null;
    if (row) {
      if (!row.active || row.price_aed == null) return page("This watch is not available right now.", "هذه الساعة غير متوفرة حالياً.", 400);
      if (row.stock != null && row.stock <= 0) return page("Sold out. Message @avenoir.watches to reserve the next one.", "نفدت الكمية. راسلنا على إنستغرام @avenoir.watches لحجز القطعة القادمة.", 409);
      price = row.price_aed; extraPrice = row.extra_strap_aed;
      if (tierId != null) {
        const t = row.tiers?.[tierId];
        if (!t || t.enabled !== true || typeof t.price !== "number") return page("This package is not available yet.", "هذه الباقة غير متاحة حالياً.", 400);
        for (const [g, allowed] of Object.entries(t.allow ?? {}) as [string, string[]][]) {
          if (chosen[g] != null && !allowed.includes(chosen[g])) return page("This combination is not available in this package.", "هذا الخيار غير متاح في هذه الباقة.", 400);
        }
        if (xs.length > (t.max_extras ?? 1)) return page("Only one extra strap per order.", "سير إضافي واحد فقط لكل طلب.", 400);
        price = t.price; chosen.tier = tierId;
      }
    } else if (tierId != null) return page("This package is not available yet.", "هذه الباقة غير متاحة حالياً.", 400);
  }
  if (price == null) return page("This watch can't be ordered online.", "هذه الساعة غير متوفرة للطلب أونلاين.", 400);
  // ---- delivery and gift, priced on the server ----
  let shippingAed = 0, giftAed = 0;
  if (key !== "trial") {
    const zone = zoneOf(country);
    const zr0 = await sb(`shipping_zones?code=eq.${zone}&select=price_aed,enabled`, { headers: { Prefer: "" } });
    const zrow = zr0.ok ? (await zr0.json())[0] : null;
    if (zone === "AE") shippingAed = zrow?.enabled && zrow.price_aed != null ? zrow.price_aed : 0;
    else if (!zrow || !zrow.enabled || zrow.price_aed == null) return page("We don't deliver to this country yet. Message @avenoir.watches and we'll tell you when we do.", "ما نوصل لهذه الدولة حالياً. راسلنا على إنستغرام @avenoir.watches ونبلغك أول ما نفتحها.", 400);
    else shippingAed = zrow.price_aed;
    if (gift.gift_wrap) {
      const sr = await sb("shop_settings?select=gift_enabled,gift_wrap_aed&id=eq.1", { headers: { Prefer: "" } });
      const srow = sr.ok ? (await sr.json())[0] : null;
      if (!srow?.gift_enabled) return page("Gift wrapping is not available right now.", "تغليف الهدية غير متاح حالياً.", 400);
      giftAed = srow.gift_wrap_aed;
    }
  }
  const amountAed = price + xs.length * extraPrice + shippingAed + giftAed;
  if (dry) return new Response(JSON.stringify({ model: key, options: chosen, extras: xs, country, shipping_aed: shippingAed, gift_aed: giftAed, amount_aed: amountAed, amount_fils: amountAed * 100 }), { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

  // ---- simple abuse limit: a few orders per IP per hour ----
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  if (ip) {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const c = await sb(`orders?select=ref&client_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}`, { headers: { Prefer: "count=exact", Range: "0-0" } });
    const total = Number((c.headers.get("content-range") ?? "*/0").split("/")[1] || 0);
    if (total >= MAX_ORDERS_PER_IP_PER_HOUR) return page("Too many attempts. Please try again in an hour or message @avenoir.watches.", "محاولات كثيرة. حاول بعد ساعة أو راسلنا على إنستغرام.", 429);
  }

  const apiKey = Deno.env.get("ZIINA_API_KEY");
  if (!apiKey) return page("Online payment is being set up. Please message @avenoir.watches to order.", "الدفع أونلاين قيد التجهيز. راسلنا على إنستغرام للطلب.", 503);
  const test = model.live ? false : Deno.env.get("ZIINA_TEST") !== "false";
  const site = (Deno.env.get("SITE_URL") ?? "https://avenoir911-cloud.github.io/AVENOIR/").replace(/#.*$/, "");
  const ref = newRef();

  // matching signals for the Meta Conversions API Purchase event
  const fbCookie = (v: string | null) => (v && /^fb\.\d\.\d+\.[\w.-]{1,200}$/.test(v) ? v : null);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400) || null;
  const ins = await sb("orders", { method: "POST", body: JSON.stringify({ ref, model: key, options: chosen, extras: xs, amount_aed: amountAed, test,
    client_ip: ip, client_ua: ua, fbp: fbCookie(q.get("fbp")), fbc: fbCookie(q.get("fbc")),
    country, shipping_aed: shippingAed, gift_aed: giftAed, gift_wrap: gift.gift_wrap, gift_hide_price: gift.gift_hide_price, gift_message: gift.gift_message || null,
    ...Object.fromEntries(Object.entries(cust).map(([k, v]) => [k, v || null])) }) });
  if (!ins.ok) { console.error("order insert failed", ins.status, await ins.text()); return page("Something went wrong. Please try again.", "حدث خطأ. حاول مرة ثانية.", 500); }

  // ---- create the Ziina payment ----
  const desc = [model.name, ...Object.values(chosen), ...xs.map((x) => `+${x}`), ...(country !== "AE" ? [`ship ${country}`] : []), ...(gift.gift_wrap || gift.gift_message || gift.gift_hide_price ? ["GIFT"] : [])].join(" · ");
  const zr = await fetch("https://api-v2.ziina.com/api/payment_intent", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountAed * 100, // fils
      currency_code: "AED",
      message: `AVENOIR ${desc} · ${ref}`.slice(0, 200),
      success_url: `${site}#paid-${ref}`,
      cancel_url: `${site}#build`,
      failure_url: `${site}#failed`,
      test,
    }),
  });
  if (!zr.ok) { console.error("ziina error", zr.status, await zr.text()); return page("Payment could not start. Please try again or message @avenoir.watches.", "تعذر بدء الدفع. حاول مرة ثانية أو راسلنا.", 502); }
  const intent = await zr.json();
  await sb(`orders?ref=eq.${ref}`, { method: "PATCH", body: JSON.stringify({ ziina_intent_id: intent.id ?? null, ziina_status: intent.status ?? null }) });

  if (typeof intent.redirect_url !== "string" || !intent.redirect_url.startsWith("https://")) return page("Payment could not start.", "تعذر بدء الدفع.", 502);
  return new Response(null, { status: 303, headers: { Location: intent.redirect_url, "cache-control": "no-store" } });
});
