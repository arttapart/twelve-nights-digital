// 12 Nights digital: wizard battle (rulebook v13 section 11, CHANGELOG 60 + 91).
// Wraps the wizard-battle app engine (wbattle.js, same effect codes as cards.json) and plays the cards digitally:
// decks, hands and deck operations are handled here; inputs the engine asks for are answered from the game state when
// they are facts (die rolls, stored resources, score) and sent to the player's phone when they are choices.
(function (root) {
'use strict';
const D = root.DATA || require('./data.js');
const Game = root.Game || require('./engine.js');
const Engine = root.Battle || require('./wbattle.js').Battle;
const _ = Game._, fa = Game.fa;
const W = id => D.wizards[id];

function start(G) {
  const B = G.battle = { n: ++G.ev, phase: 'prep', round: 0, ready: {}, remove: {}, deck: {}, hand: {}, played: {}, picked: {}, bf: null, eng: null, fwd: {}, wild: {}, peekQ: [], res: null, night: G.night };
  if (G.cfg.bf) {
    if (!G.bfDeck.length) G.bfDeck = _.shuffle(G, D.battlefield.map(b => b.id));
    const id = G.bfDeck.shift(); B.bf = D.battlefield.find(b => b.id === id);
    _.toast(G, 'اثر میدان نبرد: «' + B.bf.name + '» · ' + B.bf.txt, 'bf');
  }
  for (const p of G.players) { B.remove[p.id] = []; B.ready[p.id] = false; }
  G.phase = 'battle';
  _.toast(G, 'نبرد جادوگران! هر بازیکن جادوگرانی را که نمی‌خواهد حذف کند.', 'battle');
}
const bfe = B => B.bf ? B.bf.eff : ['none'];

function act(G, pid, a) {
  const B = G.battle, p = _.P(G, pid);
  if (a.t === 'b_prep') {   // {remove:[index...]} final choice of cards to remove
    if (B.phase !== 'prep') return 'الان وقت حذف نیست';
    const idx = (a.remove || []).filter(i => i >= 0 && i < p.wiz.length);
    B.remove[pid] = [...new Set(idx)]; B.ready[pid] = true;
    if (G.players.every(q => B.ready[q.id])) setup(G);
    return null;
  }
  if (a.t === 'b_unready') { if (B.phase !== 'prep') return 'دیر است'; B.ready[pid] = false; return null; }
  if (a.t === 'b_pick') {
    if (B.phase !== 'pick') return 'الان وقت انتخاب نیست';
    if (B.picked[pid] !== undefined) return 'انتخاب کرده‌ای';
    if (B.r1top) return 'در این راند کارت از روی دک رو می‌شود';
    const h = B.hand[pid];
    if (a.i == null) { if (h.length) return 'کارت انتخاب کن'; B.picked[pid] = null; }
    else { if (!(a.i >= 0 && a.i < h.length)) return 'کارت نادرست'; B.picked[pid] = h.splice(a.i, 1)[0]; }
    checkPicks(G);
    return null;
  }
  if (a.t === 'b_unpick') { if (B.phase !== 'pick' || B.picked[pid] == null) return 'نمی‌شود'; B.hand[pid].push(B.picked[pid]); delete B.picked[pid]; return null; }
  if (a.t === 'b_wild') {   // F12: once per battle, before the hidden pick, burn 1 hand card and draw 1
    if (bfe(B)[0] !== 'info' || B.bf.id !== 'F12') return 'این اثر در این نبرد نیست';
    if (B.phase !== 'pick' || B.picked[pid] !== undefined || B.wild[pid]) return 'نمی‌شود';
    const h = B.hand[pid]; if (!(a.i >= 0 && a.i < h.length)) return 'کارت نادرست';
    h.splice(a.i, 1); B.wild[pid] = true; draw(B, pid, 1); return null;
  }
  if (a.t === 'b_next') { if (B.phase !== 'done') return 'نبرد تمام نشده'; B.ack = B.ack || {}; B.ack[pid] = true; if (G.players.every(q => B.ack[q.id]) || a.force) finish(G); return null; }
  return 'کار ناشناخته';
}
function draw(B, pid, n) { for (let k = 0; k < n; k++) if (B.deck[pid].length) B.hand[pid].push(B.deck[pid].shift()); }

function setup(G) {
  const B = G.battle;
  for (const p of G.players) {
    const rm = B.remove[p.id].slice().sort((a, b) => b - a), gone = [];
    for (const i of rm) gone.push(p.wiz.splice(i, 1)[0]);
    if (gone.length) _.log(G, p.name + ' ' + fa(gone.length) + ' جادوگر را حذف کرد.');
    B.deck[p.id] = _.shuffle(G, p.wiz.slice()); B.hand[p.id] = []; B.played[p.id] = [];
  }
  B.eng = new Engine(G.players.map(p => ({ id: p.id, name: p.name, color: p.color, teacher: Game.hasItem(p, 'teacher') })), { bf: B.bf });
  B.round = 1;
  // seer's eye: see the top 2 cards and arrange them
  for (const p of G.players) if (Game.hasItem(p, 'seer') && B.deck[p.id].length >= 2) {
    const [a, b] = B.deck[p.id];
    _.ask(G, p.id, 'seer', { title: 'چشم پیشگو', text: 'دو کارت رویی دکت. کدام اول بیاید؟', kind: 'wizs', opts: [{ v: 0, wiz: a, label: a + ' اول' }, { v: 1, wiz: b, label: b + ' اول' }] });
  }
  B.phase = 'deal';
  if (!G.prompts.some(q => q.k === 'seer')) deal(G);
}
_.H.seer = (G, pid, v) => { const B = G.battle, d = B.deck[pid]; if (v === 1) { const t = d[0]; d[0] = d[1]; d[1] = t; } if (!G.prompts.some(q => q.k === 'seer' && q.to !== pid)) deal(G); return true; };
function deal(G) {
  const B = G.battle, e = bfe(B);
  const n = e[0] === 'hand' ? e[1] : 2;
  for (const p of G.players) draw(B, p.id, n);
  B.phase = 'pick'; B.picked = {};
  B.r1top = e[0] === 'r1_top';
  if (B.r1top) { for (const p of G.players) B.picked[p.id] = B.deck[p.id].length ? B.deck[p.id].shift() : null; checkPicks(G); }
}
function checkPicks(G) {
  const B = G.battle;
  if (!G.players.every(p => B.picked[p.id] !== undefined)) return;
  B.r1top = false;
  B.phase = 'resolve'; B.fwd = {};
  for (const p of G.players) B.eng.pick(p.id, B.picked[p.id]);
  pump(G);
}
// answer the engine's questions: facts automatically, choices on the phone
function pump(G) {
  const B = G.battle, E = B.eng;
  let guard = 0;
  while (E.phase === 'resolve' && E.R && guard++ < 50) {
    const qs = E.R.questions; if (!qs.length) break;
    let progressed = false;
    for (const q of qs) {
      const p = _.P(G, q.to), v = auto(G, q);
      if (v !== undefined) { E.answer(q.to, q.key, v); progressed = true; break; }
      if (!B.fwd[q.key]) { B.fwd[q.key] = true; forward(G, q); }
    }
    if (!progressed) break;
  }
  if (E.phase !== 'resolve') afterRound(G);
}
function roll(G, p) { return _.rollFace(G, p.wand); }
function auto(G, q) {
  const B = G.battle, p = _.P(G, q.to), k = q.key.split(':')[0];
  if (q.kind === 'count') return q.res === 'scroll' ? p.store.scroll : q.res === 'ess' ? p.store.ess : q.res === 'hunt' ? p.hunt : 0;
  if (q.kind === 'die') return { die: roll(G, p), gem: Game.hasItem(p, 'gem') };
  if (q.kind === 'tiedie') return { die: roll(G, p), gem: Game.hasItem(p, 'gem'), ring: Game.hasItem(p, 'ring') };
  if (q.kind === 'number' && q.mem === 'score') return p.fame;
  if (k === 'bflow') { const min = Math.min(...G.players.map(x => x.fame)); return p.fame === min; }
  if (k === 'redraw') {   // L16: the revealed card goes under the deck and the top card is revealed instead
    const old = B.picked[q.to]; if (old) B.deck[q.to].push(old);
    const nc = B.deck[q.to].length ? B.deck[q.to].shift() : null; B.picked[q.to] = nc; return nc;
  }
  return undefined;
}
function forward(G, q) {
  const B = G.battle, k = q.key.split(':')[0], card = q.card;
  const title = card ? 'جادوگر ' + card : 'نبرد جادوگران';
  if (q.kind === 'yesno') _.ask(G, q.to, 'bq', { title, text: q.text, opts: [{ v: true, label: 'بله' }, { v: false, label: 'نه' }], data: { key: q.key } });
  else if (q.kind === 'choose') _.ask(G, q.to, 'bq', { title, text: q.text, opts: q.options.map(o => ({ v: o.v, label: o.label })), data: { key: q.key } });
  else if (k === 'sac') _.ask(G, q.to, 'bq', { title, text: 'می‌توانی یک کارت دستت را بسوزانی تا قدرت پایه‌اش به این کارت اضافه شود.', kind: 'wizs', opts: B.hand[q.to].map((id, i) => ({ v: 'h' + i, wiz: id })).concat([{ v: null, label: 'نمی‌سوزانم' }]), data: { key: q.key } });
  else if (k === 'burnadd') { const n = B.deck[q.to].length, opts = []; for (let i = 0; i <= n; i++) opts.push({ v: i, label: fa(i) + ' کارت' }); _.ask(G, q.to, 'bq', { title, text: 'چند کارت از روی دکت می‌سوزانی؟ قدرت پایهٔ آن‌ها به این کارت اضافه می‌شود.', opts, data: { key: q.key } }); }
  else _.ask(G, q.to, 'bq', { title, text: q.text || 'جواب بده', opts: [{ v: true, label: 'بله' }, { v: false, label: 'نه' }], data: { key: q.key } });
}
_.H.bq = (G, pid, v, q) => {
  const B = G.battle; if (!B || !B.eng) return true;
  const key = q.data.key, k = key.split(':')[0];
  if (k === 'sac') { if (v) { const i = +String(v).slice(1); const id = B.hand[pid][i]; if (!id) return false; B.hand[pid].splice(i, 1); v = id; } else v = null; }
  if (k === 'burnadd') { const n = v | 0; v = B.deck[pid].splice(0, n); (B.preBurn = B.preBurn || {})[pid] = ((B.preBurn || {})[pid] || 0) + v.length; }
  B.eng.answer(pid, key, v);
  delete B.fwd[key];
  pump(G);
  return true;
};
function afterRound(G) {
  const B = G.battle, E = B.eng, h = E.history[E.history.length - 1];
  B.last = { n: ++G.ev, round: h.round, cards: h.cards, score: h.score, base: h.base, parts: h.parts, winner: h.winner, tie: h.tie };
  for (const p of G.players) {
    const P = E.P[p.id], prevBurn = (B.burnSeen = B.burnSeen || {})[p.id] || 0;
    const cid = h.cards[p.id];
    if (cid) B.played[p.id].push(cid);
    // cards burned from the top of the own deck (S7, S11, S14); B17's cards were already taken in its answer
    let nb = P.burned - prevBurn - ((B.preBurn || {})[p.id] || 0); B.burnSeen[p.id] = P.burned; if (B.preBurn) B.preBurn[p.id] = 0;
    while (nb-- > 0 && B.deck[p.id].length) B.deck[p.id].shift();
    // returns (L11 shuffle, L18 top, B18 recall to hand)
    const backSeen = (B.backSeen = B.backSeen || {})[p.id] || 0, back = (P.back || []).slice(backSeen); B.backSeen[p.id] = (P.back || []).length;
    for (const id of back) {
      const e = cid ? W(cid).eff[0] : null, pi = B.played[p.id].lastIndexOf(id);
      if (e === 'recall') { if (pi >= 0) { B.played[p.id].splice(pi, 1); B.hand[p.id].push(id); } }
      else if (pi >= 0) { B.played[p.id].splice(pi, 1); if (e === 'return_top') B.deck[p.id].unshift(id); else { B.deck[p.id].push(id); B.deck[p.id] = _.shuffle(G, B.deck[p.id]); } }
    }
    if (cid && W(cid).eff[0] === 'peek' && B.deck[p.id].length) _.ask(G, p.id, 'peek', { title: 'جادوگر B8', text: 'کارت روی دکت: ' + B.deck[p.id][0] + '. سر جایش بماند یا زیر دک برود؟', kind: 'wizs', opts: [{ v: 'top', wiz: B.deck[p.id][0], label: 'سر جایش' }, { v: 'bottom', label: 'زیر دک' }] });
  }
  if (E.phase === 'done') { scoreBattle(G); return; }
  B.round = E.round; B.picked = {};
  if (!G.prompts.some(q => q.k === 'peek')) nextRound(G); else B.phase = 'peek';
}
_.H.peek = (G, pid, v) => { const B = G.battle; if (v === 'bottom') B.deck[pid].push(B.deck[pid].shift()); if (!G.prompts.some(q => q.k === 'peek' && q.to !== pid)) nextRound(G); return true; };
function nextRound(G) {
  const B = G.battle, E = B.eng;
  for (const p of G.players) if (!E.P[p.id].noDraw) draw(B, p.id, 1);
  B.phase = 'pick'; B.picked = {};
}
function scoreBattle(G) {
  const B = G.battle, F = B.eng.final, e = bfe(B);
  B.phase = 'done'; B.res = { n: ++G.ev, res: F.res, bonusTo: F.bonusTo };
  for (const p of G.players) {
    const r = F.res[p.id]; let tot = r.total;
    if (e[0] === 'alt_bonus' && r.bonus) { _.ask(G, p.id, 'altBonus', { title: 'دانش باستان', text: 'به‌جای ' + fa(r.bonus) + ' امتیاز اضافه، ' + fa(e[1]) + ' منبع می‌خواهی؟', opts: [{ v: 0, label: fa(r.bonus) + ' امتیاز' }].concat([4, 3, 2, 1, 0].map(c => ({ v: 'r' + c, label: fa(c) + ' سکه + ' + fa(e[1] - c) + ' طومار' }))), data: { bonus: r.bonus, n: e[1] } }); tot -= r.bonus; }
    p.fame += tot;
    if (e[0] === 'spoils' && r.tokens >= e[1]) p.store.coin = Math.min(Game.cap(p, 'coin'), p.store.coin + e[2]);
  }
  _.toast(G, 'نبرد تمام شد: ' + G.players.map(p => p.name + ' ' + fa(F.res[p.id].total)).join(' · '), 'battle');
}
_.H.altBonus = (G, pid, v, q) => { const p = _.P(G, pid); if (v === 0) p.fame += q.data.bonus; else { const c = +String(v).slice(1); p.store.coin = Math.min(Game.cap(p, 'coin'), p.store.coin + c); p.store.scroll = Math.min(Game.cap(p, 'scroll'), p.store.scroll + q.data.n - c); } return true; };
function finish(G) {
  if (G.prompts.some(q => q.k === 'altBonus')) return;
  G.lastBattle = G.battle.res; G.battle = null; G.phase = 'night'; Game.continueNight(G);
}
// what one phone may see of the battle
function view(G, pid) {
  const B = G.battle; if (!B) return null;
  const E = B.eng;
  const v = { phase: B.phase, round: B.round, bf: B.bf, ready: B.ready, last: B.last || null, res: B.res,
    wins: E ? E.history.map(h => h.winner) : [], tokens: E ? Object.fromEntries(G.players.map(p => [p.id, E.P[p.id].tokens])) : {},
    picked: Object.fromEntries(G.players.map(p => [p.id, B.picked[p.id] !== undefined])), deckN: Object.fromEntries(G.players.map(p => [p.id, (B.deck[p.id] || []).length])),
    handN: Object.fromEntries(G.players.map(p => [p.id, (B.hand[p.id] || []).length])), until: E ? Object.fromEntries(G.players.map(p => [p.id, E.P[p.id].until.map(u => u.id)])) : {},
    next: E ? Object.fromEntries(G.players.map(p => [p.id, E.P[p.id].next ? E.P[p.id].next.id : null])) : {}, ack: B.ack || {} };
  if (pid != null) { v.hand = B.hand[pid] || []; v.myPick = B.picked[pid]; v.remove = B.remove[pid]; v.wild = !!B.wild[pid]; v.r1top = !!B.r1top; }
  return v;
}
const WB = { start, act, view };
root.WB = WB;
if (typeof module !== 'undefined') module.exports = WB;
})(typeof window !== 'undefined' ? window : global);
