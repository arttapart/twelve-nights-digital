// Random-play bot: plays whole games through the public act() interface and checks invariants.
const { D, Game, Dun, WB } = require('../shared/index.js');
function pick(a, r) { return a[Math.floor(r() * a.length)]; }
function botStep(G, r) {
  // in the editor preview the bot never rolls a die: dice prompts wait for the player on the phone (Farshad 2026-11-06)
  const noDice = typeof window !== 'undefined' && window.NO_BOT_DICE;
  const isDie = q => q.k === 'duelRoll' || q.k === 'resGo' || (q.k === 'bq' && q.data && q.data.die);
  if (G.prompts.length) {
    const q = noDice ? G.prompts.find(x => !isDie(x)) : G.prompts[0];
    if (!q) return 'wait';
    let v;
    if (q.many) { const n = Math.min(q.many, q.opts.length); const os = q.opts.slice().sort(() => r() - .5).slice(0, q.min === 0 ? Math.floor(r() * (n + 1)) : n); v = os.map(o => o.v); }
    else v = pick(q.opts, r).v;
    const e = Game.act(G, q.to, { t: 'answer', id: q.id, v });
    if (e) throw new Error('answer failed ' + q.k + ': ' + e + ' ' + JSON.stringify(v));
    return;
  }
  if (G.phase === 'battle') {
    const B = G.battle;
    if (B.phase === 'prep') { for (const p of G.players) if (!B.ready[p.id]) { const rm = p.wiz.map((_, i) => i).filter(() => r() < .15 && p.wiz.length > 7); Game.act(G, p.id, { t: 'b_prep', remove: rm }); return; } }
    if (B.phase === 'pick') { for (const p of G.players) if (B.picked[p.id] === undefined) { const h = B.hand[p.id]; const e = Game.act(G, p.id, { t: 'b_pick', i: h.length ? Math.floor(r() * h.length) : null }); if (e) throw new Error('pick ' + e); return; } }
    if (B.phase === 'r6') { Game.act(G, B.shower, { t: 'b_show' }); return; }
    if (B.phase === 'done') { for (const p of G.players) Game.act(G, p.id, { t: 'b_next' }); return; }
    throw new Error('battle stuck in ' + B.phase);
  }
  if (G.phase === 'night' && G.nightQ) { Game.tick(G, 0, true); return; }   // run the next night step at once
  if (G.phase !== 'turn') throw new Error('stuck phase ' + G.phase);
  const p = Game.curP(G), T = G.turn, A = a => Game.act(G, p.id, a);
  if (T.die && T.die.acc < T.die.faces.length) { A({ t: 'dieok' }); return; }   // accept the current die before anything else
  if (G.dun.place) { if (r() < .5) A({ t: 'd_rot' }); else A({ t: 'd_place' }); return; }
  if (G.dun.portal) { const po = G.dun.portal; if (r() < .3) { A({ t: 'd_pcancel' }); return; } if (r() < .3) { A({ t: 'd_pnext' }); return; } const e = A({ t: 'd_pgo', n: po.list[po.i].cells[0] }); if (e) A({ t: 'd_pcancel' }); return; }
  if (G.fight) {
    const F = G.fight, cur = F.pending != null ? F.cards[F.pending] : null;
    if (cur) { if (T.pool.power >= cur.def) A({ t: 'f_pay' }); else { const m = p.hand.find(x => Game.card(x.c).ty === 'magic'); if (m && r() < .7) A({ t: 'play', u: m.u }); else if (!T.dieUsed && !noDice) A({ t: 'roll' }); else A({ t: 'f_lose' }); } }
    else if (T.pool.power >= 4 && r() < .4) A({ t: 'f_next' }); else A({ t: 'f_stop' });
    return;
  }
  if (T.forced != null) { A({ t: 'd_fight' }); return; }
  const choices = [];
  for (const x of p.hand) { const c = Game.card(x.c); if (c.ty === 'wound') continue; choices.push(() => A({ t: 'play', u: x.u, mode: c.strip && r() < .75 ? 'strip' : 'main' })); }
  if (!T.dieUsed && !noDice) choices.push(() => A({ t: 'roll' }));
  G.acad.row.forEach((id, i) => { if (Game.canPay(G, p, D.cards[id].cost)) choices.push(() => A({ t: 'buy', src: 'row', i })); });
  for (const f of ['f_m3', 'f_m3s']) if (G.acad.fixed[f] && Game.canPay(G, p, D.cards[f].cost)) choices.push(() => A({ t: 'buy', src: 'fixed', i: f }));
  G.hall.row.forEach((w, i) => { if (T.pool.power >= Game.hireCost(G, p, w)) choices.push(() => A({ t: 'hire', i })); });
  if (!T.gob && T.pool.power >= 1) choices.push(() => A({ t: 'goblin', what: r() < .5 ? 'coin' : 'scroll' }));
  for (const k in Game.UPGRADES) choices.push(() => A({ t: 'upgrade', k }));
  const dch = [];
  for (const o of Dun.moveOptions(G, p)) if (!o.no) dch.push(() => A({ t: 'd_move', to: o.to, tele: !!o.tele }));
  for (const o of Dun.openExits(G, p)) if (!o.no) { dch.push(() => A({ t: 'd_reveal', exit: o.exit })); dch.push(() => A({ t: 'd_reveal', exit: o.exit })); }
  if (dch.length && r() < .8) { pick(dch, r)(); return; }
  if (T.run > 0) choices.push(() => A({ t: 'd_runend' }));
  if (!T.swap && r() < .1) choices.push(() => A({ t: 'swap', i: 0 }));
  if (r() < .25 || !choices.length) { const e = A({ t: 'end' }); if (e) { const mv = Dun.moveOptions(G, p).filter(o => !o.no); if (mv.length) A({ t: 'd_move', to: mv[0].to, tele: !!mv[0].tele }); else { p.pos = Dun.startCells(G)[0]; } } return; }
  pick(choices, r)();
}
function check(G) {
  for (const p of G.players) {
    for (const r of ['coin', 'scroll', 'ess']) if (p.store[r] < 0 || p.store[r] > 4) throw new Error('store ' + r + ' ' + p.store[r]);
    if (p.torch < 0 || p.pick < 0 || p.torch + p.pick > 3) throw new Error('tokens');
    const n = p.deck.length + p.hand.length + p.discard.length + p.keep.length + (G.turn && G.turn.pid === p.id ? G.turn.played.length : 0) + (G.turn && G.turn.pick3 && G.turn.pid === p.id ? G.turn.pick3.length : 0);
    const us = new Set([...p.deck, ...p.hand, ...p.discard, ...p.keep].map(x => x.u)); if (us.size !== p.deck.length + p.hand.length + p.discard.length + p.keep.length) throw new Error('duplicate card uid');
  }
  if (G.turn && G.turn.pool.power < 0) throw new Error('neg power');
  for (const k of ['coin', 'scroll', 'ess', 'step', 'tele']) if (G.turn && G.turn.pool[k] < 0) throw new Error('neg ' + k);
  JSON.stringify(G);
}
function run(seed, n, bf) {
  let s = seed; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const G = Game.newGame({ seed, bf, players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i })) });
  let steps = 0;
  while (G.phase !== 'end') { botStep(G, r); check(G); if (++steps > 60000) throw new Error('too many steps, night ' + G.night + ' phase ' + G.phase); }
  return G;
}
if (require.main === module) {
  const N = +process.argv[2] || 30; let fails = 0; const stat = { breach: 0, tiles: 0, fame: [] };
  for (let i = 0; i < N; i++) {
    const n = 2 + (i % 4);
    try { const G = run(1000 + i, n, i % 2 === 0); stat.tiles += G.dun.order.length; const L = G.log.map(x => x.t).join('\n'); stat.breach += G.players.reduce((s, p) => s + p.discard.concat(p.deck, p.hand).filter(x => x.c === 'W').length, 0); stat.chests = (stat.chests || 0) + G.players.reduce((s, p) => s + p.chests, 0); stat.hunt = (stat.hunt || 0) + G.players.reduce((s, p) => s + p.hunt, 0); stat.fame.push(Math.max(...G.final.rows.map(r => r.total))); }
    catch (e) { fails++; console.log('seed', 1000 + i, 'players', n, e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
  console.log('wounds', (stat.breach / (N - fails)).toFixed(1), 'chests', ((stat.chests||0) / (N - fails)).toFixed(1), 'hunt', ((stat.hunt||0) / (N - fails)).toFixed(1));
  console.log('games', N, 'fails', fails, 'avg tiles', (stat.tiles / (N - fails)).toFixed(1), 'avg top score', (stat.fame.reduce((a, b) => a + b, 0) / stat.fame.length).toFixed(1));
}
module.exports = { run, botStep };
