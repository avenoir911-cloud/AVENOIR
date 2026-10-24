/* AVENOIR tracking: one place that turns shop actions into analytics events.
   Meta Pixel loads only when META_PIXEL_ID is filled in. Until then events are only kept in
   window.dataLayer (so GA4 / TikTok can be plugged in later without touching the shop code).
   Every event is also stored in AVENOIR's own database (/api/collect) for the dashboard.
   No personal data is ever sent from here: only model, options, price and order reference. */
(() => {
  const META_PIXEL_ID = '1465681438668900'; // Meta dataset (Pixel) ID for avenoir.watches, business 733073342985949 (the dataset is *named* 1248708300606989)
  const CURRENCY = 'AED';

  window.dataLayer = window.dataLayer || [];
  let fbqReady = false;
  if (/^\d{10,20}$/.test(META_PIXEL_ID)) {
    /* standard Meta Pixel base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
    fbqReady = true;
  }

  /* first-party analytics: random per-visit id, where the visit came from */
  const API = 'https://uktmzygjaqnkizamrvij.supabase.co/functions/v1/api';
  const ss = (k, make) => { try { let v = sessionStorage.getItem(k); if (!v) { v = make(); sessionStorage.setItem(k, v); } return v; } catch (e) { return make(); } };
  const session = ss('avn_sid', () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join(''));
  const src = JSON.parse(ss('avn_src', () => { const q = new URLSearchParams(location.search); let ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {} if (ref === location.hostname) ref = ''; return JSON.stringify({ referrer: ref, utm_source: q.get('utm_source') || (q.get('fbclid') ? 'facebook' : ''), utm_campaign: q.get('utm_campaign') || '' }); }));
  function collect(name, params) {
    const body = { session, event: name, model: params.content_ids?.[0] || null, option_group: params.option_group || null, option: params.option || null,
      value: Number.isFinite(params.value) ? params.value : null, ref: params.order_ref || null, path: location.pathname, ...src };
    try { fetch(API + '/collect', { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => {}); } catch (e) {}
  }

  const STANDARD = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase']);
  function track(name, params = {}, eventID) {
    window.dataLayer.push({ event: name, ...params, event_id: eventID });
    collect(name, params);
    if (!fbqReady) return;
    const opts = eventID ? { eventID } : undefined;
    if (STANDARD.has(name)) fbq('track', name, params, opts); else fbq('trackCustom', name, params, opts);
  }
  window.avnTrack = track;
  window.dataLayer.push({ event: 'PageView' }); collect('PageView', {});

  const $ = id => document.getElementById(id);
  const amount = () => { const n = ($('pv-total')?.textContent || '').replace(/[^\d.]/g, ''); return n ? +n : undefined; };
  const model = () => { try { return new URL($('pv-buy').href).searchParams.get('m') || ''; } catch (e) { return ''; } };
  const productParams = () => ({ content_ids: [model()], content_name: $('pv-name')?.textContent || '', content_type: 'product', value: amount(), currency: CURRENCY });

  /* product opened → SelectProduct + ViewContent */
  const pv = $('pv');
  if (pv) {
    let wasHidden = pv.hidden;
    new MutationObserver(() => {
      if (wasHidden && !pv.hidden) setTimeout(() => { const p = productParams(); track('SelectProduct', { content_ids: p.content_ids, content_name: p.content_name }); track('ViewContent', p); }, 0);
      wasHidden = pv.hidden;
    }).observe(pv, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* choices inside the product view */
  document.addEventListener('click', e => {
    const sw = e.target.closest('#pv .sw, #pv .chip');
    if (sw) {
      const group = sw.closest('.sws')?.getAttribute('aria-label') || (sw.classList.contains('chip') ? 'Second strap' : '');
      const option = sw.getAttribute('aria-label') || sw.textContent.trim();
      const isStrap = sw.classList.contains('chip') || /strap|السير|سير/i.test(group);
      setTimeout(() => track(isStrap ? 'SelectStrap' : 'SelectOption', { content_ids: [model()], option_group: group, option, second_strap: sw.classList.contains('chip') || undefined, value: amount(), currency: CURRENCY }), 0);
      return;
    }
    const buy = e.target.closest('#pv-buy, #mbar-buy');
    if (buy) {
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
    let p = null; try { p = JSON.parse(localStorage.getItem('avn_last_checkout') || 'null'); } catch (err) {}
    const { at, ...params } = p || productParams();
    track('InitiateCheckout', { ...params, num_items: 1 });
  });

  /* Purchase: only after the server has confirmed the payment with Ziina (the page fires 'avn:paid'),
     once per order; eventID = order ref so Meta merges it with the server-side Conversions API event */
  addEventListener('avn:paid', e => {
    const ref = e.detail?.ref; if (!/^AV-[A-Z0-9]{6}$/.test(ref || '')) return;
    let done = false, last = null;
    try { done = localStorage.getItem('avn_purchase_' + ref) === '1'; last = JSON.parse(localStorage.getItem('avn_last_checkout') || 'null'); } catch (err) {}
    if (done) return;
    const fresh = last && Date.now() - last.at < 6 * 3600e3 ? last : null;
    track('Purchase', fresh ? { content_ids: fresh.content_ids, content_name: fresh.content_name, content_type: 'product', value: fresh.value, currency: CURRENCY, order_ref: ref } : { currency: CURRENCY, order_ref: ref }, ref);
    try { localStorage.setItem('avn_purchase_' + ref, '1'); } catch (err) {}
  });
})();
