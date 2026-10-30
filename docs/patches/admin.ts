// AVENOIR admin API, used by admin.html on the website. Every request needs the owner's password in the
// "x-admin-key" header, compared with the ADMIN_KEY secret (set in Supabase → Edge Functions → Secrets).
// Without ADMIN_KEY set, everything is refused.
//   {action:"orders"}                                    → newest 200 orders with delivery details
//   {action:"set_fulfillment", ref, status}              → new | preparing | shipped | delivered | cancelled
//   {action:"products"}                                  → products
//   {action:"update_product", key, price_aed?, extra_strap_aed?, active?, stock?}
const ORIGINS = ["https://avenoirlab.com", "https://www.avenoirlab.com", "https://avenoir911-cloud.github.io", "http://localhost:8811"];
const STATUSES = ["new", "preparing", "shipped", "delivered", "cancelled"];

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, x-admin-key", "Vary": "Origin" };
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(req) } });

async function same(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y); let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method" }, 405);
  const key = Deno.env.get("ADMIN_KEY") ?? "";
  if (key.length < 8) return json(req, { error: "Admin password not set up yet." }, 503);
  if (!(await same(req.headers.get("x-admin-key") ?? "", key))) {
    await new Promise((r) => setTimeout(r, 900));
    return json(req, { error: "Wrong password." }, 401);
  }
  const b = await req.json().catch(() => ({}));
  const sbUrl = Deno.env.get("SUPABASE_URL")!, sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = (path: string, init: RequestInit = {}) =>
    fetch(`${sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });

  if (b.action === "orders") {
    const r = await sb("orders?select=ref,created_at,customer_name,customer_phone,customer_email,emirate,address,customer_note,model,options,extras,amount_aed,ziina_status,paid_at,fulfillment_status,test&order=created_at.desc&limit=200");
    return json(req, { orders: r.ok ? await r.json() : [] }, r.ok ? 200 : 500);
  }
  if (b.action === "set_fulfillment") {
    if (!/^AV-[A-Z0-9]{6}$/.test(b.ref ?? "") || !STATUSES.includes(b.status)) return json(req, { error: "bad input" }, 400);
    const r = await sb(`orders?ref=eq.${b.ref}`, { method: "PATCH", body: JSON.stringify({ fulfillment_status: b.status, fulfillment_updated_at: new Date().toISOString() }) });
    return json(req, { ok: r.ok }, r.ok ? 200 : 500);
  }
  if (b.action === "products") {
    const r = await sb("products?select=key,name,price_aed,extra_strap_aed,active,stock,tiers,updated_at&order=sort");
    return json(req, { products: r.ok ? await r.json() : [] }, r.ok ? 200 : 500);
  }
  if (b.action === "update_product") {
    if (!/^[a-z0-9-]{2,30}$/.test(b.key ?? "")) return json(req, { error: "bad key" }, 400);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    if ("price_aed" in b) { if (!(b.price_aed === null || int(b.price_aed, 2, 100000))) return json(req, { error: "bad price" }, 400); patch.price_aed = b.price_aed; }
    if ("extra_strap_aed" in b) { if (!int(b.extra_strap_aed, 0, 10000)) return json(req, { error: "bad strap price" }, 400); patch.extra_strap_aed = b.extra_strap_aed; }
    if ("active" in b) { if (typeof b.active !== "boolean") return json(req, { error: "bad active" }, 400); patch.active = b.active; }
    if ("stock" in b) { if (!(b.stock === null || int(b.stock, 0, 100000))) return json(req, { error: "bad stock" }, 400); patch.stock = b.stock; }
    if ("standard_price_aed" in b) { // MONTI Standard package price (Exclusive cannot be switched on from here)
      if (!int(b.standard_price_aed, 2, 100000)) return json(req, { error: "bad package price" }, 400);
      const cur = await sb(`products?key=eq.${b.key}&select=tiers`, { headers: { Prefer: "" } }); const t = (await cur.json())[0]?.tiers;
      if (!t?.standard) return json(req, { error: "no package" }, 400);
      patch.tiers = { ...t, standard: { ...t.standard, price: b.standard_price_aed } };
    }
    const r = await sb(`products?key=eq.${b.key}`, { method: "PATCH", body: JSON.stringify(patch) });
    return json(req, { ok: r.ok, product: r.ok ? (await r.json())[0] : null }, r.ok ? 200 : 500);
  }
  return json(req, { error: "unknown action" }, 400);
});
