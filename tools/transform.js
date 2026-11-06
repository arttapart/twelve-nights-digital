// 12 Nights: text, colour and style changes from the editor, applied to the game's source files.
// Used by tools/build.js (Node) and by the editor's live preview (browser), so both give the same result.
(function (root) {
'use strict';
const FA_RE = /[؀-ۿ]/;
// Finds every string literal in JavaScript source. Returns pieces {s, e, q}: the static text between s and e (template
// literals are split at ${...}), q = the quote character.
function literals(src) {
  const out = []; let i = 0, n = src.length, prev = '';
  const isRegexStart = () => /[(,=:\[!&|?{};+\-*%<>~^]|^$/.test(prev) || /\b(return|typeof|case|in|of|void|delete|new)$/.test(src.slice(Math.max(0, i - 7), i).trimEnd());
  function str(q) { const s = ++i; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } out.push({ s, e: i, q }); i++; }
  function tpl() {
    let s = ++i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { out.push({ s, e: i, q: '`' }); i++; return; }
      if (c === '$' && src[i + 1] === '{') { out.push({ s, e: i, q: '`' }); i += 2; code('}'); s = i; continue; }
      i++;
    }
  }
  function code(end) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
      if (c === '\'' || c === '"') { str(c); prev = 'x'; continue; }
      if (c === '`') { tpl(); prev = 'x'; continue; }
      if (c === '/' && isRegexStart()) { i++; let cls = false; while (i < n && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; } i++; while (/[a-z]/.test(src[i] || '')) i++; prev = 'x'; continue; }
      if (end && (c === '{')) depth++;
      if (end && c === '}') { if (!depth) { i++; return; } depth--; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  code(null);
  return out;
}
// text runs (outside HTML tags) inside a literal piece that contain Persian
function runs(text) {
  const res = []; const re = /<[^>]*>/g; let last = 0, m;
  const push = (a, b) => { const t = text.slice(a, b), lead = t.length - t.trimStart().length, tt = t.trim(); if (tt && FA_RE.test(tt)) res.push({ a: a + lead, b: a + lead + tt.length, t: tt }); };
  while ((m = re.exec(text))) { push(last, m.index); last = m.index + m[0].length; }
  push(last, text.length);
  return res;
}
// all Persian texts of one JS file: [{t, n}]
function extract(src) {
  const map = new Map();
  for (const L of literals(src)) for (const r of runs(src.slice(L.s, L.e))) map.set(r.t, (map.get(r.t) || 0) + 1);
  return [...map].map(([t, n]) => ({ t, n }));
}
function escFor(q, t) { t = t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n'); if (q === '`') return t.replace(/`/g, '\\`').replace(/\$\{/g, '\\${'); return t.split(q).join('\\' + q); }
function applyTexts(src, map) {
  if (!map || !Object.keys(map).length) return src;
  const L = literals(src); let out = '', last = 0;
  for (const p of L) {
    const text = src.slice(p.s, p.e); let t2 = '', l2 = 0, ch = false;
    for (const r of runs(text)) { if (map[r.t] != null && map[r.t] !== r.t) { t2 += text.slice(l2, r.a) + escFor(p.q, map[r.t]); l2 = r.b; ch = true; } }
    if (!ch) continue;
    t2 += text.slice(l2);
    out += src.slice(last, p.s) + t2; last = p.e;
  }
  return out + src.slice(last);
}
// HTML files: texts between tags (the page title)
function applyHtmlTexts(src, map) { return src.replace(/>([^<>]*[؀-ۿ][^<>]*)</g, (m, t) => { const k = t.trim(); return map[k] != null ? '>' + t.replace(k, map[k]) + '<' : m; }); }
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
function colors(src) { const m = new Map(); for (const c of src.match(HEX) || []) { const k = norm(c); m.set(k, (m.get(k) || 0) + 1); } return m; }
function norm(c) { c = c.toLowerCase(); return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
function applyColors(src, map) { if (!map || !Object.keys(map).length) return src; return src.replace(HEX, c => { const k = norm(c); return map[k] && map[k] !== k ? map[k] : c; }); }
function apply(src, name, G) {
  if (/data\.js$/.test(name)) return src;
  if (/\.js$/.test(name)) src = applyTexts(src, G.texts);
  if (/\.html$/.test(name)) src = applyHtmlTexts(src, G.texts || {});
  if (/\.(css|js|html)$/.test(name)) src = applyColors(src, G.colors);
  if (/\.html$/.test(name) && !src.includes('custom.css')) src = src.replace('</head>', '<link rel="stylesheet" href="custom.css"></head>');
  return src;
}
// css from the editor's art and style settings; artUrl(path) gives the url of an uploaded file
const BOXBG = [['top', 'body.monitor .M>.top'], ['acad', 'body.monitor .zA'], ['hall', 'body.monitor .zH'], ['goblin', 'body.monitor .zG'], ['mini', 'body.monitor .side .mm'], ['cur', 'body.monitor .side .cur'], ['players', 'body.monitor .pbar .pt'], ['dmap', 'body.monitor .dmap'], ['dside', 'body.monitor .dside .cur']];
function customCss(G, artUrl) {
  const A = G.art || {}, u = artUrl || (p => p), o = [];
  if (A.bg && A.bg.monitor) o.push(`body.monitor #stage>.M{background:url("${u(A.bg.monitor)}") center/cover no-repeat!important}`);
  if (A.bg && A.bg.phone) o.push(`body.phone #stage>.P{background:url("${u(A.bg.phone)}") center/cover no-repeat!important}`);
  if (A.fonts && A.fonts.body) o.push(`@font-face{font-family:"Vazirmatn";src:url("${u(A.fonts.body)}");font-weight:100 900}`);
  if (A.fonts && A.fonts.title) o.push(`@font-face{font-family:"Lalezar";src:url("${u(A.fonts.title)}")}`);
  // per-box backgrounds on the monitor (Farshad 2026-11-06); a box without its own image keeps its see-through panel over the main background
  const X = A.boxbg || {};
  for (const [k, sel] of BOXBG) if (X[k]) o.push(`${sel}{background:url("${u(X[k])}") center/cover no-repeat!important}`);
  // goblin character drawn over the goblin box background (Farshad 2026-11-06)
  if (X.goblinFg) o.push(`body.monitor .zG .gh{background:url("${u(X.goblinFg)}") center/contain no-repeat!important;box-shadow:none!important;border:0!important}`);
  const B = A.backs || {};
  if (B.academy) o.push(`.zA .deck{background:url("${u(B.academy)}") center/cover no-repeat!important;color:transparent!important}`);
  if (B.wizard) o.push(`.zH .deck{background:url("${u(B.wizard)}") center/cover no-repeat!important;color:transparent!important}`);
  if (B.demon) o.push(`.dc.back{background:url("${u(B.demon)}") center/cover no-repeat!important;color:transparent!important}`);
  if (G.css) o.push(G.css);
  return o.join('\n') + '\n';
}
const T = { BOXBG, literals, runs, extract, applyTexts, colors, norm, applyColors, apply, customCss };
if (typeof module !== 'undefined') module.exports = T; else root.TX = T;
})(this);
