// AVENOIR preview test suite (v2). Chromium only. Run from the repo root with a static server on :8811:
//   python3 -m http.server 8811 &  NODE_PATH=$(npm root -g) node docs/tests/preview-v2.js
// Supabase is mocked: /catalog fails (the page falls back to build-time prices), checkout POSTs are captured and answered
// with a stub page, so no order or payment is ever created by these tests.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8811/preview/';
const WIDTHS = [320, 375, 390, 430, 768, 1366, 1440];
const res = []; const ok = (name, pass, info = '') => res.push({ name, pass: !!pass, info });

async function newPage(b, w, { lang = 'en', consent = 'necessary', h = 900 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 2 : 1, hasTouch: w < 800, isMobile: w < 800 });
  const p = await ctx.newPage(); p.errors = []; p.posts = []; p.hits = [];
  await ctx.addInitScript(([l, c]) => { try { if (l) localStorage.setItem('avn-lang', l); if (c) localStorage.setItem('avn-consent', c); } catch (e) {} }, [lang, consent]);
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.errors.push(m.text()); });
  p.on('request', r => p.hits.push(r.url()));
  await ctx.route(/fonts\.g/, r => r.abort());
  await ctx.route(/connect\.facebook\.net|facebook\.com/, r => r.abort());
  await ctx.route(/functions\/v1\/api\/(catalog|collect)/, r => r.abort());
  await ctx.route(/functions\/v1\/api\/status/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"paid"}' }));
  await ctx.route(/functions\/v1\/checkout/, async r => { p.posts.push(Object.fromEntries(new URLSearchParams(r.request().postData() || ''))); await r.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub payment page</p>' }); });
  return p;
}
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });

(async () => {
  const b = await chromium.launch();

  /* 1. every width, both languages: layout, buy button, errors */
  for (const w of WIDTHS) for (const lang of ['en', 'ar']) {
    const p = await newPage(b, w, { lang });
    await go(p, ''); await p.waitForTimeout(300);
    ok(`home ${w} ${lang}: no horizontal scroll`, await noHScroll(p));
    ok(`home ${w} ${lang}: one h1`, (await p.locator('h1').count()) === 1);
    ok(`home ${w} ${lang}: dir`, (await p.getAttribute('html', 'dir')) === (lang === 'ar' ? 'rtl' : 'ltr'));
    for (const m of ['monti', 'lumi', 'rayo', 'bloom']) {
      await go(p, `watch/${m}/`); await p.waitForTimeout(250);
      ok(`${m} ${w} ${lang}: no horizontal scroll`, await noHScroll(p));
      const buyVisible = await p.evaluate(() => { const ids = innerWidth < 960 ? ['mbar-buy'] : ['pv-buy']; const e = document.getElementById(ids[0]); if (innerWidth >= 960) e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return r.width > 40 && r.height > 40 && y > 0 && y < innerHeight && (top === e || e.contains(top)); });
      ok(`${m} ${w} ${lang}: buy button visible and not covered`, buyVisible);
      const priceClear = await p.evaluate(() => { const e = document.getElementById(innerWidth < 960 ? 'mbar-total' : 'pv-price'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 4, r.top + r.height / 2); return !!e.textContent.trim() && (top === e || e.contains(top)); });
      ok(`${m} ${w} ${lang}: price not covered`, priceClear);
      ok(`${m} ${w} ${lang}: one h1 = product`, (await p.locator('h1').count()) === 1 && (await p.locator('h1').getAttribute('id')) === 'pv-name');
      const tapOk = await p.evaluate(() => [...document.querySelectorAll('#pv .opt, #pv .tier, #pv-buy, #addon-toggle')].filter(e => e.offsetParent).every(e => { const r = e.getBoundingClientRect(); return r.height >= 40 && r.width >= 40; }));
      ok(`${m} ${w} ${lang}: options at least 40px to tap`, tapOk);
      const imgs = await p.evaluate(() => [...document.querySelectorAll('#pv img')].map(i => [i.getAttribute('alt'), i.currentSrc || i.src]));
      ok(`${m} ${w} ${lang}: every product image has alt`, imgs.every(([a]) => a != null), imgs.filter(([a]) => a == null).map(x => x[1]).join(' '));
    }
    ok(`${w} ${lang}: no console errors`, p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }

  /* 2. every product and option: gallery matches the build, price, summary, address */
  const p = await newPage(b, 1366);
  const state = () => p.evaluate(() => ({ total: document.getElementById('pv-total').textContent, sum: document.getElementById('pv-summary').textContent, url: location.search, imgs: [...document.querySelectorAll('#track img')].map(i => i.closest('picture').querySelector('source[type="image/webp"]').srcset.split('/').pop().replace(/-\d+\.webp.*$/, '')) }));
  const FORBIDDEN = /(brown|navy|green|cream|white)-leather/;   // digital recolours: never shown
  for (const [strap, hands] of [['bracelet', 'blue'], ['black', 'blue']]) {
    await go(p, `watch/monti/?tier=standard&strap=${strap}&hands=${hands}`); await p.waitForTimeout(300);
    let s = await state();
    ok(`monti ${strap}/${hands}: AED 799`, s.total === 'AED 799', s.total);
    ok(`monti ${strap}/${hands}: photos only of this build`, s.imgs.length && s.imgs.every(i => !FORBIDDEN.test(i) && (i.includes(strap) || i === 'monte-dial-macro' || (strap === 'black' && /black-leather/.test(i)))), s.imgs.join(','));
    const extras = await p.evaluate(() => { document.getElementById('addon-toggle').click(); return [...document.querySelectorAll('#addon-opts .opt')].map(e => e.textContent.trim()); });
    ok(`monti ${strap}: second-strap choices`, extras.length === (strap === 'bracelet' ? 6 : 5), extras.join(','));
    for (let i = 0; i < extras.length; i++) {
      await p.locator('#addon-opts .opt').nth(i).click(); await p.waitForTimeout(120); s = await state();
      ok(`monti ${strap} + ${extras[i]}: AED 948, one extra in address`, s.total === 'AED 948' && /x=[a-z]+$/.test(s.url.replace(/&utm.*/, '')), `${s.total} ${s.url}`);
    }
    await p.locator('#addon-opts .opt[aria-checked=true]').click(); s = await state();
    ok(`monti ${strap}: remove extra -> AED 799`, s.total === 'AED 799');
  }
  for (const hands of ['blue', 'silver']) { await go(p, `watch/lumi/?hands=${hands}`); await p.waitForTimeout(250); const s = await state();
    ok(`lumi ${hands}: AED 799, front photo has ${hands} hands`, s.total === 'AED 799' && s.imgs[0] === `lumi-front-${hands}-hands`, s.imgs.join(',')); }
  for (const c of ['gold-ice-black', 'gold-navy-navy', 'silver-black-steel', 'silver-white-steel', 'silver-ice-steel', 'silver-white-bluehands-steel']) { await go(p, `watch/rayo/?colour=${c}`); await p.waitForTimeout(200); const s = await state();
    ok(`rayo ${c}: AED 899, photo of this colour`, s.total === 'AED 899' && s.imgs.length === 1 && s.imgs[0] === `rayo-front-${c}`, s.imgs.join(',')); }
  await go(p, 'watch/rayo/?colour=silver-black-steel&x=steel'); await p.waitForTimeout(200);
  ok('rayo + steel bracelet: AED 1,048', (await state()).total === 'AED 1,048');
  for (const d of ['pink', 'white', 'blue']) { await go(p, `watch/bloom/?dial=${d}`); await p.waitForTimeout(200); const s = await state();
    ok(`bloom ${d}: AED 799, photo of this dial`, s.total === 'AED 799' && s.imgs[0] === `bloom-front-${d}`, s.imgs.join(',')); }
  await go(p, 'watch/monti/?tier=standard&strap=green&hands=silver'); await p.waitForTimeout(200);
  ok('monti invalid build in link is corrected to Standard', /strap=bracelet&hands=blue|hands=blue/.test((await state()).url) && !/silver|green/.test((await state()).url), (await state()).url);

  /* 3. options survive a language change and Back */
  await go(p, 'watch/monti/?tier=standard&strap=black&hands=blue&x=navy'); await p.waitForTimeout(200);
  const before = (await state()).url; await p.click('#lang'); await p.waitForTimeout(250); const after = await state();
  ok('language switch keeps the build', after.url === before && after.total === '948 درهم', `${before} -> ${after.url} ${after.total}`);
  ok('Arabic summary uses Arabic words (only the watch name in Latin)', !/[A-Za-z]/.test(after.sum.replace(/MONTI|AVENOIR/g, '')), after.sum);
  ok('Arabic page title and description', /مونتي/.test(await p.title()) || /درهم/.test(await p.title()), await p.title());
  await p.click('#lang');
  const polHref = await p.locator('.pol a').getAttribute('href');
  ok('policy link next to Buy carries the build back', /delivery\.html\?lang=en&from=watch%2Fmonti%2F/.test(polHref), polHref);
  await p.locator('.pol a').click(); await p.waitForLoadState('networkidle');
  ok('policy page opens', /Delivery, Warranty/.test(await p.title()));
  await p.click('#back-en'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(200);
  ok('Back link from policy returns to the same build', (await state()).url.includes('strap=black') && (await state()).total === 'AED 948', (await state()).url);
  await p.goBack(); await p.waitForLoadState('networkidle'); await p.goBack(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(200);
  ok('browser Back returns to the same build', (await state()).total === 'AED 948');
  // home -> watch (in place) -> Back -> Forward
  await go(p, ''); await p.click('#grid a[data-open=lumi]'); await p.waitForTimeout(250); await p.click('#pv .opt:has-text("Silver")'); await p.waitForTimeout(150);
  await p.goBack(); await p.waitForTimeout(250); ok('home: Back closes the watch', await p.locator('#pv').isHidden());
  await p.goForward(); await p.waitForTimeout(300); ok('home: Forward reopens LUMI with silver hands', (await state()).url.includes('hands=silver'));

  /* 4. order form up to (not including) payment */
  for (const lang of ['en', 'ar']) {
    const q = await newPage(b, 390, { lang });
    await go(q, 'watch/monti/?tier=standard&strap=black&hands=blue&x=navy'); await q.waitForTimeout(250);
    await q.click('#mbar-buy'); await q.waitForSelector('.co:not([hidden])');
    ok(`form ${lang}: summary shows the build and AED 948`, (await q.textContent('#co-total')).includes('948') && (await q.textContent('#co-what')).length > 5, await q.textContent('#co-what'));
    ok(`form ${lang}: no Latin words in Arabic summary`, lang === 'en' || !/[A-Za-z]/.test((await q.textContent('#co-nm') + await q.textContent('#co-what')).replace(/MONTI|AVENOIR/g, '')), await q.textContent('#co-nm') + ' / ' + await q.textContent('#co-what'));
    ok(`form ${lang}: policy link`, !(await q.locator('#co-pol').isHidden()));
    await q.click('#co-pay'); await q.waitForTimeout(100);
    ok(`form ${lang}: empty submit shows 4 field errors, no request`, (await q.locator('.co .ferr:not(:empty)').count()) === 4 && q.posts.length === 0);
    await q.fill('input[name=name]', 'Saeed Ali'); await q.fill('input[name=phone]', '+44 7700 900123'); await q.selectOption('select[name=emirate]', 'Al Ain'); await q.fill('textarea[name=address]', 'Al Jimi, street 5, villa 12');
    await q.click('#co-pay'); await q.waitForTimeout(100);
    ok(`form ${lang}: non-UAE number refused, other fields kept`, (await q.locator('#e-phone').textContent()).length > 5 && (await q.inputValue('input[name=name]')) === 'Saeed Ali' && q.posts.length === 0);
    await q.fill('input[name=phone]', lang === 'ar' ? '٠٥٠١٢٣٤٥٦٧' : '050 123 4567'); await q.click('.co-more summary'); await q.fill('input[name=email]', 'bad@'); await q.click('#co-pay'); await q.waitForTimeout(100);
    ok(`form ${lang}: bad email refused`, (await q.locator('#e-email').textContent()).length > 3 && q.posts.length === 0);
    await q.fill('input[name=email]', '');
    const popup = q.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
    await q.evaluate(() => { const b = document.getElementById('co-pay'); b.click(); b.click(); b.click(); });
    await popup; await q.waitForTimeout(800);
    const post = q.posts[0] || {};
    ok(`form ${lang}: one request for three taps`, q.posts.length === 1, String(q.posts.length));
    ok(`form ${lang}: posted build m/tier/strap/hands/x and no price`, post.m === 'monti' && post.tier === 'standard' && post.strap === 'black' && post.hands === 'blue' && post.x === 'navy' && !('price' in post) && !('amount' in post), JSON.stringify(post));
    ok(`form ${lang}: loading state shown`, (await q.getAttribute('#co-pay', 'aria-busy')) === 'true' || (await q.locator('.co').isHidden()));
    ok(`form ${lang}: nothing saved in the browser`, await q.evaluate(() => !Object.keys(localStorage).some(k => /details|name|phone|address/.test(k))));
    // after Ziina: the order number, in the same language
    await go(q, 'watch/monti/#paid-AV-TEST23'); await q.waitForTimeout(600);
    const nh = await q.textContent('#notice-h'), nr = await q.textContent('#notice-ref');
    ok(`return ${lang}: order number shown in the page language`, nr === 'AV-TEST23' && (lang === 'ar' ? /[؀-ۿ]/.test(nh) : /Payment received/.test(nh)), `${nr} ${nh}`);
    ok(`order ${lang}: no console errors`, q.errors.length === 0, q.errors.join(' | '));
    await q.context().close();
  }

  /* 5. consent: nothing measured before "Accept analytics"; the shop works with "Necessary only" */
  const c = await newPage(b, 390, { consent: null });
  await go(c, 'watch/monti/'); await c.waitForTimeout(500);
  ok('consent: banner shown on first visit', !(await c.locator('.cc').isHidden()));
  ok('consent: no Meta Pixel or analytics before a choice', !c.hits.some(u => /facebook|api\/collect/.test(u)), c.hits.filter(u => /facebook|collect/.test(u)).join(' '));
  ok('consent: banner does not cover the buy bar', await c.evaluate(() => { const a = document.querySelector('.cc').getBoundingClientRect(), m = document.querySelector('.mbar').getBoundingClientRect(); return a.bottom <= m.top + 1; }));
  await c.click('.cc .n'); await c.waitForTimeout(300);
  ok('consent: Necessary only -> still nothing sent', !c.hits.some(u => /facebook|api\/collect/.test(u)));
  await c.click('#mbar-buy'); ok('consent: order form works with Necessary only', await c.waitForSelector('.co:not([hidden])', { timeout: 3000 }).then(() => true, () => false));
  await c.context().close();
  const a = await newPage(b, 1366, { consent: null });
  await go(a, 'watch/lumi/'); await a.click('.cc .y'); await a.waitForTimeout(2800);
  ok('consent: Accept loads Meta Pixel and counts the product view', a.hits.some(u => /connect\.facebook\.net/.test(u)) && a.hits.filter(u => /api\/collect/.test(u)).length >= 2, a.hits.filter(u => /facebook|collect/.test(u)).length + ' requests');
  await a.context().close();

  /* 6. SEO and performance */
  const s = await newPage(b, 1366);
  for (const m of ['monti', 'lumi', 'rayo', 'bloom']) {
    await go(s, `watch/${m}/`);
    const ld = await s.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent));
    ok(`${m}: Product JSON-LD in AED, made to order`, ld['@type'] === 'Product' && ld.offers.priceCurrency === 'AED' && /^\d+$/.test(ld.offers.price) && ld.offers.availability.endsWith('MadeToOrder'), JSON.stringify(ld.offers).slice(0, 120));
    ok(`${m}: canonical + og:image of its own`, (await s.getAttribute('link[rel=canonical]', 'href')).endsWith(`/watch/${m}/`) && (await s.getAttribute('meta[property="og:image"]', 'content')).includes(`share/${m}`));
    ok(`${m}: product visible without being a dialog`, (await s.getAttribute('#pv', 'role')) === null && await s.locator('#pv').isVisible());
  }
  const hs = await newPage(b, 390);
  await hs.evaluate(() => {}); await go(hs, '');
  const imgReqs = hs.hits.filter(u => /img\/catalogue\//.test(u)).map(u => u.split('/').pop().replace(/-\d+\.(avif|webp|jpg)$/, ''));
  ok('home: does not load option photos of every watch', !imgReqs.some(i => /lumi-front-silver|rayo-front-(?!silver-black)|bloom-front-(white|blue)|leather-\d|clasp/.test(i)), [...new Set(imgReqs)].join(','));
  const cls = await hs.evaluate(() => new Promise(r => { let v = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) v += e.value; })).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(v), 1500); }));
  ok('home: layout shift under 0.05', cls < 0.05, cls.toFixed(4));
  await go(hs, 'watch/monti/');
  const cls2 = await hs.evaluate(() => new Promise(r => { let v = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) v += e.value; })).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(v), 1500); }));
  ok('watch page: layout shift under 0.05', cls2 < 0.05, cls2.toFixed(4));
  ok('watch page: first photo preloaded', (await hs.locator('link[rel=preload][as=image]').count()) === 1);

  await b.close();
  const fail = res.filter(r => !r.pass);
  console.log(`${res.length - fail.length}/${res.length} passed`);
  fail.forEach(f => console.log('FAIL', f.name, '::', f.info));
  require('fs').writeFileSync('/tmp/claude-0/test-results.json', JSON.stringify(res, null, 1));
})();
