/* ============================================================================
 * BLOCK ADVENTURE — audio synthesizer.
 *
 * Every sound in the game is generated from code: additive synthesis, noise and
 * a small reverb. Nothing is sampled or downloaded, so there is no third-party
 * licence to worry about — the audio is original, royalty-free and reproducible.
 *
 *   node scripts/make-audio.js
 *
 * writes assets/audio/*.wav (mono, 16-bit; effects 22.05 kHz, music 11.025 kHz):
 *
 *   scripts/audio/kit.js     oscillators, instruments, filters, reverb
 *   scripts/audio/sfx.js     low, soft effects for taps, blocks, rewards, stars, wins
 *   scripts/audio/music.js   seven calm, low-pitched loops: menu, game and one per world
 *
 * Music loops use wrap-around mixing and a circular reverb, so each one repeats
 * with no gap, click or clipped tail at its seam.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { SR, fadeEnds, normalise, writeWav, lowpass } = require('./audio/kit');
const { S, SFX_LP, DEFAULT_LP } = require('./audio/sfx');
const { T } = require('./audio/music');

const OUT = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv[2];
const report = [];

for (const [name, make] of Object.entries(S)) {
  if (only && only !== name) continue;
  const buf = make();
  lowpass(buf, SFX_LP[name] ?? DEFAULT_LP);   // nothing bright: calm games keep UI sound warm
  fadeEnds(buf, 3);
  normalise(buf, name === 'tap' || name === 'tick' ? 0.55 : 0.85);
  const bytes = writeWav(OUT, name, buf);
  report.push({ name, secs: buf.data.length / SR, bytes });
}

for (const [name, make] of Object.entries(T)) {
  if (only && only !== name) continue;
  const t0 = Date.now();
  const { buf, bars, bpm } = make();
  // NO fade on music: the loop must stay continuous across the seam.
  const bytes = writeWav(OUT, name, buf, { half: true });   // 11 kHz: the loops hold nothing above ~4 kHz
  report.push({ name, secs: buf.data.length / SR, bytes, note: `${bars} bars @ ${bpm} bpm, ${((Date.now() - t0) / 1000).toFixed(1)}s to render` });
}

let total = 0;
for (const r of report) {
  total += r.bytes;
  console.log(`  ${r.name.padEnd(12)} ${r.secs.toFixed(2).padStart(6)}s  ${(r.bytes / 1024).toFixed(0).padStart(5)} KB  ${r.note ?? ''}`);
}
console.log(`\n${report.length} files, ${(total / 1024 / 1024).toFixed(2)} MB -> ${OUT}`);
