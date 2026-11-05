// full-game browser test: the random bot plays a whole game on the server while the monitor and every phone page render
// each state. Any page error fails the test; screenshots are taken at the first occurrence of each kind of moment.
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp/e2e', N = +(process.env.N || 3), SEED = +(process.env.SEED || 7);
(async () => {
  process.env.SAVE_DIR = OUT + '/save';
  const srv = require('../server/server.js'); await srv.start(47191);
  const { botStep } = require('./bot.js');
  const base = 'http://127.0.0.1:47191', b = await chromium.launch(), errs = [];
  const mon = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  mon.on('pageerror', e => errs.push('mon: ' + e.message));
  await mon.goto(base + '/m');
  const phones = [];
  for (let i = 0; i < N; i++) { const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage(); p.on('pageerror', e => errs.push('p' + i + ': ' + e.message)); await p.goto(base + '/p'); phones.push(p); }
  await mon.waitForTimeout(600);
  for (let i = 0; i < N; i++) { await phones[i].fill('#nm', 'بازیکن' + (i + 1)); await phones[i].click(`[data-house]:nth-child(${i + 1})`); await phones[i].click('[data-do=join]'); await phones[i].waitForTimeout(150); }
  await phones[0].click('[data-do=start]'); await mon.waitForTimeout(400);
  const T = srv.__t; let G = T.G; G.seed = SEED;
  let s = SEED; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const shot = {}, snap = async (k) => { if (shot[k]) return; shot[k] = 1; await mon.waitForTimeout(250); await mon.screenshot({ path: `${OUT}/m_${k}.png` }); const pid = G.turn ? G.turn.pid : (G.prompts[0] ? G.prompts[0].to : 0); await phones[pid].screenshot({ path: `${OUT}/p_${k}.png` }); };
  let steps = 0;
  while (G.phase !== 'end' && steps < 40000) {
    // the dungeon mode is on whenever the bot moves; switch it on through the active phone like a player would
    botStep(G, r); steps++;
    if (steps % 3 === 0 || G.fight || G.battle || G.dun.place || G.dun.portal) { T.broadcast(); await mon.waitForTimeout(15); }
    const k = G.phase === 'start' ? 'start' : G.battle ? 'battle_' + G.battle.phase : G.fight ? 'fight' : G.dun.place ? 'place' : G.dun.portal ? 'portal' : G.phase === 'night' ? 'night' : G.prompts.length ? 'prompt_' + G.prompts[0].k : G.turn && G.turn.played.length > 3 ? 'turn' : null;
    if (k && !shot[k]) { T.broadcast(); await snap(k); }
    if (errs.length) break;
  }
  T.broadcast(); await mon.waitForTimeout(400); await snap('end');
  console.log('steps', steps, 'phase', G.phase, 'night', G.night, 'shots', Object.keys(shot).join(' '));
  console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
