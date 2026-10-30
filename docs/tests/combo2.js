// Every old strap x hands combination, opened by link, must land on a valid Standard build with the right price and photos.
const { chromium } = require('playwright');
const base = 'http://localhost:8811/preview/';
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:390,height:844} }); await p.route(/supabase\.co|facebook|fonts\.g/, r => r.abort());
  const straps = ['bracelet','black','brown','navy','green','cream','white'], hands = ['blue','silver']; let n = 0, f = 0; const fail = m => { f++; console.log('FAIL', m); };
  for (const st of straps) for (const h of hands) for (const x of ['', 'brown']) {
    await p.goto(`${base}watch/monti/?strap=${st}&hands=${h}${x ? '&x=' + x : ''}`, { waitUntil:'networkidle' }); n++;
    const q = Object.fromEntries(new URL(await p.getAttribute('#pv-buy','href')).searchParams);
    const wantStrap = ['bracelet','black'].includes(st) ? st : 'bracelet';
    const wantX = x && x !== wantStrap ? x : '';
    const wantTotal = 'AED ' + (799 + (wantX ? 149 : 0)).toLocaleString('en-US');
    const tot = (await p.textContent('#pv-total')).trim();
    const imgs = await p.$$eval('#track img', a => a.map(i => i.getAttribute('src')));
    const photoOk = imgs.every(s => s.includes(wantStrap === 'bracelet' ? 'bracelet' : '-black-leather'));
    if (q.tier !== 'standard' || q.strap !== wantStrap || q.hands !== 'blue' || (q.x || '') !== wantX || tot !== wantTotal || !photoOk || p.url().includes('silver'))
      fail(`${st}/${h}/${x} -> ${JSON.stringify(q)} ${tot} photos ${photoOk}`);
  }
  console.log(`link combinations: ${n - f}/${n} pass`); await b.close(); })();
