// AVENOIR order confirmation email (Arabic + English in one message). Sent once, after the payment is verified.
// Needs RESEND_API_KEY and MAIL_FROM (e.g. "AVENOIR <orders@avenoirlab.com>") as Supabase secrets. Without them nothing is sent.
const NAMES: Record<string, [string, string]> = { monti: ["MONTI", "مونتي"], lumi: ["LUMI", "لومي"], rayo: ["RAYO", "رايو"], bloom: ["BLOOM", "بلوم"] };
const OPT: Record<string, [string, string]> = {
  bracelet: ["Steel bracelet", "سوار ستيل"], black: ["Black leather", "جلد أسود"], brown: ["Cognac leather", "جلد بني"], navy: ["Navy leather", "جلد كحلي"],
  green: ["Green leather", "جلد أخضر"], cream: ["Ivory leather", "جلد عاجي"], white: ["White leather", "جلد أبيض"], blue: ["Blue hands", "عقارب زرقاء"], silver: ["Silver hands", "عقارب فضية"],
  standard: ["Standard", "Standard"],
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export type MailOrder = { ref: string; model: string; options: Record<string, unknown>; extras: string[]; amount_aed: number; customer_name: string | null; customer_email: string | null };

export function orderEmail(o: MailOrder): { subject: string; html: string; text: string } {
  const [en, ar] = NAMES[o.model] ?? [o.model.toUpperCase(), o.model];
  const opts = Object.entries(o.options).filter(([k]) => k !== "staging").map(([, v]) => OPT[String(v)] ?? [String(v), String(v)]);
  const xs = (o.extras ?? []).map((x) => OPT[x] ?? [x, x]);
  const lineEn = [...opts.map((x) => x[0]), ...xs.map((x) => `+ second strap: ${x[0]}`)].join(" · ");
  const lineAr = [...opts.map((x) => x[1]), ...xs.map((x) => `+ سير ثانٍ: ${x[1]}`)].join(" · ");
  const amt = o.amount_aed.toLocaleString("en-US");
  const subject = `AVENOIR · طلبك ${o.ref} · Your order ${o.ref}`;
  const td = 'style="padding:6px 0;border-bottom:1px solid #ddd6c8"';
  const block = (dir: "rtl" | "ltr", h: string, hi: string, rows: [string, string][], after: string[]) => `
  <div dir="${dir}" style="text-align:${dir === "rtl" ? "right" : "left"};font:15px/1.7 ${dir === "rtl" ? "Tahoma,Arial" : "Helvetica,Arial"},sans-serif;color:#3f3a35">
    <h2 style="font:400 24px/1.3 Georgia,serif;color:#111;margin:0 0 6px">${h}</h2><p style="margin:0 0 14px">${hi}</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows.map(([a, b]) => `<tr><td ${td} style="white-space:nowrap;padding:6px 12px 6px 0;border-bottom:1px solid #ddd6c8">${a}</td><td ${td} align="${dir === "rtl" ? "left" : "right"}"><b style="color:#111">${b}</b></td></tr>`).join("")}</table>
    ${after.map((p) => `<p style="margin:12px 0 0">${p}</p>`).join("")}
  </div>`;
  const name = esc(o.customer_name?.split(" ")[0] ?? "");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:24px 12px">
<div style="max-width:560px;margin:0 auto;background:#fbfaf7;border:1px solid #ddd6c8;padding:28px 24px">
  <div style="text-align:center;font:400 18px/1 Georgia,serif;letter-spacing:.4em;color:#111;margin-bottom:22px">AVENOIR</div>
  ${block("rtl", "تم استلام طلبك", `أهلاً ${name}، شكراً لطلبك. تم تأكيد الدفع.`, [["رقم الطلب", esc(o.ref)], ["الساعة", `${ar} · ${esc(lineAr)}`], ["المبلغ المدفوع", `${amt} درهم`]],
    ["نجمّع ساعتك في الإمارات الآن، ونتواصل معك على جوالك لترتيب موعد التوصيل. [مدة التوصيل: بعد اعتمادها]", "لأي سؤال راسلنا على إنستغرام <b>@avenoir.watches</b> واذكر رقم الطلب."])}
  <hr style="border:0;border-top:1px solid #111;margin:24px 0">
  ${block("ltr", "Your order is confirmed", `Hello ${name}, thank you for your order. Your payment is confirmed.`, [["Order number", esc(o.ref)], ["Watch", `${en} · ${esc(lineEn)}`], ["Amount paid", `AED ${amt}`]],
    ["We are assembling your watch in the UAE and will call your mobile to arrange delivery. [Delivery time: after approval]", "Questions? Message us on Instagram <b>@avenoir.watches</b> with your order number."])}
  <p style="margin:26px 0 0;text-align:center;font:12px/1.6 Arial,sans-serif;color:#6b645b">AVENOIR · Al Ain, UAE · avenoirlab.com</p>
</div></body></html>`;
  const text = `AVENOIR\n\nتم استلام طلبك ${o.ref}\n${ar} · ${lineAr}\n${amt} درهم\n\nYour order ${o.ref} is confirmed\n${en} · ${lineEn}\nAED ${amt}\n\nInstagram @avenoir.watches`;
  return { subject, html, text };
}

// Sends at most once per order: the caller must first claim email_sent_at (PATCH ... email_sent_at=is.null).
export async function sendOrderEmail(o: MailOrder): Promise<{ sent: boolean; reason: string }> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return { sent: false, reason: "email not set up (RESEND_API_KEY / MAIL_FROM)" };
  if (!o.customer_email || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(o.customer_email)) return { sent: false, reason: "no customer email" };
  const m = orderEmail(o);
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [o.customer_email], subject: m.subject, html: m.html, text: m.text }) });
  return r.ok ? { sent: true, reason: "" } : { sent: false, reason: `resend ${r.status}` };
}
