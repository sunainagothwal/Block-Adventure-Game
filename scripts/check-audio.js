/* Structural checks on the generated audio. This cannot tell you whether it
 * sounds GOOD — only whether it is well-formed, at a sane level, free of clicks,
 * not harsh, and, for the music, seamlessly loopable. Run: node scripts/check-audio.js */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'audio');
const ONE_SHOTS = [
  'tap', 'select', 'locked', 'unlock', 'place', 'rotate', 'deny', 'blast', 'combo', 'power',
  'coin', 'star', 'star2', 'star3', 'win', 'lose', 'reward', 'swipe', 'pop', 'start', 'tick',
];
const LOOPS = ['music_menu', 'music_game', 'music_w1', 'music_w2', 'music_w3', 'music_w4', 'music_w5'];
const BARS = 12;

let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${extra}`); }
};

function read(name) {
  const buf = fs.readFileSync(path.join(DIR, `${name}.wav`));
  const ok = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
  const fmt = {
    format: buf.readUInt16LE(20), channels: buf.readUInt16LE(22),
    rate: buf.readUInt32LE(24), bits: buf.readUInt16LE(34),
  };
  const dataLen = buf.readUInt32LE(40);
  const n = dataLen / 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return { ok, fmt, s, dataLen, fileLen: buf.length, rate: fmt.rate };
}

const stats = (s) => {
  let peak = 0; let sum = 0;
  for (const v of s) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  return { peak, rms: Math.sqrt(sum / s.length) };
};
/** Largest jump between neighbouring samples — a click shows up as a spike. */
const maxStep = (s, from = 1, to = s.length) => {
  let m = 0;
  for (let i = Math.max(1, from); i < to; i++) m = Math.max(m, Math.abs(s[i] - s[i - 1]));
  return m;
};

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k; const b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci; const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Spectral centroid (Hz) and the share of energy above 5 kHz, over many frames. */
function brightness(w) {
  const N = 2048;
  let num = 0; let den = 0; let hi = 0;
  for (let at = 0; at + N <= w.s.length; at += N * 4) {
    const re = new Float64Array(N); const im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = w.s[at + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      const f = (k * w.rate) / N;
      num += p * f; den += p;
      if (f > 5000) hi += p;
    }
  }
  return { centroid: num / Math.max(den, 1e-12), highShare: hi / Math.max(den, 1e-12) };
}

console.log('one-shots');
for (const name of ONE_SHOTS) {
  const w = read(name);
  const { peak, rms } = stats(w.s);
  const secs = w.s.length / w.rate;
  check(`${name}: valid RIFF/WAVE`, w.ok);
  check(`${name}: 16-bit mono PCM`, w.fmt.format === 1 && w.fmt.channels === 1 && w.fmt.bits === 16);
  check(`${name}: header length matches file`, w.fileLen === 44 + w.dataLen);
  check(`${name}: not silent`, rms > 0.02, `rms ${rms.toFixed(4)}`);
  check(`${name}: does not clip`, peak <= 0.99, `peak ${peak.toFixed(3)}`);
  check(`${name}: loud enough`, peak >= 0.4, `peak ${peak.toFixed(3)}`);
  check(`${name}: short enough to stay snappy`, secs <= 2.3, `${secs.toFixed(2)}s`);
  check(`${name}: starts near zero`, Math.abs(w.s[0]) < 0.02, `${w.s[0].toFixed(4)}`);
  check(`${name}: ends near zero`, Math.abs(w.s[w.s.length - 1]) < 0.02, `${w.s[w.s.length - 1].toFixed(4)}`);
  const tail = stats(w.s.slice(Math.floor(w.s.length * 0.97)));
  check(`${name}: tail has decayed`, tail.rms < 0.05, `tail rms ${tail.rms.toFixed(4)}`);
  // "soft": not shrill. A tick or a pop may be bright; nothing should be a hiss.
  const br = brightness(w);
  check(`${name}: not shrill`, br.highShare < 0.02, `${(br.highShare * 100).toFixed(1)}% of energy above 5 kHz`);
  // low and calm: every effect sits in the low-middle range
  check(`${name}: low-pitched and soft`, br.centroid < 1100, `centroid ${br.centroid.toFixed(0)} Hz`);
  if (process.env.AUDIO_VERBOSE) console.log(`   ${name}: centroid ${br.centroid.toFixed(0)} Hz`);
}

console.log('music loops');
for (const name of LOOPS) {
  const w = read(name);
  const { peak, rms } = stats(w.s);
  const secs = w.s.length / w.rate;
  check(`${name}: valid RIFF/WAVE`, w.ok);
  check(`${name}: 16-bit mono PCM`, w.fmt.format === 1 && w.fmt.channels === 1 && w.fmt.bits === 16);
  check(`${name}: long enough to avoid obvious repetition`, secs >= 24, `${secs.toFixed(1)}s`);
  check(`${name}: audible`, rms > 0.05, `rms ${rms.toFixed(4)}`);
  check(`${name}: does not clip`, peak <= 0.99, `peak ${peak.toFixed(3)}`);
  check(`${name}: has dynamics, not a wall of sound`, peak / rms > 2.2, `crest ${(peak / rms).toFixed(2)}`);

  // Relaxing = warm. A low spectral centroid and little energy above 5 kHz.
  const br = brightness(w);
  check(`${name}: warm, low and calm`, br.centroid < 700, `centroid ${br.centroid.toFixed(0)} Hz`);
  check(`${name}: little energy above 5 kHz`, br.highShare < 0.04, `${(br.highShare * 100).toFixed(1)}%`);

  // Seam: the step from the last sample to the first must look like any other
  // step inside the track. A discontinuity there would be a click every loop.
  const interior = maxStep(w.s, 2, w.s.length - 2);
  const seam = Math.abs(w.s[0] - w.s[w.s.length - 1]);
  check(`${name}: loop seam is not a click`, seam <= Math.max(0.05, interior * 0.6),
    `seam ${seam.toFixed(4)} vs interior max ${interior.toFixed(4)}`);

  // Level across every bar line, seam included. The seam is simply bar N = bar 0
  // and must be indistinguishable from any other bar line; no bar line may dip
  // hard (a pad fading to nothing at every bar makes the track pulse).
  const win = Math.round(w.rate * 0.25);
  const barLen = w.s.length / BARS;
  const across = [];
  for (let k = 1; k <= BARS; k++) {
    const at = Math.round(k * barLen) % w.s.length;
    const beforeSlice = at === 0 ? w.s.slice(w.s.length - win) : w.s.slice(at - win, at);
    const before = stats(beforeSlice).rms;
    const after = stats(w.s.slice(at, at + win)).rms;
    across.push({ k, before, after, ratio: Math.max(before, after) / Math.max(1e-6, Math.min(before, after)) });
  }
  const interiorRatios = across.slice(0, BARS - 1).map((x) => x.ratio);
  const seamRatio = across[BARS - 1].ratio;
  const fmtR = (list) => list.map((r) => r.toFixed(1)).join(' ');
  // A dip is the bass/pad falling away at a bar line, so measure the QUIETER side
  // of every bar line against the whole track. (Comparing before/after would
  // flag a normal downbeat accent, where a soft tail meets a fresh onset.)
  const quietest = Math.min(...across.map((x) => Math.min(x.before, x.after)));
  check(`${name}: no bar line dips hard`, quietest > rms * 0.3,
    `quietest bar line ${(quietest / rms).toFixed(2)}x the track level`);
  check(`${name}: seam is as smooth as a bar line`, seamRatio <= Math.max(...interiorRatios) * 1.25,
    `seam ${seamRatio.toFixed(1)} vs bar lines ${fmtR(interiorRatios)}`);
  check(`${name}: the seam is not a silent gap`, across[BARS - 1].before > 0.02 && across[BARS - 1].after > 0.02);
  console.log(`   ${name}: ${secs.toFixed(1)}s  centroid ${br.centroid.toFixed(0)} Hz  >5k ${(br.highShare * 100).toFixed(1)}%  seam ${seamRatio.toFixed(1)} vs bar lines ${fmtR(interiorRatios)}`);

  // Steady pulse: successive bars should carry similar weight.
  const bl = Math.floor(w.s.length / BARS);
  const barRms = Array.from({ length: BARS }, (_, i) => stats(w.s.slice(i * bl, (i + 1) * bl)).rms);
  check(`${name}: bars are evenly weighted`, Math.max(...barRms) / Math.min(...barRms) < 1.9,
    `${barRms.map((r) => r.toFixed(2)).join(' ')}`);
}

console.log('distinctness');
{
  const sigs = [...ONE_SHOTS, ...LOOPS].map((n) => {
    const w = read(n);
    const chunk = w.s.slice(0, Math.min(w.s.length, 4000));
    return { n, sum: chunk.reduce((a, v) => a + Math.abs(v), 0), len: w.s.length };
  });
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const same = sigs[i].len === sigs[j].len && Math.abs(sigs[i].sum - sigs[j].sum) < 1e-6;
      check(`${sigs[i].n} differs from ${sigs[j].n}`, !same);
    }
  }
  const s = [read('star'), read('star2'), read('star3')];
  check('the three star notes are different sounds', new Set(s.map((x) => x.dataLen)).size >= 1 &&
    s[0].s.some((v, i) => Math.abs(v - s[1].s[i]) > 1e-3) && s[1].s.some((v, i) => Math.abs(v - s[2].s[i]) > 1e-3));
  check('win is longer and fuller than a tap', read('win').s.length > read('tap').s.length * 10);
  check('win and lose differ in length', read('win').s.length !== read('lose').s.length);
}

const total = [...ONE_SHOTS, ...LOOPS].reduce((n, x) => n + fs.statSync(path.join(DIR, `${x}.wav`)).size, 0);
console.log(`\n${ONE_SHOTS.length + LOOPS.length} files, ${(total / 1024 / 1024).toFixed(2)} MB total`);
check('the whole set stays reasonable', total < 12 * 1024 * 1024, `${(total / 1024 / 1024).toFixed(2)} MB`);

console.log(failures === 0 ? '\nALL AUDIO CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
