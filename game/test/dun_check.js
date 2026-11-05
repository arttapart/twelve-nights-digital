const { D, Game, Dun } = require('../shared/index.js');
const G = Game.newGame({ seed: 5, players: [{ name: 'A' }, { name: 'B' }] });
// answer start cells
while (G.prompts.length) { const q = G.prompts[0]; Game.act(G, q.to, { t: 'answer', id: q.id, v: q.opts[0].v }); }
const g = Dun.graph(G);
console.log('start cor', Object.keys(g.cor).length, JSON.stringify(g.cor['0,0|0,0']));
console.log('open exits', g.open.length, g.open.slice(0, 3));
const p = Game.curP(G); console.log('pos', p.pos, 'phase', G.phase);
G.turn.pool.step = 5;
const ex = Dun.openExits(G, p); console.log('my exits', ex.map(e => e.exit + ' ' + (e.no || 'ok')));
console.log(Game.act(G, p.id, { t: 'd_reveal', exit: ex[0].exit }));
console.log('place', JSON.stringify(G.dun.place));
console.log(Game.act(G, p.id, { t: 'd_place' }), 'prompts', G.prompts.map(q => q.k));
while (G.prompts.length) { const q = G.prompts[0]; Game.act(G, q.to, { t: 'answer', id: q.id, v: q.opts[0].v }); }
console.log('pos after', p.pos, Dun.cellName(G, p.pos), 'loot', JSON.stringify(G.dun.loot), 'demons', JSON.stringify(G.dun.demons), 'fight', !!G.fight, 'pool', JSON.stringify(G.turn.pool));
console.log('moves', JSON.stringify(Dun.moveOptions(G, p)));
