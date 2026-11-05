// 12 Nights digital: game engine (rules v13 + CHANGELOG rows 1-91).
// Server-authoritative state machine. Every player input is act(pid, action) and every question is a prompt in G.prompts.
// State is plain JSON (saved to disk after every action); handlers are looked up by name so the state stays serialisable.
(function (root) {
'use strict';
const D = root.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = n => String(n).replace(/\d/g, d => FA[d]).replace('-', '−');
const RES = { coin: 'سکه', scroll: 'طومار', ess: 'جوهرهٔ تاریک' };
const R = D.rules;   // every rule number and table below comes from data/game.json (editable in the editor)
const HOUSES = R.houses;
const DIE = R.die.faces;
const DIE_NAME = R.die.names;
const UPGRADES = {}; for (const k in R.upgrades) { const u = R.upgrades[k]; UPGRADES[k] = Object.assign({}, u, { txt: u.before + ' ← ' + u.after }); }
const ITEMS = R.items;
const TREASURES = R.treasures.slice();
const TREASURE_NAME = Object.assign({}, R.treasureNames);
for (const k in ITEMS) TREASURE_NAME[k] = ITEMS[k].name;
const CHALLENGES = R.challenges;
const HP = R.housePowers || {};
// house power of a player (Farshad 2026-11-05: chosen per house in the editor; '' = none)
const housePower = p => { const h = HOUSES.find(x => x.id === p.house); return h && h.power && HP[h.power] ? h.power : ''; };
const hasHP = (p, k) => housePower(p) === k;
const byP = n => R.byPlayers[n] || R.byPlayers[Object.keys(R.byPlayers).pop()];
const DEMON_LV = { Y: 1, O: 2, R: 3 };
const LV_NAME = { 1: 'زرد', 2: 'نارنجی', 3: 'قرمز' };
const LV_KEY = { 1: 'y', 2: 'o', 3: 'r' };
const REWARD_NAME = { f: 'امتیاز شهرت', e: 'جوهرهٔ تاریک', c: 'سکه یا طومار', t: 'مشعل', b: 'کلنگ', tb: 'مشعل یا کلنگ', st: 'گام', tp: 'تله‌پورت', dr: 'کشیدن کارت', rm: 'حذف کارت' };

// ---------- random (seeded, kept in state) ----------
function rnd(G) { let t = (G.seed = (G.seed + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const card = id => id === 'W' ? Object.assign({ id: 'W', ty: 'wound', cost: {}, power: 0, strip: null }, R.wound) : D.cards[id];

// ---------- setup ----------
function newGame(opts) {
  const G = { v: 1, seed: (opts.seed != null ? opts.seed : Date.now()) | 0, phase: 'setup', uid: 0, log: [], toasts: [], prompts: [], pid: 0,
    cfg: { bf: !!opts.bf }, night: 1, players: [], order: [], first: 0, cur: 0, turn: null, fight: null, battle: null, dun: null, ev: 0 };
  const nP = opts.players.length;
  const BP = byP(nP);
  G.cfg.nights = BP.nights;
  opts.players.forEach((p, i) => G.players.push(newPlayer(G, p, i)));
  G.players.forEach(p => applyHouse(G, p));
  G.order = shuffle(G, G.players.map(p => p.id));   // random player order (Farshad 2026-11-05)
  // academy
  const deck = [];
  for (const c of Object.values(D.cards)) if (c.deck === 'academy')
    for (let k = 0; k < c.count; k++) deck.push(c.id);
  G.acad = { deck: shuffle(G, deck), row: [], discard: [], fixed: Object.fromEntries(Object.values(D.cards).filter(c => c.deck === 'fixed').map(c => [c.id, (c.perPlayer || 0) * nP + (c.count || 0)])), seal: {} };
  // city wizards: level 1 shuffled on top of level 2+3 shuffled
  const W = Object.values(D.wizards).filter(w => w.g !== 'N');
  const l1 = shuffle(G, W.filter(w => w.L === 1).map(w => w.id)), l23 = shuffle(G, W.filter(w => w.L > 1).map(w => w.id));
  G.hall = { deck: l1.concat(l23), row: [], reserved: {}, gone: [] };
  for (let i = 0; i < R.hallSize; i++) G.hall.row.push({ id: G.hall.deck.shift(), tok: 0 });
  G.demonDeck = shuffle(G, D.demons.map((_, i) => i));
  G.treasures = shuffle(G, TREASURES.slice());
  G.bfDeck = G.cfg.bf ? shuffle(G, D.battlefield.map(b => b.id)) : [];
  // challenge tokens
  const early = shuffle(G, Object.keys(CHALLENGES).filter(k => CHALLENGES[k].kind === 'early' && CHALLENGES[k].active !== false));
  const late = shuffle(G, Object.keys(CHALLENGES).filter(k => CHALLENGES[k].kind === 'late' && CHALLENGES[k].active !== false));
  G.chal = {}; const pick = { early: early.slice(), late: late.slice() };
  for (const n in BP.chal) { const k = BP.chal[n]; G.chal[n] = pick[k] ? pick[k].shift() : k; }
  G.battleNights = BP.battle.slice();
  G.huntLeft = R.huntTokens != null ? R.huntTokens : 999;   // demon-hunt token supply (Farshad 2026-11-05: 30)
  Dun.init(G);
  fillAcademy(G, true);
  G.phase = 'start';   // players pick a starting portal around the gate, in turn order
  G.cur = 0;
  log(G, 'بازی شروع شد. ترتیب بازیکنان: ' + G.order.map(i => P(G, i).name).join('، '));
  askStart(G);
  return G;
}
function newPlayer(G, p, i) {
  const deck = [];
  for (const id of R.startDeck) deck.push({ u: ++G.uid, c: id });
  const h = HOUSES.find(x => x.id === p.house) || HOUSES[i];
  return { id: i, name: p.name || ('بازیکن ' + fa(i + 1)), house: h.id, color: h.color,
    deck: shuffle(G, deck), hand: [], discard: [], removed: [], played: [], keep: [],
    wiz: R.startWizards.slice(), store: Object.assign({ coin: 0, scroll: 0, ess: 0 }, R.startStore), ups: {}, wand: R.startWand, torch: R.startTorch, pick: R.startPick,
    items: [], fame: 0, hunt: 0, chests: 0, curse: 0, red: 0, pos: null, pendingFight: null, shield: false, hp: '' };
}
// house start resources (on top of the common start) and power
function applyHouse(G, p) {
  const h = HOUSES.find(x => x.id === p.house) || {}, st = h.start || {};
  for (const r of ['coin', 'scroll', 'ess']) if (st[r]) p.store[r] = Math.min(cap(p, r), p.store[r] + st[r]);
  for (const k of ['torch', 'pick']) for (let i = 0; i < (st[k] || 0); i++) if (p.torch + p.pick < R.tokenMax) p[k]++;
  p.hp = housePower(p);
}
const P = (G, id) => G.players[id];
const curP = G => G.players[G.order[G.cur]];
function log(G, t) { G.log.push({ n: ++G.ev, t }); if (G.log.length > 80) G.log.shift(); }
function toast(G, t, kind) { G.toasts.push({ n: ++G.ev, t, kind: kind || '' }); if (G.toasts.length > 12) G.toasts.shift(); log(G, t); }
const cap = (p, r) => p.ups[{ coin: 'capCoin', scroll: 'capScroll', ess: 'capEss' }[r]] ? R.storeUp : R.storeBase;
const activeItems = p => p.items.slice(0, p.ups.slot2 ? 2 : 1);
const hasItem = (p, k) => activeItems(p).includes(k);

// ---------- prompts ----------
// prompt: {id, to, k (handler), title, text, opts:[{v,label,dis}], data, min, max, many, card...}
function ask(G, to, k, o) { const q = Object.assign({ id: ++G.pid, to, k }, o); G.prompts.push(q); return q; }
const myPrompt = (G, pid) => G.prompts.find(q => q.to === pid);
const H = {};   // prompt handlers: H[k](G, pid, value, q)

// ---------- academy ----------
function fillAcademy(G, setup) {
  while (G.acad.row.length < R.acadRow) {
    if (!G.acad.deck.length) { if (!G.acad.discard.length) break; G.acad.deck = shuffle(G, G.acad.discard); G.acad.discard = []; log(G, 'دک آکادمی تمام شد و دستهٔ سوختهٔ آکادمی بُر خورد.'); }
    const id = G.acad.deck.shift();
    if (D.cards[id].ty === 'crystal') {
      if (setup) { G.acad.discard.push(id); continue; }   // during setup a crystal challenge is simply replaced (no duel before the game starts)
      G.acad.row.push(id); duel(G); return;
    }
    G.acad.row.push(id);
  }
}
function removeFromRow(G, i) { const id = G.acad.row.splice(i, 1)[0]; const s = {}; for (const k in G.acad.seal) { const j = +k; if (j < i) s[j] = G.acad.seal[k]; else if (j > i) s[j - 1] = G.acad.seal[k]; } G.acad.seal = s; return id; }

// ---------- crystal duel ----------
function duel(G) {
  const res = [];
  for (const id of G.order) { const p = P(G, id); const rolls = Array.from({ length: R.duelDice }, () => rollFace(G, p.wand) + (hasItem(p, 'gem') ? 1 : 0)); res.push({ id, rolls, sum: rolls.reduce((a, b) => a + b, 0) }); }
  const best = Math.max(...res.map(r => r.sum));
  let W = res.filter(r => r.sum === best);
  if (W.length > 1) { const ring = W.filter(r => hasItem(P(G, r.id), 'ring')); W = ring.length === 1 ? ring : []; }
  const winner = W.length === 1 ? W[0].id : null;
  G.duel = { n: ++G.ev, res, winner };
  toast(G, 'چالش کریستال! دوئل: ' + res.map(r => P(G, r.id).name + ' ' + fa(r.sum)).join(' · ') + (winner == null ? ' · مساوی، کسی نبرد' : ' · برنده: ' + P(G, winner).name), 'duel');
  const i = G.acad.row.findIndex(id => D.cards[id].ty === 'crystal'); if (i >= 0) G.acad.discard.push(removeFromRow(G, i));
  if (winner != null) ask(G, winner, 'duelPrize', { title: 'برندهٔ دوئل کریستال', text: 'جایزه‌ات را انتخاب کن', opts: R.duelPrizes.map((x, i) => ({ v: i, label: x.label })) });
  fillAcademy(G);
}
H.duelPrize = (G, pid, v) => { const p = P(G, pid); const g = R.duelPrizes[v]; if (!g) return false; gain(G, p, g.gain); return true; };
// resources gained outside the owner's own turn go to the store (up to its capacity)
function gain(G, p, g) {
  const own = G.turn && curP(G) === p && G.phase === 'turn';
  for (const r in g) { if (own) G.turn.pool[r] = (G.turn.pool[r] || 0) + g[r]; else p.store[r] = Math.min(cap(p, r), p.store[r] + g[r]); }
}

// ---------- start positions ----------
function askStart(G) {
  if (G.cur >= G.order.length) { G.phase = 'turn'; G.cur = 0; startTurn(G); return; }
  const p = curP(G);
  ask(G, p.id, 'startCell', { title: 'جای شروع', text: 'فیگورت را روی یکی از ۸ پورتال دور دروازهٔ شهر بگذار.', kind: 'cell', opts: Dun.startCells(G).map(n => ({ v: n, label: Dun.cellName(G, n) })) });
}
H.startCell = (G, pid, v) => { if (!Dun.startCells(G).includes(v)) return false; P(G, pid).pos = v; log(G, P(G, pid).name + ' سر جایش در دروازهٔ شهر ایستاد.'); G.cur++; askStart(G); return true; };

// ---------- turn ----------
function drawCards(G, p, n) {
  let got = 0;
  for (let k = 0; k < n; k++) {
    if (!p.deck.length) { if (!p.discard.length) break; p.deck = shuffle(G, p.discard); p.discard = []; }
    p.hand.push(p.deck.shift()); got++;
  }
  return got;
}
function startTurn(G) {
  const p = curP(G);
  G.turn = { pid: p.id, ev0: G.ev, pool: { coin: 0, scroll: 0, ess: 0, power: 0, step: 0, tele: 0 }, played: [], die: null, dieUsed: false, reroll: 0, freeReroll: false,
    gob: false, swap: false, flags: {}, both: false, ft: [], run: 0, runFrom: null, steps: false, buyDiscard: false, fk: false, phoenix: false, startedAt: G.ev };
  let n = R.handSize + (p.ups.draw6 ? 1 : 0);
  if (hasItem(p, 'jam')) n++;
  if (p.curse) { n--; p.curse = 0; log(G, p.name + ' توکن نفرین داشت و ۱ کارت کمتر کشید.'); }
  p.hand = p.keep.concat(p.hand); p.keep = [];
  drawCards(G, p, n);
  toast(G, 'نوبت ' + p.name, 'turn');
  if (p.pendingFight != null) {
    const d = G.dun.demons.find(x => x.id === p.pendingFight);
    p.pendingFight = null;
    if (d && d.node === p.pos) { G.turn.forced = d.id; log(G, p.name + ' باید اول با اهریمن ' + LV_NAME[d.lv] + ' بجنگد.'); }
  }
}
// pay a cost from the pool first, then from the store (combined payment, rulebook 8)
function canPay(G, p, cost) {
  const pool = G.turn.pool;
  for (const r in cost) { const have = r === 'pow' ? pool.power : (pool[r] || 0) + (p.store[r] || 0); if (have < cost[r]) return false; }
  return true;
}
function pay(G, p, cost) {
  const pool = G.turn.pool;
  for (const r in cost) {
    if (r === 'pow') { pool.power -= cost[r]; continue; }
    let need = cost[r]; const a = Math.min(need, pool[r] || 0); pool[r] -= a; need -= a; p.store[r] -= need;
  }
}
const isTurn = (G, pid) => G.phase === 'turn' && G.turn && G.turn.pid === pid;
const busy = G => G.prompts.length > 0 || !!G.fight || !!(G.dun && G.dun.place);

// play a card from hand. mode: 'main' | 'strip'
function playCard(G, p, u, mode) {
  const i = p.hand.findIndex(x => x.u === u); if (i < 0) return 'کارت در دست نیست';
  const c = card(p.hand[i].c);
  if (c.ty === 'wound') return 'کارت زخم بازی نمی‌شود';
  if (G.turn.forced != null && !G.fight && c.ty !== 'magic') return 'اول باید نبرد با اهریمن را شروع کنی';
  if (G.fight && c.ty !== 'magic') return 'در نبرد فقط کارت جادو بازی می‌شود';
  const both = G.turn.both && (c.ty === 'prod' || c.ty === 'skill');
  if (mode === 'strip' && !c.strip && !both) return 'این کارت نوار سیاه‌چال ندارد';
  if (c.ty === 'magic') mode = 'main';
  p.hand.splice(i, 1); const inst = { u, c: c.id, mode: both ? 'both' : mode };
  G.turn.played.push(inst);
  if (both) G.turn.both = false;
  if (mode === 'main' || both) runMain(G, p, c);
  if (mode === 'strip' || both) runStrip(G, p, c);
  if (c.fx === 'k_both') G.turn.both = true;
  log(G, p.name + ' کارت «' + c.name + '» را ' + (both ? 'با هر دو بخش' : mode === 'strip' ? 'برای سیاه‌چال' : '') + ' بازی کرد.');
  return null;
}
function runStrip(G, p, c) {
  const s = c.strip; if (!s) return;
  const T = G.turn;
  if (hasHP(p, 'hp_path') && !T.flags.hpPath) { T.flags.hpPath = true; T.pool.step += 1; T.steps = true; log(G, p.name + ' (راه‌یاب) ۱ گام رایگان گرفت.'); }
  if (s.step) { T.pool.step += s.step; T.steps = true; }
  if (s.run) { T.run = 3; T.runFrom = p.pos; }
  if (s.tele) T.pool.tele += 1;
  if (s.eye) T.flags.eye = true;
  if (s.ft) T.ft.push(s.ft);
}
function runMain(G, p, c) {
  const T = G.turn, pool = T.pool;
  if (c.power) pool.power += c.power;
  generic(G, p, c);
  switch (c.fx) {
    case 'p_any3': ask(G, p.id, 'any3', { title: c.name, text: '۳ منبع به انتخاب خودت', opts: [[3, 0], [2, 1], [1, 2], [0, 3]].map(([a, b]) => ({ v: a, label: (a ? fa(a) + ' سکه' : '') + (a && b ? ' + ' : '') + (b ? fa(b) + ' طومار' : '') })) }); break;
    case 'scrollPow': if (pool.scroll + p.store.scroll > 0) ask(G, p.id, 'scrollPow', { title: c.name, text: '۱ طومار بدهی تا ۱+ قدرت بگیری؟', opts: [{ v: 1, label: 'بله، ۱ طومار بده' }, { v: 0, label: 'نه' }] }); break;
    case 'm4b': if (p.hand.length) ask(G, p.id, 'burnPow', { title: c.name, text: '۱ کارت از دستت را بسوزانی تا ۱+ قدرت بگیری؟', kind: 'cards', opts: p.hand.map(x => ({ v: x.u, card: x.c })).concat([{ v: 0, label: 'نمی‌سوزانم' }]) }); break;
    case 'm4_shelter': T.flags.shelter = true; break;
    case 'm4_luck': T.flags.luck = 1; break;
    case 'k_rmdraw': askRemove(G, p, 'rmDraw', c.name, '۱ کارت از دست یا دستهٔ سوخته را حذف کن، بعد ۱ کارت می‌کشی.'); break;
    case 'k_burndraw2': if (p.hand.length) ask(G, p.id, 'burnDraw', { title: c.name, text: '۱ کارت از دستت را بسوزان، بعد ۲ کارت می‌کشی.', kind: 'cards', opts: p.hand.map(x => ({ v: x.u, card: x.c })) }); break;
    case 'k_convert': askConvert(G, p, c.name, true); break;
    case 'k_gob2': T.flags.gob2 = true; break;
    case 'k_dieres': resRoll(G, p); break;
    case 'k_recover': if (p.discard.length) ask(G, p.id, 'toTop', { title: c.name, text: '۱ کارت از دستهٔ سوخته را روی دکت بگذار.', kind: 'cards', opts: p.discard.map(x => ({ v: x.u, card: x.c })) }); break;
    case 'k_dieup': T.flags.dieup = true; drawCards(G, p, 1); break;
    case 'k_diex2': T.flags.x2 = true; break;
    case 'k_die2': T.flags.twice = true; break;
    case 'k_alch': if (pool.coin + pool.scroll + p.store.coin + p.store.scroll >= 3) askAlch(G, p, c.name); break;
    case 'k_pick3': { const got = []; for (let k = 0; k < 3; k++) { if (drawCards(G, p, 1)) got.push(p.hand.pop()); } if (got.length) { T.pick3 = got; askPick3(G, p); } break; }
  }
}
// curse breaker: every removal also clears one wound card for free
function curseBreak(G, p) {
  if (!hasHP(p, 'hp_curse')) return;
  for (const pile of ['hand', 'discard', 'deck']) { const i = p[pile].findIndex(x => x.c === 'W'); if (i >= 0) { p.removed.push(p[pile].splice(i, 1)[0]); log(G, p.name + ' (نفرین‌شکن) یک کارت زخم را هم پاک کرد.'); return; } }
}
function askRemove(G, p, k, title, text, opt) {
  const opts = p.hand.map(x => ({ v: x.u, card: x.c, grp: 'دست' })).concat(p.discard.map(x => ({ v: x.u, card: x.c, grp: 'سوخته' })));
  if (!opts.length) { if (k === 'rmDraw') drawCards(G, p, 1); return; }
  ask(G, p.id, k, { title, text, kind: 'cards', opts: opts.concat([{ v: 0, label: opt || 'حذف نمی‌کنم' }]) });
}
function removeCard(G, p, u) {
  for (const pile of ['hand', 'discard']) { const i = p[pile].findIndex(x => x.u === u); if (i >= 0) { const x = p[pile].splice(i, 1)[0]; p.removed.push(x); log(G, p.name + ' کارت «' + card(x.c).name + '» را برای همیشه حذف کرد.'); curseBreak(G, p); return true; } }
  return false;
}
H.any3 = (G, pid, v) => { if (![0, 1, 2, 3].includes(v)) return false; G.turn.pool.coin += v; G.turn.pool.scroll += 3 - v; return true; };
H.scrollPow = (G, pid, v) => { const p = P(G, pid); if (v) { if (!canPay(G, p, { scroll: 1 })) return false; pay(G, p, { scroll: 1 }); G.turn.pool.power += 1; } return true; };
H.burnPow = (G, pid, v) => { const p = P(G, pid); if (v) { const i = p.hand.findIndex(x => x.u === v); if (i < 0) return false; p.discard.push(p.hand.splice(i, 1)[0]); G.turn.pool.power += 1; } return true; };
H.rmDraw = (G, pid, v) => { const p = P(G, pid); if (v && !removeCard(G, p, v)) return false; drawCards(G, p, 1); return true; };
H.rm = (G, pid, v) => { const p = P(G, pid); if (v && !removeCard(G, p, v)) return false; return true; };
H.burnDraw = (G, pid, v) => { const p = P(G, pid); const i = p.hand.findIndex(x => x.u === v); if (i < 0) return false; p.discard.push(p.hand.splice(i, 1)[0]); drawCards(G, p, 2); return true; };
H.toTop = (G, pid, v) => { const p = P(G, pid); const i = p.discard.findIndex(x => x.u === v); if (i < 0) return false; p.deck.unshift(p.discard.splice(i, 1)[0]); return true; };
function askConvert(G, p, title, draw) {
  const pool = G.turn.pool, tot = pool.coin + pool.scroll + p.store.coin + p.store.scroll;
  const opts = []; for (let c = 0; c <= tot; c++) opts.push({ v: c, label: fa(c) + ' سکه + ' + fa(tot - c) + ' طومار' });
  ask(G, p.id, 'convert', { title, text: 'سکه و طومارت (استخر و ذخیره) را به هر ترکیبی تبدیل کن.', opts, data: { draw }, def: pool.coin + p.store.coin });
}
H.convert = (G, pid, v, q) => {
  const p = P(G, pid), pool = G.turn.pool, tot = pool.coin + pool.scroll + p.store.coin + p.store.scroll;
  if (!(v >= 0 && v <= tot)) return false;
  // keep stored amounts where possible, the rest lives in the pool
  const sc = Math.min(p.store.coin, v), ss = Math.min(p.store.scroll, tot - v);
  p.store.coin = sc; p.store.scroll = ss; pool.coin = v - sc; pool.scroll = tot - v - ss;
  if (q.data.draw) drawCards(G, p, 1);
  return true;
};
function askAlch(G, p, title) {
  const pool = G.turn.pool, c = pool.coin + p.store.coin, s = pool.scroll + p.store.scroll, opts = [];
  for (let a = 0; a <= 3; a++) if (a <= c && 3 - a <= s) opts.push({ v: a, label: fa(a) + ' سکه + ' + fa(3 - a) + ' طومار ← ۱ جوهره' });
  opts.push({ v: -1, label: 'تبدیل نمی‌کنم' });
  ask(G, p.id, 'alch', { title, text: '۳ منبع (سکه و طومار) را به ۱ جوهرهٔ تاریک تبدیل کن.', opts });
}
H.alch = (G, pid, v) => { const p = P(G, pid); if (v === -1) return true; const cost = {}; if (v) cost.coin = v; if (3 - v) cost.scroll = 3 - v; if (!canPay(G, p, cost)) return false; pay(G, p, cost); G.turn.pool.ess += 1; return true; };
function askPick3(G, p) {
  const T = G.turn, step = 3 - T.pick3.length;
  if (!T.pick3.length) { delete T.pick3; return; }
  if (T.pick3.length === 1) { const lastStep = T.pick3Step || 0; const x = T.pick3.pop(); placePick3(p, x, ['hand', 'discard', 'top'].find(k => !(T.pick3Done || []).includes(k)) || 'hand'); delete T.pick3; delete T.pick3Done; return; }
  const left = ['hand', 'discard', 'top'].filter(k => !(T.pick3Done || []).includes(k));
  const what = left[0];
  const title = { hand: 'کدام کارت را نگه می‌داری (به دستت می‌آید)؟', discard: 'کدام کارت را می‌سوزانی؟', top: 'کدام کارت روی دکت برود؟' }[what];
  ask(G, p.id, 'pick3', { title: 'گزینش', text: title, kind: 'cards', opts: T.pick3.map(x => ({ v: x.u, card: x.c })), data: { what } });
}
function placePick3(p, x, what) { if (what === 'hand') p.hand.push(x); else if (what === 'discard') p.discard.push(x); else p.deck.unshift(x); }
H.pick3 = (G, pid, v, q) => { const p = P(G, pid), T = G.turn; const i = T.pick3.findIndex(x => x.u === v); if (i < 0) return false; placePick3(p, T.pick3.splice(i, 1)[0], q.data.what); (T.pick3Done = T.pick3Done || []).push(q.data.what); askPick3(G, p); return true; };

// ---------- wand die ----------
function rollFace(G, lv) { const f = DIE[Math.min(4, lv)]; return f[Math.floor(rnd(G) * 6)]; }
function dieValue(G, p, face) { let v = face + (hasItem(p, 'gem') ? 1 : 0); if (G.turn && G.turn.flags.x2) v *= 2; return v; }
function rollPower(G, p) {
  const T = G.turn; if (T.dieUsed) return 'تاس این نوبت را انداخته‌ای';
  const lv = p.wand + (T.flags.dieup ? 1 : 0);
  const faces = [rollFace(G, lv)]; if (T.flags.twice) faces.push(rollFace(G, lv));
  const vals = faces.map(f => dieValue(G, p, f));
  T.die = { lv, faces, vals, total: vals.reduce((a, b) => a + b, 0), n: ++G.ev, flags: { x2: !!T.flags.x2, twice: !!T.flags.twice, gem: hasItem(p, 'gem') } };
  T.dieUsed = true; T.pool.power += T.die.total;
  toast(G, p.name + ' تاس ' + DIE_NAME[Math.min(4, lv)] + ' انداخت: ' + vals.map(fa).join(' و ') + ' ← ' + fa(T.die.total) + ' قدرت', 'die');
  return null;
}
function reroll(G, p) {
  const T = G.turn; if (!T.die) return 'هنوز تاس نینداخته‌ای';
  const hpFree = hasHP(p, 'hp_luck') && !T.flags.hpLuck;
  const free = (hasItem(p, 'fate') && !T.freeReroll) || hpFree;
  if (!free) { if (T.reroll >= R.rerollMax) return 'بازانداختن بیشتر ممکن نیست'; if (!canPay(G, p, R.rerollCost)) return 'منابع بازانداختن کافی نیست'; }
  if (T.pool.power < T.die.total) return 'قدرت این تاس خرج شده و بازانداختن ممکن نیست';
  if (free) { if (hasItem(p, 'fate') && !T.freeReroll) T.freeReroll = true; else T.flags.hpLuck = true; } else { pay(G, p, R.rerollCost); T.reroll++; }
  T.pool.power -= T.die.total;
  const faces = T.die.faces.map(() => rollFace(G, T.die.lv)); const vals = faces.map(f => dieValue(G, p, f));
  T.die = Object.assign({}, T.die, { faces, vals, total: vals.reduce((a, b) => a + b, 0), n: ++G.ev, rer: true });
  T.pool.power += T.die.total;
  toast(G, p.name + ' تاس را دوباره انداخت: ' + vals.map(fa).join(' و ') + ' ← ' + fa(T.die.total) + ' قدرت', 'die');
  return null;
}
function resRoll(G, p) {
  const T = G.turn, lv = p.wand + (T.flags.dieup ? 1 : 0);
  const v = dieValue(G, p, rollFace(G, lv));
  T.resDie = { v, n: ++G.ev };
  toast(G, p.name + ' تاس منابع انداخت: ' + fa(v), 'die');
  if (v > 0) { const opts = []; for (let c = v; c >= 0; c--) opts.push({ v: c, label: fa(c) + ' سکه + ' + fa(v - c) + ' طومار' }); ask(G, p.id, 'resRoll', { title: 'تاس منابع: ' + fa(v), text: 'به همین اندازه سکه یا طومار بگیر.', opts, data: { v } }); }
}
H.resRoll = (G, pid, v, q) => { if (!(v >= 0 && v <= q.data.v)) return false; G.turn.pool.coin += v; G.turn.pool.scroll += q.data.v - v; return true; };

// ---------- buy ----------
function buy(G, p, src, i) {
  const T = G.turn; let id;
  if (src === 'fixed') { id = i; if (!G.acad.fixed[id]) return 'این ردیف تمام شده'; }
  else if (src === 'row') { id = G.acad.row[i]; if (!id) return 'کارت نیست'; const s = G.acad.seal[i]; if (s && s.pid !== p.id) return 'این کارت مهر آکادمی بازیکن دیگری را دارد'; }
  else if (src === 'discard') { if (!T.buyDiscard) return 'اجازهٔ خرید از سوخته‌های آکادمی نداری'; id = G.acad.discard[i]; if (!id) return 'کارت نیست'; }
  const c = D.cards[id];
  if (c.ty === 'crystal') return 'چالش کریستال خریدنی نیست';
  const cost = buyCost(G, p, c);
  if (!canPay(G, p, cost)) return 'منابع کافی نیست';
  pay(G, p, cost);
  if (cost._hp) T.flags[cost._hp] = true;
  if (src === 'fixed') G.acad.fixed[id]--;
  else if (src === 'row') { removeFromRow(G, i); }
  else G.acad.discard.splice(i, 1);
  if (c.ty === 'spell') { G.acad.discard.push(id); toast(G, p.name + ' طلسم «' + c.name + '» را به کار برد.', 'buy'); runSpell(G, p, c); }
  else {
    const inst = { u: ++G.uid, c: id };
    if (T.fk) { p.hand.push(inst); T.fk = false; } else p.discard.push(inst);
    toast(G, p.name + ' کارت «' + c.name + '» را از آکادمی خرید.', 'buy');
  }
  if (src === 'row') fillAcademy(G);
  return null;
}
// house discounts: shadow (spells 1 power cheaper, min 1) and librarian (1 coin cheaper), once per turn each
function buyCost(G, p, c) {
  const T = G.turn, cost = Object.assign({}, c.cost);
  if (c.ty === 'spell' && hasHP(p, 'hp_shadow') && !T.flags.hpShadow && (cost.pow || 0) > 1) { cost.pow--; Object.defineProperty(cost, '_hp', { value: 'hpShadow' }); }
  else if (hasHP(p, 'hp_lib') && !T.flags.hpLib && (cost.coin || 0) > 0) { cost.coin--; if (!cost.coin) delete cost.coin; Object.defineProperty(cost, '_hp', { value: 'hpLib' }); }
  return cost;
}
function swapAcademy(G, p, i) {
  const T = G.turn; if (T.swap) return 'تعویض فقط یک بار در هر نوبت';
  if (!G.acad.row[i]) return 'کارت نیست';
  if (!canPay(G, p, R.swapCost)) return 'منابع تعویض کافی نیست';
  pay(G, p, R.swapCost); T.swap = true;
  const id = removeFromRow(G, i); G.acad.discard.push(id);
  toast(G, p.name + ' کارت «' + D.cards[id].name + '» را از آکادمی بیرون فرستاد.', 'buy');
  fillAcademy(G);
  return null;
}
// effects every card can have, whatever its special effect: gain resources, draw cards, gain fame now
function generic(G, p, c) {
  const pool = G.turn.pool;
  if (c.gain) for (const r in c.gain) pool[r] = (pool[r] || 0) + c.gain[r];
  if (c.draw) drawCards(G, p, c.draw);
  if (c.fameNow) addFame(G, p, c.fameNow, c.name);
}
function runSpell(G, p, c) {
  const T = G.turn;
  generic(G, p, c);
  switch (c.fx) {
    case 'sp_rm': askRemove(G, p, 'rm', c.name, '۱ کارت از دست یا دستهٔ سوخته را حذف کن.'); break;
    case 'sp_res': ask(G, p.id, 'reserve', { title: c.name, text: 'کدام جادوگر تالار را برای خودت کنار می‌گذاری؟', kind: 'wiz', opts: G.hall.row.map((w, j) => ({ v: j, wiz: w.id, tok: w.tok })) }); break;
    case 'sp_hall': ask(G, p.id, 'hallRefresh', { title: c.name, text: '۲ جادوگر تالار را انتخاب کن تا حذف شوند.', kind: 'wiz', many: 2, opts: G.hall.row.map((w, j) => ({ v: j, wiz: w.id, tok: w.tok })) }); break;
    case 'sp_ret': if (p.discard.length) ask(G, p.id, 'toTop', { title: c.name, text: '۱ کارت از دستهٔ سوخته را روی دکت بگذار.', kind: 'cards', opts: p.discard.map(x => ({ v: x.u, card: x.c })) }); break;
    case 'sp_buy': T.buyDiscard = true; break;
    case 'sp_far': Dun.farStrike(G, p); break;
    case 'sp_gate': Dun.portalChoice(G, p, true); break;
    case 'sp_shield': p.shield = true; break;
    case 'sp_seal': if (G.acad.row.length) ask(G, p.id, 'seal', { title: c.name, text: 'دیسکت را روی کدام کارت آکادمی می‌گذاری؟', kind: 'acad', opts: G.acad.row.map((id, j) => ({ v: j, acad: id })) }); break;
    case 'sp_fk': T.fk = true; break;
  }
}
H.reserve = (G, pid, v) => { const w = G.hall.row[v]; if (!w) return false; G.hall.row.splice(v, 1); (G.hall.reserved[pid] = G.hall.reserved[pid] || []).push(w); refillHall(G); return true; };
H.hallRefresh = (G, pid, v) => { if (!Array.isArray(v) || v.length !== Math.min(2, G.hall.row.length) || new Set(v).size !== v.length) return false; v.sort((a, b) => b - a).forEach(j => { G.hall.gone.push(G.hall.row[j].id); G.hall.row.splice(j, 1); }); refillHall(G); return true; };
H.seal = (G, pid, v) => { if (!G.acad.row[v]) return false; G.acad.seal[v] = { pid, night: G.night, cnt: 0 }; return true; };
function addFame(G, p, n, why) { p.fame += n; log(G, p.name + ' ' + fa(n) + ' امتیاز شهرت گرفت' + (why ? ' (' + why + ')' : '') + '.'); }

// ---------- hall ----------
function hireCost(G, p, w) { let d = D.wizards[w.id].d - (w.tok || 0); if (hasItem(p, 'dagger')) d -= 1; if (hasHP(p, 'hp_lord')) d -= 1; return Math.max(1, d); }
function hire(G, p, src, i) {
  const T = G.turn; const list = src === 'res' ? (G.hall.reserved[p.id] || []) : G.hall.row; const w = list[i];
  if (!w) return 'جادوگر نیست';
  const c = hireCost(G, p, w);
  if (T.pool.power < c) return 'قدرت کافی نیست (' + fa(c) + ' لازم است)';
  T.pool.power -= c; list.splice(i, 1); p.wiz.push(w.id);
  toast(G, p.name + ' جادوگر ' + w.id + ' را با ' + fa(c) + ' قدرت استخدام کرد.', 'hire');
  if (src !== 'res') refillHall(G);
  return null;
}
function refillHall(G) { while (G.hall.row.length < R.hallSize && G.hall.deck.length) G.hall.row.push({ id: G.hall.deck.shift(), tok: 0 }); }
function goblin(G, p, what) {
  const T = G.turn; if (T.gob) return 'حمله به گوبلین فقط یک بار در هر نوبت';
  if (T.pool.power < 1) return '۱ قدرت لازم است';
  if (!['coin', 'scroll'].includes(what)) return 'سکه یا طومار';
  T.pool.power -= 1; T.gob = true; const n = T.flags.gob2 ? 2 : 1; T.pool[what] += n;
  toast(G, p.name + ' به گوبلین حمله کرد و ' + fa(n) + ' ' + RES[what] + ' گرفت.', 'gob');
  return null;
}
function hpAlch(G, p) {
  const T = G.turn; if (!hasHP(p, 'hp_alch')) return 'این قدرت خاندان تو نیست'; if (T.flags.hpAlch) return 'یک بار در هر نوبت';
  if (!canPay(G, p, { coin: 2 })) return '۲ سکه لازم است';
  pay(G, p, { coin: 2 }); T.pool.scroll += 1; T.flags.hpAlch = true;
  toast(G, p.name + ' (کیمیاگر) ۲ سکه را به ۱ طومار تبدیل کرد.', 'buy'); return null;
}
function upgrade(G, p, k, free) {
  const u = UPGRADES[k]; if (!u) return 'ارتقا نیست';
  if (k === 'wand2' ? p.wand >= 2 : p.ups[k]) return 'این ارتقا انجام شده';
  if (!free) { if (!canPay(G, p, u.cost)) return 'منابع کافی نیست'; pay(G, p, u.cost); }
  if (k === 'wand2') p.wand = 2; p.ups[k] = true;
  toast(G, p.name + ' «' + u.name + '» را ارتقا داد: ' + u.txt, 'up');
  return null;
}

// ---------- end of turn ----------
function endTurn(G, p) {
  const T = G.turn;
  if (busy(G)) return 'اول کار نیمه‌تمام را تمام کن';
  if (T.forced != null) return 'باید با اهریمن خانه‌ات بجنگی';
  const err = Dun.canEndHere(G, p); if (err) return err;
  if (hasHP(p, 'hp_purge') && p.discard.length && !T.purged) {
    T.purged = true;
    ask(G, p.id, 'hpPurge', { title: 'پالایشگر', text: '۱ کارت از دستهٔ سوخته را برای همیشه حذف کن (اختیاری).', kind: 'cards', opts: p.discard.map(x => ({ v: x.u, card: x.c })).concat([{ v: 0, label: 'حذف نمی‌کنم' }]) });
    return null;
  }
  const keepN = (p.ups.keep ? 1 : 0) + (hasItem(p, 'crystal') ? 1 : 0);
  if (keepN && p.hand.filter(x => x.c !== 'W').length && !T.kept) {
    T.kept = true;
    ask(G, p.id, 'keep', { title: 'نگه داشتن کارت', text: 'تا ' + fa(keepN) + ' کارت از دستت را برای نوبت بعد نگه دار.', kind: 'cards', many: keepN, min: 0, opts: p.hand.map(x => ({ v: x.u, card: x.c })), data: { n: keepN } });
    return null;
  }
  finishTurn(G, p);
  return null;
}
H.hpPurge = (G, pid, v) => { const p = P(G, pid); if (v && !removeCard(G, p, v)) return false; return endTurn(G, p) == null; };
H.keep = (G, pid, v, q) => { const p = P(G, pid); v = Array.isArray(v) ? v : []; if (v.length > q.data.n) return false; for (const u of v) { const i = p.hand.findIndex(x => x.u === u); if (i >= 0) p.keep.push(p.hand.splice(i, 1)[0]); } finishTurn(G, p); return true; };
function finishTurn(G, p) {
  const T = G.turn, lost = [];
  for (const r of ['coin', 'scroll', 'ess']) { const tot = p.store[r] + T.pool[r]; p.store[r] = Math.min(cap(p, r), tot); if (tot > p.store[r]) lost.push(fa(tot - p.store[r]) + ' ' + RES[r]); }
  p.discard.push(...T.played.map(x => ({ u: x.u, c: x.c })), ...p.hand); p.hand = [];
  if (Dun.isCursed(G, p.pos) && !hasHP(p, 'hp_curse')) { p.curse = 1; log(G, p.name + ' نوبتش را در خانهٔ نفرین‌شده تمام کرد و توکن نفرین گرفت.'); }
  // seals placed earlier expire at the end of the owner's next turn
  for (const k in G.acad.seal) { const s = G.acad.seal[k]; if (s.pid === p.id) { s.cnt++; if (s.cnt >= 2) delete G.acad.seal[k]; } }
  log(G, p.name + ' نوبتش را تمام کرد.' + (lost.length ? ' از بین رفت: ' + lost.join('، ') : ''));
  G.turn = null;
  G.cur++;
  if (G.cur >= G.order.length) endNight(G); else startTurn(G);
}

// ---------- end of night ----------
function endNight(G) {
  G.phase = 'night';
  G.nightSteps = { n: G.night, done: [] };
  Dun.nightMove(G);            // 1. demons advance (may ask players fight/concede)
  G.nightStage = 'event';
  continueNight(G);
}
function continueNight(G) {
  if (G.prompts.length || G.battle) return;    // wait for answers / the battle
  if (G.nightStage === 'event') {
    G.nightStage = 'chal';
    const ck = G.chal[G.night];
    if (ck) scoreChallenge(G, ck);
  }
  if (G.nightStage === 'chal') {
    G.nightStage = 'battle';
    if (G.battleNights.includes(G.night)) { Battle.start(G); return; }
  }
  if (G.nightStage === 'battle') {
    G.nightStage = 'wrap';
    if (G.night >= G.cfg.nights) { finalScore(G); return; }
    // 3. academy: rightmost (unsealed) card burns (2 in a 2-player game)
    const nb = G.players.length === 2 ? 2 : 1; const burned = [];
    for (let k = 0; k < nb; k++) { let i = 0; while (i < G.acad.row.length && G.acad.seal[i]) i++; if (i < G.acad.row.length) { const id = removeFromRow(G, i); G.acad.discard.push(id); burned.push(D.cards[id].name); } }
    // 4. hall: -1 defense token on every unhired wizard (max 3)
    for (const w of G.hall.row) w.tok = Math.min(3, (w.tok || 0) + 1);
    for (const p of G.players) p.shield = false;
    log(G, 'پایان شب ' + fa(G.night) + ': سوخت از آکادمی: ' + (burned.join('، ') || 'هیچ') + ' · توکن «۱- دفاع» روی جادوگران تالار.');
    G.night++;
    G.order = G.order.slice(1).concat(G.order.slice(0, 1));   // the wizard hat goes to the next player
    G.phase = 'turn'; G.cur = 0; G.nightStage = null;
    toast(G, 'شب ' + fa(G.night) + ' شروع شد.', 'night');
    fillAcademy(G);
    startTurn(G);
  }
}
const CHAL_METRIC = {
  removed: p => p.removed.length, coin: p => p.store.coin, scroll: p => p.store.scroll, ess: p => p.store.ess,
  ups: p => Object.keys(p.ups).length, torchpick: p => p.torch + p.pick, items: p => p.items.length, hunt: p => p.hunt,
  wounds: p => allCards(p).filter(x => x.c === 'W').length, chests: p => p.chests,
  wiz3: p => p.wiz.filter(id => D.wizards[id].L === 3).length,
  magic4: p => allCards(p).filter(x => card(x.c).ty === 'magic' && card(x.c).power >= 4).length,
  wiz: p => p.wiz.length, wand: p => p.wand, res: p => p.store.coin + p.store.scroll + p.store.ess, red: p => p.red || 0 };
// legacy keys without a metric field
const CHAL_OLD = { e_removed: 'removed', e_coin: 'coin', e_scroll: 'scroll', e_ess: 'ess', e_ups: 'ups', l_chest: 'chests', l_wiz3: 'wiz3', l_magic4: 'magic4', l_wiz: 'wiz', f_hunt: 'hunt' };
function chalValue(G, p, k) {
  const m = (CHALLENGES[k] && CHALLENGES[k].metric) || CHAL_OLD[k];
  return CHAL_METRIC[m] ? CHAL_METRIC[m](p) : 0;
}
const allCards = p => p.deck.concat(p.hand, p.discard, p.keep, p.played || []);
function scoreChallenge(G, k) {
  const ch = CHALLENGES[k], vals = G.players.map(p => ({ id: p.id, v: chalValue(G, p, k) }));
  const low = ch.dir === 'min';   // 'min' tokens (fewest wounds): the lowest count wins
  const best = low ? Math.min(...vals.map(x => x.v)) : Math.max(...vals.map(x => x.v));
  const W = low || best > 0 ? vals.filter(x => x.v === best) : [];
  const pts = W.length ? Math.floor(ch.pts / W.length) : 0;
  for (const w of W) P(G, w.id).fame += pts;
  G.chalResult = { n: ++G.ev, k, night: G.night, vals, winners: W.map(w => w.id), pts };
  toast(G, 'توکن چالش «' + ch.name + '»: ' + (W.length ? W.map(w => P(G, w.id).name).join(' و ') + ' ← ' + fa(pts) + ' امتیاز' : 'کسی امتیاز نگرفت'), 'chal');
}
function finalScore(G) {
  const rows = G.players.map(p => {
    const cards = allCards(p).filter(x => x.c !== 'W').reduce((s, x) => s + (card(x.c).fame || 0), 0);
    const wounds = allCards(p).filter(x => x.c === 'W').length;
    const ess = p.store.ess, cs = Math.floor((p.store.coin + p.store.scroll) / 2);
    const total = p.fame + cards + wounds * (R.wound.fame || 0) + ess + cs;
    return { id: p.id, during: p.fame, cards, wounds, ess, cs, total, hunt: p.hunt, chests: p.chests, essN: p.store.ess, csN: p.store.coin + p.store.scroll };
  });
  rows.sort((a, b) => b.total - a.total || b.hunt - a.hunt || b.chests - a.chests || b.essN - a.essN || b.csN - a.csN);
  const t = rows[0]; const winners = rows.filter(r => r.total === t.total && r.hunt === t.hunt && r.chests === t.chests && r.essN === t.essN && r.csN === t.csN).map(r => r.id);
  G.final = { rows, winners };
  G.phase = 'end';
  toast(G, 'بازی تمام شد! استاد اعظم سحر: ' + winners.map(i => P(G, i).name).join(' و '), 'end');
}

// ---------- action dispatcher ----------
function act(G, pid, a) {
  try {
    if (a.t === 'answer') return answer(G, pid, a.id, a.v);
    if (G.battle && a.t && a.t.startsWith('b_')) return Battle.act(G, pid, a);
    if (G.phase !== 'turn') return 'الان نوبت بازی نیست';
    const p = P(G, pid);
    if (a.t === 'items') return setItems(G, p, a.order);
    if (!isTurn(G, pid)) return 'نوبت تو نیست';
    if (G.prompts.length) return 'اول به پرسش جواب بده';
    if (G.dun.place && !a.t.startsWith('d_')) return 'اول تایل تازه را بگذار';
    switch (a.t) {
      case 'play': return playCard(G, p, a.u, a.mode || 'main');
      case 'roll': return rollPower(G, p);
      case 'reroll': return reroll(G, p);
      case 'buy': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return buy(G, p, a.src, a.i);
      case 'swap': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return swapAcademy(G, p, a.i);
      case 'hire': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return hire(G, p, a.src || 'row', a.i);
      case 'goblin': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return goblin(G, p, a.what);
      case 'hpalch': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return hpAlch(G, p);
      case 'upgrade': if (G.fight || G.turn.forced != null) return 'الان نمی‌شود'; return upgrade(G, p, a.k);
      case 'phoenix': return phoenix(G, p, a.u);
      case 'end': return endTurn(G, p);
      default: if (a.t.startsWith('d_') || a.t.startsWith('f_')) return Dun.act(G, p, a); return 'کار ناشناخته';
    }
  } finally { G.rev = (G.rev || 0) + 1; }
}
function answer(G, pid, id, v) {
  const q = G.prompts.find(x => x.id === id); if (!q || q.to !== pid) return 'این پرسش برای تو نیست';
  const i = G.prompts.indexOf(q); G.prompts.splice(i, 1);
  const ok = H[q.k](G, pid, v, q);
  if (ok === false) { G.prompts.splice(i, 0, q); return 'جواب درست نیست'; }
  if (G.phase === 'night') continueNight(G);
  return null;
}
function setItems(G, p, order) {
  if (!isTurn(G, p.id) || G.turn.played.length) return 'وسایل را فقط در شروع نوبتت (پیش از بازی کارت) می‌توانی جابه‌جا کنی';
  if (!Array.isArray(order) || order.length !== p.items.length || order.some(k => !p.items.includes(k))) return 'فهرست نادرست';
  p.items = order.slice(); return null;
}
function phoenix(G, p, u) {
  if (!hasItem(p, 'phoenix')) return 'پَر سیمرغ نداری'; if (G.turn.phoenix) return 'یک بار در هر نوبت';
  const i = p.hand.findIndex(x => x.u === u); if (i < 0) return 'کارت در دست نیست';
  p.discard.push(p.hand.splice(i, 1)[0]); drawCards(G, p, 1); G.turn.phoenix = true; return null;
}

const Game = { CHAL_METRIC, HP, housePower, hasHP, newGame, act, answer, fa, HOUSES, UPGRADES, ITEMS, TREASURE_NAME, CHALLENGES, DIE, DIE_NAME, RES, LV_NAME, LV_KEY, REWARD_NAME, card, cap, activeItems, hasItem, hireCost, canPay, curP, isTurn, busy, continueNight };
// internals shared with the dungeon and battle modules
Game._ = { hasHP, H, ask, toast, log, P, rnd, shuffle, drawCards, gain, addFame, removeCard, askRemove, startTurn, continueNight, upgrade, rollFace, dieValue, cap, hasItem, curP, isTurn, allCards, fillAcademy, DEMON_LV, LV_NAME, LV_KEY, REWARD_NAME, TREASURE_NAME, ITEMS };
let Dun, Battle;
Game.use = (d, b) => { Dun = d; Battle = b; };
root.Game = Game;
if (typeof module !== 'undefined') module.exports = Game;
})(typeof window !== 'undefined' ? window : global);
