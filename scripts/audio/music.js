/* ============================================================================
 * MUSIC — seven calm, low-pitched loops.
 *
 *   menu   home / welcome / rewards      game   the puzzle board
 *   w1..w5 one per world on the Adventure map
 *
 * The recipe (from how cozy / meditative game soundtracks are built): slow
 * tempo (60-78 BPM), melodies in the low-middle register (roughly C3-C5), soft
 * felt / wooden / breathy timbres, every melodic layer low-passed so little sits
 * above ~2 kHz, sparse long notes instead of busy runs, few chord changes, and
 * no drums at all (a low thump reads as a dull "doom" on a phone speaker).
 *
 * Every track is 12 bars in three 4-bar phrases (A, A', B) over a chord loop.
 * Chords, bass, pads, arpeggios and percussion are written out; the lead
 * melody is generated under musical constraints so it can never clash:
 *
 *   - long notes and notes on beats 1 and 3 are always chord tones
 *   - short off-beat notes may pass through the scale, stepwise
 *   - a leap is followed by a step back the other way
 *   - phrase A' repeats phrase A note for note (except its last bar), so the
 *     tune is recognisable
 *   - every phrase ends on a chord tone
 *
 * Nothing is sampled: it is all additive synthesis (see kit.js), rendered with
 * wrap-around mixing and a circular reverb so each loop is seamless.
 * ========================================================================== */

const { SR, rng, makeBuf, inst, lowpass, reverb, echoLoop, normalise, softClip } = require('./kit');

const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11, 'F#': 6, 'C#': 1 };
const TYPES = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
  add9: [0, 4, 7, 2], p5: [0, 7], dom7: [0, 4, 7, 10],
};
const ch = (root, type = 'maj') => ({
  root: PC[root], type, pcs: TYPES[type].map((i) => (PC[root] + i) % 12), name: root + type,
});

/** Ascending chord tones starting at or above `low`. */
function voicing(chord, low, count = chord.pcs.length) {
  const notes = chord.pcs.map((pc) => {
    let m = low + ((pc - low) % 12 + 12) % 12;
    if (m < low) m += 12;
    return m;
  }).sort((a, b) => a - b);
  return notes.slice(0, count);
}
function rootNear(chord, lo, hi) {
  for (let m = lo; m <= hi; m++) if (m % 12 === chord.root) return m;
  return lo;
}
function fifthNear(chord, lo, hi) {
  for (let m = lo; m <= hi; m++) if (m % 12 === (chord.root + 7) % 12) return m;
  return lo;
}

/* ---------- melody generator -------------------------------------------------- */

function genMelody(spec) {
  const { scale, range: [lo, hi], patterns, plan, seed, restProb = 0, chords, bars, phraseKeys = [1, 1, 2] } = spec;
  const ladder = [];
  for (let m = lo; m <= hi; m++) if (scale.includes(m % 12)) ladder.push(m);
  const centre = Math.round(ladder.length * 0.45);
  let cur = centre;
  let prev = -1;
  let dir = 1;
  const out = [];
  const byBar = [];
  for (let bar = 0; bar < bars; bar++) {
    // the answering phrase repeats the first one note for note (chords permitting),
    // so the tune is recognisable; only its last bar differs
    if (bar >= 4 && bar <= 6 && chords[bar].name === chords[bar - 4].name && byBar[bar - 4].length) {
      byBar[bar] = byBar[bar - 4].map((n) => ({ ...n, bar }));
      out.push(...byBar[bar]);
      const last = byBar[bar][byBar[bar].length - 1];
      prev = cur;
      cur = last.k;
      continue;
    }
    const phrase = Math.floor(bar / 4);
    const pos = bar % 4;
    const r = rng(seed * 1009 + phraseKeys[phrase] * 131 + pos * 17);
    const pat = patterns[plan[bar]];
    const chord = chords[bar];
    pat.forEach(([beat, len], j) => {
      const lastOfPhrase = pos === 3 && j === pat.length - 1;
      const onBeat = Number.isInteger(beat);
      const mustBeChordTone = lastOfPhrase || beat % 2 === 0 || (onBeat && len >= 1);
      if (!mustBeChordTone && !lastOfPhrase && r() < restProb) return;
      const cands = [];
      for (let k = Math.max(0, cur - 5); k <= Math.min(ladder.length - 1, cur + 5); k++) {
        if (mustBeChordTone && !chord.pcs.includes(ladder[k] % 12)) continue;
        const d = k - cur;
        let w = Math.exp(-Math.abs(d) * 0.6);
        if (d === 0) w *= 0.04;
        if (k === prev) w *= 0.3;   // don't ping-pong between two notes either
        if (Math.sign(d) === dir) w *= 1.6;
        w *= Math.exp(-Math.abs(k - centre) * 0.07);
        cands.push([k, w]);
      }
      if (!cands.length) {
        // nothing within reach: jump to the nearest chord tone anywhere
        let best = cur;
        let bd = 99;
        ladder.forEach((m, k) => { if (chord.pcs.includes(m % 12) && Math.abs(k - cur) < bd) { bd = Math.abs(k - cur); best = k; } });
        cands.push([best, 1]);
      }
      const total = cands.reduce((s, c) => s + c[1], 0);
      let pick = r() * total;
      let chosen = cands[cands.length - 1][0];
      for (const [k, w] of cands) { pick -= w; if (pick <= 0) { chosen = k; break; } }
      const d = chosen - cur;
      if (Math.abs(d) >= 2) dir = -Math.sign(d);
      else if (chosen >= ladder.length - 3) dir = -1;
      else if (chosen <= 2) dir = 1;
      prev = cur;
      cur = chosen;
      out.push({ bar, beat, len, midi: ladder[chosen], lastOfPhrase, k: chosen });
    });
    byBar[bar] = out.filter((n) => n.bar === bar);
  }
  return out;
}

/* ---------- renderer ------------------------------------------------------------ */

const MEL = {
  bell: (b, o) => inst.bell(b, { ...o, kind: 'bell', dur: 2.0 }),
  celesta: (b, o) => inst.bell(b, { ...o, kind: 'celesta', dur: 1.8 }),
  musicbox: (b, o) => inst.bell(b, { ...o, kind: 'musicbox', dur: 1.6 }),
  kalimba: (b, o) => inst.kalimba(b, o),
  marimba: (b, o) => inst.marimba(b, o),
  steel: (b, o) => inst.steel(b, o),
  oud: (b, o) => inst.oud(b, o),
  piano: (b, o) => inst.piano(b, { ...o, dur: 2.2 }),
  pluck: (b, o) => inst.pluck(b, { ...o, soft: true }),
  flute: (b, o) => inst.flute(b, { ...o, dur: Math.max(0.3, o.len * o.spb * 0.96) }),
};

function render(spec) {
  const { bpm, bars, chords } = spec;
  const spb = 60 / bpm;
  const barLen = 4 * spb;
  const total = bars * barLen;
  const L = {
    mel: makeBuf(total, true), arp: makeBuf(total, true), pad: makeBuf(total, true),
    bass: makeBuf(total, true), perc: makeBuf(total, true),
  };
  const jit = rng(spec.seed * 7 + 1);

  // pads: each chord is held past its bar line so neighbours crossfade
  if (spec.pad) {
    chords.forEach((c, bar) => {
      const notes = voicing(c, spec.pad.low ?? 52, 4);
      notes.forEach((m) => inst.pad(L.pad, {
        start: bar * barLen, dur: barLen + (spec.pad.overlap ?? 1.0), midi: m,
        vol: spec.pad.vol, attack: spec.pad.attack ?? 0.5, release: spec.pad.release ?? 1.3,
      }));
    });
  }

  // bass
  if (spec.bass) {
    chords.forEach((c, bar) => {
      spec.bass.pattern.forEach(([beat, len, which]) => {
        const midi = which === '5' ? fifthNear(c, 43, 54) : which === 'o' ? rootNear(c, 43, 54) + 12 : rootNear(c, 43, 54);
        inst.bass(L.bass, { start: bar * barLen + beat * spb, dur: len * spb, midi, vol: spec.bass.vol });
      });
    });
  }

  // arpeggio / strum
  if (spec.arp) {
    const a = spec.arp;
    chords.forEach((c, bar) => {
      const v = voicing(c, a.low, 4);
      a.pattern.forEach(([beat, idx]) => {
        const t = bar * barLen + beat * spb;
        const vol = a.vol * (0.85 + jit() * 0.3);
        if (a.strum) {
          v.slice(0, a.strum).forEach((m, k) => inst.pluck(L.arp, { start: t + k * 0.013, midi: m, vol: vol * (k === 0 ? 1.1 : 0.85), dur: 0.9, soft: true }));
        } else {
          const m = v[idx % v.length] + (idx >= v.length ? 12 : 0);
          MEL[a.inst](L.arp, { start: t, midi: m, vol, spb, len: 0.5 });
        }
      });
    });
  }

  // percussion
  if (spec.perc) for (let bar = 0; bar < bars; bar++) spec.perc(L.perc, bar, bar * barLen, spb, rng(spec.seed * 31 + bar));

  // melody
  const mel = genMelody({ ...spec.melody, chords, bars, seed: spec.seed });
  const m = spec.melody;
  let n = 0;
  mel.forEach((note) => {
    const t = note.bar * barLen + note.beat * spb + (jit() - 0.5) * 0.012;
    const accent = note.beat % 2 === 0 ? 1 : 0.86;
    const vol = m.vol * accent * (0.9 + jit() * 0.2);
    MEL[m.inst](L.mel, { start: Math.max(0, t), midi: note.midi, vol, spb, len: note.len, seed: ++n });
    if (m.double) MEL[m.double.inst](L.mel, { start: Math.max(0, t), midi: note.midi + (m.double.shift ?? 0), vol: vol * m.double.vol, spb, len: note.len, seed: n });
  });

  // per-layer treatment, then sum
  const fx = spec.fx;
  if (fx.mel?.lp) lowpass(L.mel, fx.mel.lp);
  if (fx.arp?.lp) lowpass(L.arp, fx.arp.lp);
  if (fx.pad?.lp) lowpass(L.pad, fx.pad.lp);
  if (fx.bass?.lp) lowpass(L.bass, fx.bass.lp);
  if (fx.perc?.lp) lowpass(L.perc, fx.perc.lp);
  for (const key of ['mel', 'arp', 'pad']) {
    const f = fx[key];
    if (!f) continue;
    if (f.echo) echoLoop(L[key], f.echo.beats * spb, f.echo.fb, f.echo.mix);
    if (f.verb) reverb(L[key], f.verb);
  }
  const mix = makeBuf(total, true);
  for (const key of Object.keys(L)) {
    const g = fx[key]?.gain ?? 1;
    for (let i = 0; i < mix.data.length; i++) mix.data[i] += L[key].data[i] * g;
  }
  softClip(mix, 1.15);
  normalise(mix, 0.8);
  return { buf: mix, bars, bpm, seconds: total };
}

/* ---------- the seven tracks ------------------------------------------------------ */

const T = {};

/** Home: C major, unhurried. Felt piano over a low, slow marimba arpeggio. */
T.music_menu = () => render({
  seed: 11, bpm: 66, bars: 12,
  chords: [
    ch('C'), ch('G'), ch('A', 'min'), ch('F'),
    ch('C'), ch('G'), ch('A', 'min'), ch('G'),
    ch('F'), ch('C'), ch('F'), ch('G'),
  ],
  melody: {
    inst: 'piano', vol: 0.4, scale: [0, 2, 4, 5, 7, 9, 11], range: [55, 76], restProb: 0.12,
    patterns: [
      [[0, 2], [2, 2]],
      [[0, 3], [3, 1]],
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 4]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 4, 0, 3, 1, 4],
    double: { inst: 'marimba', vol: 0.45, shift: -12 },
  },
  arp: { inst: 'marimba', low: 48, vol: 0.12, pattern: [[0, 0], [1, 1], [2, 2], [3, 1]] },
  pad: { vol: 0.058, low: 45, overlap: 1.4 },
  bass: { vol: 0.26, pattern: [[0, 1.8, 'r'], [2, 1.8, '5']] },
  fx: { mel: { lp: 1900, verb: { mix: 0.3, size: 1.2 }, echo: { beats: 1, fb: 0.4, mix: 0.2 } }, arp: { lp: 1500, verb: { mix: 0.22 } }, pad: { verb: { mix: 0.25, size: 1.3 }, lp: 1000 }, bass: { lp: 300 } },
});

/** Puzzle board: G major, a low kalimba and soft plucks that stay out of the way of thinking. */
T.music_game = () => render({
  seed: 23, bpm: 72, bars: 12,
  chords: [
    ch('G'), ch('D'), ch('E', 'min'), ch('C'),
    ch('G'), ch('D'), ch('E', 'min'), ch('D'),
    ch('C'), ch('G'), ch('C'), ch('D'),
  ],
  melody: {
    inst: 'kalimba', vol: 0.62, scale: [7, 9, 11, 0, 2, 4, 6], range: [55, 74], restProb: 0.35,
    patterns: [
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 2], [2, 1], [3, 1]],
      [[0, 3], [3, 1]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 3, 2, 1, 0, 3],
  },
  arp: { inst: 'pluck', low: 43, vol: 0.1, pattern: [[0, 0], [1, 1], [2, 2], [3, 1]] },
  pad: { vol: 0.05, low: 43, overlap: 1.4 },
  bass: { vol: 0.26, pattern: [[0, 1.8, 'r'], [2, 1.8, '5']] },
  fx: { mel: { lp: 1800, verb: { mix: 0.26 }, echo: { beats: 1, fb: 0.35, mix: 0.18 } }, arp: { lp: 1300, verb: { mix: 0.2 } }, pad: { verb: { mix: 0.2 }, lp: 1000 }, bass: { lp: 300 }, perc: { lp: 500 } },
});

/** Green Forest: F major, a low breathy flute and a soft ukulele. */
T.music_w1 = () => render({
  seed: 31, bpm: 68, bars: 12,
  chords: [
    ch('F'), ch('C'), ch('D', 'min'), ch('Bb'),
    ch('F'), ch('C'), ch('D', 'min'), ch('C'),
    ch('Bb'), ch('F'), ch('Bb'), ch('C'),
  ],
  melody: {
    inst: 'flute', vol: 0.36, scale: [5, 7, 9, 10, 0, 2, 4], range: [57, 77], restProb: 0.2,
    patterns: [
      [[0, 2], [2, 2]],
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 3], [3, 1]],
      [[0, 1], [1, 1], [2, 2]],
    ],
    plan: [0, 1, 0, 2, 0, 1, 3, 2, 3, 1, 0, 2],
  },
  arp: { strum: 3, low: 53, vol: 0.075, pattern: [[0, 0], [2, 0]] },
  pad: { vol: 0.036, low: 46 },
  bass: { vol: 0.24, pattern: [[0, 1.8, 'r'], [2, 1.8, '5']] },
  fx: { mel: { lp: 1900, verb: { mix: 0.3, size: 1.3 } }, arp: { lp: 1400, verb: { mix: 0.2 } }, pad: { verb: { mix: 0.22, size: 1.2 }, lp: 1000 }, bass: { lp: 300 }, perc: { lp: 2500 } },
});

/** Sunny Beach: D major, a low steel pan over soft off-beat strums. */
T.music_w2 = () => render({
  seed: 43, bpm: 78, bars: 12,
  chords: [
    ch('D'), ch('A'), ch('B', 'min'), ch('G'),
    ch('D'), ch('A'), ch('B', 'min'), ch('A'),
    ch('G'), ch('D'), ch('G'), ch('A'),
  ],
  melody: {
    inst: 'steel', vol: 0.44, scale: [2, 4, 6, 7, 9, 11, 1], range: [57, 76], restProb: 0.25,
    patterns: [
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 2], [2, 1], [3, 1]],
      [[0, 4]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 3, 2, 1, 0, 3],
  },
  arp: { strum: 3, low: 50, vol: 0.075, pattern: [[1.5, 0], [3.5, 0]] },
  pad: { vol: 0.03, low: 45 },
  bass: { vol: 0.26, pattern: [[0, 1.4, 'r'], [2, 0.9, '5'], [3, 0.9, 'r']] },
  fx: { mel: { lp: 1900, verb: { mix: 0.24 } }, arp: { lp: 1400, verb: { mix: 0.16 } }, pad: { verb: { mix: 0.2 }, lp: 1000 }, bass: { lp: 300 }, perc: { lp: 900 } },
});

/** Snowy Peaks: A major, a low music box and felt piano over a hushed pad. */
T.music_w3 = () => render({
  seed: 57, bpm: 62, bars: 12,
  chords: [
    ch('A', 'maj7'), ch('F#', 'min7'), ch('D', 'maj7'), ch('E'),
    ch('A', 'maj7'), ch('F#', 'min7'), ch('D', 'maj7'), ch('B', 'min7'),
    ch('D', 'maj7'), ch('E'), ch('A', 'maj7'), ch('E'),
  ],
  melody: {
    inst: 'musicbox', vol: 0.38, scale: [9, 11, 1, 2, 4, 6, 8], range: [57, 80], restProb: 0.28,
    patterns: [
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 2], [2, 1], [3, 1]],
      [[0, 3], [3, 1]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 3, 2, 1, 0, 3],
    double: { inst: 'piano', vol: 0.5, shift: -12 },
  },
  arp: { inst: 'piano', low: 52, vol: 0.09, pattern: [[0, 0], [1, 1], [2, 2], [3, 3]] },
  pad: { vol: 0.056, low: 45, attack: 0.9, release: 1.6, overlap: 1.5 },
  bass: { vol: 0.22, pattern: [[0, 3.6, 'r']] },
  fx: { mel: { lp: 1800, verb: { mix: 0.36, size: 1.5 }, echo: { beats: 1, fb: 0.4, mix: 0.25 } }, arp: { lp: 1400, verb: { mix: 0.3, size: 1.3 } }, pad: { verb: { mix: 0.3, size: 1.5 }, lp: 1000 }, bass: { lp: 280 } },
});

/** Desert Dunes: D Phrygian-dominant, a low plucked oud over a warm pad. */
T.music_w4 = () => render({
  seed: 71, bpm: 72, bars: 12,
  chords: [
    ch('D'), ch('Eb'), ch('D'), ch('C'),
    ch('D'), ch('Eb'), ch('D'), ch('A', 'p5'),
    ch('G', 'min'), ch('Eb'), ch('D'), ch('A', 'p5'),
  ],
  melody: {
    inst: 'oud', vol: 0.66, scale: [2, 3, 6, 7, 9, 10, 0], range: [50, 69], restProb: 0.22,
    patterns: [
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 1], [1, 1], [2, 2]],
      [[0, 2], [2, 1], [3, 1]],
      [[0, 3], [3, 1]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 3, 2, 1, 0, 3],
  },
  arp: { inst: 'kalimba', low: 50, vol: 0.09, pattern: [[1, 1], [3, 2]] },
  pad: { vol: 0.05, low: 43, overlap: 1.4 },
  bass: { vol: 0.26, pattern: [[0, 1.8, 'r'], [2, 1.8, '5']] },
  fx: { mel: { lp: 1800, verb: { mix: 0.22 }, echo: { beats: 1, fb: 0.3, mix: 0.14 } }, arp: { lp: 1300, verb: { mix: 0.2 } }, pad: { verb: { mix: 0.2 }, lp: 1000 }, bass: { lp: 300 }, perc: { lp: 700 } },
});

/** Night Sky: C Lydian, slow low bells drifting over a deep pad. */
T.music_w5 = () => render({
  seed: 89, bpm: 60, bars: 12,
  chords: [
    ch('C', 'maj7'), ch('D'), ch('E', 'min7'), ch('D'),
    ch('C', 'maj7'), ch('D'), ch('E', 'min7'), ch('G'),
    ch('A', 'min7'), ch('D'), ch('C', 'maj7'), ch('G'),
  ],
  melody: {
    inst: 'bell', vol: 0.42, scale: [0, 2, 4, 6, 7, 9, 11], range: [60, 83], restProb: 0.32,
    patterns: [
      [[0, 2], [2, 2]],
      [[0, 1.5], [1.5, 0.5], [2, 2]],
      [[0, 4]],
      [[0, 1], [1, 1], [2, 2]],
    ],
    plan: [0, 1, 0, 3, 0, 1, 2, 3, 2, 1, 0, 3],
    double: { inst: 'piano', vol: 0.4, shift: -12 },
  },
  arp: { inst: 'bell', low: 55, vol: 0.07, pattern: [[0, 0], [1, 1], [2, 2], [3, 1]] },
  pad: { vol: 0.045, low: 43, attack: 1.0, release: 1.8, overlap: 1.6 },
  bass: { vol: 0.22, pattern: [[0, 3.6, 'r']] },
  perc: (b, bar, t0, spb, r) => {
    // a distant, low twinkle now and then
    if (r() < 0.6) inst.bell(b, { start: t0 + Math.floor(r() * 8) * 0.5 * spb, midi: [76, 79, 83, 86][Math.floor(r() * 4)], vol: 0.06, dur: 1.8 });
  },
  fx: { mel: { lp: 1500, verb: { mix: 0.45, size: 1.7, fb: 0.84 }, echo: { beats: 1, fb: 0.5, mix: 0.32 } }, arp: { lp: 1300, verb: { mix: 0.4, size: 1.5 }, echo: { beats: 1.5, fb: 0.5, mix: 0.25 } }, pad: { verb: { mix: 0.35, size: 1.5 }, lp: 1000 }, bass: { lp: 260 }, perc: { lp: 1500 } },
});

module.exports = { T, genMelody, ch };
