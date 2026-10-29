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
    en: { s1: '1 Delivery', s2: '2 Payment', more: 'Add email or a note (optional)', ziina: 'Secured by Ziina', incl: 'Strap and UAE delivery included', t1: 'Delivered in 2–3 weeks, free', t2: '1-year warranty on the movement', t3: 'Card or Apple Pay via Ziina', t4: 'We call you to arrange delivery', payTo: 'Continue to payment', h: 'Where should we deliver?', sub: 'We assemble your watch after you order and deliver it across the UAE.', name: 'Full name', phone: 'Mobile number', emirate: 'Emirate', choose: 'Choose…', address: 'Delivery address', addressPh: 'Area, street, building / villa', email: 'Email', note: 'Note', pay: 'Continue to payment', back: 'Back', privacy: 'We only use these details to deliver your order.', privacyLink: 'Privacy', errName: 'Please enter your name.', errPhone: 'Please enter a valid mobile number, e.g. 05X XXX XXXX.', errEmirate: 'Please choose your emirate.', errAddress: 'Please enter your delivery address.', errEmail: 'Please check your email.', total: 'Total' },
    ar: { s1: '١ التوصيل', s2: '٢ الدفع', more: 'أضف بريدك أو ملاحظة (اختياري)', ziina: 'دفع آمن عبر Ziina', incl: 'السير والتوصيل داخل الإمارات ضمن السعر', t1: 'التوصيل خلال 2–3 أسابيع، مجاناً', t2: 'ضمان لمدة سنة على الحركة', t3: 'بطاقة أو Apple Pay عبر Ziina', t4: 'نتواصل معك لترتيب التوصيل', payTo: 'متابعة للدفع الآمن', h: 'أين نوصل ساعتك؟', sub: 'نجمّع ساعتك بعد الطلب ونوصلها لكل الإمارات.', name: 'الاسم الكامل', phone: 'رقم الجوال', emirate: 'الإمارة', choose: 'اختر…', address: 'عنوان التوصيل', addressPh: 'المنطقة، الشارع، البناية / الفيلا', email: 'البريد الإلكتروني', note: 'ملاحظة', pay: 'متابعة للدفع', back: 'رجوع', privacy: 'نستخدم هذه البيانات فقط لتوصيل طلبك.', privacyLink: 'الخصوصية', errName: 'اكتب اسمك.', errPhone: 'اكتب رقم جوال صحيح، مثل 05X XXX XXXX.', errEmirate: 'اختر الإمارة.', errAddress: 'اكتب عنوان التوصيل.', errEmail: 'تأكد من البريد الإلكتروني.', total: 'الإجمالي' },
  };
  const lang = () => (document.documentElement.lang || '').startsWith('ar') || document.dir === 'rtl' ? 'ar' : 'en';
  const privacyHref = (document.querySelector('link[rel="privacy-policy"]')?.getAttribute('href')) || 'privacy.html';

  const css = `
.co{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(17,17,17,.5);padding:16px}
.co[hidden]{display:none}
.co-card{background:var(--ivory,#f4f1ea);color:var(--ink,#111);width:100%;max-width:560px;max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;padding:clamp(20px,4vw,36px);display:grid;gap:16px;box-shadow:0 30px 80px rgba(0,0,0,.28)}
@media(max-width:600px){.co{padding:0;place-items:end stretch}.co-card{max-width:none;max-height:94dvh;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px))}}
.co-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.co-steps{display:flex;gap:8px;align-items:center;font:500 12px/1 var(--sans,Arial);letter-spacing:.1em;text-transform:uppercase;color:#6b645b}
[dir=rtl] .co-steps{font:600 13px/1 var(--ar,Tahoma);letter-spacing:0;text-transform:none}
.co-steps b{color:#111}.co-steps i{width:18px;height:1px;background:#bdb5a7}
.co-x{width:44px;height:44px;display:grid;place-items:center;background:none;border:0;cursor:pointer;color:#111;font-size:26px;line-height:1}
.co-card h2{font:400 clamp(26px,4vw,32px)/1.15 var(--serif,Georgia,serif);margin:0}
[dir=rtl] .co-card h2{font-family:var(--arh,serif)}
.co-order{display:grid;grid-template-columns:76px 1fr;gap:14px;align-items:center;background:var(--paper,#fbfaf7);border:1px solid var(--hair,#d9d1c3);padding:10px}
.co-order .ph{width:76px;height:76px;background:var(--ivory,#f4f1ea);overflow:hidden}
.co-order .ph img{width:100%;height:100%;object-fit:contain}
.co-order .tx{display:grid;gap:4px;min-width:0}
.co-order .nm{font:500 15px/1.35 var(--sans,Arial);color:#111}
[dir=rtl] .co-order .nm{font-family:var(--ar,Tahoma);font-weight:600}
.co-order .op{font-size:13.5px;color:#5f5850;line-height:1.4}
.co-tot{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;color:#5f5850;padding:0 2px}
.co-tot b{font:500 22px/1 var(--sans,Arial);color:#111;white-space:nowrap}
[dir=rtl] .co-tot b{font-family:var(--ar,Tahoma);font-weight:600}
.co-tot small{display:block;font-size:12.5px;color:#6b645b;margin-top:2px}
.co label{display:grid;gap:6px;font-size:13px;font-weight:500;color:#3f3a35}
.co input,.co select,.co textarea{font:16px/1.4 inherit;font-family:inherit;color:#111;background:#fff;border:1px solid #cfc7b8;border-radius:0;padding:13px 14px;width:100%;box-sizing:border-box;min-height:48px}
.co textarea{min-height:76px;resize:vertical}
.co input:focus,.co select:focus,.co textarea:focus{outline:2px solid #111;outline-offset:0;border-color:#111}
.co [aria-invalid=true]{border-color:#9b1c1c}
.co .err{color:#9b1c1c;font-size:14px;margin:0}
.co .err:empty{display:none}
.co-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){.co-row{grid-template-columns:1fr}}
.co-more{border-top:1px solid var(--hair,#d9d1c3);padding-top:4px}
.co-more summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:14.5px;color:#111;text-decoration:underline;text-underline-offset:4px;list-style:none}
.co-more summary::-webkit-details-marker{display:none}
.co-more[open] summary{margin-bottom:10px}
.co-trust{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;font-size:13.5px;color:#3f3a35;list-style:none;margin:0;padding:12px 0 0;border-top:1px solid var(--hair,#d9d1c3)}
.co-trust li{display:flex;gap:8px;align-items:flex-start}
.co-trust svg{width:16px;height:16px;flex:none;margin-top:2px;color:var(--navy,#1d2a4a)}
.co .btn{width:100%;min-height:54px;letter-spacing:.06em;white-space:nowrap;padding:0 14px}
.co .btn[disabled]{opacity:.6}
.co-pays{display:flex;justify-content:center;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:#6b645b}
.co small{color:#6b645b;font-size:12.5px;text-align:center}
.co small a{color:inherit}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${d}</svg>`;

  const box = document.createElement('div');
  box.className = 'co'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'co-h');
  box.innerHTML = `<form class="co-card" id="co-form" method="post" action="${CHECKOUT}" target="_blank" novalidate>
    <div class="co-top"><div class="co-steps"><b data-k="s1"></b><i></i><span data-k="s2"></span></div><button type="button" class="co-x" id="co-back">×</button></div>
    <h2 id="co-h"></h2>
    <div class="co-order"><div class="ph" id="co-ph"></div><div class="tx"><span class="nm" id="co-nm"></span><span class="op" id="co-what"></span></div></div>
    <div class="co-tot"><span><span data-k="total"></span><small data-k="incl"></small></span><b id="co-total"></b></div>
    <label><span data-k="name"></span><input name="name" autocomplete="name" required maxlength="80"></label>
    <div class="co-row">
      <label><span data-k="phone"></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" dir="ltr" placeholder="05X XXX XXXX"></label>
      <label><span data-k="emirate"></span><select name="emirate" required></select></label>
    </div>
    <label><span data-k="address"></span><textarea name="address" autocomplete="street-address" required maxlength="300"></textarea></label>
    <details class="co-more"><summary data-k="more"></summary><div class="co-row">
      <label><span data-k="email"></span><input name="email" type="email" autocomplete="email" maxlength="120" dir="ltr"></label>
      <label><span data-k="note"></span><input name="note" maxlength="300"></label>
    </div></details>
    <p class="err" id="co-err" role="alert"></p>
    <button type="submit" class="btn" id="co-pay"></button>
    <div class="co-pays"><span>Apple Pay</span><span>Visa</span><span>Mastercard</span><span data-k="ziina"></span></div>
    <ul class="co-trust">
      <li>${ic('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>')}<span data-k="t1"></span></li>
      <li>${ic('<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>')}<span data-k="t2"></span></li>
      <li>${ic('<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')}<span data-k="t3"></span></li>
      <li>${ic('<path d="M4 5h16v11H8l-4 4z"/>')}<span data-k="t4"></span></li>
    </ul>
    <small><span data-k="privacy"></span> <a href="${privacyHref}" target="_blank" rel="noopener" data-k="privacyLink"></a></small>
    <div id="co-hidden"></div>
  </form>`;
  document.body.append(box);
  const form = box.querySelector('form'), err = box.querySelector('#co-err'), pay = box.querySelector('#co-pay');

  function texts() {
    const t = T[lang()];
    box.querySelector('#co-h').textContent = t.h;
    box.querySelectorAll('[data-k]').forEach(n => { n.textContent = t[n.dataset.k]; });
    box.querySelector('#co-back').setAttribute('aria-label', t.back);
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
    pay.disabled = false; pay.removeAttribute('aria-busy');
    const tot = document.getElementById('pv-total')?.textContent || '';
    box.querySelector('#co-total').textContent = tot;
    const sum = (document.getElementById('pv-buy')?.dataset.summary || '').split(' · ');
    box.querySelector('#co-nm').textContent = sum[0] || document.getElementById('pv-name')?.textContent || '';
    box.querySelector('#co-what').textContent = sum.slice(1).join(' · ');
    const src = document.querySelector('#track .slide img')?.currentSrc; const ph = box.querySelector('#co-ph'); ph.replaceChildren();
    if (src) { const im = new Image(); im.src = src; im.alt = ''; ph.append(im); }
    pay.textContent = `${T[lang()].payTo} · ${tot}`;
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
    form.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
    if (msg) { e.preventDefault(); err.textContent = msg; bad.setAttribute('aria-invalid', 'true'); if (bad.closest('details')) bad.closest('details').open = true; bad.focus(); return; }
    try { localStorage.setItem('avn_details', JSON.stringify({ name: v('name'), phone: v('phone'), emirate: v('emirate'), address: v('address'), email: v('email') })); } catch (er) {}
    // one order per tap: a second tap while the payment page is opening does nothing
    if (pay.disabled) { e.preventDefault(); return; }
    pay.disabled = true; pay.setAttribute('aria-busy', 'true'); pay.textContent = lang() === 'ar' ? 'جارٍ فتح صفحة الدفع…' : 'Opening payment…';
    window.dispatchEvent(new CustomEvent('avn:checkout'));
    setTimeout(close, 300);
  });
})();
