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
function demTok(x, y, c, r, lv) { const art = ART.pieces && lv && ART.pieces['dem' + lv]; if (art) return `<image href="${artU(art)}" x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}"/>`; return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#1a0a0a" stroke-width="2.5"/>${TL.icon('daemon-skull', x, y + .5, r * 1.45, '#1a0a0a')}`; }
// a player's figure; art from the editor (art.pieces['fig_<house>']) replaces the drawn disc; blink = the phone owner's own figure
function figure(x, y, c, me, id, blink, house) {
  const art = ART.pieces && house && ART.pieces['fig_' + house];
  const body = art ? `<image href="${artU(art)}" x="-22" y="-22" width="44" height="44"/>` : `<circle r="17" fill="${c}" stroke="#000" stroke-width="4"/><circle r="17" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>`;
  return `<g class="fig"${id != null ? ` data-fig="${id}"` : ''} style="transform:translate(${x}px,${y}px)"><g class="figin"><g class="${blink ? 'meblink' : ''}">${body}${me ? `<circle r="24" fill="none" stroke="${c}" stroke-width="2" opacity=".8"/>` : ''}</g></g><circle class="figring" r="17" fill="none" stroke="${c}" stroke-width="3"/></g>`;
}
// o: {focus:[R,C], moves:[...], exits:[...], portal:{cells}, place, arrows, me, hit (phone: add tap targets)}
function mapSvg(G, o = {}) {
  const dn = G.dun, k = TS / TL.S;
  let s = '', d = '', hit = '';
  const keys = Object.keys(dn.grid);
  for (const key of keys) { const g = dn.grid[key], [R, C] = key.split(',').map(Number); s += `<g transform="translate(${C * TS},${R * TS}) scale(${k})">${TL.tileR(g.t, g.r, true)}</g>`; }
  // tile being placed
  if (dn.place) {
    const pl = dn.place, [R, C] = pl.pos, r = pl.rots.length ? pl.rots[pl.ri % pl.rots.length] : 0;
    s += `<g transform="translate(${C * TS},${R * TS}) scale(${k})">${TL.tileR(pl.t, r)}</g><rect x="${C * TS}" y="${R * TS}" width="${TS}" height="${TS}" fill="none" stroke="#f3cf72" stroke-width="6"/>`;
  }
  // new-tile slots reachable from the current cell
  for (const e of o.exits || []) {
    const [R, C] = e.pos, x = C * TS, y = R * TS;
    if (!s.includes(`data-slot="${R},${C}"`)) s += `<rect data-slot="${R},${C}" x="${x + 8}" y="${y + 8}" width="${TS - 16}" height="${TS - 16}" rx="14" fill="rgba(243,207,114,.06)" stroke="${e.no ? '#6f6a92' : '#f3cf72'}" stroke-width="3" stroke-dasharray="14 10"/><path d="M${x + TS / 2 - 46} ${y + TS / 2}h92M${x + TS / 2} ${y + TS / 2 - 46}v92" stroke="${e.no ? '#8f8ab5' : '#ffe7a6'}" stroke-width="16" stroke-linecap="round"/>`;
    if (o.hit && !e.no) hit += `<rect class="hit" data-ex="${e.exit}" x="${x}" y="${y}" width="${TS}" height="${TS}" fill="transparent"/>`;
  }
  // loot tokens, centred inside the cell circle (the printed icon is hidden on revealed tiles)
  const cr = TL.RC * k;
  for (const n in dn.loot) {
    const [x, y] = nodeXY(n), L = dn.loot[n], ic = L.chest ? null : L.coin ? 'coin' : L.scroll ? 'scr' : 'ess', two = L.coin === 2 || L.scroll === 2;
    if (L.chest && ART.pieces && ART.pieces.chest) d += `<image href="${artU(ART.pieces.chest)}" x="${x - cr * .8}" y="${y - cr * .8}" width="${cr * 1.6}" height="${cr * 1.6}"/>`;
    else if (L.chest) d += `<g transform="translate(${x - cr * .62},${y - cr * .42})"><rect width="${cr * 1.24}" height="${cr * .84}" rx="${cr * .14}" fill="#7a4b25" stroke="#f3cf72" stroke-width="2.5"/><rect y="${cr * .3}" width="${cr * 1.24}" height="${cr * .14}" fill="#f3cf72"/><rect x="${cr * .52}" y="${cr * .24}" width="${cr * .2}" height="${cr * .28}" rx="2" fill="#2a1608" stroke="#f3cf72" stroke-width="1.5"/></g>`;
    else { const z = two ? cr * .95 : cr * 1.25; d += two ? `<use href="#i-${ic}" x="${x - z + 2}" y="${y - z / 2}" width="${z}" height="${z}"/><use href="#i-${ic}" x="${x - 2}" y="${y - z / 2}" width="${z}" height="${z}"/>` : `<use href="#i-${ic}" x="${x - z / 2}" y="${y - z / 2}" width="${z}" height="${z}"/>`; }
  }
  const ring = (n, c, cls) => { const [x, y] = nodeXY(n); return `<circle class="${cls || ''}" cx="${x}" cy="${y}" r="${TL.RC * k + 5}" fill="none" stroke="${c}" stroke-width="2.5"/>`; };
  for (const m of o.moves || []) { d += ring(m.to, m.no ? '#6f6a92' : m.tele ? '#7fc0ff' : '#7ef0b5', m.no ? '' : 'blk'); if (o.hit && !m.no) { const [x, y] = nodeXY(m.to); hit += `<circle class="hit" data-mv="${m.to}" data-tele="${m.tele ? 1 : ''}" cx="${x}" cy="${y}" r="${TL.RC * k + 12}" fill="transparent"/>`; } }
  if (o.mark) for (const n of o.mark) d += ring(n, '#ff5a45', 'blk') + ring(n, '#ff5a45', 'blk mk2');
  if (o.portal) for (const n of o.portal) { d += ring(n, '#c79bff', 'blk'); if (o.hit) { const [x, y] = nodeXY(n); hit += `<circle class="hit" data-pg="${n}" cx="${x}" cy="${y}" r="${TL.RC * k + 12}" fill="transparent"/>`; } }
  // demons: a token inside the cell circle; it slides to its new cell when it moves
  const dAt = {}, pAt = {};
  for (const p of G.players) if (p.pos) pAt[p.pos] = 1;
  for (const dm of dn.demons) (dAt[dm.node] = dAt[dm.node] || []).push(dm);
  for (const n in dAt) { const [x, y] = nodeXY(n), L = dAt[n], sh = pAt[n]; L.forEach((dm, i) => { const dx = (i - (L.length - 1) / 2) * cr * .9 + (sh ? cr * .55 : 0), dy = sh ? -cr * .5 : 0, r = L.length > 1 || sh ? cr * .48 : cr * .78; d += `<g class="fig" data-fig="d${dm.id}" style="transform:translate(${x + dx}px,${y + dy}px)">${demTok(0, 0, LVC[dm.lv], r, dm.lv)}</g>`; }); }
  if (o.arrows) for (const a of o.arrows) { if (!a.from || !a.to || a.from === a.to) continue; const [x1, y1] = nodeXY(a.from), [x2, y2] = nodeXY(a.to); d += `<line x1="${x1}" y1="${y1}" x2="${x2 + (x1 - x2) * .28}" y2="${y2 + (y1 - y2) * .28}" stroke="#ff5a45" stroke-width="7" marker-end="url(#ah)"/>`; }
  // figures (spread when sharing a cell)
  const at = {};
  for (const p of G.players) if (p.pos) (at[p.pos] = at[p.pos] || []).push(p);
  for (const n in at) { const [x, y] = nodeXY(n), L = at[n]; L.forEach((p, i) => { const dx = (i - (L.length - 1) / 2) * 22; d += figure(x + dx, y + (L.length > 1 ? 10 : 0), p.color, p.id === o.me, p.id, o.blinkMe && p.id === o.me, p.house); }); }
  // view box
  let vb;
  if (o.focus) {
    const e = (o.pad != null ? o.pad : .36) * TS, fx = o.focus[1] * TS - e, fy = o.focus[0] * TS - e, w = TS + 2 * e, cx0 = o.focus[1] * TS, cy0 = o.focus[0] * TS;
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
  if (!sx && par && par.classList.contains('rowc') && el.dataset && el.dataset.k) { const dk = par.querySelector('.deck'); if (dk) { const r0 = dk.getBoundingClientRect(), r1 = el.getBoundingClientRect(), sc = el.offsetWidth ? r1.width / el.offsetWidth : 1, dx = (r0.left - r1.left) / (sc || 1); el.animate([{ opacity: 1, transform: `translateX(${dx}px) rotateY(180deg) scale(.9)` }, { opacity: 1, transform: `translateX(${dx * .5}px) rotateY(90deg) scale(1.05)`, offset: .45 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 850, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' }); return; } }
  if (!sx && el.parentElement && el.parentElement.classList.contains('curc')) { el.animate([{ opacity: 0, transform: 'translateY(-160px) scale(.55) rotate(-6deg)' }, { opacity: 1, transform: 'translateY(8px) scale(1.06)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
  // keep the card's own CSS transform (zoomed carousel cards are scaled) under the slide
  const b0 = sx ? getComputedStyle(el).transform : 'none', bt = b0 && b0 !== 'none' ? b0 + ' ' : '';
  el.animate([{ opacity: 0, transform: sx ? `${bt}translateX(${sx}px) scale(.94)` : 'translateY(10px) scale(.95)' }, { opacity: 1, transform: sx && bt ? b0 : 'none' }], { duration: sx ? 280 : 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function aLeave(el, ctx) {
  if (!ANIM.on || !el.animate || !el.offsetParent || ctx.n > 40) { el.remove(); return; }
  const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) { el.remove(); return; }
  const op = el.offsetParent, opw = op.offsetWidth * op.offsetHeight; if (!el.dataset.k && w * h > opw * 0.4) { el.remove(); return; }
  Object.assign(el.style, { position: 'absolute', left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: w + 'px', height: h + 'px', margin: '0', pointerEvents: 'none', zIndex: 5 });
  el._ghost = true;
  const car = el.parentElement && el.parentElement.closest && el.parentElement.closest('[data-car]');
  const sx = car && ANIM.swipe ? (ANIM.swipe > 0 ? 70 : -70) : 0;
  const inRow = el.parentElement && el.parentElement.classList.contains('rowc');
  const lb = getComputedStyle(el).transform || 'none';
  const a = el.animate(inRow ? [{ opacity: 1, transform: 'none', filter: 'brightness(1)' }, { opacity: 1, transform: 'translateY(-30px) scale(1.08)', filter: 'brightness(1.6)', offset: .35 }, { opacity: 0, transform: 'translateY(-90px) scale(.7)', filter: 'brightness(1)' }] : [{ opacity: 1, transform: sx && lb !== 'none' ? lb : 'none' }, { opacity: 0, transform: sx ? `${lb !== 'none' ? lb + ' ' : ''}translateX(${sx}px) scale(.94)` : 'translateY(-12px) scale(.9)' }], { duration: inRow ? 650 : 260, easing: 'ease-in' });
  a.onfinish = () => el.remove(); setTimeout(() => el.remove(), inRow ? 1000 : 600);
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
    const inRow = el.parentElement && el.parentElement.classList.contains('rowc');
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], inRow ? { duration: 650, delay: 350, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' } : { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  ANIM.swipe = 0; ANIM.dir = 0;
}

// die roll effect: an overlay where the faces spin and slow down, then land on the result (max ~2 s)
function dieFx(host, r, cls) {
  const old = host.querySelector('.dfx'); if (old) old.remove();
  const faces = (DIEF[Math.min(4, r.lv || 1)] || [1, 2, 3, 4, 5, 6]), fin = (r.vals || []).map(fa).join(' + ');
  const el = document.createElement('div'); el.className = 'dfx ' + (cls || '');
  el.innerHTML = `<div class="dfx-b"><svg class="dfx-sv"><use href="#i-die"/></svg><div class="dfx-num">؟</div><div class="dfx-lab">${esc(r.label || '')}</div></div>`;
  host.appendChild(el);
  const num = el.querySelector('.dfx-num'), box = el.querySelector('.dfx-b');
  const steps = [50, 55, 60, 70, 80, 95, 110, 130, 160, 200, 250, 320]; let i = 0;
  const tick = () => {
    if (i < steps.length) { num.textContent = r.vals.map(() => fa(faces[Math.floor(Math.random() * faces.length)])).join(' + '); setTimeout(tick, steps[i++]); }
    else { num.textContent = fin; box.classList.add('land'); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 1300); }
  };
  if (!ANIM.on) { num.textContent = fin; setTimeout(() => el.remove(), 1500); return; }
  tick();
}

// ---------- turn timer countdown (host sends the ms left; each screen counts down on its own clock) ----------
let TEND = null;
function setTimer(G) { TEND = G && G.turn && G.turn.left != null && G.cfg && G.cfg.timer ? Date.now() + G.turn.left : null; }
const tmrTxt = () => { const s = Math.max(0, Math.ceil((TEND - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function tmrH() { return TEND ? `<span class="tmr ${TEND - Date.now() <= 10000 ? 'low' : ''}">⏱ <b>${fa(tmrTxt())}</b></span>` : ''; }
let clockLast = 0;
setInterval(() => {
  if (!TEND) return; for (const e of document.querySelectorAll('.tmr')) { e.querySelector('b').textContent = fa(tmrTxt()); e.classList.toggle('low', TEND - Date.now() <= 10000); }
  // the monitor ticks softly once a second during the last 15 seconds
  const left = TEND - Date.now(), sec = Math.ceil(left / 1000);
  if (window.CLOCK_SFX && left > 0 && sec <= 15 && sec !== clockLast) { clockLast = sec; if (typeof SFX !== 'undefined') SFX.play('clock'); }
}, 200);

// ---------- sound effects (Farshad 2026-11-06) ----------
// Soft, short sounds made in the browser (no files). Any sound can be replaced in the editor
// (art.sounds[key] = an audio file); the overall volume is rules.soundVol (0-100).
const SFX = (() => {
  let ctx = null, master = null;
  const vol = () => { const v = RU && RU.soundVol != null ? RU.soundVol : 60; return Math.max(0, Math.min(100, v)) / 100; };
  const ac = () => {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const unlock = () => { try { ac(); } catch (e) {} };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
  let nbuf = null;
  const noise = c => { if (nbuf) return nbuf; nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nbuf; };
  // building blocks: a tone and a filtered noise burst, both with soft attack and decay
  function tone(c, t, f, dur, g, type, f2) {
    const o = c.createOscillator(), a = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + .008); a.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(a); a.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function hiss(c, t, dur, g, f, q, f2, type) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), a = c.createGain(); s.buffer = noise(c); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 1;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + Math.min(.02, dur / 4)); a.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(a); a.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  const DEF = {
    tap: (c, t) => { tone(c, t, 1400, .045, .05); hiss(c, t, .03, .03, 4000, 2); },                          // button
    swipe: (c, t) => { hiss(c, t, .12, .11, 3200, .8, 1400); hiss(c, t + .03, .08, .05, 5000, 1.5); },        // soft page/card flick
    play: (c, t) => { hiss(c, t, .32, .12, 500, .7, 2600); },                                                 // card thrown up
    card: (c, t) => { tone(c, t, 170, .14, .14, 'sine', 90); hiss(c, t, .06, .07, 2500, 1); },                // card lands on the monitor
    dice: (c, t) => { for (let i = 0; i < 7; i++) { const d = t + i * .11 + Math.random() * .05; hiss(c, d, .035, .12 * (1 - i / 9), 2600 + Math.random() * 1600, 3); tone(c, d, 300 + Math.random() * 200, .03, .03); } tone(c, t + .85, 140, .14, .1, 'sine', 80); },
    buy: (c, t) => { tone(c, t, 1318, .18, .07, 'triangle'); tone(c, t + .07, 1760, .26, .06, 'triangle'); },
    hire: (c, t) => { [523, 659, 784].forEach((f, i) => tone(c, t + i * .07, f, .45, .06, 'triangle')); },
    gob: (c, t) => { tone(c, t, 240, .12, .08, 'square', 160); tone(c, t + .1, 1318, .16, .05, 'triangle'); },
    upgrade: (c, t) => { [392, 523, 659, 1046].forEach((f, i) => tone(c, t + i * .06, f, .4, .05, 'triangle')); },
    step: (c, t) => { hiss(c, t, .09, .1, 380, .9, 0, 'lowpass'); },
    tile: (c, t) => { tone(c, t, 210, .09, .12, 'sine', 120); hiss(c, t, .05, .06, 900, 1.2); },
    chest: (c, t) => { [880, 1175, 1480, 1760, 2349].forEach((f, i) => tone(c, t + i * .05, f, .3, .045, 'sine')); },
    fight: (c, t) => { tone(c, t, 98, .5, .12, 'sawtooth', 70); hiss(c, t, .4, .05, 300, .7, 0, 'lowpass'); },
    fightWin: (c, t) => { [523, 659, 784, 1046].forEach((f, i) => tone(c, t + i * .08, f, .5, .06, 'triangle')); },
    fightLose: (c, t) => { [392, 330, 262].forEach((f, i) => tone(c, t + i * .12, f, .45, .06, 'triangle')); },
    wound: (c, t) => { tone(c, t, 180, .3, .09, 'sine', 110); hiss(c, t, .15, .05, 700, 1); },
    demon: (c, t) => { tone(c, t, 62, .7, .12, 'sawtooth', 52); hiss(c, t, .6, .06, 220, .6, 0, 'lowpass'); },
    breach: (c, t) => { [110, 165.5, 221, 293].forEach((f, i) => tone(c, t, f, 2.2 - i * .3, .09 - i * .015, 'sine')); },
    nightTick: (c, t) => { tone(c, t, 988, .5, .05, 'triangle'); tone(c, t + .05, 1480, .35, .025, 'sine'); },
    turn: (c, t) => { tone(c, t, 660, .35, .05, 'triangle'); tone(c, t + .12, 990, .45, .045, 'triangle'); },
    round: (c, t) => { tone(c, t, 120, .3, .12, 'sine', 70); hiss(c, t, .12, .05, 1800, .8); },
    fanfare: (c, t) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, t + i * .1, f, .7, .055, 'triangle')); },
    win: (c, t) => { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, t + i * .12, f, .9, .055, 'triangle')); },
    clock: (c, t) => { tone(c, t, 2100, .025, .035, 'square'); hiss(c, t, .02, .03, 5000, 4); },          // gentle tick of the last seconds
    error: (c, t) => { tone(c, t, 230, .16, .06, 'sine', 180); }
  };
  const files = {};
  function play(k) {
    try {
      const v = vol(); if (!v) return;
      const f = ART.sounds && ART.sounds[k];
      if (f) { const a = files[k] || (files[k] = new Audio(artU(f))); const b = a.cloneNode(); b.volume = Math.min(1, v); b.play().catch(() => {}); return; }
      const c = ac(); if (!c || !DEF[k]) return;
      master.gain.value = .55 * v;
      DEF[k](c, c.currentTime + .01);
    } catch (e) {}
  }
  return { play, keys: Object.keys(DEF) };
})();
// sounds the engine recorded (G.sfx): each screen plays only the ones it should, once
let sfxSeen = null;
function sfxRun(G, only) {
  const L = (G && G.sfx) || [];
  if (sfxSeen == null) { sfxSeen = L.length ? L[L.length - 1].n : 0; return; }   // no replay after a reload
  for (const e of L) if (e.n > sfxSeen) { sfxSeen = e.n; if (!only || only.includes(e.k)) SFX.play(e.k); }
}
