// AVENOIR payment STAGING. Safe test bench for the payment checks before they go into checkout/api/sync-orders.
// - Every Ziina payment it creates has test:true (Ziina: test payments are not charged).
// - Every order row it writes has test=true and options.staging=true, and it refuses to touch any other order.
// - At most 30 staging orders in total, so it cannot fill the orders table.
//   GET ?action=create&m=monti&tier=standard&strap=black&hands=blue[&x=navy]  -> {ref, amount_aed, intent_id, redirect_url}
//   GET ?action=status&ref=AV-XXXXXX   -> asks Ziina, runs verifyIntent, updates the staging order once
//   GET ?action=selftest               -> runs verifyIntent against simulated Ziina answers (no network to Ziina)
const MAX_STAGING_ORDERS = 30;
const EXTRA = 149;
const GROUPS: Record<string, Record<string, string[]>> = {
  monti: { hands: ["blue", "silver"], strap: ["bracelet", "black", "brown", "navy", "green", "cream", "white"] },
};

type Order = { ref: string; amount_aed: number; ziina_intent_id: string | null; paid_at: string | null; test: boolean; options: Record<string, unknown> };
type PI = { id?: string; amount?: number; currency_code?: string; status?: string };

// The one rule set that decides whether a Ziina payment pays a given order.
export function verifyIntent(order: Order, pi: PI): { ok: boolean; paid: boolean; status: string; reason: string } {
  if (!pi || typeof pi !== "object") return { ok: false, paid: false, status: "unknown", reason: "no payment data" };
  if (!order.ziina_intent_id || pi.id !== order.ziina_intent_id) return { ok: false, paid: false, status: "unknown", reason: "payment id does not belong to this order" };
  if (pi.currency_code !== "AED") return { ok: false, paid: false, status: "unknown", reason: `currency ${pi.currency_code}` };
  if (pi.amount !== Math.round(order.amount_aed * 100)) return { ok: false, paid: false, status: "unknown", reason: `amount ${pi.amount} fils, order ${order.amount_aed * 100}` };
  const st = String(pi.status ?? "");
  if (st === "completed") return { ok: true, paid: true, status: "paid", reason: "" };
  if (st === "failed" || st === "canceled") return { ok: true, paid: false, status: "failed", reason: "" };
  return { ok: true, paid: false, status: "pending", reason: "" };
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const newRef = () => "AV-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams, action = q.get("action");
  const sbUrl = Deno.env.get("SUPABASE_URL")!, sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, zKey = Deno.env.get("ZIINA_API_KEY") ?? "";
  const sb = (p: string, i: RequestInit = {}) => fetch(`${sbUrl}/rest/v1/${p}`, { ...i, headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=representation", ...(i.headers ?? {}) } });

  if (action === "selftest") {
    const o: Order = { ref: "AV-TEST00", amount_aed: 948, ziina_intent_id: "pi_1", paid_at: null, test: true, options: {} };
    const cases: [string, PI, string, boolean][] = [
      ["completed, right amount", { id: "pi_1", amount: 94800, currency_code: "AED", status: "completed" }, "paid", true],
      ["completed, amount too low", { id: "pi_1", amount: 79900, currency_code: "AED", status: "completed" }, "unknown", false],
      ["completed, wrong currency", { id: "pi_1", amount: 94800, currency_code: "USD", status: "completed" }, "unknown", false],
      ["completed, other payment id", { id: "pi_2", amount: 94800, currency_code: "AED", status: "completed" }, "unknown", false],
      ["failed", { id: "pi_1", amount: 94800, currency_code: "AED", status: "failed" }, "failed", false],
      ["canceled", { id: "pi_1", amount: 94800, currency_code: "AED", status: "canceled" }, "failed", false],
      ["still waiting (late)", { id: "pi_1", amount: 94800, currency_code: "AED", status: "requires_payment_instrument" }, "pending", false],
      ["pending", { id: "pi_1", amount: 94800, currency_code: "AED", status: "pending" }, "pending", false],
      ["garbage", {} as PI, "unknown", false],
    ];
    const res = cases.map(([name, pi, want, wantPaid]) => { const r = verifyIntent(o, pi); return { name, want, got: r.status, paid: r.paid, pass: r.status === want && r.paid === wantPaid, reason: r.reason }; });
    return json({ passed: res.filter((r) => r.pass).length, of: res.length, res });
  }

  if (action === "create") {
    const m = q.get("m") ?? "", groups = GROUPS[m]; if (!groups) return json({ error: "model" }, 400);
    const chosen: Record<string, unknown> = {};
    for (const [g, opts] of Object.entries(groups)) { const v = q.get(g) ?? opts[0]; if (!opts.includes(v)) return json({ error: `bad ${g}` }, 400); chosen[g] = v; }
    const xs = (q.get("x") ?? "").split(",").filter(Boolean);
    const pr = await sb(`products?key=eq.${m}&select=tiers`, { headers: { Prefer: "" } }); const row = (await pr.json())[0];
    const tier = q.get("tier") ?? "standard", t = row?.tiers?.[tier];
    if (!t || t.enabled !== true) return json({ error: "package not available" }, 400);
    for (const [g, a] of Object.entries(t.allow ?? {}) as [string, string[]][]) if (!a.includes(String(chosen[g]))) return json({ error: `not in package: ${g}` }, 400);
    if (xs.length > (t.max_extras ?? 1) || xs.some((x) => x === chosen.strap || x === "bracelet" || !groups.strap.includes(x))) return json({ error: "extra strap" }, 400);
    const cnt = await sb(`orders?select=ref&options->>staging=eq.true`, { headers: { Prefer: "count=exact", Range: "0-0" } });
    if (Number((cnt.headers.get("content-range") ?? "*/0").split("/")[1]) >= MAX_STAGING_ORDERS) return json({ error: "staging limit reached" }, 429);
    const amount = t.price + xs.length * EXTRA, ref = newRef();
    const ins = await sb("orders", { method: "POST", body: JSON.stringify({ ref, model: m, options: { ...chosen, tier, staging: true }, extras: xs, amount_aed: amount, test: true, customer_name: "STAGING TEST" }) });
    if (!ins.ok) return json({ error: "insert", detail: await ins.text() }, 500);
    const zr = await fetch("https://api-v2.ziina.com/api/payment_intent", { method: "POST", headers: { Authorization: `Bearer ${zKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount * 100, currency_code: "AED", message: `AVENOIR STAGING ${ref}`, test: true,
        success_url: `https://avenoirlab.com/preview/#paid-${ref}`, cancel_url: "https://avenoirlab.com/preview/", failure_url: "https://avenoirlab.com/preview/#failed" }) });
    const pi = await zr.json().catch(() => ({}));
    if (!zr.ok) return json({ error: "ziina", status: zr.status, pi }, 502);
    await sb(`orders?ref=eq.${ref}`, { method: "PATCH", body: JSON.stringify({ ziina_intent_id: pi.id, ziina_status: pi.status }) });
    return json({ ref, amount_aed: amount, intent_id: pi.id, intent_amount: pi.amount, currency: pi.currency_code, status: pi.status, redirect_url: pi.redirect_url });
  }

  if (action === "status") {
    const ref = q.get("ref") ?? ""; if (!/^AV-[A-Z0-9]{6}$/.test(ref)) return json({ error: "ref" }, 400);
    const r = await sb(`orders?ref=eq.${ref}&test=eq.true&options->>staging=eq.true&select=ref,amount_aed,ziina_intent_id,paid_at,test,options,ziina_status`, { headers: { Prefer: "" } });
    const o = (await r.json())[0] as Order | undefined; if (!o) return json({ error: "not a staging order" }, 404);
    const z = await fetch(`https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(o.ziina_intent_id ?? "")}`, { headers: { Authorization: `Bearer ${zKey}` } });
    const pi = z.ok ? await z.json() : null;
    const v = verifyIntent(o, pi ?? {});
    let claimed = false;
    if (v.ok) {
      await sb(`orders?ref=eq.${ref}`, { method: "PATCH", body: JSON.stringify({ ziina_status: pi.status, status_checked_at: new Date().toISOString() }) });
      if (v.paid) { // claim once: a repeated or late notification cannot mark it paid twice
        const c = await sb(`orders?ref=eq.${ref}&paid_at=is.null`, { method: "PATCH", body: JSON.stringify({ paid_at: new Date().toISOString() }) });
        claimed = c.ok && (await c.json()).length === 1;
      }
    }
    return json({ ref, verify: v, ziina: pi && { id: pi.id, status: pi.status, amount: pi.amount, currency: pi.currency_code }, order_amount_fils: o.amount_aed * 100, first_time_marked_paid: claimed });
  }
  return json({ error: "action" }, 400);
});
