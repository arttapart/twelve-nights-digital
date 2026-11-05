/* 12 Nights digital: phone (390 px wide design, portrait). Private hand, resources and every choice of one player. */
'use strict';
const root = document.getElementById('stage');
function fitPhone() { const s = innerWidth / 390; root.style.transform = `scale(${s})`; root.style.height = (innerHeight / s) + 'px'; }
addEventListener('resize', fitPhone); fitPhone();

let S = null, up = false, tab = 'hand', sub = 0, view = null, sel = [], prepRm = null, errSeen = 0, errMsg = null;
const ix = { hand: 0, mywiz: 0, acad: 0, hall: 0, prep: 0, bhand: 0, pr: 0 };
const api = connect('phone', (m, u) => {
  if (m === null) { up = u; render(); return; }
  if (m.t !== 'state') return;
  const prevTurn = S && S.G && S.G.turn ? S.G.turn.pid + ':' + S.G.turn.startedAt : null;
  S = m;
  const G = S.G;
  const nowTurn = G && G.turn ? G.turn.pid + ':' + G.turn.startedAt : null;
  if (nowTurn !== prevTurn) { view = null; if (G && G.turn && G.turn.pid === G.me) { tab = 'hand'; ix.hand = 0; } }
  if (S.err && S.err.n > errSeen) { errSeen = S.err.n; errMsg = S.err.t; setTimeout(() => { errMsg = null; render(); }, 3500); }
  if (!G || !G.battle) prepRm = null;
  render();
});
const act = a => api.send({ t: 'act', a });
const me = () => S.G.players[S.G.me];
const myTurn = () => { const G = S.G; return G && G.phase === 'turn' && G.turn && G.turn.pid === G.me; };
const P = x => `<div class="P" data-s="a">${x}</div>`;

function render() {
  if (!up || !S) { root.innerHTML = P(`<div class="ph"><b style="font-size:26px;color:#f3cf72">۱۲ شب</b></div><div class="ctr" style="flex:1"><div class="pmsg gold">در حال وصل شدن به مانیتور…</div><div class="lbl" style="text-align:center;margin-top:14px">گوشی باید به همان شبکهٔ کامپیوتر مانیتور وصل باشد</div></div>`); return; }
  const G = S.G;
  let h;
  if (!G) h = lobby();
  else if (G.me == null) h = `<div class="ph"><b style="font-size:26px;color:#f3cf72">۱۲ شب</b></div><div class="ctr" style="flex:1"><div class="pmsg gold">بازی شروع شده و این گوشی بازیکن آن نیست.</div></div>`;
  else h = game();
  const mine = G && G.me != null ? G.prompts.find(q => q.to === G.me && q.opts) : null;
  const sk = !G ? 'lobby' : [G.phase, G.battle ? 'b' + (G.battle.phase || '') : '', G.fight && G.fight.pid === G.me ? 'f' : '', mine ? 'q' + mine.id : '', view || '', myTurn() && S.ui && S.ui.dun ? 'd' : '', tab].join('|');
  rollShow();
  morph(root, P(h + (errMsg ? `<div class="perr">${esc(errMsg)}</div>` : '')), sk);
  bind();
}

// ---------- lobby ----------
const HOUSES = DATA.rules.houses;
const HPW = DATA.rules.housePowers || {};
// house power (chosen per house in the editor) and the client-side copy of its discounts
const hpBox = k => HPW[k] ? `<div class="pbox" style="padding:8px 12px"><h5>قدرت خاندان: ${esc(HPW[k].name)}</h5><div style="font-size:13px;line-height:1.7">${esc(HPW[k].txt)}</div></div>` : '';
function hpCost(c, p, T) {
  const cost = Object.assign({}, c.cost);
  if (c.ty === 'spell' && p.hp === 'hp_shadow' && !T.flags.hpShadow && (cost.pow || 0) > 1) { cost.pow--; return cost; }
  if (p.hp === 'hp_lib' && !T.flags.hpLib && (cost.coin || 0) > 0) { cost.coin--; if (!cost.coin) delete cost.coin; return cost; }
  return c.cost;
}
let pickHouse = null, typedName = null;
function lobby() {
  const L = S.lobby, mine = L.players[S.you];
  if (S.inGame && !mine) return `<div class="ph"><b style="font-size:26px;color:#f3cf72">۱۲ شب</b></div><div class="pmsg gold">بازی شروع شده است.</div>`;
  const used = L.players.filter((p, i) => i !== S.you).map(p => p.house);
  const hs = pickHouse || (mine && mine.house) || HOUSES.find(h => !used.includes(h.id)).id;
  const name = typedName != null ? typedName : (mine ? mine.name : (localStorage.getItem('12shab_name') || ''));
  const c = HOUSES.find(h => h.id === hs).color;
  let o = `<div class="ph"><div class="hs" style="background:${c}">${esc((name || '؟')[0])}</div><b>${mine ? esc(mine.name) : 'بازیکن تازه'}</b>${S.host ? '<span class="tag" style="margin-inline-start:auto">میزبان</span>' : ''}</div>
<div><div class="lbl">نام تو</div><input id="nm" class="inp" maxlength="14" value="${esc(name)}" placeholder="نامت را بنویس"></div>
<div><div class="lbl">رنگ خاندان</div><div class="cols" style="padding:6px 0 14px">${HOUSES.map(h => `<i data-house="${h.id}" style="background:${h.color}" class="${h.id === hs ? 'sel' : used.includes(h.id) ? 'tk' : ''}"></i>`).join('')}</div>${hpBox(HOUSES.find(h => h.id === hs).power)}</div>
<div class="btn ${mine ? 'ghost' : ''}" data-do="join">${mine ? 'ذخیرهٔ نام و رنگ' : 'ورود به بازی'}</div>`;
  if (mine) {
    o += `<div class="pmsg gold">${fa(L.players.length)} بازیکن وصل شده‌اند${L.players.length < 2 ? ' – دست‌کم ۲ نفر لازم است' : ''}</div>`;
    if (S.host) {
      o += `<div class="pbox"><h5>تنظیمات (فقط میزبان)</h5><div class="tg" data-do="bf">اثرهای میدان نبرد<span class="sw2 ${L.bf ? '' : 'offs'}"></span></div></div><div style="flex:1"></div>
${L.hasSave ? '<div class="btn ghost" data-do="resume">ادامهٔ بازی ذخیره‌شده</div>' : ''}<div class="btn ${L.players.length < 2 ? 'off' : ''}" data-do="start">شروع بازی تازه</div>`;
    } else o += `<div style="flex:1"></div><div class="pmsg">منتظر «شروع بازی» از گوشی میزبان…</div><div class="btn ghost" data-do="leave">خروج از لابی</div>`;
  }
  return o;
}

// ---------- in game ----------
function header() {
  const G = S.G, p = me(), T = G.turn, mt = myTurn();
  const fabs = mt ? `<div class="phfab"><div class="fab dice ${T.dieUsed ? 'used' : ''}" ${T.dieUsed ? '' : 'data-do="dice"'} title="تاس">${sv('die')}</div><div class="fab ${S.ui && S.ui.dun ? 'dunon' : ''}" data-do="dun" title="مد سیاه‌چال">${sv('dun')}</div></div>` : '';
  return `<div class="ph"><div class="hs" style="background:${p.color}">${esc(p.name[0])}</div><b>${esc(p.name)}</b>${fabs}<div class="fs">${sv('fame')} ${fa(p.fame)}</div></div>`;
}
function presH(p, perm) { return `<div class="pres${perm ? ' pres5' : ''}">${['coin', 'scroll', 'ess'].map(r => `<div>${sv(RI[r])} ${fa(p.store[r])}<small>/${fa(p.ups[{ coin: 'capCoin', scroll: 'capScroll', ess: 'capEss' }[r]] ? 4 : 2)}</small></div>`).join('')}${perm ? `<div>${sv('torch')} ${fa(p.torch)}</div>${p.pick ? `<div>${sv('pick')} ${fa(p.pick)}</div>` : ''}` : ''}</div>`; }
// resources gained from cards this turn (temporary): only the ones above 0, slowly blinking; perm = also torch/pickaxe
function poolH(perm = true) { const T = S.G.turn, p = me(), q = T.pool; const it = [];
  if (q.coin) it.push(`<span class="tmp">${sv('coin')} ${fa(q.coin)}</span>`); if (q.scroll) it.push(`<span class="tmp">${sv('scr')} ${fa(q.scroll)}</span>`); if (q.ess) it.push(`<span class="tmp">${sv('ess')} ${fa(q.ess)}</span>`);
  if (q.power) it.push(`<span class="tmp">${sv('pow')} ${fa(q.power)}</span>`); if (T.run > 0 || q.step) it.push(`<span class="tmp">${sv('step')} ${T.run > 0 ? 'دویدن' : fa(q.step)}</span>`);
  if (perm) { it.push(`<span>${sv('torch')} ${fa(p.torch)}</span>`); if (p.pick) it.push(`<span>${sv('pick')} ${fa(p.pick)}</span>`); }
  // the stored row is always shown, fixed, above the temporary row
  return presH(p) + (it.length ? `<div class="pool">${it.join('')}</div>` : ''); }
const NAV = [['hand', 'دست'], ['mywiz', 'جادوگران'], ['acad', 'آکادمی'], ['hall', 'تالار'], ['board', 'تخته']];
const navH = () => `<div class="nav">${NAV.map(([k, t]) => `<div class="tb ${tab === k && !view ? 'on' : ''}" data-tab="${k}">${sv(k)}${t}</div>`).join('')}</div>`;
const dotsH = (n, i) => n > 1 ? `<div class="dots">${Array.from({ length: Math.min(n, 14) }, (_, k) => `<i class="${k === Math.min(i, 13) ? 'on' : ''}"></i>`).join('')}</div>` : '<div class="dots"></div>';
// carousel arrows: only towards the side that still has cards (uses the last clamp() call)
let CL = { n: 0, i: 0 };
const arrsF = () => CL.n > 1 ? `${CL.i > 0 ? '<span class="arr" data-sw="-1" style="right:-4px">›</span>' : ''}${CL.i < CL.n - 1 ? '<span class="arr" data-sw="1" style="left:-4px">‹</span>' : ''}` : '';
const hintH = (t, off) => `<div class="hint ${off ? 'off' : ''}"><span class="ar">↑</span> ${t}</div>`;
const clamp = (k, n) => { if (ix[k] >= n) ix[k] = Math.max(0, n - 1); if (ix[k] < 0) ix[k] = 0; ix[k] = ix[k] || 0; CL = { n, i: ix[k] }; return ix[k]; };

function game() {
  const G = S.G, p = me(), mine = G.prompts.find(q => q.to === G.me && q.opts);
  let body;
  if (G.phase === 'end') body = finalP();
  else if (mine && mine.kind === 'cell') body = startCell(mine);
  else if (mine) body = promptP(mine);
  else if (G.phase === 'start') body = `<div class="ctr" style="flex:1;gap:12px"><div class="pmsg gold">نوبت ${esc(G.players[G.order[G.cur]].name)} است</div><div class="lbl">ترتیب بازی تصادفی است و روی مانیتور دیده می‌شود</div></div>`;
  else if (G.battle) body = battleP();
  else if (G.phase === 'night') body = `<div class="ctr" style="flex:1;gap:14px"><div class="bigr gold" style="font-size:40px">پایان شب ${fa(G.night)}</div><div class="lbl" style="text-align:center;font-size:15px">اهریمن‌ها پیش می‌روند و رویداد شب اجرا می‌شود.<br>مانیتور را ببین.</div>${waitFor()}</div>${navH()}`;
  else if (G.fight && G.fight.pid === G.me) body = fightP();
  else if (view === 'dice' && myTurn()) body = diceP();
  else if (view === 'end' && myTurn()) body = endP();
  else if (myTurn() && S.ui && S.ui.dun) body = dunP();
  else body = tabP();
  return header() + body;
}
// a die rolled by this player: rolling faces slow down for ~1.8 s, then the result stays a moment
let rollSeen = null;
function rollShow() {
  if (!S.G) return; const r = S.G.roll;
  if (rollSeen === null) { rollSeen = r ? r.n : 0; return; }   // do not replay an old roll after a reload
  if (!r) return;
  if (r.n <= rollSeen) return; rollSeen = r.n;
  if (r.pid !== S.G.me) return;
  dieFx(document.body, r, 'ph');
}
function waitFor() { const q = S.G.prompts[0]; return q && q.to !== S.G.me ? `<div class="pmsg">منتظر ${esc(S.G.players[q.to].name)}: ${esc(q.title || '')}</div>` : ''; }

// ---- tabs ----
function tabP() {
  const G = S.G, p = me(), mt = myTurn(), T = G.turn;
  const top = mt ? poolH() : `<div class="pmsg tn">نوبت <b style="color:${T ? G.players[T.pid].color : '#fff'}">${T ? esc(G.players[T.pid].name) : ''}</b> است</div>`;
  let o = '';
  if (tab === 'hand') {
    const h = p.hand; const i = clamp('hand', h.length);
    o += mt ? poolH(false) : top + presH(p);
    if (mt && T.forced != null) o += `<div class="btn red" data-do="d_fight">اهریمن در خانهٔ توست – شروع نبرد</div>`;
    if (h.length) {
      const c = card(h[i].c);
      o += `<div class="zoom" data-car="hand">${acard(h[i].c)}${arrsF()}</div>${dotsH(h.length, i)}`;
      if (mt) {
        const btns = [];
        if (c.ty !== 'wound') btns.push(`<div class="btn" data-play="main" data-u="${h[i].u}">بازی کارت</div>`);
        if (c.strip && c.ty !== 'magic') btns.push(`<div class="btn grn" data-play="strip" data-u="${h[i].u}">نوار سیاه‌چال</div>`);
        o += btns.length ? `<div class="brow">${btns.join('')}</div>` : '';
        o += hintH('برای بازی، کارت را به بالا بکش');
      } else o += hintH('الان نوبت شما نیست', true);
    } else o += `<div class="ctr" style="flex:1;gap:10px"><div class="lbl" style="font-size:16px;text-align:center">${mt ? 'دستت خالی است' : 'کارت‌ها در شروع نوبتت کشیده می‌شوند'}</div><div class="lbl">دک ${fa(p.deckN)} کارت – سوخته ${fa(p.discardN)}</div></div>`;
    if (mt) {
      const extra = [];
      if (Game_hasItem(p, 'phoenix') && !T.phoenix && h.length) extra.push(`<div class="btn ghost" data-do="phoenix" data-u="${h[i].u}">پَر سیمرغ: سوزاندن و کشیدن</div>`);
      extra.push(`<div class="btn ghost" data-do="endv">پایان نوبت</div>`);
      o += `<div class="brow">${extra.join('')}</div>`;
    }
  } else if (tab === 'mywiz') {
    const w = p.wiz, i = clamp('mywiz', w.length), cnt = {};
    for (const id of w) { const g = wiz(id).g; cnt[g] = (cnt[g] || 0) + 1; }
    o += `<div class="pmsg gold" style="font-size:14px">جادوگران من – ${fa(w.length)} کارت – ${Object.entries(cnt).map(([g, n]) => GN[g] + ' ' + fa(n)).join(' – ')}</div><div class="zoom xl" data-car="mywiz">${wcard(w[i])}${arrsF()}</div>${dotsH(w.length, i)}<div class="lbl" style="text-align:center">فقط برای دیدن و برنامه‌ریزی؛ نبرد در پایان شب‌های نبرد</div>`;
  } else if (tab === 'acad') {
    const L = acadItems(), i = clamp('acad', L.length), it = L[i];
    o += mt ? poolH(false) : top;
    if (it) {
      const c = card(it.id), seal = it.src === 'row' && G.acad.seal[it.i];
      o += `<div class="lbl" style="text-align:center">${it.src === 'fixed' ? 'ردیف ثابت – ' + fa(G.acad.fixed[it.id]) + ' کارت مانده' : it.src === 'discard' ? 'سوخته‌های آکادمی' : 'آکادمی – کارت ' + fa(it.i + 1) + ' از ' + fa(G.acad.row.length)}${seal ? ' – مهر ' + esc(G.players[seal.pid].name) : ''}</div><div class="zoom" data-car="acad">${acard(it.id)}${arrsF()}</div>${dotsH(L.length, i)}`;
      if (mt && c.ty !== 'crystal') {
        const bc = hpCost(c, p, T);
        o += `<div class="btn ${canPayC(bc) ? '' : 'off'}" data-do="buy">خرید ${costInline(bc)}${bc !== c.cost ? ' (تخفیف خاندان)' : ''}</div>`;
        if (it.src === 'row' && !T.swap) o += `<div class="btn ghost" data-do="swap">تعویض این کارت – ۱ ${sv('coin')}</div>`;
      }
    }
  } else if (tab === 'hall') {
    const L = G.hall.row.map((w, j) => ({ src: 'row', i: j, w })).concat((G.hall.reserved[G.me] || []).map((w, j) => ({ src: 'res', i: j, w })));
    const i = clamp('hall', L.length), it = L[i];
    o += mt ? poolH(false) : top;
    if (it) {
      const cost = Math.max(1, wiz(it.w.id).d - (it.w.tok || 0) - (Game_hasItem(p, 'dagger') ? 1 : 0) - (p.hp === 'hp_lord' ? 1 : 0));
      o += `<div class="lbl" style="text-align:center">${it.src === 'res' ? 'کنار گذاشته برای تو' : 'تالار – جادوگر ' + fa(it.i + 1) + ' از ' + fa(G.hall.row.length)} – هزینهٔ استخدام = دفاع فعلی</div><div class="zoom" data-car="hall">${wcard(it.w.id, it.w.tok, { dagger: Game_hasItem(p, 'dagger') })}${arrsF()}</div>${dotsH(L.length, i)}`;
      if (mt) o += `<div class="btn ${T.pool.power >= cost ? '' : 'off'}" data-do="hire" data-src="${it.src}" data-i="${it.i}">به خدمت گرفتن – ${sv('pow')} ${fa(cost)}</div>`;
    }
    if (mt) o += `<div class="pbox" style="padding:10px 12px"><h5>گوبلین – هر نوبت ۱ بار${T.flags.gob2 ? ' – ۲ برابر' : ''}</h5><div class="brow"><div class="btn ghost ${T.gob ? 'off' : ''}" data-gob="coin" style="padding:9px">${sv('pow')}۱ ← ${sv('coin')}${T.flags.gob2 ? '۲' : '۱'}</div><div class="btn ghost ${T.gob ? 'off' : ''}" data-gob="scroll" style="padding:9px">${sv('pow')}۱ ← ${sv('scr')}${T.flags.gob2 ? '۲' : '۱'}</div></div></div>`;
    if (mt && p.hp === 'hp_alch') o += `<div class="btn ghost ${T.flags.hpAlch || !canPayC({ coin: 2 }) ? 'off' : ''}" data-do="hpalch">کیمیاگر: ${sv('coin')}۲ ← ${sv('scr')}۱ (هر نوبت ۱ بار)</div>`;
  } else if (tab === 'board') o += boardP();
  return o + navH();
}
function Game_hasItem(p, k) { return p.items.slice(0, p.ups.slot2 ? 2 : 1).includes(k); }
function acadItems() { const G = S.G; let L = G.acad.row.map((id, i) => ({ src: 'row', i, id })).concat(Object.keys(G.acad.fixed).filter(id => G.acad.fixed[id] > 0).map(id => ({ src: 'fixed', i: id, id }))); if (myTurn() && G.turn.buyDiscard) L = L.concat(G.acad.discard.map((id, i) => ({ src: 'discard', i, id }))); return L; }
function canPayC(cost) { const T = S.G.turn, p = me(); for (const r in cost) { const have = r === 'pow' ? T.pool.power : (T.pool[r] || 0) + p.store[r]; if (have < cost[r]) return false; } return true; }
const costInline = cost => Object.entries(cost).map(([k, v]) => k === 'pow' ? fa(v) + sv('pow') : Array.from({ length: v }, () => sv(RI[k])).join('')).join('') || 'رایگان';

function boardP() {
  const G = S.G, p = me(), mt = myTurn();
  let o = `<div class="subt">${['وضعیت تخته', 'ارتقاها', 'رویدادها'].map((t, k) => `<span class="${sub === k ? 'on' : ''}" data-sub="${k}">${t}</span>`).join('')}</div>`;
  if (sub === 0) {
    const act2 = p.items.slice(0, p.ups.slot2 ? 2 : 1);
    o += `<div class="pbox"><h5>ذخیره</h5>${presH(p)}</div>
<div class="pbox"><h5>مشعل و کلنگ – ۳ جا</h5><div class="tslots">${Array.from({ length: 3 }, (_, k) => k < p.torch ? `<i>${sv('torch')}</i>` : k < p.torch + p.pick ? `<i>${sv('pick')}</i>` : '<i class="e"></i>').join('')}</div></div>
<div class="pbox"><h5>چوب‌دستی</h5>سطح ${fa(p.wand)} – تاس ${DIEN[p.wand]}<div class="dfaces">${DIEF[p.wand].map(v => `<b>${fa(v)}</b>`).join('')}</div></div>
<div class="pbox"><h5>وسایل جادویی</h5><div class="octs">${[0, 1].map(k => k === 1 && !p.ups.slot2 ? `<div class="oct lk">${sv('lock')}</div>` : `<div class="oct">${p.items[k] ? `<span>${ITEMN[p.items[k]]}</span>` : ''}</div>`).join('')}</div>${p.items.length ? `<div class="lbl" style="margin-top:6px">${p.items.map(k => `<div>${act2.includes(k) ? '✓' : '·'} <b>${ITEMN[k]}</b>: ${ITEMT[k]}</div>`).join('')}</div>` : ''}${mt && p.items.length > 1 && !G.turn.played.length ? '<div class="btn ghost" data-do="items" style="margin-top:8px">جابه‌جا کردن وسایل</div>' : ''}</div>
<div class="pbox grp3"><div><h5>کارت‌های اقدام</h5><span>دک ${fa(p.deckN)}</span><span>سوخته ${fa(p.discardN)}</span><span>حذف‌شده ${fa(p.removedN)}</span></div><div><h5>جادوگران</h5><span>${fa(p.wiz.length)} کارت</span></div><div><h5>زخم و شکار</h5><span>زخم ${fa(p.wounds)}</span><span>شکار ${fa(p.hunt)}</span><span>صندوقچه ${fa(p.chests)}</span></div></div>${hpBox(p.hp)}`;
  } else if (sub === 1) {
    const T = G.turn, have = r => (mt ? T.pool[r] || 0 : 0) + p.store[r];
    o += `<div class="pmsg gold" style="display:flex;gap:10px;justify-content:center;align-items:center">موجود: ${sv('coin')}${fa(have('coin'))} ${sv('scr')}${fa(have('scroll'))} ${sv('ess')}${fa(have('ess'))}</div><div class="upl">${Object.entries(UPN).map(([k, [n, b, a, c]]) => {
      const done = k === 'wand2' ? p.wand >= 2 : !!p.ups[k], can = mt && !done && Object.entries(c).every(([r, v]) => have(r) >= v);
      return `<div class="up ${done ? 'dn' : can ? '' : 'no'}" ${can ? `data-up="${k}"` : ''}><b>${n}</b><div class="co"><span>${Object.entries(c).map(([r, v]) => fa(v) + sv(RI[r])).join(' ')}</span><span class="go">${done ? 'انجام شد ✓' : can ? 'ارتقا' : mt ? 'منابع کم' : '—'}</span></div><div class="ba">${b} ← <em>${a}</em></div></div>`;
    }).join('')}</div>`;
  } else {
    o += `<div class="pbox logb">${S.G.log.slice(-18).reverse().map(l => `<div>${esc(l.t)}</div>`).join('')}</div>`;
  }
  return o;
}

// ---- dice ----
function diceP() {
  const T = S.G.turn, p = me(), d = T.die, lv = Math.min(4, d ? d.lv : p.wand + (T.flags.dieup ? 1 : 0)), need = Math.max(d ? d.need : 1, T.flags.twice ? 2 : 1);
  let o = poolH(false) + `<div class="dieb"><div class="lbl" style="font-size:15px">تاس ${DIEN[lv]} – سطح ${fa(lv)}${need > 1 ? ' – دو تاس' : ''}${T.flags.x2 ? ' – دو برابر' : ''}</div>`;
  const pend = d && d.acc < d.faces.length;       // rolled, not yet accepted
  if (!d) o += `<div class="dfaces">${DIEF[lv].map(v => `<b>${fa(v)}</b>`).join('')}</div><div class="face">؟</div></div><div class="btn" data-do="roll">انداختن تاس${need > 1 ? ' اول' : ''}</div>`;
  else {
    o += `<div class="face">${d.vals.map((v, i) => `<span class="${i < d.acc ? 'okd' : ''}">${fa(v)}</span>`).join(' + ')}</div>${need > 1 ? `<div class="lbl">${d.vals.map((v, i) => 'تاس ' + fa(i + 1) + ': ' + fa(v) + (i < d.acc ? ' (ثبت شد)' : '')).join(' – ')}</div>` : ''}</div>`;
    if (pend) {
      const free = Game_hasItem(p, 'fate') && !T.freeReroll, hpFree = p.hp === 'hp_luck' && !T.flags.hpLuck;
      if (free) o += `<div class="btn" data-do="reroll">بازانداختن – رایگان (طومار تقدیر)</div>`;
      else if (hpFree) o += `<div class="btn" data-do="reroll">بازانداختن – رایگان (قدرت خاندان)</div>`;
      else if (T.reroll < 1) o += `<div class="btn ${canPayC({ scroll: 1 }) ? '' : 'off'}" data-do="reroll">بازانداختن – ۱ ${sv('scr')}</div>`;
      o += `<div class="btn grn" data-do="dieok">قبول عدد ${fa(d.vals[d.vals.length - 1])}</div>`;
    } else if (!T.dieUsed) o += `<div class="btn" data-do="roll">انداختن تاس دوم</div>`;
  }
  return o + (pend ? '' : `<div class="btn ghost" data-do="back">برگشت</div>`) + navH();
}
// ---- end of turn ----
function endP() {
  const T = S.G.turn, p = me();
  let o = `<div class="pmsg gold">پایان نوبت – کدام منابع بمانند؟</div><div class="pbox">`;
  const warn = [];
  for (const r of ['coin', 'scroll', 'ess']) {
    const cap = p.ups[{ coin: 'capCoin', scroll: 'capScroll', ess: 'capEss' }[r]] ? 4 : 2, tot = p.store[r] + T.pool[r];
    o += `<div class="slotsr">${sv(RI[r])} ${RN[r]} ${fa(tot)} ← ${fa(cap)} جا<span class="sl">${Array.from({ length: Math.max(cap, tot) }, (_, k) => `<i class="${k >= cap ? 'x' : k >= tot ? 'e' : ''}"></i>`).join('')}</span></div>`;
    if (tot > cap) warn.push(fa(tot - cap) + ' ' + RN[r] + ' جا ندارد و از بین می‌رود');
  }
  o += '</div>';
  if (T.pool.power || T.pool.step) warn.push([T.pool.power ? fa(T.pool.power) + ' قدرت' : '', T.pool.step ? fa(T.pool.step) + ' گام' : ''].filter(Boolean).join(' و ') + ' خرج نشده و از بین می‌رود');
  o += warn.map(w => `<div class="pmsg warn">${w}</div>`).join('');
  return o + `<div style="flex:1"></div><div class="brow"><div class="btn ghost" data-do="back">برگشت</div><div class="btn" data-do="end">پایان نوبت</div></div>`;
}

// ---- dungeon ----
function dunP() {
  const G = S.G, T = G.turn, p = me(), dn = G.dun;
  let o = '';
  if (dn.place) {
    const pl = dn.place, rot = pl.rots.length ? pl.rots[pl.ri % pl.rots.length] : 0;
    o += `<div class="pmsg dun">تایل تازه رو شد – بچرخان و تأیید کن</div><div class="tbig">${tileCard(pl.t, rot)}</div>`;
    o += pl.rots.length ? `<div class="tbtns">${pl.rots.length > 1 ? '<div class="btn ghost" data-do="d_rot">↻ چرخاندن</div>' : ''}<div class="btn grn" data-do="d_place">✓ تأیید جاگذاری</div></div><div class="dnhint">پس از تأیید، به خانهٔ ورودی این کاشی می‌روی</div>` : `<div class="pmsg warn">این تایل به این خروجی جور نمی‌شود و زیر دسته می‌رود</div><div class="btn" data-do="d_place">باشه</div>`;
    return o + navH();
  }
  if (dn.portal) {
    const po = dn.portal, it = po.list[po.i];
    o += `<div class="pmsg dun">پرتال – کاشی مقصد را انتخاب کن</div><div class="tbig port pmap">${mapSvg(G, { focus: it.tile.split(',').map(Number), portal: it.cells, hit: true, me: p.id })}${po.list.length > 1 ? `<span class="arr" data-pn="-1" style="right:-4px">›</span><span class="arr" data-pn="1" style="left:-4px">‹</span>` : ''}</div>${dotsH(po.list.length, po.i)}`;
    o += `<div class="tname">${it.t === 0 ? 'دروازهٔ شهر – پورتال را لمس کن' : 'کاشی ' + fa(po.i + 1) + ' از ' + fa(po.list.length) + ' – ' + fa(it.cells.length) + ' پورتال'}</div>`;
    o += `<div class="tbtns">${it.cells.length === 1 ? `<div class="btn grn" data-pg="${it.cells[0]}" style="flex:1">✓ رفتن به این پورتال</div>` : ''}<div class="btn ghost" data-do="d_pcancel">نمی‌روم</div></div>`;
    return o + navH();
  }
  const f = focusTile(S);
  o += `<div class="pmsg dun">مد سیاه‌چال – کارت‌ها با نوار سیاه‌چال بازی می‌شوند</div>${poolH()}`;
  o += `<div class="pmap">${mapSvg(G, { focus: f, moves: G.moves, exits: G.exits, hit: true, me: p.id })}</div>`;
  if (T.run > 0) o += `<div class="btn ghost" data-do="d_runend">پایان دویدن (${fa(T.run)} راهرو مانده)</div>`;
  if (T.forced != null) o += `<div class="btn red" data-do="d_fight">شروع نبرد با اهریمن</div>`;
  const h = p.hand, i = clamp('hand', h.length);
  o += `<div class="dunrow"><div class="pad">${[['u', '▲', -1, 0], ['l', '◀', 0, 1], ['r', '▶', 0, -1], ['d', '▼', 1, 0]].map(([c, t, a, b]) => `<i class="${c}" data-off="${a},${b}">${t}</i>`).join('')}<b data-off="0,0">کاشی من</b></div>`;
  if (h.length) {
    const c = card(h[i].c), md = c.ty === 'magic' ? 'main' : 'strip';
    o += `<div class="minicar" data-car="hand"><div class="zoom dunon sm">${acard(h[i].c)}</div><div class="mcb"><span class="arr2" data-sw="-1">›</span><b>${fa(i + 1)}/${fa(h.length)}</b><span class="arr2" data-sw="1">‹</span></div>${c.ty !== 'wound' && (c.strip || c.ty === 'magic') ? `<div class="btn grn sm" data-play="${md}" data-u="${h[i].u}">${md === 'strip' ? 'نوار سیاه‌چال' : 'بازی'}</div>` : ''}</div>`;
  }
  o += '</div>';
  return o + navH();
}

// ---- demon fight ----
function fightP() {
  const G = S.G, F = G.fight, T = G.turn, p = me();
  const cur = F.pending != null ? F.cards[F.pending] : null, paid = F.cards.filter(c => c.paid);
  let o = `<div class="pmsg" style="background:rgba(240,138,42,.16);border:1.5px solid ${LVC[F.lv]};color:#ffd7b0">نبرد با اهریمن ${LVN[F.lv]} (سطح ${fa(F.lv)})</div><div class="ctr" style="gap:4px"><div class="lbl" style="font-size:15px">قدرت باقی‌مانده</div><div class="bigr" style="display:flex;gap:10px;align-items:center">${sv('pow')} ${fa(T.pool.power)}</div></div>`;
  if (cur) o += `<div class="pbox"><h5>کارت روشده – دفاع ${fa(cur.def)}</h5>${T.pool.power >= cur.def ? 'می‌توانی شکستش بدهی.' : 'قدرت کافی نداری. می‌توانی کارت جادو بازی کنی یا تاس بیندازی.'}</div>`;
  else o += `<div class="pbox"><h5>تا اینجا شکست دادی</h5>${fa(paid.length)} کارت – اگر نبرد را متوقف کنی پاداش‌ها و ${fa(F.lv)} ${sv('hunt')} را می‌گیری</div><div class="pmsg warn" style="font-size:13px">اگر ادامه بدهی و کارت بعدی را نتوانی شکست بدهی: پاداشی نمی‌گیری و ۱ زخم می‌گیری</div>`;
  if (cur) o += `<div class="brow"><div class="btn grn ${T.pool.power >= cur.def ? '' : 'off'}" data-do="f_pay">پرداخت ${fa(cur.def)} ${sv('pow')}</div><div class="btn red" data-do="f_lose">قبول شکست</div></div>${Game_hasItem(p, 'mirror') && !F.mirror ? '<div class="btn ghost" data-do="f_mirror">آینهٔ دگرگونی: کارت دیگر</div>' : ''}${T.flags.luck ? '<div class="btn ghost" data-do="f_luck">بخت دوباره: کارت دیگر</div>' : ''}`;
  else o += `<div class="brow"><div class="btn grn" data-do="f_stop">توقف نبرد</div><div class="btn red" data-do="f_next">ادامه</div></div>`;
  const mag = p.hand.filter(x => card(x.c).ty === 'magic');
  o += mag.length ? `<div class="lbl" style="text-align:center">کارت جادو بازی کن:</div><div class="mrow">${mag.map(x => `<div class="mchip" data-play="main" data-u="${x.u}">${sv('pow')}${fa(card(x.c).power)} ${esc(card(x.c).name)}</div>`).join('')}</div>` : '';
  if (!T.dieUsed) o += `<div class="btn ghost" data-do="dice">تاس چوب‌دستی</div>`;
  return o;
}

// ---- prompts ----
function promptP(q) {
  const pics = q.opts.filter(x => x.card || x.wiz || x.acad || x.tile != null), big = !pics.length && !q.many;
  // the player keeps seeing what they have while answering: stored row + this turn's temporary row
  let o = (S.G.turn && S.G.turn.pid === S.G.me ? poolH(false) : '') + `<div class="pmsg gold">${esc(q.title || '')}</div>${q.text && !big ? `<div class="lbl" style="text-align:center;font-size:15px;color:#ece6ff">${esc(q.text)}</div>` : ''}`;
  const plain = q.opts.filter(x => !(x.card || x.wiz || x.acad || x.tile != null));
  if (q.many) {
    o += `<div class="pgrid">${pics.map(x => `<div class="pg ${sel.includes(x.v) ? 'on' : ''}" data-sel="${encodeURIComponent(JSON.stringify(x.v))}">${optFace(x)}</div>`).join('')}</div><div class="lbl" style="text-align:center">${fa(sel.length)} از ${fa(q.many)} انتخاب شد</div><div class="btn" data-do="many" data-q="${q.id}">تأیید</div>`;
  } else if (pics.length) {
    const i = clamp('pr', pics.length), x = pics[i];
    o += `<div class="zoom ${x.wiz ? 'xl2' : ''}" data-car="pr">${optFace(x)}${pics.length > 1 ? arrsF() : ''}</div>${dotsH(pics.length, i)}${x.grp ? `<div class="lbl" style="text-align:center">از ${esc(x.grp)}</div>` : ''}<div class="btn" data-ans="${encodeURIComponent(JSON.stringify(x.v))}" data-q="${q.id}">${esc(x.label || 'انتخاب این')}</div>`;
  } else o += q.text ? `<div class="ctr" style="flex:1"><div class="qbig">${esc(q.text)}</div></div>` : '<div style="flex:1"></div>';
  o += plain.map((x, k) => `<div class="btn ${pics.length || k > 0 ? 'ghost' : ''}" data-ans="${encodeURIComponent(JSON.stringify(x.v))}" data-q="${q.id}">${esc(x.label)}</div>`).join('');
  return o + (pics.length && !q.many ? '' : '<div style="height:20px"></div>');
}
function optFace(x) {
  if (x.card) return acard(x.card);
  if (x.acad) return acard(x.acad);
  if (x.wiz) return wcard(x.wiz, x.tok || 0);
  if (x.tile != null) return `<div class="tbig" style="width:100%">${tileCard(x.tile, 0)}</div>`;
  return esc(x.label);
}
function startCell(q) {
  const G = S.G, cells = ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'];
  const pick = sel[0];
  const g = cells.map(c => { const n = '0,0|' + c; if (c === '1,1') return '<i class="c">دروازهٔ<br>شهر</i>'; const p = G.players.find(x => x.pos === n); return p ? `<i style="background:${p.color};border-color:${p.color}"></i>` : `<i class="${pick === n ? 'sel' : ''}" data-cell="${n}" style="${pick === n ? 'background:' + me().color : ''}">${pick === n ? '' : 'پورتال'}</i>`; }).join('');
  return `<div class="pmsg gold">خانهٔ شروع را انتخاب کن</div><div class="pgate">${g}</div><div class="pbox"><h5>دارایی آغازین</h5>۱۰ کارت اقدام – ۶ نوآموز – چوب‌دستی سطح ۱ (تاس سبز) – ۱ ${sv('torch')}</div><div style="flex:1"></div><div class="btn ${pick ? '' : 'off'}" data-ans="${encodeURIComponent(JSON.stringify(pick || ''))}" data-q="${q.id}">تأیید خانهٔ شروع</div>`;
}

// ---- wizard battle ----
function battleP() {
  const G = S.G, B = G.battle, p = me();
  const bfm = B.bf ? `<div class="pmsg" style="background:rgba(160,110,255,.18);border:1.5px solid #c79bff;font-size:14px">${esc(B.bf.name)}: ${esc(B.bf.txt)}</div>` : '';
  if (B.phase === 'prep') {
    if (B.ready[G.me]) return bfm + `<div class="ctr" style="flex:1;gap:12px"><div class="bigr gold" style="font-size:34px">آماده‌ای ✓</div><div class="lbl">منتظر بقیهٔ بازیکنان…</div></div><div class="btn ghost" data-do="b_unready">تغییر حذف‌ها</div>`;
    if (!prepRm) prepRm = [];
    const w = p.wiz, i = clamp('prep', w.length), rm = prepRm.includes(i), keep = w.length - prepRm.length;
    return bfm + `<div class="pmsg gold" style="font-size:14px">${fa(prepRm.length)} حذف – ${fa(keep)} می‌ماند${keep < 6 ? ' – کمتر از ۶ کارت، در راندهای آخر کارت نداری' : ''}</div><div class="zoom ${rm ? 'del' : ''} xl2" data-car="prep">${rm ? '<span class="xb">✕ حذف شده</span>' : ''}${wcard(w[i])}${arrsF()}</div>${dotsH(w.length, i)}<div class="brow"><div class="btn ghost" data-do="b_tog">${rm ? '↩ برگرداندن این کارت' : '✕ حذف این کارت'}</div></div><div class="btn grn" data-do="b_prep">آماده‌ام</div>`;
  }
  if (B.phase === 'done') {
    const r = B.res && B.res.res[G.me];
    return `<div class="ctr" style="flex:1;gap:14px"><div class="bigr gold" style="display:flex;gap:10px;align-items:center">${r && r.total ? '+' + fa(r.total) : '۰'} ${sv('fame')}</div><div style="font-size:17px;font-weight:800;text-align:center;line-height:1.8">${r ? fa(r.tokens) + ' راند بردی' + (r.bonus ? '<br>جایزهٔ بیشترین توکن: ' + fa(r.bonus) + '+' : '') : ''}</div></div>${B.ack[G.me] ? '<div class="pmsg">منتظر بقیه…</div>' : '<div class="btn" data-do="b_next">باشه</div>'}<div style="height:30px"></div>`;
  }
  if (B.phase === 'pick') {
    if ('myPick' in B) return bfm + `<div class="pmsg gold" style="font-size:14px">راند ${fa(B.round)} از ${fa(DATA.wrules.rounds || 6)} – انتخاب کردی</div><div class="zoom xl2">${B.myPick ? wcard(B.myPick) : '<div class="lbl">بدون کارت</div>'}</div><div class="lbl" style="text-align:center">منتظر بقیه: ${G.order.filter(id => !B.picked[id]).map(id => esc(G.players[id].name)).join('، ') || '—'}</div>${B.myPick && !B.r1top ? '<div class="btn ghost" data-do="b_unpick">تغییر انتخاب</div>' : ''}`;
    const h = B.hand;
    if (!h.length) return bfm + `<div class="ctr" style="flex:1"><div class="pmsg warn">کارتی در دست نداری؛ این راند را می‌بازی</div></div><div class="btn" data-do="b_none">باشه</div>`;
    const i = clamp('bhand', h.length);
    return bfm + `<div class="pmsg gold" style="font-size:14px">راند ${fa(B.round)} از ${fa(DATA.wrules.rounds || 6)} – دک ${fa(B.deckN[G.me])} کارت</div><div class="zoom xl2" data-car="bhand">${wcard(h[i])}${h.length > 1 ? arrsF() : ''}</div>${dotsH(h.length, i)}${hintH('برای انتخاب پنهان، کارت را به بالا بکش')}<div class="btn" data-do="b_pick">انتخاب این کارت</div>${B.bf && B.bf.id === 'F12' && !B.wild ? '<div class="btn ghost" data-do="b_wild">سوزاندن این کارت و کشیدن کارت تازه (یک بار)</div>' : ''}`;
  }
  return bfm + `<div class="ctr" style="flex:1;gap:10px"><div class="lbl" style="font-size:16px">کارت‌ها رو شد – مانیتور را ببین</div>${waitFor()}</div>`;
}
function finalP() {
  const G = S.G, F = G.final, r = F.rows.find(x => x.id === G.me), rank = F.rows.indexOf(r) + 1;
  return `<div class="ctr" style="gap:4px;padding:14px 0"><div class="bigr">${fa(r.total)}</div><div style="font-weight:800">${F.winners.includes(G.me) ? 'استاد اعظم سحر! 🏆' : 'نفر ' + fa(rank)}</div></div><div class="pbox"><div class="kv">امتیازشمار<b>${fa(r.during)}</b></div><div class="kv">کارت‌های آکادمی<b>${fa(r.cards)}</b></div><div class="kv">زخم<b style="color:#ff8a7a">${r.wounds ? fa(r.wounds) + '-' : '۰'}</b></div><div class="kv">جوهره<b>${fa(r.ess)}</b></div><div class="kv" style="border:0">سکه و طومار (هر ۲ = ۱)<b>${fa(r.cs)}</b></div></div><div style="flex:1"></div>${S.host ? '<div class="btn" data-do="newgame">بازی تازه</div>' : ''}`;
}

// ---------- input ----------
function sendUI(o) { if (myTurn()) api.send(Object.assign({ t: 'ui' }, o)); }
function swipe(k, d) {
  ix[k] = (ix[k] || 0) + d; ANIM.swipe = d;
  render();
  if (k === 'acad' || k === 'hall') sendUI({ tab: k, i: ix[k] });
}
function bind() {
  const R = root;
  R.querySelectorAll('[data-tab]').forEach(e => e.onclick = () => { const o = NAV.findIndex(x => x[0] === tab), nn = NAV.findIndex(x => x[0] === e.dataset.tab); ANIM.dir = nn > o ? -1 : nn < o ? 1 : 0; tab = e.dataset.tab; view = null; render(); sendUI({ tab, i: ix[tab] || 0 }); });
  R.querySelectorAll('[data-sub]').forEach(e => e.onclick = () => { sub = +e.dataset.sub; render(); });
  R.querySelectorAll('[data-sw]').forEach(e => e.onclick = ev => { ev.stopPropagation(); const car = e.closest('[data-car]'); if (car) swipe(car.dataset.car, +e.dataset.sw); });
  R.querySelectorAll('[data-house]').forEach(e => e.onclick = () => { if (e.classList.contains('tk')) return; pickHouse = e.dataset.house; typedName = R.querySelector('#nm').value; render(); });
  const nm = R.querySelector('#nm'); if (nm) nm.oninput = () => { typedName = nm.value; };
  R.querySelectorAll('[data-play]').forEach(e => e.onclick = ev => { ev.stopPropagation(); flyUp(() => act({ t: 'play', u: +e.dataset.u, mode: e.dataset.play })); });
  R.querySelectorAll('[data-gob]').forEach(e => e.onclick = () => act({ t: 'goblin', what: e.dataset.gob }));
  R.querySelectorAll('[data-up]').forEach(e => e.onclick = () => act({ t: 'upgrade', k: e.dataset.up }));
  R.querySelectorAll('[data-ans]').forEach(e => e.onclick = () => { if (e.classList.contains('off')) return; const v = JSON.parse(decodeURIComponent(e.dataset.ans)); sel = []; ix.pr = 0; act({ t: 'answer', id: +e.dataset.q, v }); });
  R.querySelectorAll('[data-sel]').forEach(e => e.onclick = () => { const v = JSON.parse(decodeURIComponent(e.dataset.sel)); const q = S.G.prompts.find(x => x.to === S.G.me && x.opts); if (sel.includes(v)) sel = sel.filter(x => x !== v); else if (sel.length < (q.many || 1)) sel.push(v); render(); });
  R.querySelectorAll('[data-cell]').forEach(e => e.onclick = () => { sel = [e.dataset.cell]; render(); });
  R.querySelectorAll('[data-mv]').forEach(e => e.onclick = () => act({ t: 'd_move', to: e.dataset.mv, tele: !!e.dataset.tele }));
  R.querySelectorAll('[data-ex]').forEach(e => e.onclick = () => act({ t: 'd_reveal', exit: e.dataset.ex }));
  R.querySelectorAll('[data-pg]').forEach(e => e.onclick = () => act({ t: 'd_pgo', n: e.dataset.pg }));
  R.querySelectorAll('[data-pn]').forEach(e => e.onclick = () => act({ t: 'd_pnext', dir: +e.dataset.pn }));
  R.querySelectorAll('[data-off]').forEach(e => e.onclick = () => { const [a, b] = e.dataset.off.split(',').map(Number); const o = (S.ui && S.ui.off) || [0, 0]; sendUI({ off: a === 0 && b === 0 ? [0, 0] : [o[0] + a, o[1] + b] }); });
  R.querySelectorAll('[data-do]').forEach(e => e.onclick = () => { if (e.classList.contains('off') && !['start'].includes(e.dataset.do)) return; doIt(e.dataset.do, e); });
  // swipes on carousels: left/right to browse, up to play
  R.querySelectorAll('[data-car]').forEach(el => {
    if (el._sw) return; el._sw = 1;   // the screen is patched, not rebuilt: bind each carousel once
    let x0, y0;
    const st = (x, y) => { x0 = x; y0 = y; };
    const en = (x, y) => { if (x0 == null) return; const dx = x - x0, dy = y - y0; x0 = null; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) swipe(el.dataset.car, dx > 0 ? 1 : -1); else if (dy < -70 && Math.abs(dy) > Math.abs(dx)) swipeUp(el.dataset.car); };
    el.addEventListener('touchstart', e => st(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    el.addEventListener('touchend', e => en(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
    el.addEventListener('mousedown', e => st(e.clientX, e.clientY)); el.addEventListener('mouseup', e => en(e.clientX, e.clientY));
  });
}
// the played card flies up and fades, then the move is sent (the monitor then shows it arriving)
function flyUp(go) {
  const el = root.querySelector('[data-car="hand"] > .ac');
  if (!ANIM.on || !el || !el.animate || flyUp.busy) { go(); return; }
  flyUp.busy = true;
  const t0 = getComputedStyle(el).transform, b = t0 === 'none' ? '' : t0 + ' ';
  const a = el.animate([{ transform: b + 'translateY(0)', opacity: 1 }, { transform: b + 'translateY(-260px)', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
  let done = false; const fin = () => { if (done) return; done = true; flyUp.busy = false; go(); }; a.onfinish = fin; setTimeout(fin, 600);
}
function swipeUp(k) {
  if (k === 'hand' && myTurn()) { const h = me().hand, i = ix.hand; if (!h[i]) return; const c = card(h[i].c); const dun = S.ui && S.ui.dun; const m = c.ty === 'magic' ? 'main' : dun && c.strip ? 'strip' : 'main', u = h[i].u; flyUp(() => act({ t: 'play', u, mode: m })); }
  if (k === 'bhand') doIt('b_pick');
}
function doIt(k, e) {
  const G = S && S.G;
  switch (k) {
    case 'join': { const n = (R0('#nm').value || '').trim(); try { localStorage.setItem('12shab_name', n); } catch (er) {} const L = S.lobby, mine = L.players[S.you], used = L.players.filter((p, i) => i !== S.you).map(p => p.house); const hs = pickHouse || (mine && mine.house) || HOUSES.find(h => !used.includes(h.id)).id; api.send({ t: 'join', name: n, house: hs }); typedName = null; return; }
    case 'leave': api.send({ t: 'leave' }); return;
    case 'bf': api.send({ t: 'opt', bf: !S.lobby.bf }); return;
    case 'start': api.send({ t: 'start' }); return;
    case 'resume': api.send({ t: 'resume' }); return;
    case 'newgame': api.send({ t: 'newgame', sure: true }); return;
    case 'dice': view = 'dice'; render(); return;
    case 'back': view = null; render(); return;
    case 'endv': view = 'end'; render(); return;
    case 'end': view = null; act({ t: 'end' }); return;
    case 'dun': sendUI({ dun: !(S.ui && S.ui.dun) }); view = null; return;
    case 'roll': act({ t: 'roll' }); return;
    case 'reroll': act({ t: 'reroll' }); return;
    case 'dieok': { const d = S.G.turn.die, last = d && d.acc + 1 >= Math.max(d.need, S.G.turn.flags.twice ? 2 : 1); act({ t: 'dieok' }); if (last) view = null; return; }
    case 'hpalch': act({ t: 'hpalch' }); return;
    case 'buy': { const it = acadItems()[ix.acad]; if (it) act({ t: 'buy', src: it.src, i: it.i }); return; }
    case 'swap': { const it = acadItems()[ix.acad]; if (it) act({ t: 'swap', i: it.i }); return; }
    case 'hire': act({ t: 'hire', src: e.dataset.src, i: +e.dataset.i }); return;
    case 'phoenix': act({ t: 'phoenix', u: +e.dataset.u }); return;
    case 'items': { const it = me().items.slice(); it.push(it.shift()); act({ t: 'items', order: it }); return; }
    case 'many': { const q = G.prompts.find(x => x.to === G.me && x.opts); const v = sel.slice(); sel = []; act({ t: 'answer', id: q.id, v }); return; }
    case 'd_rot': act({ t: 'd_rot', dir: 1 }); return;
    case 'd_place': case 'd_pcancel': case 'd_runend': case 'd_fight': case 'f_pay': case 'f_lose': case 'f_stop': case 'f_next': case 'f_mirror': case 'f_luck': act({ t: k }); return;
    case 'b_tog': { const i = ix.prep; prepRm = prepRm.includes(i) ? prepRm.filter(x => x !== i) : prepRm.concat([i]); render(); return; }
    case 'b_prep': act({ t: 'b_prep', remove: prepRm || [] }); return;
    case 'b_unready': act({ t: 'b_unready' }); return;
    case 'b_pick': act({ t: 'b_pick', i: ix.bhand }); ix.bhand = 0; return;
    case 'b_none': act({ t: 'b_pick', i: null }); return;
    case 'b_unpick': act({ t: 'b_unpick' }); return;
    case 'b_wild': act({ t: 'b_wild', i: ix.bhand }); return;
    case 'b_next': act({ t: 'b_next' }); return;
  }
}
const R0 = s => root.querySelector(s);
