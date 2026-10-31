/* AVENOIR tracking (v8): nothing is measured until the visitor chooses "Accept analytics" in the consent banner.
   "Necessary only" (or no choice) = no Meta Pixel, no AVENOIR analytics, nothing kept for analytics in the browser;
   the shop and the order work exactly the same either way. The choice is kept in localStorage (avn-consent)
   and can be changed from the footer link. Meta Pixel loads after consent, when the browser is idle, so it never
   delays the page.
   Meta Pixel loads only when META_PIXEL_ID is filled in. Until then events are only kept in
   window.dataLayer (so GA4 / TikTok can be plugged in later without touching the shop code).
   Every event is also stored in AVENOIR's own database (/api/collect) for the dashboard.
   No personal data is ever sent from here: only model, options, price and order reference. */
(() => {
  const META_PIXEL_ID = '1465681438668900'; // Meta dataset (Pixel) ID for avenoir.watches, business 733073342985949 (the dataset is *named* 1248708300606989)
  const CURRENCY = 'AED';

  window.dataLayer = window.dataLayer || [];
  let fbqReady = false, on = false;
  const getC = () => { try { return localStorage.getItem('avn-consent'); } catch (e) { return null; } };
  function loadPixel() {
  if (/^\d{10,20}$/.test(META_PIXEL_ID)) {
    /* standard Meta Pixel base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
    fbqReady = true;
  }
  }

  /* first-party analytics: random per-visit id, where the visit came from */
  const API = 'https://uktmzygjaqnkizamrvij.supabase.co/functions/v1/api';
  const ss = (k, make) => { try { let v = sessionStorage.getItem(k); if (!v) { v = make(); sessionStorage.setItem(k, v); } return v; } catch (e) { return make(); } };
  let session = '', src = {};
  const startSession = () => { session = ss('avn_sid', () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join(''));
  src = JSON.parse(ss('avn_src', () => { const q = new URLSearchParams(location.search); let ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {} if (ref === location.hostname) ref = ''; return JSON.stringify({ referrer: ref, utm_source: q.get('utm_source') || (q.get('fbclid') ? 'facebook' : ''), utm_campaign: q.get('utm_campaign') || '' }); })); };
  function collect(name, params) {
    const body = { session, event: name, model: params.content_ids?.[0] || null, option_group: params.option_group || null, option: params.option || null,
      value: Number.isFinite(params.value) ? params.value : null, ref: params.order_ref || null, path: location.pathname, ...src };
    try { fetch(API + '/collect', { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => {}); } catch (e) {}
  }

  const STANDARD = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase']);
  function track(name, params = {}, eventID) {
    if (!on) return;   // no consent, no measurement
    window.dataLayer.push({ event: name, ...params, event_id: eventID });
    collect(name, params);
    if (!fbqReady) return;
    const opts = eventID ? { eventID } : undefined;
    if (STANDARD.has(name)) fbq('track', name, params, opts); else fbq('trackCustom', name, params, opts);
  }
  window.avnTrack = track;

  const $ = id => document.getElementById(id);
  const amount = () => { const n = ($('pv-total')?.textContent || '').replace(/[^\d.]/g, ''); return n ? +n : undefined; };
  const model = () => { try { return new URL($('pv-buy').href).searchParams.get('m') || ''; } catch (e) { return ''; } };
  const productParams = () => ({ content_ids: [model()], content_name: $('pv-name')?.textContent || '', content_type: 'product', value: amount(), currency: CURRENCY });

  /* product opened → SelectProduct + ViewContent */
  const pv = $('pv');
  const viewed = () => setTimeout(() => { const p = productParams(); track('SelectProduct', { content_ids: p.content_ids, content_name: p.content_name }); track('ViewContent', p); }, 0);
  if (pv) {
    let wasHidden = pv.hidden;
    new MutationObserver(() => {
      if (wasHidden && !pv.hidden) viewed();
      wasHidden = pv.hidden;
    }).observe(pv, { attributes: true, attributeFilter: ['hidden'] });
  }
  // starts measuring once the visitor accepts; a watch page opened directly (watch/<model>/ or ?w=) counts as a product view
  function start() {
    if (on) return; on = true; startSession();
    const go = () => { loadPixel(); window.dataLayer.push({ event: 'PageView' }); collect('PageView', {}); if (pv && !pv.hidden) viewed(); };
    'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1);
  }

  /* choices inside the product view */
  document.addEventListener('click', e => {
    const sw = e.target.closest('#pv .sw, #pv .chip, #pv .opt');
    if (sw) {
      const extra = sw.classList.contains('chip') || !!sw.closest('#addon-opts');
      const gl = sw.closest('[role=radiogroup]')?.getAttribute('aria-labelledby');
      const group = sw.closest('.sws')?.getAttribute('aria-label') || (gl && document.getElementById(gl)?.textContent) || (extra ? 'Second strap' : '');
      const option = sw.getAttribute('aria-label') || sw.textContent.trim();
      const isStrap = extra || /strap|السير|سير/i.test(group);
      setTimeout(() => track(isStrap ? 'SelectStrap' : 'SelectOption', { content_ids: [model()], option_group: group, option, second_strap: extra || undefined, value: amount(), currency: CURRENCY }), 0);
      return;
    }
    const buy = e.target.closest('#pv-buy, #mbar-buy');
    if (buy && on) {
      // pass Meta's browser ids to checkout so the server-side Purchase matches this visitor
      try {
        const ck = n => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]+)')) || [])[1];
        let fbc = ck('_fbc'); const clid = new URLSearchParams(location.search).get('fbclid');
        if (!fbc && clid) fbc = `fb.1.${Date.now()}.${clid}`;
        const u = new URL(buy.href); const fbp = ck('_fbp');
        if (fbp) u.searchParams.set('fbp', decodeURIComponent(fbp)); if (fbc) u.searchParams.set('fbc', decodeURIComponent(fbc));
        buy.href = u.toString();
      } catch (err) {}
      const p = productParams();
      try { localStorage.setItem('avn_last_checkout', JSON.stringify({ ...p, at: Date.now() })); } catch (err) {}
      track('AddToCart', p);   // "Buy now" opens the delivery-details step
    }
  }, true);
  // delivery details sent → on the way to Ziina
  addEventListener('avn:checkout', () => {
    if (!on) return;
    let p = null; try { p = JSON.parse(localStorage.getItem('avn_last_checkout') || 'null'); } catch (err) {}
    const { at, ...params } = p || productParams();
    track('InitiateCheckout', { ...params, num_items: 1 });
  });

  /* Purchase: only after the server has confirmed the payment with Ziina (the page fires 'avn:paid'),
     once per order; eventID = order ref so Meta merges it with the server-side Conversions API event */
  addEventListener('avn:paid', e => {
    if (!on) return;
    const ref = e.detail?.ref; if (!/^AV-[A-Z0-9]{6}$/.test(ref || '')) return;
    let done = false, last = null;
    try { done = localStorage.getItem('avn_purchase_' + ref) === '1'; last = JSON.parse(localStorage.getItem('avn_last_checkout') || 'null'); } catch (err) {}
    if (done) return;
    const fresh = last && Date.now() - last.at < 6 * 3600e3 ? last : null;
    track('Purchase', fresh ? { content_ids: fresh.content_ids, content_name: fresh.content_name, content_type: 'product', value: fresh.value, currency: CURRENCY, order_ref: ref } : { currency: CURRENCY, order_ref: ref }, ref);
    try { localStorage.setItem('avn_purchase_' + ref, '1'); } catch (err) {}
  });

  /* ---------- consent banner ---------- */
  const TX = { en: { p: 'We use analytics, including Meta Pixel, only if you allow it.', a: 'Accept analytics', n: 'Necessary only', l: 'Privacy', s: 'Analytics choice' },
               ar: { p: 'نستخدم أدوات التحليل، ومنها Meta Pixel، فقط إذا سمحت بذلك.', a: 'قبول التحليلات', n: 'الضروري فقط', l: 'الخصوصية', s: 'خيارات التحليلات' } };
  const L = () => (document.documentElement.lang || '').startsWith('ar') ? 'ar' : 'en';
  const st = document.createElement('style');
  st.textContent = `.cc{position:fixed;z-index:65;inset-inline-start:12px;bottom:calc(12px + var(--cc-b,0px) + env(safe-area-inset-bottom,0px));max-width:400px;width:calc(100% - 24px);background:var(--paper,#fbfaf7);color:var(--ink,#111);border:1px solid var(--hair,#d9d1c3);box-shadow:0 12px 40px rgba(17,17,17,.12);padding:12px 14px;display:grid;gap:8px;font-size:13.5px;line-height:1.5}
.cc[hidden]{display:none}.cc p{margin:0;color:var(--body,#3f3a35)}.cc .r{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cc button{min-height:44px;padding:0 14px;border:1px solid var(--ink,#111);font:500 13px/1 var(--sans,Arial);letter-spacing:.04em;cursor:pointer}
[dir=rtl] .cc button{font:600 14px/1 var(--ar,Tahoma);letter-spacing:0}
.cc .y{background:var(--ink,#111);color:var(--ivory,#f4f1ea)}.cc .n{background:transparent;color:var(--ink,#111)}.cc a{color:var(--ink,#111);margin-inline-start:auto;font-size:13.5px}`;
  document.head.append(st);
  const cc = document.createElement('div'); cc.className = 'cc'; cc.setAttribute('role', 'region'); cc.hidden = true;
  cc.innerHTML = '<p></p><div class="r"><button type="button" class="y"></button><button type="button" class="n"></button><a target="_blank" rel="noopener"></a></div>';
  document.body.append(cc);
  const privacy = document.querySelector('link[rel="privacy-policy"]')?.href || 'privacy.html';
  function text() { const t = TX[L()]; cc.setAttribute('aria-label', t.s); cc.querySelector('p').textContent = t.p; cc.querySelector('.y').textContent = t.a; cc.querySelector('.n').textContent = t.n; const a = cc.querySelector('a'); a.textContent = t.l; a.href = privacy; document.querySelectorAll('[data-consent]').forEach(n => n.textContent = t.s); }
  // keep the banner above the watch page's bottom buy bar, so "Buy now" is never covered
  function place() { const bar = document.querySelector('.mbar'); const vis = bar && getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().height > 0 && !document.getElementById('pv')?.hidden; cc.style.setProperty('--cc-b', vis ? bar.offsetHeight + 'px' : '0px'); }
  function choose(c) { try { localStorage.setItem('avn-consent', c); } catch (e) {} cc.hidden = true; if (c === 'analytics') start(); else if (on) location.reload(); }
  cc.querySelector('.y').addEventListener('click', () => choose('analytics'));
  cc.querySelector('.n').addEventListener('click', () => choose('necessary'));
  window.avnConsent = { open() { text(); place(); cc.hidden = false; cc.querySelector('.y').focus(); }, get: getC };
  document.addEventListener('click', e => { const a = e.target.closest('[data-consent]'); if (a) { e.preventDefault(); window.avnConsent.open(); } });
  new MutationObserver(text).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (pv) new MutationObserver(place).observe(pv, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('resize', place, { passive: true });
  text();
  const c0 = getC();
  if (c0 === 'analytics') start(); else if (c0 !== 'necessary') { place(); cc.hidden = false; }
})();