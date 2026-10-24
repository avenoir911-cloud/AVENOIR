/* AVENOIR delivery details step.
   "Buy now" opens this form; it is sent to the checkout function as a POST (never in a URL),
   and checkout then redirects to Ziina. Works in English and Arabic (follows the page language). */
(() => {
  const CHECKOUT = 'https://uktmzygjaqnkizamrvij.supabase.co/functions/v1/checkout';
  const EMIRATES = [
    ['Abu Dhabi', 'أبوظبي'], ['Al Ain', 'العين'], ['Dubai', 'دبي'], ['Sharjah', 'الشارقة'], ['Ajman', 'عجمان'],
    ['Umm Al Quwain', 'أم القيوين'], ['Ras Al Khaimah', 'رأس الخيمة'], ['Fujairah', 'الفجيرة'],
  ];
  const T = {
    en: { h: 'Delivery details', sub: 'We assemble your watch after you order and deliver it across the UAE.', name: 'Full name', phone: 'Mobile number', emirate: 'Emirate', choose: 'Choose…', address: 'Delivery address', addressPh: 'Area, street, building / villa', email: 'Email (optional)', note: 'Note (optional)', pay: 'Continue to payment', back: 'Back', privacy: 'We only use these details to deliver your order.', privacyLink: 'Privacy', errName: 'Please enter your name.', errPhone: 'Please enter a valid mobile number, e.g. 05X XXX XXXX.', errEmirate: 'Please choose your emirate.', errAddress: 'Please enter your delivery address.', errEmail: 'Please check your email.', total: 'Total' },
    ar: { h: 'بيانات التوصيل', sub: 'نجمّع ساعتك بعد الطلب ونوصلها لكل الإمارات.', name: 'الاسم الكامل', phone: 'رقم الجوال', emirate: 'الإمارة', choose: 'اختر…', address: 'عنوان التوصيل', addressPh: 'المنطقة، الشارع، البناية / الفيلا', email: 'البريد الإلكتروني (اختياري)', note: 'ملاحظة (اختياري)', pay: 'متابعة للدفع', back: 'رجوع', privacy: 'نستخدم هذه البيانات فقط لتوصيل طلبك.', privacyLink: 'الخصوصية', errName: 'اكتب اسمك.', errPhone: 'اكتب رقم جوال صحيح، مثل 05X XXX XXXX.', errEmirate: 'اختر الإمارة.', errAddress: 'اكتب عنوان التوصيل.', errEmail: 'تأكد من البريد الإلكتروني.', total: 'المجموع' },
  };
  const lang = () => (document.documentElement.lang || '').startsWith('ar') || document.dir === 'rtl' ? 'ar' : 'en';
  const privacyHref = (document.querySelector('link[rel="privacy-policy"]')?.getAttribute('href')) || 'privacy.html';

  const css = `
.co{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(17,17,17,.45);padding:16px}
.co[hidden]{display:none}
.co-card{background:var(--ivory,#f4f1ea);color:var(--ink,#111);width:100%;max-width:520px;max-height:calc(100vh - 32px);overflow:auto;padding:clamp(22px,4vw,40px);display:grid;gap:14px;box-shadow:0 30px 80px rgba(0,0,0,.25)}
.co-card h2{font:400 clamp(26px,4vw,34px)/1.1 var(--serif,Georgia,serif);margin:0}
.co-card p.sub{margin:0;color:#555;font-size:14px;line-height:1.5}
.co-sum{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--hair,#ddd6c8);border-bottom:1px solid var(--hair,#ddd6c8);padding:12px 0;font-size:14px}
.co-sum b{font-weight:500}
.co label{display:grid;gap:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#555}
[dir=rtl] .co label{letter-spacing:0;text-transform:none;font-size:13px}
.co input,.co select,.co textarea{font:16px/1.4 inherit;font-family:inherit;color:#111;background:#fff;border:1px solid #d9d2c3;border-radius:0;padding:12px 14px;width:100%;box-sizing:border-box;text-transform:none;letter-spacing:0}
.co textarea{min-height:64px;resize:vertical}
.co input:focus,.co select:focus,.co textarea:focus{outline:2px solid #111;outline-offset:1px}
.co .err{color:#9b1c1c;font-size:13px;min-height:1em;margin:0}
.co-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){.co-row{grid-template-columns:1fr}}
.co-actions{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center}
.co-actions .btn{width:100%}
.co .tl{background:none;border:0;padding:8px 0;color:#111;text-decoration:underline;cursor:pointer;font:inherit}
.co small{color:#666;font-size:12px}
.co small a{color:inherit}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);

  const box = document.createElement('div');
  box.className = 'co'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'co-h');
  box.innerHTML = `<form class="co-card" id="co-form" method="post" action="${CHECKOUT}" target="_blank" novalidate>
    <h2 id="co-h"></h2><p class="sub" data-k="sub"></p>
    <div class="co-sum"><span id="co-what"></span><b id="co-total"></b></div>
    <label><span data-k="name"></span><input name="name" autocomplete="name" required maxlength="80"></label>
    <div class="co-row">
      <label><span data-k="phone"></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" dir="ltr" placeholder="05X XXX XXXX"></label>
      <label><span data-k="emirate"></span><select name="emirate" required></select></label>
    </div>
    <label><span data-k="address"></span><textarea name="address" autocomplete="street-address" required maxlength="300"></textarea></label>
    <div class="co-row">
      <label><span data-k="email"></span><input name="email" type="email" autocomplete="email" maxlength="120" dir="ltr"></label>
      <label><span data-k="note"></span><input name="note" maxlength="300"></label>
    </div>
    <p class="err" id="co-err" role="alert"></p>
    <div class="co-actions"><button type="button" class="tl" id="co-back"></button><button type="submit" class="btn" id="co-pay"></button></div>
    <small><span data-k="privacy"></span> <a href="${privacyHref}" target="_blank" rel="noopener" data-k="privacyLink"></a></small>
    <div id="co-hidden"></div>
  </form>`;
  document.body.append(box);
  const form = box.querySelector('form'), err = box.querySelector('#co-err');

  function texts() {
    const t = T[lang()];
    box.querySelector('#co-h').textContent = t.h;
    box.querySelectorAll('[data-k]').forEach(n => { n.textContent = t[n.dataset.k]; });
    box.querySelector('#co-back').textContent = t.back; box.querySelector('#co-pay').textContent = t.pay;
    form.address.placeholder = t.addressPh;
    const sel = form.emirate, cur = sel.value;
    sel.replaceChildren(new Option(t.choose, ''), ...EMIRATES.map(([en, ar]) => new Option(lang() === 'ar' ? ar : en, en)));
    sel.value = cur;
  }

  let lastFocus = null;
  function open(href) {
    let u; try { u = new URL(href); } catch (e) { return false; }
    const hid = box.querySelector('#co-hidden'); hid.replaceChildren();
    u.searchParams.forEach((v, k) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; hid.append(i); });
    texts();
    box.querySelector('#co-what').textContent = document.getElementById('pv-name')?.textContent || '';
    box.querySelector('#co-total').textContent = document.getElementById('pv-total')?.textContent || '';
    err.textContent = '';
    try { const saved = JSON.parse(localStorage.getItem('avn_details') || 'null'); if (saved) ['name', 'phone', 'emirate', 'address', 'email'].forEach(k => { if (saved[k] && !form[k].value) form[k].value = saved[k]; }); } catch (e) {}
    lastFocus = document.activeElement; box.hidden = false; document.body.style.overflow = 'hidden';
    (form.name.value ? form.phone : form.name).focus();
    return true;
  }
  function close() { box.hidden = true; if (document.getElementById('pv')?.hidden !== false) document.body.style.overflow = ''; lastFocus?.focus?.(); }
  window.avnOpenOrder = open;

  document.addEventListener('click', e => {
    const buy = e.target.closest('#pv-buy, #mbar-buy');
    if (!buy) return;
    e.preventDefault();
    setTimeout(() => open(buy.href), 0); // after tracking has added the Meta ids to the link
  });
  box.querySelector('#co-back').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { e.stopImmediatePropagation(); close(); } }, true);

  form.addEventListener('submit', e => {
    const t = T[lang()];
    const v = k => (form[k].value || '').trim();
    const digits = v('phone').replace(/[^\d+]/g, '');
    let msg = '', bad = null;
    if (v('name').length < 2) { msg = t.errName; bad = form.name; }
    else if (!/^(\+?\d{8,15}|05\d{8}|5\d{8})$/.test(digits.replace(/^00/, '+'))) { msg = t.errPhone; bad = form.phone; }
    else if (!v('emirate')) { msg = t.errEmirate; bad = form.emirate; }
    else if (v('address').length < 5) { msg = t.errAddress; bad = form.address; }
    else if (v('email') && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('email'))) { msg = t.errEmail; bad = form.email; }
    if (msg) { e.preventDefault(); err.textContent = msg; bad.focus(); return; }
    try { localStorage.setItem('avn_details', JSON.stringify({ name: v('name'), phone: v('phone'), emirate: v('emirate'), address: v('address'), email: v('email') })); } catch (er) {}
    window.dispatchEvent(new CustomEvent('avn:checkout'));
    setTimeout(close, 300);
  });
})();
