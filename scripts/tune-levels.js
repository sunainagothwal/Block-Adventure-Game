/**
 * Level tuner.
 *
 *   node scripts/tune-levels.js            # print the new LEVEL_DATA block + a report
 *   node scripts/tune-levels.js --write    # ...and splice it into App.tsx
 *   node scripts/tune-levels.js --check    # replay the CURRENT App.tsx levels, no changes
 *   APP_PATH=some/App.tsx node scripts/tune-levels.js --check   # replay another copy
 *
 * The tray is random, so a level cannot be solved ahead of time. Instead each
 * level is played hundreds of times by a bot using the REAL rules engine, cut
 * out of App.tsx (not a copy), and the level is shaped so the bot wins a chosen
 * share of the time. That share falls as you climb (TARGET_WIN), so difficulty
 * rises smoothly, level by level.
 *
 * Two things keep the ladder honest:
 *  - a floor on obstacles (minKnob): a crystal / ice level never gets easier
 *    than a fixed, rising number of separate lines to clear, however well the
 *    bot happens to do on one layout;
 *  - line / score goals are read off the bot's own results, so they rise with it.
 *
 * The move limit rises from 30 (level 1) to 40 (last level).
 *
 * The bot looks a whole tray ahead (every order, every rotation), which is about
 * as good as a careful human. If real players find the game too easy or too
 * hard, change WIN_FIRST / WIN_LAST / WIN_CURVE and re-run.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ts = require('typescript');

const APP = process.env.APP_PATH || path.join(__dirname, '..', 'App.tsx');
const app = fs.readFileSync(APP, 'utf8');

/* --- knobs ------------------------------------------------------------------ */

const MOVES_FIRST = 30;
const MOVES_LAST = 40;
const WIN_FIRST = 0.9;    // the bot should win about this share of level 1...
const WIN_LAST = 0.3;     // ...falling to this share on the last level
const WIN_CURVE = 0.7;    // < 1 climbs faster early on, so the middle is already hard
const GAMES = 160;        // games per candidate
const BEAM = 3;           // partial plans kept per step of the look-ahead
const STONE_MAX_COUNT = 5;
const T_MAX = 16;
const LAYOUTS = 3;         // different random layouts tried per setting; the closest to the target is kept
const OBSTACLE_SQUEEZE = 5; // crystal / ice / clear levels get this many fewer moves (never under MOVES_FIRST)

const movesFor = (i, n) => Math.round(MOVES_FIRST + (MOVES_LAST - MOVES_FIRST) * (i / (n - 1)));
const TARGET_WIN = (i, n) => WIN_FIRST - (WIN_FIRST - WIN_LAST) * (i / (n - 1)) ** WIN_CURVE;

/**
 * How hard the obstacle layout is, as one number .
 *
 * What makes a crystal / ice level hard is not how MANY there are (a crowd of
 * them sits on the same few lines and falls together, which is easy) but how
 * many SEPARATE lines you must clear to reach them all. So t up to 8 is the
 * number of separate lines needed (one obstacle per row and column, at most 8
 * on an 8x8 board), and past 8 it adds extra obstacles on those same lines.
 *
 * minKnob is the floor: a level never gets easier than this, however well the
 * bot happens to do on one layout. It rises through each world.
 */
const KNOB_RANGE = { 1: [6, 9], 2: [7, 10], 3: [8, 12], 4: [9, 14] };
function minKnob(index, stage) {
  const range = KNOB_RANGE[stage];
  if (!range) return 0;
  const j = index - stage * 12; // 0..11 inside the world
  return Math.round(range[0] + ((range[1] - range[0]) * j) / 11);
}

/* --- the real rules engine, cut out of App.tsx ------------------------------- */

function slice(from, to) {
  const a = app.indexOf(from);
  const b = app.indexOf(to);
  if (a < 0 || b < 0 || b < a) throw new Error(`cannot find engine markers ${from} .. ${to}`);
  return app.slice(a, b);
}
const nMatch = /^const N = (\d+);/m.exec(app);
if (!nMatch) throw new Error('cannot find N');
const engineTs = `const N = ${nMatch[1]};\n${slice('type Cell = { r: number; c: number };', 'const OBJ_LABEL')}
module.exports = { N, VARIANTS, TURN_OF, BASE_SHAPES, makeBoard, canPlace, place, scoreFor, bagPool, anyFits, KIND_STONE, KIND_CRYSTAL, KIND_ICE, idx };`;
const engineJs = ts.transpileModule(engineTs, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const modObj = { exports: {} };
new Function('module', 'exports', engineJs)(modObj, modObj.exports);
const E = modObj.exports;
const { N, VARIANTS, TURN_OF, makeBoard, canPlace, place, scoreFor, bagPool, anyFits, KIND_CRYSTAL, KIND_ICE } = E;

/* --- seeded random ------------------------------------------------------------ */

function rngFor(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- the bot ------------------------------------------------------------------ */

const rowFill = new Int32Array(N);
const colFill = new Int32Array(N);

/** How good a board is to be left with: room, few pockets, rows nearly full, obstacle lines nearly full. */
function structure(b, ctx) {
  rowFill.fill(0); colFill.fill(0);
  const occ = b.occ;
  let holes = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = r * N + c;
      if (occ[k]) { rowFill[r]++; colFill[c]++; continue; }
      let nb = 0;
      if (r === 0 || occ[k - N]) nb++;
      if (r === N - 1 || occ[k + N]) nb++;
      if (c === 0 || occ[k - 1]) nb++;
      if (c === N - 1 || occ[k + 1]) nb++;
      if (nb >= 3) holes += nb === 4 ? 2 : 1;
    }
  }
  let pot = 0;
  for (let i = 0; i < N; i++) pot += (rowFill[i] / N) ** 2 + (colFill[i] / N) ** 2;
  let s = pot * 9 - holes * 6;
  if (ctx.wSet > 0) {
    for (let k = 0; k < N * N; k++) {
      const kd = b.kind[k];
      if (kd === KIND_CRYSTAL || kd === KIND_ICE) {
        s += ctx.wSet * ((rowFill[(k / N) | 0] / N) ** 2 + (colFill[k % N] / N) ** 2);
      }
    }
  }
  return s;
}

const reward = (res, ctx) =>
  res.lines * 40 + (res.lines > 1 ? (res.lines - 1) * 25 : 0) + res.crystals * ctx.wCry + res.iceBroken * ctx.wIce;

/** Every legal (piece, rotation, cell) for the pieces still in the tray. */
function* placements(board, tray) {
  for (let slot = 0; slot < tray.length; slot++) {
    if (tray[slot] === null) continue;
    let vi = tray[slot];
    const seen = new Set();
    for (let t = 0; t < 4; t++) {
      if (seen.has(vi)) break;
      seen.add(vi);
      const v = VARIANTS[vi];
      for (let r = 0; r <= N - v.h; r++) {
        for (let c = 0; c <= N - v.w; c++) if (canPlace(board, v.cells, r, c)) yield { slot, v, r, c };
      }
      vi = TURN_OF[vi];
    }
  }
}

const copyBoard = (b) => ({ occ: Uint8Array.from(b.occ), kind: Uint8Array.from(b.kind), color: Int8Array.from(b.color) });

/**
 * Plan the whole tray: a beam search over every order and placement, keeping the
 * BEAM best partial plans at each step. Returns the moves to make, in order.
 */
function plan(board, tray, ctx, rng) {
  let beam = [{ board, tray, moves: [], gain: 0, val: 0 }];
  const remaining = tray.filter((x) => x !== null).length;
  for (let step = 0; step < remaining; step++) {
    const next = [];
    for (const st of beam) {
      const cands = [];
      for (const p of placements(st.board, st.tray)) {
        const nb = copyBoard(st.board);
        const res = place(nb, p.v.cells, p.r, p.c, 0);
        const gain = st.gain + reward(res, ctx);
        cands.push({ p, nb, gain, val: gain + structure(nb, ctx) + rng() * 0.5 });
      }
      cands.sort((a, b) => b.val - a.val);
      for (const cd of cands.slice(0, BEAM)) {
        next.push({
          board: cd.nb,
          tray: st.tray.map((x, i) => (i === cd.p.slot ? null : x)),
          moves: st.moves.concat(cd.p), gain: cd.gain, val: cd.val,
        });
      }
    }
    if (!next.length) break; // the rest of the tray does not fit
    next.sort((a, b) => b.val - a.val);
    beam = next.slice(0, BEAM * 2);
  }
  // Prefer the plan that used the most pieces, then the best value.
  beam.sort((a, b) => b.moves.length - a.moves.length || b.val - a.val);
  return beam[0].moves;
}

/** Play one level to the end. `goalOn` false ignores the goal (used to measure lines / score). */
function play(level, rng, goalOn) {
  const pool = bagPool(level.bag);
  const draw = () => pool[Math.floor(rng() * pool.length)];
  let board = makeBoard(level);
  let tray = [draw(), draw(), draw()];
  let lines = 0, score = 0, crystals = 0, ice = 0, streak = 0, moves = level.moves;
  const needCry = level.crystal.length;
  const needIce = level.ice.length;
  const ctx = {
    wCry: needCry ? 70 : 6,
    wIce: needIce ? 50 : 4,
    wSet: needCry + needIce > 0 ? 6 : 0,
  };
  const met = () => {
    if (!goalOn) return false;
    switch (level.objType) {
      case 'lines': return lines >= level.objTarget;
      case 'score': return score >= level.objTarget;
      case 'crystals': return crystals >= needCry;
      case 'ice': return ice >= needIce;
      default: return crystals + ice >= needCry + needIce;
    }
  };
  for (;;) {
    if (met()) return { won: true, score, lines, reason: 'won' };
    if (moves <= 0) return { won: false, score, lines, reason: 'moves' };
    if (!anyFits(board, tray)) return { won: false, score, lines, reason: 'stuck' };

    const seq = plan(board, tray, ctx, rng);
    for (const m of seq) {
      const next = copyBoard(board);
      const res = place(next, m.v.cells, m.r, m.c, 0);
      streak = res.lines > 0 ? streak + 1 : 0;
      board = next;
      lines += res.lines;
      crystals += res.crystals;
      ice += res.iceBroken;
      score += scoreFor(res, streak);
      moves--;
      tray = tray.map((x, i) => (i === m.slot ? null : x));
      if (met()) return { won: true, score, lines, reason: 'won' };
      if (moves <= 0) return { won: false, score, lines, reason: 'moves' };
    }
    if (tray.every((x) => x === null)) tray = [draw(), draw(), draw()];
  }
}

function winRate(level, seed, goalOn = true) {
  const rng = rngFor(seed);
  let wins = 0, stuck = 0;
  const scores = [];
  const finals = [];
  for (let g = 0; g < GAMES; g++) {
    const r = play(level, rng, goalOn);
    finals.push(r);
    if (r.won) { wins++; scores.push(r.score); }
    if (r.reason === 'stuck') stuck++;
  }
  scores.sort((a, b) => a - b);
  return { win: wins / GAMES, stuck: stuck / GAMES, scores, finals };
}

/* --- level layout -------------------------------------------------------------- */

const cellStr = (cells) => cells.map((p) => `${p.r}${p.c}`).join(' ');
const parse = (s) => (!s ? [] : s.split(' ').filter(Boolean).map((t) => ({ r: Number(t[0]), c: Number(t[1]) })));

/** The current ladder: which goal each level has, which bag, how many stones. */
function readCurrent() {
  const start = app.indexOf('const LEVEL_DATA: RawLevel[] = [');
  const end = app.indexOf('\n];', start);
  if (start < 0 || end < 0) throw new Error('cannot find LEVEL_DATA');
  const block = app.slice(start, end);
  const out = [];
  const re = /\{ s: (\d+), obj: '(\w+):(\d+)', moves: (\d+), stars: \[(\d+), (\d+), (\d+)\], bag: '(\w+)'([^}]*)\}/g;
  let m;
  while ((m = re.exec(block))) {
    const grab = (k) => { const x = new RegExp(`${k}: '([^']*)'`).exec(m[9]); return x ? x[1] : ''; };
    out.push({
      s: +m[1], type: m[2], target: +m[3], moves: +m[4], stars: [+m[5], +m[6], +m[7]], bag: m[8],
      stone: grab('stone'), crystal: grab('crystal'), ice: grab('ice'),
    });
  }
  return out;
}

function toLevel(index, spec) {
  return {
    key: `L${index}`, index, stage: spec.s,
    objType: spec.type, objTarget: spec.target, moves: spec.moves, stars: spec.stars, bag: spec.bag,
    stone: parse(spec.stone), crystal: parse(spec.crystal), ice: parse(spec.ice),
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build the obstacle layout for a level from its knob t (see minKnob). */
function layout(index, base, t, variant = 0) {
  const rng = rngFor(index * 7919 + 13 + variant * 104729);
  const interior = [];
  for (let r = 1; r <= N - 2; r++) for (let c = 1; c <= N - 2; c++) interior.push({ r, c });
  const stones = shuffled(interior, rng).slice(0, base.stones);
  if (base.type !== 'crystals' && base.type !== 'ice' && base.type !== 'clear') {
    return { stone: stones, crystal: [], ice: [] };
  }
  const taken = new Set(stones.map((p) => p.r * N + p.c));
  const k = Math.min(N, t);
  const extra = t > N ? (t - N) * 2 + 2 : Math.floor(t / 3);
  const all = [];
  const rows = [];
  const cols = [];
  // One obstacle per row and per column, none on a stone.
  for (let tries = 0; tries < 200; tries++) {
    const rs = shuffled([0, 1, 2, 3, 4, 5, 6, 7], rng).slice(0, k);
    const cs = shuffled([0, 1, 2, 3, 4, 5, 6, 7], rng).slice(0, k);
    if (rs.every((r, i) => !taken.has(r * N + cs[i]))) {
      rs.forEach((r, i) => { all.push({ r, c: cs[i] }); taken.add(r * N + cs[i]); rows.push(r); cols.push(cs[i]); });
      break;
    }
  }
  // Extras sit on lines that already have an obstacle, so they add to the picture, not to the lines needed.
  const spare = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) if (!taken.has(r * N + c) && (rows.includes(r) || cols.includes(c))) spare.push({ r, c });
  }
  for (const p of shuffled(spare, rng).slice(0, extra)) all.push(p);
  const mixed = shuffled(all, rng);
  if (base.type === 'crystals') return { stone: stones, crystal: mixed, ice: [] };
  if (base.type === 'ice') return { stone: stones, crystal: [], ice: mixed };
  return { stone: stones, crystal: mixed.filter((_, i) => i % 2 === 0), ice: mixed.filter((_, i) => i % 2 === 1) };
}

const pct = (x) => `${Math.round(x * 100)}%`;

/** Tune one level. Returns the finished spec and a report row. */
function tuneOne(cur, i, n) {
  const c = cur[i];
  // Obstacle levels sit at the tight end of the move range: they need specific lines, not just any lines.
  const obstacle = c.type === 'crystals' || c.type === 'ice' || c.type === 'clear';
  const moves = obstacle ? Math.max(MOVES_FIRST, movesFor(i, n) - OBSTACLE_SQUEEZE) : movesFor(i, n);
  const want = TARGET_WIN(i, n);
  const base = { type: c.type, bag: c.bag, s: c.s, stones: Math.min(STONE_MAX_COUNT, parse(c.stone).length) };
  let spec;

  if (c.type === 'lines' || c.type === 'score') {
    // Play with no goal and read the goal off the distribution: the goal the bot
    // reaches `want` of the time is the (1 - want) quantile of what it reached.
    const lay = layout(i, base, 0);
    const probe = toLevel(i, { s: c.s, type: c.type, target: 1e9, moves, stars: [0, 0, 0], bag: c.bag,
      stone: cellStr(lay.stone), crystal: '', ice: '' });
    const r = winRate(probe, 1000 + i, false);
    const vals = r.finals.map((f) => (c.type === 'lines' ? f.lines : f.score)).sort((a, b) => a - b);
    const q = vals[Math.min(vals.length - 1, Math.floor((1 - want) * vals.length))];
    spec = { s: c.s, type: c.type, target: Math.max(3, q), moves, bag: c.bag, stone: cellStr(lay.stone), crystal: '', ice: '' };
  } else {
    // Obstacle goals: start from the floor and add obstacles until the bot's win
    // rate drops to the target; keep whichever knob landed closest.
    const kMin = Math.min(T_MAX, minKnob(i, c.s));
    let best = { k: kMin, v: 0, gap: Infinity };
    for (let k = kMin; k <= T_MAX; k++) {
      let lowest = 1;
      for (let v = 0; v < LAYOUTS; v++) {
        const lay = layout(i, base, k, v);
        const probe = toLevel(i, { s: c.s, type: c.type, target: 0, moves, stars: [0, 0, 0], bag: c.bag,
          stone: cellStr(lay.stone), crystal: cellStr(lay.crystal), ice: cellStr(lay.ice) });
        const r = winRate(probe, 2000 + i * 131 + k * 7 + v);
        const gap = Math.abs(r.win - want);
        if (gap < best.gap) best = { k, v, gap };
        lowest = Math.min(lowest, r.win);
      }
      if (lowest < want) break;
    }
    const lay = layout(i, base, best.k, best.v);
    spec = { s: c.s, type: c.type, target: 0, moves, bag: c.bag,
      stone: cellStr(lay.stone), crystal: cellStr(lay.crystal), ice: cellStr(lay.ice) };
  }

  // Measure the finished level, and read the star tiers off its winning scores.
  spec.stars = [0, 0, 0];
  const stats = winRate(toLevel(i, spec), 5000 + i);
  const sc = stats.scores;
  const at = (q) => (sc.length ? sc[Math.min(sc.length - 1, Math.floor(q * sc.length))] : 0);
  const t1 = Math.round(at(0.5) / 5) * 5;
  let t2 = Math.round(at(0.85) / 5) * 5;
  if (t2 <= t1) t2 = t1 + 25;
  spec.stars = [Math.round((t1 * 0.5) / 5) * 5, t1, t2];
  const row = {
    i, type: c.type, moves, want, win: stats.win, stuck: stats.stuck,
    goal: spec.target || 'all', obs: `${parse(spec.stone).length}/${parse(spec.crystal).length}/${parse(spec.ice).length}`,
  };
  return { spec, row };
}

function format(specs) {
  const lines = specs.map((s) => {
    let t = `  { s: ${s.s}, obj: '${s.type}:${s.type === 'lines' || s.type === 'score' ? s.target : 0}', moves: ${s.moves}, stars: [${s.stars.join(', ')}], bag: '${s.bag}'`;
    if (s.stone) t += `, stone: '${s.stone}'`;
    if (s.crystal) t += `, crystal: '${s.crystal}'`;
    if (s.ice) t += `, ice: '${s.ice}'`;
    return `${t} },`;
  });
  return `const LEVEL_DATA: RawLevel[] = [\n${lines.join('\n')}`;
}

/* --- running: workers split the levels between the CPU cores ---------------------- */

const line = (r) =>
  `L${String(r.i + 1).padStart(2)} ${r.type.padEnd(8)} moves ${r.moves}  ${r.want !== undefined ? `want ${pct(r.want)}  ` : ''}win ${pct(r.win)}  stuck ${pct(r.stuck)}` +
  `${r.goal !== undefined ? `  goal ${r.goal}  stone/crystal/ice ${r.obs}` : ''}`;

if (process.env.TUNE_WORKER) {
  const [k, w] = process.env.TUNE_WORKER.split('/').map(Number);
  const mode = process.env.TUNE_MODE;
  const cur = readCurrent();
  const n = cur.length;
  for (let i = k; i < n; i += w) {
    if (mode === 'check') {
      const r = winRate(toLevel(i, cur[i]), 9000 + i);
      process.stdout.write(`${JSON.stringify({ i, row: { i, type: cur[i].type, moves: cur[i].moves, win: r.win, stuck: r.stuck } })}\n`);
    } else {
      const { spec, row } = tuneOne(cur, i, n);
      process.stdout.write(`${JSON.stringify({ i, spec, row })}\n`);
    }
  }
} else {
  const mode = process.argv.includes('--check') ? 'check' : 'tune';
  const workers = Math.max(1, Math.min(os.cpus().length - 1, 11));
  const results = [];
  let open = workers;
  for (let k = 0; k < workers; k++) {
    const child = spawn(process.execPath, [__filename], {
      env: { ...process.env, TUNE_WORKER: `${k}/${workers}`, TUNE_MODE: mode },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const t = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (t) { const o = JSON.parse(t); results.push(o); process.stderr.write(`${line(o.row)}\n`); }
      }
    });
    child.on('exit', () => {
      if (--open > 0) return;
      results.sort((a, b) => a.i - b.i);
      const rows = results.map((r) => r.row);
      const avg = rows.reduce((a, r) => a + r.win, 0) / rows.length;
      if (mode === 'tune') {
        const block = format(results.map((r) => r.spec));
        if (process.argv.includes('--write')) {
          const start = app.indexOf('const LEVEL_DATA: RawLevel[] = [');
          const end = app.indexOf('\n];', start);
          fs.writeFileSync(APP, app.slice(0, start) + block + app.slice(end));
          process.stderr.write('App.tsx updated.\n');
        } else {
          process.stdout.write(`${block}\n];\n`);
        }
      }
      process.stderr.write(`\n--- sorted ---\n${rows.map(line).join('\n')}\n`);
      process.stderr.write(`average bot win ${pct(avg)}, worst ${pct(Math.min(...rows.map((r) => r.win)))}, best ${pct(Math.max(...rows.map((r) => r.win)))}\n`);
    });
  }
}
