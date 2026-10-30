// Navigation, focus and layout checks (replaces the pre-Standard pv.js expectations)
const { chromium } = require('playwright');
const base = 'http://localhost:8811/preview/';
(async () => { const b = await chromium.launch(); let n = 0, f = 0; const ok = (c, m) => { n++; if (!c) { f++; console.log('FAIL', m); } };
 for (const [v, w, h] of [['m360',360,780],['m390',390,844],['m430',430,932],['t768',768,1024],['d1440',1440,900]]) for (const l of ['en','ar']) {
  const p = await b.newPage({ viewport:{width:w,height:h} }); await p.route(/supabase\.co|facebook|fonts\.g/, r => r.abort());
  await p.addInitScript(x => { try { localStorage.setItem('avn-lang', x); sessionStorage.setItem('avn-in','1'); } catch(e){} }, l);
  const tag = `${v}/${l}`;
  await p.goto(base, { waitUntil:'networkidle' });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag} home no h-scroll`);
  ok(await p.evaluate(() => { const r = document.querySelector('.cover .btn').getBoundingClientRect(); return r.bottom <= innerHeight; }), `${tag} cover button in first screen`);
  ok(await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.getBoundingClientRect().top < innerHeight && i.offsetParent).every(i => i.getAttribute('width') && i.getAttribute('height'))), `${tag} first-screen images have reserved size`);
  ok(await p.evaluate(() => [...document.querySelectorAll('h1,h2,.btn,.pricebox .p,.index .pr')].filter(e => e.offsetParent).every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })), `${tag} headings/prices/buttons inside screen`);
  await p.click('.index .card[data-open=lumi]'); await p.waitForTimeout(300);
  ok(p.url().includes('watch/lumi/'), `${tag} index opens LUMI`);
  ok(await p.$eval('#main', e => e.inert), `${tag} page behind product inert`);
  ok(await p.evaluate(() => document.getElementById('pv').scrollWidth <= innerWidth), `${tag} product no h-scroll`);
  ok(await p.evaluate(() => { const b = document.getElementById(innerWidth < 960 ? 'mbar-buy' : 'pv-buy').getBoundingClientRect(); return b.bottom <= innerHeight; }), `${tag} buy visible`);
  await p.goBack(); await p.waitForTimeout(300); ok(await p.$eval('#pv', e => e.hidden) && !p.url().includes('watch/'), `${tag} Back closes`);
  await p.goForward(); await p.waitForTimeout(300); ok(!(await p.$eval('#pv', e => e.hidden)), `${tag} Forward reopens`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok(await p.$eval('#pv', e => e.hidden), `${tag} Escape closes`);
  await p.goto(base + 'watch/monti/?strap=black', { waitUntil:'networkidle' });
  const tabs = []; for (let i = 0; i < 5; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => !!document.activeElement.closest('#pv'))); }
  ok(tabs.every(Boolean), `${tag} keyboard stays inside product`);
  ok(await p.$$eval('[role=radio]', a => a.every(x => x.getAttribute('aria-checked') !== null && (x.textContent.trim() || x.getAttribute('aria-label')))), `${tag} options labelled`);
  await p.close(); }
 console.log(`navigation/layout: ${n - f}/${n} pass`); await b.close(); })();
