// real taps on the phone: dungeon mode, play a step card, tap a target ring, reveal a new tile, rotate and place it, end turn
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp/e2e';
(async () => {
  process.env.SAVE_DIR = OUT + '/save2';
  const srv = require('../server/server.js'); await srv.start(47192);
  const base = 'http://127.0.0.1:47192', b = await chromium.launch(), errs = [];
  const mon = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); mon.on('pageerror', e => errs.push('mon ' + e.message));
  await mon.goto(base + '/m');
  const ph = [];
  for (let i = 0; i < 2; i++) { const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage(); p.on('pageerror', e => errs.push('p' + i + ' ' + e.message)); await p.goto(base + '/p'); await p.waitForTimeout(300); await p.fill('#nm', 'P' + i); await p.click(`[data-house]:nth-child(${i + 1})`); await p.click('[data-do=join]'); ph.push(p); }
  await ph[0].waitForTimeout(300); await ph[0].click('[data-do=start]'); await ph[0].waitForTimeout(400);
  for (let k = 0; k < 2; k++) for (const p of ph) if (await p.$('.pgate [data-cell]')) { await p.click('.pgate [data-cell]'); await p.click('[data-ans]'); await p.waitForTimeout(250); }
  const G = srv.__t.G, a = G.turn.pid, P = ph[a], pl = G.players[a];
  // give the active player a known hand: a 2-step card first
  pl.hand.unshift({ u: 9001, c: 's_cs2' }); srv.__t.broadcast(); await P.waitForTimeout(300);
  await P.click('[data-do=dun]'); await P.waitForTimeout(300);
  await P.click('[data-play=strip]'); await P.waitForTimeout(300);
  await mon.screenshot({ path: OUT + '/d1_mon.png' }); await P.screenshot({ path: OUT + '/d1_ph.png' });
  const ex = await P.$('[data-ex]'), mv = await P.$('[data-mv]');
  console.log('targets: exits', !!ex, 'moves', !!mv, 'steps', G.turn.pool.step);
  if (ex) { await P.dispatchEvent('[data-ex]', 'click'); await P.waitForTimeout(300); await mon.screenshot({ path: OUT + '/d2_mon.png' }); await P.screenshot({ path: OUT + '/d2_ph.png' });
    if (await P.$('[data-do=d_rot]')) await P.click('[data-do=d_rot]');
    await P.click('[data-do=d_place]'); await P.waitForTimeout(300);
    while (await P.$('[data-ans]')) { await P.click('[data-ans]'); await P.waitForTimeout(250); }
    console.log('placed tiles', G.dun.order.length, 'pos', pl.pos, 'fight', !!G.fight);
    await mon.screenshot({ path: OUT + '/d3_mon.png' }); await P.screenshot({ path: OUT + '/d3_ph.png' });
  } else if (mv) { await P.dispatchEvent('[data-mv]', 'click'); await P.waitForTimeout(300); console.log('moved to', pl.pos); }
  console.log('errors:', errs.join('\n') || 'none', 'last err', JSON.stringify(G.log.slice(-3)));
  await b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
