// Builds editor/index.html: one self-contained page with the game data, the game's source (for the live preview),
// the text and colour catalogues, the effect lists and the dungeon tile editor.
//   node tools/build_editor.js
'use strict';
const fs = require('fs'), path = require('path');
const T = require('./transform.js');
const ROOT = path.join(__dirname, '..'), GAME = path.join(ROOT, 'game'), ED = path.join(ROOT, 'editor');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DEFAULT = JSON.parse(rd('data/game.json'));
// game sources used by the preview
const SRC = {};
for (const f of fs.readdirSync(path.join(GAME, 'www'))) if (/\.(js|css|html)$/.test(f)) SRC['www/' + f] = rd('game/www/' + f);
for (const f of ['engine.js', 'dungeon.js', 'battle.js', 'wbattle.js', 'room.js']) SRC['shared/' + f] = rd('game/shared/' + f);
SRC['test/bot.js'] = rd('game/test/bot.js');
const FONTS = {};
for (const f of fs.readdirSync(path.join(GAME, 'www', 'fonts'))) FONTS[f] = fs.readFileSync(path.join(GAME, 'www', 'fonts', f)).toString('base64');
// texts the player sees (all Persian string pieces in the game code)
const tx = new Map();
for (const f of Object.keys(SRC).filter(f => /\.js$/.test(f) && f !== 'test/bot.js')) for (const { t } of T.extract(SRC[f])) {
  if (/^[۰-۹\s٫.,:+\-–×/()]*$/.test(t)) continue;
  if (!tx.has(t)) tx.set(t, new Set()); tx.get(t).add(f);
}
for (const f of ['www/monitor.html', 'www/phone.html']) for (const m of SRC[f].matchAll(/>([^<>]*[؀-ۿ][^<>]*)</g)) { const t = m[1].trim(); if (!tx.has(t)) tx.set(t, new Set()); tx.get(t).add(f); }
const TEXTS = [...tx].map(([t, f]) => ({ t, f: [...f] }));
// colours used by the pages
const cm = new Map();
for (const f of Object.keys(SRC).filter(f => /^www\/.*\.(css|js)$/.test(f))) for (const [c, n] of T.colors(SRC[f])) cm.set(c, (cm.get(c) || 0) + n);
const COLORS = [...cm].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c, n }));
// special card effects the engine knows (one per original card)
const FX = [];
const seen = new Set();
for (const c of Object.values(DEFAULT.cards)) if (c.fx && !seen.has(c.fx)) { seen.add(c.fx); FX.push({ k: c.fx, d: c.fx === 'scrollPow' ? 'می‌شود ۱ طومار داد و ۱+ قدرت گرفت' : (c.name + (c.txt ? ': ' + c.txt : '')) }); }
// wizard and battlefield effect codes (docs/WIZARD_EFFECTS.md)
const md = rd('docs/WIZARD_EFFECTS.md');
const WEFF = {}, BFEFF = {};
let part = 0;
for (const line of md.split('\n')) {
  if (/^# اثرهای میدان نبرد/.test(line)) part = 1;
  const m = line.match(/^\| `([a-z_0-9]+)` \|(.*)\|\s*$/); if (!m) continue;
  const cells = m[2].split('|').map(s => s.trim().replace(/`/g, ''));
  if (part === 0) WEFF[m[1]] = { p: cells[0], t: cells[1], ex: cells[2], d: cells[3] };
  else BFEFF[m[1]] = cells[1];
}
for (const b of DEFAULT.battlefield) if (!BFEFF[b.eff[0]]) BFEFF[b.eff[0]] = b.txt;
const ICONS = [['coin', 'سکه'], ['scr', 'طومار'], ['ess', 'جوهرهٔ تاریک'], ['pow', 'قدرت'], ['fame', 'امتیاز شهرت'], ['hunt', 'توکن شکار'], ['step', 'گام'], ['torch', 'مشعل'], ['pick', 'کلنگ'], ['hand', 'دست (زبانه)'], ['acad', 'آکادمی (زبانه)'], ['hall', 'تالار (زبانه)'], ['mywiz', 'جادوگران من (زبانه)'], ['lock', 'قفل'], ['board', 'تخته (زبانه)'], ['die', 'تاس'], ['dun', 'سیاه‌چال'], ['gob', 'گوبلین']];
// fonts
const ff = (fam, f, w) => `@font-face{font-family:${fam};src:url(data:font/woff2;base64,${FONTS[f]}) format('woff2');font-weight:${w}}`;
const edFont = ff('V', 'Vazirmatn-FD-Regular.woff2', 400) + ff('V', 'Vazirmatn-FD-Bold.woff2', 700) + ff('V', 'Vazirmatn-FD-Black.woff2', 900);
// tile editor (embedded copy)
let te = rd('editor/tile_editor_src.html');
te = te.replace('/*__FONTFACE__*/', edFont).replace('__TILES__', JSON.stringify(DEFAULT.tiles)).replace('__NOTES__', JSON.stringify(DEFAULT.tileNotes || [])).replace('__ICONS__', rd('editor/tile_icons.json')).replace('__FONTCSS__', JSON.stringify(edFont));
const J = o => JSON.stringify(o).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let h = rd('editor/template.html');
const inject = `const DEFAULT=${J(DEFAULT)};\nconst SRC=${J(SRC)};\nconst FONTS=${J(FONTS)};\nconst TEXTS=${J(TEXTS)};\nconst COLORS=${J(COLORS)};\nconst FX=${J(FX)};\nconst WEFF=${J(WEFF)};\nconst BFEFF=${J(BFEFF)};\nconst ICONS=${J(ICONS)};\nconst TILE_EDITOR=${J(te)};\n`;
h = h.replace('/*__FONTFACE__*/', () => edFont).replace('/*__INJECT__*/', () => inject).replace('/*__TX__*/', () => rd('tools/transform.js')).replace('/*__JSZIP__*/', () => rd('editor/jszip.min.js').replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(ED, 'index.html'), h);
console.log('editor/index.html', (h.length / 1024 / 1024).toFixed(2), 'MB;', TEXTS.length, 'texts,', COLORS.length, 'colours,', FX.length, 'effects,', Object.keys(WEFF).length, 'wizard codes');
