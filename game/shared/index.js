// Loads the whole engine for the host (Node).
const D = require('./data.js');
const Game = require('./engine.js');
const Dun = require('./dungeon.js');
const WB = require('./battle.js');
Game.use(Dun, WB);
module.exports = { D, Game, Dun, WB };
