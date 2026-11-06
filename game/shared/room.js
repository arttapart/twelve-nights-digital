// 12 Nights digital: the game room (lobby, game state, per-player views, actions).
// Used by the host server (server/server.js) and by the editor's live preview, which runs the whole game in the browser.
// env: { save(obj), load() -> obj|null, discard(), ips() -> [ip], qr() -> {ip:{url,svg}}, version, port }
(function (root) {
'use strict';
function Room(mods, env) {
  const { D, Game, Dun, WB } = mods;
  let lobby = { players: [], host: null, bf: false, timer: 0 };   // timer: seconds per turn, 0 = off   // players: {token, name, house}
  let G = null;
  const lastErr = {};
  let UI = { pid: null, pos: null, dun: false, off: [0, 0], tab: 'hand', i: 0, n: 0 };
  const clients = new Set(), online = {};
  function syncUI() {
    if (!G || !G.turn) { if (G && G.phase !== 'turn') { UI.dun = false; UI.pid = null; } return; }
    const p = G.players[G.turn.pid];
    if (UI.pid !== p.id) UI = { pid: p.id, pos: p.pos, dun: false, off: [0, 0], tab: 'hand', i: 0, n: UI.n + 1 };
    if (UI.pos !== p.pos) { UI.pos = p.pos; UI.off = [0, 0]; }
    if (G.fight || (G.dun && (G.dun.place || G.dun.portal))) UI.dun = true;
  }
  const save = () => { if (G) env.save({ G, lobby, at: Date.now() }); };
  const pidOf = token => { const i = lobby.players.findIndex(p => p.token === token); return i >= 0 ? i : null; };
  function strip(G, pid) {
    const v = JSON.parse(JSON.stringify(G));
    v.acad.deckN = v.acad.deck.length; v.acad.deck = [];
    v.hall.deckN = v.hall.deck.length; v.hall.deck = [];
    v.dun.pileN = v.dun.pile.length; v.dun.pile = []; v.dun.pileTop = G.dun.pile.length ? D.tiles[G.dun.pile[0]].level : null;
    v.demonDeckN = v.demonDeck.length; v.demonDeck = []; v.treasuresN = v.treasures.length; v.treasures = []; v.bfDeck = [];
    delete v.dun._g;
    if (v.turn && v.turn.deadline) v.turn.left = Math.max(0, v.turn.deadline - Date.now());   // clients count down from their own clock
    for (const p of v.players) {
      p.deckN = p.deck.length; p.discardN = p.discard.length; p.handN = p.hand.length; p.removedN = p.removed.length;
      p.wounds = [...G.players[p.id].deck, ...G.players[p.id].hand, ...G.players[p.id].discard, ...G.players[p.id].keep].filter(x => x.c === 'W').length;
      if (p.id !== pid) { p.deck = []; p.hand = []; p.discard = p.discard.slice(-1); p.keep = []; }
      else { p.deckList = p.deck.map(x => x.c).sort(); p.deck = []; }
    }
    v.prompts = G.prompts.map(q => q.to === pid ? q : Object.assign({ id: q.id, to: q.to, k: q.k, title: q.title }, q.k === 'qDemon' ? { data: q.data } : {}));
    v.battle = G.battle ? WB.view(G, pid) : null;
    if (G.turn) { const p = G.players[G.turn.pid]; v.moves = Dun.moveOptions(G, p); v.exits = Dun.openExits(G, p); }
    v.me = pid;
    return v;
  }
  function lobbyView() { return { players: lobby.players.map((p, i) => ({ name: p.name, house: p.house, host: p.token === lobby.host, on: !!online[p.token], i })), bf: lobby.bf, timer: lobby.timer, hasSave: !G && !!env.load(), version: env.version }; }
  function broadcast() {
    syncUI();
    const base = { ips: env.ips(), port: env.port, version: env.version, ui: UI };
    for (const c of clients) {
      if (c.role === 'monitor') c.send(Object.assign({ t: 'state', lobby: lobbyView(), G: G ? strip(G, null) : null, qr: env.qr() }, base));
      else if (c.role === 'phone') { const pid = G ? pidOf(c.token) : null; c.send(Object.assign({ t: 'state', lobby: lobbyView(), G: G && pid != null ? strip(G, pid) : null, you: lobby.players.findIndex(p => p.token === c.token), host: c.token === lobby.host, err: lastErr[c.token] || null, inGame: !!G }, base)); }
    }
  }
  function err(c, t) { lastErr[c.token] = { t, n: Date.now() }; broadcast(); }
  function handle(c, m) {
    if (m.t === 'hello') { c.role = m.role; c.token = m.token; if (c.role === 'phone') online[m.token] = (online[m.token] || 0) + 1; broadcast(); return; }
    const tok = c.token;
    if (m.t === 'join') {
      if (G) { if (lobby.players.some(p => p.token === tok)) { broadcast(); return; } return err(c, 'بازی شروع شده است'); }
      let p = lobby.players.find(x => x.token === tok);
      const used = lobby.players.filter(x => x.token !== tok).map(x => x.house);
      if (used.includes(m.house)) return err(c, 'این خاندان را کس دیگری برداشته');
      if (!p) { if (lobby.players.length >= 5) return err(c, 'بازی حداکثر ۵ نفره است'); p = { token: tok }; lobby.players.push(p); if (!lobby.host) lobby.host = tok; }
      p.name = String(m.name || '').trim().slice(0, 14) || ('بازیکن ' + Game.fa(lobby.players.indexOf(p) + 1)); p.house = m.house;
      broadcast(); return;
    }
    if (m.t === 'leave') { if (G) return; lobby.players = lobby.players.filter(p => p.token !== tok); if (lobby.host === tok) lobby.host = lobby.players[0] ? lobby.players[0].token : null; broadcast(); return; }
    if (m.t === 'opt') { if (tok !== lobby.host || G) return; if ('bf' in m) lobby.bf = !!m.bf; if ('timer' in m) lobby.timer = Math.max(0, Math.min(3600, m.timer | 0)); broadcast(); return; }
    if (m.t === 'start') {
      if (tok !== lobby.host || G) return;
      if (lobby.players.length < 2) return err(c, 'دست‌کم ۲ بازیکن لازم است');
      G = Game.newGame({ players: lobby.players.map(p => ({ name: p.name, house: p.house })), bf: lobby.bf, timer: lobby.timer, seed: m.seed });
      save(); broadcast(); return;
    }
    if (m.t === 'resume') {
      if (tok !== lobby.host || G) return; const s = env.load(); if (!s) return err(c, 'بازی ذخیره‌شده‌ای نیست');
      // seats are matched by order: each phone of the old game must rejoin (the host re-seats by name)
      G = s.G; const old = s.lobby.players; lobby.bf = s.lobby.bf;
      lobby.players = old.map((p, i) => { const now = lobby.players.find(x => x.name === p.name) || lobby.players[i]; return { token: now ? now.token : p.token, name: p.name, house: p.house }; });
      lobby.host = lobby.players[0].token; broadcast(); return;
    }
    if (m.t === 'newgame') { if (tok !== lobby.host) return; if (G && G.phase !== 'end' && !m.sure) return; G = null; env.discard(); broadcast(); return; }
    if (m.t === 'ui') {
      if (!G || !G.turn) return; const pid = pidOf(tok); if (pid !== G.turn.pid) return;
      if ('dun' in m) UI.dun = !!m.dun; if (Array.isArray(m.off)) UI.off = m.off.map(x => Math.max(-9, Math.min(9, x | 0))).slice(0, 2);
      if (typeof m.tab === 'string') UI.tab = m.tab.slice(0, 10); if ('i' in m) UI.i = m.i | 0;
      broadcast(); return;
    }
    if (m.t === 'act') {
      if (!G) return; const pid = pidOf(tok); if (pid == null) return;
      const e = Game.act(G, pid, m.a);
      lastErr[tok] = e ? { t: e, n: Date.now() } : null;
      save(); broadcast(); return;
    }
  }
  // timed things (night checklist pacing, turn timer) advance here, about twice a second
  const ticker = setInterval(() => { try { if (G && Game.tick && Game.tick(G, Date.now())) { save(); broadcast(); } } catch (e) { if (typeof console !== 'undefined') console.error(e); } }, 400);
  return {
    stop() { clearInterval(ticker); },
    // a client is {send(obj)}; role and token are set by its 'hello' message
    join(c) { clients.add(c); },
    message(c, m) { handle(c, m); },
    leave(c) { clients.delete(c); if (c.role === 'phone') { online[c.token]--; if (!online[c.token]) delete online[c.token]; broadcast(); } },
    broadcast, save, get G() { return G; }, set G(v) { G = v; }, get lobby() { return lobby; }
  };
}
if (typeof module !== 'undefined') module.exports = { Room }; else root.Room = Room;
})(typeof window !== 'undefined' ? window : global);
