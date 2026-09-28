/**
 * Ads (Google AdMob).
 *
 * Everything ad-related lives here so the game only ever calls four things:
 *   initAds()           once at start-up (asks for consent, starts the SDK)
 *   useRewardedReady()  is a "watch an ad" button worth showing right now?
 *   showRewarded()      resolves true only if the player watched to the end
 *   showInterstitial()  a full-screen ad between levels, paced so it is not annoying
 *
 * Rewarded ads are capped per day (DAILY_AD_LIMIT), counted on the device and
 * kept apart from the game save, so "Reset progress" cannot refill it.
 *
 * The SDK is a native module, so it is absent in Expo Go and on the web. It is
 * loaded defensively: without it every call is a harmless no-op, and in dev a
 * rewarded ad is simulated so the reward flows can still be tried.
 *
 * TO GO LIVE: paste your own AdMob unit IDs into AD_UNITS below and your app
 * IDs into app.json ("react-native-google-mobile-ads"). Until a unit ID is
 * filled in (and always in dev) Google's TEST ads are used, so it is safe to
 * run and click while developing. Never click your own live ads.
 */
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AD_UNITS = {
  android: {
    rewarded: 'ca-app-pub-8313331375535073/6913799180',
    interstitial: 'ca-app-pub-8313331375535073/2974554170',
  },
  ios: { rewarded: '', interstitial: '' },
};

/** Most rewarded ads a player can watch per calendar day. */
export const DAILY_AD_LIMIT = 5;
const ADS_KEY = 'blockadventure:ads:v1';

/** Pacing for interstitials. Rewarded ads are opt-in and never count against these. */
const FIRST_AD_AFTER_LEVELS = 3;   // a grace period so brand-new players get to play
const EVERY_N_LEVELS = 3;          // then one interstitial per this many finished levels
const MIN_GAP_MS = 120_000;        // and never closer together than this

type AdsModule = typeof import('react-native-google-mobile-ads');
type Listener = () => void;
type AdLike = {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (type: string, cb: (arg?: unknown) => void) => () => void;
};

let sdk: AdsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk = require('react-native-google-mobile-ads') as AdsModule;
} catch {
  sdk = null; // Expo Go / web: no native module
}

const unit = (kind: 'rewarded' | 'interstitial'): string => {
  if (!sdk) return '';
  const mine = Platform.OS === 'ios' ? AD_UNITS.ios[kind] : AD_UNITS.android[kind];
  if (__DEV__ || !mine) return kind === 'rewarded' ? sdk.TestIds.REWARDED : sdk.TestIds.INTERSTITIAL;
  return mine;
};

/* --- readiness, observable so buttons can react ---------------------------- */

const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: Listener) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

let rewardedLoaded = false;
const setRewardedLoaded = (v: boolean) => {
  if (rewardedLoaded === v) return;
  rewardedLoaded = v;
  notify();
};

/* --- the daily allowance ---------------------------------------------------- */

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
let usedDay = '';
let usedToday = 0;
let usageLoaded = false;

/** Rewarded ads still available today; 0 until the stored count has been read. */
export function adsLeftToday(): number {
  if (!usageLoaded) return 0;
  if (usedDay !== dayKey()) { usedDay = dayKey(); usedToday = 0; }
  return Math.max(0, DAILY_AD_LIMIT - usedToday);
}

async function loadUsage() {
  try {
    const raw = await AsyncStorage.getItem(ADS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p.day === 'string' && typeof p.n === 'number' && Number.isFinite(p.n)) {
      usedDay = p.day;
      usedToday = Math.max(0, Math.floor(p.n));
    }
  } catch { /* unreadable: start the day at zero */ }
  usageLoaded = true;
  notify();
}

function recordWatched() {
  adsLeftToday(); // rolls the day over first
  usedDay = dayKey();
  usedToday += 1;
  AsyncStorage.setItem(ADS_KEY, JSON.stringify({ day: usedDay, n: usedToday })).catch(() => {});
  notify();
}

/** How many rewarded ads the player can still watch today. */
export function useAdsLeft(): number {
  return useSyncExternalStore(subscribe, adsLeftToday, () => 0);
}

/** True when a rewarded ad can be shown right now: one is loaded (or simulated in dev) and today's allowance is not spent. */
export function useRewardedReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (rewardedLoaded || (!sdk && __DEV__)) && adsLeftToday() > 0,
    () => false,
  );
}

/* --- rewarded --------------------------------------------------------------- */

let rewarded: AdLike | null = null;
let lastAdAt = 0;
let showing = false;

function loadRewarded() {
  if (!sdk) return;
  try {
    const ad = sdk.RewardedAd.createForAdRequest(unit('rewarded')) as unknown as AdLike;
    rewarded = ad;
    const off = [
      ad.addAdEventListener(sdk.RewardedAdEventType.LOADED, () => setRewardedLoaded(true)),
      ad.addAdEventListener(sdk.AdEventType.ERROR, () => {
        off.forEach((f) => f());
        setRewardedLoaded(false);
        setTimeout(loadRewarded, 30_000); // no fill right now: try again in a while
      }),
    ];
    ad.load();
  } catch {
    setTimeout(loadRewarded, 30_000); // a native throw here must never crash the app
  }
}

/** Resolves true only when the player earned the reward (watched the ad through). */
export function showRewarded(): Promise<boolean> {
  if (adsLeftToday() <= 0 || showing) return Promise.resolve(false);
  if (!sdk) {
    if (!__DEV__) return Promise.resolve(false);
    recordWatched(); // dev without the SDK: pretend the ad was watched
    return Promise.resolve(true);
  }
  const ad = rewarded;
  if (!ad || !rewardedLoaded) return Promise.resolve(false);
  showing = true;
  setRewardedLoaded(false);
  return new Promise<boolean>((resolve) => {
    let earned = false;
    const done = () => {
      offs.forEach((f) => f());
      showing = false;
      lastAdAt = Date.now();
      if (earned) recordWatched();
      loadRewarded(); // an ad is single-use: line up the next one
      resolve(earned);
    };
    const offs = [
      ad.addAdEventListener(sdk!.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(sdk!.AdEventType.CLOSED, done),
      ad.addAdEventListener(sdk!.AdEventType.ERROR, done),
    ];
    try {
      ad.show().catch(done);
    } catch {
      done(); // a native throw here must never crash the app
    }
  });
}

/* --- interstitial ----------------------------------------------------------- */

let interstitial: AdLike | null = null;
let interstitialLoaded = false;
let finishedLevels = 0;

function loadInterstitial() {
  if (!sdk) return;
  try {
    const ad = sdk.InterstitialAd.createForAdRequest(unit('interstitial')) as unknown as AdLike;
    interstitial = ad;
    interstitialLoaded = false;
    const off = [
      ad.addAdEventListener(sdk.AdEventType.LOADED, () => { interstitialLoaded = true; }),
      ad.addAdEventListener(sdk.AdEventType.ERROR, () => {
        off.forEach((f) => f());
        setTimeout(loadInterstitial, 30_000);
      }),
    ];
    ad.load();
  } catch {
    setTimeout(loadInterstitial, 30_000); // a native throw here must never crash the app
  }
}

/**
 * Call each time a level ends (win or lose), before moving on. Shows an
 * interstitial when one is due and ready, and resolves once it is closed;
 * otherwise resolves straight away, so it is always safe to `await`.
 */
export function showInterstitial(): Promise<void> {
  finishedLevels += 1;
  const due = finishedLevels > FIRST_AD_AFTER_LEVELS
    && (finishedLevels - FIRST_AD_AFTER_LEVELS) % EVERY_N_LEVELS === 0
    && Date.now() - lastAdAt >= MIN_GAP_MS;
  const ad = interstitial;
  if (!sdk || !due || !ad || !interstitialLoaded || showing) return Promise.resolve();
  showing = true;
  return new Promise<void>((resolve) => {
    const done = () => {
      offs.forEach((f) => f());
      showing = false;
      lastAdAt = Date.now();
      loadInterstitial();
      resolve();
    };
    const offs = [
      ad.addAdEventListener(sdk!.AdEventType.CLOSED, done),
      ad.addAdEventListener(sdk!.AdEventType.ERROR, done),
    ];
    try {
      ad.show().catch(done);
    } catch {
      done(); // a native throw here must never crash the app
    }
  });
}

/* --- start-up --------------------------------------------------------------- */

let started = false;

export async function initAds(): Promise<void> {
  if (started) return;
  started = true;
  await loadUsage();
  if (!sdk) return;
  try {
    // GDPR / US-state consent form, only shown where the law requires it.
    await sdk.AdsConsent.gatherConsent();
  } catch { /* no form available: carry on, the SDK serves what it is allowed to */ }
  try {
    await sdk.default().initialize();
    loadRewarded();
    loadInterstitial();
  } catch { /* ads are optional: the game must never depend on them */ }
}
