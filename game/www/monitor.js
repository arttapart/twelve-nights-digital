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
  S = m;
  if (first && S.G) { // do not replay old overlays after a reload
    const G = S.G; seen.toast = G.toasts.length ? G.toasts[G.toasts.length - 1].n : 0; seen.die = G.turn && G.turn.die ? G.turn.die.n : 0;
    seen.duel = G.duel ? G.duel.n : 0; seen.chal = G.chalResult ? G.chalResult.n : 0; seen.breach = G.lastBreach ? G.lastBreach.n : 0;
  }
  first = false;
  render();
});

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
  morph(stage, h + overlays(), k);
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
<div class="chk" style="font-size:22px;margin-top:6px">${n >= 2 ? `${fa(n)} بازیکن – <span class="gold">${n === 5 ? '۱۰' : '۱۲'} شب</span>` : 'دست‌کم ۲ بازیکن لازم است'} – اثرهای میدان نبرد: <span class="gold">${L.bf ? 'روشن' : 'خاموش'}</span></div>
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
  return `<div class="top">${nightsH(G)}<div class="chal">${extra || chalLine(G)}</div><div class="turn">${T ? `<b style="color:${H(T.pid)}">نوبت ${NM(T.pid)}</b>` : ''}<span>شب ${fa(G.night)} از ${fa(G.cfg.nights)}${G.huntLeft != null && G.huntLeft < 999 ? ' – توکن شکار مانده ' + fa(G.huntLeft) : ''}</span></div></div>`;
}
function pbarH(G) {
  const T = G.turn;
  return `<div class="pbar" style="grid-template-columns:repeat(${G.players.length},1fr)">${G.order.map(id => {
    const p = G.players[id], on = T && T.pid === id;
    const played = on ? `<div class="played">${T.played.slice(-6).map(x => { const c = card(x.c); return `<div class="mini"><div class="mt2" style="background:${TYBG[c.ty]}">${TYN[c.ty]}</div><div class="mn">${esc(c.name)}</div></div>`; }).join('')}</div>` : '';
    return `<div class="pt ${on ? 'on' : ''}" style="--pc:${p.color}">${played}<div class="nm"><i style="background:${p.color}"></i>${esc(p.name)}${on ? '<span style="font-size:16px;font-weight:600;opacity:.8">· در حال بازی</span>' : ''}</div><div class="stats"><span>${sv('fame')}${fa(p.fame)}</span><span>${sv('coin')}${fa(p.store.coin)}</span><span>${sv('scr')}${fa(p.store.scroll)}</span><span>${sv('ess')}${fa(p.store.ess)}</span><span>${sv('hunt')}${fa(p.hunt)}</span>${p.wounds ? `<span class="wd">زخم ${fa(p.wounds)}</span>` : ''}</div></div>`;
  }).join('')}</div>`;
}
function waitLine(G) {
  const q = G.prompts[0]; if (!q) return '';
  return `<div class="waitq">منتظر ${NM(q.to)}: ${esc(q.title || '')}</div>`;
}
function curCard(G) {
  const T = G.turn; if (!T) return '';
  const ui = S.ui || {};
  if (ui.tab === 'acad') { const L = acadList(G); const it = L[ui.i]; if (it) return acard(it.id); }
  if (ui.tab === 'hall') { const w = G.hall.row[ui.i]; if (w) return wcard(w.id, w.tok); }
  const x = T.played[T.played.length - 1];
  return x ? acard(x.c) : '<div class="sub">هنوز کارتی بازی نشده</div>';
}
const acadList = G => G.acad.row.map((id, i) => ({ src: 'row', i, id })).concat(Object.keys(G.acad.fixed).map(id => ({ src: 'fixed', i: id, id })));

// ---------- main view ----------
function mainScr() {
  const G = S.G, ui = S.ui || {}, T = G.turn;
  const acadI = T && ui.tab === 'acad' ? ui.i : -1, hallI = T && ui.tab === 'hall' ? ui.i : -1;
  const seals = G.acad.seal;
  const row = G.acad.row.map((id, i) => acard(id, { cls: i === acadI ? 'view' : '', seal: seals[i] ? H(seals[i].pid) : null })).join('');
  const fixed = Object.keys(G.acad.fixed).map((id, k) => `<div class="stk"><span class="cl">${fa(G.acad.fixed[id])} کارت</span>${acard(id, { cls: G.acad.row.length + k === acadI ? 'view' : '' })}</div>`).join('');
  const hall = G.hall.row.map((w, i) => wcard(w.id, w.tok, { cls: i === hallI ? 'view' : '' })).join('');
  return `<div class="M" data-s="a">${topH(G)}
<div class="side"><div class="mm zone"><h4>سیاه‌چال</h4><div class="mmap">${mapSvg(G, { minSize: 2 * TS })}</div></div><div class="cur zone"><h4>${ui.tab === 'acad' || ui.tab === 'hall' ? 'کارت در حال دیدن' : 'کارت در حال اجرا'}</h4><div class="curc">${curCard(G)}</div></div></div>
<div class="zone zA"><div class="zt"><h3>آکادمی سحرستان</h3><span>دک: ${fa(G.acad.deckN)} کارت – سوخته: ${fa(G.acad.discard.length)}</span></div><div class="rowc"><div class="deck">دک آکادمی</div>${row}<div class="sep"></div>${fixed}</div></div>
<div class="zone zH"><div class="zt"><h3>تالار جادوگران</h3><span>دک جادوگران شهر: ${fa(G.hall.deckN)}</span></div><div class="rowc"><div class="deck">دک جادوگران</div>${hall}</div></div>
<div class="zone zG"><h3>گوبلین</h3><div class="gh"></div><p><span>۱ ${sv('pow')} بده</span><span>۱ ${sv('coin')} یا ۱ ${sv('scr')} بگیر</span>هر نوبت ۱ بار</p></div>
${pbarH(G)}${waitLine(G)}</div>`;
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
  if (G.dun.place) lab = 'تایل تازه – با گوشی بچرخان و تأیید کن';
  else if (G.dun.portal) { const po = G.dun.portal; o.portal = po.list[po.i] ? po.list[po.i].cells : []; lab = `پرتال – کاشی مقصد ${fa(po.i + 1)} از ${fa(po.list.length)} – انتخاب با گوشی`; }
  else { o.moves = G.moves || []; o.exits = G.exits || []; if (S.ui.off && (S.ui.off[0] || S.ui.off[1])) lab = 'کاشی کناری – برای برگشتن «کاشی من» را در گوشی بزن'; }
  const pool = T.pool;
  const res = `<div class="dpool">${sv('step')}<b>${fa(T.run > 0 ? 'دویدن' : pool.step)}</b>${pool.tele ? `<span>تله‌پورت ${fa(pool.tele)}</span>` : ''}${sv('torch')}<b>${fa(p.torch)}</b>${sv('pick')}<b>${fa(p.pick)}</b>${sv('pow')}<b>${fa(pool.power)}</b></div>`;
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px;background:rgba(79,192,141,.18);color:#9ef0c3;border-color:#4fc08d">مد سیاه‌چال</span>`)}
<div class="body"><div class="dmap">${mapSvg(G, o)}<div class="dlab">${lab}</div></div><div class="dside"><div class="cur zone"><h4>${NM(p.id)}</h4>${res}<div class="dunon" style="flex:1;display:flex;align-items:center;justify-content:center">${curCard(G)}</div></div>${legend()}</div></div>${pbarH(G)}${waitLine(G)}</div>`;
}

// ---------- demon fight ----------
function dcardH(ci, lv, paid, on) {
  const dm = DATA.demons[ci];
  const rew = r => Object.entries(r).map(([k, v]) => ({ f: `${sv('fame')}${fa(v)}`, e: `${sv('ess')}${fa(v)}`, c: `${sv('coin')}/${sv('scr')}${v > 1 ? '×' + fa(v) : ''}`, t: `${sv('torch')}${v > 1 ? '×' + fa(v) : ''}`, b: `${sv('pick')}${v > 1 ? '×' + fa(v) : ''}`, tb: `${sv('torch')}/${sv('pick')}`, st: `${sv('step')}${v > 1 ? '×' + fa(v) : ''}`, tp: 'تله‌پورت', dr: `کشیدن ${fa(v)}`, rm: 'حذف کارت' }[k] || k)).join(' ');
  const art = ART.demons && ART.demons[ci];
  if (art) return `<div class="dc artfull lv${lv || 0}" style="background-image:url('${artU(art)}')">${lv ? `<span class="dlvl">${['', 'زرد', 'نارنجی', 'قرمز'][lv]}</span>` : ''}</div>`;
  return `<div class="dc">${[['y', 1], ['o', 2], ['r', 3]].map(([c, l]) => `<div class="sec ${c} ${l === lv ? 'on' : ''}"><span class="dv">${fa(dm[c][0])}</span>${rew(dm[c][1])}</div>`).join('')}</div>`;
}
function fightScr() {
  const G = S.G, F = G.fight, T = G.turn;
  const cards = F.cards.map((c, i) => `<div>${dcardH(c.ci, F.lv)}<div class="dres" style="color:${c.paid ? '#9ef0c3' : '#ffe7a6'}">${c.paid ? 'شکست خورد ✓ – ' + fa(c.def) + ' قدرت' : 'دفاع ' + fa(c.def) + ' – در انتظار'}</div></div>`).join('');
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px;background:rgba(240,138,42,.18);color:#ffd7b0;border-color:#f08a2a">نبرد با اهریمن</span>`)}
<div class="body"><div class="zone ctr" style="flex:1;gap:30px"><h2>${NM(F.pid)} با اهریمن <span style="color:${LVC[F.lv]}">${LVN[F.lv]}</span> (سطح ${fa(F.lv)}) می‌جنگد</h2><div class="powbig">قدرت باقی‌مانده: ${sv('pow')} <span class="gold">${fa(T ? T.pool.power : 0)}</span></div>
<div class="dcards">${cards}${F.pending == null ? '<div><div class="dc back">کارت بعدی؟</div><div class="dres" style="color:#a9a3cf">ادامه یا توقف نبرد</div></div>' : ''}</div>
<div class="sub">فقط بخش هم‌رنگ اهریمن خوانده می‌شود – توقف نبرد: پاداش همهٔ کارت‌های شکست‌خورده + ${fa(F.lv)} ${sv('hunt')}</div></div></div>${pbarH(G)}${waitLine(G)}</div>`;
}

// ---------- start positions ----------
function setupScr() {
  const G = S.G, cells = ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'];
  const curId = G.order[G.cur];
  const gate = cells.map(c => { if (c === '1,1') return '<i class="c">خانهٔ<br>دروازه</i>'; const p = G.players.find(x => x.pos === '0,0|' + c); return `<i>${p ? `<b style="background:${p.color};color:${p.color}"></b>` : 'پورتال'}</i>`; }).join('');
  return `<div class="M MX" data-s="a"><div class="zt" style="padding:0 10px"><h2>چیدمان</h2><span class="sub">همهٔ بُر زدن‌ها و چیدن‌ها خودکار انجام شد</span></div>
${chalStrip(G)}
<div class="body" style="align-items:center;justify-content:center;gap:70px"><div class="ctr" style="gap:16px"><div class="sub">دروازهٔ شهر – هر بازیکن یکی از ۸ پورتال را در گوشی انتخاب می‌کند</div><div class="gate">${gate}</div></div>
<div class="order"><div class="zone" style="gap:12px"><h3>ترتیب بازی (تصادفی)</h3>${G.order.map((id, k) => { const p = G.players[id]; return `<div class="slot" style="border-color:${p.color}"><b class="gold">${fa(k + 1)}</b><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${k === 0 ? '<span class="tag">کلاه جادوگری – نفر اول</span>' : ''}<span class="st ${p.pos ? '' : 'wait'}">${p.pos ? 'خانه انتخاب شد ✓' : id === curId ? 'در حال انتخاب…' : 'در صف'}</span></div>`; }).join('')}</div>
<div class="zone chk" style="gap:0"><div><span>✓</span> توکن‌های چالش روی شب‌شمار</div><div><span>✓</span> ${fa(RU.acadRow)} کارت آکادمی و ردیف ثابت</div><div><span>✓</span> ${fa(RU.hallSize)} جادوگر تالار</div><div><span>✓</span> دک اهریمن و دستهٔ تایل‌ها</div><div><span>✓</span> ${fa(G.cfg.nights)} شب</div></div></div></div></div>`;
}

// the challenge tokens chosen for this game, each tagged with the night it sits on (Farshad 2026-11-05)
function chalStrip(G) {
  const ns = Object.keys(G.chal).map(Number).sort((a, b) => a - b);
  return `<div style="display:flex;gap:16px;justify-content:center;padding:18px 10px 0;flex-wrap:wrap">${ns.map(n => { const [name, pts] = CHN[G.chal[n]] || ['؟', 0]; return `<div class="zone" style="align-items:center;gap:8px;padding:12px 18px;min-width:230px;max-width:300px;text-align:center"><span class="tag" style="font-size:18px">شب ${fa(n)}</span><b style="font-size:21px;line-height:1.5">${esc(name)}</b><span style="font-size:19px">${fa(pts)} ${sv('fame')}</span></div>`; }).join('')}</div>`;
}

// ---------- night ----------
function nightScr() {
  const G = S.G, st = G.nightStage;
  const steps = [['event', '۱. هجوم شبانه'], ['chal', '۲. رویداد شب: توکن چالش'], ['battle', '۳. نبرد جادوگران'], ['wrap', '۴. آکادمی و تالار'], ['x', '۵. کلاه جادوگری ← نفر بعد']];
  const idx = { event: 0, chal: 1, battle: 2, wrap: 3 }[st] || 0;
  const br = G.lastBreach && G.lastBreach.n > (G.nightSteps ? 0 : 0) ? G.lastBreach : null;
  return `<div class="M MX" data-s="a">${topH(G, `<span class="tag" style="font-size:22px;padding:6px 18px">پایان شب ${fa(G.night)}</span>`)}<div class="body">
<div class="steps">${steps.map(([k, t], i) => `<div class="${i === idx ? 'on' : ''}">${t}</div>`).join('')}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:18px;min-width:0">${br && seen.breach === br.n && Date.now() - (timers.breachAt || 0) < 15000 ? `<div class="banner">رخنه! اهریمن ${LVN[br.lv]} به خانهٔ دروازه رسید – کمترین توکن شکار: <b>${br.hit.map(NM).join('، ')}</b></div>` : ''}<div class="dmap">${mapSvg(G, { arrows: G.nightMoves })}</div></div></div>${pbarH(G)}${waitLine(G)}</div>`;
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
  // rounds: show last revealed round + who has picked
  const L = B.last;
  let lastH = '';
  if (L) {
    lastH = `<div class="plat" style="flex:1">${G.order.map(id => { const cid = L.cards[id]; const win = L.winner === id; const parts = (L.parts && L.parts[id]) || [];
      return `<div class="pc ${win ? 'win' : ''}" style="--pc:${H(id)};justify-content:center"><div class="nmx"><i></i>${NM(id)}</div>${cid ? wcard(cid) : '<div class="deck" style="width:158px;height:240px;display:flex;align-items:center;justify-content:center">بدون کارت</div>'}${cid ? `<div class="ptrail">${parts.map(([v, why]) => `<div class="pold"><span class="ptag"><b>${v > 0 ? '+' : ''}${fa(v)}</b>${esc(why)}</span></div>`).join('')}<span class="dm">${fa(L.score[id] != null ? L.score[id] : 0)}</span></div>` : ''}${win ? '<span class="tag" style="font-size:20px">برندهٔ راند</span>' : ''}</div>`; }).join('')}</div>`;
  }
  const status = G.order.map(id => `<span class="bst ${B.picked[id] ? 'ok' : ''}" style="--pc:${H(id)}"><i></i>${NM(id)} ${B.picked[id] ? '✓' : '…'}</span>`).join('');
  return `<div class="M MX" data-s="a">${head}<div class="body" style="flex-direction:column;gap:18px">
<div class="ctr" style="flex-direction:row;gap:30px"><h2>${L && B.phase === 'pick' ? 'راند ' + fa(L.round) + ' تمام شد – ' : ''}راند ${fa(B.round)} از ۶</h2>${track}</div>
${lastH || '<div class="ctr" style="flex:1"><div class="sub" style="font-size:30px">هر بازیکن در گوشی یک کارت از دست ۲ کارتی‌اش را پنهانی انتخاب می‌کند</div></div>'}
<div class="bstat">${B.phase === 'pick' ? 'انتخاب پنهان: ' + status : 'در حال اجرای اثرها…'}</div></div>${waitLine(G)}</div>`;
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
  if (live('toast') && timers.toastT) o += `<div class="mtoast k-${timers.toastT.kind}">${esc(timers.toastT.t)}</div>`;
  const die = G.turn && G.turn.die;
  if (die && die.n > seen.die) { seen.die = die.n; show('die', 3200); }
  if (live('die') && die) o += `<div class="dieo"><div class="dv"><svg style="width:150px;height:150px"><use href="#i-die"/></svg><div style="font-size:64px;font-weight:900;line-height:1.1">${die.vals.map(fa).join(' + ')}</div><div style="font-size:26px;font-weight:700">تاس ${DIEN[die.lv] || ''} ${NM(G.turn.pid)} – ${fa(die.total)} ${sv('pow')}${die.flags.x2 ? ' – دو برابر' : ''}${die.flags.gem ? ' – گوهر نیرو ۱+' : ''}</div></div></div>`;
  if (G.duel && G.duel.n > seen.duel) { seen.duel = G.duel.n; show('duel', 9000); }
  if (live('duel') && G.duel) {
    const D2 = G.duel;
    o += `<div class="ovl"><div class="zone ctr" style="gap:20px;padding:34px 50px"><h2>دوئل چالش کریستال</h2><table class="tbl" style="width:1100px"><tr><th></th><th>پرتاب ۱</th><th>پرتاب ۲</th><th>پرتاب ۳</th><th>جمع</th></tr>${D2.res.map(r => `<tr class="${D2.winner === r.id ? 'win' : ''}"><td><span class="nmd"><i style="background:${H(r.id)}"></i>${NM(r.id)}</span></td>${r.rolls.map(x => `<td><span class="die6">${fa(x)}</span></td>`).join('')}<td style="font-size:34px">${fa(r.sum)}${D2.winner === r.id ? ' <span class="tag">برنده</span>' : ''}</td></tr>`).join('')}</table><div class="sub">${D2.winner == null ? 'مساوی؛ کسی جایزه نمی‌گیرد' : 'برنده جایزه‌اش را در گوشی انتخاب می‌کند'}</div></div></div>`;
  }
  if (G.chalResult && G.chalResult.n > seen.chal) { seen.chal = G.chalResult.n; show('chal', 9000); }
  if (live('chal') && G.chalResult) {
    const C = G.chalResult, [name, pts] = CHN[C.k], mx = Math.max(1, ...C.vals.map(v => v.v));
    o += `<div class="ovl"><div class="zone ctr" style="gap:26px;padding:34px 50px;width:1300px"><h2>توکن چالش شب ${fa(C.night)}</h2><div style="font-size:34px;font-weight:800">${name} – ${fa(pts)} ${sv('fame')}</div><div class="bars">${C.vals.slice().sort((a, b) => (RU.challenges[C.k] && RU.challenges[C.k].dir === 'min' ? a.v - b.v : b.v - a.v)).map(v => `<div class="bar"><span class="nm">${NM(v.id)}</span><span class="tr"><b style="width:${v.v / mx * 100}%;background:${H(v.id)}"></b></span><span class="v">${fa(v.v)}</span></div>`).join('')}</div><div class="banner" style="background:rgba(243,207,114,.14);border-color:#f3cf72;color:#ffe7a6">${C.winners.length ? C.winners.map(NM).join(' و ') + ' ← ' + fa(C.pts) + ' ' + sv('fame') + (C.winners.length > 1 ? ' (تقسیم و گرد به پایین)' : '') : 'کسی امتیاز نگرفت'}</div></div></div>`;
  }
  if (G.lastBreach && G.lastBreach.n > seen.breach) { seen.breach = G.lastBreach.n; timers.breachAt = Date.now(); }
  return o;
}
