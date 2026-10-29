// AVENOIR public API for the website. Three small endpoints, no personal data in or out:
//   GET  /api/status?ref=AV-XXXXXX  → { status: "paid" | "pending" | "failed" | "unknown" }  (asks Ziina once if needed)
//   POST /api/collect                → stores an analytics event (random session id, event, product, option, value)
//   GET  /api/catalog                → prices / availability / stock for the product grid
const ORIGINS = ["https://avenoir911-cloud.github.io", "http://localhost:8811"];
const EVENTS = new Set(["PageView", "SelectProduct", "ViewContent", "SelectStrap", "SelectOption", "AddToCart", "InitiateCheckout", "Purchase"]);

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
};
const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(req), ...extra } });
// One piece off the watch's stock when an order becomes paid (only if a stock number is set).
// The order's paid_at is claimed first, so the same order can never take stock twice.
async function claimPaidAndTakeStock(sb: (p: string, i?: RequestInit) => Promise<Response>, ref: string, model: string, test: boolean) {
  const c = await sb(`orders?ref=eq.${encodeURIComponent(ref)}&paid_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ paid_at: new Date().toISOString() }) });
  const won = c.ok && (await c.json()).length === 1;
  if (!won || test || model === "trial") return;
  const r = await sb(`products?key=eq.${encodeURIComponent(model)}&select=stock`, { headers: { Prefer: "" } });
  const row = r.ok ? (await r.json())[0] : null;
  if (row && row.stock != null && row.stock > 0)
    await sb(`products?key=eq.${encodeURIComponent(model)}&stock=eq.${row.stock}`, { method: "PATCH", body: JSON.stringify({ stock: row.stock - 1, updated_at: new Date().toISOString() }) });
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : null) || null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, "") || "/";
  const sbUrl = Deno.env.get("SUPABASE_URL")!, sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = (path: string, init: RequestInit = {}) =>
    fetch(`${sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });

  if (route === "/status" && req.method === "GET") {
    const ref = url.searchParams.get("ref") ?? "";
    if (!/^AV-[A-Z0-9]{6}$/.test(ref)) return json(req, { status: "unknown" }, 400);
    const r = await sb(`orders?ref=eq.${ref}&select=ziina_status,ziina_intent_id,paid_at,model,test`, { headers: { Prefer: "" } });
    const o = r.ok ? (await r.json())[0] : null;
    if (!o) return json(req, { status: "unknown" });
    let st: string | null = o.ziina_status;
    if (st !== "completed" && o.ziina_intent_id && Deno.env.get("ZIINA_API_KEY")) {
      const z = await fetch(`https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(o.ziina_intent_id)}`, { headers: { Authorization: `Bearer ${Deno.env.get("ZIINA_API_KEY")}` } });
      if (z.ok) {
        const pi = await z.json();
        if (pi.status && pi.status !== st) {
          st = pi.status;
          const patch: Record<string, unknown> = { ziina_status: st, status_checked_at: new Date().toISOString() };
          await sb(`orders?ref=eq.${ref}`, { method: "PATCH", body: JSON.stringify(patch) });
          if (st === "completed" && !o.paid_at) await claimPaidAndTakeStock(sb, ref, o.model, o.test);
        }
      }
    }
    const status = st === "completed" ? "paid" : st === "failed" || st === "canceled" ? "failed" : "pending";
    return json(req, { status }, 200, { "cache-control": "no-store" });
  }

  if (route === "/collect" && req.method === "POST") {
    const b = await req.json().catch(() => null);
    if (!b || !EVENTS.has(b.event) || typeof b.session !== "string" || !/^[a-z0-9]{8,40}$/.test(b.session)) return json(req, { ok: false }, 400);
    const ua = req.headers.get("user-agent") ?? "";
    const row = {
      session: b.session, event: b.event, model: s(b.model, 30), option_group: s(b.option_group, 40), option: s(b.option, 60),
      value: Number.isFinite(b.value) ? Math.round(b.value) : null, ref: /^AV-[A-Z0-9]{6}$/.test(b.ref ?? "") ? b.ref : null,
      path: s(b.path, 120), referrer: s(b.referrer, 120), utm_source: s(b.utm_source, 60), utm_campaign: s(b.utm_campaign, 80),
      device: /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop",
    };
    const r = await sb("events", { method: "POST", body: JSON.stringify(row) });
    return json(req, { ok: r.ok }, r.ok ? 200 : 500);
  }

  if (route === "/catalog" && req.method === "GET") {
    const r = await sb("products?select=key,price_aed,extra_strap_aed,active,stock,tiers&order=sort", { headers: { Prefer: "" } });
    const rows = r.ok ? await r.json() : [];
    return json(req, { products: rows }, 200, { "cache-control": "public, max-age=60" });
  }

  return json(req, { error: "not found" }, 404);
});
