// 12 Nights digital: dungeon (rulebook v13 section 9-4, 9-5, 10; CHANGELOG 77-89).
(function (root) {
'use strict';
const D = root.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
const Game = root.Game || (typeof require !== 'undefined' ? require('./engine.js') : null);
const _ = Game._, fa = Game.fa;
const GATE = '0,0|1,1';
const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' }, ORDER = ['N', 'E', 'S', 'W'];
const CELLNAME = { '': 'خانهٔ خالی', Y: 'اهریمن زرد', O: 'اهریمن نارنجی', R: 'اهریمن قرمز', Q: 'اهریمن نامعلوم', T: 'صندوقچه', C: '۲ سکه', S: '۲ طومار', E: 'جوهرهٔ تاریک', P: 'پورتال', F: 'چشمهٔ پالایش', K: 'نفرین‌شده', A: 'دروازهٔ شهر' };
const isExit = p => typeof p[0] === 'string';
const slot = (side, i) => ({ N: i, E: i, S: 2 - i, W: 2 - i })[side];
function rotExit(e, r) { const s = slot(e[0], e[1]); const side2 = ORDER[(ORDER.indexOf(e[0]) + r) % 4]; return [side2, { N: s, E: s, S: 2 - s, W: 2 - s }[side2]]; }
function rotCell(c, r) { for (let k = 0; k < r; k++) c = [c[1], 2 - c[0]]; return c; }
const key = (pos, c) => pos[0] + ',' + pos[1] + '|' + c[0] + ',' + c[1];
const xkey = (pos, e) => 'X' + pos[0] + ',' + pos[1] + ':' + e[0] + e[1];
const posOf = n => n.split('|')[0].split(',').map(Number);
const cellOf = n => n.split('|')[1].split(',').map(Number);
const gk = pos => pos[0] + ',' + pos[1];

function init(G) {
  const T = D.tiles;
  const l1 = [], l2 = [];
  T.forEach((t, i) => { if (t.level === 1) l1.push(i); else if (t.level === 2) l2.push(i); });
  const four = _.shuffle(G, l1).slice(0, 4);
  G.dun = { grid: { '0,0': { t: 0, r: 0 } }, pile: _.shuffle(G, four).concat(_.shuffle(G, l2)), demons: [], loot: {}, did: 0, place: null, portal: null, order: ['0,0'] };
}
function tileCell(G, n) { const pos = posOf(n), g = G.dun.grid[gk(pos)]; if (!g) return null; const c = cellOf(n); const t = D.tiles[g.t]; const back = rotCell(c, (4 - g.r) % 4); const v = t.cells[back[0] + ',' + back[1]]; return v === undefined ? null : v; }
const cellName = (G, n) => CELLNAME[tileCell(G, n) || ''] || 'خانه';

// ---------- graph ----------
// segments per placed tile; exits become intermediate nodes joined to the facing exit of the neighbour tile.
function segments(G, pos, t, r) {
  const segs = [];
  const node = p => isExit(p) ? xkey(pos, rotExit(p, r)) : key(pos, rotCell(p, r));
  for (const [a, b, k] of t.cors) {
    const na = node(a), nb = node(b), len = k[1] === '2' ? 2 : 1, d = k[0] === 'd' || k[0] === 'b', x = k[0] === 'x' || k[0] === 'b';
    const fwd = !k.endsWith('i'), back = !k.endsWith('o');
    segs.push({ a: na, b: nb, len, d, x, fwd, back, ow: fwd !== back });
  }
  return segs;
}
function graph(G) {
  if (G.dun._g && G.dun._g.rev === G.dun.order.length) return G.dun._g;
  const adj = {};   // node -> [{to, len, d, x}] directed
  const add = (a, b, s) => { (adj[a] = adj[a] || []).push({ to: b, len: s.len, d: s.d, x: s.x, ow: s.ow }); };
  const exitInfo = {};   // exit node -> {pos, side, i}
  for (const k of G.dun.order) {
    const g = G.dun.grid[k], pos = k.split(',').map(Number), t = D.tiles[g.t];
    for (const s of segments(G, pos, t, g.r)) {
      if (s.fwd) add(s.a, s.b, s); if (s.back) add(s.b, s.a, s);
      for (const n of [s.a, s.b]) if (n[0] === 'X') { const m = n.match(/^X(-?\d+),(-?\d+):([NESW])(\d)$/); exitInfo[n] = { pos: [+m[1], +m[2]], side: m[3], i: +m[4] }; }
    }
  }
  // join facing exits
  for (const n in exitInfo) {
    const e = exitInfo[n], d = DIRS[e.side], np = [e.pos[0] + d[0], e.pos[1] + d[1]], m = xkey(np, [OPP[e.side], e.i]);
    if (exitInfo[m]) add(n, m, { len: 0, d: false, x: false, ow: false });
  }
  // collapse to cell -> cell corridors (one corridor across tile edges, rulebook 9-4)
  const cor = {};   // cell -> [{to, len, d, x, ow}]
  const open = [];  // {from cell, exit node, pos (empty grid), side, i, len, d, x}
  for (const n in adj) {
    if (n[0] === 'X') continue;
    const seen = new Set([n]);
    const walk = (u, acc) => {
      for (const e of adj[u] || []) {
        if (seen.has(e.to)) continue;
        const nacc = { len: Math.max(acc.len, e.len), d: acc.d || e.d, x: acc.x || e.x, ow: acc.ow || e.ow };
        if (e.to[0] !== 'X') { (cor[n] = cor[n] || []).push(Object.assign({ to: e.to }, nacc)); continue; }
        seen.add(e.to);
        const info = exitInfo[e.to], dd = DIRS[info.side], np = [info.pos[0] + dd[0], info.pos[1] + dd[1]];
        if (!G.dun.grid[gk(np)] && gk(info.pos) === n.split('|')[0]) open.push(Object.assign({ from: n, exit: e.to, pos: np, side: info.side, i: info.i }, nacc));
        walk(e.to, nacc);
        seen.delete(e.to);
      }
    };
    walk(n, { len: 0, d: false, x: false, ow: false });
  }
  for (const n in cor) { const best = {}; for (const e of cor[n]) { const o = best[e.to]; if (!o || cost(e) < cost(o)) best[e.to] = e; } cor[n] = Object.values(best); }
  G.dun._g = { rev: G.dun.order.length, adj, cor, open, exitInfo };
  return G.dun._g;
}
const cost = e => e.len + (e.d ? 1.5 : 0) + (e.x ? 1.5 : 0);
const startCells = G => Object.keys(D.tiles[0].cells).map(k => '0,0|' + k).filter(n => n !== GATE);
const isStart = n => n.startsWith('0,0|') && n !== GATE;
const isCursed = (G, n) => !!n && tileCell(G, n) === 'K';
const demonsAt = (G, n) => G.dun.demons.filter(d => d.node === n);

// ---------- player movement ----------
function moveOptions(G, p) {
  const T = G.turn, gph = graph(G), res = [];
  if (!p.pos || G.fight || G.dun.place || G.dun.portal) return res;
  const ftD = T.ft.some(f => f === 't' || f === 'a'), ftX = T.ft.some(f => f === 'a');
  for (const e of gph.cor[p.pos] || []) {
    if (e.to === GATE) continue;
    const o = { to: e.to, len: e.len, d: e.d, x: e.x, ow: e.ow };
    if (T.run > 0) o.run = true; else if (T.pool.step < e.len) o.no = 'گام کافی نیست';
    if (e.d && !(p.torch > 0 || ftD)) o.no = 'مشعل لازم است';
    if (e.x && !(p.pick > 0 || ftX)) o.no = 'کلنگ لازم است';
    res.push(o);
  }
  // teleport: any adjacent cell, ignoring corridor conditions and direction
  if (T.pool.tele > 0) {
    const adjU = new Set();
    for (const e of gph.cor[p.pos] || []) adjU.add(e.to);
    for (const n in gph.cor) for (const e of gph.cor[n]) if (e.to === p.pos) adjU.add(n);
    for (const n of adjU) if (n !== GATE) { const ex = res.find(r => r.to === n); if (ex && !ex.no) continue; if (ex) { ex.no = null; ex.tele = true; } else res.push({ to: n, tele: true }); }
  }
  return res;
}
function openExits(G, p) {
  const T = G.turn, gph = graph(G);
  if (!p.pos || G.fight || G.dun.place || G.dun.portal || !G.dun.pile.length) return [];
  const ftD = T.ft.some(f => f === 't' || f === 'a'), ftX = T.ft.some(f => f === 'a');
  return gph.open.filter(o => o.from === p.pos).map(o => {
    const r = { exit: o.exit, pos: o.pos, side: o.side, i: o.i, len: o.len, d: o.d, x: o.x };
    if (T.run > 0) r.run = true; else if (T.pool.step < o.len) r.no = 'گام کافی نیست';
    if (o.d && !(p.torch > 0 || ftD)) r.no = 'مشعل لازم است';
    if (o.x && !(p.pick > 0 || ftX)) r.no = 'کلنگ لازم است';
    return r;
  });
}
function payCorridor(G, p, o) {
  const T = G.turn;
  if (o.tele) { T.pool.tele--; return; }
  if (T.run > 0) T.run--; else T.pool.step -= o.len;
  if (o.d) { const i = T.ft.findIndex(f => f === 't' || f === 'a'); if (p.torch > 0 && i < 0) p.torch--; else if (i >= 0) T.ft.splice(i, 1); else p.torch--; }
  if (o.x) { const i = T.ft.findIndex(f => f === 'a'); if (i >= 0) T.ft.splice(i, 1); else p.pick--; }
}
function move(G, p, to, tele) {
  const opts = moveOptions(G, p); let o = opts.find(x => x.to === to && (tele ? x.tele : !x.tele)) || opts.find(x => x.to === to);
  if (!o) return 'به آن خانه راه نداری'; if (o.no) return o.no;
  payCorridor(G, p, o);
  p.pos = to;
  const mid = G.turn.run > 0 && !o.tele;
  arrive(G, p, to, !mid);
  return null;
}
// cell effects (rulebook 9-4 table). final=false while running (only the last cell of a run counts).
function arrive(G, p, n, final) {
  const dm = demonsAt(G, n);
  if (dm.length) { G.turn.run = 0; startFight(G, p, dm[0].id, false); return; }
  if (!final) return;
  G.turn.run = 0;
  const L = G.dun.loot[n];
  if (L) {
    if (L.chest) { delete G.dun.loot[n]; openChest(G, p); }
    else { const g = {}; for (const r of ['coin', 'scroll', 'ess']) if (L[r]) g[r] = L[r]; for (const r in g) G.turn.pool[r] += g[r]; delete G.dun.loot[n]; _.log(G, p.name + ' ' + Object.entries(g).map(([r, v]) => fa(v) + ' ' + Game.RES[r]).join(' و ') + ' برداشت.'); }
  }
  const v = tileCell(G, n);
  if (v === 'P') portalChoice(G, p, false);
  else if (v === 'F') _.askRemove(G, p, 'rm', 'چشمهٔ پالایش', 'یک کارت از دست یا دستهٔ سوخته را حذف کن.');
}
function canEndHere(G, p) {
  if (!p.pos) return null;
  if (G.dun.place || G.dun.portal) return 'کار سیاه‌چال نیمه‌تمام است';
  if (!isStart(p.pos) && G.players.some(q => q !== p && q.pos === p.pos)) return 'نمی‌توانی روی خانهٔ بازیکن دیگر بایستی. جلوتر برو.';
  return null;
}

// ---------- exploring ----------
function reveal(G, p, exit) {
  const o = openExits(G, p).find(x => x.exit === exit); if (!o) return 'این خروجی باز نیست'; if (o.no) return o.no;
  payCorridor(G, p, o);
  const T = G.turn; const n = T.flags.eye && T.steps ? 2 : 1;
  const tiles = G.dun.pile.splice(0, Math.min(n, G.dun.pile.length));
  const need = [OPP[o.side], o.i];
  G.dun.place = { pid: p.id, pos: o.pos, need, from: o.exit, choices: tiles, t: tiles[0], ri: 0, rots: rotsFor(tiles[0], need) };
  if (tiles.length > 1) _.ask(G, p.id, 'eyePick', { title: 'چشم سوم', text: 'یکی از دو تایل را انتخاب کن؛ دیگری زیر دسته می‌رود.', kind: 'tiles', opts: tiles.map(t => ({ v: t, tile: t })) });
  _.toast(G, p.name + ' تایل تازه‌ای رو کرد.', 'tile');
  return null;
}
function rotsFor(ti, need) {
  const t = D.tiles[ti], res = [];
  for (let r = 0; r < 4; r++) for (const [a, b, k] of t.cors) {
    for (const [j, e] of [[0, a], [1, b]]) {
      if (!isExit(e)) continue;
      const enter = j === 1 ? !k.endsWith('o') : !k.endsWith('i');   // can a figure come IN through this exit end?
      const re = rotExit(e, r);
      if (enter && re[0] === need[0] && re[1] === need[1] && !res.includes(r)) res.push(r);
    }
  }
  return res;
}
_.H.eyePick = (G, pid, v) => {
  const pl = G.dun.place; if (!pl || !pl.choices.includes(v)) return false;
  for (const t of pl.choices) if (t !== v) G.dun.pile.push(t);
  pl.t = v; pl.choices = [v]; pl.rots = rotsFor(v, pl.need); pl.ri = 0; return true;
};
function placeTile(G, p) {
  const pl = G.dun.place; if (!pl) return 'تایلی برای گذاشتن نیست';
  if (!pl.rots.length) { G.dun.pile.push(pl.t); G.dun.place = null; return null; }
  const r = pl.rots[pl.ri % pl.rots.length], k = gk(pl.pos);
  G.dun.grid[k] = { t: pl.t, r }; G.dun.order.push(k); G.dun._g = null;
  const t = D.tiles[pl.t];
  // put what the tile shows on its cells; every unknown (?) demon gets its own question, its cell marked on the map
  const qs = [];
  for (const ck in t.cells) {
    const v = t.cells[ck], c = rotCell(ck.split(',').map(Number), r), n = key(pl.pos, c);
    if (D.rules.loot[v]) G.dun.loot[n] = Object.assign({}, D.rules.loot[v]);
    else if (v === 'T') G.dun.loot[n] = { chest: 1 };
    else if (_.DEMON_LV[v]) G.dun.demons.push({ id: ++G.dun.did, node: n, lv: _.DEMON_LV[v] });
    else if (v === 'Q') qs.push(n);
  }
  qs.forEach((n, j) => _.ask(G, p.id, 'qDemon', { title: 'اهریمن نامعلوم' + (qs.length > 1 ? ' ' + fa(j + 1) + ' از ' + fa(qs.length) : ''), text: (qs.length > 1 ? 'این تایل ' + fa(qs.length) + ' اهریمن نامعلوم دارد. ' : '') + 'سطح اهریمن خانهٔ چشمک‌زن را تو تعیین می‌کنی.', opts: [1, 2, 3].map(l => ({ v: l, label: 'اهریمن ' + _.LV_NAME[l] })), data: { n } }));
  G.dun.place = null;
  _.log(G, p.name + ' تایل «' + t.name + '» را گذاشت.');
  // the figure walks into the new tile's cell linked to the exit it came through
  const gph = graph(G), target = (gph.cor[p.pos] || []).find(e => posOf(e.to).join(',') === k && !e.ow || posOf(e.to).join(',') === k);
  G.dun.enter = { pid: p.id, to: target ? target.to : null };
  if (!G.prompts.some(q => q.k === 'qDemon')) finishEnter(G);
  return null;
}
function finishEnter(G) {
  const e = G.dun.enter; if (!e) return; G.dun.enter = null;
  const p = _.P(G, e.pid); if (!e.to) return;
  p.pos = e.to; arrive(G, p, e.to, !(G.turn && G.turn.run > 0));
}
_.H.qDemon = (G, pid, v, q) => { if (![1, 2, 3].includes(v)) return false; G.dun.demons.push({ id: ++G.dun.did, node: q.data.n, lv: v }); if (!G.prompts.some(x => x.k === 'qDemon' && x !== q)) finishEnter(G); return true; };

// ---------- portals ----------
function portalTargets(G, p, spell) {
  const list = [];
  for (const k of G.dun.order) {
    const g = G.dun.grid[k], t = D.tiles[g.t], pos = k.split(',').map(Number), cells = [];
    for (const ck in t.cells) { if (t.cells[ck] !== 'P') continue; const n = key(pos, rotCell(ck.split(',').map(Number), g.r)); if (n !== p.pos && n !== GATE) cells.push(n); }
    if (cells.length) list.push({ tile: k, t: g.t, cells });
  }
  return list;
}
function portalChoice(G, p, spell) {
  const list = portalTargets(G, p, spell); if (!list.length) return;
  G.dun.portal = { pid: p.id, list, i: 0, spell: !!spell };
}
function portalGo(G, p, n) {
  const po = G.dun.portal; if (!po) return 'پورتالی باز نیست';
  if (!po.list.some(x => x.cells.includes(n))) return 'این خانه پورتال مقصد نیست';
  if (!isStart(n) && G.players.some(q => q !== p && q.pos === n)) return 'آن پورتال جای بازیکن دیگری است';
  G.dun.portal = null; p.pos = n; _.log(G, p.name + ' با پورتال رفت.');
  const dm = demonsAt(G, n); if (dm.length) startFight(G, p, dm[0].id, false);
  return null;
}

// ---------- treasure ----------
function openChest(G, p) {
  if (!G.treasures.length) return;
  const tr = G.treasures.shift(); p.chests++;
  const nm = _.TREASURE_NAME[tr];
  _.toast(G, p.name + ' صندوقچه را باز کرد: ' + nm, 'chest');
  G.lastChest = { n: ++G.ev, pid: p.id, tr };
  if (tr === 'wand3' || tr === 'wand4') p.wand = Math.max(p.wand, tr === 'wand3' ? 3 : 4);
  else if (_.ITEMS[tr]) { p.items.push(tr); if (p.items.length > _.slotN(p)) _.askSlots(G, p, false); }
  else if (tr === 'fame5') _.addFame(G, p, 5, 'گنجینه');
  else if (tr === 'fame3') _.addFame(G, p, 3, 'گنجینه');
  else if (tr === 'm6') p.discard.push({ u: ++G.uid, c: 'm6' });
  else if (tr === 'freeup') {
    const opts = Object.keys(Game.UPGRADES).filter(k => k === 'wand2' ? p.wand < 2 : !p.ups[k]).map(k => ({ v: k, label: Game.UPGRADES[k].name + ' · ' + Game.UPGRADES[k].txt }));
    if (opts.length) _.ask(G, p.id, 'freeUp', { title: 'ارتقای رایگان', text: 'یک ارتقای برد شخصی را بدون هزینه انجام بده.', opts });
  }
}
_.H.freeUp = (G, pid, v) => !_.upgrade(G, _.P(G, pid), v, true);

// ---------- demon fight (rulebook 9-5) ----------
function startFight(G, p, did, far) {
  const d = G.dun.demons.find(x => x.id === did); if (!d) return;
  G.fight = { pid: p.id, did, lv: d.lv, far: !!far, cards: [], pending: null, mirror: false, n: ++G.ev, result: null };
  _.toast(G, p.name + ' با اهریمن ' + _.LV_NAME[d.lv] + ' می‌جنگد.', 'fight');
  revealDemon(G);
}
function revealDemon(G) {
  const F = G.fight;
  if (!G.demonDeck.length) { G.demonDeck = _.shuffle(G, D.demons.map((_, i) => i).filter(i => !F.cards.some(c => c.ci === i))); }
  const ci = G.demonDeck.shift(), sec = D.demons[ci][_.LV_KEY[F.lv]];
  F.cards.push({ ci, def: sec[0], rew: sec[1], paid: false, n: ++G.ev });
  F.pending = F.cards.length - 1;
}
function fightAct(G, p, a) {
  const F = G.fight, T = G.turn;
  if (!F || F.pid !== p.id) return 'نبردی نیست';
  const cur = F.pending != null ? F.cards[F.pending] : null;
  if (a.t === 'f_pay') { if (!cur) return 'کارتی برای پرداخت نیست'; if (T.pool.power < cur.def) return 'قدرت کافی نیست'; T.pool.power -= cur.def; cur.paid = true; F.pending = null; return null; }
  if (a.t === 'f_next') { if (cur) return 'اول دفاع این کارت را بپرداز'; revealDemon(G); return null; }
  if (a.t === 'f_stop') { if (cur) return 'اول دفاع این کارت را بپرداز'; return winFight(G, p); }
  if (a.t === 'f_lose') { if (!cur) return 'کارتی برای شکست نیست'; return loseFight(G, p); }
  if (a.t === 'f_mirror') { if (!cur || F.mirror || !_.hasItem(p, 'mirror')) return 'آینهٔ دگرگونی در دسترس نیست'; F.mirror = true; G.demonDeck.push(cur.ci); F.cards.pop(); revealDemon(G); return null; }
  if (a.t === 'f_luck') { if (!cur || !T.flags.luck) return 'بخت دوباره در دسترس نیست'; T.flags.luck = 0; G.demonDeck.push(cur.ci); F.cards.pop(); revealDemon(G); return null; }
  return 'کار ناشناخته';
}
// turn timer ran out: close whatever the player left open in the dungeon
function forceEnd(G, p) {
  const F = G.fight;
  if (F && F.pid === p.id) { const cur = F.pending != null ? F.cards[F.pending] : null; if (cur) loseFight(G, p); else if (F.cards.some(c => c.paid)) winFight(G, p); else endFight(G); }
  if (G.fight) endFight(G);
  if (G.dun.place) placeTile(G, p);
  if (G.dun.portal) G.dun.portal = null;
  if (G.turn) { G.turn.run = 0; G.turn.forced = null; }
}
function endFight(G) { const F = G.fight; for (const c of F.cards) G.demonDeck.push(c.ci); G.demonDeck = _.shuffle(G, G.demonDeck); G.lastFight = Object.assign({}, F); G.fight = null; if (G.turn && G.turn.forced === F.did) G.turn.forced = null; }
function winFight(G, p) {
  const F = G.fight, paid = F.cards.filter(c => c.paid);
  if (!paid.length) return 'هنوز هیچ کارتی را شکست نداده‌ای';
  const tot = {};
  for (const c of paid) for (const k in c.rew) tot[k] = (tot[k] || 0) + c.rew[k];
  const got = Math.min(F.lv, G.huntLeft != null ? G.huntLeft : F.lv);   // limited supply of hunt tokens (30)
  p.hunt += got; if (G.huntLeft != null) G.huntLeft -= got;
  if (F.lv === 3) p.red = (p.red || 0) + 1;
  G.dun.demons = G.dun.demons.filter(d => d.id !== F.did);
  F.result = { win: true, rew: tot };
  _.toast(G, p.name + ' اهریمن ' + _.LV_NAME[F.lv] + ' را شکست داد و ' + (got ? fa(got) + ' توکن شکار گرفت.' : 'توکن شکاری نماند.'), 'win');
  endFight(G);
  giveRewards(G, p, tot);
  nextFightHere(G, p);
  return null;
}
function giveRewards(G, p, tot) {
  const T = G.turn;
  if (tot.f) _.addFame(G, p, tot.f, 'پاداش اهریمن');
  if (tot.e) T.pool.ess += tot.e;
  if (tot.st) T.pool.step += tot.st;
  if (tot.tp) T.pool.tele += tot.tp;
  if (tot.dr) _.drawCards(G, p, tot.dr);
  for (let k = 0; k < (tot.t || 0); k++) addToken(G, p, 'torch');
  for (let k = 0; k < (tot.b || 0); k++) addToken(G, p, 'pick');
  for (let k = 0; k < (tot.c || 0); k++) _.ask(G, p.id, 'rewCS', { title: 'پاداش اهریمن', text: '۱ سکه یا ۱ طومار؟', opts: [{ v: 'coin', label: '۱ سکه' }, { v: 'scroll', label: '۱ طومار' }] });
  for (let k = 0; k < (tot.tb || 0); k++) _.ask(G, p.id, 'rewTB', { title: 'پاداش اهریمن', text: 'مشعل یا کلنگ؟', opts: [{ v: 'torch', label: 'مشعل' }, { v: 'pick', label: 'کلنگ' }] });
  for (let k = 0; k < (tot.rm || 0); k++) _.askRemove(G, p, 'rm', 'پاداش اهریمن', 'یک کارت از دست یا دستهٔ سوخته را حذف کن.');
}
function addToken(G, p, k) { if (p.torch + p.pick >= D.rules.tokenMax) { _.log(G, p.name + ' جای خالی برای ' + (k === 'torch' ? 'مشعل' : 'کلنگ') + ' نداشت.'); return; } p[k]++; }
_.H.rewCS = (G, pid, v) => { if (!['coin', 'scroll'].includes(v)) return false; G.turn.pool[v]++; return true; };
_.H.rewTB = (G, pid, v) => { if (!['torch', 'pick'].includes(v)) return false; addToken(G, _.P(G, pid), v); return true; };
function loseFight(G, p) {
  const F = G.fight, T = G.turn;
  F.result = { win: false };
  const shelter = T && T.flags.shelter;
  if (!shelter) wound(G, p, 'شکست در نبرد');
  _.toast(G, p.name + ' در نبرد با اهریمن ' + _.LV_NAME[F.lv] + ' شکست خورد' + (shelter ? ' (پناه: زخم نگرفت).' : ' و ۱ زخم گرفت.'), 'lose');
  const did = F.did;
  endFight(G);
  demonStep(G, did);
  return null;
}
function nextFightHere(G, p) { if (G.fight) return; const dm = demonsAt(G, p.pos); if (dm.length && G.turn && G.turn.pid === p.id) startFight(G, p, dm[0].id, false); }
function wound(G, p, why) { p.discard.push({ u: ++G.uid, c: 'W' }); _.log(G, p.name + ' ۱ کارت زخم گرفت (' + why + ').'); }
function farStrike(G, p) {
  const gph = graph(G), adjU = new Set();
  for (const e of gph.cor[p.pos] || []) adjU.add(e.to);
  for (const n in gph.cor) for (const e of gph.cor[n]) if (e.to === p.pos) adjU.add(n);
  const ds = G.dun.demons.filter(d => adjU.has(d.node));
  if (!ds.length) { _.log(G, 'اهریمنی در خانه‌های مجاور نبود.'); return; }
  _.ask(G, p.id, 'far', { title: 'ضربهٔ دوربرد', text: 'با کدام اهریمن مجاور می‌جنگی؟', opts: ds.map(d => ({ v: d.id, label: 'اهریمن ' + _.LV_NAME[d.lv] + ' · ' + cellName(G, d.node) })) });
}
_.H.far = (G, pid, v) => { if (!G.dun.demons.some(d => d.id === v)) return false; startFight(G, _.P(G, pid), v, true); return true; };

// ---------- demon movement (rulebook 10) ----------
function distTo(G, goal) {
  const gph = graph(G), rev = {};
  for (const n in gph.cor) for (const e of gph.cor[n]) (rev[e.to] = rev[e.to] || []).push(n);
  const dist = { [goal]: 0 }, q = [goal];
  while (q.length) { const b = q.shift(); for (const a of rev[b] || []) if (!(a in dist)) { dist[a] = dist[b] + 1; q.push(a); } }
  return dist;
}
function undirectedDist(G, from) {
  const gph = graph(G), nb = {};
  for (const n in gph.cor) for (const e of gph.cor[n]) { (nb[n] = nb[n] || new Set()).add(e.to); (nb[e.to] = nb[e.to] || new Set()).add(n); }
  const dist = { [from]: 0 }, q = [from];
  while (q.length) { const b = q.shift(); for (const a of nb[b] || []) if (!(a in dist)) { dist[a] = dist[b] + 1; q.push(a); } }
  return dist;
}
// one corridor toward the gate; ties: the path toward the nearest player, then the player with fewer hunt tokens, then turn order
function demonStep(G, did) {
  const d = G.dun.demons.find(x => x.id === did); if (!d) return;
  const gph = graph(G), dist = distTo(G, GATE);
  if (!(d.node in dist) || dist[d.node] === 0) return;
  let cand = (gph.cor[d.node] || []).map(e => e.to).filter(n => dist[n] === dist[d.node] - 1);
  cand = [...new Set(cand)];
  if (!cand.length) return;
  if (cand.length > 1) {
    const score = n => { const u = undirectedDist(G, n); let best = null; for (const id of G.order) { const p = _.P(G, id); if (!p.pos || !(p.pos in u)) continue; const s = [u[p.pos], p.hunt, G.order.indexOf(id)]; if (!best || s[0] < best[0] || (s[0] === best[0] && (s[1] < best[1] || (s[1] === best[1] && s[2] < best[2])))) best = s; } return best || [999, 999, 999]; };
    cand.sort((a, b) => { const x = score(a), y = score(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  }
  const to = cand[0];
  d.node = to; d.moved = (d.moved || 0) + 1;
  if (to === GATE) { breach(G, d); return; }
  for (const p of G.players) if (p.pos === to) {
    _.ask(G, p.id, 'demonHere', { title: 'اهریمن به خانه‌ات رسید!', text: 'اهریمن ' + _.LV_NAME[d.lv] + ' به خانهٔ تو آمد. باید در شروع نوبت بعدت با او بجنگی، یا همین حالا انصراف بدهی (۱ زخم و اهریمن ۱ خانه جلو می‌رود).', opts: [{ v: 'fight', label: 'می‌جنگم (شروع نوبت بعدم)' }, { v: 'concede', label: 'انصراف: ۱ زخم' }], data: { did: d.id } });
  }
}
_.H.demonHere = (G, pid, v, q) => {
  const p = _.P(G, pid), d = G.dun.demons.find(x => x.id === q.data.did);
  if (!['fight', 'concede'].includes(v)) return false;
  if (!d || d.node !== p.pos) return true;
  if (v === 'fight') {
    if (G.turn && G.turn.pid === pid && G.phase === 'turn') { if (!G.fight) startFight(G, p, d.id, false); else G.turn.forced = d.id; }
    else p.pendingFight = d.id;
  } else { if (_.hasHP(p, 'hp_gate')) _.log(G, p.name + ' (نگهبان دروازه) بدون زخم انصراف داد.'); else wound(G, p, 'انصراف از نبرد'); demonStep(G, d.id); }
  return true;
};
function breach(G, d) {
  G.dun.demons = G.dun.demons.filter(x => x !== d);
  const min = Math.min(...G.players.map(p => p.hunt));
  const hit = G.players.filter(p => p.hunt === min);
  const got = [], all = D.rules.breachMode === 'all';
  // two versions, chosen in the editor (Farshad 2026-11-05): 'min' = fewest hunt tokens take 1 wound;
  // 'all' = every player takes 1 wound and the fewest hunt tokens lose 1 fame point
  const wounded = all ? G.players : hit;
  for (const p of wounded) { if (p.shield) continue; wound(G, p, 'رخنه'); got.push(p.name); }
  const lostF = [];
  if (all) for (const p of hit) { if (p.shield) continue; if (p.fame > 0) { p.fame -= 1; } lostF.push(p.name); }
  G.lastBreach = { n: ++G.ev, lv: d.lv, mode: all ? 'all' : 'min', hit: wounded.map(p => p.id), fameLost: all ? hit.filter(p => !p.shield).map(p => p.id) : [], shielded: wounded.filter(p => p.shield).map(p => p.id) };
  _.toast(G, 'رخنه! اهریمن ' + _.LV_NAME[d.lv] + ' به دروازهٔ شهر رسید' + (got.length ? ' · زخم: ' + got.join('، ') : '') + (lostF.length ? ' · ۱ امتیاز کم شد: ' + lostF.join('، ') : ''), 'breach');
}
// one demon of the night raid moves one corridor (the night list runs them one by one)
function nightMoveOne(G, id) {
  const d = G.dun.demons.find(x => x.id === id); if (!d) return null;
  const from = d.node; demonStep(G, id); const d2 = G.dun.demons.find(x => x.id === id);
  const m = { id, lv: d.lv, from, to: d2 ? d2.node : GATE, breach: !d2 };
  (G.nightMoves = G.nightMoves || []).push(m); return m;
}
function nightMove(G) {
  G.nightMoves = [];
  const ids = G.dun.demons.map(d => d.id);
  for (const id of ids) { const d = G.dun.demons.find(x => x.id === id); if (!d) continue; const from = d.node; demonStep(G, id); const d2 = G.dun.demons.find(x => x.id === id); G.nightMoves.push({ id, lv: d.lv, from, to: d2 ? d2.node : GATE }); }
  _.log(G, 'هجوم شبانه: ' + fa(ids.length) + ' اهریمن یک راهرو پیش رفتند.');
}

// ---------- actions ----------
function act(G, p, a) {
  if (a.t.startsWith('f_')) return fightAct(G, p, a);
  if (G.fight) return 'اول نبرد را تمام کن';
  if (G.turn.forced != null && a.t !== 'd_fight') return 'اول باید با اهریمن خانه‌ات بجنگی';
  switch (a.t) {
    case 'd_fight': { const d = G.dun.demons.find(x => x.id === G.turn.forced); if (!d) { G.turn.forced = null; return null; } startFight(G, p, d.id, false); return null; }
    case 'd_move': return move(G, p, a.to, !!a.tele);
    case 'd_runend': if (G.turn.run > 0) { G.turn.run = 0; arrive(G, p, p.pos, true); } return null;
    case 'd_reveal': return reveal(G, p, a.exit);
    case 'd_rot': if (!G.dun.place) return 'تایلی نیست'; G.dun.place.ri = (G.dun.place.ri + (a.dir || 1) + G.dun.place.rots.length * 4) % Math.max(1, G.dun.place.rots.length); return null;
    case 'd_place': return placeTile(G, p);
    case 'd_pnext': if (!G.dun.portal) return 'پورتالی نیست'; G.dun.portal.i = (G.dun.portal.i + (a.dir || 1) + G.dun.portal.list.length) % G.dun.portal.list.length; return null;
    case 'd_pgo': return portalGo(G, p, a.n);
    case 'd_pcancel': if (G.dun.portal) { const sp = G.dun.portal.spell; G.dun.portal = null; } return null;
  }
  return 'کار ناشناخته';
}


// sound cues (see engine sfx)
{ const W = (f, k) => function (G) { const r = f.apply(this, arguments); if (r == null || r === true) _.sfx(G, k); return r; };
  move = W(move, 'step'); placeTile = W(placeTile, 'tile'); openChest = W(openChest, 'chest'); startFight = W(startFight, 'fight');
  winFight = W(winFight, 'fightWin'); loseFight = W(loseFight, 'fightLose'); wound = W(wound, 'wound'); }
const Dun = { init, graph, startCells, cellName, tileCell, isCursed, isStart, moveOptions, openExits, canEndHere, portalChoice, farStrike, nightMove, nightMoveOne, forceEnd, GATE, act, demonsAt, rotCell, rotExit, posOf, cellOf, key, GATE, CELLNAME };
root.Dun = Dun;
if (typeof module !== 'undefined') module.exports = Dun;
})(typeof window !== 'undefined' ? window : global);
