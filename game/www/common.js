/* 12 Nights digital: shared client code (monitor + phone). Card faces, icons, the dungeon map and the socket. */
'use strict';
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = n => String(n).replace(/\d/g, d => FA[d]).replace('-', '−');
const sv = (k, cls = '') => `<svg class="svi ${cls}"><use href="#i-${k}"/></svg>`;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RI = { coin: 'coin', scroll: 'scr', ess: 'ess', pow: 'pow' };
const RN = { coin: 'سکه', scroll: 'طومار', ess: 'جوهره' };
const TYN = { prod: 'تولید', magic: 'جادو', skill: 'مهارت', spell: 'طلسم', crystal: 'چالش', wound: 'زخم' };
const TYC = { prod: 'tyP', magic: 'tyM', skill: 'tyK', spell: 'tyX', crystal: 'tyF', wound: 'tyW' };
const TYBG = { prod: '#6fd19b', magic: '#c79bff', skill: '#7fc0ff', spell: '#d8d0ff', crystal: '#f3cf72', wound: '#ff8a7a' };
const GN = { S: 'سایه', L: 'نور', B: 'تعادل', N: 'نوآموز' };
const TN = { I: ['⚡', 'آنی'], N: ['⇥', 'کارت بعدی'], E: ['⧗', 'تا پایان نبرد'], '-': ['', ''] };
const LVC = { 1: '#f2d04a', 2: '#f08a2a', 3: '#e23b3b' };
const LVN = { 1: 'زرد', 2: 'نارنجی', 3: 'قرمز' };
const RU = DATA.rules;   // rule tables from data/game.json
const DIEN = RU.die.names;
const DIEF = RU.die.faces;
const ITEMN = Object.fromEntries(Object.entries(RU.items).map(([k, v]) => [k, v.name]));
const ITEMT = Object.fromEntries(Object.entries(RU.items).map(([k, v]) => [k, v.txt]));
const CHN = Object.fromEntries(Object.entries(RU.challenges).map(([k, v]) => [k, [v.name, v.pts]]));
const UPN = Object.fromEntries(Object.entries(RU.upgrades).map(([k, v]) => [k, [v.name, v.before, v.after, v.cost]]));

const card = id => id === 'W' ? Object.assign({ id: 'W', ty: 'wound', cost: {}, power: 0, strip: null }, RU.wound) : DATA.cards[id];
const wiz = id => DATA.wizards[id];
const txtH = t => esc(t || '').replace(/◆/g, sv('pow'));

function costH(c) {
  let o = '';
  for (const k of ['coin', 'scroll', 'ess']) for (let i = 0; i < (c.cost[k] || 0); i++) o += sv(RI[k]);
  if (c.cost.pow) o += `<span style="display:inline-flex;align-items:center;gap:3px">${fa(c.cost.pow)}${sv('pow')}</span>`;
  if (c.fame > 0) o += `<span class="fmv"><svg><use href="#i-fame"/></svg><b>${fa(c.fame)}</b></span>`;
  return `<div class="cost">${o}</div>`;
}
function stripH(s) {
  if (!s) return '<div class="nodun"></div>';
  let o = '';
  for (let i = 0; i < (s.step || 0); i++) o += sv('step');
  if (s.run) o += '<span>دویدن</span>';
  if (s.tele) o += '<span>تله‌پورت</span>';
  if (s.eye) o += '<span>چشم سوم</span>';
  if (s.ft === 't') o += sv('torch'); else if (s.ft === 'a') o += sv('torch') + '/' + sv('pick');
  return `<div class="dun">${o}</div>`;
}
// academy / action card face. o: {cls, n (stack count), seal (house colour)}
function acard(id, o = {}) {
  const c = card(id); if (!c) return '';
  const art = ART.cards && ART.cards[id], md = (ART.mode && ART.mode.cards) || 'full';
  const extra = `${o.seal ? `<span class="seal" style="background:${o.seal}"></span>` : ''}${o.n != null ? `<span class="cl">${fa(o.n)} کارت</span>` : ''}`;
  if (art && md === 'full') return `<div class="ac artfull ${o.cls || ''}" data-k="c-${esc(id)}${o.k || ''}" ${o.attr || ''} style="background-image:url('${artU(art)}')">${extra}</div>`;
  const pw = c.power ? `<div class="adm n${Math.min(6, c.power)}">${'<b></b>'.repeat(Math.min(6, c.power))}</div>${c.txt ? `<div class="ef ef2">${txtH(c.txt)}</div>` : ''}` : `<div class="ef">${txtH(c.txt)}</div>`;
  return `<div class="ac ${c.ty === 'wound' ? 'wound' : ''} ${o.cls || ''}" data-k="c-${esc(id)}${o.k || ''}" ${o.attr || ''}>${art ? `<img class="aill" src="${artU(art)}">` : ''}${costH(c)}<div class="ty ${TYC[c.ty]}">${TYN[c.ty]}${c.ty === 'magic' ? '' : ''}</div><div class="nmc">${esc(c.name)}</div>${pw}${stripH(c.strip)}${c.ty === 'spell' ? '<div class="spn">بلافاصله اجرا می‌شود و از بازی خارج می‌شود</div>' : ''}${o.seal ? `<span class="seal" style="background:${o.seal}"></span>` : ''}${o.n != null ? `<span class="cl">${fa(o.n)} کارت</span>` : ''}</div>`;
}
// wizard card face. tok = -1 defense tokens; o.dagger adds 1 more
function wcard(id, tok = 0, o = {}) {
  const w = wiz(id); if (!w) return '';
  const m = (tok || 0) + (o.dagger ? 1 : 0);
  const art = ART.wizards && ART.wizards[id], md = (ART.mode && ART.mode.wizards) || 'full';
  if (art && md === 'full') return `<div class="wz artfull g${w.g} ${o.cls || ''}" data-k="w-${esc(id)}${o.k || ''}" ${o.attr || ''} style="background-image:url('${artU(art)}')">${tok ? `<div class="mk">${fa(tok)}-</div>` : ''}${m && w.g !== 'N' ? `<div class="def hit">${fa(Math.max(1, w.d - m))}<s>${fa(w.d)}</s></div>` : ''}</div>`;
  const d = Math.max(1, w.d - m);
  const t = TN[w.t] || ['', ''];
  return `<div class="wz g${w.g} ${o.cls || ''}" data-k="w-${esc(id)}${o.k || ''}" ${o.attr || ''}>${tok ? `<div class="mk">${fa(tok)}-</div>` : ''}${w.g !== 'N' ? `<div class="def ${m ? 'hit' : ''}">${fa(d)}${m ? `<s>${fa(w.d)}</s>` : ''}</div>` : ''}<div class="lv">${'<i></i>'.repeat(w.L)}</div><div class="wmid"><div class="pw">${fa(w.p)}</div></div><div class="we">${t[0] ? `<i class="wt">${t[0]} ${t[1]}</i>` : ''}${esc(w.g === 'N' ? 'جادوگر نوآموز' : w.txt)}</div><div class="wid">${esc(w.id)}</div></div>`;
}
function nightsH(G) {
  let o = '';
  for (let n = 1; n <= G.cfg.nights; n++) { const b = G.battleNights.includes(n), c = G.chal[n]; o += `<div class="nt ${n < G.night ? 'past' : ''} ${n === G.night ? 'cur' : ''}">${fa(n)}<small>${b ? '⚔' : ''}${c ? '◎' : ''}</small></div>`; }
  return `<div class="nights">${o}</div>`;
}
const pColor = (G, id) => G.players[id].color;

// ---------- dungeon map ----------
const TS = 250;
const parseN = n => { const [a, b] = n.split('|'); return [a.split(',').map(Number), b.split(',').map(Number)]; };
function nodeXY(n) { const [pos, c] = parseN(n), k = TS / TL.S, q = TL.ctr(c); return [pos[1] * TS + q[0] * k, pos[0] * TS + q[1] * k]; }
const tileOf = n => n.split('|')[0];
function demTok(x, y, c, r) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#1a0a0a" stroke-width="2.5"/>${TL.icon('daemon-skull', x, y + .5, r * 1.45, '#1a0a0a')}`; }
function figure(x, y, c, me, id) { return `<g class="fig"${id != null ? ` data-fig="${id}"` : ''} style="transform:translate(${x}px,${y}px)"><g class="figin"><circle r="17" fill="${c}" stroke="#000" stroke-width="4"/><circle r="17" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>${me ? `<circle r="24" fill="none" stroke="${c}" stroke-width="2" opacity=".8"/>` : ''}</g><circle class="figring" r="17" fill="none" stroke="${c}" stroke-width="3"/></g>`; }
// o: {focus:[R,C], moves:[...], exits:[...], portal:{cells}, place, arrows, me, hit (phone: add tap targets)}
function mapSvg(G, o = {}) {
  const dn = G.dun, k = TS / TL.S;
  let s = '', d = '', hit = '';
  const keys = Object.keys(dn.grid);
  for (const key of keys) { const g = dn.grid[key], [R, C] = key.split(',').map(Number); s += `<g transform="translate(${C * TS},${R * TS}) scale(${k})">${TL.tileR(g.t, g.r)}</g>`; }
  // tile being placed
  if (dn.place) {
    const pl = dn.place, [R, C] = pl.pos, r = pl.rots.length ? pl.rots[pl.ri % pl.rots.length] : 0;
    s += `<g transform="translate(${C * TS},${R * TS}) scale(${k})">${TL.tileR(pl.t, r)}</g><rect x="${C * TS}" y="${R * TS}" width="${TS}" height="${TS}" fill="none" stroke="#f3cf72" stroke-width="6"/>`;
  }
  // new-tile slots reachable from the current cell
  for (const e of o.exits || []) {
    const [R, C] = e.pos, x = C * TS, y = R * TS;
    if (!s.includes(`data-slot="${R},${C}"`)) s += `<rect data-slot="${R},${C}" x="${x + 8}" y="${y + 8}" width="${TS - 16}" height="${TS - 16}" rx="14" fill="rgba(243,207,114,.06)" stroke="${e.no ? '#6f6a92' : '#f3cf72'}" stroke-width="3" stroke-dasharray="14 10"/><text x="${x + TS / 2}" y="${y + TS - 44}" font-size="34" font-weight="900" text-anchor="middle" fill="${e.no ? '#8f8ab5' : '#ffe7a6'}" font-family="Vazirmatn,sans-serif">تایل جدید</text>`;
    if (o.hit && !e.no) hit += `<rect class="hit" data-ex="${e.exit}" x="${x}" y="${y}" width="${TS}" height="${TS}" fill="transparent"/>`;
  }
  // loot tokens
  for (const n in dn.loot) {
    const [x, y] = nodeXY(n), L = dn.loot[n], ic = L.chest ? null : L.coin ? 'coin' : L.scroll ? 'scr' : 'ess';
    if (L.chest) d += `<g transform="translate(${x - 22},${y + 6})"><rect width="44" height="30" rx="6" fill="#7a4b25" stroke="#f3cf72" stroke-width="2.5"/><rect y="11" width="44" height="5" fill="#f3cf72"/></g>`;
    else d += `<use href="#i-${ic}" x="${x - 30}" y="${y + 4}" width="30" height="30"/>${L.coin === 2 || L.scroll === 2 ? `<use href="#i-${ic}" x="${x}" y="${y + 4}" width="30" height="30"/>` : ''}`;
  }
  const ring = (n, c, cls) => { const [x, y] = nodeXY(n); return `<circle class="${cls || ''}" cx="${x}" cy="${y}" r="${TL.RC * k + 5}" fill="none" stroke="${c}" stroke-width="2.5"/>`; };
  for (const m of o.moves || []) { d += ring(m.to, m.no ? '#6f6a92' : m.tele ? '#7fc0ff' : '#7ef0b5', m.no ? '' : 'blk'); if (o.hit && !m.no) { const [x, y] = nodeXY(m.to); hit += `<circle class="hit" data-mv="${m.to}" data-tele="${m.tele ? 1 : ''}" cx="${x}" cy="${y}" r="${TL.RC * k + 12}" fill="transparent"/>`; } }
  if (o.portal) for (const n of o.portal) { d += ring(n, '#c79bff', 'blk'); if (o.hit) { const [x, y] = nodeXY(n); hit += `<circle class="hit" data-pg="${n}" cx="${x}" cy="${y}" r="${TL.RC * k + 12}" fill="transparent"/>`; } }
  for (const dm of dn.demons) { const [x, y] = nodeXY(dm.node); d += demTok(x + 24, y - 24, LVC[dm.lv], 17); }
  if (o.arrows) for (const a of o.arrows) { if (!a.from || !a.to || a.from === a.to) continue; const [x1, y1] = nodeXY(a.from), [x2, y2] = nodeXY(a.to); d += `<line x1="${x1}" y1="${y1}" x2="${x2 + (x1 - x2) * .28}" y2="${y2 + (y1 - y2) * .28}" stroke="#ff5a45" stroke-width="7" marker-end="url(#ah)"/>`; }
  // figures (spread when sharing a cell)
  const at = {};
  for (const p of G.players) if (p.pos) (at[p.pos] = at[p.pos] || []).push(p);
  for (const n in at) { const [x, y] = nodeXY(n), L = at[n]; L.forEach((p, i) => { const dx = (i - (L.length - 1) / 2) * 22; d += figure(x + dx, y + (L.length > 1 ? 10 : 0), p.color, p.id === o.me, p.id); }); }
  // view box
  let vb;
  if (o.focus) {
    const e = .36 * TS, fx = o.focus[1] * TS - e, fy = o.focus[0] * TS - e, w = TS + 2 * e, cx0 = o.focus[1] * TS, cy0 = o.focus[0] * TS;
    vb = `${fx} ${fy} ${w} ${w}`;
    const X = fx - 4 * TS, Y = fy - 4 * TS, W = w + 8 * TS;
    d = `<path fill-rule="evenodd" d="M${X} ${Y}h${W}v${W}h${-W}z M${cx0} ${cy0}v${TS}h${TS}v${-TS}z" fill="#0b0c1d" opacity=".45" pointer-events="none"/>` + d + `<rect x="${cx0}" y="${cy0}" width="${TS}" height="${TS}" fill="none" stroke="#f3cf72" stroke-width="3" pointer-events="none"/>`;
  } else {
    let r0 = 1e9, r1 = -1e9, c0 = 1e9, c1 = -1e9;
    const all = keys.map(k2 => k2.split(',').map(Number)); if (dn.place) all.push(dn.place.pos); for (const e of o.exits || []) all.push(e.pos);
    for (const [R, C] of all) { r0 = Math.min(r0, R); r1 = Math.max(r1, R); c0 = Math.min(c0, C); c1 = Math.max(c1, C); }
    const m = 30, w = (c1 - c0 + 1) * TS + 2 * m, h = (r1 - r0 + 1) * TS + 2 * m, sz = Math.max(w, h, o.minSize || 0);
    vb = `${c0 * TS - m - (sz - w) / 2} ${r0 * TS - m - (sz - h) / 2} ${sz} ${sz}`;
  }
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff5a45"/></marker></defs>${s}${d}${hit}</svg>`;
}
// the tile the monitor/phone should centre on
function focusTile(S) {
  const G = S.G; if (!G || !G.dun) return null;
  if (G.dun.place) return G.dun.place.pos;
  if (G.dun.portal) { const po = G.dun.portal, it = po.list[po.i]; return it ? it.tile.split(',').map(Number) : null; }
  const pid = G.turn ? G.turn.pid : null; if (pid == null) return [0, 0];
  const p = G.players[pid]; if (!p.pos) return [0, 0];
  const base = tileOf(p.pos).split(',').map(Number), off = (S.ui && S.ui.off) || [0, 0];
  return [base[0] + off[0], base[1] + off[1]];
}
function tileCard(ti, rot, cells) {
  const S = TL.S; let r = '';
  if (cells) for (const n of cells) { const [, c] = parseN(n); const [x, y] = TL.ctr(c); r += `<circle class="blk" cx="${x}" cy="${y}" r="${TL.RC + 1.6}" fill="none" stroke="#c79bff" stroke-width="1.1"/>`; }
  return `<svg class="tcard" viewBox="0 0 ${S} ${S}">${TL.tileR(ti, rot || 0)}${r}</svg>`;
}

// ---------- icons ----------
// the icon sprite; an icon uploaded in the editor replaces the drawn symbol everywhere it is used
function loadSprite() {
  const put = t => {
    const host = document.getElementById('sprite'); host.innerHTML = t;
    for (const k in (ART.icons || {})) { const sy = host.querySelector('#i-' + k); if (sy) { const vb = (sy.getAttribute('viewBox') || '0 0 24 24').split(/\s+/).map(Number); sy.innerHTML = `<image href="${artU(ART.icons[k])}" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/>`; } }
  };
  if (window.SPRITE) put(window.SPRITE); else fetch('sprite.svg.html').then(r => r.text()).then(put);
}
// ---------- socket ----------
function connect(role, onState) {
  // inside the editor's live preview the game runs in the editor page itself (no network)
  const LR = (() => { try { return window.parent !== window && window.parent.__ROOM__ ? window.parent.__ROOM__() : null; } catch (e) { return null; } })();
  if (LR) {
    const tok = (window.frameElement && window.frameElement.dataset.tok) || role;
    const c = { send: m => { const j = JSON.stringify(m); setTimeout(() => onState(JSON.parse(j)), 0); } };
    const api = { token: tok, up: true, send: m => LR.message(c, JSON.parse(JSON.stringify(m))) };
    LR.join(c); setTimeout(() => { onState(null, true); LR.message(c, { t: 'hello', role, token: tok }); }, 0);
    addEventListener('unload', () => { try { LR.leave(c); } catch (e) {} });
    return api;
  }
  let ws, token = null, tries = 0;
  try { token = localStorage.getItem('12shab_token'); } catch (e) {}
  if (!token) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem('12shab_token', token); } catch (e) {} }
  const api = { token, send: m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }, up: false };
  function open() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { tries = 0; api.up = true; ws.send(JSON.stringify({ t: 'hello', role, token })); onState(null, true); };
    ws.onmessage = e => { try { onState(JSON.parse(e.data)); } catch (er) { console.error(er); } };
    ws.onclose = () => { api.up = false; onState(null, false); setTimeout(open, Math.min(4000, 500 * ++tries)); };
  }
  open();
  return api;
}
// fit a fixed-size design surface (1920x1080 or 390x844) to the window
function fitStage(el, w, h) {
  const f = () => { const s = Math.min(innerWidth / w, innerHeight / h); el.style.transform = `translate(-50%,-50%) scale(${s})`; };
  addEventListener('resize', f); f(); return f;
}

// ---------- animation: patch the screen instead of replacing it, so things that arrive, leave, move or change can be animated ----------
// morph(root, html, screenKey): a new screenKey swaps the whole screen with a transition; otherwise the DOM is patched in place:
// new elements fade/slide in, removed ones fade out where they were, keyed elements (data-k) glide to their new place, changed numbers pop.
const ANIM = { on: !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), swipe: 0, dir: 0 };
const AKEYS = ['data-k', 'data-fig', 'data-car', 'data-tab', 'data-do', 'data-s', 'id', 'data-i', 'data-src', 'data-sw', 'data-gob', 'data-up', 'data-house'];
function akey(n) {
  if (n.nodeType !== 1) return '#' + n.nodeType;
  let k = n.tagName; for (const a of AKEYS) { const v = n.getAttribute(a); if (v != null) k += '|' + a + '=' + v; } return k;
}
const hasCssAnim = el => { try { const s = getComputedStyle(el); return s.animationName && s.animationName !== 'none'; } catch (e) { return false; } };
function aEnter(el, ctx) {
  if (!ANIM.on || ctx.n++ > 40 || !el.animate || hasCssAnim(el)) return;
  const car = el.parentElement && el.parentElement.closest && el.parentElement.closest('[data-car]');
  const sx = car && ANIM.swipe ? (ANIM.swipe > 0 ? -70 : 70) : 0;
  const par = el.parentElement;
  if (!sx && par && par.classList.contains('rowc') && el.dataset && el.dataset.k) { const dk = par.querySelector('.deck'); if (dk) { const r0 = dk.getBoundingClientRect(), r1 = el.getBoundingClientRect(), sc = el.offsetWidth ? r1.width / el.offsetWidth : 1, dx = (r0.left - r1.left) / (sc || 1); el.animate([{ opacity: .4, transform: `translateX(${dx}px) rotateY(90deg)` }, { opacity: 1, transform: `translateX(${dx * .4}px) rotateY(60deg)`, offset: .35 }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.3,.7,.3,1)' }); return; } }
  if (!sx && el.parentElement && el.parentElement.classList.contains('curc')) { el.animate([{ opacity: 0, transform: 'translateY(-160px) scale(.55) rotate(-6deg)' }, { opacity: 1, transform: 'translateY(8px) scale(1.06)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
  el.animate([{ opacity: 0, transform: sx ? `translateX(${sx}px) scale(.94)` : 'translateY(10px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: sx ? 280 : 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function aLeave(el, ctx) {
  if (!ANIM.on || !el.animate || !el.offsetParent || ctx.n > 40) { el.remove(); return; }
  const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) { el.remove(); return; }
  const op = el.offsetParent, opw = op.offsetWidth * op.offsetHeight; if (!el.dataset.k && w * h > opw * 0.4) { el.remove(); return; }
  Object.assign(el.style, { position: 'absolute', left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: w + 'px', height: h + 'px', margin: '0', pointerEvents: 'none', zIndex: 5 });
  el._ghost = true;
  const car = el.parentElement && el.parentElement.closest && el.parentElement.closest('[data-car]');
  const sx = car && ANIM.swipe ? (ANIM.swipe > 0 ? 70 : -70) : 0;
  const a = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: sx ? `translateX(${sx}px) scale(.94)` : 'translateY(-12px) scale(.9)' }], { duration: 260, easing: 'ease-in' });
  a.onfinish = () => el.remove(); setTimeout(() => el.remove(), 600);
}
function aPop(el, ctx) {
  if (!ANIM.on || !el || !el.animate || ctx.p++ > 30 || (el.textContent || '').length > 10) return;
  el.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.3)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 420, easing: 'ease-out' });
}
function syncAttrs(o, n) {
  for (const a of [...o.attributes]) if (!n.hasAttribute(a.name)) o.removeAttribute(a.name);
  for (const a of [...n.attributes]) if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value);
}
function patchKids(oP, nP, ctx) {
  const olds = [...oP.childNodes].filter(x => !x._ghost), news = [...nP.childNodes], keys = olds.map(akey), used = new Array(olds.length).fill(false);
  const out = []; let last = -1;
  for (const nc of news) {
    const k = akey(nc); let j = -1;
    for (let i = last + 1; i < olds.length; i++) if (!used[i] && keys[i] === k) { j = i; break; }
    if (j < 0) for (let i = 0; i <= last && i < olds.length; i++) if (!used[i] && keys[i] === k) { j = i; break; }
    if (j >= 0) {
      used[j] = true; last = Math.max(last, j); const oc = olds[j];
      if (oc.nodeType === 1) { syncAttrs(oc, nc); patchKids(oc, nc, ctx); }
      else if (oc.nodeValue !== nc.nodeValue) { oc.nodeValue = nc.nodeValue; if (oc.nodeType === 3) aPop(oP, ctx); }
      out.push([oc, false]);
    } else out.push([nc, true]);
  }
  olds.forEach((oc, i) => { if (!used[i]) { if (oc.nodeType === 1) aLeave(oc, ctx); else oc.remove(); } });
  let ref = oP.firstChild;
  for (const [node, isNew] of out) {
    while (ref && ref._ghost) ref = ref.nextSibling;
    if (node !== ref) oP.insertBefore(node, ref); else ref = ref.nextSibling;
    if (isNew && node.nodeType === 1) ctx.enter.push(node);
  }
}
// shrink card texts that would overflow their card
function fitCards(root) {
  for (const ac of root.querySelectorAll('.ac')) {
    if (!ac.clientHeight) continue;
    const parts = [...ac.querySelectorAll('.ef, .nmc')];
    for (const e of parts) e.style.fontSize = '';
    let g = 0;
    const over = () => ac.scrollHeight > ac.clientHeight + 1 || parts.some(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2);
    while (over() && g++ < 14) for (const e of parts) { const f = parseFloat(getComputedStyle(e).fontSize); if (f > 8) e.style.fontSize = (f * .92).toFixed(1) + 'px'; }
  }
}
function morph(root, html, screenKey) { morph0(root, html, screenKey); try { fitCards(root); } catch (e) {} }
function morph0(root, html, screenKey) {
  if (!ANIM.on || !root.firstChild || root._sk !== screenKey) {
    const changed = root._sk !== undefined && root._sk !== screenKey; root._sk = screenKey; root.innerHTML = html;
    if (changed && ANIM.on) { const top = root.firstElementChild; if (top) [...top.children].forEach((el, i) => { if (el.classList.contains('nav') || el.classList.contains('ph') || !el.animate || hasCssAnim(el)) return; el.animate([{ opacity: 0, transform: `translate(${ANIM.dir * 40}px, ${ANIM.dir ? 0 : 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(i, 8) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); }); }
    ANIM.swipe = 0; ANIM.dir = 0; return;
  }
  const before = new Map(); for (const el of root.querySelectorAll('[data-k]')) before.set(el, el.getBoundingClientRect());
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const ctx = { n: 0, p: 0, enter: [] };
  patchKids(root, tpl.content, ctx);
  for (const el of ctx.enter) aEnter(el, ctx);
  for (const [el, r0] of before) {
    if (!el.isConnected || el._ghost || !el.animate) continue;
    const r1 = el.getBoundingClientRect(), s = el.offsetWidth ? r1.width / el.offsetWidth : 1, dx = (r0.left - r1.left) / (s || 1), dy = (r0.top - r1.top) / (s || 1);
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  ANIM.swipe = 0; ANIM.dir = 0;
}
