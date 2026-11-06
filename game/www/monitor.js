/* 12 Nights digital: shared monitor (1920x1080 design, scaled to the screen). Shows only public information. */
'use strict';
const stage = document.getElementById('stage');
fitStage(stage, 1920, 1080);
let S = { G: null }, seen = { toast: 0, die: 0, duel: 0, chal: 0, breach: 0, bres: 0, blast: 0 }, first = true;
const timers = {};
const H = i => S.G.players[i].color;
const NM = i => esc(S.G.players[i].name);

const api = connect('monitor', (m, up) => {
  if (m === null) { document.body.classList.toggle('offline', !up); return; }
  if (m.t !== 'state') return;
  S = m; setTimer(S.G);
  if (first && S.G) { // do not replay old overlays after a reload
    const G = S.G; seen.toast = G.toasts.length ? G.toasts[G.toasts.length - 1].n : 0; seen.die = G.roll ? G.roll.n : 0;
    seen.duel = G.duel ? G.duel.n : 0; seen.chal = G.chalResult ? G.chalResult.n : 0; seen.breach = G.lastBreach ? G.lastBreach.n : 0;
  }
  first = false;
  sfxRun(S.G);
  render();
});

let CURK = '', HALLPREV = null;   // HALLPREV: the hall row just before a 2-player shift, shown for a moment
window.CLOCK_SFX = true;   // only the monitor ticks in the last seconds of a turn
function render() {
  const G = S.G;
  if (!G) { morph(stage, lobby(), 'lobby'); return; }
  let h, k;
  if (G.phase === 'start') { h = setupScr(); k = 'setup'; }
  else if (G.phase === 'end') { h = finalScr(); k = 'end'; }
  else if (G.battle) { h = battleScr(); k = 'battle'; }
  else if (G.fight) { h = fightScr(); k = 'fight'; }
  else if (G.phase === 'night') { h = nightScr(); k = 'night'; }
  else if (S.ui && S.ui.dun && G.turn) { h = dunScr(); k = 'dun'; }
  else { h = mainScr(); k = 'main'; }
  CURK = k;
  // calm row animations: the academy at night, and the hall when a 2-player turn removes its rightmost wizard
  const hs = G.hallShift || 0, shift = seen.hs != null && hs > seen.hs; seen.hs = hs;
  const rowNow = G.hall.row.map(w => ({ id: w.id, tok: w.tok }));
  if (shift && k === 'main' && (stage._sk !== 'main' || HALLPREV)) {
    // the screen was just swapped (e.g. from the dungeon view): show the old hall row first, then play the calm shift
    if (!HALLPREV) { HALLPREV = seen.hallRow || rowNow; h = mainScr(); }
    morph(stage, h + overlays(), k); seen.hallRow = rowNow;
    setTimeout(() => { HALLPREV = null; ANIM.slow = true; try { morph(stage, mainScr() + overlays(), 'main'); } finally { ANIM.slow = false; } }, 900);
    return;
  }
  ANIM.slow = k === 'night' || shift; seen.hallRow = rowNow;
  morph(stage, h + overlays(), k);
  ANIM.slow = false;
  fitCur(); requestAnimationFrame(fitCur); setTimeout(fitCur, 120);
}

// ---------- lobby ----------
function lobby() {
  const L = S.lobby, ips = Object.keys(S.qr || {});
  const qr = ips.length ? S.qr[ips[0]] : null;
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const p = L.players[i];
    if (!p) { slots.push(`<div class="slot empty"><span class="dot" style="background:#333"></span>${i < 2 ? 'منتظر گوشی…' : 'جای خالی'}</div>`); continue; }
    const c = (DATA_HOUSES.find(h => h.id === p.house) || {}).color || '#6b6c9a';
    slots.push(`<div class="slot" style="border-color:${c}"><span class="dot" style="background:${c}"></span>${esc(p.name)}${p.host ? ' <span class="tag">میزبان</span>' : ''}<span class="st ${p.on ? '' : 'wait'}">${p.on ? 'وصل ✓' : 'قطع'}</span></div>`);
  }
  const n = L.players.length;
  return `<div class="M MX" data-s="a"><div class="body ctr" style="flex-direction:column;gap:26px"><div class="bigt">۱۲ شب</div>
<div style="display:flex;gap:40px;align-items:stretch">
<div class="zone ctr" style="padding:26px 34px;gap:14px;width:520px">${qr ? `<div class="qr">${qr.svg}</div><div class="sub" style="direction:ltr;font-size:26px;color:#ffe7a6">${esc(qr.url)}</div>` : '<div class="sub">هنوز به هیچ شبکه‌ای وصل نیست</div>'}
<div class="sub">با اپ «۱۲ شب» یا دوربین گوشی اسکن کنید</div>${ips.length > 1 ? `<div class="sub" style="font-size:18px;direction:ltr">${ips.slice(1).map(ip => esc(S.qr[ip].url)).join(' – ')}</div>` : ''}</div>
<div class="zone" style="padding:26px 34px;gap:12px;width:640px;justify-content:flex-start"><h3>بازیکنان – ${fa(n)} از ۵</h3>${slots.join('')}
<div class="chk" style="font-size:22px;margin-top:6px">${n >= 2 ? `${fa(n)} بازیکن – <span class="gold">${fa(L.short && (n === 3 || n === 4) && RU.shortGame ? RU.shortGame.nights : (RU.byPlayers[n] || {}).nights || 12)} شب${L.short && (n === 3 || n === 4) ? ' (بازی کوتاه)' : ''}</span>` : 'دست‌کم ۲ بازیکن لازم است'} – اثرهای میدان نبرد: <span class="gold">${L.bf ? 'روشن' : 'خاموش'}</span>${(RU.houses || []).some(h => h.power && (RU.housePowers || {})[h.power]) ? ` – قدرت خاندان‌ها: <span class="gold">${L.hp !== false ? 'روشن' : 'خاموش'}</span>` : ''}</div>
${L.hasSave ? '<div class="banner" style="font-size:20px">یک بازی ذخیره‌شده هست؛ میزبان می‌تواند آن را ادامه دهد.</div>' : ''}
<div class="banner" style="margin-top:auto;background:rgba(243,207,114,.12);border-color:#f3cf72;color:#ffe7a6;font-size:22px">منتظر «شروع بازی» از گوشی میزبان…</div></div>
<div class="zone" style="padding:22px 26px;width:470px;gap:10px;font-size:19px;line-height:1.75"><h3 style="font-size:28px">وصل شدن گوشی‌ها</h3>
<div>۱. همهٔ گوشی‌ها به <b class="gold">هات‌اسپات همین کامپیوتر</b> یا به همان وای‌فای آن وصل شوند. اینترنت لازم نیست.</div>
<div>۲. اپ «۱۲ شب» را باز کنید؛ خودش مانیتور را پیدا می‌کند. اگر پیدا نکرد QR را اسکن کنید.</div>
<div>۳. بدون اپ هم می‌شود: نشانی بالا را در مرورگر گوشی باز کنید.</div>
<div>۴. نخستین گوشی میزبان است و بازی را شروع می‌کند.</div></div>
</div><div class="sub" style="font-size:16px">نسخهٔ ${esc(S.version)}</div></div></div>`;
}
const DATA_HOUSES = DATA.rules.houses;

// ---------- shared pieces ----------
function chalLine(G) {
  const nk = Object.keys(G.chal).map(Number).filter(n => n >= G.night).sort((a, b) => a - b)[0];
  if (!nk) return '';
  const [name, pts] = CHN[G.chal[nk]];
  return `${nk === G.night ? 'چالش امشب' : 'چالش شب ' + fa(nk)}: <b>${name}</b> – ${fa(pts)} ${sv('fame')}`;
}
function topH(G, extra) {
  const T = G.turn;
  return `<div class="top">${nightsH(G)}<div class="chal">${extra || chalLine(G)}</div><div class="turn">${T ? `<b style="color:${H(T.pid)}">نوبت ${NM(T.pid)}</b>${tmrH()}` : ''}</div></div>`;
}
function pbarH(G) {
  const T = G.turn;
  return `<div class="pbar" style="grid-template-columns:repeat(${G.players.length},1fr)">${G.order.map(id => {
    const p = G.players[id], on = T && T.pid === id;
    // only the active player's latest action, until the next one replaces it
    const lastL = on ? G.log.filter(l => l.n > (T.ev0 || 0)).pop() : null;
    const minis = on ? `<div class="played">${T.played.slice(-6).map(x => { const c = card(x.c); return `<div class="mini"><div class="mt2" style="background:${TYBG[c.ty]}">${TYN[c.ty]}</div><div class="mn">${esc(c.name)}</div></div>`; }).join('')}</div>` : '';
    const played = (lastL ? `<div class="lastact" data-k="lg-${lastL.n}">${esc(lastL.t)}</div>` : '') + minis;
    return `<div class="pt ${on ? 'on' : ''}" style="--pc:${p.color}">${played}<div class="nm"><i style="background:${p.color}"></i>${esc(p.name)}${on ? '<span style="font-size:16px;font-weight:600;opacity:.8">· در حال بازی</span>' : ''}</div><div class="stats"><span>${sv('fame')}${fa(p.fame)}</span><span>${sv('coin')}${fa(p.store.coin)}</span><span>${sv('scr')}${fa(p.store.scroll)}</span><span>${sv('ess')}${fa(p.store.ess)}</span><span>${sv('hunt')}${fa(p.hunt)}</span>${p.wounds ? `<span class="wd">زخم ${fa(p.wounds)}</span>` : ''}</div></div>`;
  }).join('')}</div>`;
}
function waitTxt(G) {
  const q = G.prompts[0]; if (!q) return '';
  // several players answering at the same time (duel, challenge results): name all of them
  const same = G.prompts.filter(x => x.k === q.k), who = [...new Set(same.map(x => x.to))];
  return `منتظر ${who.map(NM).join('، ')}: ${esc(q.title || '')}`;
}
function waitLine(G) {
  if (!G.prompts.length) return '';
  return `<div class="waitq">${waitTxt(G)}</div>`;
}
// the played/viewed card keeps its proportions and is zoomed down to fit its box
function fitCur() {
  for (const c of stage.querySelectorAll(".curc")) { const a = [...c.children].find(x => !x._ghost); if (!a || !a.offsetHeight) continue; a.style.zoom = ''; const k = Math.min(1, (c.clientHeight - 6) / a.offsetHeight, (c.clientWidth - 6) / a.offsetWidth); if (k > 0 && k < 1) a.style.zoom = k.toFixed(3); }
}
// what the active player can spend now: stored + gained this turn
function spendH(G) {
  const T = G.turn; if (!T) return ''; const p = G.players[T.pid], q = T.pool, st = p.store;
  const it = [['coin', st.coin + (q.coin || 0)], ['scr', st.scroll + (q.scroll || 0)], ['ess', st.ess + (q.ess || 0)], ['pow', q.power || 0]];
  return `<div class="spend"><span class="sl">قابل خرج</span>${it.map(([k, v]) => `<span>${sv(k)}<b>${fa(v)}</b></span>`).join('')}</div>`;
}
function curCard(G) {
  const T = G.turn; if (!T) return '';
  const x = T.played[T.played.length - 1];
  // only the last played card, while the player still has cards in hand
  const pl = G.players[T.pid], hn = pl.handN != null ? pl.handN : (pl.hand || []).length;
  return x && hn ? acard(x.c, { k: '-p' + T.played.length }) : '';
}
const acadList = G => G.acad.row.map((id, i) => ({ src: 'row', i, id })).concat(Object.keys(G.acad.fixed).map(id => ({ src: 'fixed', i: id, id })));

// ---------- main view ----------
function mainScr() {
  const G = S.G, ui = S.ui || {}, T = G.turn;
  const acadI = T && ui.tab === 'acad' ? ui.i : -1, hallI = T && ui.tab === 'hall' ? ui.i : -1;
  const seals = G.acad.seal;
  const seen = {}; const row = G.acad.row.map((id, i) => acard(id, { cls: i === acadI ? 'view' : '', seal: seals[i] ? H(seals[i].pid) : null, k: '-' + (seen[id] = (seen[id] || 0) + 1) })).join('');
  const fixed = Object.keys(G.acad.fixed).map((id, k) => `<div class="stk"><span class="cl">${fa(G.acad.fixed[id])} کارت</span>${acard(id, { cls: G.acad.row.length + k === acadI ? 'view' : '' })}</div>`).join('');
  const hall = (HALLPREV || G.hall.row).map((w, i) => wcard(w.id, w.tok, { cls: i === hallI ? 'view' : '' })).join('');
  return `<div class="M" data-s="a">${topH(G)}
<div class="side"><div class="mm zone"><h4>سیاه‌چال</h4><div class="mmap">${mapSvg(G, { minSize: 2 * TS })}</div></div><div class="cur zone"><div class="curh"><h4>کارت در حال اجرا</h4>${spendH(G)}</div><div class="curc">${curCard(G)}</div></div></div>
<div class="zone zA"><div class="zt"><h3>آکادمی سحرستان</h3><span>دک: ${fa(G.acad.deckN)} کارت – سوخته: ${fa(G.acad.discard.length)}</span></div><div class="rowc">${fixed}<div class="sep"></div>${row}<div class="deck">دک آکادمی</div></div></div>
<div class="zone zH"><div class="zt"><h3>تالار جادوگران</h3><span>دک جادوگران شهر: ${fa(G.hall.deckN)}</span></div><div class="rowc">${hall}<div class="deck">دک جادوگران</div></div></div>
<div class="zone zG"><h3>گوبلین</h3><div class="gh"></div><p><span>۱ ${sv('pow')} بده</span><span>۱ ${sv('coin')} یا ۱ ${sv('scr')} بگیر</span>هر نوبت ۱ بار</p></div>
${pbarH(G)}${waitLine(G)}</div>`;
}
// the active player's actions this turn stay on screen (newest first, like the log on the phone)
function actH(G) {
  const T = G.turn; if (!T) return '';
  const L = G.log.filter(l => l.n > (T.ev0 || 0)).reverse(); if (!L.length) return '';
  return `<div class="act" style="--pc:${H(T.pid)}">${L.slice(0, 4).map((l, i) => `<div class="${i ? 'old' : 'new'}" data-k="lg-${l.n}">${esc(l.t)}</div>`).join('')}${L.length > 4 ? `<div class="more">و ${fa(L.length - 4)} کار دیگر در این نوبت</div>` : ''}</div>`;
}

// ---------- dungeon mode ----------
const LEG = [['s1', 'راهروی ساده'], ['s2', 'راهروی دراز – دو گام'], ['d1', 'راهروی تاریک – مشعل'], ['x1', 'راهروی ریزشی – کلنگ'], ['s1o', 'راهروی یک‌طرفه']];
function legend() {
  return `<div class="legend zone lg2">${LEG.map(([k, t]) => `<div>${TL.legCor(k)}<span>${t}</span></div>`).join('')}</div>`;
}
function dunScr() {
  const G = S.G, T = G.turn, p = G.players[T.pid], f = focusTile(S);
  const o = { focus: f, me: p.id };
  let lab = 'کاشی ' + NM(p.id);
  const qd = G.prompts.find(q => q.k === 'qDemon' && q.data);
  if (qd) { o.mark = [qd.data.n]; lab = 'اهریمن نامعلوم – ' + NM(qd.to) + ' سطح اهریمن خانهٔ چشمک‌زن را در گوشی انتخاب می‌کند'; }
  else if (G.dun.place) lab = 'تایل تازه – با گوشی بچرخان و تأیید کن';
  if (qd || G.dun.place) {}
  else if (G.dun.portal) { const po = G.dun.portal; o.portal = po.list[po.i] ? po.list[po.i].cells : []; lab = `پرتال – کاشی مقصد ${fa(po.i + 1)} از ${fa(po.list.length)} – انتخاب با گوشی`; }
  else { o.moves = G.moves || []; o.exits = G.exits || []; if (S.ui.off && (S.ui.off[0] || S.ui.off[1])) lab = 'کاشی کناری – برای برگشتن «کاشی من» را در گوشی بزن'; }
  const pool = T.pool;
  const res = `<div class="dpool big"><div>${sv('step')}<b>${fa(T.run > 0 ? 'دویدن' : pool.step)}</b></div>${pool.tele ? `<div><span>تله‌پورت</span><b>${fa(pool.tele)}</b></div>` : ''}<div>${sv('torch')}<b>${fa(p.torch)}</b></div><div>${sv('pick')}<b>${fa(p.pick)}</b></div></div>`;
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px;background:rgba(79,192,141,.18);color:#9ef0c3;border-color:#4fc08d">مد سیاه‌چال</span>`)}
<div class="body"><div class="dmap">${mapSvg(G, o)}<div class="dlab">${lab}</div></div><div class="dside"><div class="cur zone"><h4>${NM(p.id)}</h4>${res}</div>${legend()}</div></div>${pbarH(G)}${waitLine(G)}</div>`;
}

// ---------- demon fight ----------
function dcardH(ci, lv, paid, on) {
  const dm = DATA.demons[ci];
  const rew = r => Object.entries(r).map(([k, v]) => ({ f: `${sv('fame')}${fa(v)}`, e: `${sv('ess')}${fa(v)}`, c: `${sv('coin')}/${sv('scr')}${v > 1 ? '×' + fa(v) : ''}`, t: `${sv('torch')}${v > 1 ? '×' + fa(v) : ''}`, b: `${sv('pick')}${v > 1 ? '×' + fa(v) : ''}`, tb: `${sv('torch')}/${sv('pick')}`, st: `${sv('step')}${v > 1 ? '×' + fa(v) : ''}`, tp: 'تله‌پورت', dr: `کشیدن ${fa(v)}`, rm: 'حذف کارت' }[k] || k)).join(' ');
  const art = ART.demons && ART.demons[ci];
  if (art) return `<div class="dc artfull lv${lv || 0}" style="background-image:url('${artU(art)}')">${lv ? `<span class="dlvl">${['', 'زرد', 'نارنجی', 'قرمز'][lv]}</span>` : ''}</div>`;
  return `<div class="dc">${[['y', 1], ['o', 2], ['r', 3]].map(([c, l]) => `<div class="sec ${c} ${l === lv ? 'on' : ''}"><span class="dv">${fa(dm[c][0])}</span>${rew(dm[c][1])}</div>`).join('')}</div>`;
}
// a quiet guide in the corner of the fight screen: the defence values of this demon colour in the deck, and how many cards have each (Farshad 2026-11-06)
function defGuide(lv) {
  const key = { 1: 'y', 2: 'o', 3: 'r' }[lv], n = {};
  for (const dm of DATA.demons) { const sec = dm[key]; if (sec) n[sec[0]] = (n[sec[0]] || 0) + 1; }
  const rows = Object.keys(n).map(Number).sort((a, b) => a - b).map(v => `<div><span>دفاع ${fa(v)}</span><b>${fa(n[v])} کارت</b></div>`).join('');
  return `<div class="dguide"><h6>دفاع‌های اهریمن ${LVN[lv]} در دک</h6>${rows}</div>`;
}
function fightScr() {
  const G = S.G, F = G.fight, T = G.turn;
  const cards = F.cards.map((c, i) => `<div>${dcardH(c.ci, F.lv)}<div class="dres" style="color:${c.paid ? '#9ef0c3' : '#ffe7a6'}">${c.paid ? 'شکست خورد ✓ – ' + fa(c.def) + ' قدرت' : 'دفاع ' + fa(c.def) + ' – در انتظار'}</div></div>`).join('');
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px;background:rgba(240,138,42,.18);color:#ffd7b0;border-color:#f08a2a">نبرد با اهریمن</span>`)}
<div class="body"><div class="zone ctr" style="flex:1;gap:30px"><h2>${NM(F.pid)} با اهریمن <span style="color:${LVC[F.lv]}">${LVN[F.lv]}</span> (سطح ${fa(F.lv)}) می‌جنگد</h2><div class="powbig">قدرت باقی‌مانده: ${sv('pow')} <span class="gold">${fa(T ? T.pool.power : 0)}</span></div>
<div class="dcards">${cards}${F.pending == null ? '<div><div class="dc back">کارت بعدی؟</div><div class="dres" style="color:#a9a3cf">ادامه یا توقف نبرد</div></div>' : ''}</div>
<div class="sub">فقط بخش هم‌رنگ اهریمن خوانده می‌شود – توقف نبرد: پاداش همهٔ کارت‌های شکست‌خورده + ${fa(F.lv)} ${sv('hunt')}</div>${defGuide(F.lv)}</div></div>${pbarH(G)}${waitLine(G)}</div>`;
}

// ---------- start positions ----------
function setupScr() {
  const G = S.G, cells = ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'];
  const curId = G.order[G.cur];
  const gate = cells.map(c => { if (c === '1,1') return '<i class="c">دروازهٔ<br>شهر</i>'; const p = G.players.find(x => x.pos === '0,0|' + c); return `<i>${p ? `<b style="background:${p.color};color:${p.color}"></b>` : 'پورتال'}</i>`; }).join('');
  return `<div class="M MX" data-s="a"><div class="zt" style="padding:0 10px"><h2>چیدمان</h2><span class="sub">همهٔ بُر زدن‌ها و چیدن‌ها خودکار انجام شد</span></div>
${chalStrip(G)}
<div class="body" style="align-items:center;justify-content:center;gap:70px"><div class="ctr" style="gap:16px"><div class="sub">دروازهٔ شهر – هر بازیکن یکی از ۸ پورتال را در گوشی انتخاب می‌کند</div><div class="gate">${gate}</div></div>
<div class="order"><div class="zone" style="gap:12px"><h3>ترتیب بازی (تصادفی)</h3>${G.order.map((id, k) => { const p = G.players[id]; return `<div class="slot" style="border-color:${p.color}"><b class="gold">${fa(k + 1)}</b><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${k === 0 ? '<span class="tag">کلاه جادوگری – نفر اول</span>' : ''}<span class="st ${p.pos ? '' : 'wait'}">${p.pos ? 'خانه انتخاب شد ✓' : id === curId ? 'در حال انتخاب…' : 'در صف'}</span></div>`; }).join('')}</div>
<div class="zone chk" style="gap:0"><div><span>✓</span> توکن‌های چالش روی شب‌شمار</div><div><span>✓</span> ${fa(RU.acadRow)} کارت آکادمی و ردیف ثابت</div><div><span>✓</span> ${fa(RU.hallSize)} جادوگر تالار</div><div><span>✓</span> دک اهریمن و دستهٔ تایل‌ها</div><div><span>✓</span> ${fa(G.cfg.nights)} شب</div></div></div></div></div>`;
}

// the challenge tokens chosen for this game, each tagged with the night it sits on (Farshad 2026-11-05)
function chalStrip(G) {
  const ns = Object.keys(G.chal).map(Number).sort((a, b) => a - b);
  return `<div style="display:flex;gap:16px;justify-content:center;padding:18px 10px 0;flex-wrap:wrap">${ns.map(n => { const [name, pts] = CHN[G.chal[n]] || ['؟', 0]; return `<div class="zone" style="align-items:center;gap:8px;padding:12px 18px;min-width:230px;max-width:300px;text-align:center"><span class="tag" style="font-size:18px">چالش شب ${fa(n)}</span><b style="font-size:21px;line-height:1.5">${esc(name)}</b><span style="font-size:19px">${fa(pts)} ${sv('fame')}</span></div>`; }).join('')}</div>`;
}

// ---------- night ----------
function chalH(C) {
  const [name, pts] = CHN[C.k], mx = Math.max(1, ...C.vals.map(v => v.v));
  return `<h2>توکن چالش شب ${fa(C.night)}</h2><div style="font-size:34px;font-weight:800">${name} – ${fa(pts)} ${sv('fame')}</div><div class="bars">${C.vals.slice().sort((a, b) => (RU.challenges[C.k] && RU.challenges[C.k].dir === 'min' ? a.v - b.v : b.v - a.v)).map(v => `<div class="bar"><span class="nm">${NM(v.id)}</span><span class="tr"><b style="width:${v.v / mx * 100}%;background:${H(v.id)}"></b></span><span class="v">${fa(v.v)}</span></div>`).join('')}</div><div class="banner" style="background:rgba(243,207,114,.14);border-color:#f3cf72;color:#ffe7a6">${C.winners.length ? C.winners.map(NM).join(' و ') + ' ← ' + fa(C.pts) + ' ' + sv('fame') + (C.winners.length > 1 ? ' (تقسیم و گرد به پایین)' : '') : 'کسی امتیاز نگرفت'}</div>`;
}
function nightScr() {
  const G = S.G, Q = G.nightQ;
  // the breach banner only for a breach of this night's raid (a breach from the day before is not repeated here)
  const brNight = Q && Q.steps.some(x => x.k === 'mv' && x.done && x.m && x.m.breach);
  const br = brNight && G.lastBreach && seen.breach === G.lastBreach.n && Date.now() - (timers.breachAt || 0) < 15000 ? G.lastBreach : null;
  // the night as a checklist: done steps are ticked with what happened, the current one glows
  const one = (st, sub) => { const cls = st.done ? 'ok' : st.on ? 'on' : ''; return `<div class="nstep ${cls} ${sub ? 'sub' : ''}"><i>${st.done ? '✓' : st.on ? '◆' : ''}</i><div><b>${esc(st.t)}</b>${st.done && st.d ? `<span>${esc(st.d)}</span>` : ''}</div></div>`; };
  let list = '';
  if (Q) {
    const raid = Q.steps.find(x => x.k === 'raid'), mvs = Q.steps.filter(x => x.k === 'mv');
    // the «هجوم شبانه» item stays in progress while its demons move, and is ticked when the raid step itself runs
    if (raid) list += one(Object.assign({}, raid, { on: raid.on || mvs.some(x => x.on) }));
    for (const st of Q.steps) if (st.k !== 'raid') list += one(st, st.k === 'mv');
  }
  // a demon's raid step: its tile big on the map, the token slides along the corridor
  const cur = Q && Q.cur != null ? Q.steps[Q.cur] : null;
  // the left window shows what the current step does, with its own animation
  let map, det = '';
  if (cur && cur.k === 'mv') {
    const dm = G.dun.demons.find(x => x.id === cur.id), node = cur.m ? cur.m.from : dm ? dm.node : null;
    const ghost = cur.done && cur.m && cur.m.breach ? [{ id: cur.id, lv: cur.lv, node: cur.m.to }] : [];
    const hl = !cur.done && dm ? [dm.node] : [];
    map = node ? mapSvg(G, { focus: tileOf(node).split(',').map(Number), pad: .3, arrows: cur.done && cur.m ? [cur.m] : [], ghost, hl }) : mapSvg(G, { arrows: G.nightMoves });
  } else if (cur && cur.k === 'raid') map = mapSvg(G, { arrows: G.nightMoves });
  else if (cur) det = nightDet(G, cur, Q.cur);
  else map = mapSvg(G, { arrows: G.nightMoves });
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px">پایان شب ${fa(G.night)}</span>`)}<div class="body">
<div class="nlist zone"><h4>اقدامات پایان شب</h4>${list}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:18px;min-width:0">${br ? `<div class="banner">رخنه! اهریمن ${LVN[br.lv]} به دروازهٔ شهر رسید – ${br.mode === 'all' ? 'همه ۱ زخم گرفتند؛ ۱ امتیاز کم شد: <b>' + (br.fameLost || []).map(NM).join('، ') + '</b>' : 'کمترین توکن شکار: <b>' + br.hit.map(NM).join('، ') + '</b>'}</div>` : ''}${det ? det : `<div class="dmap nmv">${map}</div>`}</div></div>${pbarH(G)}${waitLine(G)}</div>`;
}
function nightDet(G, st, i) {
  const k = 'nd-' + G.night + '-' + i + (st.k === 'acad' || st.k === 'hall' ? '' : st.done ? 'd' : 'o');
  const box = (title, body, cls) => `<div class="ndet zone ${cls || ''}" data-k="${k}"><h2>${title}</h2>${body}${st.done && st.d ? `<div class="ndd">${esc(st.d)}</div>` : ''}</div>`;
  if (st.k === 'mv0') return box('هجوم شبانه', `<div class="ndbig">اهریمنی در سیاه‌چال نیست</div><div class="dmap" style="flex:1;width:100%">${mapSvg(G, {})}</div>`);
  if (st.k === 'chal') return G.chalResult && st.done ? `<div class="ndet zone" data-k="${k}">${chalH(G.chalResult)}</div>` : box('توکن چالش شب ' + fa(G.night), `<div class="ndbig">${esc(st.t)}</div>`);
  if (st.k === 'acad') {
    // the academy row as on the main screen: before, the card(s) about to burn glow at the right end;
    // after, they fade away, the row slides one place to the right and a new card comes from the deck (slow, see ANIM.slow)
    const nb = G.players.length === 2 ? 2 : 1, burn = []; if (!st.done) { for (let j = 0; j < G.acad.row.length && burn.length < nb; j++) if (!G.acad.seal[j]) burn.push(j); }
    const seen2 = {}; const row = G.acad.row.map((id, j) => acard(id, { cls: burn.includes(j) ? 'toburn' : '', seal: G.acad.seal[j] ? H(G.acad.seal[j].pid) : null, k: '-' + (seen2[id] = (seen2[id] || 0) + 1) })).join('');
    return box('آکادمی سحرستان', `<div class="ndrow zA"><div class="rowc">${row}<div class="deck">دک آکادمی</div></div></div>`);
  }
  if (st.k === 'hall') {
    const ws = st.done ? st.ws || [] : G.hall.row.map(w => ({ id: w.id, tok: w.tok || 0 }));
    return box('تالار جادوگران', `<div class="ndcards">${ws.map(w => `<div class="ndc ${st.done && w.add ? 'tokpop' : ''}">${wcard(w.id, w.tok)}</div>`).join('')}</div>`);
  }
  if (st.k === 'hat') {
    const id = st.done ? st.first : G.order[0];
    return box('کلاه جادوگری', `<div class="nhat ${st.done ? 'go' : ''}"><svg viewBox="0 0 64 64" width="190" height="190"><defs><linearGradient id="gHat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f6bff"/><stop offset="1" stop-color="#2c1677"/></linearGradient></defs><path d="M33 4c-4 9-9 20-13 34l24 0C41 28 38 20 44 12c-4 2-8 1-11-8z" fill="url(#gHat)" stroke="#120a33" stroke-width="1.6" stroke-linejoin="round"/><path d="M21 33.5c7 1.6 15 1.6 22 0l1 4.6c-8 1.8-16 1.8-24 0z" fill="#f3cf72" stroke="#6e4a08" stroke-width="1.2"/><ellipse cx="32" cy="44" rx="27" ry="7" fill="url(#gHat)" stroke="#120a33" stroke-width="1.6"/><path d="M28 18l1.4 2.8 3 .4-2.2 2 .6 3-2.8-1.5-2.7 1.5.5-3-2.2-2 3-.4z" fill="#f3cf72"/></svg><div class="nhn" style="color:${H(id)}">${NM(id)}</div><div class="sub">${G.players.length === 2 ? 'بازی دونفره: نوبت‌ها یکی در میان' : st.done ? 'نفر اول شب ' + fa(G.night + 1) : 'کلاه به نفر بعد می‌رسد…'}</div></div>`);
  }
  if (st.k === 'battle') return box('نبرد جادوگران', `<div class="ndbig">آماده شدن برای نبرد…</div>`);
  return box(esc(st.t), '');
}

// ---------- wizard battle ----------
function battleScr() {
  const G = S.G, B = G.battle;
  const head = topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px">نبرد جادوگران${B.bf ? ' – ' + esc(B.bf.name) : ''} – پایان شب ${fa(G.night)}</span>`);
  const track = `<div class="rtrack">${Array.from({ length: 6 }, (_, k) => { const w = B.wins[k]; return `<i class="${k + 1 === B.round && B.phase !== 'done' ? 'cur' : ''}" style="${w != null && w !== 'lost' && G.players[w] ? `background:${H(w)}` : ''}">${fa(k + 1)}</i>`; }).join('')}</div>`;
  if (B.phase === 'prep') {
    return `<div class="M MX" data-s="a">${head}<div class="body" style="flex-direction:column;gap:26px;justify-content:center">
${B.bf ? `<div class="ctr"><div class="bfx"><span>اثر میدان نبرد</span><b>${esc(B.bf.name)}</b><span>${esc(B.bf.txt)}</span></div></div>` : ''}
<div class="plat">${G.order.map(id => { const p = G.players[id]; return `<div class="pc" style="--pc:${p.color}"><div class="nmx"><i></i>${esc(p.name)}</div><div class="deck" style="width:150px;height:212px;display:flex;align-items:center;justify-content:center;font-size:22px">دک ${fa(p.wizN != null ? p.wizN : p.wiz.length)}</div><div class="${B.ready[id] ? '' : 'sub'}" style="${B.ready[id] ? 'color:#9ef0c3' : ''}">${B.ready[id] ? 'آماده ✓' : 'در حال حذف…'}</div></div>`; }).join('')}</div>
<div class="ctr rtrack" style="flex-direction:row;justify-content:center"><span class="sub">${fa(DATA.wrules.rounds || 6)} راند:</span>${Array.from({ length: DATA.wrules.rounds || 6 }, (_, k) => `<i>${fa(k + 1)}</i>`).join('')}</div></div>${waitLine(G)}</div>`;
  }
  if (B.phase === 'done' && B.res) {
    const R = B.res.res;
    const rows = G.order.slice().sort((a, b) => R[b].total - R[a].total).map(id => `<tr class="${R[id].bonus ? 'win' : ''}"><td><span class="nmd"><i style="background:${H(id)}"></i>${NM(id)}</span></td><td>${Array.from({ length: 6 }, (_, k) => `<span class="tri ${k < R[id].tokens ? '' : 'off'}"></span>`).join('')}</td><td>${fa(R[id].tokens)}</td><td>${R[id].extra ? fa(R[id].extra) + '+' : ''}</td><td>${R[id].bonus ? fa(R[id].bonus) + '+' : ''}</td><td style="font-size:34px">${R[id].total ? '+' + fa(R[id].total) : '۰'} ${sv('fame')}</td></tr>`).join('');
    return `<div class="M MX" data-s="a">${head}<div class="body"><div class="zone ctr" style="flex:1;gap:24px"><h2>نتیجهٔ نبرد</h2>
<table class="tbl" style="width:1400px"><tr><th></th><th>توکن‌های راند</th><th>هر توکن ۱</th><th>امتیاز کارت</th><th>جایزهٔ بیشترین توکن</th><th>جمع</th></tr>${rows}</table>
<div class="sub">جایزهٔ بیشترین توکن ۲ امتیاز است؛ در تساوی، برندهٔ راند ششم آن را می‌گیرد – همه «باشه» را در گوشی بزنند</div></div></div>${pbarH(G)}${waitLine(G)}</div>`;
  }
  // rounds (Farshad 2026-11-06): every player box has a fixed card slot. Round start: empty slot; a sent card shows its back
  // in the slot; when all have sent, all cards turn over together and the power diamonds count to the final power;
  // the round result (winner glow, «no winner») stays until the first player sends a card for the next round.
  // Next-card effects sit under the slot, until-end-of-battle effects above it.
  const L = B.last, anyPick = G.order.some(id => B.picked[id]);
  const showRes = !!L && (B.phase === 'r6' || B.phase === 'peek' || (B.phase === 'pick' && !anyPick));
  const noWin = L && (L.winner == null || L.winner === 'lost');
  const fxChip = (cid, kind) => { const w = wiz(cid); if (!w) return ''; const t = TN[w.t] || ['', '']; return `<span class="bfxc ${kind}" data-k="fx-${kind}-${cid}"><i>${t[0]}</i><b>${esc(cid)}</b>${esc(w.txt || '')}</span>`; };
  const untilH = id => `<div class="buntil">${((B.until || {})[id] || []).map(c => fxChip(c, 'until')).join('')}</div>`;
  const nextH = id => `<div class="bnext">${(B.next || {})[id] ? fxChip(B.next[id], 'next') : ''}</div>`;
  const back = (id, r) => `<div class="wbk sent" data-k="wbk-${r}-${id}"></div>`;
  const flip = (r, id, inner) => `<div class="wflip" data-k="fl-${r}-${id}"><div class="wfb"></div><div class="wff">${inner}</div></div>`;
  const noCard = '<div class="bnoc">بدون کارت</div>';
  // the power line: base value, then each change pops in one after another and the diamond steps to the final power
  const T0 = 1.1, STEP = .9;
  const powH = id => {
    const cid = L.cards[id]; if (!cid) return '<div class="bpow"></div>';
    const parts = (L.parts && L.parts[id]) || [], fin = L.score[id] != null ? L.score[id] : 0;
    let v = L.base && L.base[id] != null ? L.base[id] : fin - parts.reduce((s, x) => s + x[0], 0);
    const vals = [v]; for (const [d] of parts) vals.push(v += d);
    if (vals[vals.length - 1] !== fin) vals.push(fin);
    const dm = vals.map((x, k) => `<b class="dmv ${k === vals.length - 1 ? 'last' : ''}" style="--d:${(T0 + k * STEP).toFixed(2)}s;--e:${(T0 + (k + 1) * STEP).toFixed(2)}s">${fa(x)}</b>`).join('');
    const chips = parts.map(([d, why], k) => `<span class="ptag bpin" style="--d:${(T0 + (k + 1) * STEP).toFixed(2)}s"><b>${d > 0 ? '+' : ''}${fa(d)}</b>${esc(why)}</span>`).join('');
    const td = L.tie && L.tie.dice && L.tie.dice[id] != null ? `<span class="tdie bpin" style="--d:${(T0 + vals.length * STEP).toFixed(2)}s"><b>+${dieN(L.tie.dice[id])}</b>تاس جادو</span>` : '';
    return `<div class="bpow" data-k="pow-${L.round}-${id}"><div class="ptrail"><span class="dm">${dm}</span>${td}</div><div class="pchips">${chips}</div></div>`;
  };
  const endT = id => { const parts = (L && L.parts && L.parts[id]) || [], td = L && L.tie && L.tie.dice && L.tie.dice[id] != null ? 1 : 0; return T0 + (parts.length + 1 + td) * STEP; };
  const winT = L ? Math.max(...G.order.map(endT)) : 0;
  let cols;
  if (showRes) {
    cols = G.order.map(id => { const cid = L.cards[id], win = L.winner === id;
      return `<div class="pc bcol ${win ? 'win' : ''}" style="--pc:${H(id)};--wd:${winT.toFixed(2)}s"><div class="nmx"><i></i>${NM(id)}</div>${untilH(id)}<div class="bslot">${flip(L.round, id, cid ? wcard(cid) : noCard)}</div>${powH(id)}<div class="bwinr">${win ? `<span class="tag bwin" style="--d:${winT.toFixed(2)}s">برندهٔ راند</span>` : ''}</div>${nextH(id)}</div>`; }).join('');
  } else {
    const r = B.round;
    cols = G.order.map(id => { const shown = B.phase === 'resolve' && B.shown ? B.shown[id] : undefined;
      const inner = shown !== undefined ? flip(r, id, shown ? wcard(shown) : noCard) : B.picked[id] ? back(id, r) : '';
      return `<div class="pc bcol" style="--pc:${H(id)}"><div class="nmx"><i></i>${NM(id)}</div>${untilH(id)}<div class="bslot ${inner ? '' : 'empty'}">${inner}</div><div class="bpow"></div><div class="bwinr"></div>${nextH(id)}</div>`; }).join('');
  }
  const title = showRes ? (noWin ? `راند ${fa(L.round)}: این راند برنده نداشت` : `راند ${fa(L.round)}: برنده ${NM(L.winner)}`) : `راند ${fa(B.round)} از ${fa(DATA.wrules.rounds || 6)}`;
  const status = G.order.map(id => `<span class="bst ${B.picked[id] ? 'ok' : ''}" style="--pc:${H(id)}"><i></i>${NM(id)} ${B.picked[id] ? '✓' : '…'}</span>`).join('');
  const st = B.phase === 'r6' ? NM(B.shower) + ' «نمایش نتایج» را در گوشی بزند'
    : G.prompts.length ? (showRes ? '' : 'کارت‌ها رو شد – ') + waitTxt(G)
    : showRes ? 'راند بعد با انتخاب کارت در گوشی شروع می‌شود'
    : B.phase === 'pick' ? 'انتخاب پنهان: ' + status
    : 'در حال اجرای اثرها…';
  return `<div class="M MX" data-s="a">${head}${btrack(G, B)}<div class="body" style="flex-direction:column;gap:14px">
<div class="ctr"><h2 class="btitle ${showRes && noWin ? 'nowin' : ''}" data-k="bt-${showRes ? 'r' + L.round : 'p' + B.round}" style="${showRes ? `--d:${winT.toFixed(2)}s` : ''}">${title}</h2></div>
<div class="plat bplat">${cols}</div>
<div class="bstat">${st}</div></div></div>`;
}
// round counter: big rounded triangles in the top-left corner, coloured by each round's winner
function btrack(G, B) {
  const n = DATA.wrules.rounds || 6;
  return `<div class="btrack">${Array.from({ length: n }, (_, k) => { const w = B.wins[k], c = w != null && w !== 'lost' && G.players[w] ? H(w) : null, cur = k + 1 === B.round && B.phase !== 'done' && B.phase !== 'r6';
    const f = c || (cur ? '#f3cf72' : 'rgba(255,255,255,.14)');
    return `<svg class="${cur ? 'cur' : ''}" viewBox="0 0 60 54"><path d="M30 8 L53 46 L7 46 Z" fill="${f}" stroke="${f}" stroke-width="10" stroke-linejoin="round"/><text x="30" y="41" text-anchor="middle">${fa(k + 1)}</text></svg>`; }).join('')}</div>`;
}

// ---------- final ----------
function finalScr() {
  const G = S.G, F = G.final;
  const rows = F.rows.map(r => `<tr class="${F.winners.includes(r.id) ? 'win' : ''}"><td><span class="nmd"><i style="background:${H(r.id)}"></i>${NM(r.id)}</span></td><td>${fa(r.during)}</td><td>${fa(r.cards)}</td><td style="color:#ff8a7a">${r.wounds ? fa(r.wounds) + '-' : '۰'}</td><td>${fa(r.ess)}</td><td>${fa(r.cs)}</td><td style="font-size:36px" class="gold">${fa(r.total)}</td></tr>`).join('');
  return `<div class="M MX" data-s="a"><div class="body"><div class="zone ctr" style="flex:1;gap:26px"><div class="sub">پایان شب ${fa(G.cfg.nights)}</div><div class="bigt" style="font-size:96px">استاد اعظم سحر: ${F.winners.map(i => `<span style="color:${H(i)}">${NM(i)}</span>`).join(' و ')}</div>
<table class="tbl" style="width:1500px"><tr><th></th><th>امتیازشمار</th><th>کارت‌های آکادمی</th><th>زخم</th><th>جوهره</th><th>سکه و طومار</th><th>جمع</th></tr>${rows}</table>
<div class="sub">تساوی: توکن شکار، صندوقچه، جوهره، سکه و طومار</div></div></div></div>`;
}

// ---------- overlays: toasts, die, duel, challenge ----------
function show(k, ms) { timers[k] = Date.now() + ms; setTimeout(render, ms + 30); }
const live = k => timers[k] && Date.now() < timers[k];
function overlays() {
  const G = S.G; let o = '';
  const last = G.toasts[G.toasts.length - 1];
  if (last && last.n > seen.toast) { seen.toast = last.n; timers.toastT = last; show('toast', 4500); }
  // the toast is drawn last and only when no big overlay is open (it used to slide under the duel table)
  const tst = live('toast') && timers.toastT && CURK !== 'main' && CURK !== 'night' ? `<div class="mtoast k-${timers.toastT.kind}${G.battle ? ' btop' : ''}">${esc(timers.toastT.t)}</div>` : '';
  // every die a player rolls: spinning faces on the big screen, then the result
  const rr = G.roll;
  // a roll from the last turn is not replayed when the night starts (Farshad 2026-11-06)
  if (rr && rr.n > seen.die && G.phase === 'night' && !G.battle) seen.die = rr.n;
  // a roll that belongs to another moment (a battle die after the battle, a die of an earlier turn) is never replayed
  if (rr && rr.n > seen.die) { const bRoll = !!rr.bt || /نبرد/.test(rr.label || ''); if (bRoll !== !!G.battle || (!G.battle && G.phase === 'turn' && G.turn && G.turn.pid !== rr.pid && !G.duelPend && !/^دوئل/.test(rr.label || ''))) seen.die = rr.n; }
  // duel rolls land straight in the duel table (all players roll at once, big overlays would cover each other)
  if (rr && rr.n > seen.die && (G.duelPend || /^دوئل/.test(rr.label || '') || (rr.bt && G.battle))) { seen.die = rr.n; SFX.play('dice'); }
  if (rr && rr.n > seen.die) { seen.die = rr.n; SFX.play('dice'); setTimeout(() => dieFx(document.body, Object.assign({}, rr, { label: G.players[rr.pid].name + ' – ' + (rr.label || '') }), 'mon'), 0); }
  if (G.duel && G.duel.n > seen.duel) { seen.duel = G.duel.n; show('duel', 9000); }
  if (live('duel') && G.duel) {
    const D2 = G.duel;
    o += `<div class="ovl"><div class="zone ctr" style="gap:20px;padding:34px 50px"><h2>دوئل چالش کریستال</h2><table class="tbl" style="width:1100px"><tr><th></th><th>پرتاب ۱</th><th>پرتاب ۲</th><th>پرتاب ۳</th><th>جمع</th></tr>${D2.res.map(r => `<tr class="${D2.winner === r.id ? 'win' : ''}"><td><span class="nmd"><i style="background:${H(r.id)}"></i>${NM(r.id)}</span></td>${r.rolls.map(x => `<td><span class="die6">${fa(x)}</span></td>`).join('')}<td style="font-size:34px">${fa(r.sum)}${D2.winner === r.id ? ' <span class="tag">برنده</span>' : ''}</td></tr>`).join('')}</table><div class="sub">${D2.winner == null ? 'مساوی؛ کسی جایزه نمی‌گیرد' : 'برنده جایزه‌اش را در گوشی انتخاب می‌کند'}</div></div></div>`;
  }
  // crystal duel in progress: every roll appears in the table as soon as the player throws it
  if (G.duelPend && !live('duel')) {
    const D2 = G.duelPend, nd = RU.duelDice || 3, cur = D2.res[D2.k];
    o += `<div class="ovl"><div class="zone ctr" style="gap:20px;padding:34px 50px"><h2>دوئل چالش کریستال</h2><table class="tbl" style="width:1100px"><tr><th></th>${Array.from({ length: nd }, (_, k) => `<th>پرتاب ${fa(k + 1)}</th>`).join('')}<th>جمع</th></tr>${D2.res.map(r => `<tr class="${r.rolls.length >= nd ? 'win' : ''}"><td><span class="nmd"><i style="background:${H(r.id)}"></i>${NM(r.id)}</span></td>${Array.from({ length: nd }, (_, k) => `<td>${r.rolls[k] != null ? `<span class="die6">${fa(r.rolls[k])}</span>` : '<span class="sub">–</span>'}</td>`).join('')}<td style="font-size:34px">${r.rolls.length ? fa(r.sum) : ''}</td></tr>`).join('')}</table><div class="sub">همه با هم در گوشی تاس می‌اندازند – ${D2.res.filter(r => r.rolls.length < nd).map(r => NM(r.id)).join('، ')}</div></div></div>`;
  }
  if (G.chalResult && G.chalResult.n > seen.chal) { seen.chal = G.chalResult.n; show('chal', 9000); }
  if (live('chal') && G.chalResult && G.phase !== 'night') o += `<div class="ovl"><div class="zone ctr" style="gap:26px;padding:34px 50px;width:1300px">${chalH(G.chalResult)}</div></div>`;
  if (G.lastBreach && G.lastBreach.n > seen.breach) { seen.breach = G.lastBreach.n; timers.breachAt = Date.now(); }
  return o.includes('class="ovl"') ? o : o + tst;
}
