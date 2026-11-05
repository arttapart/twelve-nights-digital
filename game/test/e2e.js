// multi-phone browser test: monitor + N phones on a local server
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/e2e';
(async () => {
  process.env.SAVE_DIR = OUT + '/save'; process.env.PORT = 47190;
  const srv = require('../server/server.js'); await srv.start(47190);
  const base = 'http://127.0.0.1:47190';
  const b = await chromium.launch();
  const errs = [];
  const mon = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  mon.on('pageerror', e => errs.push('mon: ' + e.message)); mon.on('console', m => { if (m.type() === 'error') errs.push('mon console: ' + m.text()); });
  await mon.goto(base + '/m');
  const N = +(process.env.N || 2), phones = [];
  for (let i = 0; i < N; i++) { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push('p' + i + ': ' + e.message)); await p.goto(base + '/p'); phones.push(p); }
  await mon.waitForTimeout(800);
  for (let i = 0; i < N; i++) { const p = phones[i]; await p.fill('#nm', ['سارا', 'علی', 'مریم', 'رضا', 'نگار'][i]); await p.click(`[data-house]:nth-child(${i + 1})`); await p.click('[data-do=join]'); await p.waitForTimeout(300); }
  await mon.screenshot({ path: OUT + '/m_lobby.png' }); await phones[0].screenshot({ path: OUT + '/p_lobby.png' });
  await phones[0].click('[data-do=start]'); await mon.waitForTimeout(600);
  await mon.screenshot({ path: OUT + '/m_setup.png' });
  // start cells
  for (let k = 0; k < N; k++) for (const p of phones) { if (await p.$('[data-cell]') && await p.$('.pgate')) { await p.click('[data-cell]'); await p.click('[data-ans]'); await p.waitForTimeout(300); } }
  await mon.waitForTimeout(500);
  await mon.screenshot({ path: OUT + '/m_main.png' });
  for (let i = 0; i < N; i++) await phones[i].screenshot({ path: OUT + '/p' + i + '_turn.png' });
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  module.exports.ctx = { b, mon, phones };
  if (!process.env.KEEP) { await b.close(); process.exit(0); }
})().catch(e => { console.error(e); process.exit(1); });
