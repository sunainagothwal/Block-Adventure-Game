/* ============================================================================
 * Synth kit — oscillators, instruments, filters and a circular reverb.
 *
 * Everything is rendered offline into Float32 buffers (mono, 22.05 kHz).
 * Buffers created with `wrap: true` fold any note tail that runs past the end
 * back onto the start, and the reverb / filters run circularly, so a music
 * loop has no gap, click or dropped release at its seam.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

const SR = 22050;
const TAU = Math.PI * 2;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBuf(seconds, wrap = false) {
  // loops get an even length so they can be halved to 11 kHz without moving the seam
  const n = wrap ? Math.round(seconds * SR / 2) * 2 : Math.round(seconds * SR);
  return { data: new Float32Array(n), wrap };
}

/* ---------- partial-based voice ---------------------------------------------
 * A note is a sum of sine partials, each with its own exponential decay. That
 * one shape covers marimba, bells, plucks, pads and basses just by changing the
 * partial table, and it is always exactly in tune.                            */

function voice(buf, o) {
  const {
    start, dur, freq, vol = 0.3, attack = 0.004, release = 0.05,
    partials = [[1, 1, 0]], vibrato = 0, vibRate = 5.2, vibDelay = 0,
    tremolo = 0, tremRate = 6, glide = 0, glideTime = 0.03, pan = 0,
  } = o;
  const n = Math.round(dur * SR);
  const s0 = Math.round(start * SR);
  const len = buf.data.length;
  for (const [ratio, amp, decay] of partials) {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let f = freq * ratio;
      if (vibrato && t > vibDelay) f *= 1 + vibrato * Math.min(1, (t - vibDelay) / 0.3) * Math.sin(TAU * vibRate * t);
      if (glide) f *= 1 + glide * Math.exp(-t / glideTime);
      ph += f / SR;
      let g = amp * Math.sin(TAU * ph);
      if (decay) g *= Math.exp(-t * decay);
      if (t < attack) g *= t / attack;
      const rel = dur - t;
      if (rel < release) g *= Math.max(0, rel / release);
      if (tremolo) g *= 1 - tremolo + tremolo * Math.sin(TAU * tremRate * t);
      const idx = s0 + i;
      const v = g * vol;
      if (idx < len) buf.data[idx] += v;
      else if (buf.wrap) buf.data[idx % len] += v;
    }
  }
}

/** Shaped noise. `hp` > 0 removes low end (hats, shakers); `lp` softens it. */
function noise(buf, { start, dur, vol = 0.2, attack = 0.002, release = 0.02, decay = 0, lp = 1, hp = 0, seed = 1 }) {
  const r = rng(seed);
  const n = Math.round(dur * SR);
  const s0 = Math.round(start * SR);
  const len = buf.data.length;
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    a += lp * ((r() * 2 - 1) - a);
    b += hp * (a - b);
    const x = hp > 0 ? a - b : a;
    let g = 1;
    if (decay) g *= Math.exp(-t * decay);
    if (t < attack) g *= t / attack;
    const rel = dur - t;
    if (rel < release) g *= Math.max(0, rel / release);
    const idx = s0 + i;
    const v = x * g * vol;
    if (idx < len) buf.data[idx] += v;
    else if (buf.wrap) buf.data[idx % len] += v;
  }
}

/* ---------- instruments ------------------------------------------------------ */

const P = {
  marimba: [[1, 1, 5], [3.99, 0.36, 15], [9.9, 0.1, 30]],
  bell: [[1, 1, 3.2], [2.76, 0.24, 6], [5.4, 0.09, 10], [8.93, 0.04, 15]],
  celesta: [[1, 1, 3.6], [2.01, 0.22, 6], [3, 0.1, 9], [4.02, 0.06, 13]],
  musicbox: [[1, 1, 4.4], [3, 0.3, 8], [6.02, 0.12, 14], [9, 0.05, 20]],
  kalimba: [[1, 1, 6], [5.4, 0.3, 20], [8.1, 0.08, 30]],
  steel: [[1, 1, 2.8], [2, 0.75, 3.6], [3, 0.3, 5.5], [4.01, 0.14, 9]],
  pad: [[1, 1, 0], [2, 0.28, 0], [3, 0.08, 0]],
  bass: [[1, 1, 2.6], [2, 0.32, 5], [3, 0.08, 9]],
  flute: [[1, 1, 0.5], [2, 0.16, 0.8], [3, 0.05, 1.2]],
  felt: [[1, 1, 1.9], [2, 0.42, 3.4], [3, 0.14, 5.5], [4, 0.05, 8]],
};

/** Plucked string: harmonics fall off with order and die faster the higher they are. */
function pluckPartials(pick = 0.16, bright = 1) {
  const out = [];
  for (let k = 1; k <= 9; k++) {
    const amp = (1 / Math.pow(k, 1.15)) * Math.abs(Math.sin(k * Math.PI * pick)) * (k === 1 ? 1 : bright);
    out.push([k * (1 + 0.0004 * k * k), Math.max(0.03, amp), 2.4 + k * 1.1]);
  }
  return out;
}
const PLUCK = pluckPartials(0.16, 1);
const PLUCK_SOFT = pluckPartials(0.22, 0.55);
const OUD = pluckPartials(0.11, 1.5);

const decayScale = (partials, freq, k = 0.5) => {
  const s = Math.pow(Math.max(0.25, freq / 440), k);
  return partials.map(([r, a, d]) => [r, a, d * s]);
};

const inst = {
  marimba(buf, { start, midi, dur = 1.4, vol = 0.3 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.002, release: 0.08, partials: decayScale(P.marimba, f, 0.6) });
    noise(buf, { start, dur: 0.012, vol: vol * 0.25, lp: 0.35, decay: 200, seed: midi });
  },
  /** Felt piano: round, mellow, low-passed by nature — the calm workhorse. */
  piano(buf, { start, midi, dur = 1.8, vol = 0.28 }) {
    const f = midiHz(midi);
    const part = decayScale(P.felt, f, 0.5);
    voice(buf, { start, dur, freq: f, vol, attack: 0.004, release: 0.25, partials: part });
    voice(buf, { start, dur, freq: f * 1.0018, vol: vol * 0.4, attack: 0.004, release: 0.25, partials: part });
    noise(buf, { start, dur: 0.03, vol: vol * 0.12, lp: 0.12, decay: 120, seed: midi + 5 });
  },
  bell(buf, { start, midi, dur = 1.6, vol = 0.22, kind = 'bell' }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.002, release: 0.3, partials: decayScale(P[kind], f, 0.35) });
  },
  kalimba(buf, { start, midi, dur = 1.0, vol = 0.28 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.002, release: 0.1, partials: decayScale(P.kalimba, f, 0.5) });
    noise(buf, { start, dur: 0.01, vol: vol * 0.3, lp: 0.5, decay: 250, seed: midi + 3 });
  },
  pluck(buf, { start, midi, dur = 1.1, vol = 0.2, soft = false, detune = 0.0009 }) {
    const f = midiHz(midi);
    const part = decayScale(soft ? PLUCK_SOFT : PLUCK, f, 0.4);
    voice(buf, { start, dur, freq: f, vol, attack: 0.002, release: 0.1, partials: part });
    voice(buf, { start, dur, freq: f * (1 + detune), vol: vol * 0.5, attack: 0.002, release: 0.1, partials: part });
  },
  oud(buf, { start, midi, dur = 0.9, vol = 0.24 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.002, release: 0.08, glide: 0.018, glideTime: 0.025, partials: decayScale(OUD, f, 0.4) });
    noise(buf, { start, dur: 0.02, vol: vol * 0.25, lp: 0.5, hp: 0.3, decay: 160, seed: midi + 9 });
  },
  steel(buf, { start, midi, dur = 0.9, vol = 0.26 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.004, release: 0.1, tremolo: 0.14, tremRate: 6.5, partials: decayScale(P.steel, f, 0.4) });
  },
  flute(buf, { start, midi, dur = 0.8, vol = 0.2, seed = 1 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack: 0.07, release: Math.min(0.16, dur * 0.4), vibrato: 0.006, vibDelay: 0.16, partials: P.flute });
    noise(buf, { start, dur, vol: vol * 0.09, attack: 0.06, release: 0.1, lp: 0.28, hp: 0.12, seed });
  },
  pad(buf, { start, midi, dur, vol = 0.08, attack = 0.5, release = 1.2 }) {
    const f = midiHz(midi);
    voice(buf, { start, dur, freq: f, vol, attack, release, vibrato: 0.002, vibRate: 3.8, partials: P.pad });
    voice(buf, { start, dur, freq: f * 1.0035, vol: vol * 0.8, attack, release, partials: P.pad });
  },
  bass(buf, { start, midi, dur = 0.7, vol = 0.32 }) {
    voice(buf, { start, dur, freq: midiHz(midi), vol, attack: 0.008, release: 0.12, partials: P.bass });
  },

  /* percussion — all deliberately soft */
  kick(buf, { start, vol = 0.3 }) {
    voice(buf, { start, dur: 0.24, freq: 52, vol, attack: 0.002, release: 0.08, glide: 1.9, glideTime: 0.04, partials: [[1, 1, 11]] });
  },
  shaker(buf, { start, vol = 0.05, len = 0.05, seed = 1 }) {
    noise(buf, { start, dur: len + 0.03, vol, attack: 0.012, release: 0.03, decay: 45, lp: 0.95, hp: 0.35, seed });
  },
  rim(buf, { start, vol = 0.07 }) {
    voice(buf, { start, dur: 0.07, freq: 1650, vol, attack: 0.001, release: 0.02, partials: [[1, 1, 70], [1.51, 0.5, 90]] });
  },
  conga(buf, { start, vol = 0.14, high = false }) {
    voice(buf, { start, dur: 0.22, freq: high ? 310 : 210, vol, attack: 0.002, release: 0.05, glide: 0.25, glideTime: 0.03, partials: [[1, 1, 16], [1.6, 0.25, 30]] });
  },
  doum(buf, { start, vol = 0.22 }) {
    voice(buf, { start, dur: 0.3, freq: 95, vol, attack: 0.002, release: 0.08, glide: 0.9, glideTime: 0.05, partials: [[1, 1, 9], [2.1, 0.2, 18]] });
  },
  tek(buf, { start, vol = 0.09, seed = 3 }) {
    noise(buf, { start, dur: 0.06, vol, attack: 0.001, release: 0.02, decay: 55, lp: 0.9, hp: 0.4, seed });
    voice(buf, { start, dur: 0.06, freq: 1180, vol: vol * 0.6, attack: 0.001, release: 0.02, partials: [[1, 1, 60]] });
  },
  jingle(buf, { start, vol = 0.05, seed = 1 }) {
    const r = rng(seed);
    for (let k = 0; k < 4; k++) {
      const f = 3100 + r() * 1900;
      voice(buf, { start: start + k * 0.013, dur: 0.35, freq: f, vol: vol * (1 - k * 0.15), attack: 0.001, release: 0.1, partials: [[1, 1, 12], [1.47, 0.4, 18]] });
    }
  },
};

/* ---------- filters + reverb -------------------------------------------------- */

/** One-pole low-pass, run circularly so a looping buffer stays seamless. */
function lowpass(buf, fc) {
  const a = 1 - Math.exp(-TAU * fc / SR);
  const d = buf.data;
  const n = d.length;
  let y = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      y += a * (d[i] - y);
      if (pass === 1) d[i] = y;
    }
  }
}

/** Schroeder–Moorer reverb, run twice around the loop so the tail wraps. */
function reverb(buf, { mix = 0.25, size = 1, damp = 0.35, fb = 0.8 } = {}) {
  const src = buf.data;
  const n = src.length;
  const scale = SR / 44100 * size;
  const combs = [1116, 1188, 1277, 1356, 1422].map((d) => ({ line: new Float32Array(Math.round(d * scale)), i: 0, lp: 0 }));
  const aps = [556, 441, 341].map((d) => ({ line: new Float32Array(Math.round(d * scale)), i: 0 }));
  const wet = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < n; k++) {
      const x = src[k] * 0.3;
      let y = 0;
      for (const c of combs) {
        const o = c.line[c.i];
        c.lp += (1 - damp) * (o - c.lp);
        c.line[c.i] = x + c.lp * fb;
        c.i = (c.i + 1) % c.line.length;
        y += o;
      }
      for (const a of aps) {
        const o = a.line[a.i];
        const inp = y;
        y = o - inp * 0.5;
        a.line[a.i] = inp + o * 0.5;
        a.i = (a.i + 1) % a.line.length;
      }
      if (pass === 1) wet[k] = y;
    }
  }
  for (let i = 0; i < n; i++) src[i] += wet[i] * mix;
}

/** A feedback echo (non-circular — used for one-shots). */
function echo(buf, delaySec, feedback, mix) {
  const d = Math.round(delaySec * SR);
  const src = Float32Array.from(buf.data);
  for (let i = d; i < buf.data.length; i++) {
    buf.data[i] += src[i - d] * mix;
    src[i] += src[i - d] * feedback;
  }
}

/** Circular echo for loops. */
function echoLoop(buf, delaySec, feedback, mix, taps = 5) {
  const d = Math.round(delaySec * SR);
  const n = buf.data.length;
  const src = Float32Array.from(buf.data);
  for (let k = 1; k <= taps; k++) {
    const g = mix * Math.pow(feedback, k - 1);
    const off = (k * d) % n;
    for (let i = 0; i < n; i++) buf.data[i] += src[(i - off + n) % n] * g;
  }
}

/* ---------- output ------------------------------------------------------------ */

function normalise(buf, peak) {
  let max = 0;
  for (const v of buf.data) max = Math.max(max, Math.abs(v));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < buf.data.length; i++) buf.data[i] *= k;
}

function fadeEnds(buf, ms = 4) {
  const n = Math.round((ms / 1000) * SR);
  for (let i = 0; i < n && i < buf.data.length; i++) {
    const g = i / n;
    buf.data[i] *= g;
    buf.data[buf.data.length - 1 - i] *= g;
  }
}

/** Gentle saturation: rounds off peaks instead of hard-clipping them. */
function softClip(buf, drive = 1.2) {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < buf.data.length; i++) buf.data[i] = Math.tanh(buf.data[i] * drive) * k;
}

/** `half` averages neighbouring samples (11 kHz) — for warm, already low-passed music. */
function writeWav(dir, name, buf, { half = false } = {}) {
  let data = buf.data;
  let rate = SR;
  if (half) {
    const m = data.length >> 1;
    const d2 = new Float32Array(m);
    for (let i = 0; i < m; i++) d2[i] = (data[2 * i] + data[2 * i + 1]) * 0.5;
    data = d2;
    rate = SR / 2;
  }
  const n = data.length;
  const out = Buffer.alloc(44 + n * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * 2, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(dir, `${name}.wav`), out);
  return out.length;
}

module.exports = {
  SR, TAU, midiHz, rng, makeBuf, voice, noise, inst, P,
  lowpass, reverb, echo, echoLoop, normalise, fadeEnds, softClip, writeWav,
};
