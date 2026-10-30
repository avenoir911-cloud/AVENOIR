// AVENOIR sync-orders: asks Ziina for the current status of recent unfinished orders and records it.
// When an order becomes paid, it also sends one Purchase event to the Meta Conversions API
// (event_id = order ref, so Meta merges it with the browser Pixel event instead of counting twice).
// Called every 2 minutes by pg_cron (see migration "order_status_cron"). Returns counts only, never order data.
const FINAL = ["completed", "failed", "canceled"];
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") ?? "1465681438668900";
const META_API = "https://graph.facebook.com/v26.0";

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

type Order = {
  ref: string; model: string; amount_aed: number; test: boolean; ziina_intent_id: string | null; ziina_status: string | null;
  paid_at: string | null; client_ip: string | null; client_ua: string | null; fbp: string | null; fbc: string | null; capi_sent_at: string | null;
};

Deno.serve(async () => {
  const apiKey = Deno.env.get("ZIINA_API_KEY");
  if (!apiKey) return new Response("not configured", { status: 503 });
  const sbUrl = Deno.env.get("SUPABASE_URL")!, sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = (path: string, init: RequestInit = {}) =>
    fetch(`${sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });
  const cols = "ref,model,amount_aed,test,ziina_intent_id,ziina_status,paid_at,client_ip,client_ua,fbp,fbc,capi_sent_at";

  // 1) refresh Ziina status of recent unfinished orders
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const q = `orders?select=${cols}&ziina_intent_id=not.is.null&created_at=gte.${since}` +
    `&or=(ziina_status.is.null,ziina_status.not.in.(${FINAL.join(",")}))&order=created_at.desc&limit=50`;
  const r = await sb(q, { headers: { Prefer: "" } });
  if (!r.ok) return new Response("db error", { status: 500 });
  const rows: Order[] = await r.json();

  let changed = 0;
  for (const o of rows) {
    const z = await fetch(`https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(o.ziina_intent_id!)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!z.ok) continue;
    const pi = await z.json();
    if (pi.id !== o.ziina_intent_id || pi.currency_code !== "AED" || pi.amount !== Math.round(o.amount_aed * 100)) { console.error("payment mismatch", o.ref); continue; }
    const patch: Record<string, unknown> = { status_checked_at: new Date().toISOString() };
    if (pi.status && pi.status !== o.ziina_status) { patch.ziina_status = pi.status; changed++; }
    await sb(`orders?ref=eq.${encodeURIComponent(o.ref)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (pi.status === "completed" && !o.paid_at) await claimPaidAndTakeStock(sb, o.ref, o.model, o.test);
  }

  // 2) Meta Conversions API: real (non-test) paid orders not sent yet, from the last 7 days (Meta's limit)
  let sent = 0;
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (token) {
    const weekAgo = new Date(Date.now() - 7 * 864e5 + 3600e3).toISOString();
    const pr = await sb(`orders?select=${cols}&ziina_status=eq.completed&test=eq.false&model=neq.trial&capi_sent_at=is.null&paid_at=gte.${weekAgo}&limit=50`, { headers: { Prefer: "" } });
    const paid: Order[] = pr.ok ? await pr.json() : [];
    const site = (Deno.env.get("SITE_URL") ?? "https://avenoir911-cloud.github.io/AVENOIR/").replace(/#.*$/, "");
    const testCode = Deno.env.get("META_TEST_EVENT_CODE");
    for (const o of paid) {
      const user_data: Record<string, unknown> = {};
      if (o.client_ip) user_data.client_ip_address = o.client_ip;
      if (o.client_ua) user_data.client_user_agent = o.client_ua;
      if (o.fbp) user_data.fbp = o.fbp;
      if (o.fbc) user_data.fbc = o.fbc;
      const body: Record<string, unknown> = {
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(new Date(o.paid_at!).getTime() / 1000),
          event_id: o.ref,
          action_source: "website",
          event_source_url: site,
          user_data,
          custom_data: { currency: "AED", value: o.amount_aed, content_ids: [o.model], content_type: "product", order_id: o.ref, num_items: 1 },
        }],
      };
      if (testCode) body.test_event_code = testCode;
      const m = await fetch(`${META_API}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const txt = await m.text();
      const patch = m.ok ? { capi_sent_at: new Date().toISOString(), capi_error: null } : { capi_error: `${m.status} ${txt.slice(0, 300)}` };
      if (m.ok) sent++;
      await sb(`orders?ref=eq.${encodeURIComponent(o.ref)}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
  }
  return new Response(JSON.stringify({ checked: rows.length, changed, capi_sent: sent }), { headers: { "content-type": "application/json" } });
});
