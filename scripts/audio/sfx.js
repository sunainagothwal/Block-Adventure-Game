/* ============================================================================
 * SOUND EFFECTS — low, round and quiet.
 *
 * Calm casual games (Monument Valley, Alto's Odyssey, Stardew Valley, Animal
 * Crossing) share a recipe for UI sound: pitches in the low-middle range, soft
 * attacks, wooden / felt / sine timbres, very little above 2 kHz, short tails.
 * Nothing here is bright, sharp or buzzy — it is heard constantly, so it must
 * never be tiring. make-audio.js also low-passes every effect (see SFX_LP).
 * ========================================================================== */

const { midiHz, makeBuf, voice, noise, inst, echo, P } = require('./kit');

const S = {};

/** Soft low-pass cutoff (Hz) per effect; anything not listed uses DEFAULT_LP. */
const DEFAULT_LP = 2200;
const SFX_LP = { tap: 2400, rotate: 2400, tick: 1800, pop: 1800, swipe: 1400, place: 2200, locked: 1200, deny: 1400 };

/** UI tap: a soft, tuned wooden blip — a mallet on a small bamboo bar. */
S.tap = () => {
  const b = makeBuf(0.16);
  inst.marimba(b, { start: 0, midi: 74, dur: 0.14, vol: 0.5 });
  return b;
};

/** Tapping a level on the map: two soft marimba notes, a friendly rise. */
S.select = () => {
  const b = makeBuf(0.6);
  inst.marimba(b, { start: 0, midi: 72, dur: 0.3, vol: 0.42 });
  inst.marimba(b, { start: 0.08, midi: 79, dur: 0.45, vol: 0.42 });
  return b;
};

/** A locked level: a low, soft "mm-mm" — not a buzz. */
S.locked = () => {
  const b = makeBuf(0.45);
  [[0, 233], [0.13, 196]].forEach(([t, f]) => {
    voice(b, { start: t, dur: 0.22, freq: f, vol: 0.55, attack: 0.012, release: 0.12, glide: -0.05, glideTime: 0.08, partials: [[1, 1, 10], [2, 0.18, 18]] });
  });
  return b;
};

/** A level unlocking: a low wooden latch, then a soft rising run of round notes. */
S.unlock = () => {
  const b = makeBuf(1.5);
  voice(b, { start: 0, dur: 0.1, freq: 190, vol: 0.4, attack: 0.002, release: 0.05, glide: 0.5, glideTime: 0.02, partials: [[1, 1, 30]] });
  [60, 64, 67, 72].forEach((m, i) => inst.piano(b, { start: 0.1 + i * 0.11, midi: m, dur: 1.0, vol: 0.3 }));
  echo(b, 0.2, 0.3, 0.25);
  return b;
};

/** A block seating: a soft, tuned wooden "tok" — a felted mallet on a hollow block —
 *  with a tiny warm marimba note that rings for a moment. No thump, no boom. */
S.place = () => {
  const b = makeBuf(0.45);
  // hollow wooden knock: mid pitch, very short, pitch settling a little
  voice(b, { start: 0, dur: 0.09, freq: 430, vol: 0.55, attack: 0.002, release: 0.05, glide: 0.25, glideTime: 0.02, partials: [[1, 1, 45], [2.7, 0.3, 80]] });
  // the felt: a whisper of soft noise for the contact
  noise(b, { start: 0, dur: 0.02, vol: 0.09, attack: 0.002, lp: 0.3, decay: 150, seed: 3 });
  // a warm tuned ring so it feels rewarding
  inst.marimba(b, { start: 0.005, midi: 67, dur: 0.35, vol: 0.4 });
  return b;
};

/** A tap on a tray block: a single soft marimba "tick". */
S.rotate = () => {
  const b = makeBuf(0.2);
  inst.marimba(b, { start: 0, midi: 76, dur: 0.16, vol: 0.45 });
  return b;
};

/** A refused drop: two low, soft, falling notes. */
S.deny = () => {
  const b = makeBuf(0.5);
  [[0, 262], [0.13, 220]].forEach(([t, f]) => {
    voice(b, { start: t, dur: 0.26, freq: f, vol: 0.5, attack: 0.012, release: 0.14, partials: [[1, 1, 8], [2, 0.2, 14]] });
  });
  return b;
};

/** A line clear: a soft breath, a deep round boom and a few low bell tones. */
S.blast = () => {
  const b = makeBuf(0.95);
  noise(b, { start: 0, dur: 0.55, vol: 0.2, attack: 0.04, release: 0.32, decay: 4, lp: 0.08, hp: 0.03, seed: 7 });
  voice(b, { start: 0, dur: 0.5, freq: 58, vol: 0.7, attack: 0.008, release: 0.25, glide: 1.6, glideTime: 0.09, partials: [[1, 1, 5]] });
  [67, 72, 76, 79].forEach((m, i) => inst.piano(b, { start: 0.06 + i * 0.07, midi: m, dur: 0.7, vol: 0.22 }));
  return b;
};

/** A combo: a slow rising run of round notes with a soft echo. */
S.combo = () => {
  const b = makeBuf(1.3);
  [60, 64, 67, 72, 76].forEach((m, i) => inst.piano(b, { start: i * 0.09, midi: m, dur: 0.8, vol: 0.28 }));
  echo(b, 0.18, 0.35, 0.28);
  return b;
};

/** A power-up firing: a soft, low rising swell that opens into a warm note. */
S.power = () => {
  const b = makeBuf(0.8);
  voice(b, { start: 0, dur: 0.4, freq: 140, vol: 0.4, attack: 0.05, release: 0.18, glide: 1.4, glideTime: 0.25, partials: [[1, 1, 0], [2, 0.25, 0]] });
  noise(b, { start: 0, dur: 0.34, vol: 0.05, attack: 0.08, release: 0.16, lp: 0.09, hp: 0.03, seed: 11 });
  inst.piano(b, { start: 0.3, midi: 72, dur: 0.5, vol: 0.34 });
  return b;
};

/** A coin: a soft two-note "plink" in the low-mid range. */
S.coin = () => {
  const b = makeBuf(0.7);
  inst.piano(b, { start: 0, midi: 67, dur: 0.25, vol: 0.34 });
  inst.piano(b, { start: 0.09, midi: 74, dur: 0.55, vol: 0.36 });
  return b;
};

/** The three stars of a rating: each a little higher than the last. */
const starNote = (midi) => () => {
  const b = makeBuf(0.9);
  inst.piano(b, { start: 0, midi, dur: 0.8, vol: 0.4 });
  inst.bell(b, { start: 0, midi: midi + 12, dur: 0.6, vol: 0.07, kind: 'musicbox' });
  return b;
};
S.star = starNote(67);
S.star2 = starNote(71);
S.star3 = starNote(74);

/** A win: a slow, warm rising arpeggio that lands on a soft held chord. */
S.win = () => {
  const b = makeBuf(2.3);
  [[60, 0], [64, 0.14], [67, 0.28], [72, 0.42]].forEach(([m, t]) => inst.piano(b, { start: t, midi: m, dur: 1.0, vol: 0.32 }));
  [48, 55, 60, 64, 67].forEach((m) => {
    voice(b, { start: 0.55, dur: 1.65, freq: midiHz(m), vol: 0.08, attack: 0.08, release: 1.0, partials: P.pad });
  });
  [76, 79].forEach((m, i) => inst.piano(b, { start: 0.62 + i * 0.12, midi: m, dur: 1.0, vol: 0.2 }));
  echo(b, 0.22, 0.3, 0.26);
  return b;
};

/** A loss: a slow, gentle descending phrase. Sad, never punishing. */
S.lose = () => {
  const b = makeBuf(1.8);
  [[62, 0], [60, 0.3], [59, 0.6], [55, 0.95]].forEach(([m, t], i) => {
    inst.piano(b, { start: t, midi: m, dur: i === 3 ? 0.8 : 0.5, vol: 0.34 });
    voice(b, { start: t, dur: 0.6, freq: midiHz(m - 12), vol: 0.12, attack: 0.02, release: 0.35, partials: [[1, 1, 4]] });
  });
  return b;
};

/** A reward claim: a soft rising run into a warm, ringing chord. */
S.reward = () => {
  const b = makeBuf(2.1);
  [60, 64, 67, 71, 74, 79].forEach((m, i) => inst.piano(b, { start: i * 0.075, midi: m, dur: 0.8, vol: 0.24 }));
  [67, 72, 76, 79].forEach((m) => inst.piano(b, { start: 0.5, midi: m, dur: 1.5, vol: 0.2 }));
  inst.piano(b, { start: 0.5, midi: 48, dur: 1.4, vol: 0.28 });
  echo(b, 0.2, 0.35, 0.28);
  return b;
};

/** Switching tab or world: a soft, low, airy swish. */
S.swipe = () => {
  const b = makeBuf(0.34);
  noise(b, { start: 0, dur: 0.28, vol: 0.2, attack: 0.09, release: 0.16, lp: 0.09, hp: 0.03, seed: 21 });
  voice(b, { start: 0.02, dur: 0.22, freq: 196, vol: 0.14, attack: 0.07, release: 0.14, glide: 0.35, glideTime: 0.14, partials: [[1, 1, 0]] });
  return b;
};

/** A card opening: a soft bubble that lifts a little. */
S.pop = () => {
  const b = makeBuf(0.24);
  voice(b, { start: 0, dur: 0.16, freq: 330, vol: 0.5, attack: 0.008, release: 0.09, glide: 0.35, glideTime: 0.06, partials: [[1, 1, 20], [2, 0.12, 40]] });
  return b;
};

/** A level starting: three slow rising notes — "ready, set, go". */
S.start = () => {
  const b = makeBuf(1.0);
  [[55, 0], [60, 0.12], [67, 0.24]].forEach(([m, t]) => inst.piano(b, { start: t, midi: m, dur: 0.7, vol: 0.34 }));
  return b;
};

/** A slider notch: the tiniest, softest tick. */
S.tick = () => {
  const b = makeBuf(0.06);
  voice(b, { start: 0, dur: 0.05, freq: 640, vol: 0.4, attack: 0.003, release: 0.03, partials: [[1, 1, 60]] });
  return b;
};

module.exports = { S, SFX_LP, DEFAULT_LP };
