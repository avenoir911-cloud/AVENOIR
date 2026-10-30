const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
 for (const [n,w,h,l] of [['m390',390,844,'en'],['m390ar',390,844,'ar'],['desk',1440,900,'en']]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor: w<900?2:1 }); const p = await ctx.newPage();
  let posts=0; await ctx.route(/functions\/v1\/checkout/, r => { posts++; r.fulfill({status:200,body:'stub'}); }); await ctx.route(/functions\/v1\/api|facebook/, r => r.abort());
  await p.addInitScript(l2 => { try{localStorage.setItem('avn-lang',l2)}catch(e){} }, l);
  await p.goto('http://localhost:8811/preview/watch/monti/?strap=white&hands=silver&x=black', { waitUntil:'networkidle' });
  await p.click(w<900?'#mbar-buy':'#pv-buy'); await p.waitForTimeout(600);
  await p.screenshot({ path:`/tmp/claude-0/shots/after/${n}-co.png` });
  console.log(n, await p.textContent('#co-nm'), '|', await p.textContent('#co-what'), '|', await p.textContent('#co-total'), '|', await p.textContent('#co-pay'));
  await p.click('#co-pay'); console.log(n,'empty submit err:', await p.textContent('#co-err'), 'posts', posts);
  await p.fill('[name=name]','Test'); await p.fill('[name=phone]','0501234567'); await p.selectOption('[name=emirate]','Dubai'); await p.fill('[name=address]','Street 1, Villa 2');
  await p.evaluate(()=>{const b=document.getElementById('co-pay'); b.click(); b.click();}); await p.waitForTimeout(800); console.log(n,'posts after double tap', posts);
  await ctx.close(); }
 await b.close(); })();
