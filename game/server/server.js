// 12 Nights digital: host server (runs on the Windows PC inside the Electron app, or with `node server/server.js`).
// HTTP serves the monitor page (/m) and the phone page (/p); WebSocket carries actions and views; a UDP beacon lets the
// Android app find the host on the local network (laptop hotspot, phone hotspot or router; no internet needed).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), dgram = require('dgram');
const { WebSocketServer } = require('ws');
const QR = require('qrcode');
const { D, Game, Dun, WB } = require('../shared/index.js');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 47130, BEACON = 47131;
const SAVE_DIR = process.env.SAVE_DIR || path.join(os.homedir(), '12shab');
const SAVE = path.join(SAVE_DIR, 'save.json');
const VERSION = require('../package.json').version;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

function lanIPs() {
  const res = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue; if (a.internal) continue; if (/virtualbox|vmware|vethernet|hyper-v|wsl|docker|vbox/i.test(name)) continue;
    if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) continue;
    res.push({ name, ip: a.address, hot: a.address === '192.168.137.1' || /hotspot|local area connection\*/i.test(name) });
  }
  res.sort((a, b) => (b.hot - a.hot) || (a.ip.startsWith('192.168.') ? -1 : 1));
  return res;
}

// ---------- room ----------
const { Room } = require('../shared/room.js');
function loadSave() { try { return JSON.parse(fs.readFileSync(SAVE, 'utf8')); } catch (e) { return null; } }
const room = Room({ D, Game, Dun, WB }, {
  save(o) { try { fs.mkdirSync(SAVE_DIR, { recursive: true }); fs.writeFileSync(SAVE + '.tmp', JSON.stringify(o)); fs.renameSync(SAVE + '.tmp', SAVE); } catch (e) { console.error('save failed', e.message); } },
  load: loadSave,
  discard() { try { fs.renameSync(SAVE, SAVE + '.old'); } catch (e) {} },
  ips: () => lanIPs().map(x => x.ip), qr: () => qrCache, version: VERSION, port: PORT });
const broadcast = room.broadcast, save = room.save;

// ---------- http ----------
let qrCache = {};
async function makeQR() { qrCache = {}; for (const x of lanIPs()) { const url = 'http://' + x.ip + ':' + PORT + '/p'; qrCache[x.ip] = { url, svg: await QR.toString(url, { type: 'svg', margin: 1, color: { dark: '#14112e', light: '#ffffff' } }) }; } }
function serve(req, res) {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/' || u === '/m') u = '/www/monitor.html'; else if (u === '/p') u = '/www/phone.html';
  else if (!u.startsWith('/shared/') && !u.startsWith('/www/')) u = '/www' + u;
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(path.join(ROOT, 'www')) && !f.startsWith(path.join(ROOT, 'shared'))) { res.writeHead(404); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(b); });
}
function start(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(serve);
    srv.on('error', e => { console.error('server error', e.message); if (!srv.listening) reject(e); });
    const wss = new WebSocketServer({ server: srv, path: '/ws' });
    wss.on('connection', ws => {
      const c = { send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } };
      room.join(c);
      ws.on('message', b => { try { room.message(c, JSON.parse(b)); } catch (e) { console.error(e); } });
      ws.on('close', () => room.leave(c));
    });
    srv.listen(port || PORT, '0.0.0.0', async () => {
      await makeQR();
      setInterval(async () => { const before = Object.keys(qrCache).join(); await makeQR(); if (Object.keys(qrCache).join() !== before) broadcast(); }, 5000);
      // UDP beacon for the Android app: "12SHAB <url>"
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sock.bind(() => { sock.setBroadcast(true); setInterval(() => { for (const x of lanIPs()) { const msg = Buffer.from('12SHAB http://' + x.ip + ':' + PORT + '/p'); const parts = x.ip.split('.'); const bc = parts.slice(0, 3).join('.') + '.255'; sock.send(msg, BEACON, bc, () => {}); sock.send(msg, BEACON, '255.255.255.255', () => {}); } }, 1000); });
      console.log('12 Nights host on port', PORT, lanIPs().map(x => x.ip).join(', '));
      resolve(srv);
    });
  });
}
if (require.main === module) start();
module.exports = { start, PORT, __t: { get G() { return room.G; }, broadcast, save } };
