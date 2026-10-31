// AVENOIR checkout: turns a build + the customer's delivery details into a Ziina payment and redirects to Ziina.
// Prices come from the products table (fallback: the catalogue below). Nothing the browser sends can change a price.
// The website POSTs a form, so personal details never appear in a URL. GET is only for the owner's trial link.
// Secrets (Supabase → Edge Functions → Secrets):
//   ZIINA_API_KEY  required. Never put it in the website code.
//   ZIINA_TEST     "false" to take real payments. Anything else (or unset) = test mode.
//   SITE_URL       where customers return after paying.

const EXTRA_STRAP_AED = 149;
const MAX_ORDERS_PER_IP_PER_HOUR = 8;
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Al Ain"];

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

// Errors send the visitor to a page on the website (order-issue.html) with a real link back to the same watch and choices.
// Supabase serves Edge Function responses as text/plain, so an HTML page printed here shows up as raw, garbled code.
// Nothing is stored before any of these checks pass.
const ISSUE_URL = Deno.env.get("ORDER_ISSUE_URL") ?? "https://avenoirlab.com/preview/order-issue.html"; // switch to /order-issue.html when the site is published
type Issue = "direct" | "model" | "option" | "details" | "server";
// q is passed in (never a shared variable), because one function instance serves several requests at once
const issue = (reqQ: URLSearchParams, code: Issue, status: number) => {
  const u = new URL(ISSUE_URL); u.searchParams.set("e", code);
  const m = reqQ.get("m") ?? ""; if (/^(monti|lumi|rayo|bloom)$/.test(m)) u.searchParams.set("m", m);
  for (const k of ["tier", "strap", "hands", "colour", "dial", "x"]) { const v = reqQ.get(k); if (v && /^[a-z,-]{1,60}$/.test(v)) u.searchParams.set(k, v); }
  console.log("order issue", code, status);
  return new Response(null, { status: 303, headers: { Location: u.toString(), "cache-control": "no-store" } });
};

function newRef(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(6));
  return "AV-" + Array.from(b, (x) => abc[x % abc.length]).join("");
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
// UAE mobile numbers only: 05XXXXXXXX or +9715XXXXXXXX (spaces, dashes and Arabic-Indic digits allowed)
function normPhone(raw: string): string | null {
  let d = raw.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x6F0)).replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (/^05\d{8}$/.test(d)) d = "+971" + d.slice(1);
  return /^\+9715\d{8}$/.test(d) ? d : null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let q: URLSearchParams = url.searchParams;
  const page = (code: Issue, status: number) => issue(q, code, status);
  if (req.method !== "GET" && req.method !== "POST") return page("direct", 405);
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) q = new URLSearchParams(Object.entries(await req.json().catch(() => ({}))).map(([k, v]) => [k, String(v)]));
    else q = new URLSearchParams(await req.text());
  }

  // ---- validate the build against the catalogue ----
  const key = q.get("m") ?? "";
  const model = CATALOGUE[key];
  if (!model) return page("model", 400);
  // dry=1: only validate and price the build (nothing is stored, no payment is created). Used by tests.
  const dry = q.get("dry") === "1";
  if (req.method === "GET" && !model.getOk && !dry) return page("direct", 400);

  const chosen: Record<string, string> = {};
  for (const g of model.groups) {
    const v = q.get(g.id) ?? g.opts[0];
    if (!g.opts.includes(v)) return page("option", 400);
    chosen[g.id] = v;
  }
  const xs = (q.get("x") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const okExtras = allowedExtras(model, chosen);
  if (new Set(xs).size !== xs.length || xs.some((x) => !okExtras.includes(x))) return page("option", 400);

  // packages (e.g. MONTI Standard / Exclusive) are read from products.tiers below; no tier = the original single price
  const tierId = q.get("tier");
  if (tierId != null && !/^[a-z]{3,20}$/.test(tierId)) return page("option", 400);

  // ---- customer details (website orders) ----
  const cust = { customer_name: "", customer_phone: "", customer_email: "", emirate: "", address: "", customer_note: "" };
  if (req.method === "POST" && !dry) {
    cust.customer_name = clean(q.get("name"), 80);
    const phone = normPhone(clean(q.get("phone"), 30));
    cust.emirate = clean(q.get("emirate"), 40);
    cust.address = clean(q.get("address"), 300);
    cust.customer_email = clean(q.get("email"), 120).toLowerCase();
    cust.customer_note = clean(q.get("note"), 300);
    if (cust.customer_name.replace(/[^\p{L}]/gu, "").length < 2) return page("details", 400);
    if (!phone) return page("details", 400);
    cust.customer_phone = phone;
    if (!EMIRATES.includes(cust.emirate)) return page("details", 400);
    if (cust.address.length < 10 || !/\p{L}/u.test(cust.address)) return page("details", 400);
    if (cust.customer_email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(cust.customer_email)) return page("details", 400);
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
      if (!row.active || row.price_aed == null) return page("model", 400);
      if (row.stock != null && row.stock <= 0) return page("model", 409);
      price = row.price_aed; extraPrice = row.extra_strap_aed;
      if (tierId != null) {
        const t = row.tiers?.[tierId];
        if (!t || t.enabled !== true || typeof t.price !== "number") return page("option", 400);
        for (const [g, allowed] of Object.entries(t.allow ?? {}) as [string, string[]][]) {
          if (chosen[g] != null && !allowed.includes(chosen[g])) return page("option", 400);
        }
        if (xs.length > (t.max_extras ?? 1)) return page("option", 400);
        price = t.price; chosen.tier = tierId;
      }
    } else if (tierId != null) return page("option", 400);
  }
  if (price == null) return page("model", 400);
  const amountAed = price + xs.length * extraPrice;
  if (dry) return new Response(JSON.stringify({ model: key, options: chosen, extras: xs, amount_aed: amountAed, amount_fils: amountAed * 100 }), { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

  // ---- simple abuse limit: a few orders per IP per hour ----
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  if (ip) {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const c = await sb(`orders?select=ref&client_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}`, { headers: { Prefer: "count=exact", Range: "0-0" } });
    const total = Number((c.headers.get("content-range") ?? "*/0").split("/")[1] || 0);
    if (total >= MAX_ORDERS_PER_IP_PER_HOUR) return page("server", 429);
  }

  const apiKey = Deno.env.get("ZIINA_API_KEY");
  if (!apiKey) return page("server", 503);
  const test = model.live ? false : Deno.env.get("ZIINA_TEST") !== "false";
  const site = (Deno.env.get("SITE_URL") ?? "https://avenoir911-cloud.github.io/AVENOIR/").replace(/#.*$/, "");
  const ref = newRef();

  // matching signals for the Meta Conversions API Purchase event
  const fbCookie = (v: string | null) => (v && /^fb\.\d\.\d+\.[\w.-]{1,200}$/.test(v) ? v : null);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400) || null;
  const ins = await sb("orders", { method: "POST", body: JSON.stringify({ ref, model: key, options: chosen, extras: xs, amount_aed: amountAed, test,
    client_ip: ip, client_ua: ua, fbp: fbCookie(q.get("fbp")), fbc: fbCookie(q.get("fbc")),
    ...Object.fromEntries(Object.entries(cust).map(([k, v]) => [k, v || null])) }) });
  if (!ins.ok) { console.error("order insert failed", ins.status, await ins.text()); return page("server", 500); }

  // ---- create the Ziina payment ----
  const desc = [model.name, ...Object.values(chosen), ...xs.map((x) => `+${x}`)].join(" · ");
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
  if (!zr.ok) { console.error("ziina error", zr.status, await zr.text()); return page("server", 502); }
  const intent = await zr.json();
  await sb(`orders?ref=eq.${ref}`, { method: "PATCH", body: JSON.stringify({ ziina_intent_id: intent.id ?? null, ziina_status: intent.status ?? null }) });

  if (typeof intent.redirect_url !== "string" || !intent.redirect_url.startsWith("https://")) return page("server", 502);
  return new Response(null, { status: 303, headers: { Location: intent.redirect_url, "cache-control": "no-store" } });
});
