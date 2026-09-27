/* ============================================================================
 * AUDIO ENGINE
 *
 * Effects are pre-loaded, each with a small pool of voices so a rapid repeat
 * (tap, tap, tap) restarts cleanly instead of being swallowed. Music is one
 * looping track per screen or world; only one is audible at a time and they
 * CROSSFADE, so moving between worlds never cuts the tune off mid-note.
 *
 * Music and effects have independent volumes (0..1, shaped by a perceptual
 * curve so the middle of a slider sounds like the middle) and independent
 * on/off switches. Everything is wrapped in try/catch: a device that cannot
 * play a sound must cost the player a sound, never a crash.
 * ========================================================================== */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SfxName =
  | 'tap' | 'select' | 'locked' | 'unlock' | 'place' | 'rotate' | 'deny' | 'blast'
  | 'combo' | 'power' | 'coin' | 'star' | 'star2' | 'star3' | 'win' | 'lose'
  | 'reward' | 'swipe' | 'pop' | 'start' | 'tick';

export type MusicName = 'menu' | 'game' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5';

const SFX_FILES: Record<SfxName, number> = {
  tap: require('../../assets/audio/tap.wav'),
  select: require('../../assets/audio/select.wav'),
  locked: require('../../assets/audio/locked.wav'),
  unlock: require('../../assets/audio/unlock.wav'),
  place: require('../../assets/audio/place.wav'),
  rotate: require('../../assets/audio/rotate.wav'),
  deny: require('../../assets/audio/deny.wav'),
  blast: require('../../assets/audio/blast.wav'),
  combo: require('../../assets/audio/combo.wav'),
  power: require('../../assets/audio/power.wav'),
  coin: require('../../assets/audio/coin.wav'),
  star: require('../../assets/audio/star.wav'),
  star2: require('../../assets/audio/star2.wav'),
  star3: require('../../assets/audio/star3.wav'),
  win: require('../../assets/audio/win.wav'),
  lose: require('../../assets/audio/lose.wav'),
  reward: require('../../assets/audio/reward.wav'),
  swipe: require('../../assets/audio/swipe.wav'),
  pop: require('../../assets/audio/pop.wav'),
  start: require('../../assets/audio/start.wav'),
  tick: require('../../assets/audio/tick.wav'),
};

const MUSIC_FILES: Record<MusicName, number> = {
  menu: require('../../assets/audio/music_menu.wav'),
  game: require('../../assets/audio/music_game.wav'),
  w1: require('../../assets/audio/music_w1.wav'),
  w2: require('../../assets/audio/music_w2.wav'),
  w3: require('../../assets/audio/music_w3.wav'),
  w4: require('../../assets/audio/music_w4.wav'),
  w5: require('../../assets/audio/music_w5.wav'),
};

/** Per-effect loudness, how many overlapping copies it may have, and whether to load it up front. */
const SFX_MIX: Record<SfxName, { vol: number; voices: number; warm: boolean }> = {
  tap: { vol: 0.6, voices: 2, warm: true },
  select: { vol: 0.8, voices: 2, warm: true },
  locked: { vol: 0.7, voices: 1, warm: true },
  unlock: { vol: 0.8, voices: 1, warm: false },
  place: { vol: 0.9, voices: 2, warm: true },
  rotate: { vol: 0.7, voices: 2, warm: true },
  deny: { vol: 0.7, voices: 1, warm: true },
  blast: { vol: 0.95, voices: 2, warm: true },
  combo: { vol: 0.8, voices: 1, warm: true },
  power: { vol: 0.85, voices: 1, warm: true },
  coin: { vol: 0.8, voices: 2, warm: true },
  star: { vol: 0.8, voices: 1, warm: true },
  star2: { vol: 0.8, voices: 1, warm: true },
  star3: { vol: 0.8, voices: 1, warm: true },
  win: { vol: 0.95, voices: 1, warm: false },
  lose: { vol: 0.85, voices: 1, warm: false },
  reward: { vol: 0.9, voices: 1, warm: false },
  swipe: { vol: 0.6, voices: 1, warm: true },
  pop: { vol: 0.7, voices: 1, warm: true },
  start: { vol: 0.85, voices: 1, warm: false },
  tick: { vol: 0.5, voices: 1, warm: false },
};

/** Loudness of a loop at full slider and full fade. The loops are normalised alike. */
const MUSIC_BASE = 0.7;
/** How far music sinks under a win / lose jingle and while paused. */
const DUCK_LEVEL = 0.28;
const FADE_SECONDS = 0.9;
const TICK_MS = 40;

const swallow = (p: unknown) => {
  if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => {});
};

/** Slider position -> gain. Squaring tracks how loudness is actually perceived. */
export const volumeCurve = (v: number) => {
  const c = Math.max(0, Math.min(1, v));
  return c * c;
};

type MusicSlot = { player: AudioPlayer; level: number };

const AUDIO = {
  sound: true,
  music: true,
  sfxVol: 0.85,
  musicVol: 0.7,
  /** False while the app is backgrounded, so nothing plays behind the launcher. */
  active: true,
  ducked: false,
  track: null as MusicName | null,
  started: false,
  sfx: new Map<SfxName, { players: AudioPlayer[]; next: number }>(),
  music_: new Map<MusicName, MusicSlot>(),
  timer: null as ReturnType<typeof setInterval> | null,
};

function makeSfx(name: SfxName) {
  if (AUDIO.sfx.has(name)) return AUDIO.sfx.get(name)!;
  const { voices } = SFX_MIX[name];
  const players = Array.from({ length: voices }, () => createAudioPlayer(SFX_FILES[name]));
  const slot = { players, next: 0 };
  AUDIO.sfx.set(name, slot);
  return slot;
}

function slotFor(name: MusicName): MusicSlot | null {
  const have = AUDIO.music_.get(name);
  if (have) return have;
  try {
    const player = createAudioPlayer(MUSIC_FILES[name]);
    player.loop = true;
    player.volume = 0;
    const slot = { player, level: 0 };
    AUDIO.music_.set(name, slot);
    return slot;
  } catch {
    return null;
  }
}

export function audioInit() {
  if (AUDIO.started) return;
  AUDIO.started = true;
  try {
    swallow(setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }));
    // The common effects load now, the rest a moment later, one per turn of the
    // event loop so start-up never stalls on creating thirty players at once.
    const names = Object.keys(SFX_FILES) as SfxName[];
    names.filter((n) => SFX_MIX[n].warm).forEach((n) => { try { makeSfx(n); } catch { /* ignore */ } });
    names.filter((n) => !SFX_MIX[n].warm).forEach((n, i) => {
      setTimeout(() => { try { makeSfx(n); } catch { /* ignore */ } }, 600 + i * 80);
    });
  } catch {
    /* no audio on this device — the game is fully playable without it */
  }
}

export function playSfx(name: SfxName) {
  if (!AUDIO.sound || !AUDIO.active || AUDIO.sfxVol <= 0.001) return;
  try {
    const slot = makeSfx(name);
    const p = slot.players[slot.next];
    slot.next = (slot.next + 1) % slot.players.length;
    p.volume = Math.min(1, SFX_MIX[name].vol * volumeCurve(AUDIO.sfxVol));
    swallow(p.seekTo(0));
    p.play();
  } catch {
    /* ignore */
  }
}

/* --- music --------------------------------------------------------------------
 * Each track has a fade `level`. The wanted track's target is 1 (or DUCK_LEVEL
 * while ducked); every other track's is 0. A single timer walks the levels
 * toward their targets and stops itself when nothing is moving.               */

const targetFor = (name: MusicName) => {
  if (!AUDIO.music || !AUDIO.active || AUDIO.track !== name) return 0;
  return AUDIO.ducked ? DUCK_LEVEL : 1;
};

const musicGain = (level: number) => Math.min(1, MUSIC_BASE * volumeCurve(AUDIO.musicVol) * level);

function musicStep() {
  let moving = false;
  const dt = TICK_MS / 1000 / FADE_SECONDS;
  AUDIO.music_.forEach((slot, name) => {
    const target = targetFor(name);
    const backgrounded = !AUDIO.active;
    if (backgrounded) slot.level = 0;
    else if (slot.level < target) slot.level = Math.min(target, slot.level + dt);
    else if (slot.level > target) slot.level = Math.max(target, slot.level - dt * 1.4);
    if (slot.level !== target) moving = true;
    try {
      slot.player.volume = musicGain(slot.level);
      if (target > 0 && !slot.player.playing) slot.player.play();
      else if (target === 0 && slot.level <= 0.001 && slot.player.playing) slot.player.pause();
    } catch {
      /* ignore */
    }
  });
  if (!moving && AUDIO.timer) { clearInterval(AUDIO.timer); AUDIO.timer = null; }
}

/** Bring every track in line with the current switches, volume and wanted track. */
function musicApply() {
  if (AUDIO.track) slotFor(AUDIO.track);
  musicStep();
  if (!AUDIO.timer) {
    let moving = false;
    AUDIO.music_.forEach((slot, name) => { if (slot.level !== targetFor(name)) moving = true; });
    if (moving) AUDIO.timer = setInterval(musicStep, TICK_MS);
  }
}

export const setSoundOn = (on: boolean) => { AUDIO.sound = on; };
export const setMusicOn = (on: boolean) => { AUDIO.music = on; musicApply(); };
export const setSfxVolume = (v: number) => { AUDIO.sfxVol = Math.max(0, Math.min(1, v)); };
export const setMusicVolume = (v: number) => { AUDIO.musicVol = Math.max(0, Math.min(1, v)); musicApply(); };
export const setAudioActive = (on: boolean) => { AUDIO.active = on; musicApply(); };
export const setMusicTrack = (t: MusicName | null) => { if (AUDIO.track !== t) { AUDIO.track = t; musicApply(); } };
export const setMusicDuck = (on: boolean) => { AUDIO.ducked = on; musicApply(); };

/** The track for a world (0-based), e.g. 0 -> 'w1'. */
export const worldTrack = (world: number): MusicName => `w${(((world % 5) + 5) % 5) + 1}` as MusicName;
