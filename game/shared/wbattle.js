// Battle engine for the 12 Nights wizard battle (rulebook v5 section 11, CHANGELOG 60, wizard table v12).
// Pure state machine: pick() and answer() change state; view(pid) builds what one phone shows.
// Resolution is re-run from scratch on every answer; any missing input becomes a question to its owner.
(function (root) {
  const CARD = root.CARD || (typeof require !== 'undefined' ? require('./data.js').wizards : null);
  // battle rules (rulebook v5 section 11); values come from cards.json "rules" via cards.js
  const RULES = Object.assign({ rounds: 6, mostTokensBonus: 2, tokenPoints: 1, teacherBonus: 1, gemBonus: 1, dieMax: 4,
    tieChain: ['tie_win', 'level', 'die', 'ring', 'score'] }, root.RULES || (typeof require !== 'undefined' ? require('./data.js').wrules : null) || {});

  function Battle(players, opts) {
    opts = opts || {};
    this.offline = !!opts.offline;
    this.round = 1;
    this.phase = 'pick';
    this.P = {};
    this.order = [];
    for (const p of players) {
      this.order.push(p.id);
      this.P[p.id] = {
        id: p.id, name: p.name, color: p.color, teacher: !!p.teacher, cmd: !!p.cmd, cmdUsed: false,
        tokens: 0, pts: 0, played: [], next: null, until: [], burned: 0,
        pick: undefined, noDraw: false, lastPower: null
      };
    }
    this.R = null;          // current round resolution context
    this.history = [];      // finished rounds
    this.final = null;
    this.qseq = 0;
    this.bf = opts.bf || null;  // battlefield effect of this battle: {id, name, txt, eff} (cards.json "battlefield")
    this.bfAns = {};            // answers to the battlefield question, kept for the whole battle
    if (opts.restore) Object.assign(this, opts.restore);
  }

  const GROUP_FA = { S: 'سایه', L: 'نور', B: 'تعادل', N: 'نوآموز' };
  const B = Battle.prototype;

  // anti-cheat: every card can be played once per battle. Novices: each player owns 4×N1, 1×N2, 1×N4.
  // A card returned to hand or deck (B18, L11, L18) may be played again; burned cards (S10, B17) never.
  const NOVICE_COPIES = Object.assign({ N1: 4, N2: 1, N4: 1 }, RULES.noviceCopies || {});
  Battle.copies = id => CARD[id] && CARD[id].g === 'N' ? (NOVICE_COPIES[id] || 1) : 1;
  B.used = function (pid, id, skipOwnPick) {
    const who = CARD[id].g === 'N' ? [pid] : this.order;
    let n = 0;
    for (const i of who) {
      const P = this.P[i]; if (!P) continue;
      n += P.played.filter(x => x.id === id).length + (P.gone || []).filter(x => x === id).length - (P.back || []).filter(x => x === id).length;
      if (this.R) { if ((this.R.final || this.R.cur)[i] === id) n++; }
      else if (P.pick === id && !(skipOwnPick && i === pid)) n++;
    }
    return n;
  };
  B.canPlay = function (pid, id) { return !!CARD[id] && this.used(pid, id, true) < Battle.copies(id); };

  B.ids = function () { return this.order.slice(); };
  B.opp = function (i) { return this.order.filter(j => j !== i); };

  B.setTeacher = function (pid, v) { if (this.P[pid]) this.P[pid].teacher = !!v; };

  // pid shows a card (id) or null (no card in hand: round lost)
  B.pick = function (pid, cardId) {
    if (this.phase !== 'pick') return false;
    if (cardId !== null && !this.canPlay(pid, cardId)) return false;
    this.P[pid].pick = cardId;
    if (this.order.every(i => this.P[i].pick !== undefined)) {
      this.phase = 'resolve';
      this.R = { cur: {}, ans: {}, questions: [], notes: {}, result: null };
      for (const i of this.order) this.R.cur[i] = this.P[i].pick;
      this.resolve();
    }
    return true;
  };

  B.unpick = function (pid) { if (this.phase === 'pick') this.P[pid].pick = undefined; };

  B.answer = function (pid, key, value) {
    if (this.phase !== 'resolve') return false;
    const q = this.R.questions.find(q => q.key === key);
    if (!q || q.to !== pid) return false;
    this.R.ans[key] = value;
    this.resolve();
    return true;
  };

  // Offline mode: effects of opponents' cards that the player enters with one tap
  B.incoming = function (pid, inc) {
    if (this.phase !== 'resolve') return false;
    this.R.inc = Object.assign({}, this.R.inc || {}, inc);
    this.resolve();
    return true;
  };

  function ask(ctx, key, to, kind, extra) {
    if (key in ctx.R.ans) return ctx.R.ans[key];
    ctx.need.push(Object.assign({ key, to, kind }, extra || {}));
    return undefined;
  }

  // battlefield effect code of this battle (or 'none')
  B.bfe = function () { return this.bf && this.bf.eff ? this.bf.eff : ['none']; };
  const BFSRC = b => ({ k: 'bf', name: b.name });

  B.prev = function (i) { const pl = this.P[i].played; return pl.length ? pl[pl.length - 1] : null; };

  // the ability a revealed card actually uses this round (B11 copies the previous instant ability)
  B.effOf = function (i, cid) {
    const c = CARD[cid];
    let eff = c.eff;
    if (eff[0] === 'echo_i') {
      const pv = this.prev(i);
      eff = pv && pv.t === 'I' && pv.eff[0] !== 'echo_i' ? pv.eff : ['none'];
      if (pv && pv.t === 'I' && pv.eff[0] === 'echo_i') eff = pv.effUsed || ['none'];
    }
    return eff;
  };

  B.mutes = function (cur, eff) {
    const ids = this.order, m = {};
    const selfMute = i => !!(this.P[i].next && this.P[i].next.eff[0] === 'next_mute');
    for (const i of ids) m[i] = selfMute(i);
    if (this.offline) {
      for (const i of ids) if (this.R.inc && this.R.inc.mute) m[i] = true;
      return m;
    }
    for (const i of ids) {
      if (!cur[i] || selfMute(i)) continue;
      if (eff[i][0] === 'opp_mute') for (const j of ids) if (j !== i) m[j] = true;
    }
    return m;
  };

  B.resolve = function () {
    const R = this.R, ids = this.order, r = this.round, off = this.offline;
    const ctx = { R, need: [] };
    const cur = Object.assign({}, R.cur);
    const done = () => { R.questions = ctx.need; return ctx.need.length === 0; };

    // stage 1: L16 (opponents' revealed cards go under their deck, they reveal a new one)
    let eff = {}, muted;
    const calcEff = () => { eff = {}; for (const i of ids) eff[i] = cur[i] ? this.effOf(i, cur[i]) : ['none']; muted = this.mutes(cur, eff); };
    calcEff();
    R.redrawBy = null;
    if (!off) {
      for (const i of ids) {
        if (!cur[i] || muted[i] || eff[i][0] !== 'opp_redraw') continue;
        const opps = this.opp(i).filter(j => cur[j]);
        if (!opps.length) continue;
        const use = ask(ctx, 'l16:' + i, i, 'yesno', { card: cur[i], text: 'کارت‌های روشدهٔ حریفان زیر دکشان برود و کارت تازه رو کنند؟' });
        if (use === undefined) continue;
        if (use && R.redrawBy === null) {
          R.redrawBy = i;
          for (const j of opps) {
            const nc = ask(ctx, 'redraw:' + j, j, 'scan', { card: cur[i], text: 'کارت روشده‌ات را زیر دکت بگذار، کارت روی دک را رو کن و نشان بده.', allowNone: 'دکم خالی است' });
            if (nc !== undefined) cur[j] = nc;
          }
        }
      }
      if (!done()) return;
      calcEff();
    } else if (R.inc && R.inc.redraw) {
      cur[ids[0]] = R.inc.redraw; calcEff();
    }
    R.final = cur;

    // stage 2: inputs from the owner of the revealed card, asked only now
    const inp = {};
    for (const i of ids) {
      if (!cur[i] || muted[i]) continue;
      const e = eff[i], c = cur[i];
      if (e[0] === 'per_res') inp[i] = ask(ctx, 'res:' + i, i, 'count', { res: e[1], card: c });
      else if (e[0] === 'die_add') inp[i] = ask(ctx, 'die:' + i, i, 'die', { card: c });
      else if (e[0] === 'sacrifice') inp[i] = ask(ctx, 'sac:' + i, i, 'scan', { card: c, text: 'اگر می‌خواهی کارت دستت را بسوزانی، آن را نشان بده.', allowNone: 'نمی‌سوزانم', optional: true });
      else if (e[0] === 'burn_add') inp[i] = ask(ctx, 'burnadd:' + i, i, 'scanmany', { card: c, text: 'هر کارتی را که از روی دکت می‌سوزانی یکی‌یکی نشان بده.' });
      else if (e[0] === 'return_shuffle' || e[0] === 'return_top') {
        const seen = {}, opts = this.P[i].played.filter(x => e[1].includes(x.g) && !seen[x.id] && (seen[x.id] = 1)).map(x => ({ v: x.id, label: x.id + ' (' + GROUP_FA[x.g] + ')' }));
        if (opts.length) inp[i] = ask(ctx, 'ret:' + i, i, 'choose', { card: c, text: e[0] === 'return_shuffle' ? 'کدام کارت بازی‌شده را به دکت برمی‌گردانی (و بُر می‌زنی)؟' : 'کدام کارت بازی‌شده را روی دکت برمی‌گردانی؟', options: opts.concat([{ v: null, label: 'هیچ کارتی برنمی‌گردانم' }]) });
      }
      else if (e[0] === 'target_opp') {
        if (off) inp[i] = ask(ctx, 'tgt:' + i, i, 'yesno', { card: c, text: 'کارت روی دکت را سوزاندی؟ (حریفی که انتخاب کردی روی گوشی خودش «۲- از S7» را بزند)' });
        else inp[i] = ask(ctx, 'tgt:' + i, i, 'choose', { card: c, text: 'کارت روی دکت را بسوزان. جادوگر کدام حریف ۲- شود؟', options: this.opp(i).filter(j => cur[j]).map(j => ({ v: j, label: this.P[j].name })).concat([{ v: null, label: 'دکم خالی است' }]) });
      }
      if (off) {
        if (e[0] === 'eye') inp[i] = ask(ctx, 'eye:' + i, i, 'yesno', { card: c, text: e[1].length > 1 ? 'حریفی کارت نور یا تعادل رو کرده است؟' : 'حریفی کارت نور رو کرده است؟' });
        if (e[0] === 'copy_high') inp[i] = ask(ctx, 'high:' + i, i, 'number', { card: c, text: 'بیشترین قدرت پایهٔ حریفان در این راند چند است؟', max: 20 });
      }
    }
    // battlefield «lowest on the score track»: asked once per battle, of every player who plays a card
    const bfe = this.bfe();
    if (bfe[0] === 'lowest_add') for (const i of ids) {
      if (!cur[i] || i in this.bfAns) continue;
      const a = ask(ctx, 'bflow:' + i, i, 'yesno', { bf: this.bf.name, text: 'اثر میدان نبرد «' + this.bf.name + '»: کمترین امتیاز روی امتیازشمار مال توست؟ (اگر با کسی مساوی هستی هم «بله»)' });
      if (a !== undefined) this.bfAns[i] = !!a;
    }
    if (!done()) return;

    // stage 3: base power and power
    const base = {}, pow = {}, parts = {};
    const oppBurnNow = {};
    for (const i of ids) oppBurnNow[i] = 0;
    if (!off) for (const i of ids) if (cur[i] && !muted[i] && eff[i][0] === 'opp_burn') for (const j of this.opp(i)) oppBurnNow[j]++;
    if (off && R.inc && R.inc.burn) oppBurnNow[ids[0]] += R.inc.burn;
    for (const i of ids) {
      if (!cur[i]) continue;
      const c = CARD[cur[i]], e = muted[i] ? ['none'] : eff[i], P = this.P[i], pv = this.prev(i);
      let b = c.p; const pt = [];
      if (e[0] === 'round_num') b = 3 + r;
      else if (e[0] === 'sum_b') b = P.played.filter(x => x.g === e[1]).reduce((s, x) => s + CARD[x.id].p, 0);
      else if (e[0] === 'per_res') b = c.p + e[2] * inp[i];
      else if (e[0] === 'mirror') b = pv ? pv.base : 3;
      else if (e[0] === 'die_add') b = c.p + inp[i].die + (inp[i].gem ? RULES.gemBonus : 0);
      else if (e[0] === 'sacrifice') b = c.p + (inp[i] ? CARD[inp[i]].p : 0);
      else if (e[0] === 'burn_add') b = c.p + (inp[i] || []).reduce((s, x) => s + CARD[x].p, 0);
      base[i] = b;
    }
    for (const i of ids) {
      if (!cur[i] || muted[i] || eff[i][0] !== 'copy_high') continue;
      if (off) base[i] = inp[i];
      else base[i] = Math.max(0, ...this.opp(i).filter(j => cur[j] && !(eff[j][0] === 'copy_high' && !muted[j])).map(j => base[j]));
    }
    const minBase = Math.min(...ids.filter(i => cur[i]).map(i => base[i]));
    const eclipsed = {};
    for (const i of ids) eclipsed[i] = off ? !!(R.inc && R.inc.eclipse) : ids.some(j => j !== i && cur[j] && !muted[j] && eff[j][0] === 'eclipse');
    for (const i of ids) {
      if (!cur[i]) continue;
      const c = CARD[cur[i]], e = muted[i] ? ['none'] : eff[i], P = this.P[i], pv = this.prev(i);
      let v = base[i]; const pt = parts[i] = [];
      const add = (x, why, src) => { if (x) { v += x; pt.push([x, why, src || { k: 'self', card: cur[i] }]); } };   // src: where the change comes from (shown above the +/- tag)
      if (e[0] === 'round') add(e[1][String(r)] || 0, 'راند ' + r);
      else if (e[0] === 'eye') {
        const hit = off ? inp[i] : this.opp(i).some(j => cur[j] && e[1].includes(CARD[cur[j]].g));
        if (hit) add(e[2], 'کارت حریف');
      } else if (e[0] === 'prev_shadow') { if (P.played.some(x => x.g === 'S')) add(e[1], 'سایهٔ قبلی'); }
      else if (e[0] === 'chain_prev') { if (pv && pv.g === e[1]) add(e[2], 'کارت قبلی نور'); }
      else if (e[0] === 'scav') add(Math.min(e[2], (P.burned + oppBurnNow[i]) * e[1]), 'کارت‌های سوخته');
      else if (e[0] === 'lowest') {
        const low = off ? undefined : base[i] === minBase;
        if (off) { const a = ask(ctx, 'low:' + i, i, 'yesno', { card: cur[i], text: 'قدرت پایهٔ تو (' + base[i] + ') کمترین قدرت پایهٔ این راند است؟' }); if (a) add(e[1], 'کمترین قدرت پایه'); }
        else if (low) add(e[1], 'کمترین قدرت پایه');
      }
      const nx = P.next;
      if (nx) {
        const mult = e[0] === 'amp' ? 2 : 1, ne = nx.eff;
        let x = 0;
        if (ne[0] === 'next') x = ne[1];
        else if (ne[0] === 'next_g') x = ne[1][c.g] || 0;
        else if (ne[0] === 'next_if_lose' && nx.lost) x = ne[1];
        add(mult * x, 'کارت قبلی ' + nx.id + (mult === 2 && x ? ' ×۲' : ''), { k: 'prev', card: nx.id });
      }
      if (bfe[0] === 'group_add' && c.g === bfe[1]) add(bfe[2], 'میدان نبرد', BFSRC(this.bf));
      if (bfe[0] === 'lowest_add' && this.bfAns[i]) add(bfe[1], 'میدان نبرد', BFSRC(this.bf));
      if (!eclipsed[i] && bfe[0] !== 'no_until') for (const u of P.until) {
        let x = 0;
        if (u.eff[0] === 'until_all') x = u.eff[1];
        else if (u.eff[0] === 'until_g') x = u.eff[1][c.g] || 0;
        add(x, 'تا پایان نبرد ' + u.id, { k: 'until', card: u.id });
      }
      if (c.g === 'N' && P.teacher) add(RULES.teacherBonus, 'نشان آموزگار', { k: 'artifact', name: 'نشان آموزگار' });
      pow[i] = v;
    }
    if (!done()) return;
    // effects on opponents
    for (const i of ids) {
      if (!cur[i] || muted[i]) continue;
      const e = eff[i];
      if (off) continue;
      if (e[0] === 'opp_mod') for (const j of this.opp(i)) if (cur[j] && e[1].includes(CARD[cur[j]].g)) { pow[j] += e[2]; parts[j].push([e[2], cur[i] + ' ' + this.P[i].name, { k: 'opp', who: this.P[i].name, color: this.P[i].color, card: cur[i] }]); }
      if (e[0] === 'target_opp' && inp[i] != null && cur[inp[i]]) { const j = inp[i]; pow[j] += e[1]; parts[j].push([e[1], cur[i] + ' ' + this.P[i].name, { k: 'opp', who: this.P[i].name, color: this.P[i].color, card: cur[i] }]); }
    }
    if (off && R.inc) {
      const i = ids[0];
      if (cur[i]) {
        if (R.inc.s15 && ['L', 'N'].includes(CARD[cur[i]].g)) { pow[i] -= 2; parts[i].push([-2, 'S15 حریف', { k: 'opp', who: 'حریف', card: 'S15' }]); }
        if (R.inc.minus2) { pow[i] -= 2 * R.inc.minus2; parts[i].push([-2 * R.inc.minus2, 'S7 حریف', { k: 'opp', who: 'حریف', card: 'S7' }]); }
      }
    }
    const baseOnly = off ? !!(R.inc && R.inc.baseOnly) || ids.some(i => cur[i] && !muted[i] && eff[i][0] === 'base_only')
      : ids.some(i => cur[i] && !muted[i] && eff[i][0] === 'base_only');
    const score = {};
    for (const i of ids) score[i] = cur[i] ? (baseOnly ? base[i] : pow[i]) : null;
    R.calc = { base, pow, parts, score, muted, baseOnly, eff };

    // stage 4: winner and tie chain (CHANGELOG 60)
    let winner = null, tie = null;
    if (off) {
      const i = ids[0];
      if (!cur[i]) winner = 'lost';
      else {
        const res = ask(ctx, 'offres', i, 'offresult', { text: 'نتیجهٔ این راند؟', score: score[i], level: CARD[cur[i]].L, card: cur[i], base: base[i], parts: parts[i], baseOnly, muted: !!muted[i] });
        if (res === undefined) return done();
        if (res === 'tie') {
          const d = ask(ctx, 'tdie:' + i, i, 'tiedie', {});
          if (d === undefined) return done();
          const res2 = ask(ctx, 'offres2', i, 'choose', { text: 'عدد تاس تو: ' + (d.die + (d.gem ? RULES.gemBonus : 0)) + (d.ring ? ' (انگشتری بخت داری)' : '') + '. اگر باز مساوی بود، کمترین امتیاز روی امتیازشمار برنده است. برنده کیست؟',
            options: [{ v: 'win', label: 'من بردم' }, { v: 'lose', label: 'حریف برد' }, { v: 'none', label: 'هیچ‌کس' }] });
          if (res2 === undefined) return done();
          winner = res2 === 'win' ? i : null;
        } else winner = res === 'win' ? i : null;
        tie = res === 'tie' ? { stage: 'die' } : null;
      }
    } else {
      const live = ids.filter(i => cur[i]);
      // house power «field commander» (12 Nights): once per battle +1 to the own card after the reveal, used when it turns the round into a win
      for (const i of live) { const P = this.P[i]; if (!P.cmd || P.cmdUsed) continue; const om = Math.max(-Infinity, ...live.filter(j => j !== i).map(j => score[j])); if (live.length > 1 && score[i] <= om && score[i] + 1 > om) { score[i]++; pow[i]++; parts[i].push([1, 'فرماندهٔ میدان', { k: 'artifact', name: 'فرماندهٔ میدان' }]); P.cmdUsed = true; } }
      if (live.length) {
        const m = Math.max(...live.map(i => score[i]));
        let W = live.filter(i => score[i] === m);
        if (W.length > 1) {
          // tie chain, in the order of RULES.tieChain (CHANGELOG 60 + B7 + Ring of Fortune)
          tie = { players: W.slice(), stage: null };
          let dv = null;
          for (const step of RULES.tieChain) {
            if (W.length <= 1) break;
            if (step === 'tie_win') {
              const tw = W.filter(i => !muted[i] && eff[i][0] === 'tie_win');
              if (tw.length) { W = tw; if (tw.length === 1) tie.stage = 'B7'; }
            } else if (step === 'level') {
              const lv = Math.max(...W.map(i => CARD[cur[i]].L));
              W = W.filter(i => CARD[cur[i]].L === lv); tie.stage = 'level';
            } else if (step === 'die') {
              tie.stage = 'die'; dv = {};
              for (const i of W) {
                const a = ask(ctx, 'tdie:' + i, i, 'tiedie', { with: W.map(j => this.P[j].name) });
                if (a !== undefined) dv[i] = a;
              }
              if (!done()) return;
              tie.dice = {};
              for (const i of W) tie.dice[i] = dv[i].die + (dv[i].gem ? RULES.gemBonus : 0);
              const md = Math.max(...W.map(i => tie.dice[i]));
              W = W.filter(i => tie.dice[i] === md);
            } else if (step === 'ring') {
              if (!dv) continue;
              const rg = W.filter(i => dv[i].ring);
              if (rg.length === 1) { W = rg; tie.stage = 'ring'; }
            } else if (step === 'score') {
              tie.stage = 'score';
              const sv = {};
              for (const i of W) { const a = ask(ctx, 'score:' + i, i, 'number', { text: 'امتیاز تو روی امتیازشمار چند است؟', max: 60, mem: 'score' }); if (a !== undefined) sv[i] = a; }
              if (!done()) return;
              tie.scores = sv;
              const ms = Math.min(...W.map(i => sv[i]));
              W = W.filter(i => sv[i] === ms);
            }
          }
          if (W.length > 1) { W = []; tie.stage = 'none'; }
        }
        winner = W.length === 1 ? W[0] : null;
      }
    }
    if (!done()) return;
    R.result = { winner, tie };
    this.finishRound();
  };

  B.finishRound = function () {
    const R = this.R, ids = this.order, r = this.round, off = this.offline;
    const cur = R.final, { base, score, muted, eff, pow, parts } = R.calc, winner = R.result.winner;
    const notes = {};
    const note = (i, t) => { (notes[i] = notes[i] || []).push(t); };
    if (winner !== null && winner !== 'lost') {
      this.P[winner].tokens++;
      const bfe = this.bfe();
      if (bfe[0] === 'last_round_pts' && r >= RULES.rounds && bfe[1] > RULES.tokenPoints) { this.P[winner].pts += bfe[1] - RULES.tokenPoints; note(winner, 'میدان نبرد «' + this.bf.name + '»: برای راند ' + r + ' ' + (bfe[1] - RULES.tokenPoints) + ' امتیاز اضافه گرفتی.'); }
    }
    for (const i of ids) {
      const P = this.P[i], cid = cur[i];
      P.lastPower = cid ? score[i] : null;
      if (!cid) { P.next = null; P.pick = undefined; P.noDraw = false; continue; }
      const c = CARD[cid], e = muted[i] ? ['none'] : eff[i];
      if (e[0] === 'win_point' && winner === i) { P.pts++; note(i, 'S8: ۱ امتیاز اضافه گرفتی.'); }
      if (e[0] === 'target_opp' && R.ans['tgt:' + i] != null && R.ans['tgt:' + i] !== false) { P.burned++; note(i, 'کارت روی دکت را بسوزان.'); }
      if (e[0] === 'self_burn') { P.burned++; note(i, 'کارت روی دکت را بسوزان.'); }
      if (e[0] === 'burn_add') { P.burned += (R.ans['burnadd:' + i] || []).length; P.gone = (P.gone || []).concat(R.ans['burnadd:' + i] || []); }
      if (e[0] === 'sacrifice' && R.ans['sac:' + i]) P.gone = (P.gone || []).concat([R.ans['sac:' + i]]);
      if (e[0] === 'opp_burn') {
        if (off) note(i, 'S14: همهٔ حریفان کارت روی دکشان را بسوزانند (روی گوشی خودشان «S14 حریف» را بزنند).');
        else for (const j of this.opp(i)) { this.P[j].burned++; note(j, 'S14 ' + P.name + ': کارت روی دکت را بسوزان.'); }
      }
      if (e[0] === 'eclipse') {
        if (off) note(i, 'S18: اثرهای «تا پایان نبرد» حریفان لغو شد (روی گوشی خودشان «S18 حریف» را بزنند).');
        else for (const j of this.opp(i)) if (this.P[j].until.length) { this.P[j].until = []; note(j, 'S18 ' + P.name + ': اثرهای «تا پایان نبرد» تو لغو شد. توکن‌هایشان را بردار.'); }
      }
      if (off) {
        if (e[0] === 'opp_mute') note(i, 'S12: به حریفان بگو متن کارتشان اجرا نمی‌شود (روی گوشی خودشان «S12 حریف» را بزنند).');
        if (e[0] === 'opp_mod') note(i, 'S15: کارت نور و نوآموز حریفان ۲- (روی گوشی خودشان «S15 حریف» را بزنند).');
        if (e[0] === 'base_only') note(i, 'B15: برنده فقط با قدرت پایه مشخص می‌شود. قدرت پایهٔ تو: ' + base[i]);
        if (e[0] === 'opp_redraw') note(i, 'L16: اگر خواستی، حریفان کارت روشده را زیر دک بگذارند و کارت تازه رو کنند (روی گوشی خودشان «L16 حریف» را بزنند).');
      }
      if (e[0] === 'peek') note(i, 'کارت روی دکت را ببین و سر جایش یا زیر دک بگذار.');
      if ((e[0] === 'return_shuffle' || e[0] === 'return_top') && R.ans['ret:' + i]) {
        const back = R.ans['ret:' + i]; P.back = (P.back || []).concat([back]);
        note(i, e[0] === 'return_shuffle' ? 'کارت ' + back + ' را به دکت برگردان و بُر بزن.' : 'کارت ' + back + ' را روی دکت بگذار.');
      }
      if (e[0] === 'recall') { const pv = this.prev(i); if (pv) { P.back = (P.back || []).concat([pv.id]); note(i, 'کارت قبلی‌ات (' + pv.id + ') را به دستت برگردان. راند بعد کارت نکش.'); } }
      if (c.t === 'E' && !muted[i] && this.bfe()[0] === 'no_until') note(i, 'میدان نبرد «' + this.bf.name + '»: اثر «تا پایان نبرد» این کارت در این نبرد کار نمی‌کند.');
      else if (c.t === 'E' && !muted[i]) { P.until.push({ id: cid, eff: e }); note(i, 'توکن «تا پایان نبرد» این کارت را بالای سکویت بگذار.'); }
      P.next = (c.t === 'N' && !muted[i]) ? { id: cid, eff: e, lost: winner !== i } : null;
      P.noDraw = e[0] === 'recall' && !!this.prev(i);
      P.played.push({ id: cid, g: c.g, t: c.t, eff: c.eff, effUsed: eff[i], base: base[i], power: score[i] });
      P.pick = undefined;
    }
    if (off && R.inc && R.inc.burn) this.P[ids[0]].burned += R.inc.burn;
    this.history.push({ round: r, cards: Object.assign({}, cur), orig: Object.assign({}, R.cur), base, pow, score, parts, muted, baseOnly: R.calc.baseOnly, winner, tie: R.result.tie, notes });
    this.R = null;
    if (r >= RULES.rounds) { this.phase = 'done'; this.computeFinal(); }
    else { this.round++; this.phase = 'pick'; }
  };

  // battle score: 1 per token, +2 for most tokens (tie: winner of round 6 among them, else nobody), + S8 points
  B.computeFinal = function (offMaxOpp) {
    const ids = this.order, r6 = this.history.length ? this.history[this.history.length - 1].winner : null;
    const res = {};
    if (this.offline) {
      const i = ids[0], P = this.P[i];
      res[i] = { tokens: P.tokens, extra: P.pts, bonus: null };
      this.final = { res, needMaxOpp: true, r6won: r6 === i };
      if (offMaxOpp !== undefined) {
        const bonus = P.tokens > offMaxOpp || (P.tokens === offMaxOpp && r6 === i) ? RULES.mostTokensBonus : 0;
        res[i].bonus = bonus; res[i].total = P.tokens * RULES.tokenPoints + P.pts + bonus; this.final.needMaxOpp = false;
        this.bfFinal(res, j => !!res[j].bonus);
      }
      return;
    }
    const mt = Math.max(...ids.map(i => this.P[i].tokens));
    const top = ids.filter(i => this.P[i].tokens === mt);
    let bonusTo = null;
    if (mt > 0) { if (top.length === 1) bonusTo = top[0]; else if (top.includes(r6)) bonusTo = r6; }
    for (const i of ids) {
      const P = this.P[i], bonus = i === bonusTo ? RULES.mostTokensBonus : 0;
      res[i] = { tokens: P.tokens, extra: P.pts, bonus, total: P.tokens * RULES.tokenPoints + P.pts + bonus };
    }
    const best = Math.max(...ids.map(i => res[i].total));
    this.final = { res, bonusTo, winners: ids.filter(i => res[i].total === best) };
    this.bfFinal(res, i => i === bonusTo);
  };

  // battlefield effects settled after the battle: shown as a note to the players they concern
  B.bfFinal = function (res, hasBonus) {
    const e = this.bfe(), nm = this.bf && this.bf.name;
    for (const i of Object.keys(res)) {
      const n = [];
      if (e[0] === 'spoils' && this.P[i].tokens >= e[1]) n.push('میدان نبرد «' + nm + '»: ' + e[2] + ' سکه بگیر.');
      if (e[0] === 'alt_bonus' && hasBonus(i) && res[i].bonus) n.push('میدان نبرد «' + nm + '»: می‌توانی به‌جای ' + res[i].bonus + ' امتیاز اضافه، ' + e[1] + ' منبع (سکه و طومار، به دلخواه) بگیری.');
      res[i].bfNotes = n;
    }
  };

  // what one phone shows
  B.view = function (pid) {
    const ids = this.order, R = this.R;
    const last = this.history.length ? this.history[this.history.length - 1] : null;
    const players = ids.map(i => {
      const P = this.P[i];
      const top = P.played.length ? P.played[P.played.length - 1].id : null;
      return {
        id: i, name: P.name, color: P.color, tokens: P.tokens, pts: P.pts, teacher: P.teacher,
        picked: P.pick !== undefined, none: P.pick === null,
        myPick: i === pid ? P.pick : undefined,
        top, until: P.until.map(u => u.id), next: P.next ? P.next.id : null, burned: P.burned, noDraw: P.noDraw,
        cur: R ? (R.final ? R.final[i] : R.cur[i]) : null
      };
    });
    const v = {
      round: this.round, phase: this.phase, offline: this.offline, players,
      questions: R ? R.questions.filter(q => q.to === pid) : [],
      waiting: R ? [...new Set(R.questions.map(q => q.to))].filter(i => i !== pid).map(i => this.P[i].name) : [],
      last: last ? { round: last.round, cards: last.cards, score: last.score, base: last.base, parts: last.parts, muted: last.muted, baseOnly: last.baseOnly, winner: last.winner, tie: last.tie, notes: (last.notes[pid] || []) } : null,
      final: this.final, bf: this.bf,
      wins: this.history.map(h => h.winner),
      blocked: this.P[pid] ? Object.keys(CARD).filter(id => !this.canPlay(pid, id)) : [],
      rounds: this.history.map(h => ({ round: h.round, cards: h.cards, score: h.score, winner: h.winner }))
    };
    return v;
  };

  B.serialize = function () {
    return JSON.parse(JSON.stringify({ offline: this.offline, round: this.round, phase: this.phase, P: this.P, order: this.order, R: this.R, history: this.history, final: this.final, bf: this.bf, bfAns: this.bfAns }));
  };
  Battle.restore = function (s) { const b = new Battle([], {}); Object.assign(b, s); return b; };

  // offline battle that continues from one player's state in a linked battle
  Battle.offlineFrom = function (s, pid) {
    const b = new Battle([], { offline: true });
    b.round = s.round; b.phase = s.phase === 'done' ? 'done' : 'pick'; b.order = [pid];
    b.P = { [pid]: Object.assign({}, s.P[pid], { pick: undefined }) };
    b.history = s.history.map(h => ({ round: h.round, cards: { [pid]: h.cards[pid] }, orig: {}, base: { [pid]: h.base[pid] }, pow: {}, score: { [pid]: h.score[pid] }, parts: { [pid]: h.parts[pid] }, muted: {}, winner: h.winner === pid ? pid : null, tie: null, notes: {} }));
    b.final = null; b.bf = s.bf || null; b.bfAns = (s.bfAns && pid in s.bfAns) ? { [pid]: s.bfAns[pid] } : {};
    if (b.phase === 'done') b.computeFinal();
    return b;
  };

  Battle.RULES = RULES;
  root.Battle = Battle;
  if (typeof module !== 'undefined') module.exports = { Battle };
})(typeof window !== 'undefined' ? window : global);
