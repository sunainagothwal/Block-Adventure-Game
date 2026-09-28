/* ============================================================================
 *  BLOCK ADVENTURE — Match. Blast. Solve. Explore.
 *
 *  THE GAME, IN ONE LINE
 *  Drag blocks onto the 8x8 grid. Fill a whole row or column and it blasts.
 *
 *  Around that sits a full casual-game shell: a welcome page, five tabs
 *  (Home / Adventure / Puzzles / Rewards / Profile), an adventure map of 60
 *  levels in 5 themed worlds, coins, six power-ups, daily rewards, treasure
 *  chests, and a settings panel with sound, music,
 *  haptics and language.
 *
 *  You LOSE when the moves run out, or when none of your three blocks fits
 *  anywhere — which is why leaving yourself room is the whole skill.
 *
 *  Every level is bot-tested hundreds of times against those real lose rules,
 *  so its move limit and goal are known to be beatable. See README.
 *
 *  BUILT FOR STOCK EXPO GO
 *  No Skia, no native blur, no dev client. Blocks are drawn as chunky 3D
 *  bricks in SVG: a dark extruded side, a bright top face, a gloss bar.
 *
 *  AUDIO: every sound is synthesized from code by scripts/make-audio.js into
 *  assets/audio/*.wav — 21 soft effects and 7 relaxed music loops (menu, game,
 *  and one per world). Nothing is sampled or downloaded, so it is original and
 *  royalty-free. Music and effects have separate on/off
 *  switches (Settings); the engine lives in src/audio/engine.ts.
 *
 *  WORLDS: the five Adventure worlds are layered react-native-svg scenes in
 *  src/worlds — sky, parallax ridges, terrain, a curved road, scenery and
 *  ambient motion. There are no background images.
 *
 *  Structure:
 *    1. Theme + language      6. Bricks + board      11. Rewards + profile
 *    2. Level data            7. Draggable block     12. Game screen
 *    3. Shapes                8. Save + economy      13. Shell + nav
 *    4. Rules engine          9. Tutorial            14. Root
 *    5. UI primitives        10. Home + adventure
 * ========================================================================== */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  BackHandler,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  audioInit,
  playSfx,
  setAudioActive,
  setMusicDuck,
  setMusicOn,
  setMusicTrack,
  setMusicVolume,
  setSfxVolume,
  setSoundOn,
  worldTrack,
} from './src/audio/engine';
import {
  NODE,
  WORLDS,
  WorldBackdrop,
  WorldDecor,
  WorldFront,
  WorldRoad,
  WorldTerrain,
  layoutWorld,
  worldDef,
} from './src/worlds/WorldScene';
import { initAds, showInterstitial, showRewarded, useAdsLeft, useRewardedReady } from './src/ads';
import { useFonts } from 'expo-font';
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinear,
  Path,
  RadialGradient as SvgRadial,
  Rect,
  Stop,
} from 'react-native-svg';

/** Set by Root once the display font has loaded. Undefined = system font. */
let DISPLAY_FONT: string | undefined;

/**
 * Every piece of text in the app goes through here, so the chunky display font
 * applies everywhere without touching hundreds of call sites. A custom font
 * plus fontWeight would make Android fake a bold on top of an already-heavy
 * face, so the weight is flattened to normal whenever the font is active.
 */
function Text({ style, ...rest }: TextProps) {
  if (!DISPLAY_FONT) return <RNText style={style} {...rest} />;
  const flat = StyleSheet.flatten(style) ?? {};
  return <RNText {...rest} style={[flat, { fontFamily: DISPLAY_FONT, fontWeight: 'normal' }]} />;
}

/* ==========================================================================
 * 1. THEME
 * ========================================================================== */

type GradColors = readonly [string, string, ...string[]];
const gc = (...c: string[]) => c as unknown as GradColors;

const C = {
  sky3: '#22124F',
  panel: 'rgba(255,255,255,0.05)',
  /** The reference's cards are near-opaque navy with a light-blue edge. */
  card: 'rgba(10,22,74,0.94)',
  cardEdge: 'rgba(96,160,255,0.55)',
  cardLight: 'rgba(26,52,140,0.92)',
  green: '#4ADE60',

  gold: '#FFC42E',
  goldHi: '#FFE9A8',
  goldDeep: '#C07E00',

  cyan: '#2ECBD9',
  violet: '#9B52E0',

  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.72)',
  textFaint: 'rgba(255,255,255,0.45)',
  textGhost: 'rgba(255,255,255,0.24)',

  ok: '#46E06A',
  no: '#FF5C6E',
  ice: '#9BE4FF',
  stone: '#6B6790',
  crystal: '#FF6FE0',
};

/** Candy brick colours: a bright top face over a darker extruded side. */
const BRICKS: { name: string; lo: string; mid: string; dark: string }[] = [
  { name: 'red', lo: '#FF8A82', mid: '#F0433B', dark: '#A8221C' },
  { name: 'orange', lo: '#FFB775', mid: '#FF8A2B', dark: '#B4520A' },
  { name: 'yellow', lo: '#FFDE7A', mid: '#FFC42E', dark: '#B07E00' },
  { name: 'green', lo: '#8EE896', mid: '#46C24E', dark: '#1F7A2A' },
  { name: 'cyan', lo: '#7EE8F0', mid: '#2ECBD9', dark: '#0E7A88' },
  { name: 'blue', lo: '#8FB6FF', mid: '#3B7BEE', dark: '#1B47A8' },
  { name: 'purple', lo: '#D09CFF', mid: '#9B52E0', dark: '#5B2096' },
  { name: 'pink', lo: '#FFA0CE', mid: '#F062A8', dark: '#A82464' },
];

/** Per-world sky, so the backdrop changes as you travel the map. */
const SKINS: { a: string; b: string; c: string; glow: string }[] = [
  { a: '#3C86F0', b: '#2B45C4', c: '#221252', glow: '#7ACBFF' },
  { a: '#2EC0D9', b: '#2B5BC4', c: '#1A1A52', glow: '#8FF0FF' },
  { a: '#6B8FF0', b: '#3A3FB4', c: '#1C1450', glow: '#BFD4FF' },
  { a: '#8A5BD9', b: '#4A2BA8', c: '#221046', glow: '#D0A8FF' },
  { a: '#F06BB0', b: '#5B2BC4', c: '#1E0F4A', glow: '#FFB0E0' },
];

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_TURN = Easing.bezier(0.22, 1, 0.3, 1);
const SPR_SNAP = { damping: 24, stiffness: 400, mass: 0.7 };
const SPR_BACK = { damping: 13, stiffness: 240, mass: 0.8 };
const SPR_POP = { damping: 11, stiffness: 260 };

const MAGNET = 26;
const N = 8;

/* --- language ------------------------------------------------------------- */

type Lang = 'en' | 'es' | 'pt';
const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: 'EN' },
  { id: 'es', label: 'Español', flag: 'ES' },
  { id: 'pt', label: 'Português', flag: 'PT' },
];

const STRINGS = {
  tagline: ['Match. Blast. Solve. Explore.', 'Combina. Explota. Resuelve. Explora.', 'Combine. Exploda. Resolva. Explore.'],
  playNow: ['PLAY NOW', 'JUGAR YA', 'JOGAR AGORA'],
  play: ['PLAY', 'JUGAR', 'JOGAR'],
  loading: ['Loading...', 'Cargando...', 'Carregando...'],
  howToPlay: ['HOW TO PLAY', 'CÓMO JUGAR', 'COMO JOGAR'],
  home: ['Worlds', 'Mundos', 'Mundos'],
  adventure: ['Levels', 'Niveles', 'Níveis'],
  puzzles: ['Puzzles', 'Puzles', 'Puzzles'],
  rewards: ['Rewards', 'Premios', 'Prêmios'],
  profile: ['Profile', 'Perfil', 'Perfil'],
  level: ['LEVEL', 'NIVEL', 'NÍVEL'],
  levels: ['LEVELS', 'NIVELES', 'NÍVEIS'],
  completed: ['COMPLETED!', '¡COMPLETADO!', 'COMPLETO!'],
  dailyRewards: ['Daily Rewards', 'Recompensas diarias', 'Recompensas diárias'],
  milestone: ['Milestone', 'Hitos', 'Marcos'],
  claimNow: ['CLAIM NOW', 'RECLAMAR YA', 'RESGATE AGORA'],
  help: ['Help', 'Ayuda', 'Ajuda'],
  resetNote: [
    'This will reset all your game progress.',
    'Esto borrará todo tu progreso.',
    'Isso apagará todo o seu progresso.',
  ],
  claimReward: ['Claim Reward', 'Reclamar premio', 'Resgatar prêmio'],
  dayWord: ['Day', 'Día', 'Dia'],
  dailySub: [
    'Come back every day to claim amazing rewards!',
    '¡Vuelve cada día para reclamar premios increíbles!',
    'Volte todos os dias para resgatar prêmios incríveis!',
  ],
  collectKeys: ['Collect 5 Keys to open!', '¡Reúne 5 llaves para abrir!', 'Reúna 5 chaves para abrir!'],
  viewRewards: ['VIEW REWARDS', 'VER PREMIOS', 'VER PRÊMIOS'],
  openChest: ['OPEN CHEST', 'ABRIR COFRE', 'ABRIR BAÚ'],
  chestInfo: [
    'Clear a level you have never cleared before to earn a key. Five keys open the chest.',
    'Completa un nivel nuevo para ganar una llave. Cinco llaves abren el cofre.',
    'Complete um nível novo para ganhar uma chave. Cinco chaves abrem o baú.',
  ],
  soundEffects: ['Sound Effects', 'Efectos de sonido', 'Efeitos sonoros'],
  rateUs: ['Rate Us', 'Califícanos', 'Avalie-nos'],
  resetRow: ['Reset Progress', 'Borrar progreso', 'Apagar progresso'],
  confirmReset: ['Tap again to confirm', 'Toca de nuevo para confirmar', 'Toque de novo para confirmar'],
  notOnStore: [
    'Rating opens once the app is on Google Play.',
    'Podrás calificar cuando la app esté en Google Play.',
    'A avaliação abre quando o app estiver no Google Play.',
  ],
  paused: ['PAUSED', 'PAUSA', 'PAUSADO'],
  gamePaused: ['Game Paused', 'Juego en pausa', 'Jogo pausado'],
  coinsWord: ['Coins', 'Monedas', 'Moedas'],
  starsWord: ['Stars', 'Estrellas', 'Estrelas'],
  replayShort: ['Replay', 'Repetir', 'Repetir'],
  restartLevel: ['Restart Level', 'Reiniciar nivel', 'Reiniciar nível'],
  world: ['WORLD', 'MUNDO', 'MUNDO'],
  score: ['SCORE', 'PUNTOS', 'PONTOS'],
  best: ['BEST', 'RÉCORD', 'RECORDE'],
  coins: ['COINS', 'MONEDAS', 'MOEDAS'],
  stars: ['STARS', 'ESTRELLAS', 'ESTRELAS'],
  moves: ['MOVES LEFT', 'MOVIMIENTOS', 'JOGADAS'],
  levelComplete: ['LEVEL COMPLETE!', '¡NIVEL COMPLETO!', 'NÍVEL COMPLETO!'],
  newRecord: ['NEW RECORD!', '¡NUEVO RÉCORD!', 'NOVO RECORDE!'],
  gameOver: ['GAME OVER', 'FIN DEL JUEGO', 'FIM DE JOGO'],
  outOfMoves: ['OUT OF MOVES', 'SIN MOVIMIENTOS', 'SEM JOGADAS'],
  noRoom: ['NO ROOM LEFT', 'SIN ESPACIO', 'SEM ESPAÇO'],
  nextLevel: ['NEXT LEVEL', 'SIGUIENTE', 'PRÓXIMO'],
  playAgain: ['PLAY AGAIN', 'JUGAR OTRA VEZ', 'JOGAR DE NOVO'],
  tryAgain: ['TRY AGAIN', 'REINTENTAR', 'TENTAR DE NOVO'],
  useBooster: ['USE BOOSTER', 'USAR MEJORA', 'USAR REFORÇO'],
  linesCleared: ['LINES CLEARED', 'LÍNEAS', 'LINHAS'],
  coinsEarned: ['COINS EARNED', 'MONEDAS GANADAS', 'MOEDAS GANHAS'],
  resume: ['RESUME', 'CONTINUAR', 'CONTINUAR'],
  restart: ['RESTART', 'REINICIAR', 'REINICIAR'],
  settings: ['SETTINGS', 'AJUSTES', 'AJUSTES'],
  sound: ['Sound', 'Sonido', 'Som'],
  music: ['Music', 'Música', 'Música'],
  haptics: ['Vibration', 'Vibración', 'Vibração'],
  language: ['Language', 'Idioma', 'Idioma'],
  resetProgress: ['RESET PROGRESS', 'BORRAR PROGRESO', 'APAGAR PROGRESSO'],
  continueGame: ['CONTINUE', 'CONTINUAR', 'CONTINUAR'],
  watchContinue: ['WATCH AD · CONTINUE', 'VER ANUNCIO · SEGUIR', 'VER ANÚNCIO · CONTINUAR'],
  watchAd: ['WATCH AD', 'VER ANUNCIO', 'VER ANÚNCIO'],
  noThanks: ['NO THANKS', 'NO, GRACIAS', 'NÃO, OBRIGADO'],
  adLimit: ['DAILY AD LIMIT REACHED', 'LÍMITE DIARIO DE ANUNCIOS', 'LIMITE DIÁRIO DE ANÚNCIOS'],
  adsLeft: ['Ads left today', 'Anuncios restantes hoy', 'Anúncios restantes hoje'],
  adOfferBody: [
    'Not enough coins. Watch a short ad to use it once, free.',
    'No tienes monedas suficientes. Mira un anuncio corto y úsalo gratis una vez.',
    'Moedas insuficientes. Assista a um anúncio curto e use uma vez de graça.',
  ],
  freeHint: ['FREE HINT', 'PISTA GRATIS', 'DICA GRÁTIS'],
  freeUndo: ['FREE UNDO', 'DESHACER GRATIS', 'DESFAZER GRÁTIS'],
  freeShuffle: ['FREE SHUFFLE', 'MEZCLA GRATIS', 'EMBARALHAR GRÁTIS'],
  dailyReward: ['Daily Reward', 'Premio Diario', 'Prêmio Diário'],
  claim: ['CLAIM', 'RECLAMAR', 'RESGATAR'],
  claimed: ['CLAIMED', 'RECLAMADO', 'RESGATADO'],
  comeBack: ['Come back tomorrow', 'Vuelve mañana', 'Volte amanhã'],
  treasureChest: ['Treasure Chest', 'Cofre del Tesoro', 'Baú do Tesouro'],
  open: ['OPEN', 'ABRIR', 'ABRIR'],
  achievements: ['Achievements', 'Logros', 'Conquistas'],
  badges: ['Badges', 'Insignias', 'Emblemas'],
  locked: ['LOCKED', 'BLOQUEADO', 'BLOQUEADO'],
  powerUps: ['Power-Ups', 'Mejoras', 'Reforços'],
  buy: ['BUY', 'COMPRAR', 'COMPRAR'],
  notEnough: ['NOT ENOUGH COINS', 'MONEDAS INSUFICIENTES', 'MOEDAS INSUFICIENTES'],
  dailyPuzzle: ['Daily Puzzle', 'Puzle Diario', 'Puzzle Diário'],
  replay: ['Replay a level', 'Repetir nivel', 'Repetir nível'],
  levelsCleared: ['Levels Cleared', 'Niveles', 'Níveis'],
  totalScore: ['Total Score', 'Puntuación Total', 'Pontuação Total'],
  bestCombo: ['Best Combo', 'Mejor Combo', 'Melhor Combo'],
  blocksPlaced: ['Blocks Placed', 'Bloques', 'Blocos'],
  player: ['Player', 'Jugador', 'Jogador'],
  tapToPick: ['Tap the grid', 'Toca la cuadrícula', 'Toque na grade'],
  goalStar: ['GOAL', 'META', 'META'],
  starsAt: ['Score needed for each star', 'Puntos para cada estrella', 'Pontos para cada estrela'],
  movesShort: ['MOVES', 'MOVIMIENTOS', 'JOGADAS'],
  clearFirst: ['clear it first', 'complétalo primero', 'conclua primeiro'],
  goalTitle: ['Goal', 'Meta', 'Meta'],
  movesTitle: ['Moves', 'Jugadas', 'Jogadas'],
  levelTitle: ['Level', 'Nivel', 'Nível'],
  scoreTitle: ['Score', 'Puntos', 'Pontos'],
  bestScore: ['Best Score', 'Récord', 'Recorde'],
  hint: ['Hint', 'Pista', 'Dica'],
  undo: ['Undo', 'Deshacer', 'Desfazer'],
  shuffle: ['Shuffle', 'Mezclar', 'Embaralhar'],
  retry: ['Retry', 'Reintentar', 'Tentar de novo'],
  levelMap: ['Level Map', 'Mapa', 'Mapa'],
  ranOut: ['You ran out of moves!', '¡Te quedaste sin movimientos!', 'Você ficou sem jogadas!'],
  noSpace: ['No more space for your blocks!', '¡Ya no hay espacio para tus bloques!', 'Não há mais espaço para seus blocos!'],
  nothingUndo: ['NOTHING TO UNDO', 'NADA QUE DESHACER', 'NADA PARA DESFAZER'],
} as const;

type StringKey = keyof typeof STRINGS;
const LangCtx = createContext<Lang>('en');
const useT = () => {
  const lang = useContext(LangCtx);
  const i = lang === 'es' ? 1 : lang === 'pt' ? 2 : 0;
  return useCallback((k: StringKey) => STRINGS[k][i], [i]);
};

/* ==========================================================================
 * 2. LEVEL DATA
 *
 * Every level is bot-tested: a greedy bot plays it hundreds of times under the
 * real lose rules (out of moves, or nothing fits) and the move limit only
 * ships if the bot clears it reliably. Star tiers are read out of that same
 * score distribution.
 *
 *   obj   — "type:target". lines / score use the target; crystals / ice /
 *           clear are satisfied by removing every one on the board.
 *   s     — which world the level belongs to.
 *   stone / crystal / ice — cell lists as "rc rc rc".
 * ========================================================================== */

type BagName = 'easy' | 'mid' | 'hard';
type RawLevel = {
  s: number;
  obj: string;
  moves: number;
  stars: number[];
  bag: BagName;
  stone?: string;
  crystal?: string;
  ice?: string;
};
/** Worlds are unnamed: an id, a sky colour and a run of twelve levels. */
type RawStage = { id: string };

const STAGES: RawStage[] = [
  { id: 'w1' },
  { id: 'w2' },
  { id: 'w3' },
  { id: 'w4' },
  { id: 'w5' },
];

const LEVEL_DATA: RawLevel[] = [
  { s: 0, obj: 'lines:10', moves: 30, stars: [1030, 2060, 2300], bag: 'easy' },
  { s: 0, obj: 'lines:10', moves: 30, stars: [1035, 2070, 2350], bag: 'easy' },
  { s: 0, obj: 'lines:10', moves: 30, stars: [1050, 2100, 2340], bag: 'easy' },
  { s: 0, obj: 'lines:10', moves: 31, stars: [1055, 2110, 2390], bag: 'easy' },
  { s: 0, obj: 'lines:11', moves: 31, stars: [1135, 2270, 2550], bag: 'easy' },
  { s: 0, obj: 'lines:11', moves: 31, stars: [1165, 2330, 2570], bag: 'easy' },
  { s: 0, obj: 'score:2240', moves: 31, stars: [1140, 2280, 2400], bag: 'easy' },
  { s: 0, obj: 'score:2210', moves: 31, stars: [1135, 2270, 2390], bag: 'easy' },
  { s: 0, obj: 'score:2420', moves: 31, stars: [1240, 2480, 2570], bag: 'mid' },
  { s: 0, obj: 'score:2630', moves: 32, stars: [1345, 2690, 2770], bag: 'mid' },
  { s: 0, obj: 'score:2630', moves: 32, stars: [1340, 2680, 2770], bag: 'mid' },
  { s: 0, obj: 'score:2550', moves: 32, stars: [1300, 2600, 2730], bag: 'mid' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3160, 6320, 6870], bag: 'easy', crystal: '54 15 46 61 74 37 22 47' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3010, 6020, 6850], bag: 'easy', crystal: '02 00 47 52 37 33 25 66' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3425, 6850, 7450], bag: 'easy', crystal: '56 16 30 21 63 62 55 72 47' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3325, 6650, 7220], bag: 'easy', crystal: '64 33 37 40 23 06 11 75 73' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3370, 6740, 7410], bag: 'easy', crystal: '74 61 33 00 20 17 52 05 62' },
  { s: 1, obj: 'lines:12', moves: 33, stars: [1250, 2500, 2770], bag: 'easy' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [3685, 7370, 8060], bag: 'easy', crystal: '31 46 37 74 11 03 25 62 35 50' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [5030, 10060, 10880], bag: 'mid', crystal: '53 11 75 31 35 20 72 42 57 22 14 66 56 03' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [6775, 13550, 15270], bag: 'mid', crystal: '62 47 00 15 01 54 56 77 76 51 04 17 21 23 45 35 02 31 32 06' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [5645, 11290, 12460], bag: 'mid', crystal: '05 11 30 75 54 41 66 62 33 13 07 47 25 26 14 46' },
  { s: 1, obj: 'score:2900', moves: 34, stars: [1485, 2970, 3100], bag: 'mid' },
  { s: 1, obj: 'crystals:0', moves: 30, stars: [4425, 8850, 9760], bag: 'mid', crystal: '60 35 44 05 53 03 22 37 16 71 24 45' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [3730, 7455, 8335], bag: 'mid', ice: '11 73 51 17 40 07 04 06 63 43 26 74 54 15 47 32 65 27' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [4270, 8540, 9455], bag: 'mid', ice: '75 77 60 45 72 25 35 36 34 65 13 53 07 42 01 15 16 04 23 30 54 22' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [2515, 5030, 5605], bag: 'mid', ice: '35 60 04 11 03 46 77 23 52 67' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [4080, 8155, 9145], bag: 'mid', ice: '64 33 24 50 55 76 15 20 72 65 37 11 53 43 07 46 41 57 66 36' },
  { s: 2, obj: 'crystals:0', moves: 30, stars: [6270, 12540, 13710], bag: 'mid', crystal: '17 51 45 54 20 42 70 72 23 25 01 40 36 61 13 07 75 26' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [2530, 5055, 5600], bag: 'mid', ice: '24 40 63 73 55 07 30 32 61 16' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [2800, 5600, 6085], bag: 'mid', ice: '43 76 52 17 05 37 64 12 31 20 45 61' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [3170, 6340, 7050], bag: 'mid', ice: '44 07 43 11 36 71 70 15 33 52 66 20 73 34' },
  { s: 2, obj: 'ice:0', moves: 30, stars: [2790, 5575, 6225], bag: 'mid', ice: '01 33 66 47 55 62 17 16 74 12 27 40' },
  { s: 2, obj: 'score:3120', moves: 36, stars: [1590, 3180, 3270], bag: 'mid' },
  { s: 2, obj: 'ice:0', moves: 31, stars: [3400, 6800, 7775], bag: 'mid', ice: '23 16 15 74 51 11 60 54 72 40 37 05 62 53 66 42' },
  { s: 2, obj: 'ice:0', moves: 31, stars: [4550, 9095, 10000], bag: 'mid', ice: '14 67 72 26 35 64 41 22 34 42 20 56 62 53 03 50 54 73 33 57 13 12 75 17' },
  { s: 3, obj: 'lines:16', moves: 36, stars: [1705, 3410, 3640], bag: 'mid', stone: '34 43' },
  { s: 3, obj: 'crystals:0', moves: 31, stars: [8925, 17850, 19940], bag: 'mid', stone: '14 62', crystal: '02 35 30 34 15 55 60 06 56 67 45 26 63 44 54 65 72 42 17 51 07 20 04 37 43 13' },
  { s: 3, obj: 'ice:0', moves: 31, stars: [4460, 8920, 9760], bag: 'mid', stone: '16 46 51', ice: '02 61 17 25 36 01 62 13 11 27 20 05 14 67 32 72 66 76 75 40 04 53' },
  { s: 3, obj: 'score:3590', moves: 37, stars: [1835, 3670, 3850], bag: 'mid', stone: '42 51 11' },
  { s: 3, obj: 'lines:16', moves: 37, stars: [1760, 3520, 3750], bag: 'mid', stone: '51 64 56' },
  { s: 3, obj: 'crystals:0', moves: 32, stars: [6270, 12540, 14270], bag: 'mid', stone: '24 36 46', crystal: '71 31 42 12 22 45 73 20 66 16 34 04 47 14 11 55 63 62' },
  { s: 3, obj: 'ice:0', moves: 32, stars: [5275, 10550, 11745], bag: 'mid', stone: '12 23 35 26', ice: '53 32 03 07 13 33 67 01 61 24 55 73 04 31 76 37 42 54 06 50 45 52 36 10 56 60' },
  { s: 3, obj: 'score:3660', moves: 37, stars: [1860, 3720, 3790], bag: 'mid', stone: '65 31 63 24' },
  { s: 3, obj: 'lines:18', moves: 37, stars: [2010, 4020, 4400], bag: 'hard', stone: '25 34 54 15' },
  { s: 3, obj: 'crystals:0', moves: 33, stars: [8120, 16240, 17620], bag: 'hard', stone: '44 26 16 54', crystal: '35 60 05 43 72 27 71 52 76 33 67 36 37 07 23 10 31 51 46 21 30 14' },
  { s: 3, obj: 'ice:0', moves: 33, stars: [5555, 11105, 12510], bag: 'hard', stone: '21 22 36 13 12', ice: '03 20 66 33 15 00 67 40 02 06 70 42 63 53 45 54 65 75 43 46 72 37 31 34 11 71' },
  { s: 3, obj: 'score:3990', moves: 38, stars: [2035, 4070, 4200], bag: 'hard', stone: '53 41 45 63 11' },
  { s: 4, obj: 'clear:0', moves: 33, stars: [6890, 13775, 15360], bag: 'hard', stone: '34 24', crystal: '06 71 44 14 30 66 42 67 63 53 77 04 43', ice: '60 57 70 51 37 21 25 74 05 32 12 72 01' },
  { s: 4, obj: 'clear:0', moves: 33, stars: [7235, 14470, 15720], bag: 'hard', stone: '61 46', crystal: '51 47 57 16 07 42 13 72 40 33 52 03 20', ice: '04 10 54 66 32 60 15 45 64 50 63 71 35' },
  { s: 4, obj: 'clear:0', moves: 33, stars: [7120, 14235, 15195], bag: 'hard', stone: '62 11 26', crystal: '42 22 71 46 66 60 41 21 56 76 30 17 55', ice: '63 64 36 44 75 37 04 77 50 67 05 61 53' },
  { s: 4, obj: 'clear:0', moves: 34, stars: [5985, 11965, 13460], bag: 'hard', stone: '52 43 64', crystal: '41 12 70 60 23 67 31 56 37 50 33', ice: '73 61 77 04 40 65 30 34 11 05 07' },
  { s: 4, obj: 'clear:0', moves: 34, stars: [7190, 14375, 15775], bag: 'hard', stone: '26 44 24', crystal: '13 06 42 02 67 15 12 71 60 37 64 34 25', ice: '10 40 51 33 61 17 72 47 07 62 14 21 53' },
  { s: 4, obj: 'clear:0', moves: 34, stars: [5445, 10885, 11755], bag: 'hard', stone: '55 13 42', crystal: '05 43 57 51 53 35 24 20 77', ice: '75 47 66 12 04 64 16 71 32' },
  { s: 4, obj: 'score:4230', moves: 39, stars: [2145, 4290, 4410], bag: 'hard', stone: '11 16 32 45' },
  { s: 4, obj: 'clear:0', moves: 34, stars: [5630, 11260, 12370], bag: 'hard', stone: '23 65 34 52', crystal: '01 41 57 13 05 63 76 55 00 72', ice: '50 56 21 33 12 36 10 44 07 66' },
  { s: 4, obj: 'clear:0', moves: 34, stars: [6620, 13235, 14745], bag: 'hard', stone: '25 41 13 23', crystal: '53 31 67 61 54 36 16 55 04 11 03 27', ice: '43 01 74 71 64 70 35 00 66 46 62 47' },
  { s: 4, obj: 'clear:0', moves: 35, stars: [6280, 12555, 14460], bag: 'hard', stone: '66 25 24 41', crystal: '05 10 54 42 31 40 73 71 20 61 56', ice: '11 77 64 27 33 43 53 17 13 51 03' },
  { s: 4, obj: 'clear:0', moves: 35, stars: [6415, 12825, 14265], bag: 'hard', stone: '23 55 36 43 51', crystal: '03 64 04 57 34 35 77 11 54 46 21', ice: '01 12 60 31 47 32 73 42 17 30 20' },
  { s: 4, obj: 'clear:0', moves: 35, stars: [7545, 15085, 16460], bag: 'hard', stone: '33 22 25 36 65', crystal: '16 30 14 67 71 23 47 11 05 52 04 32 03', ice: '56 15 60 63 07 31 66 43 76 42 46 12 41' },
];

/* ==========================================================================
 * 3. SHAPES
 * ========================================================================== */

type Cell = { r: number; c: number };

const BASE_SHAPES: { id: string; cells: number[][] }[] = [
  { id: 'dot', cells: [[0, 0]] },
  { id: 'i2', cells: [[0, 0], [0, 1]] },
  { id: 'i3', cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'i4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 'i5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 'o2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 'o3', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: 'r23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: 'l3', cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 'l4', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: 't4', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 's4', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
];

const BAGS: Record<BagName, Record<string, number>> = {
  easy: { dot: 3, i2: 5, i3: 5, i4: 3, i5: 1, o2: 5, o3: 0, r23: 2, l3: 5, l4: 2, t4: 3, s4: 2 },
  mid: { dot: 2, i2: 4, i3: 5, i4: 4, i5: 2, o2: 4, o3: 1, r23: 3, l3: 4, l4: 3, t4: 3, s4: 3 },
  hard: { dot: 1, i2: 3, i3: 4, i4: 4, i5: 3, o2: 4, o3: 2, r23: 4, l3: 3, l4: 4, t4: 3, s4: 4 },
};

const normPairs = (cells: number[][]): number[][] => {
  const mr = Math.min(...cells.map((c) => c[0]));
  const mc = Math.min(...cells.map((c) => c[1]));
  return cells.map((c) => [c[0] - mr, c[1] - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const rotCW = (cells: number[][]): number[][] => {
  const maxR = Math.max(...cells.map((c) => c[0]));
  return normPairs(cells.map((c) => [c[1], maxR - c[0]]));
};
const shapeKey = (cells: number[][]) => cells.map((c) => `${c[0]},${c[1]}`).join('|');

type Variant = { base: number; rot: number; cells: Cell[]; w: number; h: number; size: number };

/** Every distinct rotation of every base shape. The bag draws from this. */
const VARIANTS: Variant[] = [];
/** variantIndex -> the index you land on after one clockwise turn. */
const TURN_OF: number[] = [];
for (let i = 0; i < BASE_SHAPES.length; i++) {
  const ring: number[] = [];
  const seen = new Map<string, number>();
  let cur = normPairs(BASE_SHAPES[i].cells);
  for (let r = 0; r < 4; r++) {
    const k = shapeKey(cur);
    let at = seen.get(k);
    if (at === undefined) {
      at = VARIANTS.length;
      seen.set(k, at);
      VARIANTS.push({
        base: i,
        rot: r,
        cells: cur.map((c) => ({ r: c[0], c: c[1] })),
        h: Math.max(...cur.map((c) => c[0])) + 1,
        w: Math.max(...cur.map((c) => c[1])) + 1,
        size: cur.length,
      });
    }
    ring.push(at);
    cur = rotCW(cur);
  }
  // A square has one distinct rotation, an I-piece two; the ring handles both.
  for (let r = 0; r < 4; r++) TURN_OF[ring[r]] = ring[(r + 1) % 4];
}
/** The 1x1, handed out by the Magic Block power-up. */
const DOT_VARIANT = VARIANTS.findIndex((v) => v.size === 1);

/* ==========================================================================
 * 4. RULES ENGINE
 *
 * Kept free of React so the headless suite can import it and replay the same
 * bot that tuned the levels.
 * ========================================================================== */

const KIND_NONE = 0;
const KIND_STONE = 1;
const KIND_CRYSTAL = 2;
const KIND_ICE = 3;

type BoardState = {
  occ: Uint8Array;    // 1 when the cell is filled by anything
  kind: Uint8Array;   // KIND_*
  color: Int8Array;   // brick colour of a placed cell, else -1
};

type ObjType = 'lines' | 'score' | 'crystals' | 'ice' | 'clear';

type Level = {
  key: string;
  index: number;
  stage: number;
  objType: ObjType;
  objTarget: number;
  moves: number;
  stars: number[];
  bag: BagName;
  stone: Cell[];
  crystal: Cell[];
  ice: Cell[];
};

const idx = (r: number, c: number) => r * N + c;
const parseCells = (s?: string): Cell[] =>
  !s ? [] : s.split(' ').filter(Boolean).map((t) => ({ r: Number(t[0]), c: Number(t[1]) }));

function makeBoard(level: Level): BoardState {
  const b: BoardState = {
    occ: new Uint8Array(N * N),
    kind: new Uint8Array(N * N),
    color: new Int8Array(N * N).fill(-1),
  };
  const mark = (p: Cell, kind: number) => { b.occ[idx(p.r, p.c)] = 1; b.kind[idx(p.r, p.c)] = kind; };
  for (const p of level.stone) mark(p, KIND_STONE);
  for (const p of level.crystal) mark(p, KIND_CRYSTAL);
  for (const p of level.ice) mark(p, KIND_ICE);
  return b;
}

const cloneState = (b: BoardState): BoardState => ({
  occ: Uint8Array.from(b.occ),
  kind: Uint8Array.from(b.kind),
  color: Int8Array.from(b.color),
});

function canPlace(b: BoardState, cells: Cell[], R: number, Cc: number): boolean {
  for (const d of cells) {
    const r = R + d.r;
    const c = Cc + d.c;
    if (r < 0 || c < 0 || r >= N || c >= N) return false;
    if (b.occ[idx(r, c)]) return false;
  }
  return true;
}

/** Rows and columns that would be complete if these extra cells were filled. */
function linesAfter(b: BoardState, cells: Cell[], R: number, Cc: number) {
  const add = new Set<number>();
  for (const d of cells) add.add(idx(R + d.r, Cc + d.c));
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < N; r++) {
    let all = true;
    for (let c = 0; c < N; c++) if (!b.occ[idx(r, c)] && !add.has(idx(r, c))) { all = false; break; }
    if (all) rows.push(r);
  }
  for (let c = 0; c < N; c++) {
    let all = true;
    for (let r = 0; r < N; r++) if (!b.occ[idx(r, c)] && !add.has(idx(r, c))) { all = false; break; }
    if (all) cols.push(c);
  }
  return { rows, cols };
}

type PlaceResult = {
  lines: number;
  crystals: number;
  iceBroken: number;
  placed: number;
  cleared: number[];
};

/** Empty one cell, reporting what was in it. Stone is immovable, always. */
function wipe(b: BoardState, k: number, out: PlaceResult): boolean {
  if (!b.occ[k] || b.kind[k] === KIND_STONE) return false;
  out.cleared.push(k);
  if (b.kind[k] === KIND_ICE) { out.iceBroken++; b.kind[k] = KIND_NONE; }
  else if (b.kind[k] === KIND_CRYSTAL) { out.crystals++; b.kind[k] = KIND_NONE; }
  b.occ[k] = 0;
  b.color[k] = -1;
  return true;
}

const emptyResult = (): PlaceResult => ({ lines: 0, crystals: 0, iceBroken: 0, placed: 0, cleared: [] });

/**
 * Drop a block, then resolve every full row and column at once.
 * Stone survives a clear, ice cracks away, crystals are collected.
 */
function place(b: BoardState, cells: Cell[], R: number, Cc: number, color: number): PlaceResult {
  for (const d of cells) {
    const k = idx(R + d.r, Cc + d.c);
    b.occ[k] = 1;
    b.color[k] = color;
  }
  const { rows, cols } = linesAfter(b, [], 0, 0);
  const out = emptyResult();
  out.placed = cells.length;
  out.lines = rows.length + cols.length;

  if (out.lines > 0) {
    // Gather the union first, so an intersection cell resolves exactly once.
    const hit = new Set<number>();
    for (const r of rows) for (let c = 0; c < N; c++) hit.add(idx(r, c));
    for (const c of cols) for (let r = 0; r < N; r++) hit.add(idx(r, c));
    for (const k of hit) wipe(b, k, out);
  }
  return out;
}

/* --- power-up operations -------------------------------------------------
 * Each returns the same PlaceResult shape, so scoring and objective progress
 * flow through exactly one path no matter how a cell was removed.           */

/** Hammer: remove one placed brick. Obstacles must still be line-cleared. */
function hammer(b: BoardState, r: number, c: number): PlaceResult {
  const out = emptyResult();
  const k = idx(r, c);
  if (b.kind[k] !== KIND_NONE || !b.occ[k]) return out;
  wipe(b, k, out);
  return out;
}

/** Rocket: clear the whole row and column through the tapped cell. */
function rocket(b: BoardState, r: number, c: number): PlaceResult {
  const out = emptyResult();
  for (let i = 0; i < N; i++) { wipe(b, idx(r, i), out); wipe(b, idx(i, c), out); }
  return out;
}

/** Bomb: blast a 3x3 around the tapped cell. */
function bomb(b: BoardState, R: number, Cc: number): PlaceResult {
  const out = emptyResult();
  for (let r = R - 1; r <= R + 1; r++) {
    for (let c = Cc - 1; c <= Cc + 1; c++) {
      if (r < 0 || c < 0 || r >= N || c >= N) continue;
      wipe(b, idx(r, c), out);
    }
  }
  return out;
}

/** Color Blast: every placed brick of the tapped colour leaves the board. */
function colorBlast(b: BoardState, color: number): PlaceResult {
  const out = emptyResult();
  for (let k = 0; k < N * N; k++) {
    if (b.kind[k] === KIND_NONE && b.color[k] === color) wipe(b, k, out);
  }
  return out;
}

/** Identical to the formula the level tuner scored with. */
function scoreFor(res: PlaceResult, streak: number): number {
  const lineScore = res.lines > 0 ? res.lines * res.lines * 10 : 0;
  const mult = 1 + 0.5 * Math.max(0, streak - 1);
  return Math.round((res.placed + (lineScore + res.crystals * 50 + res.iceBroken * 25) * mult) * 10);
}

function bagPool(name: BagName): number[] {
  const weights = BAGS[name];
  const pool: number[] = [];
  for (let i = 0; i < VARIANTS.length; i++) {
    const w = weights[BASE_SHAPES[VARIANTS[i].base].id] ?? 0;
    for (let k = 0; k < w; k++) pool.push(i);
  }
  return pool;
}

/** Does anything in the tray still fit, in any rotation? */
function anyFits(b: BoardState, variantIds: (number | null)[]): boolean {
  for (const start of variantIds) {
    if (start === null) continue;
    let vi = start;
    for (let t = 0; t < 4; t++) {
      const v = VARIANTS[vi];
      for (let r = 0; r <= N - v.h; r++) {
        for (let c = 0; c <= N - v.w; c++) if (canPlace(b, v.cells, r, c)) return true;
      }
      vi = TURN_OF[vi];
    }
  }
  return false;
}

const OBJ_LABEL: Record<ObjType, string> = {
  lines: 'CLEAR LINES',
  score: 'REACH SCORE',
  crystals: 'POP CRYSTALS',
  ice: 'BREAK ICE',
  clear: 'CLEAR IT ALL',
};

/** One flat ladder. Worlds are a label and a sky, not a separate screen. */
const LEVELS: Level[] = LEVEL_DATA.map((lv, index): Level => {
  const [type, target] = lv.obj.split(':');
  return {
    key: `L${index}`,
    index,
    stage: lv.s,
    objType: type as ObjType,
    objTarget: Number(target),
    moves: lv.moves,
    stars: lv.stars,
    bag: lv.bag,
    stone: parseCells(lv.stone),
    crystal: parseCells(lv.crystal),
    ice: parseCells(lv.ice),
  };
});

const TOTAL_LEVELS = LEVELS.length;
const MAX_STARS = TOTAL_LEVELS * 3;
/** Index of the first level of each world, for the inline map headers. */
const STAGE_START = STAGES.map((_, s) => LEVELS.findIndex((lv) => lv.stage === s));

type Progress = { lines: number; score: number; crystals: number; iceBroken: number };

/** How far along the goal is, and what it needs — drives the HUD chip. */
function goalState(level: Level, p: Progress) {
  switch (level.objType) {
    case 'lines': return { have: p.lines, need: level.objTarget };
    case 'score': return { have: p.score, need: level.objTarget };
    case 'crystals': return { have: p.crystals, need: level.crystal.length };
    case 'ice': return { have: p.iceBroken, need: level.ice.length };
    default: return { have: p.crystals + p.iceBroken, need: level.crystal.length + level.ice.length };
  }
}
const goalMet = (level: Level, p: Progress) => {
  const g = goalState(level, p);
  return g.have >= g.need;
};
const starsFor = (level: Level, score: number) =>
  score >= level.stars[2] ? 3 : score >= level.stars[1] ? 2 : 1;

/**
 * Coins are scarce on purpose, so spending them is a decision. Play pays only
 * the first time a level is cleared, and only a few; replays and ads pay none.
 */
const coinsFor = (stars: number, firstClear: boolean) => (firstClear ? stars * 3 : 0);

/** What the three helpers cost. Shuffle's price is on its PowerDef. */
const HINT_COST = 10;
const UNDO_COST = 10;

/* ==========================================================================
 * HAPTICS — every call is fire-and-forget; some devices reject them.
 * The settings switch gates them, which is also what the sound switch does
 * today. See the note at the top of the file about audio files.
 * ========================================================================== */

let HAPTICS_ON = true;
const swallow = (p: unknown) => {
  if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => {});
};
const fire = (p: () => unknown) => { if (HAPTICS_ON) swallow(p()); };
const haptic = {
  select: () => fire(() => Haptics.selectionAsync()),
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  ok: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  err: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
function burst(n: number) {
  haptic.heavy();
  for (let i = 1; i < Math.min(n, 4); i++) setTimeout(haptic.medium, i * 90);
}
/** A tap on anything pressable: the haptic tick plus the soft UI click. */
const tapFx = () => { haptic.select(); playSfx('tap'); };

/* ==========================================================================
 * 8. SAVE + ECONOMY
 * ========================================================================== */

type PowerId = 'hammer' | 'rocket' | 'bomb' | 'shuffle' | 'magic' | 'color';

type PowerDef = {
  id: PowerId;
  name: string;
  cost: number;
  /** Instant powers fire straight away; targeted ones wait for a board tap. */
  targeted: boolean;
  hint: string;
};

const POWERS: PowerDef[] = [
  { id: 'hammer', name: 'Hammer', cost: 40, targeted: true, hint: 'Tap a block to smash it' },
  { id: 'rocket', name: 'Rocket', cost: 60, targeted: true, hint: 'Tap a cell to clear its row and column' },
  { id: 'bomb', name: 'Bomb', cost: 80, targeted: true, hint: 'Tap a cell to blast a 3x3' },
  { id: 'shuffle', name: 'Shuffle', cost: 15, targeted: false, hint: 'Swaps your three blocks' },
  { id: 'magic', name: 'Magic Block', cost: 50, targeted: false, hint: 'Turns your biggest block into a 1x1' },
  { id: 'color', name: 'Color Blast', cost: 100, targeted: true, hint: 'Tap a block to clear every one of its colour' },
];
const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;

/** Seven-day ladder. Day 7 pays a power-up as well as coins. */
const DAILY: { coins: number; power?: PowerId }[] = [
  { coins: 10 },
  { coins: 10 },
  { coins: 15, power: 'shuffle' },
  { coins: 10 },
  { coins: 20, power: 'hammer' },
  { coins: 15 },
  { coins: 30, power: 'bomb' },
];

const CHEST_GOAL = 5;
const CHEST_COINS = 25;

/** sfxVol / musicVol are 0..1 slider positions; sound / music are the mute switches. */
type Settings = { sound: boolean; music: boolean; haptics: boolean; lang: Lang; sfxVol: number; musicVol: number };
type SetSetting = <K extends keyof Settings>(k: K, v: Settings[K], quiet?: boolean) => void;

type Save = {
  stars: Record<string, number>;
  best: Record<string, number>;
  coins: number;
  powers: Record<PowerId, number>;
  lines: number;
  blocks: number;
  bestCombo: number;
  totalScore: number;
  claimedAch: string[];
  dailyDay: number;        // 0 = none claimed yet, else 1..7
  dailyLast: string;       // YYYY-MM-DD of the last claim
  chest: number;
  seenTutorial: boolean;
  seenStages: string[];
  avatar: number;
  settings: Settings;
};

const STORAGE_KEY = 'blockadventure:save:v1';
const EMPTY_SAVE: Save = {
  stars: {}, best: {}, coins: 40,
  powers: { hammer: 0, rocket: 0, bomb: 0, shuffle: 1, magic: 0, color: 0 },
  lines: 0, blocks: 0, bestCombo: 0, totalScore: 0,
  claimedAch: [], dailyDay: 0, dailyLast: '', chest: 0,
  seenTutorial: false, seenStages: [], avatar: 0,
  settings: { sound: true, music: true, haptics: true, lang: 'en', sfxVol: 0.85, musicVol: 0.7 },
};


const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
/** A daily reward is available once per calendar day. */
const dailyReady = (s: Save) => s.dailyLast !== todayKey();

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A finite number clamped to [lo, hi]; anything else (null, NaN, a string...) falls back. */
const numOr = (v: unknown, fallback: number, lo = 0, hi = 1e9) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const posMap = (v: unknown, hi: number): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isRec(v)) for (const k of Object.keys(v)) { const n = v[k]; if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.min(hi, n); }
  return out;
};

/**
 * Whatever came out of storage becomes a valid Save. JSON cannot hold NaN (it
 * is written as null), so a single bad sum would otherwise be saved and then
 * crash every launch, e.g. on `coins.toLocaleString()`.
 */
function sanitizeSave(raw: unknown): Save {
  const d = EMPTY_SAVE;
  const p = isRec(raw) ? raw : {};
  const ps = isRec(p.settings) ? p.settings : {};
  const pw = isRec(p.powers) ? p.powers : {};
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const powers = { ...d.powers };
  for (const id of Object.keys(powers) as PowerId[]) powers[id] = Math.floor(numOr(pw[id], d.powers[id], 0, 999));
  return {
    stars: posMap(p.stars, 3),
    best: posMap(p.best, 1e9),
    coins: Math.floor(numOr(p.coins, d.coins)),
    powers,
    lines: Math.floor(numOr(p.lines, 0)),
    blocks: Math.floor(numOr(p.blocks, 0)),
    bestCombo: Math.floor(numOr(p.bestCombo, 0)),
    totalScore: Math.floor(numOr(p.totalScore, 0)),
    claimedAch: strs(p.claimedAch),
    dailyDay: Math.floor(numOr(p.dailyDay, 0, 0, 7)),
    dailyLast: typeof p.dailyLast === 'string' ? p.dailyLast : '',
    chest: Math.floor(numOr(p.chest, 0, 0, 999)),
    seenTutorial: p.seenTutorial === true,
    seenStages: strs(p.seenStages),
    avatar: Math.floor(numOr(p.avatar, 0, 0, 99)),
    settings: {
      sound: typeof ps.sound === 'boolean' ? ps.sound : d.settings.sound,
      music: typeof ps.music === 'boolean' ? ps.music : d.settings.music,
      haptics: typeof ps.haptics === 'boolean' ? ps.haptics : d.settings.haptics,
      lang: LANGS.some((l) => l.id === ps.lang) ? (ps.lang as Lang) : d.settings.lang,
      sfxVol: numOr(ps.sfxVol, d.settings.sfxVol, 0, 1),
      musicVol: numOr(ps.musicVol, d.settings.musicVol, 0, 1),
    },
  };
}

function useSave() {
  const [save, setSave] = useState<Save>(EMPTY_SAVE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          setSave(sanitizeSave(JSON.parse(raw)));
        } catch { /* corrupt payload — start fresh rather than crash */ }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  const write = useCallback((next: Save) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    HAPTICS_ON = next.settings.haptics;
    return next;
  }, []);

  /** Every mutation goes through here, so persistence can never be forgotten. */
  const edit = useCallback((fn: (s: Save) => Save) => setSave((p) => write(fn(p))), [write]);

  useEffect(() => { HAPTICS_ON = save.settings.haptics; }, [save.settings.haptics]);

  return { save, ready, edit, reset: () => setSave(write(EMPTY_SAVE)) };
}

/* ==========================================================================
 * 5. UI PRIMITIVES
 * ========================================================================== */

let UID = 0;
const useUid = (p: string) => useMemo(() => `${p}${++UID}`, [p]);
const q2 = (n: number) => Math.round(n * 100) / 100;

const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${q2(x + rad)} ${q2(y)}H${q2(x + w - rad)}A${q2(rad)} ${q2(rad)} 0 0 1 ${q2(x + w)} ${q2(y + rad)}` +
    `V${q2(y + h - rad)}A${q2(rad)} ${q2(rad)} 0 0 1 ${q2(x + w - rad)} ${q2(y + h)}` +
    `H${q2(x + rad)}A${q2(rad)} ${q2(rad)} 0 0 1 ${q2(x)} ${q2(y + h - rad)}` +
    `V${q2(y + rad)}A${q2(rad)} ${q2(rad)} 0 0 1 ${q2(x + rad)} ${q2(y)}Z `
  );
};

const starPath = (cx: number, cy: number, outer: number, inner: number) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${q2(cx + Math.cos(a) * rad)} ${q2(cy + Math.sin(a) * rad)}`;
  }
  return `${d}Z`;
};

function Panel({
  children, style, radius = 22, tint = C.panel, border = C.cardEdge, glow, bare, bw = 1.5,
}: {
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number;
  tint?: string; border?: string; glow?: string;
  /** Border thickness. */
  bw?: number;
  /** Skip the navy base, for the few surfaces that must stay see-through. */
  bare?: boolean;
}) {
  return (
    <View style={[{ borderRadius: radius, zIndex: 0 }, style]}>
      {glow ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
          {[0.35, 0.7, 1].map((t, i) => (
            <View key={i} style={{
              position: 'absolute', top: -14 * t, left: -14 * t, right: -14 * t, bottom: -14 * t,
              borderRadius: radius + 14 * t, backgroundColor: glow, opacity: 0.12 * (1 - t * 0.6),
            }} />
          ))}
        </View>
      ) : null}
      {bare ? null : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: radius, backgroundColor: C.card }]} />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        zIndex: -1, borderRadius: radius, backgroundColor: tint, borderWidth: bw, borderColor: border,
      }]} />
      <View pointerEvents="none" style={{
        position: 'absolute', zIndex: -1, top: 1.5, left: 1.5, right: 1.5, height: radius,
        borderTopLeftRadius: radius - 1.5, borderTopRightRadius: radius - 1.5,
        backgroundColor: 'rgba(255,255,255,0.07)',
      }} />
      {children}
    </View>
  );
}

const AnimPressable = Animated.createAnimatedComponent(Pressable);

type IconName =
  | 'back' | 'next' | 'rotate' | 'crown' | 'star' | 'lock' | 'help' | 'grid'
  | 'crystal' | 'ice' | 'stone' | 'lines' | 'moves' | 'replay' | 'coin'
  | 'hammer' | 'rocket' | 'bomb' | 'shuffle' | 'magic' | 'color'
  | 'home' | 'map' | 'puzzle' | 'gift' | 'person' | 'pause' | 'gear'
  | 'chest' | 'trophy' | 'sound' | 'music' | 'globe' | 'check' | 'close' | 'play' | 'vibrate'
  | 'plus' | 'key' | 'info' | 'exit' | 'bulb' | 'undo';

function Icon({ name, size = 20, color = C.text }: { name: IconName; size?: number; color?: string }) {
  const sw = 2.2;
  const stroke = { fill: 'none' as const, stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' ? <Path d="M14.6 4.8 L8 12 L14.6 19.2" {...stroke} /> : null}
      {name === 'next' ? <Path d="M9.4 4.8 L16 12 L9.4 19.2" {...stroke} /> : null}
      {name === 'play' ? <Path d="M6.5 3.5 L19.5 12 L6.5 20.5 Z" fill={color} /> : null}
      {name === 'close' ? <Path d="M6 6 L18 18 M18 6 L6 18" {...stroke} /> : null}
      {name === 'check' ? <Path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" {...stroke} /> : null}
      {name === 'rotate' ? (
        <>
          <Path d="M12 4 A8 8 0 1 1 5.07 8" {...stroke} />
          <Path d="M10.6 0.8 L15.6 4 L10.6 7.2 Z" fill={color} />
        </>
      ) : null}
      {name === 'replay' ? (
        <>
          <Path d="M12 4 A8 8 0 1 0 18.93 8" {...stroke} />
          <Path d="M13.4 0.8 L8.4 4 L13.4 7.2 Z" fill={color} />
        </>
      ) : null}
      {name === 'crown' ? (
        <>
          <Path d="M2.5 8 L6.5 12 L12 4 L17.5 12 L21.5 8 L19.8 19 H4.2 Z" fill={color} />
          <Path d="M4.2 19 H19.8 V21.6 H4.2 Z" fill={color} fillOpacity={0.7} />
        </>
      ) : null}
      {name === 'star' ? <Path d={starPath(12, 12, 10.6, 4.6)} fill={color} /> : null}
      {name === 'coin' ? (
        <>
          <Circle cx={12} cy={12} r={9.6} fill={color} />
          <Circle cx={12} cy={12} r={6.6} fill="#000000" fillOpacity={0.14} />
          <Path d="M12 7.6 v8.8 M9.6 9.6 h4.8 M9.6 14.4 h4.8" stroke="#000000" strokeOpacity={0.25} strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'lock' ? (
        <>
          <Path d="M7.6 10.4 V7.6 a4.4 4.4 0 0 1 8.8 0 V10.4" {...stroke} />
          <Path d={roundRect(4.6, 10.2, 14.8, 10.6, 3)} fill={color} />
        </>
      ) : null}
      {name === 'help' ? (
        <>
          <Circle cx={12} cy={12} r={10} {...stroke} />
          <Path d="M8.8 9.2 a3.2 3.2 0 1 1 3.9 3.1 v1.9" {...stroke} />
          <Circle cx={12.4} cy={17.6} r={1.5} fill={color} />
        </>
      ) : null}
      {name === 'grid' || name === 'puzzle' ? (
        <>
          <Path d={roundRect(3, 3, 7.6, 7.6, 2.2)} fill={color} />
          <Path d={roundRect(13.4, 3, 7.6, 7.6, 2.2)} fill={color} fillOpacity={0.6} />
          <Path d={roundRect(3, 13.4, 7.6, 7.6, 2.2)} fill={color} fillOpacity={0.6} />
          <Path d={roundRect(13.4, 13.4, 7.6, 7.6, 2.2)} fill={color} />
        </>
      ) : null}
      {name === 'crystal' ? (
        <>
          <Path d="M12 1.6 L20.4 9 L12 22.4 L3.6 9 Z" fill={color} />
          <Path d="M12 1.6 L20.4 9 L12 11.4 Z" fill="#FFFFFF" fillOpacity={0.4} />
        </>
      ) : null}
      {name === 'ice' ? (
        <>
          <Path d={roundRect(3, 3, 18, 18, 4)} fill={color} fillOpacity={0.85} />
          <Path d="M7 8 L13 12 L9 16 M17 7 L13.5 13 L18 17" fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'stone' ? (
        <>
          <Path d={roundRect(3, 3, 18, 18, 4)} fill={color} />
          <Path d="M6.5 15 L10 8.5 L13.5 12.5 L10.5 17.5 Z" fill="#FFFFFF" fillOpacity={0.16} />
        </>
      ) : null}
      {name === 'lines' ? (
        <>
          <Path d={roundRect(2.5, 5, 19, 5.2, 1.8)} fill={color} />
          <Path d={roundRect(2.5, 13.8, 19, 5.2, 1.8)} fill={color} fillOpacity={0.55} />
        </>
      ) : null}
      {name === 'moves' ? (
        <>
          <Circle cx={12} cy={12} r={9.4} {...stroke} />
          <Path d="M12 6.6 V12 L15.8 14.4" {...stroke} />
        </>
      ) : null}
      {name === 'hammer' ? (
        <>
          <Path d="M13.6 3 L21 10.4 L17.8 13.6 L10.4 6.2 Z" fill={color} />
          <Path d="M11.2 8.6 L4 15.8 a2 2 0 0 0 0 2.8 l1.4 1.4 a2 2 0 0 0 2.8 0 L15.4 12.8 Z" fill={color} fillOpacity={0.75} />
        </>
      ) : null}
      {name === 'rocket' ? (
        <>
          <Path d="M12 1.4 c3.4 3 5.2 7 5.2 11.2 L12 17.4 L6.8 12.6 C6.8 8.4 8.6 4.4 12 1.4 Z" fill={color} />
          <Circle cx={12} cy={9.2} r={2.2} fill="#000000" fillOpacity={0.3} />
          <Path d="M9.4 18 L12 23 L14.6 18 Z" fill={color} fillOpacity={0.7} />
        </>
      ) : null}
      {name === 'bomb' ? (
        <>
          <Circle cx={10.6} cy={14.6} r={7.4} fill={color} />
          <Path d="M15.4 8.2 L18.2 5.4" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M18.6 5 a2.4 2.4 0 1 1 3 -2.2" {...stroke} />
        </>
      ) : null}
      {name === 'shuffle' ? (
        <>
          <Path d="M3 6.5 h4 L17 17.5 h4 M3 17.5 h4 L11 12" {...stroke} />
          <Path d="M18 14.6 L21.6 17.5 L18 20.4 Z M18 3.6 L21.6 6.5 L18 9.4 Z" fill={color} />
        </>
      ) : null}
      {name === 'magic' ? (
        <>
          <Path d="M4.4 19.6 L15 9 l-0.6-0.6 L3.8 19 Z" fill={color} fillOpacity={0.8} />
          <Path d="M17.4 2.4 L18.6 5.6 L21.8 6.8 L18.6 8 L17.4 11.2 L16.2 8 L13 6.8 L16.2 5.6 Z" fill={color} />
          <Path d="M8 3 L8.7 4.9 L10.6 5.6 L8.7 6.3 L8 8.2 L7.3 6.3 L5.4 5.6 L7.3 4.9 Z" fill={color} fillOpacity={0.8} />
        </>
      ) : null}
      {name === 'color' ? (
        <>
          <Path d={roundRect(2.6, 2.6, 8.4, 8.4, 2.4)} fill={color} />
          <Path d={roundRect(13, 2.6, 8.4, 8.4, 2.4)} fill={color} fillOpacity={0.4} />
          <Path d={roundRect(2.6, 13, 8.4, 8.4, 2.4)} fill={color} fillOpacity={0.4} />
          <Path d="M17.2 12.4 l1.4 3.4 l3.4 1.4 l-3.4 1.4 l-1.4 3.4 l-1.4 -3.4 l-3.4 -1.4 l3.4 -1.4 Z" fill={color} />
        </>
      ) : null}
      {name === 'home' ? (
        <>
          <Path d="M3 11 L12 3 L21 11" {...stroke} />
          <Path d={roundRect(5.6, 10.6, 12.8, 10.4, 2.4)} fill={color} />
        </>
      ) : null}
      {name === 'map' ? (
        <>
          <Path d="M3 6 L9 3 L15 6 L21 3 V18 L15 21 L9 18 L3 21 Z" {...stroke} />
          <Path d="M9 3 V18 M15 6 V21" stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        </>
      ) : null}
      {name === 'gift' ? (
        <>
          <Path d={roundRect(3, 8.4, 18, 4.2, 1.4)} fill={color} />
          <Path d={roundRect(4.6, 12.6, 14.8, 8.4, 1.8)} fill={color} fillOpacity={0.8} />
          <Path d="M10.4 8.4 V21 h3.2 V8.4 Z" fill="#000000" fillOpacity={0.2} />
          <Path d="M12 8 c-3.6 0 -5.4 -1.2 -5.4 -3 a2.4 2.4 0 0 1 4.6 -0.9 Z M12 8 c3.6 0 5.4 -1.2 5.4 -3 a2.4 2.4 0 0 0 -4.6 -0.9 Z" fill={color} />
        </>
      ) : null}
      {name === 'chest' ? (
        <>
          <Path d="M3.4 10.6 a8.6 8.6 0 0 1 17.2 0 Z" fill={color} />
          <Path d={roundRect(3.4, 10.6, 17.2, 9.4, 1.8)} fill={color} fillOpacity={0.8} />
          <Path d={roundRect(10.4, 8.6, 3.2, 6.2, 1)} fill="#000000" fillOpacity={0.3} />
        </>
      ) : null}
      {name === 'trophy' ? (
        <>
          <Path d="M7 3 h10 v5.4 a5 5 0 0 1 -10 0 Z" fill={color} />
          <Path d="M7 4.6 H4 v2 a3.4 3.4 0 0 0 3 3.4 M17 4.6 h3 v2 a3.4 3.4 0 0 1 -3 3.4" {...stroke} />
          <Path d="M10.4 13.4 h3.2 v4 h-3.2 Z M7.4 17.4 h9.2 v3.2 h-9.2 Z" fill={color} />
        </>
      ) : null}
      {name === 'person' ? (
        <>
          <Circle cx={12} cy={8} r={4.4} fill={color} />
          <Path d="M3.6 21.4 a8.4 8.4 0 0 1 16.8 0 Z" fill={color} fillOpacity={0.85} />
        </>
      ) : null}
      {name === 'pause' ? (
        <>
          <Path d={roundRect(6.4, 4.4, 4, 15.2, 1.6)} fill={color} />
          <Path d={roundRect(13.6, 4.4, 4, 15.2, 1.6)} fill={color} />
        </>
      ) : null}
      {name === 'gear' ? (
        <>
          <Circle cx={12} cy={12} r={3.4} {...stroke} />
          <Path d="M12 2.4 l1.6 2.6 h2.9 l1.1 2.7 l2.4 1.6 l-0.6 2.9 l0.6 2.9 l-2.4 1.6 l-1.1 2.7 h-2.9 L12 21.6 l-1.6 -2.6 H7.5 l-1.1 -2.7 l-2.4 -1.6 l0.6 -2.9 l-0.6 -2.9 l2.4 -1.6 l1.1 -2.7 h2.9 Z" {...stroke} />
        </>
      ) : null}
      {name === 'sound' ? (
        <>
          <Path d="M4 9 h3.6 L13 4.4 v15.2 L7.6 15 H4 Z" fill={color} />
          <Path d="M16.4 8.6 a4.8 4.8 0 0 1 0 6.8 M19 6 a8.4 8.4 0 0 1 0 12" {...stroke} />
        </>
      ) : null}
      {name === 'music' ? (
        <>
          <Path d="M9.4 18 V6.2 L20 4 v11.6" {...stroke} />
          <Circle cx={6.6} cy={18} r={3} fill={color} />
          <Circle cx={17.2} cy={15.6} r={3} fill={color} />
        </>
      ) : null}
      {name === 'vibrate' ? (
        <>
          <Path d={roundRect(7.6, 2.6, 8.8, 18.8, 2.6)} fill={color} />
          <Path d="M3.4 9 v6 M20.6 9 v6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'plus' ? <Path d="M12 5 V19 M5 12 H19" {...stroke} strokeWidth={3.2} /> : null}
      {name === 'info' ? (
        <>
          <Circle cx={12} cy={12} r={9.6} {...stroke} />
          <Path d="M12 11 V17" {...stroke} />
          <Circle cx={12} cy={7.4} r={1.5} fill={color} />
        </>
      ) : null}
      {name === 'key' ? (
        <>
          <Circle cx={7.6} cy={7.6} r={4.8} {...stroke} />
          <Path d="M11.2 11.2 L20.6 20.6 M16.4 16.4 L19 13.8 M18.6 18.6 L21.2 16" {...stroke} />
        </>
      ) : null}
      {name === 'exit' ? (
        <>
          <Path d="M9 4 H5 V20 H9" {...stroke} />
          <Path d="M11 12 H21 M17 8 L21 12 L17 16" {...stroke} />
        </>
      ) : null}
      {name === 'bulb' ? (
        <>
          <Path d="M12 2.6 a6.4 6.4 0 0 0 -3.8 11.6 c0.8 0.6 1.2 1.4 1.2 2.4 h5.2 c0 -1 0.4 -1.8 1.2 -2.4 A6.4 6.4 0 0 0 12 2.6 Z" fill={color} />
          <Path d="M9.6 19.2 h4.8 M10.6 21.6 h2.8" {...stroke} />
        </>
      ) : null}
      {name === 'undo' ? (
        <>
          <Path d="M8.6 5.4 L3.8 10.2 L8.6 15" {...stroke} />
          <Path d="M4.4 10.2 H14.4 a5.4 5.4 0 0 1 0 10.8 H9" {...stroke} />
        </>
      ) : null}
      {name === 'globe' ? (
        <>
          <Circle cx={12} cy={12} r={9.4} {...stroke} />
          <Path d="M2.8 12 h18.4 M12 2.6 c3 3 3 15.8 0 18.8 c-3 -3 -3 -15.8 0 -18.8" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Round / square badges and stars are Kenney's UI Pack (CC0, see
 * assets/ui/LICENSE-kenney-ui-pack.txt). Buttons are drawn in code (see Candy).
 */
const UI = {
  round: {
    yellow: require('./assets/ui/round_yellow.png'), blue: require('./assets/ui/round_blue.png'),
    green: require('./assets/ui/round_green.png'), red: require('./assets/ui/round_red.png'),
    grey: require('./assets/ui/round_grey.png'),
  },
  square: {
    yellow: require('./assets/ui/square_yellow.png'), blue: require('./assets/ui/square_blue.png'),
    green: require('./assets/ui/square_green.png'), red: require('./assets/ui/square_red.png'),
    grey: require('./assets/ui/square_grey.png'),
  },
  star: require('./assets/ui/star.png'),
  starOff: require('./assets/ui/star_off.png'),
};

/* --- candy buttons ---------------------------------------------------------
 * Glossy, chunky, rounded buttons in the style of the reference Pause screen:
 * a bright top-lit gradient, a darker outline, a thick darker "lip" underneath
 * that the button sinks into when pressed, a soft gloss band, and white text
 * with a dark outline. Drawn from Views + gradients, no images.              */

type CandyName = 'green' | 'blue' | 'gold' | 'purple' | 'red' | 'slate';
const CANDY: Record<CandyName, { top: string; bot: string; lip: string; edge: string; ink: string }> = {
  green: { top: '#86E64E', bot: '#39B62B', lip: '#23851D', edge: '#1F6B1B', ink: '#14561A' },
  blue: { top: '#62B0FF', bot: '#2A6EE0', lip: '#1B49AC', edge: '#173E93', ink: '#123A85' },
  gold: { top: '#FFDE55', bot: '#F5A61B', lip: '#BA7407', edge: '#9C5F05', ink: '#7A4300' },
  purple: { top: '#BE7CF5', bot: '#8B3FDA', lip: '#5E22A5', edge: '#4E1B8C', ink: '#3F1478' },
  red: { top: '#FF806E', bot: '#E23A30', lip: '#A01F19', edge: '#861812', ink: '#6F100C' },
  slate: { top: '#8797C4', bot: '#56679A', lip: '#37466E', edge: '#2C3A5E', ink: '#22304F' },
};

/** The candy face itself: fills its parent, which sets the height. */
function Candy({ tone, height, radius }: { tone: CandyName; height: number; radius?: number }) {
  const c = CANDY[tone];
  const R = radius ?? Math.round(height * 0.3);
  const lip = Math.max(3, Math.round(height * 0.1));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: R, backgroundColor: c.lip }]} />
      <View style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: lip, borderRadius: R,
        overflow: 'hidden', borderWidth: 2, borderColor: c.edge,
      }}>
        <LinearGradient colors={gc(c.top, c.bot)} style={StyleSheet.absoluteFill} />
        <View style={{
          position: 'absolute', top: 2, left: R * 0.55, right: R * 0.55, height: height * 0.3,
          borderRadius: height * 0.15, backgroundColor: 'rgba(255,255,255,0.3)',
        }} />
      </View>
    </View>
  );
}

/** White lettering with a dark outline, like the reference buttons. */
function OutlineText({ children, size, ink, letterSpacing = 1, color = '#FFFFFF' }: {
  children: string; size: number; ink: string; letterSpacing?: number; color?: string;
}) {
  const o = Math.max(1, size / 13);
  const base = { fontSize: size, letterSpacing } as const;
  const copies: [number, number][] = [[-o, -o], [o, -o], [-o, o], [o, o], [0, o * 1.9], [-o, 0], [o, 0]];
  return (
    <View>
      {copies.map(([dx, dy], i) => (
        <Text key={i} numberOfLines={1} style={[base, { position: 'absolute', left: dx, top: dy, color: ink }]}>{children}</Text>
      ))}
      <Text numberOfLines={1} style={[base, { color }]}>{children}</Text>
    </View>
  );
}

type BtnTone = 'gold' | 'glass' | 'danger' | 'green' | 'violet' | 'blue';
/** Which candy colour each tone uses. */
const TONE_CANDY: Record<BtnTone, CandyName> = {
  gold: 'gold', glass: 'slate', danger: 'red', green: 'green', violet: 'purple', blue: 'blue',
};

function Btn({
  label, icon, tone = 'glass', onPress, disabled, style, compact, radius: _radius, big, pad, iconLeft,
}: {
  label?: string; icon?: IconName; tone?: BtnTone; onPress: () => void;
  disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean; radius?: number; big?: boolean;
  /** Horizontal padding, for buttons that share a row. */
  pad?: number;
  /** Pin the icon to the left edge and centre the label, like the reference buttons. */
  iconLeft?: boolean;
}) {
  const press = useSharedValue(0);
  const candy = TONE_CANDY[tone];
  const H = big ? 60 : compact ? 42 : 52;
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 3 }],
    opacity: disabled ? 0.4 : 1,
  }));

  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={label}
      style={[aStyle, style]}
      disabled={disabled}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{
        height: H, paddingHorizontal: pad ?? (compact ? 14 : 20), paddingBottom: Math.round(H * 0.1),
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
      }}>
        <Candy tone={candy} height={H} />
        {icon && iconLeft ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: big ? 16 : 10, top: 0, bottom: Math.round(H * 0.1), justifyContent: 'center', zIndex: 1 }}>
            <Icon name={icon} size={big ? 26 : compact ? 16 : 22} color="#FFFFFF" />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: label && icon && !iconLeft ? 9 : 0, zIndex: 1, paddingLeft: iconLeft ? (big ? 14 : 22) : 0 }}>
          {icon && !iconLeft ? <Icon name={icon} size={big ? 24 : compact ? 16 : 20} color="#FFFFFF" /> : null}
          {label ? <OutlineText size={big ? 20 : compact ? 13 : 16} ink={CANDY[candy].ink}>{label}</OutlineText> : null}
        </View>
      </View>
    </AnimPressable>
  );
}

function IconBtn({ name, onPress, size = 42, color = C.text, badge }: {
  name: IconName; onPress: () => void; size?: number; color?: string; badge?: boolean;
}) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }] }));
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={name}
      hitSlop={8} style={[{ width: size, height: size }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <Candy tone="blue" height={size} radius={Math.round(size * 0.3)} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: size * 0.07, zIndex: 1 }]}>
        <Icon name={name} size={size * 0.46} color={color} />
      </View>
      {badge ? (
        <View style={{
          position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: 7,
          backgroundColor: C.no, borderWidth: 2, borderColor: '#1B0A4A', zIndex: 2,
        }} />
      ) : null}
    </AnimPressable>
  );
}

/** A small switch built out of the same chunky language as the buttons. */
function Toggle({ on, onPress, light }: { on: boolean; onPress: () => void; light?: boolean }) {
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.value = withTiming(on ? 1 : 0, { duration: 180, easing: EASE_OUT }); }, [on, t]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 22 }] }));
  const fill = useAnimatedStyle(() => ({ opacity: t.value }));
  return (
    <Pressable onPress={() => { tapFx(); onPress(); }} hitSlop={8}>
      <View style={{
        width: 52, height: 30, borderRadius: 15, justifyContent: 'center', padding: 3, borderWidth: 1.5,
        backgroundColor: light ? 'rgba(120,80,30,0.3)' : 'rgba(10,6,40,0.7)',
        borderColor: light ? (on ? '#2E8A3A' : 'rgba(120,80,30,0.45)') : 'rgba(255,255,255,0.22)',
      }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 15, overflow: 'hidden' }, fill]}>
          <LinearGradient colors={gc('#8EE896', '#3CB44A')} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[{
          width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
        }, knob]} />
      </View>
    </Pressable>
  );
}

/* --- celebration ---------------------------------------------------------- */

/** Confetti / fireworks. One Animated.View per piece, all on the UI thread. */
function Confetti({ count = 34, burstFrom }: { count?: number; burstFrom?: { x: number; y: number } }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => {
    let seed = 99991;
    const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    return Array.from({ length: count }, () => ({
      x: burstFrom ? burstFrom.x : next() * width,
      y: burstFrom ? burstFrom.y : -20,
      angle: next() * Math.PI * 2,
      dist: 90 + next() * 220,
      size: 7 + next() * 11,
      delay: next() * 420,
      dur: 900 + next() * 900,
      spin: (next() > 0.5 ? 1 : -1) * (180 + next() * 360),
      color: Math.floor(next() * BRICKS.length),
      round: next() > 0.55,
    }));
  }, [count, width, burstFrom]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} {...p} fall={!burstFrom} height={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  x, y, angle, dist, size, delay, dur, spin, color, round, fall, height,
}: {
  x: number; y: number; angle: number; dist: number; size: number; delay: number;
  dur: number; spin: number; color: number; round: boolean; fall: boolean; height: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: dur, easing: EASE_OUT }));
    return () => cancelAnimation(t);
  }, [t, delay, dur]);

  const aStyle = useAnimatedStyle(() => {
    // A burst flies outward then droops; a fall drifts down the whole screen.
    const dx = fall ? Math.sin(t.value * Math.PI * 2.4) * 34 : Math.cos(angle) * dist * t.value;
    const dy = fall
      ? t.value * (height + 80)
      : Math.sin(angle) * dist * t.value + t.value * t.value * 150;
    return {
      opacity: t.value > 0.72 ? 1 - (t.value - 0.72) / 0.28 : 1,
      transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${t.value * spin}deg` }],
    };
  });

  const b = BRICKS[color];
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, aStyle]}>
      <View style={{
        width: size, height: round ? size : size * 0.6,
        borderRadius: round ? size / 2 : 2,
        backgroundColor: b.mid,
        borderBottomWidth: round ? 0 : 2, borderBottomColor: b.dark,
      }} />
    </Animated.View>
  );
}


/* ==========================================================================
 * BACKDROPS
 *
 *   HomeBackdrop    — the welcome scene's floating islands, tinted for Home
 *   src/worlds      — the five illustrated Adventure worlds (react-native-svg)
 *   Backdrop        — the deep navy shown while the app loads
 * ========================================================================== */

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* --- the gameplay backdrop -------------------------------------------------- */

/** Deep navy, with a faint glow at the top. The board is the star here. */
function Backdrop({ skin: _skin }: { skin: number }) {
  const { width, height } = useWindowDimensions();
  const sparks = useMemo(() => {
    const r = seeded(424242);
    return Array.from({ length: 60 }, () => ({ x: r() * width, y: r() * height, r: 0.5 + r() * 1.4, o: 0.1 + r() * 0.35 }));
  }, [width, height]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={gc('#12256E', '#0B1745', '#070E2E')} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {sparks.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#FFFFFF" opacity={p.o} />)}
      </Svg>
    </View>
  );
}

/* ==========================================================================
 * 6. BRICKS + BOARD
 * ========================================================================== */

/**
 * The toy bricks. Every colour is a glossy tile with a recessed panel and its own
 * symbol stamped on it, like the blocks in the reference: a dark block underneath
 * is the extruded side, a bright gradient face sits on top of it, and a light
 * symbol with a soft shadow is pressed into the middle.
 */
type BrickGlyph = 'heart' | 'triangle' | 'coin' | 'clover' | 'hex' | 'diamond' | 'star' | 'flower';
/** One symbol per colour, in BRICKS order: red, orange, yellow, green, cyan, blue, purple, pink. */
const BRICK_GLYPH: BrickGlyph[] = ['heart', 'triangle', 'coin', 'clover', 'hex', 'diamond', 'star', 'flower'];

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
/** The stamped symbol is a pale tint of the brick's own light colour. */
const BRICK_INK = BRICKS.map((b) => ({ glyph: mixHex(b.lo, '#FFFFFF', 0.5), shade: b.dark }));

const circleD = (cx: number, cy: number, r: number, cw = false) =>
  `M${q2(cx - r)} ${q2(cy)}a${q2(r)} ${q2(r)} 0 1 ${cw ? 1 : 0} ${q2(r * 2)} 0a${q2(r)} ${q2(r)} 0 1 ${cw ? 1 : 0} ${q2(-r * 2)} 0Z`;

/** A symbol as a path centred on (cx, cy), about half a cell wide. */
function glyphD(kind: BrickGlyph, cx: number, cy: number, size: number): string {
  const s = size * 0.0108;
  const P = (x: number, y: number) => `${q2(cx + x * s)} ${q2(cy + y * s)}`;
  switch (kind) {
    case 'star': return starPath(cx, cy + s, 23 * s, 10.4 * s);
    case 'heart':
      return `M${P(0, 19)}C${P(-19, 6)} ${P(-24, -6)} ${P(-18, -13)}C${P(-12, -20)} ${P(-3, -17)} ${P(0, -9)}`
        + `C${P(3, -17)} ${P(12, -20)} ${P(18, -13)}C${P(24, -6)} ${P(19, 6)} ${P(0, 19)}Z`;
    case 'triangle': return `M${P(0, -21)}L${P(22, 16)}L${P(-22, 16)}Z`;
    case 'diamond': return `M${P(0, -24)}L${P(21, 0)}L${P(0, 24)}L${P(-21, 0)}Z`;
    case 'coin': return circleD(cx, cy, 20 * s) + circleD(cx, cy, 10.5 * s, true);
    case 'clover':
      return circleD(cx, cy - 10 * s, 10.5 * s) + circleD(cx - 11.5 * s, cy + 6 * s, 10.5 * s)
        + circleD(cx + 11.5 * s, cy + 6 * s, 10.5 * s) + circleD(cx, cy + 1 * s, 8 * s)
        + `M${P(0, 8)}L${P(-4.5, 22)}L${P(4.5, 22)}Z`;
    case 'hex': {
      let d = '';
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        d += `${i === 0 ? 'M' : 'L'}${P(Math.cos(a) * 22, Math.sin(a) * 22)}`;
      }
      return `${d}Z`;
    }
    default: {
      let d = circleD(cx, cy, 8 * s);
      for (let i = 0; i < 5; i++) {
        const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
        d += circleD(cx + Math.cos(a) * 12.5 * s, cy + Math.sin(a) * 12.5 * s, 9.5 * s);
      }
      return d;
    }
  }
}

function brickPaths(x: number, y: number, size: number) {
  const pad = size * 0.045;
  const w = size - pad * 2;
  const depth = Math.max(2.4, size * 0.1);
  const rad = size * 0.22;
  const fh = w - depth;
  const ix = size * 0.12;
  return {
    side: roundRect(x + pad, y + pad, w, w, rad),
    face: roundRect(x + pad, y + pad, w, fh, rad),
    inner: roundRect(x + pad + ix, y + pad + ix, w - ix * 2, fh - ix * 2, rad * 0.55),
    gloss: roundRect(x + pad + w * 0.12, y + pad + w * 0.07, w * 0.76, fh * 0.24, rad * 0.5),
    cx: x + size / 2,
    cy: y + pad + fh / 2,
  };
}

function Bricks({
  cells, size, color, ghost, shadow = true,
}: { cells: Cell[]; size: number; color: number; ghost?: boolean; shadow?: boolean }) {
  const uid = useUid('bk');
  const col = color % BRICKS.length;
  const b = BRICKS[col];
  const ink = BRICK_INK[col];
  const key = cells.map((c) => `${c.r},${c.c}`).join('|');
  const maxR = Math.max(...cells.map((c) => c.r));
  const maxC = Math.max(...cells.map((c) => c.c));
  const W = (maxC + 1) * size;
  const H = (maxR + 1) * size;

  const p = useMemo(() => {
    let side = '';
    let face = '';
    let inner = '';
    let gloss = '';
    let glyph = '';
    for (const c of cells) {
      const g = brickPaths(c.c * size, c.r * size, size);
      side += g.side;
      face += g.face;
      inner += g.inner;
      gloss += g.gloss;
      glyph += glyphD(BRICK_GLYPH[col], g.cx, g.cy, size);
    }
    return { side, face, inner, gloss, glyph };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size, col]);

  const pad = size * 0.3;
  const sw = Math.max(0.8, size * 0.045);
  return (
    <Svg width={W + pad * 2} height={H + pad * 2}
      style={{ position: 'absolute', left: -pad, top: -pad }} pointerEvents="none">
      <Defs>
        <SvgLinear id={`${uid}f`} x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor={b.lo} />
          <Stop offset="0.55" stopColor={b.mid} />
          <Stop offset="1" stopColor={b.mid} />
        </SvgLinear>
      </Defs>
      <G transform={`translate(${pad},${pad})`}>
        {shadow && !ghost ? (
          <G transform={`translate(0,${q2(size * 0.13)})`} opacity={0.3}>
            <Path d={p.side} fill="#0A0428" />
          </G>
        ) : null}
        <Path d={p.side} fill={ghost ? 'rgba(255,255,255,0.2)' : b.dark} />
        <Path d={p.face} fill={ghost ? 'rgba(255,255,255,0.34)' : `url(#${uid}f)`} />
        {ghost ? null : <Path d={p.face} fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.1} />}
        {ghost ? null : <Path d={p.inner} fill="#000000" fillOpacity={0.1} />}
        <Path d={p.gloss} fill="#FFFFFF" fillOpacity={ghost ? 0.18 : 0.34} />
        {ghost ? null : (
          <>
            <G transform={`translate(0,${q2(size * 0.035)})`}>
              <Path d={p.glyph} fill={ink.shade} stroke={ink.shade} strokeWidth={sw} strokeLinejoin="round" opacity={0.6} />
            </G>
            <Path d={p.glyph} fill={ink.glyph} stroke={ink.glyph} strokeWidth={sw} strokeLinejoin="round" />
          </>
        )}
      </G>
    </Svg>
  );
}

/** The 8x8 well: empty sockets, plus stone, crystal, ice and placed bricks. */
function BoardView({
  board, size, highlight, aim,
}: { board: BoardState; size: number; highlight: Set<number>; aim: Set<number> }) {
  const uid = useUid('bd');
  const W = N * size;

  const layers = useMemo(() => {
    const socket: string[] = [];
    const sides: string[][] = BRICKS.map(() => []);
    const faces: string[][] = BRICKS.map(() => []);
    const inners: string[][] = BRICKS.map(() => []);
    const gloss: string[][] = BRICKS.map(() => []);
    const glyphs: string[][] = BRICKS.map(() => []);
    let stone = '';
    let stoneFacet = '';
    const crystals: { x: number; y: number }[] = [];
    const ices: { x: number; y: number }[] = [];

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = idx(r, c);
        const x = c * size;
        const y = r * size;
        const g = brickPaths(x, y, size);
        if (!board.occ[k]) {
          socket.push(roundRect(x + size * 0.05, y + size * 0.05, size * 0.9, size * 0.9, size * 0.18));
          continue;
        }
        if (board.kind[k] === KIND_STONE) {
          stone += g.side;
          stoneFacet +=
            `M${q2(x + size * 0.24)} ${q2(y + size * 0.7)}L${q2(x + size * 0.46)} ${q2(y + size * 0.24)}` +
            `L${q2(x + size * 0.68)} ${q2(y + size * 0.5)}L${q2(x + size * 0.44)} ${q2(y + size * 0.78)}Z `;
        } else if (board.kind[k] === KIND_CRYSTAL) {
          crystals.push({ x, y });
        } else if (board.kind[k] === KIND_ICE) {
          ices.push({ x, y });
        } else {
          const col = Math.max(0, board.color[k]) % BRICKS.length;
          sides[col].push(g.side);
          faces[col].push(g.face);
          inners[col].push(g.inner);
          gloss[col].push(g.gloss);
          glyphs[col].push(glyphD(BRICK_GLYPH[col], g.cx, g.cy, size));
        }
      }
    }
    return { socket: socket.join(''), sides, faces, inners, gloss, glyphs, stone, stoneFacet, crystals, ices };
  }, [board, size]);

  const cellsPath = (set: Set<number>, inset: number) =>
    Array.from(set).map((k) => {
      const r = (k / N) | 0;
      const c = k % N;
      return roundRect(c * size + size * inset, r * size + size * inset,
        size * (1 - inset * 2), size * (1 - inset * 2), size * 0.22);
    }).join('');

  const sw = Math.max(0.8, size * 0.045);

  return (
    <Svg width={W} height={W} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {BRICKS.map((b, i) => (
          <SvgLinear key={i} id={`${uid}f${i}`} x1="0.3" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={b.lo} />
            <Stop offset="0.55" stopColor={b.mid} />
            <Stop offset="1" stopColor={b.mid} />
          </SvgLinear>
        ))}
        <SvgLinear id={`${uid}stone`} x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#8A85AE" />
          <Stop offset="1" stopColor="#4A4570" />
        </SvgLinear>
        <SvgLinear id={`${uid}ice`} x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#E4FAFF" />
          <Stop offset="1" stopColor="#7FD4F5" />
        </SvgLinear>
      </Defs>

      {/* the empty sockets: dark navy tiles with a faint edge */}
      <Path d={layers.socket} fill="#1A2350" />
      <Path d={layers.socket} fill="none" stroke="#3A4C94" strokeOpacity={0.55} strokeWidth={1} />

      {/* the line that is about to blast */}
      {highlight.size > 0 ? <Path d={cellsPath(highlight, 0.06)} fill="#FFFFFF" fillOpacity={0.2} /> : null}

      {layers.stone ? (
        <>
          <Path d={layers.stone} fill="#2B2749" />
          <Path d={layers.stone} fill={`url(#${uid}stone)`} fillOpacity={0.85} />
          <Path d={layers.stoneFacet} fill="#FFFFFF" fillOpacity={0.14} />
        </>
      ) : null}

      {/* placed bricks, batched per colour so the board is a handful of paths */}
      {BRICKS.map((b, i) => (
        layers.sides[i].length ? (
          <G key={i}>
            <Path d={layers.sides[i].join('')} fill={b.dark} />
            <Path d={layers.faces[i].join('')} fill={`url(#${uid}f${i})`} />
            <Path d={layers.faces[i].join('')} fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.1} />
            <Path d={layers.inners[i].join('')} fill="#000000" fillOpacity={0.1} />
            <Path d={layers.gloss[i].join('')} fill="#FFFFFF" fillOpacity={0.34} />
            <G transform={`translate(0,${q2(size * 0.035)})`}>
              <Path d={layers.glyphs[i].join('')} fill={BRICK_INK[i].shade} stroke={BRICK_INK[i].shade}
                strokeWidth={sw} strokeLinejoin="round" opacity={0.6} />
            </G>
            <Path d={layers.glyphs[i].join('')} fill={BRICK_INK[i].glyph} stroke={BRICK_INK[i].glyph}
              strokeWidth={sw} strokeLinejoin="round" />
          </G>
        ) : null
      ))}

      {layers.ices.map((p, i) => {
        const g = brickPaths(p.x, p.y, size);
        return (
          <G key={`i${i}`}>
            <Path d={g.side} fill="#3E8FB8" />
            <Path d={g.face} fill={`url(#${uid}ice)`} />
            <Path
              d={`M${q2(p.x + size * 0.28)} ${q2(p.y + size * 0.24)}L${q2(p.x + size * 0.52)} ${q2(p.y + size * 0.46)}L${q2(p.x + size * 0.34)} ${q2(p.y + size * 0.66)}`}
              fill="none" stroke="#FFFFFF" strokeOpacity={0.9}
              strokeWidth={Math.max(1.2, size * 0.055)} strokeLinecap="round"
            />
            <Path
              d={`M${q2(p.x + size * 0.7)} ${q2(p.y + size * 0.26)}L${q2(p.x + size * 0.58)} ${q2(p.y + size * 0.56)}`}
              fill="none" stroke="#FFFFFF" strokeOpacity={0.7}
              strokeWidth={Math.max(1, size * 0.045)} strokeLinecap="round"
            />
          </G>
        );
      })}

      {layers.crystals.map((p, i) => {
        const cx = p.x + size / 2;
        const cy = p.y + size / 2;
        const rad = size * 0.34;
        return (
          <G key={`c${i}`}>
            <Circle cx={cx} cy={cy} r={rad * 1.5} fill={C.crystal} fillOpacity={0.2} />
            <Path d={`M${q2(cx)} ${q2(cy - rad)}L${q2(cx + rad * 0.86)} ${q2(cy - rad * 0.1)}L${q2(cx)} ${q2(cy + rad)}L${q2(cx - rad * 0.86)} ${q2(cy - rad * 0.1)}Z`} fill={C.crystal} />
            <Path d={`M${q2(cx)} ${q2(cy - rad)}L${q2(cx + rad * 0.86)} ${q2(cy - rad * 0.1)}L${q2(cx)} ${q2(cy + rad * 0.08)}Z`} fill="#FFFFFF" fillOpacity={0.55} />
            <Path d={`M${q2(cx)} ${q2(cy - rad)}L${q2(cx - rad * 0.86)} ${q2(cy - rad * 0.1)}L${q2(cx)} ${q2(cy + rad * 0.08)}Z`} fill="#FFFFFF" fillOpacity={0.25} />
          </G>
        );
      })}

      {/* what an armed power-up is about to hit */}
      {aim.size > 0 ? (
        <>
          <Path d={cellsPath(aim, 0.04)} fill={C.gold} fillOpacity={0.3} />
          <Path d={cellsPath(aim, 0.04)} fill="none" stroke={C.goldHi} strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
}

/** Cells flying apart after a blast, plus a few sparks. */
function ClearBurst({ cells, size, onDone }: { cells: number[]; size: number; onDone: () => void }) {
  const t = useSharedValue(0);
  // `onDone` is a fresh closure every parent render; keep it in a ref so a
  // re-render mid-drag does not restart the animation and its timer.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    t.value = withTiming(1, { duration: 440, easing: EASE_OUT });
    const id = setTimeout(() => doneRef.current(), 480);
    return () => { cancelAnimation(t); clearTimeout(id); };
  }, [t]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 1 + t.value * 0.5 }],
  }));
  const d = useMemo(
    () => cells.map((k) => {
      const r = (k / N) | 0;
      const c = k % N;
      return roundRect(c * size + size * 0.06, r * size + size * 0.06, size * 0.88, size * 0.88, size * 0.24);
    }).join(''),
    [cells, size],
  );
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, aStyle]}>
      <Svg width={N * size} height={N * size}>
        <Path d={d} fill="#FFFFFF" fillOpacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

/* ==========================================================================
 * 7. DRAGGABLE BLOCK
 * ========================================================================== */

type DragApi = {
  hover: (slot: number, row: number, col: number, inRange: boolean) => void;
  drop: (slot: number, row: number, col: number, inRange: boolean) => boolean;
  turn: (slot: number) => void;
  grab: (slot: number) => void;
  slotHome: (slot: number) => { x: number; y: number; scale: number };
};
const ApiCtx = createContext<React.MutableRefObject<DragApi> | null>(null);
const useApi = () => {
  const ref = useContext(ApiCtx);
  if (!ref) throw new Error('DragApi unavailable');
  return ref;
};

/**
 * All props are primitives or stable shared values, so the React.memo wrapper
 * can skip every block that did not change while a drag streams hover updates
 * into the parent.
 */
function TrayBlockInner({
  slot, variant, color, cell, homeX, homeY, homeScale, active, locked,
  boardXsv, boardYsv, cellSv, turnTick, entryDelay,
}: {
  slot: number; variant: Variant; color: number; cell: number;
  homeX: number; homeY: number; homeScale: number;
  active: boolean; locked: boolean;
  boardXsv: SharedValue<number>; boardYsv: SharedValue<number>; cellSv: SharedValue<number>;
  turnTick: number; entryDelay: number;
}) {
  const api = useApi();
  const px = useSharedValue(homeX);
  const py = useSharedValue(homeY);
  const scale = useSharedValue(homeScale);
  const spin = useSharedValue(0);
  const enter = useSharedValue(0);
  const shake = useSharedValue(0);
  const dragging = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastCode = useSharedValue(-1);
  const restX = useSharedValue(homeX);
  const restY = useSharedValue(homeY);
  const restS = useSharedValue(homeScale);

  const draggingRef = useRef(false);
  const mounted = useRef(false);
  const turnRef = useRef(turnTick);
  const pad = cell * 0.3;

  useEffect(() => {
    enter.value = withDelay(entryDelay, withSpring(1, SPR_POP));
    return () => cancelAnimation(enter);
  }, [enter, entryDelay]);

  useEffect(() => {
    restX.value = homeX; restY.value = homeY; restS.value = homeScale;
    if (draggingRef.current) return;
    if (!mounted.current) {
      mounted.current = true;
      px.value = homeX; py.value = homeY; scale.value = homeScale;
      return;
    }
    px.value = withSpring(homeX, SPR_SNAP);
    py.value = withSpring(homeY, SPR_SNAP);
    scale.value = withSpring(homeScale, SPR_SNAP);
  }, [homeX, homeY, homeScale, px, py, scale, restX, restY, restS]);

  // One fixed quarter turn clockwise, on a curve that never overshoots.
  useEffect(() => {
    if (turnTick === turnRef.current) return;
    turnRef.current = turnTick;
    spin.value = withSequence(
      withTiming(-90, { duration: 0 }),
      withTiming(0, { duration: 230, easing: EASE_TURN }),
    );
  }, [turnTick, spin]);

  const onHover = useCallback((row: number, col: number, inRange: boolean) => {
    api.current.hover(slot, row, col, inRange);
  }, [api, slot]);

  const onDrop = useCallback((row: number, col: number, inRange: boolean) => {
    draggingRef.current = false;
    const ok = api.current.drop(slot, row, col, inRange);
    if (!ok) {
      const home = api.current.slotHome(slot);
      px.value = withSpring(home.x, SPR_BACK);
      py.value = withSpring(home.y, SPR_BACK);
      scale.value = withSpring(home.scale, SPR_BACK);
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
        withTiming(-5, { duration: 46 }), withTiming(0, { duration: 60 }),
      );
      haptic.err();
      playSfx('deny');
    }
  }, [api, slot, px, py, scale, shake]);

  const onGrab = useCallback(() => {
    draggingRef.current = true;
    api.current.grab(slot);
    haptic.light();
  }, [api, slot]);

  const onTurn = useCallback(() => {
    api.current.turn(slot);
    haptic.select();
    playSfx('rotate');
  }, [api, slot]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!locked)
    .minDistance(3)
    .onStart(() => {
      dragging.value = 1;
      lastCode.value = -1;
      startX.value = px.value;
      startY.value = py.value;
      scale.value = withSpring(1, SPR_SNAP);
      runOnJS(onGrab)();
    })
    .onUpdate((e) => {
      if (dragging.value !== 1) return;
      // Lift the block above the finger so the hand never covers it.
      let nx = startX.value + e.translationX;
      let ny = startY.value + e.translationY - cellSv.value * 1.1;
      const size = cellSv.value;
      const col = Math.round((nx - boardXsv.value) / size);
      const row = Math.round((ny - boardYsv.value) / size);
      const sx = boardXsv.value + col * size;
      const sy = boardYsv.value + row * size;
      const dx = nx - sx;
      const dy = ny - sy;
      const near = Math.sqrt(dx * dx + dy * dy) <= MAGNET;
      if (near) { nx += (sx - nx) * 0.62; ny += (sy - ny) * 0.62; }
      px.value = nx;
      py.value = ny;
      const code = near ? (row + 20) * 100 + (col + 20) : -1;
      if (code !== lastCode.value) {
        lastCode.value = code;
        runOnJS(onHover)(row, col, near);
      }
    })
    .onEnd((_e, success) => {
      dragging.value = 0;
      const size = cellSv.value;
      const col = Math.round((px.value - boardXsv.value) / size);
      const row = Math.round((py.value - boardYsv.value) / size);
      const dx = px.value - (boardXsv.value + col * size);
      const dy = py.value - (boardYsv.value + row * size);
      // A gesture the system cancelled (call, notification shade...) must send
      // the block home, not commit it wherever the finger last was.
      runOnJS(onDrop)(row, col, success && Math.sqrt(dx * dx + dy * dy) <= MAGNET);
    })
    .onFinalize(() => {
      if (dragging.value !== 1) return;
      dragging.value = 0;
      px.value = withSpring(restX.value, SPR_BACK);
      py.value = withSpring(restY.value, SPR_BACK);
      scale.value = withSpring(restS.value, SPR_BACK);
      runOnJS(onHover)(-99, -99, false);
    }),
  [locked, dragging, lastCode, startX, startY, px, py, scale, restX, restY, restS,
    boardXsv, boardYsv, cellSv, onGrab, onHover, onDrop]);

  const tap = useMemo(
    () => Gesture.Tap().enabled(!locked).maxDuration(280)
      .onEnd((_e, ok) => { if (ok) runOnJS(onTurn)(); }),
    [locked, onTurn],
  );
  const gesture = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: px.value - pad + shake.value },
      { translateY: py.value - pad },
      { scale: scale.value * (0.7 + enter.value * 0.3) },
      { rotate: `${spin.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[{
          position: 'absolute', left: 0, top: 0,
          width: variant.w * cell + pad * 2,
          height: variant.h * cell + pad * 2,
          zIndex: active ? 900 : 300,
        }, aStyle]}
      >
        <View style={{ position: 'absolute', left: pad, top: pad }}>
          <Bricks cells={variant.cells} size={cell} color={color} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const TrayBlock = React.memo(TrayBlockInner);

/* ==========================================================================
 * 9. TUTORIAL
 * ========================================================================== */






/** One-time card the first time a world introduces a new obstacle. */
const STAGE_BRIEF: Record<string, { icon: IconName; color: string; title: string; body: string } | undefined> = {
  w2: { icon: 'crystal', color: C.crystal, title: 'CRYSTALS', body: 'A crystal pops when a line clears through it. Pop every crystal to win the level.' },
  w3: { icon: 'ice', color: C.ice, title: 'ICE', body: 'Ice breaks when a line clears through it. Break all the ice to win the level.' },
  w4: { icon: 'stone', color: C.stone, title: 'STONE', body: 'Stone never clears and never moves — but it still counts as a filled square, so lines through it are easier.' },
  w5: { icon: 'trophy', color: C.gold, title: 'ALL AT ONCE', body: 'Crystals, ice and stone together. Clear every crystal AND every piece of ice to win.' },
};

function BriefCard({ id, onClose }: { id: string; onClose: () => void }) {
  const brief = STAGE_BRIEF[id];
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withSpring(1, { damping: 16, stiffness: 180 });
    return () => cancelAnimation(rise);
  }, [rise]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ scale: 0.85 + rise.value * 0.15 }],
  }));
  if (!brief) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 5000 }]}>
      <LinearGradient colors={gc('rgba(8,4,30,0.86)', 'rgba(14,8,44,0.94)')} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }}>
        <Animated.View style={[{ width: '100%', maxWidth: 340 }, aStyle]}>
          <Panel radius={26} tint="rgba(34,22,96,0.94)" glow={brief.color} style={{ padding: 24, alignItems: 'center' }}>
            <View style={{ marginBottom: 12 }}><Icon name={brief.icon} size={52} color={brief.color} /></View>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: 2 }}>{brief.title}</Text>
            <Text style={{ color: C.textDim, fontSize: 13.5, lineHeight: 21, textAlign: 'center', marginTop: 12 }}>
              {brief.body}
            </Text>
            <Btn label="GOT IT" tone="gold" onPress={onClose} style={{ marginTop: 20, alignSelf: 'stretch' }} />
          </Panel>
        </Animated.View>
      </View>
    </View>
  );
}

/* ==========================================================================
 * HUD PIECES
 * ========================================================================== */

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (n: number) => n.toLocaleString();

function ScoreBar({ score, small }: { score: number; small?: boolean }) {
  const pop = useSharedValue(0);
  const prev = useRef(score);
  useEffect(() => {
    if (score === prev.current) return;
    prev.current = score;
    pop.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 220 }));
  }, [score, pop]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.12 }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, aStyle]}>
      <Icon name="crown" size={small ? 15 : 22} color={C.gold} />
      <Text style={{
        color: '#FFFFFF', fontSize: small ? 19 : 28, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3,
      }}>
        {fmt(score)}
      </Text>
    </Animated.View>
  );
}




/** Live star meter: shows which tier the current score has reached. */
function StarMeter({ score, tiers }: { score: number; tiers: number[] }) {
  const got = score >= tiers[2] ? 3 : score >= tiers[1] ? 2 : score >= tiers[0] ? 1 : 0;
  const next = Math.min(2, got);
  const from = got === 0 ? 0 : tiers[got - 1];
  const to = tiers[next] || tiers[2];
  const pct = got >= 3 ? 1 : Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{
        flex: 1, height: 8, borderRadius: 4, overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
      }}>
        <View style={{ width: `${pct * 100}%`, height: '100%' }}>
          <LinearGradient colors={gc(C.goldHi, C.gold)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </View>
      </View>
      <MiniStars count={got} size={14} />
    </View>
  );
}

function StarRow({ count, size = 22, gap = 6, animate }: {
  count: number; size?: number; gap?: number; animate?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[0, 1, 2].map((i) => (
        <StarIcon key={i} filled={i < count} size={size} note={i} delay={animate ? 220 + i * 190 : undefined} />
      ))}
    </View>
  );
}

function StarIcon({ filled, size, delay, note = 0 }: { filled: boolean; size: number; delay?: number; note?: number }) {
  const pop = useSharedValue(delay === undefined ? 1 : 0);
  useEffect(() => {
    if (delay === undefined) return;
    pop.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 220 }));
    // Only lit stars ring; an empty one arrives silently.
    const id = filled ? setTimeout(() => playSfx((['star', 'star2', 'star3'] as const)[Math.min(2, note)]), delay) : null;
    return () => { cancelAnimation(pop); if (id) clearTimeout(id); };
  }, [delay, filled, note, pop]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.3 + pop.value * 0.7 }, { rotate: `${(1 - pop.value) * -40}deg` }],
  }));
  return (
    <Animated.View style={aStyle}>
      <Image source={filled ? UI.star : UI.starOff} resizeMode="contain" style={{ width: size, height: size * 0.94 }} />
    </Animated.View>
  );
}

function ComboBanner({ n, onDone }: { n: number; onDone: () => void }) {
  const t = useSharedValue(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    t.value = withSequence(
      withSpring(1, { damping: 10, stiffness: 240 }),
      withTiming(1, { duration: 520 }),
      withTiming(0, { duration: 260 }),
    );
    const id = setTimeout(() => doneRef.current(), 1200);
    return () => { cancelAnimation(t); clearTimeout(id); };
  }, [t]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.6 + t.value * 0.4 }, { rotate: `${(1 - t.value) * -8}deg` }],
  }));
  const word = n >= 4 ? 'UNREAL!' : n === 3 ? 'AMAZING!' : n === 2 ? 'GREAT!' : 'NICE!';
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, top: '34%', alignItems: 'center', zIndex: 1200 }, aStyle]}>
      <Panel radius={20} tint="rgba(255,196,46,0.94)" border="rgba(255,255,255,0.75)" glow={C.gold}
        style={{ paddingHorizontal: 26, paddingVertical: 12 }}>
        <Text style={{ color: '#4A2C00', fontSize: 26, fontWeight: '900', letterSpacing: 1.6 }}>{word}</Text>
      </Panel>
    </Animated.View>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const t = useSharedValue(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    t.value = withSequence(
      withTiming(1, { duration: 200 }), withTiming(1, { duration: 900 }), withTiming(0, { duration: 250 }),
    );
    const id = setTimeout(() => doneRef.current(), 1400);
    return () => { cancelAnimation(t); clearTimeout(id); };
  }, [t]);
  const aStyle = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 14 }] }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, top: '24%', alignItems: 'center', zIndex: 1600 }, aStyle]}>
      <Panel radius={16} tint="rgba(20,12,64,0.95)" style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900', letterSpacing: 1.2 }}>{text}</Text>
      </Panel>
    </Animated.View>
  );
}


/** Shared chrome for every full-screen modal. `plain` floats content over the dim. */
function ModalCard({ children, glow, maxWidth = 360, plain, quiet, onClose }: {
  children: React.ReactNode; glow?: string; maxWidth?: number; plain?: boolean; onClose?: () => void;
  /** Skip the opening pop — for cards that arrive with a jingle of their own. */
  quiet?: boolean;
}) {
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!quiet) playSfx('pop');
    rise.value = withDelay(60, withSpring(1, { damping: 17, stiffness: 170 }));
    return () => cancelAnimation(rise);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rise]);
  const backdrop = useAnimatedStyle(() => ({ opacity: rise.value }));
  const card = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 44 }, { scale: 0.9 + rise.value * 0.1 }],
  }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 4000 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <LinearGradient colors={gc('rgba(3,9,38,0.55)', 'rgba(5,12,48,0.78)')} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Animated.View style={[{ width: '100%', maxWidth }, card]}>
          {plain ? (
            <View style={{ alignItems: 'center' }}>{children}</View>
          ) : (
            <Panel radius={24} tint="rgba(28,60,166,0.32)" glow={glow} style={{ padding: 20, alignItems: 'center' }}>
              {children}
              {onClose ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => { tapFx(); onClose(); }}
                  style={{
                    position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15,
                    backgroundColor: 'rgba(4,10,44,0.9)', borderWidth: 1.5, borderColor: C.cardEdge,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="close" size={14} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </Panel>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/* --- shared pieces from the reference ------------------------------------ */

/** Navy pill with a coin and a green plus, top of most screens. */
function CoinPill({ coins, onPlus }: { coins: number; onPlus?: () => void }) {
  return (
    <Panel radius={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 5, paddingVertical: 5 }}>
      <Icon name="coin" size={20} color={C.gold} />
      <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{fmt(coins)}</Text>
      <Pressable
        disabled={!onPlus}
        hitSlop={8}
        onPress={() => { tapFx(); onPlus?.(); }}
        style={{ width: 28, height: 28 }}
      >
        <Candy tone="green" height={28} radius={9} />
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 2, zIndex: 1 }]}>
          <Icon name="plus" size={14} color="#FFFFFF" />
        </View>
      </Pressable>
    </Panel>
  );
}

const OBJ_TITLE: Record<ObjType, string> = {
  lines: 'Clear Lines', score: 'Reach Score', crystals: 'Pop Crystals', ice: 'Break Ice', clear: 'Clear It All',
};

/** The little icon a goal gets on the level sheet. */
function GoalGlyph({ objType, size }: { objType: ObjType; size: number }) {
  if (objType === 'crystals') return <Icon name="crystal" size={size} color={C.crystal} />;
  if (objType === 'ice') return <Icon name="ice" size={size} color={C.ice} />;
  if (objType === 'score') return <Icon name="crown" size={size} color={C.gold} />;
  if (objType === 'clear') return <Icon name="trophy" size={size} color={C.gold} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={roundRect(2, 2, 9.4, 9.4, 2.4)} fill="#FFC42E" />
      <Path d={roundRect(12.6, 2, 9.4, 9.4, 2.4)} fill="#FFC42E" />
      <Path d={roundRect(2, 12.6, 9.4, 9.4, 2.4)} fill="#FFC42E" />
      <Path d={roundRect(12.6, 12.6, 9.4, 9.4, 2.4)} fill="#FFC42E" />
      <Path d={roundRect(2, 2, 9.4, 4, 2)} fill="#FFFFFF" fillOpacity={0.35} />
      <Path d={roundRect(12.6, 2, 9.4, 4, 2)} fill="#FFFFFF" fillOpacity={0.35} />
    </Svg>
  );
}

/* --- the wooden play chrome ------------------------------------------------- */

/** A carved wooden plank: a dark rim, warm lit wood, a bright top edge and a soft drop shadow. */
function WoodBox({ style, radius = 18, rim = 3, tone = 'warm', children }: {
  style?: StyleProp<ViewStyle>; radius?: number; rim?: number; tone?: 'warm' | 'deep'; children?: React.ReactNode;
}) {
  const cols = tone === 'warm' ? gc('#D5954E', '#A6662E', '#84491F') : gc('#8F5B2A', '#6C3E19', '#54300F');
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View pointerEvents="none" style={{
        position: 'absolute', left: 1, right: 1, top: 4, bottom: -4, borderRadius: radius, backgroundColor: 'rgba(16,6,0,0.4)',
      }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius: radius, overflow: 'hidden', borderWidth: rim, borderColor: '#3A1C08',
      }]}>
        <LinearGradient colors={cols} style={StyleSheet.absoluteFill} />
        {[0.2, 0.46, 0.72, 0.9].map((f) => (
          <View key={f} style={{ position: 'absolute', left: 0, right: 0, top: `${f * 100}%`, height: 1.5, backgroundColor: 'rgba(58,28,8,0.16)' }} />
        ))}
        <View style={{ position: 'absolute', left: 5, right: 5, top: 1.5, height: Math.max(3, radius * 0.3), borderRadius: 6, backgroundColor: 'rgba(255,236,190,0.3)' }} />
      </View>
      {children}
    </View>
  );
}

/** The round blue button in the corner: a white ring, a glossy face, a dark rim. */
function RoundBtn({ icon, onPress, size = 44 }: { icon: IconName; onPress: () => void; size?: number }) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }] }));
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={icon} hitSlop={8}
      style={[{ width: size, height: size }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 3, height: size, borderRadius: size / 2, backgroundColor: 'rgba(8,14,40,0.45)' }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#173E93', padding: 2 }}>
        <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden', borderWidth: 2.5, borderColor: '#D6EBFF' }}>
          <LinearGradient colors={gc('#6CBBFF', '#2A66DC')} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: size * 0.36, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={size * 0.44} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </AnimPressable>
  );
}

/** The level sign: a wooden plank with a leaf at each top corner. */
function LevelPlank({ text, width }: { text: string; width: number }) {
  const uid = useUid('lpk');
  const k = width / 170;
  const leaf = (x: number, y: number, r: number, c: string, key: string) => (
    <Path key={key} d="M0 0 Q6 -9 14 0 Q6 7 0 0Z" fill={c} stroke="#0F5A28" strokeWidth={1.1} transform={`translate(${x},${y}) rotate(${r})`} />
  );
  return (
    <View style={{ width, height: 56 * k }}>
      <Svg width={width} height={56 * k} viewBox="0 0 170 56" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D5954E" />
            <Stop offset="0.5" stopColor="#A6662E" />
            <Stop offset="1" stopColor="#7A4820" />
          </SvgLinear>
        </Defs>
        <Path d={roundRect(10, 12, 150, 38, 10)} fill="#2E1808" transform="translate(0,3)" />
        <Path d={roundRect(10, 10, 150, 38, 10)} fill={`url(#${uid}w)`} stroke="#4A2A0E" strokeWidth={2.6} />
        <Path d={roundRect(15, 13, 140, 9, 4.5)} fill="#FFFFFF" fillOpacity={0.22} />
        <Path d="M16 33 H154 M16 41 H154" stroke="#5E3612" strokeOpacity={0.3} strokeWidth={1.3} />
        {[[18, 18], [152, 18], [18, 42], [152, 42]].map(([nx, ny], i) => <Circle key={i} cx={nx} cy={ny} r={2.1} fill="#E7B33A" stroke="#7A4A00" strokeWidth={0.8} />)}
        {leaf(14, 14, -150, '#3DBB58', 'l1')}
        {leaf(11, 20, 160, '#2E9A45', 'l2')}
        {leaf(19, 8, -105, '#5CD07A', 'l3')}
        {leaf(156, 14, -30, '#3DBB58', 'r1')}
        {leaf(159, 20, 20, '#2E9A45', 'r2')}
        {leaf(151, 8, -75, '#5CD07A', 'r3')}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 14 * k, right: 14 * k, top: 10 * k, height: 38 * k, alignItems: 'center', justifyContent: 'center' }}>
        <ChunkyText text={text} size={22 * k} width={142 * k} fill="#FFFFFF" hi="#FFFFFF" outline="#3A1E08" ring={1.6 * k} extrude={1.2 * k} />
      </View>
    </View>
  );
}

type ChipKind = 'lines' | 'score' | 'crystals' | 'ice';
const CHIP_STYLE: Record<ChipKind, { a: string; b: string; icon: IconName }> = {
  lines: { a: '#FFE45C', b: '#F0A016', icon: 'lines' },
  score: { a: '#C692FF', b: '#8B4AE0', icon: 'crown' },
  crystals: { a: '#FF9AF0', b: '#E24BC8', icon: 'crystal' },
  ice: { a: '#C4F2FF', b: '#4CB8E8', icon: 'ice' },
};

/** What the level asks for, as one or two coloured chips. */
function goalChips(level: Level, p: Progress): { kind: ChipKind; have: number; need: number }[] {
  switch (level.objType) {
    case 'lines': return [{ kind: 'lines', have: p.lines, need: level.objTarget }];
    case 'score': return [{ kind: 'score', have: p.score, need: level.objTarget }];
    case 'crystals': return [{ kind: 'crystals', have: p.crystals, need: level.crystal.length }];
    case 'ice': return [{ kind: 'ice', have: p.iceBroken, need: level.ice.length }];
    default: {
      const out: { kind: ChipKind; have: number; need: number }[] = [];
      if (level.crystal.length) out.push({ kind: 'crystals', have: p.crystals, need: level.crystal.length });
      if (level.ice.length) out.push({ kind: 'ice', have: p.iceBroken, need: level.ice.length });
      return out;
    }
  }
}

function GoalChip({ kind, have, need, label }: { kind: ChipKind; have: number; need: number; label?: string }) {
  const s = CHIP_STYLE[kind];
  const done = have >= need;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <View style={{
        width: 30, height: 30, borderRadius: 9, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <LinearGradient colors={gc(s.a, s.b)} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 11, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        <View style={{ zIndex: 2 }}><Icon name={done ? 'check' : s.icon} size={16} color="#FFFFFF" /></View>
      </View>
      <View>
        {label ? <Text numberOfLines={1} style={{ color: '#8A5A2A', fontSize: 9.5, letterSpacing: 0.4, includeFontPadding: false }}>{label}</Text> : null}
        <Text numberOfLines={1} style={{ color: done ? '#1E8A2E' : '#5A3316', fontSize: 16, lineHeight: 19, includeFontPadding: false }}>
          {fmt(Math.min(have, need))}/{fmt(need)}
        </Text>
      </View>
    </View>
  );
}

/** The big golden number of moves left; it pulses red when few remain. */
function MovesBox({ left }: { left: number }) {
  const low = left <= 5;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!low) { cancelAnimation(pulse); pulse.value = 0; return; }
    pulse.value = withRepeat(withTiming(1, { duration: 620, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [low, pulse]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.08 }] }));
  return (
    <View style={{
      flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 2, borderColor: '#2E1608', backgroundColor: '#5B3417',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, backgroundColor: 'rgba(20,8,0,0.35)' }} />
      <Animated.View style={aStyle}>
        <Text style={{
          color: low ? '#FF7A6E' : '#FFC42E', fontSize: 28, lineHeight: 32, includeFontPadding: false,
          textShadowColor: 'rgba(20,8,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0,
        }}>{left}</Text>
      </Animated.View>
    </View>
  );
}

/** One wooden frame holding the goal and the moves left, like the reference. */
function GoalMovesPanel({ level, progress, movesLeft, goalLabel, movesLabel }: {
  level: Level; progress: Progress; movesLeft: number; goalLabel: string; movesLabel: string;
}) {
  const chips = goalChips(level, progress);
  const hdr = {
    color: '#FFF1CC', fontSize: 14, lineHeight: 17, textAlign: 'center', marginBottom: 3, includeFontPadding: false,
    textShadowColor: 'rgba(40,16,0,0.9)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0,
  } as const;
  return (
    <WoodBox radius={18} style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1.7 }}>
          <Text style={hdr}>{goalLabel}</Text>
          <View style={{
            flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 2, borderColor: '#B98A4A', backgroundColor: '#F6E4B8',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 4,
          }}>
            {chips.map((c) => (
              <GoalChip key={c.kind} kind={c.kind} have={c.have} need={c.need}
                label={chips.length === 1 ? OBJ_TITLE[level.objType] : undefined} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={hdr}>{movesLabel}</Text>
          <MovesBox left={movesLeft} />
        </View>
      </View>
    </WoodBox>
  );
}

/** Three little vector stars: how many the current score has earned. */
function MiniStars({ count, size }: { count: number; size: number }) {
  const uid = useUid('ms');
  const W = size * 3 + 6;
  return (
    <Svg width={W} height={size} viewBox={`0 0 ${W} ${size}`}>
      <Defs>
        <SvgLinear id={uid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3A0" />
          <Stop offset="1" stopColor="#FFB020" />
        </SvgLinear>
      </Defs>
      {[0, 1, 2].map((i) => {
        const on = i < count;
        return (
          <Path key={i} d={starPath(size / 2 + i * (size + 3), size * 0.54, size * 0.5, size * 0.22)}
            fill={on ? `url(#${uid})` : 'rgba(255,255,255,0.22)'}
            stroke={on ? '#B87800' : 'rgba(255,255,255,0.3)'} strokeWidth={1} strokeLinejoin="round" />
        );
      })}
    </Svg>
  );
}

/** Score and the live star meter, in a slim dark strip under the panel. */
function ScoreStrip({ score, tiers, onHelp }: { score: number; tiers: number[]; onHelp: () => void }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 12, paddingRight: 5, paddingVertical: 4,
      borderRadius: 16, backgroundColor: 'rgba(28,12,0,0.5)', borderWidth: 1.5, borderColor: 'rgba(255,214,140,0.4)',
    }}>
      <ScoreBar score={score} small />
      <View style={{ flex: 1 }}><StarMeter score={score} tiers={tiers} /></View>
      <IconBtn name="help" onPress={onHelp} size={28} />
    </View>
  );
}

/** A button on the right rail: a wooden tile with a glowing icon, a label and a count badge. */
function SideAction({ icon, label, tint, badge, cost, dim, onPress, size = 42 }: {
  icon: IconName; label: string; tint: string; badge?: string; cost?: number; dim?: boolean; onPress: () => void; size?: number;
}) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }], opacity: dim ? 0.6 : 1 }));
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={[{ width: size + 8, alignItems: 'center' }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ width: size, height: size }}>
        <WoodBox radius={14} rim={2.5} style={{ width: size, height: size }}>
          <View pointerEvents="none" style={{
            position: 'absolute', left: 4.5, top: 4.5, right: 4.5, bottom: 4.5, borderRadius: 9, overflow: 'hidden',
            borderWidth: 1.5, borderColor: '#0B1238', alignItems: 'center', justifyContent: 'center',
          }}>
            <LinearGradient colors={gc('#2E4A9C', '#16255E')} style={StyleSheet.absoluteFill} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: size * 0.3, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={{ zIndex: 2 }}><Icon name={icon} size={size * 0.5} color={tint} /></View>
          </View>
        </WoodBox>
        {badge !== undefined ? (
          <View style={{
            position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 3,
            backgroundColor: dim ? '#7A7F9A' : '#E8384F', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 11, includeFontPadding: false }}>{badge}</Text>
          </View>
        ) : cost !== undefined ? (
          <View style={{
            position: 'absolute', top: -7, right: -9, height: 18, borderRadius: 9, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 2,
            backgroundColor: '#3A1E08', borderWidth: 1.5, borderColor: C.gold,
          }}>
            <Icon name="coin" size={9} color={C.gold} />
            <Text style={{ color: C.goldHi, fontSize: 10, includeFontPadding: false }}>{cost}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{
        color: '#FFFFFF', fontSize: 11, marginTop: 4, includeFontPadding: false,
        textShadowColor: 'rgba(30,12,0,0.95)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0,
      }}>{label}</Text>
    </AnimPressable>
  );
}

/** Where the hint says to drop a block: the block itself, pulsing, in a gold outline. */
function HintGhost({ cells, size, color }: { cells: Cell[]; size: number; color: number }) {
  const v = useLoop(650);
  const aStyle = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.55 }));
  const outline = useMemo(
    () => cells.map((c) => roundRect(c.c * size + 1.5, c.r * size + 1.5, size - 3, size - 3, size * 0.22)).join(''),
    [cells, size],
  );
  const W = (Math.max(...cells.map((c) => c.c)) + 1) * size;
  const H = (Math.max(...cells.map((c) => c.r)) + 1) * size;
  return (
    <Animated.View pointerEvents="none" style={aStyle}>
      <Bricks cells={cells} size={size} color={color} shadow={false} />
      <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={outline} fill="none" stroke={C.goldHi} strokeWidth={2.4} />
      </Svg>
    </Animated.View>
  );
}

/** The sunny forest behind the board, a little dimmed so the wooden frame stands out. */
function GameBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ForestArt />
      <LinearGradient
        colors={gc('rgba(4,24,14,0.4)', 'rgba(4,24,14,0.08)', 'rgba(4,24,14,0.45)')}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** A pink ribbon banner with folded tails, like the level-complete art. */
function Ribbon({ text, width = 290, tone = 'pink' }: { text: string; width?: number; tone?: 'pink' | 'red' }) {
  const uid = useUid('rb');
  const a = tone === 'pink' ? ['#FF7AA8', '#E02E6A'] : ['#FF8A5C', '#D23A1E'];
  const dark = tone === 'pink' ? '#A81A4E' : '#9A2410';
  const h = 62;
  return (
    <View style={{ width, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={a[0]} />
            <Stop offset="1" stopColor={a[1]} />
          </SvgLinear>
        </Defs>
        <Path d={`M0 16 L26 16 L26 52 L0 52 L12 34 Z`} fill={dark} />
        <Path d={`M${width} 16 L${width - 26} 16 L${width - 26} 52 L${width} 52 L${width - 12} 34 Z`} fill={dark} />
        <Path d={`M22 6 Q${width / 2} -2 ${width - 22} 6 L${width - 22} 50 Q${width / 2} 42 22 50 Z`} fill={`url(#${uid}f)`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} />
        <Path d={`M26 10 Q${width / 2} 3 ${width - 26} 10 L${width - 26} 24 Q${width / 2} 17 26 24 Z`} fill="#FFFFFF" fillOpacity={0.22} />
      </Svg>
      <Text numberOfLines={1} style={{
        color: '#FFFFFF', fontSize: 23, letterSpacing: 0.6, marginTop: -6,
        textShadowColor: 'rgba(100,0,40,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0,
      }}>
        {text}
      </Text>
    </View>
  );
}

/** The block mascot: a friendly cube with a face. Happy on a win, sad on a loss. */
function MascotBlock({ size, color, mood }: { size: number; color: number; mood: 'happy' | 'sad' }) {
  const uid = useUid('mc');
  const b = BRICKS[color % BRICKS.length];
  return (
    <Svg width={size} height={size * 1.12} viewBox="0 0 100 112">
      <Defs>
        <SvgLinear id={`${uid}f`} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={b.lo} />
          <Stop offset="0.5" stopColor={b.mid} />
          <Stop offset="1" stopColor={b.mid} />
        </SvgLinear>
      </Defs>
      <Path d={roundRect(9, 18, 84, 88, 24)} fill="#000000" fillOpacity={0.25} />
      <Path d={roundRect(4, 12, 92, 92, 24)} fill={b.dark} />
      <Path d={roundRect(4, 4, 92, 88, 24)} fill={`url(#${uid}f)`} />
      <Path d={roundRect(4, 4, 92, 88, 24)} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2} />
      <Path d={roundRect(11, 8, 50, 15, 7.5)} fill="#FFFFFF" fillOpacity={0.42} />
      {/* eyes */}
      <Ellipse cx={34} cy={44} rx={9} ry={mood === 'happy' ? 10 : 11} fill="#FFFFFF" />
      <Ellipse cx={66} cy={44} rx={9} ry={mood === 'happy' ? 10 : 11} fill="#FFFFFF" />
      <Circle cx={mood === 'happy' ? 35 : 34} cy={mood === 'happy' ? 45 : 48} r={5.4} fill="#1B1B3A" />
      <Circle cx={mood === 'happy' ? 67 : 66} cy={mood === 'happy' ? 45 : 48} r={5.4} fill="#1B1B3A" />
      <Circle cx={37} cy={42} r={1.8} fill="#FFFFFF" />
      <Circle cx={69} cy={42} r={1.8} fill="#FFFFFF" />
      {mood === 'happy' ? (
        <>
          <Path d="M36 62 Q50 78 64 62 Z" fill="#7A1E2A" stroke="#7A1E2A" strokeWidth={3} strokeLinejoin="round" />
          <Path d="M41 66 Q50 72 59 66 Q50 70 41 66 Z" fill="#FF7A8A" />
          <Circle cx={22} cy={62} r={6} fill="#FF6F8A" opacity={0.5} />
          <Circle cx={78} cy={62} r={6} fill="#FF6F8A" opacity={0.5} />
        </>
      ) : (
        <>
          <Path d="M24 33 L42 26 M76 33 L58 26" stroke="#1B1B3A" strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M38 70 Q50 58 62 70" fill="none" stroke="#1B1B3A" strokeWidth={3.6} strokeLinecap="round" />
          <Path d="M80 30 Q86 40 80 46 Q74 40 80 30 Z" fill="#9BE4FF" />
        </>
      )}
    </Svg>
  );
}

/** Three big stars, the middle one larger and raised, popping in one by one. */
function BigStars({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
      <View style={{ marginBottom: 2 }}><StarIcon filled={count >= 1} size={58} delay={250} /></View>
      <View style={{ marginBottom: 14 }}><StarIcon filled={count >= 2} size={78} delay={520} /></View>
      <View style={{ marginBottom: 2 }}><StarIcon filled={count >= 3} size={58} delay={790} /></View>
    </View>
  );
}

/** A round icon button with a label under it: Home / Retry / Map. */
function RoundAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }] }));
  return (
    <AnimPressable
      style={[{ alignItems: 'center', width: 64 }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ width: 54, height: 54 }}>
        <Image source={UI.round.blue} resizeMode="stretch" style={{ width: 54, height: 54 }} />
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 3, zIndex: 1 }]}>
          <Icon name={icon} size={23} color="#FFFFFF" />
        </View>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 8 }}>{label}</Text>
    </AnimPressable>
  );
}

/* --- power-ups ------------------------------------------------------------- */

/* --- end-of-level cards ---------------------------------------------------- */

function LevelCompleteCard({
  level: _level, payload, bestScore: _bestScore, hasNext, onNext, onAgain, onHome: _onHome, onMap,
}: {
  level: Level; payload: WinPayload; bestScore: number;
  hasNext: boolean; onNext: () => void; onAgain: () => void; onHome: () => void; onMap: () => void;
}) {
  const t = useT();
  useEffect(() => {
    haptic.ok();
    [160, 300, 440].forEach((ms) => setTimeout(haptic.light, ms));
  }, []);
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { zIndex: 4100 }]} pointerEvents="none">
        <Confetti count={44} />
      </View>
      <ModalCard glow={C.gold} maxWidth={330} plain quiet>
        <ParchmentCard
          plankTop={66} plankH={92}
          topSlot={(
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <SunRays size={340} opacity={0.4} period={30000} />
              <BigStars count={payload.stars} />
            </View>
          )}
          lines={[
            { text: titleCase(t('level')), size: 30, fill: '#FFFFFF', hi: '#FFFFFF', outline: '#3A1E08' },
            { text: titleCase(t('completed')), size: 34, fill: '#FFD23F', hi: '#FFF0A0', outline: '#4A2A00' },
          ]}
        >
          <MascotScene />
          <View style={{ marginTop: 4, padding: 10, borderRadius: 16, backgroundColor: '#F8E8C2', borderWidth: 2, borderColor: '#DDB878' }}>
            <Text style={{ color: '#7A4A22', fontSize: 15, textAlign: 'center', includeFontPadding: false }}>{t('rewards')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {payload.coins > 0 ? <RewardTile icon={<CoinStack size={46} />} label={`+${payload.coins} ${t('coinsWord')}`} /> : null}
              <RewardTile icon={<GoldStar size={38} />} label={`+${payload.stars} ${t('starsWord')}`} />
            </View>
          </View>
          <Btn label={hasNext ? titleCase(t('nextLevel')) : t('levelMap')} icon={hasNext ? 'play' : 'map'} tone="green" big iconLeft
            onPress={hasNext ? onNext : onMap} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 9 }}>
            <Btn label={t('replayShort')} icon="replay" tone="blue" iconLeft pad={8} onPress={onAgain} style={{ flex: 1 }} />
            <Btn label={t('levelMap')} icon="home" tone="gold" iconLeft pad={8} onPress={onMap} style={{ flex: 1 }} />
          </View>
        </ParchmentCard>
      </ModalCard>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: C.textFaint, fontSize: 10, letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 15, marginTop: 1 }}>{value}</Text>
    </View>
  );
}

/** A ruined night forest for the Game Over screen: broken pillars, embers, a red glow on the ground. */
const GameOverScene = React.memo(function GameOverScene() {
  const uid = useUid('gos');
  const id = (n: string) => `${uid}${n}`;
  const glow = useLoop(2600);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.5 + glow.value * 0.5 }));

  const embers = useMemo(() => {
    const r = seeded(31337);
    return Array.from({ length: 34 }, () => ({ x: r() * 370, y: 250 + r() * 344, r: 0.7 + r() * 1.7, o: 0.25 + r() * 0.55 }));
  }, []);
  const stars = useMemo(() => {
    const r = seeded(9001);
    return Array.from({ length: 46 }, () => ({ x: r() * 370, y: r() * 230, r: 0.5 + r() * 1.1, o: 0.3 + r() * 0.6 }));
  }, []);
  const leaves = useMemo(() => {
    const r = seeded(555);
    const L: { x: number; y: number; a: number; c: string; s: number }[] = [];
    const cols = ['#2E7A3A', '#3F9A48', '#1F5A2C', '#57B058'];
    for (let i = 0; i < 16; i++) L.push({ x: 4 + r() * 60, y: 430 + r() * 150, a: -40 + r() * 80, c: cols[i % 4], s: 0.9 + r() * 1.1 });
    for (let i = 0; i < 16; i++) L.push({ x: 306 + r() * 64, y: 430 + r() * 150, a: 140 + r() * 80, c: cols[(i + 1) % 4], s: 0.9 + r() * 1.1 });
    return L;
  }, []);

  const pillar = (x: number, base: number, w: number, h: number, k: string, far = false) => {
    const top = base - h;
    const body = far ? '#23233F' : '#34365C';
    return (
      <G key={k}>
        <Path d={`M${x} ${base}V${top + 12}L${x + w * 0.18} ${top}L${x + w * 0.4} ${top + 10}L${x + w * 0.66} ${top - 5}L${x + w} ${top + 9}V${base}Z`} fill={body} />
        {far ? null : <Path d={`M${x} ${base}V${top + 12}L${x + w * 0.18} ${top}L${x + w * 0.3} ${top + 5}V${base}Z`} fill="#4E5382" opacity={0.7} />}
        {Array.from({ length: Math.floor(h / 24) }, (_, i) => (
          <Path key={i} d={`M${x} ${base - (i + 1) * 24}H${x + w}`} stroke="#141430" strokeOpacity={0.6} strokeWidth={1.4} />
        ))}
        {far ? null : <Path d={`M${x} ${top + 12}Q${x + w * 0.3} ${top + 24} ${x + w * 0.5} ${top + 14}L${x + w * 0.62} ${top + 30}Q${x + w * 0.3} ${top + 32} ${x} ${top + 34}Z`} fill="#2E6A3A" opacity={0.75} />}
      </G>
    );
  };

  const toy = (x: number, y: number, s: number, tone: keyof typeof CUBE_TONES, key: string, face: boolean) => {
    const c = CUBE_TONES[tone];
    return (
      <G key={key} transform={`translate(${x},${y})`}>
        <Path d={roundRect(0, s * 0.2, s * 0.82, s * 0.8, s * 0.18)} fill={c.dark} />
        <Path d={roundRect(0, s * 0.16, s * 0.82, s * 0.7, s * 0.18)} fill={c.mid} />
        <Path d={`M${s * 0.06} ${s * 0.18}L${s * 0.16} 0H${s * 0.92}L${s * 0.8} ${s * 0.18}Z`} fill={c.top} />
        <Path d={`M${s * 0.83} ${s * 0.26}L${s * 0.94} ${s * 0.08}V${s * 0.74}L${s * 0.83} ${s * 0.92}Z`} fill={c.side} />
        {face ? (
          <>
            <Circle cx={s * 0.26} cy={s * 0.44} r={s * 0.055} fill="#2A1400" />
            <Circle cx={s * 0.56} cy={s * 0.44} r={s * 0.055} fill="#2A1400" />
            <Path d={`M${s * 0.28} ${s * 0.66}Q${s * 0.41} ${s * 0.56} ${s * 0.54} ${s * 0.66}`} fill="none" stroke="#2A1400" strokeWidth={s * 0.05} strokeLinecap="round" />
          </>
        ) : null}
      </G>
    );
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 370 594" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={id('sky')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="594">
            <Stop offset="0" stopColor="#120E2C" />
            <Stop offset="0.5" stopColor="#261A40" />
            <Stop offset="1" stopColor="#3A1526" />
          </SvgLinear>
          <SvgRadial id={id('moon')} gradientUnits="userSpaceOnUse" cx="190" cy="150" r="210">
            <Stop offset="0" stopColor="#8E86FF" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#8E86FF" stopOpacity="0" />
          </SvgRadial>
          <SvgRadial id={id('lava')} gradientUnits="userSpaceOnUse" cx="185" cy="520" r="230">
            <Stop offset="0" stopColor="#FF3A2A" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FF3A2A" stopOpacity="0" />
          </SvgRadial>
          <SvgLinear id={id('ground')} gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="0" y2="594">
            <Stop offset="0" stopColor="#3E3050" />
            <Stop offset="1" stopColor="#1A1022" />
          </SvgLinear>
        </Defs>
        <Rect x={0} y={0} width={370} height={594} fill={`url(#${id('sky')})`} />
        <Circle cx={190} cy={150} r={210} fill={`url(#${id('moon')})`} />
        {stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />)}
        <Circle cx={292} cy={78} r={30} fill="#E9E4FF" opacity={0.92} />
        <Circle cx={282} cy={70} r={6} fill="#C9C2EC" opacity={0.7} />
        <Circle cx={303} cy={90} r={4.4} fill="#C9C2EC" opacity={0.7} />
        <Circle cx={296} cy={64} r={3} fill="#C9C2EC" opacity={0.6} />
        <Path d="M70 0 Q60 40 82 70 Q92 88 84 110 M84 0 Q96 30 88 52" fill="none" stroke="#1F6A34" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M330 0 Q344 34 322 64 Q312 84 322 104" fill="none" stroke="#1F6A34" strokeWidth={2.4} strokeLinecap="round" />
        {[[76, 30, 20], [64, 50, 200], [84, 76, 10], [88, 100, 190], [92, 44, 30], [336, 30, 160], [326, 58, 20], [316, 82, 170], [322, 100, 30]].map(([lx, ly, la], i) => (
          <Path key={`v${i}`} d="M0 0 Q6 -9 15 0 Q6 7 0 0Z" fill={i % 2 ? '#2E9A45' : '#3FB258'} stroke="#0F3A1C" strokeWidth={0.8} transform={`translate(${lx},${ly}) rotate(${la})`} />
        ))}

        {/* far ruins */}
        {pillar(120, 330, 28, 84, 'f1', true)}
        {pillar(158, 330, 22, 60, 'f2', true)}
        {pillar(214, 330, 30, 96, 'f3', true)}
        {pillar(252, 330, 24, 62, 'f4', true)}
        <Path d="M120 246 Q186 214 252 240" fill="none" stroke="#23233F" strokeWidth={9} strokeLinecap="round" opacity={0.7} />

        {/* mist */}
        <Ellipse cx={120} cy={352} rx={190} ry={26} fill="#8A7CC8" opacity={0.1} />
        <Ellipse cx={270} cy={378} rx={170} ry={22} fill="#8A7CC8" opacity={0.08} />

        {/* the near ruins, left and right */}
        {pillar(-8, 372, 52, 190, 'l1')}
        {pillar(46, 380, 36, 116, 'l2')}
        {pillar(316, 366, 60, 214, 'r1')}
        {pillar(276, 380, 38, 132, 'r2')}

        {/* toy blocks lost among the stones */}
        {toy(52, 296, 34, 'red', 'toyR', true)}
        {toy(300, 330, 30, 'yellow', 'toyY', false)}

        <Ellipse cx={185} cy={520} rx={260} ry={96} fill={`url(#${id('lava')})`} />

        {/* the ground */}
        <Path d="M0 420 Q60 396 130 412 Q200 430 260 406 Q330 386 370 410 V594 H0Z" fill={`url(#${id('ground')})`} />
        <Path d="M0 420 Q60 396 130 412 Q200 430 260 406 Q330 386 370 410" fill="none" stroke="#6A5A80" strokeOpacity={0.6} strokeWidth={2} />
        <Path d="M-10 500 Q40 470 92 496 Q120 520 100 594 H-10Z" fill="#2A1E36" />
        <Path d="M380 496 Q330 466 280 494 Q252 518 270 594 H380Z" fill="#2A1E36" />
        <Path d="M20 480 Q50 462 80 484" fill="none" stroke="#5A4A70" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
        <Path d="M300 480 Q326 462 352 482" fill="none" stroke="#5A4A70" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />

        {embers.map((e, i) => <Circle key={i} cx={e.x} cy={e.y} r={e.r} fill="#FF6A4A" opacity={e.o} />)}
        {leaves.map((l, i) => (
          <Path key={i} d="M0 0 Q7 -10 16 0 Q7 8 0 0Z" fill={l.c} stroke="#0F3A1C" strokeWidth={0.8}
            transform={`translate(${q2(l.x)},${q2(l.y)}) rotate(${q2(l.a)}) scale(${q2(l.s)})`} />
        ))}
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
        <LinearGradient colors={gc('rgba(190,24,44,0)', 'rgba(190,24,44,0.3)')} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <LinearGradient colors={gc('rgba(6,4,20,0.5)', 'rgba(6,4,20,0)', 'rgba(6,4,20,0.4)')} style={StyleSheet.absoluteFill} />
    </View>
  );
});

/**
 * The Game Over screen: a mossy stone sign, a sad blue block on a stone platform
 * inside a wooden frame, and a wooden panel with the run's numbers and three buttons.
 * Shown when the moves run out and when no block fits anywhere any more.
 */
function GameOverCard({
  level, reason, score, bestScore, canBoost, onAgain, onBooster, onWatchAd, onHome, onMap,
}: {
  level: Level; reason: FinishReason; score: number; bestScore: number; canBoost: boolean;
  onAgain: () => void; onBooster: () => void; onWatchAd: () => void; onHome: () => void; onMap: () => void;
}) {
  const t = useT();
  const adReady = useRewardedReady();
  const uid = useUid('gov');
  const { width, height } = useWindowDimensions();
  const rise = useSharedValue(0);
  const bob = useLoop(2400);
  useEffect(() => {
    haptic.err();
    rise.value = withDelay(120, withSpring(1, { damping: 15, stiffness: 150 }));
    return () => cancelAnimation(rise);
  }, [rise]);

  const boxW = 340;
  const boxH = 512 + (canBoost ? 50 : 0) + (adReady ? 52 : 0);
  const k = Math.min(1.12, (width - 12) / boxW, (height - 20) / boxH);
  const sceneStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, rise.value * 2.4) }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.value * 1.6),
    transform: [{ translateY: (1 - rise.value) * 60 }, { scale: k * (0.92 + rise.value * 0.08) }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.value - 0.5) * 5 }] }));

  const msg = reason === 'stuck' ? t('noSpace') : t('ranOut');
  const msgSize = Math.max(14, Math.min(23, Math.floor(268 / (msg.length * 0.5))));
  const best = Math.max(bestScore, score);
  const goWords = t('gameOver').split(' ');
  const goTop = goWords.length > 2 ? goWords.slice(0, -1).join(' ') : goWords[0];
  const goBottom = goWords.length > 2 ? goWords[goWords.length - 1] : goWords.slice(1).join(' ');
  const leaf = (x: number, y: number, r: number, c: string, s: number, key: string) => (
    <Path key={key} d="M0 0 Q7 -10 17 0 Q7 8 0 0Z" fill={c} stroke="#0F5A28" strokeWidth={1}
      transform={`translate(${x},${y}) rotate(${r}) scale(${s})`} />
  );

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 4000 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}><GameOverScene /></Animated.View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ width: boxW, height: boxH }, cardStyle]}>
          {/* the wooden frame behind the mascot */}
          <Svg width={boxW} height={250} viewBox={`0 0 ${boxW} 250`} style={{ position: 'absolute', left: 0, top: 70 }}>
            <Defs>
              <SvgLinear id={`${uid}st`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#8E8B9C" />
                <Stop offset="1" stopColor="#55526A" />
              </SvgLinear>
            </Defs>
            <Path d={roundRect(30, 30, 280, 210, 34)} fill="none" stroke="#2C1608" strokeWidth={18} />
            <Path d={roundRect(30, 30, 280, 210, 34)} fill="none" stroke="#8B5A2B" strokeWidth={12} />
            <Path d={roundRect(30, 28, 280, 210, 34)} fill="none" stroke="#C48A4A" strokeOpacity={0.45} strokeWidth={3} />
            {/* the stone platform the block sits on */}
            <Path d="M62 150 Q170 126 278 150 L296 168 Q170 196 44 168 Z" fill="#2C2A3A" transform="translate(0,6)" />
            <Path d="M62 148 Q170 124 278 148 L296 166 Q170 194 44 166 Z" fill={`url(#${uid}st)`} stroke="#2C2A3A" strokeWidth={2.4} strokeLinejoin="round" />
            <Path d="M70 148 Q170 128 270 148" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
            <Path d="M120 158 L128 166 M214 160 L206 168 L212 174" fill="none" stroke="#2C2A3A" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round" />
            <Ellipse cx={92} cy={152} rx={20} ry={5} fill="#4FB04A" />
            <Ellipse cx={252} cy={152} rx={18} ry={4.6} fill="#4FB04A" />
            {leaf(52, 158, 170, '#3DBB58', 1.1, 'a')}
            {leaf(62, 166, 140, '#2E9A45', 1, 'b')}
            {leaf(286, 158, 10, '#3DBB58', 1.1, 'c')}
            {leaf(276, 166, 40, '#2E9A45', 1, 'd')}
            {leaf(150, 176, 100, '#57C060', 0.9, 'e')}
            {leaf(200, 178, 80, '#2E9A45', 0.9, 'f')}
          </Svg>

          {/* the sad block */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (boxW - 80) / 2, top: 126 }, mascotStyle]}>
            <MascotBlock size={80} color={5} mood="sad" />
          </Animated.View>

          {/* the stone sign */}
          <Svg width={boxW} height={128} viewBox={`0 0 ${boxW} 128`} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <SvgLinear id={`${uid}sg`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#8E8B9C" />
                <Stop offset="1" stopColor="#4C495F" />
              </SvgLinear>
            </Defs>
            <Path d="M50 26 Q52 10 74 10 H266 Q288 10 290 26 L294 98 Q292 118 268 120 H72 Q48 118 46 98 Z" fill="#221F2C" transform="translate(0,5)" />
            <Path d="M50 26 Q52 10 74 10 H266 Q288 10 290 26 L294 98 Q292 118 268 120 H72 Q48 118 46 98 Z" fill={`url(#${uid}sg)`} stroke="#2C2A3A" strokeWidth={3} strokeLinejoin="round" />
            <Path d={roundRect(60, 21, 220, 88, 14)} fill="#3C3A4E" fillOpacity={0.55} />
            <Path d="M58 26 Q60 16 76 16 H196" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
            <Path d="M232 12 L226 26 L236 36 M60 84 L70 92 L64 104 M274 80 L266 92" fill="none" stroke="#2C2A3A" strokeOpacity={0.55} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            {[[58, 28], [282, 28], [58, 106], [282, 106]].map(([nx, ny], i) => <Circle key={i} cx={nx} cy={ny} r={2.6} fill="#B8B4C8" stroke="#2C2A3A" strokeWidth={1} />)}
            <Ellipse cx={92} cy={13} rx={26} ry={6} fill="#4FB04A" />
            <Ellipse cx={252} cy={13} rx={22} ry={5.4} fill="#4FB04A" />
            <Ellipse cx={46} cy={58} rx={6} ry={16} fill="#4FB04A" opacity={0.9} />
            {leaf(52, 20, -140, '#3DBB58', 1.5, 's1')}
            {leaf(46, 32, 160, '#2E9A45', 1.4, 's2')}
            {leaf(60, 10, -100, '#57C060', 1.3, 's3')}
            {leaf(288, 20, -40, '#3DBB58', 1.5, 's4')}
            {leaf(294, 32, 20, '#2E9A45', 1.4, 's5')}
            {leaf(280, 10, -80, '#57C060', 1.3, 's6')}
            {leaf(56, 114, 150, '#2E9A45', 1.3, 's7')}
            {leaf(286, 114, 30, '#3DBB58', 1.3, 's8')}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 6, alignItems: 'center' }}>
            <ChunkyText text={goTop} size={36} width={220} fill="#FFF4DC" hi="#FFFFFF" outline="#3A2A44" ring={2.6} extrude={2.5} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 36, alignItems: 'center' }}>
            <ChunkyText text={goBottom} size={50} width={230} fill="#FF3D4A" hi="#FF8E8E" outline="#5E0A1C" ring={3} extrude={3.5} />
          </View>

          {/* the wooden panel */}
          <WoodBox radius={22} style={{ position: 'absolute', left: 17, top: 242, width: 306, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 }}>
            <View style={{ alignItems: 'center', height: 34, justifyContent: 'center' }}>
              <ChunkyText text={msg} size={msgSize} width={276} fill="#FFD23F" hi="#FFF0A0" outline="#4A2A00" ring={1.8} extrude={1.5} />
            </View>
            <View style={{
              flexDirection: 'row', marginTop: 8, paddingVertical: 8, borderRadius: 14, borderWidth: 2,
              borderColor: '#241206', backgroundColor: '#3B200D',
            }}>
              {[
                { label: t('levelTitle'), value: `${level.index + 1}` },
                { label: t('scoreTitle'), value: fmt(score) },
                { label: t('bestScore'), value: fmt(best) },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1.5 : 0, borderLeftColor: '#6A4020' }}>
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 12, includeFontPadding: false }}>{s.label}</Text>
                  <Text numberOfLines={1} style={{
                    color: '#FFC83A', fontSize: 26, lineHeight: 31, includeFontPadding: false,
                    textShadowColor: 'rgba(20,8,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0,
                  }}>{s.value}</Text>
                </View>
              ))}
            </View>
            {adReady ? (
              <Btn label={t('watchContinue')} icon="play" tone="violet" compact onPress={onWatchAd} style={{ marginTop: 10 }} />
            ) : null}
            <Btn label={t('retry')} icon="replay" tone="green" big onPress={onAgain} style={{ marginTop: adReady ? 10 : 12 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Btn label={t('levelMap')} icon="map" tone="blue" pad={8} onPress={onMap} style={{ flex: 1 }} />
              <Btn label={t('home')} icon="home" tone="gold" pad={8} onPress={onHome} style={{ flex: 1 }} />
            </View>
            {canBoost ? (
              <Btn label={t('useBooster')} icon="magic" tone="violet" compact onPress={onBooster} style={{ marginTop: 10 }} />
            ) : null}
          </WoodBox>
        </Animated.View>
      </View>
    </View>
  );
}

/** A little leaf, for the vines around the wooden panel. */
function Leaf({ size = 34, rotate = 0 }: { size?: number; rotate?: number }) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 40 25" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Path d="M2 12.5 C10 -2 30 -2 38 12.5 C30 27 10 27 2 12.5Z" fill="#56C03E" stroke="#2A7521" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M5 12.5 L35 12.5" stroke="#2A7521" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 7.5 C16 3.5 26 3.5 32 7.5" stroke="#A6F08C" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
    </Svg>
  );
}

/* --- the storybook cards: Game Paused and Level Completed ------------------
 * A wooden frame round warm parchment, a carved plank title, leafy vines, the
 * block mascot on a grassy tuft, and glossy candy buttons.                   */

/** "RESTART LEVEL" -> "Restart Level" (the reference uses title case on its buttons). */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, sp: string, c: string) => sp + c.toUpperCase());

/** A little spray of leaves on a stem, for the corners of the cards. */
function Vine({ size = 46, rotate = 0, flip = false }: { size?: number; rotate?: number; flip?: boolean }) {
  const leaves: [number, number, number, number][] = [[30, 8, -62, 1.5], [22, 19, -14, 1.5], [12, 28, -104, 1.4], [28, 16, -118, 1.3], [8, 33, 26, 1.4], [18, 10, -150, 1.2], [34, 14, -20, 1.1]];
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 50 40" style={{ transform: [{ rotate: `${rotate}deg` }, { scaleX: flip ? -1 : 1 }] }}>
      <Path d="M3 37 C14 31 23 21 31 9" stroke="#2A7521" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {leaves.map(([x, y, r, s], i) => (
        <G key={i} transform={`translate(${x},${y}) rotate(${r}) scale(${s})`}>
          <Path d="M0 0 Q7 -10 17 0 Q7 8 0 0Z" fill={i % 2 ? '#3FAE33' : '#5CCB43'} stroke="#2A7521" strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="M2 0 L14 0" stroke="#2A7521" strokeWidth={0.9} strokeLinecap="round" />
        </G>
      ))}
    </Svg>
  );
}

type PlankLine = { text: string; size: number; fill: string; hi: string; outline: string };

/** What sits inside the wooden frame: warm parchment, or the leafy green board of the daily rewards. */
const PARCHMENT = { colors: gc('#FDF0D0', '#F3DAA6'), edge: '#8A5A2A' };
const LEAF_BOARD = { colors: gc('#B9E37E', '#82C450'), edge: '#4F8A28' };

/**
 * The wooden card. `lines` are the plank's title lines; `topSlot` floats above the
 * plank (the stars); `onClose` adds the red X; `footer` is a scene that hangs over
 * the bottom edge of the frame, `footerDrop` px of it below the frame.
 */
function ParchmentCard({
  lines, plankTop = 0, plankH = 56, plankRatio = 0.86, topSlot, onClose, cardWidth, inner = PARCHMENT,
  footer, footerDrop = 28, children,
}: {
  lines: PlankLine[]; plankTop?: number; plankH?: number; plankRatio?: number; topSlot?: React.ReactNode;
  onClose?: () => void; cardWidth?: number; inner?: { colors: GradColors; edge: string };
  footer?: React.ReactNode; footerDrop?: number;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const cardW = cardWidth ?? Math.min(330, width - 44);
  const plankW = cardW * plankRatio;
  const half = plankH / 2;
  const lineH = (l: PlankLine) => Math.round(l.size * 1.16) + 4;
  return (
    <View style={{ width: cardW, paddingTop: plankTop + half }}>
      <View style={{ borderRadius: 24, borderWidth: 4.5, borderColor: '#4B2A0E', overflow: 'hidden' }}>
        <LinearGradient colors={gc('#B9773A', '#8B5426')} style={{ padding: 7 }}>
          {[20, 70, 120, 170, 220, 270].map((y) => (
            <View key={y} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y, height: 2, backgroundColor: 'rgba(60,28,6,0.14)' }} />
          ))}
          <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 2.5, borderColor: inner.edge }}>
            <LinearGradient colors={inner.colors} style={{ paddingHorizontal: 14, paddingTop: half + 10, paddingBottom: 16 }}>
              {children}
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      {/* the carved plank */}
      <View pointerEvents="none" style={{ position: 'absolute', top: plankTop, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ width: plankW, height: plankH, borderRadius: 16, borderWidth: 3.5, borderColor: '#4B2A0E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={gc('#C58540', '#95592A')} style={StyleSheet.absoluteFill} />
          {[0.3, 0.62, 0.86].map((f) => (
            <View key={f} style={{ position: 'absolute', left: 0, right: 0, top: `${f * 100}%`, height: 1.5, backgroundColor: 'rgba(60,28,6,0.2)' }} />
          ))}
          <View style={{ position: 'absolute', top: 2, left: 10, right: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,236,190,0.28)' }} />
          {[[9, 9], [plankW - 21, 9], [9, plankH - 21], [plankW - 21, plankH - 21]].map(([nx, ny], i) => (
            <View key={i} style={{ position: 'absolute', left: nx, top: ny, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E7B33A', borderWidth: 1, borderColor: '#7A4A00' }} />
          ))}
          {lines.map((l, i) => (
            <View key={i} style={{ height: lineH(l), alignItems: 'center', justifyContent: 'center' }}>
              <ChunkyText text={l.text} size={l.size} width={plankW - 26} fill={l.fill} hi={l.hi} outline={l.outline} ring={Math.max(1.4, l.size / 12)} extrude={Math.max(1, l.size / 20)} />
            </View>
          ))}
        </View>
      </View>

      {/* vines round the frame */}
      <View pointerEvents="none" style={{ position: 'absolute', top: plankTop - 8, left: -12 }}><Vine size={54} rotate={-8} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', top: plankTop - 4, right: -10 }}><Vine size={46} rotate={6} flip /></View>
      <View pointerEvents="none" style={{ position: 'absolute', top: plankTop + plankH + 62, left: -14 }}><Vine size={40} rotate={-30} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', top: plankTop + plankH + 92, right: -16 }}><Vine size={34} rotate={20} flip /></View>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -12, left: -12 }}><Vine size={50} rotate={-92} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -12, right: -12 }}><Vine size={50} rotate={92} flip /></View>

      {footer ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: -footerDrop, zIndex: 2 }}>{footer}</View>
      ) : null}

      {topSlot ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 3 }}>{topSlot}</View>
      ) : null}

      {onClose ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}
          onPress={() => { tapFx(); onClose(); }}
          style={{ position: 'absolute', top: plankTop + 2, right: -8, width: 38, height: 38, zIndex: 4 }}
        >
          <View style={{ position: 'absolute', left: 0, right: 0, top: 2, bottom: 0, borderRadius: 19, backgroundColor: '#8F1A14' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 2, borderRadius: 19, borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={gc('#FF806E', '#E23A30')} style={StyleSheet.absoluteFill} />
            <View style={{ zIndex: 1 }}><Icon name="close" size={18} color="#FFFFFF" /></View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The mascot on a grassy tuft between a red star block and a blue diamond block, among leaves and daisies. */
function MascotScene({ width = 236 }: { width?: number }) {
  const uid = useUid('msc');
  const k = width / 240;
  const cube = (x: number, y: number, rot: number, lo: string, mid: string, dark: string, glyph: 'star' | 'diamond', gl: string, key: string) => (
    <G key={key} transform={`translate(${x},${y}) rotate(${rot} 26 26)`}>
      <Path d={roundRect(1, 6, 52, 50, 12)} fill={dark} />
      <Path d={roundRect(0, 0, 52, 50, 12)} fill={mid} />
      <Path d={roundRect(0, 0, 52, 30, 12)} fill={lo} opacity={0.5} />
      <Path d={roundRect(4, 3, 30, 8, 4)} fill="#FFFFFF" opacity={0.4} />
      {glyph === 'star'
        ? <Path d={starPath(26, 27, 13, 5.6)} fill={gl} opacity={0.9} />
        : <Path d="M26 12 L40 27 L26 42 L12 27 Z" fill={gl} opacity={0.9} />}
    </G>
  );
  const leaf = (x: number, y: number, r: number, c: string, s: number, key: string) => (
    <Path key={key} d="M0 0 Q8 -12 20 0 Q8 9 0 0Z" fill={c} stroke="#1F6A28" strokeWidth={1.2}
      transform={`translate(${x},${y}) rotate(${r}) scale(${s})`} />
  );
  const daisy = (x: number, y: number, s: number, key: string) => (
    <G key={key} transform={`translate(${x},${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => <Ellipse key={a} cx={0} cy={-6} rx={4.4} ry={6.4} fill="#FFFFFF" stroke="#D9D2C0" strokeWidth={0.6} transform={`rotate(${a})`} />)}
      <Circle cx={0} cy={0} r={3.4} fill="#FFC93C" />
    </G>
  );
  return (
    <View style={{ width, height: 104 * k, alignSelf: 'center' }}>
      <Svg width={width} height={104 * k} viewBox="0 0 240 104" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7ED957" />
            <Stop offset="1" stopColor="#3E9E36" />
          </SvgLinear>
        </Defs>
        {/* leaves behind the blocks */}
        {leaf(18, 78, -150, '#3FAE33', 1.1, 'b1')}
        {leaf(28, 70, -110, '#5CCB43', 1.2, 'b2')}
        {leaf(40, 66, -70, '#2F9A2E', 1.1, 'b3')}
        {leaf(222, 78, -30, '#3FAE33', 1.1, 'b4')}
        {leaf(212, 70, -70, '#5CCB43', 1.2, 'b5')}
        {leaf(200, 66, -110, '#2F9A2E', 1.1, 'b6')}
        {leaf(96, 26, -120, '#5CCB43', 1.2, 'b7')}
        {leaf(146, 26, -60, '#5CCB43', 1.2, 'b8')}
        {/* the tuft of grass */}
        <Path d="M8 100 Q10 86 30 86 L210 86 Q232 86 232 100 Z" fill="#2E7A2A" transform="translate(0,3)" />
        <Path d="M8 98 Q10 84 30 84 L210 84 Q232 84 232 98 Q120 106 8 98 Z" fill={`url(#${uid}g)`} />
        <Path d="M18 88 Q120 80 222 88" stroke="#B8F08C" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
        <Ellipse cx={24} cy={98} rx={14} ry={4} fill="#8E8F98" />
        <Ellipse cx={216} cy={98} rx={14} ry={4} fill="#8E8F98" />
        {cube(34, 34, -7, '#FF9A92', '#EE4238', '#A8221C', 'star', '#B5231D', 'red')}
        {cube(154, 32, 7, '#8FB6FF', '#2F6FE8', '#1B47A8', 'diamond', '#1B47A8', 'blue')}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: (width - 92 * k) / 2, top: 0 }}>
        <MascotBlock size={92 * k} color={2} mood="happy" />
      </View>
      <Svg width={width} height={104 * k} viewBox="0 0 240 104" style={StyleSheet.absoluteFill} pointerEvents="none">
        {leaf(70, 96, -160, '#3FAE33', 0.9, 'f1')}
        {leaf(84, 98, -40, '#5CCB43', 0.8, 'f2')}
        {leaf(170, 98, -140, '#5CCB43', 0.8, 'f3')}
        {leaf(180, 96, -20, '#3FAE33', 0.9, 'f4')}
        {daisy(72, 90, 0.95, 'd1')}
        {daisy(168, 90, 0.95, 'd2')}
      </Svg>
    </View>
  );
}

/** A plump gold star, for the reward tile. */
function GoldStar({ size }: { size: number }) {
  const uid = useUid('gst');
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <SvgLinear id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE46A" />
          <Stop offset="1" stopColor="#FFAE1A" />
        </SvgLinear>
      </Defs>
      <Path d={starPath(20, 21.5, 18, 8.4)} fill="#B87800" transform="translate(0,1.5)" />
      <Path d={starPath(20, 21, 18, 8.4)} fill={`url(#${uid}s)`} stroke="#D98200" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={starPath(18, 18, 8, 3.6)} fill="#FFF6C0" opacity={0.7} />
    </Svg>
  );
}

/** One of the cream reward tiles: an icon over a label. */
function RewardTile({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EAC98E', borderWidth: 1.5, borderColor: '#D3AC6A' }}>
      <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text numberOfLines={1} style={{ color: '#7A4A22', fontSize: 13, includeFontPadding: false }}>{label}</Text>
    </View>
  );
}

function PauseCard({ onResume, onRestart, onSettings, onMap }: {
  onResume: () => void; onRestart: () => void; onSettings: () => void; onMap: () => void;
}) {
  const t = useT();
  return (
    <ModalCard plain maxWidth={330} onClose={onResume}>
      <ParchmentCard
        onClose={onResume}
        lines={[{ text: t('gamePaused'), size: 27, fill: '#FFF6E4', hi: '#FFFFFF', outline: '#3A1E08' }]}
      >
        <MascotScene />
        <View style={{ gap: 9, marginTop: 6 }}>
          <Btn label={titleCase(t('resume'))} icon="play" tone="green" big iconLeft onPress={onResume} />
          <Btn label={titleCase(t('restartLevel'))} icon="replay" tone="blue" big iconLeft onPress={onRestart} />
          <Btn label={t('levelMap')} icon="home" tone="gold" big iconLeft onPress={onMap} />
          <Btn label={titleCase(t('settings'))} icon="gear" tone="danger" big iconLeft onPress={onSettings} />
        </View>
      </ParchmentCard>
    </ModalCard>
  );
}

/* ==========================================================================
 * 12. GAME SCREEN
 * ========================================================================== */

type Slot = { id: number; variant: number; color: number } | null;
/** Why a level ended. 'stuck' is the one that makes room management matter. */
type FinishReason = 'won' | 'moves' | 'stuck';

type WinPayload = {
  stars: number; score: number; coins: number; lines: number;
  blocks: number; bestCombo: number; record: boolean;
};

/** Everything undo needs to put the play field back the way it was. */
type Snapshot = {
  board: BoardState; tray: Slot[]; score: number; lines: number; crystals: number; iceBroken: number;
  blocksUsed: number; movesLeft: number; streak: number; bestCombo: number;
};

/** Play-field geometry: the wood round the board, the rail beside it, the tray under it. */
const FRAME = 8;
const TRAY_PAD = 8;
const WELL_GAP = 5;

/** The best drop to point out: one that clears lines, else one that packs tight against walls and bricks. */
type HelperId = 'hint' | 'undo' | 'shuffle';
const HELPER_COST: Record<HelperId, number> = { hint: HINT_COST, undo: UNDO_COST, shuffle: POWER_BY_ID.shuffle.cost };
const HELPER_TITLE: Record<HelperId, StringKey> = { hint: 'freeHint', undo: 'freeUndo', shuffle: 'freeShuffle' };
const HELPER_ICON: Record<HelperId, IconName> = { hint: 'bulb', undo: 'undo', shuffle: 'shuffle' };

/** "Not enough coins": offer one free use in exchange for a rewarded ad. */
function AdOfferCard({ id, left, onWatch, onClose }: {
  id: HelperId; left: number; onWatch: () => void; onClose: () => void;
}) {
  const t = useT();
  return (
    <ModalCard glow={C.gold} maxWidth={330} onClose={onClose}>
      <View style={{ marginTop: 4 }}><Icon name={HELPER_ICON[id]} size={46} color={C.gold} /></View>
      <Text style={{ color: C.text, fontSize: 22, letterSpacing: 1.5, marginTop: 10 }}>{t(HELPER_TITLE[id])}</Text>
      <Text style={{ color: C.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 }}>{t('adOfferBody')}</Text>
      <Text style={{ color: C.gold, fontSize: 12.5, marginTop: 8 }}>{t('adsLeft')}: {left}</Text>
      <Btn label={t('watchAd')} icon="play" tone="green" big onPress={onWatch} style={{ marginTop: 16, alignSelf: 'stretch' }} />
      <Btn label={t('noThanks')} tone="glass" compact onPress={onClose} style={{ marginTop: 10, alignSelf: 'stretch' }} />
    </ModalCard>
  );
}

function findHint(b: BoardState, tray: Slot[]): { slot: number; row: number; col: number } | null {
  let best: { slot: number; row: number; col: number } | null = null;
  let bestScore = -1;
  for (let slot = 0; slot < tray.length; slot++) {
    const s = tray[slot];
    if (!s) continue;
    const v = VARIANTS[s.variant];
    for (let r = 0; r <= N - v.h; r++) {
      for (let c = 0; c <= N - v.w; c++) {
        if (!canPlace(b, v.cells, r, c)) continue;
        const { rows, cols } = linesAfter(b, v.cells, r, c);
        let contact = 0;
        for (const d of v.cells) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const rr = r + d.r + dr;
            const cc = c + d.c + dc;
            if (rr < 0 || cc < 0 || rr >= N || cc >= N || b.occ[idx(rr, cc)]) contact++;
          }
        }
        const sc = (rows.length + cols.length) * 100 + contact + v.size;
        if (sc > bestScore) { bestScore = sc; best = { slot, row: r, col: c }; }
      }
    }
  }
  return best;
}


function GameScreen({
  level, hasNext, bestScore, bestStars, save, backRef,
  onExit, onHome, onCoins, onNext, onWin, onSpendCoins, onSpendPower, onBuyPower, onHelp, onSettings,
}: {
  level: Level; hasNext: boolean; bestScore: number; bestStars: number; save: Save;
  /** Take coins if the player has them; false (and nothing taken) if not. */
  onSpendCoins: (n: number) => boolean;
  /** Root's Android Back button calls whatever is put here while a level is open. */
  backRef: React.MutableRefObject<(() => void) | null>;
  onExit: () => void; onHome: () => void; onCoins: () => void; onNext: () => void;
  onWin: (p: WinPayload) => void;
  onSpendPower: (id: PowerId) => void;
  onBuyPower: (id: PowerId) => boolean;
  onHelp: () => void; onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();

  const [board, setBoard] = useState<BoardState>(() => makeBoard(level));
  const [tray, setTray] = useState<Slot[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [crystals, setCrystals] = useState(0);
  const [iceBroken, setIceBroken] = useState(0);
  const [blocksUsed, setBlocksUsed] = useState(0);
  const [movesLeft, setMovesLeft] = useState(level.moves);
  const [streak, setStreak] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [armed, setArmed] = useState<PowerId | null>(null);
  const [aimCell, setAimCell] = useState<{ r: number; c: number } | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ slot: number; row: number; col: number; ok: boolean } | null>(null);
  const [bursts, setBursts] = useState<{ id: number; cells: number[] }[]>([]);
  const [combo, setCombo] = useState<{ id: number; n: number } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [result, setResult] = useState<{ reason: FinishReason; payload: WinPayload } | null>(null);
  const [paused, setPaused] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [turnTicks, setTurnTicks] = useState<Record<number, number>>({});
  const [epoch, setEpoch] = useState(0);
  const [offer, setOffer] = useState<HelperId | null>(null);
  const [hintShow, setHintShow] = useState<{ id: number; slot: number; row: number; col: number } | null>(null);
  const { width: winW } = useWindowDimensions();

  const histRef = useRef<Snapshot[]>([]);
  const seqRef = useRef(1);
  const boardRef = useRef(board);
  boardRef.current = board;
  const trayRef = useRef(tray);
  trayRef.current = tray;
  const doneRef = useRef(false);

  // Duck the music under the win / lose jingles and while paused, and always
  // restore it on the way out so the menu never inherits a quiet track.
  useEffect(() => { setMusicDuck(paused || result !== null); }, [paused, result]);
  useEffect(() => () => setMusicDuck(false), []);

  // Back pauses a running level, resumes a paused one, and leaves a finished one.
  useEffect(() => {
    backRef.current = () => { if (result) onExit(); else setPaused((p) => !p); };
    return () => { backRef.current = null; };
  }, [backRef, result, onExit]);

  const pool = useMemo(() => bagPool(level.bag), [level.bag]);
  const drawOne = useCallback((): Slot => ({
    id: seqRef.current++,
    variant: pool[Math.floor(Math.random() * pool.length)],
    color: Math.floor(Math.random() * BRICKS.length),
  }), [pool]);

  useEffect(() => {
    setTray([drawOne(), drawOne(), drawOne()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  /* --- layout ----------------------------------------------------------- */

  const layout = useMemo(() => {
    const w = stage.w;
    const h = stage.h;
    if (!w || !h) {
      return { cell: 0, boardX: 0, boardY: 0, boardSize: 0, frameX: 0, frameY: 0, frameW: 0, trayX: 0, trayW: 0, trayTop: 0, trayH: 0, wellW: 0 };
    }
    // The board and the rail sit side by side; the tray runs under both.
    const cellByW = Math.floor((w - 12 - FRAME * 2) / N);
    const cellByH = Math.floor((h - 10 - 4 - 70 - FRAME * 2) / N);
    const cell = Math.max(18, Math.min(cellByW, cellByH));
    const boardSize = cell * N;
    const frameW = boardSize + FRAME * 2;
    const usedW = frameW;
    const frameX = Math.round((w - usedW) / 2);
    // A tray only needs to be as tall as its blocks; spare height is split
    // around the pair so it sits in the middle of the stage.
    const free = h - frameW - 10;
    const trayH = Math.max(60, Math.min(Math.round(cell * 2.6), free - 4));
    const frameY = Math.max(2, Math.round((free - trayH) * 0.5));
    return {
      cell, boardSize, frameX, frameY, frameW,
      boardX: frameX + FRAME, boardY: frameY + FRAME,
      trayX: frameX, trayW: usedW, trayTop: frameY + frameW + 10, trayH,
      wellW: (usedW - TRAY_PAD * 2 - WELL_GAP * 2) / 3,
    };
  }, [stage.w, stage.h]);

  const cellSv = useSharedValue(1);
  const boardXsv = useSharedValue(0);
  const boardYsv = useSharedValue(0);
  useEffect(() => {
    cellSv.value = layout.cell || 1;
    boardXsv.value = layout.boardX;
    boardYsv.value = layout.boardY;
  }, [layout, cellSv, boardXsv, boardYsv]);

  const slotHome = useCallback((slot: number) => {
    const s = trayRef.current[slot];
    if (!s || !layout.cell) return { x: 0, y: 0, scale: 1 };
    const variant = VARIANTS[s.variant];
    const cx = layout.trayX + TRAY_PAD + slot * (layout.wellW + WELL_GAP) + layout.wellW / 2;
    const cy = layout.trayTop + layout.trayH / 2 - 1;
    const pxW = variant.w * layout.cell;
    const pxH = variant.h * layout.cell;
    const scale = Math.min((layout.wellW * 0.84) / pxW, ((layout.trayH - TRAY_PAD * 2) * 0.84) / pxH, 0.9);
    return { x: cx - pxW / 2, y: cy - pxH / 2, scale };
  }, [layout]);

  /* --- finish ----------------------------------------------------------- */

  const finish = useCallback((reason: FinishReason, finalScore: number, finalLines: number, finalBlocks: number, finalCombo: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const won = reason === 'won';
    const stars = won ? starsFor(level, finalScore) : 0;
    const record = won && finalScore > bestScore;
    const payload: WinPayload = {
      stars, score: finalScore,
      coins: won ? coinsFor(stars, bestStars === 0) : 0,
      lines: finalLines, blocks: finalBlocks, bestCombo: finalCombo, record,
    };
    setResult({ reason, payload });
    playSfx(won ? 'win' : 'lose');
    if (won) onWin(payload);
  }, [level, bestScore, bestStars, onWin]);

  /* --- placing ---------------------------------------------------------- */

  const api = useRef<DragApi>({
    hover: () => {}, drop: () => false, turn: () => {}, grab: () => {},
    slotHome: () => ({ x: 0, y: 0, scale: 1 }),
  });

  /** Everything that removes cells funnels through here, power-ups included. */
  const applyResult = useCallback((next: BoardState, res: PlaceResult, usedMove: boolean, comboStreak: number) => {
    const gained = scoreFor(res, comboStreak);
    const newScore = score + gained;
    const newLines = lines + res.lines;
    const newBlocks = blocksUsed + (res.placed > 0 ? 1 : 0);
    const newCombo = Math.max(bestCombo, res.lines, comboStreak);

    setBoard(next);
    setScore(newScore);
    setLines(newLines);
    setCrystals((n) => n + res.crystals);
    setIceBroken((n) => n + res.iceBroken);
    setStreak(comboStreak);
    setBestCombo(newCombo);
    if (res.placed > 0) setBlocksUsed(newBlocks);
    if (usedMove) setMovesLeft((m) => m - 1);

    if (res.cleared.length) {
      setBursts((b) => [...b, { id: seqRef.current++, cells: res.cleared }]);
      burst(Math.max(1, res.lines));
      playSfx('blast');
    } else if (res.placed > 0) {
      haptic.light();
      playSfx('place');
    }
    if (res.lines >= 2 || comboStreak >= 2) {
      setCombo({ id: seqRef.current++, n: Math.max(res.lines, comboStreak) });
      playSfx('combo');
    }

    const p: Progress = {
      lines: newLines, score: newScore,
      crystals: crystals + res.crystals, iceBroken: iceBroken + res.iceBroken,
    };
    if (goalMet(level, p)) finish('won', newScore, newLines, newBlocks, newCombo);
    else if (usedMove && movesLeft - 1 <= 0) finish('moves', newScore, newLines, newBlocks, newCombo);
  }, [score, lines, blocksUsed, bestCombo, crystals, iceBroken, level, movesLeft, finish]);

  api.current = {
    grab: (slot) => { setActiveSlot(slot); setHintShow(null); },

    hover: (slot, row, col, inRange) => {
      if (!inRange) { setPreview(null); return; }
      const s = trayRef.current[slot];
      if (!s) { setPreview(null); return; }
      setPreview({ slot, row, col, ok: canPlace(boardRef.current, VARIANTS[s.variant].cells, row, col) });
    },

    drop: (slot, row, col, inRange) => {
      setPreview(null);
      setActiveSlot(null);
      if (doneRef.current || paused) return false;
      const s = trayRef.current[slot];
      if (!s || !inRange) return false;
      const variant = VARIANTS[s.variant];
      if (!canPlace(boardRef.current, variant.cells, row, col)) return false;

      // Keep the field as it was, so Undo can put it back.
      histRef.current.push({
        board: boardRef.current, tray: trayRef.current, score, lines, crystals, iceBroken,
        blocksUsed, movesLeft, streak, bestCombo,
      });
      if (histRef.current.length > 12) histRef.current.shift();
      setHintShow(null);

      const next = cloneState(boardRef.current);
      const res = place(next, variant.cells, row, col, s.color);
      applyResult(next, res, true, res.lines > 0 ? streak + 1 : 0);

      setTray((prev) => {
        const cleared = prev.map((x, i) => (i === slot ? null : x));
        return cleared.every((x) => !x) ? [drawOne(), drawOne(), drawOne()] : cleared;
      });
      return true;
    },

    turn: (slot) => {
      setTray((prev) => prev.map((s, i) => (s && i === slot ? { ...s, variant: TURN_OF[s.variant] } : s)));
      setTurnTicks((x) => ({ ...x, [slot]: (x[slot] ?? 0) + 1 }));
      // The hint was worked out for the old orientation; it would now point at the wrong shape.
      setHintShow(null);
    },

    slotHome,
  };

  /**
   * Nothing in the tray fits anywhere, in any rotation — the level is over.
   * The check honours rotation because the player can rotate.
   */
  useEffect(() => {
    if (doneRef.current || paused || !tray.some(Boolean)) return;
    if (anyFits(board, tray.map((s) => (s ? s.variant : null)))) return;
    const id = setTimeout(() => finish('stuck', score, lines, blocksUsed, bestCombo), 620);
    return () => clearTimeout(id);
  }, [tray, board, paused, score, lines, blocksUsed, bestCombo, finish]);

  /* --- power-ups -------------------------------------------------------- */

  const say = useCallback((text: string) => setToast({ id: seqRef.current++, text }), []);

  const runPower = useCallback((id: PowerId, r?: number, c?: number) => {
    setHintShow(null);
    const next = cloneState(boardRef.current);
    let res: PlaceResult | null = null;

    if (id === 'hammer' && r !== undefined && c !== undefined) {
      res = hammer(next, r, c);
      if (!res.cleared.length) { say('TAP A COLOURED BLOCK'); haptic.err(); return false; }
    } else if (id === 'rocket' && r !== undefined && c !== undefined) {
      res = rocket(next, r, c);
    } else if (id === 'bomb' && r !== undefined && c !== undefined) {
      res = bomb(next, r, c);
    } else if (id === 'color' && r !== undefined && c !== undefined) {
      const k = idx(r, c);
      if (next.kind[k] !== KIND_NONE || next.color[k] < 0) { say('TAP A COLOURED BLOCK'); haptic.err(); return false; }
      res = colorBlast(next, next.color[k]);
    } else if (id === 'shuffle') {
      setTray([drawOne(), drawOne(), drawOne()]);
      haptic.medium();
      playSfx('power');
      return true;
    } else if (id === 'magic') {
      // Swap the biggest block in the tray for a 1x1, which fits anywhere.
      let big = -1;
      let bigSize = -1;
      trayRef.current.forEach((s, i) => {
        if (s && VARIANTS[s.variant].size > bigSize) { bigSize = VARIANTS[s.variant].size; big = i; }
      });
      if (big < 0) { haptic.err(); return false; }
      setTray((prev) => prev.map((s, i) => (i === big && s ? { ...s, variant: DOT_VARIANT } : s)));
      haptic.medium();
      playSfx('power');
      return true;
    }

    if (!res) return false;
    if (!res.cleared.length) { say('NOTHING THERE'); haptic.err(); return false; }
    // Power-ups do not consume a move, and do not extend a line combo.
    applyResult(next, res, false, 0);
    playSfx('power');
    return true;
  }, [applyResult, drawOne, say]);

  const tapPower = useCallback((id: PowerId) => {
    if (doneRef.current || paused) return;
    const def = POWER_BY_ID[id];
    const owned = save.powers[id] ?? 0;
    if (owned <= 0) {
      if (!onBuyPower(id)) { say(t('notEnough')); haptic.err(); playSfx('deny'); return; }
      playSfx('coin');
      say(`${def.name.toUpperCase()} +1`);
      return;
    }
    if (def.targeted) {
      if (armed !== id) say(def.hint);
      setArmed((cur) => (cur === id ? null : id));
      setAimCell(null);
      haptic.light();
      return;
    }
    if (runPower(id)) { histRef.current = []; onSpendPower(id); }
  }, [paused, armed, save.powers, onBuyPower, onSpendPower, runPower, say, t]);

  const tapBoard = useCallback((row: number, col: number) => {
    if (!armed) return;
    if (row < 0 || col < 0 || row >= N || col >= N) return;
    if (runPower(armed, row, col)) {
      histRef.current = [];
      onSpendPower(armed);
      setArmed(null);
      setAimCell(null);
    }
  }, [armed, runPower, onSpendPower]);

  /** Cells the armed power-up would hit, previewed as you move your finger. */
  const aim = useMemo(() => {
    const out = new Set<number>();
    if (!armed || !aimCell) return out;
    const { r, c } = aimCell;
    if (armed === 'hammer') { if (board.occ[idx(r, c)] && board.kind[idx(r, c)] === KIND_NONE) out.add(idx(r, c)); }
    else if (armed === 'rocket') { for (let i = 0; i < N; i++) { out.add(idx(r, i)); out.add(idx(i, c)); } }
    else if (armed === 'bomb') {
      for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) if (rr >= 0 && cc >= 0 && rr < N && cc < N) out.add(idx(rr, cc));
      }
    } else if (armed === 'color') {
      const k = idx(r, c);
      if (board.kind[k] === KIND_NONE && board.color[k] >= 0) {
        for (let i = 0; i < N * N; i++) if (board.kind[i] === KIND_NONE && board.color[i] === board.color[k]) out.add(i);
      }
    }
    return out;
  }, [armed, aimCell, board]);

  /** Hint: point at a good drop for one of the tray's blocks. */
  const doHint = useCallback(() => {
    const h = findHint(boardRef.current, trayRef.current);
    if (!h) return false;
    setHintShow({ id: seqRef.current++, ...h });
    haptic.light();
    playSfx('select');
    return true;
  }, []);

  useEffect(() => {
    if (!hintShow) return;
    const id = setTimeout(() => setHintShow(null), 3400);
    return () => clearTimeout(id);
  }, [hintShow]);

  /** Undo: take back the last block you placed, with its score and move. */
  const doUndo = useCallback(() => {
    const snap = histRef.current.pop();
    if (!snap) return false;
    setBoard(snap.board);
    setTray(snap.tray);
    setScore(snap.score);
    setLines(snap.lines);
    setCrystals(snap.crystals);
    setIceBroken(snap.iceBroken);
    setBlocksUsed(snap.blocksUsed);
    setMovesLeft(snap.movesLeft);
    setStreak(snap.streak);
    setBestCombo(snap.bestCombo);
    setHintShow(null);
    setPreview(null);
    setActiveSlot(null);
    haptic.medium();
    playSfx('swipe');
    return true;
  }, []);

  /* --- the three helpers: hint, undo, shuffle ------------------------------
   * Each costs coins. With too few coins the player can watch a rewarded ad for
   * one free use instead (capped per day, see ads.ts).                         */

  const adReady = useRewardedReady();
  const adsLeft = useAdsLeft();

  /** Do it now, for free. Returns whether it happened. */
  const runHelper = useCallback((id: HelperId) => {
    if (id === 'hint') return doHint();
    if (id === 'undo') return doUndo();
    const ok = runPower('shuffle');
    if (ok) histRef.current = [];
    return ok;
  }, [doHint, doUndo, runPower]);

  /** A helper that could not do anything right now must not cost anything. */
  const helperPossible = useCallback((id: HelperId) => {
    if (id === 'hint') return findHint(boardRef.current, trayRef.current) !== null;
    if (id === 'undo') return histRef.current.length > 0;
    return trayRef.current.some(Boolean);
  }, []);

  const tapHelper = useCallback((id: HelperId) => {
    if (doneRef.current || paused) return;
    if (!helperPossible(id)) {
      say(id === 'undo' ? t('nothingUndo') : 'NO MOVES');
      haptic.err(); playSfx('deny');
      return;
    }
    // A shuffle won as a gift is used up before any coins are.
    if (id === 'shuffle' && (save.powers.shuffle ?? 0) > 0) {
      if (runHelper('shuffle')) onSpendPower('shuffle');
      return;
    }
    if (onSpendCoins(HELPER_COST[id])) {
      if (runHelper(id)) playSfx('coin');
      return;
    }
    haptic.err(); playSfx('deny');
    if (adReady) setOffer(id);
    else say(adsLeft <= 0 ? t('adLimit') : t('notEnough'));
  }, [paused, helperPossible, say, t, save.powers.shuffle, runHelper, onSpendPower, onSpendCoins, adReady, adsLeft]);


  const restart = useCallback(() => {
    doneRef.current = false;
    histRef.current = [];
    setHintShow(null);
    setBoard(makeBoard(level));
    setScore(0); setLines(0); setCrystals(0); setIceBroken(0); setBlocksUsed(0);
    setMovesLeft(level.moves); setStreak(0); setBestCombo(0);
    setArmed(null); setAimCell(null);
    setPreview(null); setActiveSlot(null); setBursts([]); setCombo(null); setResult(null);
    setPaused(false); setTurnTicks({});
    setEpoch((e) => e + 1);
    haptic.medium();
  }, [level]);

  /** Undo the loss: hand back the board with a fresh tray and a few extra moves. */
  const revive = useCallback(() => {
    doneRef.current = false;
    histRef.current = [];
    setResult(null);
    setTray([drawOne(), drawOne(), drawOne()]);
    setMovesLeft((m) => Math.max(m, 5));
    haptic.ok();
    playSfx('power');
    say('+5 MOVES · NEW BLOCKS');
  }, [drawOne, say]);

  const adBusy = useRef(false);
  /** Run a rewarded ad and, only if it was watched to the end, its reward. */
  const watchAd = useCallback((reward: () => void) => {
    if (adBusy.current) return Promise.resolve(false);
    adBusy.current = true;
    return showRewarded()
      .then((ok) => { if (ok) reward(); return ok; })
      .catch(() => false)
      .finally(() => { adBusy.current = false; });
  }, []);

  /** Leaving a finished level is the natural moment for an interstitial, when one is due. */
  const afterAd = useCallback((go: () => void) => () => {
    showInterstitial()
      .then(() => { try { go(); } catch { /* navigation must never crash the app */ } })
      .catch(() => {});
  }, []);

  /* --- render ----------------------------------------------------------- */

  const goal = goalState(level, { lines, score, crystals, iceBroken });

  const highlight = useMemo(() => {
    const out = new Set<number>();
    if (!preview || !preview.ok) return out;
    const s = tray[preview.slot];
    if (!s) return out;
    const { rows, cols } = linesAfter(board, VARIANTS[s.variant].cells, preview.row, preview.col);
    for (const r of rows) for (let c = 0; c < N; c++) out.add(idx(r, c));
    for (const c of cols) for (let r = 0; r < N; r++) out.add(idx(r, c));
    return out;
  }, [preview, tray, board]);

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setStage((p) => (Math.abs(p.w - w) < 0.5 && Math.abs(p.h - h) < 0.5 ? p : { w, h }));
  }, []);

  const ready = layout.cell > 0;
  const shuffleOwned = save.powers.shuffle ?? 0;
  const progress: Progress = { lines, score, crystals, iceBroken };
  // The plank is centred on the screen, so it may only be as wide as the space left
  // once the coin bar (the wider side) is reserved on both sides.
  const COIN_W = 108;
  const plankW = Math.max(120, Math.min(176, winW - 2 * (12 + COIN_W + 6)));
  const hudH = Math.max(48, Math.round((56 * plankW) / 170));

  return (
    <ApiCtx.Provider value={api}>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        {/* ---------- HUD ---------- */}
        <View style={{ paddingHorizontal: 12 }}>
          <View style={{ height: hudH, justifyContent: 'center' }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <LevelPlank text={`${t('levelTitle')} ${level.index + 1}`} width={plankW} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <RoundBtn icon="pause" size={44} onPress={() => { setPaused(true); haptic.select(); }} />
              <CoinBar coins={save.coins} onPlus={onCoins} u={0.72} />
            </View>
          </View>
          <View style={{ marginTop: 2 }}>
            <GoalMovesPanel level={level} progress={progress} movesLeft={Math.max(0, movesLeft)}
              goalLabel={t('goalTitle')} movesLabel={t('movesTitle')} />
          </View>
          <ScoreStrip score={score} tiers={level.stars} onHelp={onHelp} />
        </View>

        {/* ---------- STAGE ---------- */}
        <View style={{ flex: 1, marginTop: 10 }} onLayout={onStageLayout}>
          {ready ? (
            <>
              {/* the wooden frame round the board, with a few leaves */}
              <WoodBox radius={22} style={{
                position: 'absolute', left: layout.frameX, top: layout.frameY, width: layout.frameW, height: layout.frameW,
              }}>
                <View pointerEvents="none" style={{
                  position: 'absolute', left: FRAME - 2, top: FRAME - 2, right: FRAME - 2, bottom: FRAME - 2,
                  borderRadius: 11, backgroundColor: '#0F1738', borderWidth: 2, borderColor: '#24130A',
                }} />
              </WoodBox>
              <View pointerEvents="none" style={{ position: 'absolute', left: layout.frameX - 9, top: layout.frameY - 9, zIndex: 5 }}>
                <Leaf size={38} rotate={-32} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', left: layout.frameX + 14, top: layout.frameY - 13, zIndex: 5 }}>
                <Leaf size={28} rotate={-74} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', left: layout.frameX - 11, top: layout.frameY + layout.frameW - 24, zIndex: 5 }}>
                <Leaf size={34} rotate={205} />
              </View>

              <View
                pointerEvents={armed ? 'auto' : 'none'}
                style={{
                  position: 'absolute', left: layout.boardX, top: layout.boardY,
                  width: layout.boardSize, height: layout.boardSize,
                }}
              >
                <BoardView board={board} size={layout.cell} highlight={highlight} aim={aim} />
                {bursts.map((b) => (
                  <ClearBurst key={b.id} cells={b.cells} size={layout.cell}
                    onDone={() => setBursts((list) => list.filter((x) => x.id !== b.id))} />
                ))}
                {armed ? (
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onTouchStart={(e) => {
                      const { locationX, locationY } = e.nativeEvent;
                      setAimCell({ r: Math.floor(locationY / layout.cell), c: Math.floor(locationX / layout.cell) });
                    }}
                    onPress={(e) => {
                      const { locationX, locationY } = e.nativeEvent;
                      tapBoard(Math.floor(locationY / layout.cell), Math.floor(locationX / layout.cell));
                    }}
                  >
                    <View style={[StyleSheet.absoluteFill, {
                      borderRadius: layout.cell * 0.4, borderWidth: 3,
                      borderColor: 'rgba(255,196,46,0.85)', backgroundColor: 'rgba(255,196,46,0.08)',
                    }]} />
                  </Pressable>
                ) : null}
              </View>

              {/* ghost of where the block will land */}
              {preview ? (() => {
                const s = tray[preview.slot];
                if (!s) return null;
                const v = VARIANTS[s.variant];
                return (
                  <View pointerEvents="none" style={{
                    position: 'absolute',
                    left: layout.boardX + preview.col * layout.cell,
                    top: layout.boardY + preview.row * layout.cell,
                    zIndex: 20,
                  }}>
                    {preview.ok ? (
                      <Bricks cells={v.cells} size={layout.cell} color={s.color} ghost shadow={false} />
                    ) : (
                      <Svg width={v.w * layout.cell} height={v.h * layout.cell}>
                        <Path
                          d={v.cells.map((c) => roundRect(
                            c.c * layout.cell + 2, c.r * layout.cell + 2,
                            layout.cell - 4, layout.cell - 4, layout.cell * 0.22)).join('')}
                          fill={C.no} fillOpacity={0.3} stroke={C.no} strokeWidth={2}
                        />
                      </Svg>
                    )}
                  </View>
                );
              })() : null}

              {/* the hint: this block, here */}
              {hintShow && !preview ? (() => {
                const s = tray[hintShow.slot];
                if (!s) return null;
                return (
                  <View pointerEvents="none" style={{
                    position: 'absolute',
                    left: layout.boardX + hintShow.col * layout.cell,
                    top: layout.boardY + hintShow.row * layout.cell,
                    zIndex: 18,
                  }}>
                    <HintGhost cells={VARIANTS[s.variant].cells} size={layout.cell} color={s.color} />
                  </View>
                );
              })() : null}

              {/* the tray: a wooden frame with three dark wells */}
              <WoodBox radius={20} style={{
                position: 'absolute', left: layout.trayX, top: layout.trayTop, width: layout.trayW, height: layout.trayH,
              }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} pointerEvents="none" style={{
                    position: 'absolute', left: TRAY_PAD + i * (layout.wellW + WELL_GAP), top: TRAY_PAD - 1,
                    width: layout.wellW, bottom: TRAY_PAD - 1, borderRadius: 12, overflow: 'hidden',
                    backgroundColor: '#182258', borderWidth: 2, borderColor: '#0B1238',
                  }}>
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 7, backgroundColor: 'rgba(0,0,12,0.35)' }} />
                  </View>
                ))}
              </WoodBox>

              {tray.map((s, i) => {
                if (!s) return null;
                const home = slotHome(i);
                return (
                  <TrayBlock
                    key={`${epoch}-${s.id}`}
                    slot={i}
                    variant={VARIANTS[s.variant]}
                    color={s.color}
                    cell={layout.cell}
                    homeX={home.x} homeY={home.y} homeScale={home.scale}
                    active={activeSlot === i}
                    locked={Boolean(result) || armed !== null || paused}
                    boardXsv={boardXsv} boardYsv={boardYsv} cellSv={cellSv}
                    turnTick={turnTicks[i] ?? 0}
                    entryDelay={i * 70}
                  />
                );
              })}
            </>
          ) : null}
        </View>

        {/* ---------- ACTIONS: hint, undo, shuffle ---------- */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly',
          paddingTop: 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 20,
        }}>
          <SideAction icon="bulb" label={t('hint')} tint="#FFD84D" cost={HINT_COST}
            dim={save.coins < HINT_COST} onPress={() => tapHelper('hint')} />
          <SideAction icon="undo" label={t('undo')} tint="#6FD0FF" cost={UNDO_COST}
            dim={save.coins < UNDO_COST} onPress={() => tapHelper('undo')} />
          <SideAction icon="shuffle" label={t('shuffle')} tint="#66E890"
            badge={shuffleOwned > 0 ? `${shuffleOwned}` : undefined}
            cost={shuffleOwned > 0 ? undefined : POWER_BY_ID.shuffle.cost}
            dim={shuffleOwned <= 0 && save.coins < POWER_BY_ID.shuffle.cost}
            onPress={() => tapHelper('shuffle')} />
        </View>
      </View>

      {combo ? <ComboBanner key={combo.id} n={combo.n} onDone={() => setCombo(null)} /> : null}
      {toast ? <Toast key={toast.id} text={toast.text} onDone={() => setToast(null)} /> : null}

      {offer && !result ? (
        <AdOfferCard
          id={offer} left={adsLeft}
          onClose={() => setOffer(null)}
          onWatch={() => {
            const id = offer;
            setOffer(null);
            void watchAd(() => { runHelper(id); });
          }}
        />
      ) : null}

      {paused && !result ? (
        <PauseCard
          onResume={() => setPaused(false)}
          onRestart={restart}
          onSettings={onSettings}
          onMap={onExit}
        />
      ) : null}

      {result ? (
        result.reason === 'won' ? (
          <LevelCompleteCard
            level={level} payload={result.payload}
            bestScore={Math.max(bestScore, result.payload.score)} hasNext={hasNext}
            onNext={afterAd(onNext)} onAgain={afterAd(restart)} onHome={onHome} onMap={afterAd(onExit)}
          />
        ) : (
          <GameOverCard
            level={level} reason={result.reason} score={result.payload.score} bestScore={bestScore}
            canBoost={POWERS.some((p) => (save.powers[p.id] ?? 0) > 0)}
            onAgain={afterAd(restart)}
            onBooster={revive}
            onWatchAd={() => { void watchAd(revive); }}
            onHome={afterAd(onHome)}
            onMap={afterAd(onExit)}
          />
        )
      ) : null}
    </ApiCtx.Provider>
  );
}

/* --- end-of-level cards --------------------------------------------------- */




/* ==========================================================================
 * 10. WELCOME + HOME + ADVENTURE
 * ========================================================================== */

/* ==========================================================================
 * 10a. HOME SCREEN
 *
 * The title / home screen. Nothing on it is a bitmap: the forest is one
 * 370 x 594 SVG "stage" that covers the screen, and the logo, blocks, buttons
 * and cards are SVG, gradients and animated Views laid over it. The UI is sized
 * by a single scale `u`, so it keeps its proportions on any phone.
 * ========================================================================== */

const FOREST_W = 370;
const FOREST_H = 594;

/** The forest stage scaled to COVER the screen, and where it lands. */
function useCover() {
  const { width, height } = useWindowDimensions();
  const s = Math.max(width / FOREST_W, height / FOREST_H);
  return { width, height, s, ox: (width - FOREST_W * s) / 2, oy: (height - FOREST_H * s) / 2 };
}

/** One shared looping 0..1 value, eased, for bobbing and pulsing. */
function useLoop(period: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [period, delay, v]);
  return v;
}

/** A twinkling four-point sparkle. */
function Sparkle({ x, y, size, delay, color = '#FFFFFF', u }: {
  x: number; y: number; size: number; delay: number; color?: string; u: number;
}) {
  const v = useLoop(1300 + (delay % 700), delay);
  const aStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + v.value * 0.75,
    transform: [{ scale: 0.55 + v.value * 0.6 }, { rotate: `${v.value * 30}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: (x - size) * u, top: (y - size) * u, width: size * 2 * u, height: size * 2 * u }, aStyle]}>
      <Svg width="100%" height="100%" viewBox="-10 -10 20 20">
        <Path d="M0 -10 Q1.4 -1.4 10 0 Q1.4 1.4 0 10 Q-1.4 1.4 -10 0 Q-1.4 -1.4 0 -10Z" fill={color} />
        <Circle cx={0} cy={0} r={2.2} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/* --- the forest ------------------------------------------------------------- */

/** A mass of foliage: a dark base, a lit middle, pointed leaves round the edge, bright flecks. */
function Foliage({ blobs, dark, mid, light, seed }: {
  blobs: [number, number, number][]; dark: string; mid: string; light: string; seed: number;
}) {
  const bits = useMemo(() => {
    const rnd = seeded(seed);
    const leaves: { x: number; y: number; a: number; len: number; c: number }[] = [];
    const flecks: { x: number; y: number; r: number }[] = [];
    for (const [x, y, r] of blobs) {
      for (let i = 0; i < 9; i++) {
        const a = rnd() * Math.PI * 2;
        leaves.push({ x: x + Math.cos(a) * r * 0.92, y: y + Math.sin(a) * r * 0.92, a: (a * 180) / Math.PI, len: r * (0.34 + rnd() * 0.3), c: i % 2 });
      }
      for (let i = 0; i < 5; i++) {
        flecks.push({ x: x + (rnd() - 0.68) * r * 0.9, y: y + (rnd() - 0.8) * r * 0.85, r: r * (0.1 + rnd() * 0.1) });
      }
    }
    return { leaves, flecks };
  }, [blobs, seed]);
  return (
    <G>
      {bits.leaves.map((l, i) => (
        <Path key={`l${i}`} d={`M0 0 Q${q2(l.len * 0.5)} ${q2(-l.len * 0.32)} ${q2(l.len)} 0 Q${q2(l.len * 0.5)} ${q2(l.len * 0.32)} 0 0Z`}
          fill={l.c ? mid : dark} transform={`translate(${q2(l.x)},${q2(l.y)}) rotate(${q2(l.a)})`} />
      ))}
      {blobs.map(([x, y, r], i) => <Circle key={`d${i}`} cx={x} cy={y} r={r} fill={dark} />)}
      {blobs.map(([x, y, r], i) => <Circle key={`m${i}`} cx={x - r * 0.06} cy={y - r * 0.12} r={r * 0.84} fill={mid} />)}
      {bits.flecks.map((f, i) => <Ellipse key={`f${i}`} cx={f.x} cy={f.y} rx={f.r * 1.5} ry={f.r} fill={light} opacity={0.85} />)}
    </G>
  );
}

function ForestPine({ x, y, s, dark, mid }: { x: number; y: number; s: number; dark: string; mid: string }) {
  const tier = (k: number, w: number, top: number) =>
    `M${q2(x)} ${q2(y - s * top)} L${q2(x + s * w)} ${q2(y - s * k)} L${q2(x - s * w)} ${q2(y - s * k)} Z`;
  return (
    <G>
      <Rect x={x - s * 0.04} y={y - s * 0.12} width={s * 0.08} height={s * 0.14} fill={dark} />
      <Path d={tier(0.1, 0.3, 0.5)} fill={dark} />
      <Path d={tier(0.36, 0.24, 0.76)} fill={mid} />
      <Path d={tier(0.62, 0.17, 1)} fill={dark} />
      <Path d={`M${q2(x)} ${q2(y - s)} L${q2(x - s * 0.17)} ${q2(y - s * 0.62)} L${q2(x - s * 0.02)} ${q2(y - s * 0.62)} Z`} fill="#FFFFFF" opacity={0.14} />
    </G>
  );
}

/** A smooth round bush: dark base, lit top, a couple of blossoms. */
function Bush({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Ellipse cx={0} cy={4} rx={26} ry={5} fill="#0A3A1E" opacity={0.3} />
      <Circle cx={-14} cy={-2} r={13} fill="#1F7A34" />
      <Circle cx={13} cy={-3} r={14} fill="#1F7A34" />
      <Circle cx={0} cy={-10} r={16} fill="#2A9A40" />
      <Circle cx={-4} cy={-14} r={9} fill="#5CC85A" opacity={0.85} />
      <Circle cx={12} cy={-8} r={5} fill="#8EE06A" opacity={0.8} />
      <Circle cx={-16} cy={-6} r={2.2} fill="#FFFFFF" />
      <Circle cx={8} cy={-18} r={2} fill="#FFD84D" />
      <Circle cx={18} cy={-2} r={2} fill="#FF9BD0" />
    </G>
  );
}

function Mushroom({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Ellipse cx={0} cy={1} rx={9} ry={2.4} fill="#000000" opacity={0.22} />
      <Path d="M-3.4 0 Q-3 -6 -2.4 -8 L2.4 -8 Q3 -6 3.4 0 Z" fill="#F6E6C8" stroke="#C9A878" strokeWidth={0.6} />
      <Path d="M-11 -8 Q-11 -20 0 -20 Q11 -20 11 -8 Q0 -5 -11 -8 Z" fill="#E8342E" />
      <Path d="M-11 -8 Q0 -5 11 -8 Q10 -6.2 0 -4.4 Q-10 -6.2 -11 -8Z" fill="#8A1A16" opacity={0.6} />
      <Path d="M-8 -14 Q-6 -18 -2 -18.6" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={-4.6} cy={-12.6} r={1.9} fill="#FFFFFF" />
      <Circle cx={2.8} cy={-15.4} r={2.2} fill="#FFFFFF" />
      <Circle cx={6.6} cy={-10.6} r={1.5} fill="#FFFFFF" />
    </G>
  );
}

function Flower({ x, y, s, petal, core = '#FFD84D', petals = 6 }: {
  x: number; y: number; s: number; petal: string; core?: string; petals?: number;
}) {
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Path d="M0 0 Q1 8 -1 14" fill="none" stroke="#2E9A45" strokeWidth={1.6} strokeLinecap="round" />
      {Array.from({ length: petals }, (_, i) => (
        <Ellipse key={i} cx={0} cy={-5.2} rx={2.7} ry={5.2} fill={petal} transform={`rotate(${(360 / petals) * i})`} />
      ))}
      <Circle cx={0} cy={0} r={3} fill={core} />
      <Circle cx={-0.8} cy={-0.8} r={1.1} fill="#FFFFFF" opacity={0.6} />
    </G>
  );
}

/** A small island floating in the sky, with a tree or two on it. */
function FloatIsle({ cx, cy, w, trees = 1 }: { cx: number; cy: number; w: number; trees?: number }) {
  const rock = `M${cx - w / 2} ${cy} Q${cx - w * 0.46} ${cy + w * 0.22} ${cx - w * 0.24} ${cy + w * 0.36} Q${cx - w * 0.08} ${cy + w * 0.6} ${cx} ${cy + w * 0.7} Q${cx + w * 0.1} ${cy + w * 0.55} ${cx + w * 0.26} ${cy + w * 0.36} Q${cx + w * 0.46} ${cy + w * 0.2} ${cx + w / 2} ${cy} Z`;
  return (
    <G>
      <Path d={rock} fill="#8C7660" />
      <Path d={`M${cx} ${cy} L${cx + w / 2} ${cy} Q${cx + w * 0.46} ${cy + w * 0.2} ${cx + w * 0.26} ${cy + w * 0.36} Q${cx + w * 0.1} ${cy + w * 0.55} ${cx} ${cy + w * 0.7} Z`} fill="#000000" opacity={0.16} />
      <Ellipse cx={cx} cy={cy + 1} rx={w / 2} ry={w * 0.09} fill="#3C9A44" />
      <Ellipse cx={cx} cy={cy - 1} rx={w / 2 - 1} ry={w * 0.08} fill="#7FD955" />
      {trees >= 1 ? (
        <G>
          <Rect x={cx - w * 0.18 - 1} y={cy - w * 0.12} width={2} height={w * 0.12} fill="#6B4A2E" />
          <Circle cx={cx - w * 0.18} cy={cy - w * 0.17} r={w * 0.1} fill="#2C9A56" />
          <Circle cx={cx - w * 0.21} cy={cy - w * 0.2} r={w * 0.05} fill="#6BE08A" opacity={0.75} />
        </G>
      ) : null}
      {trees >= 2 ? (
        <Path d={`M${cx + w * 0.16} ${cy - w * 0.3} L${cx + w * 0.25} ${cy - w * 0.02} L${cx + w * 0.07} ${cy - w * 0.02} Z`} fill="#1F8F55" />
      ) : null}
    </G>
  );
}

/** A little fairy-tale castle: a keep and two towers under red roofs. */
function ForestCastle({ x, y, s }: { x: number; y: number; s: number }) {
  const roof = (l: number, r: number, base: number, top: number, c: string) => (
    <Path d={`M${l} ${base} L${(l + r) / 2} ${top} L${r} ${base} Z`} fill={c} stroke="#8A2622" strokeWidth={0.8} strokeLinejoin="round" />
  );
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Rect x={-38} y={-30} width={15} height={30} fill="#F2E6CB" />
      <Rect x={-38} y={-30} width={5} height={30} fill="#D8C6A0" />
      {roof(-41, -20, -30, -54, '#D8433B')}
      <Rect x={23} y={-36} width={15} height={36} fill="#F2E6CB" />
      <Rect x={33} y={-36} width={5} height={36} fill="#D8C6A0" />
      {roof(20, 41, -36, -62, '#D8433B')}
      <Rect x={-17} y={-46} width={34} height={46} fill="#F6ECD4" />
      <Rect x={9} y={-46} width={8} height={46} fill="#D8C6A0" />
      {roof(-21, 21, -46, -84, '#E24A40')}
      <Path d="M0 -84 L0 -96" stroke="#6A4A2E" strokeWidth={1.2} />
      <Path d="M0 -96 L9 -93 L0 -90 Z" fill="#FF4D6D" />
      <Path d="M-5 0 V-12 A5 5 0 0 1 5 -12 V0 Z" fill="#5A3A22" />
      {[[-7, -38], [3, -38], [-30, -20], [29, -26]].map(([wx, wy], i) => (
        <Rect key={i} x={wx} y={wy} width={4.4} height={8} rx={2.2} fill="#7A5A9A" />
      ))}
    </G>
  );
}

/** A little cottage for the village on the hill. */
function Cottage({ x, y, s, roof, wall }: { x: number; y: number; s: number; roof: string; wall: string }) {
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Ellipse cx={2} cy={1} rx={22} ry={3.4} fill="#0B3B1E" opacity={0.3} />
      <Rect x={-15} y={-17} width={30} height={17} fill={wall} stroke="#8A6A44" strokeWidth={0.9} />
      <Rect x={7} y={-33} width={5} height={10} fill="#B8623A" stroke="#7A3A22" strokeWidth={0.7} />
      <Path d="M-20 -16 L0 -33 L20 -16 Z" fill={roof} stroke="#7A2A22" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M-14 -17 L-1 -29 L-1 -25 L-9 -17 Z" fill="#FFFFFF" opacity={0.25} />
      <Rect x={-3.5} y={-10} width={7} height={10} rx={3} fill="#7A4A26" />
      <Rect x={-12} y={-13} width={6} height={6} fill="#8FD8FF" stroke="#8A6A44" strokeWidth={0.8} />
      <Rect x={7} y={-13} width={6} height={6} fill="#8FD8FF" stroke="#8A6A44" strokeWidth={0.8} />
    </G>
  );
}

/** Everything in the forest that never moves. */
const ForestArt = React.memo(function ForestArt() {
  const uid = useUid('fa');
  const id = (n: string) => `${uid}${n}`;

  const tufts = useMemo(() => {
    const rnd = seeded(2024);
    return Array.from({ length: 70 }, () => ({ x: rnd() * 370, y: 330 + rnd() * 264, s: 0.7 + rnd() * 0.9, l: rnd() > 0.5 }));
  }, []);
  const leftCanopy = useMemo<[number, number, number][]>(
    () => [[6, 18, 62], [64, -8, 50], [112, 22, 38], [28, 70, 44], [-10, 92, 36], [82, 56, 30], [140, -8, 34]], []);
  const rightCanopy = useMemo<[number, number, number][]>(
    () => [[352, 12, 60], [300, -12, 52], [258, 20, 34], [340, 68, 44], [298, 48, 30], [378, 96, 40], [236, -10, 28]], []);
  const leftFoot = useMemo<[number, number, number][]>(
    () => [[-6, 600, 44], [30, 594, 34], [58, 606, 30], [8, 560, 30]], []);
  const rightFoot = useMemo<[number, number, number][]>(
    () => [[376, 600, 44], [340, 594, 34], [312, 606, 30], [368, 560, 30]], []);

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${FOREST_W} ${FOREST_H}`} preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinear id={id('sky')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="340">
          <Stop offset="0" stopColor="#3C97DE" />
          <Stop offset="0.4" stopColor="#7AC6EE" />
          <Stop offset="0.75" stopColor="#C4EAF2" />
          <Stop offset="1" stopColor="#E6F6D6" />
        </SvgLinear>
        <SvgRadial id={id('sun')} gradientUnits="userSpaceOnUse" cx="250" cy="120" r="250">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </SvgRadial>
        <SvgLinear id={id('mtn')} gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="320">
          <Stop offset="0" stopColor="#8C9AE0" />
          <Stop offset="1" stopColor="#B7CBF0" />
        </SvgLinear>
        <SvgLinear id={id('haze')} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="340">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="1" stopColor="#F2FFE6" stopOpacity="0.75" />
        </SvgLinear>
        <SvgLinear id={id('cliff')} gradientUnits="userSpaceOnUse" x1="236" y1="180" x2="370" y2="312">
          <Stop offset="0" stopColor="#A29A84" />
          <Stop offset="1" stopColor="#6A6454" />
        </SvgLinear>
        <SvgLinear id={id('fall')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
          <Stop offset="1" stopColor="#8FE4FF" stopOpacity="0.85" />
        </SvgLinear>
        <SvgLinear id={id('hill')} gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="400">
          <Stop offset="0" stopColor="#6CC070" />
          <Stop offset="1" stopColor="#3E9C55" />
        </SvgLinear>
        <SvgLinear id={id('gnd')} gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="594">
          <Stop offset="0" stopColor="#8EDB52" />
          <Stop offset="0.45" stopColor="#5CB83F" />
          <Stop offset="1" stopColor="#2C8A34" />
        </SvgLinear>
        <SvgRadial id={id('clear')} gradientUnits="userSpaceOnUse" cx="190" cy="400" r="210">
          <Stop offset="0" stopColor="#F2FF9A" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#F2FF9A" stopOpacity="0" />
        </SvgRadial>
        <SvgLinear id={id('dirt')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F1D89B" />
          <Stop offset="1" stopColor="#C89A58" />
        </SvgLinear>
        <SvgLinear id={id('bark')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#3E210E" />
          <Stop offset="0.5" stopColor="#7C4A22" />
          <Stop offset="1" stopColor="#452510" />
        </SvgLinear>
        <SvgLinear id={id('barkR')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#4B2A12" />
          <Stop offset="0.55" stopColor="#7A4A22" />
          <Stop offset="1" stopColor="#3A1E0C" />
        </SvgLinear>
        <SvgLinear id={id('vt')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="150">
          <Stop offset="0" stopColor="#06301A" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#06301A" stopOpacity="0" />
        </SvgLinear>
        <SvgLinear id={id('vb')} gradientUnits="userSpaceOnUse" x1="0" y1="480" x2="0" y2="594">
          <Stop offset="0" stopColor="#0B3B1E" stopOpacity="0" />
          <Stop offset="1" stopColor="#0B3B1E" stopOpacity="0.5" />
        </SvgLinear>
        <SvgRadial id={id('vs')} gradientUnits="userSpaceOnUse" cx="185" cy="330" r="430">
          <Stop offset="0.6" stopColor="#0A3A1E" stopOpacity="0" />
          <Stop offset="1" stopColor="#0A3A1E" stopOpacity="0.24" />
        </SvgRadial>
      </Defs>

      {/* sky, sun-glow and the far mountain */}
      <Rect x={0} y={0} width={370} height={594} fill={`url(#${id('sky')})`} />
      <Rect x={0} y={0} width={370} height={340} fill={`url(#${id('sun')})`} />
      <Path d="M140 322 L212 214 L256 152 L292 86 L312 132 L334 110 L370 166 L370 322 Z" fill={`url(#${id('mtn')})`} />
      <Path d="M292 86 L312 132 L334 110 L370 166 L370 322 L300 322 Z" fill="#6E7EC4" opacity={0.32} />
      <Path d="M292 86 L273 126 Q281 121 287 130 Q293 120 299 131 Q305 121 312 132 Z" fill="#F6FAFF" />
      <Path d="M240 172 Q252 164 262 176 Q252 172 244 182 Z" fill="#F6FAFF" opacity={0.7} />
      <Rect x={0} y={200} width={370} height={140} fill={`url(#${id('haze')})`} />

      {/* islands drifting in the sky, and the castle on the biggest */}
      <FloatIsle cx={96} cy={150} w={40} trees={2} />
      <FloatIsle cx={186} cy={98} w={30} trees={1} />
      <FloatIsle cx={292} cy={150} w={80} trees={0} />
      <ForestCastle x={292} y={148} s={0.85} />

      {/* the far pines, blue-green in the distance */}
      {[[108, 296, 40], [128, 298, 54], [150, 294, 38], [172, 292, 30]].map(([x, y, s], i) => (
        <ForestPine key={`fl${i}`} x={x} y={y} s={s} dark="#2C8A6E" mid="#3AA07E" />
      ))}
      {[[296, 298, 42], [318, 300, 56], [340, 302, 78], [360, 304, 96]].map(([x, y, s], i) => (
        <ForestPine key={`fr${i}`} x={x} y={y} s={s} dark="#1E6F5C" mid="#2A8A70" />
      ))}

      {/* cliff and waterfall */}
      <Path d="M236 262 Q244 196 276 186 Q300 176 330 184 Q358 192 370 214 L370 316 L236 316 Z" fill={`url(#${id('cliff')})`} />
      <Path d="M246 228 Q258 192 284 188 Q310 182 334 188 Q350 194 358 208 Q330 202 300 206 Q270 210 246 228 Z" fill="#54AC58" />
      <Path d="M250 236 Q262 214 282 212 Q272 226 262 250 Z" fill="#4A9E52" opacity={0.85} />
      <Path d="M246 262 Q262 250 272 264 Q284 252 292 268 L292 300 L246 300 Z" fill="#000000" opacity={0.12} />
      <Path d="M296 196 Q310 190 324 196 L330 296 Q310 302 290 296 Z" fill={`url(#${id('fall')})`} />
      <Path d="M303 200 L301 290 M312 198 L313 294 M320 200 L323 292" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.8} strokeLinecap="round" />
      <Ellipse cx={310} cy={302} rx={44} ry={9} fill="#62C6E8" opacity={0.85} />
      <Ellipse cx={310} cy={298} rx={30} ry={7.5} fill="#FFFFFF" opacity={0.7} />
      <Ellipse cx={310} cy={296} rx={18} ry={5} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={286} cy={292} r={7} fill="#FFFFFF" opacity={0.28} />
      <Circle cx={334} cy={290} r={8} fill="#FFFFFF" opacity={0.26} />

      {/* rolling hill, then the meadow */}
      <Path d="M0 292 Q60 262 130 282 Q200 300 260 280 Q320 260 370 282 L370 400 L0 400 Z" fill={`url(#${id('hill')})`} />

      {/* the village on the hill */}
      <ForestPine x={40} y={290} s={36} dark="#1F7A4C" mid="#2E9A5E" />
      <Cottage x={70} y={286} s={1.05} roof="#D8583A" wall="#F6E6C8" />
      <Cottage x={106} y={280} s={0.82} roof="#E88A3A" wall="#F2DDB8" />
      <ForestPine x={132} y={284} s={30} dark="#1F7A4C" mid="#2E9A5E" />

      {/* the lake the waterfall falls into, with a little bridge */}
      <Path d="M150 306 Q166 284 212 282 Q300 274 384 286 L384 334 Q300 340 212 334 Q166 334 150 306 Z" fill="#F0E2A8" />
      <Path d="M154 306 Q168 289 212 287 Q300 279 380 291 L380 330 Q300 335 212 330 Q170 330 154 306 Z" fill="#3FB0E8" />
      <Path d="M172 306 Q192 297 232 297 Q300 291 372 299 L372 322 Q300 326 232 322 Q188 322 172 306 Z" fill="#7ED8F8" opacity={0.7} />
      {[[190, 312], [250, 304], [300, 318], [340, 306]].map(([rx, ry], i) => (
        <Path key={i} d={`M${rx} ${ry} q6 -3 12 0 t12 0`} fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.4} strokeLinecap="round" />
      ))}
      <Path d="M166 314 Q198 280 232 312" fill="none" stroke="#5A3418" strokeWidth={10} strokeLinecap="round" />
      <Path d="M166 314 Q198 280 232 312" fill="none" stroke="#C98F52" strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M168 306 Q198 272 230 303" fill="none" stroke="#8A5A2E" strokeWidth={2.6} strokeLinecap="round" />
      {[[178, 304], [190, 293], [204, 291], [218, 297]].map(([px, py], i) => (
        <Path key={i} d={`M${px} ${py} V${py + 9}`} stroke="#8A5A2E" strokeWidth={2} strokeLinecap="round" />
      ))}
      <Path d="M0 322 Q80 298 170 314 Q260 330 370 304 L370 594 L0 594 Z" fill={`url(#${id('gnd')})`} />
      <Path d="M0 322 Q80 298 170 314 Q260 330 370 304" fill="none" stroke="#B6F27E" strokeOpacity={0.6} strokeWidth={2.4} />
      <Ellipse cx={190} cy={400} rx={210} ry={170} fill={`url(#${id('clear')})`} />

      {/* the trail winding toward the player */}
      <Path d="M150 594 Q168 522 178 468 Q186 432 200 424 Q216 444 226 492 Q240 542 264 594 Z" fill={`url(#${id('dirt')})`} opacity={0.92} />
      <Path d="M150 594 Q168 522 178 468 Q186 432 200 424" fill="none" stroke="#8E6532" strokeOpacity={0.5} strokeWidth={2.4} />
      <Path d="M226 492 Q240 542 264 594" fill="none" stroke="#8E6532" strokeOpacity={0.5} strokeWidth={2.4} />

      {/* grass texture */}
      {tufts.map((t, i) => (
        <Path key={i} d={`M${q2(t.x)} ${q2(t.y)} q${q2(-3 * t.s)} ${q2(-8 * t.s)} ${q2(-6 * t.s)} ${q2(-11 * t.s)} M${q2(t.x)} ${q2(t.y)} q0 ${q2(-9 * t.s)} ${q2(1 * t.s)} ${q2(-14 * t.s)} M${q2(t.x)} ${q2(t.y)} q${q2(3 * t.s)} ${q2(-7 * t.s)} ${q2(6 * t.s)} ${q2(-10 * t.s)}`}
          fill="none" stroke={t.l ? '#B8F27E' : '#2C8A34'} strokeOpacity={t.l ? 0.75 : 0.55} strokeWidth={1.5} strokeLinecap="round" />
      ))}

      {/* rocks */}
      <Ellipse cx={14} cy={374} rx={28} ry={21} fill="#8C94A3" />
      <Ellipse cx={12} cy={368} rx={24} ry={16} fill="#A9B1BE" />
      <Ellipse cx={4} cy={362} rx={12} ry={6} fill="#FFFFFF" opacity={0.28} />
      <Ellipse cx={16} cy={360} rx={16} ry={6} fill="#56B050" />
      <Ellipse cx={46} cy={394} rx={20} ry={13} fill="#9AA2B0" />
      <Ellipse cx={44} cy={389} rx={16} ry={9} fill="#B8BFCA" />
      <Ellipse cx={354} cy={352} rx={24} ry={17} fill="#8F97A6" />
      <Ellipse cx={352} cy={347} rx={20} ry={12} fill="#AEB6C2" />
      <Ellipse cx={356} cy={340} rx={14} ry={5.5} fill="#56B050" />

      {/* trunks */}
      <Path d="M68 -10 L86 -10 Q84 52 90 110 L72 110 Q66 50 68 -10 Z" fill="#2E1A0C" opacity={0.6} />
      <Path d="M-14 -10 L48 -10 Q41 92 51 172 Q42 244 62 320 Q30 332 -14 338 Z" fill={`url(#${id('bark')})`} />
      <Path d="M14 0 Q9 80 20 172 M30 22 Q27 102 36 196 M4 40 Q2 120 10 206" fill="none" stroke="#2A1408" strokeOpacity={0.55} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M40 6 Q36 100 45 204" fill="none" stroke="#B57A42" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={10} cy={130} rx={11} ry={16} fill="#4C9A3C" opacity={0.85} />
      <Ellipse cx={38} cy={222} rx={9} ry={14} fill="#4C9A3C" opacity={0.8} />
      <Ellipse cx={30} cy={340} rx={92} ry={13} fill="#0A3A1E" opacity={0.28} />
      <Bush x={22} y={346} s={1.1} />
      <Bush x={62} y={352} s={0.7} />

      <Path d="M330 -10 L384 -10 L384 332 Q362 324 346 320 Q354 252 343 182 Q351 100 335 30 Z" fill={`url(#${id('barkR')})`} />
      <Path d="M352 6 Q346 100 356 196 M368 30 Q364 130 372 220" fill="none" stroke="#2A1408" strokeOpacity={0.5} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M340 12 Q336 100 346 190" fill="none" stroke="#B57A42" strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={340} cy={342} rx={80} ry={12} fill="#0A3A1E" opacity={0.28} />
      <Bush x={350} y={346} s={1.1} />
      <Bush x={310} y={352} s={0.7} />

      {/* canopies */}
      <Foliage blobs={leftCanopy} dark="#0C4E28" mid="#1D8A3E" light="#7FD760" seed={11} />
      <Foliage blobs={rightCanopy} dark="#0F5A2C" mid="#2A9A40" light="#A6E86A" seed={23} />
      <Path d="M0 96 Q22 104 30 130 Q12 122 0 128 Z" fill="#1D8A3E" />

      {/* woodland floor details */}
      <Flower x={28} y={332} s={1.15} petal="#FFFFFF" />
      <Flower x={46} y={352} s={0.8} petal="#FFFFFF" />
      <Flower x={16} y={344} s={0.7} petal="#FF9BD0" core="#FFE9A8" />
      <Flower x={338} y={404} s={1.25} petal="#FF9A2E" core="#FFE066" petals={5} />
      <Flower x={350} y={420} s={0.8} petal="#FFFFFF" />
      <Path d="M330 412 Q322 402 314 404 Q320 414 330 412 Z" fill="#3FB050" />
      <Path d="M346 416 Q356 404 366 408 Q358 420 346 416 Z" fill="#2E9A45" />

      {/* leaves creeping in at the bottom corners */}
      <Foliage blobs={leftFoot} dark="#0B4A26" mid="#1F8C40" light="#8EE06A" seed={31} />
      <Foliage blobs={rightFoot} dark="#0B4A26" mid="#1F8C40" light="#8EE06A" seed={37} />

      {/* soft vignette */}
      <Rect x={0} y={0} width={370} height={594} fill={`url(#${id('vs')})`} />
      <Rect x={0} y={0} width={370} height={150} fill={`url(#${id('vt')})`} />
      <Rect x={0} y={480} width={370} height={114} fill={`url(#${id('vb')})`} />
    </Svg>
  );
});

/** Shafts of sunlight that slowly breathe. */
function SunBeams({ s }: { s: number }) {
  const uid = useUid('sb');
  const v = useLoop(6000);
  const aStyle = useAnimatedStyle(() => ({ opacity: 0.55 + v.value * 0.45 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, aStyle]}>
      <Svg width={FOREST_W * s} height={FOREST_H * s} viewBox={`0 0 ${FOREST_W} ${FOREST_H}`}>
        <Defs>
          <SvgLinear id={uid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="440">
            <Stop offset="0" stopColor="#FFFBD0" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#FFFBD0" stopOpacity="0" />
          </SvgLinear>
        </Defs>
        <Path d="M96 -20 L150 -20 L250 470 L150 470 Z" fill={`url(#${uid})`} />
        <Path d="M170 -20 L204 -20 L330 440 L262 440 Z" fill={`url(#${uid})`} opacity={0.7} />
        <Path d="M30 -20 L62 -20 L92 400 L46 400 Z" fill={`url(#${uid})`} opacity={0.55} />
      </Svg>
    </Animated.View>
  );
}

/** A leaf that tumbles down through the light, over and over. */
function FallingLeaf({ x, size, delay, period, color, s }: {
  x: number; size: number; delay: number; period: number; color: string; s: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [p, delay, period]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(p.value * 6, 1) * Math.min((1 - p.value) * 6, 1) * 0.9,
    transform: [
      { translateY: p.value * 520 * s },
      { translateX: Math.sin(p.value * Math.PI * 4) * 22 * s },
      { rotate: `${p.value * 600}deg` },
    ],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: x * s, top: -20 * s, width: size * 2 * s, height: size * s }, aStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 20 10">
        <Path d="M0 5 Q10 -4 20 5 Q10 14 0 5Z" fill={color} />
        <Path d="M1 5 L19 5" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.9} />
      </Svg>
    </Animated.View>
  );
}

/** A vine of leaves hanging from the canopy that sways in the breeze. */
function SwayVine({ x, y, len, delay, s, flip }: {
  x: number; y: number; len: number; delay: number; s: number; flip?: boolean;
}) {
  const v = useLoop(3200, delay);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(v.value - 0.5) * 9}deg` }] }));
  const w = 26;
  const leaves = Math.round(len / 16);
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: (x - w / 2) * s, top: y * s, width: w * s, height: len * s, transformOrigin: 'top center' }, aStyle]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${len}`} style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
        <Path d={`M13 0 Q17 ${len * 0.35} 12 ${len * 0.65} Q9 ${len * 0.85} 13 ${len}`} fill="none" stroke="#1F7A34" strokeWidth={1.8} strokeLinecap="round" />
        {Array.from({ length: leaves }, (_, i) => {
          const yy = 8 + i * ((len - 14) / Math.max(1, leaves - 1));
          const left = i % 2 === 0;
          return (
            <Path key={i} d="M0 0 Q7 -6 14 0 Q7 6 0 0Z" fill={i % 3 === 0 ? '#6DD35A' : '#2FA24A'}
              transform={`translate(${left ? 12 : 13},${q2(yy)}) rotate(${left ? 200 : -20})`} />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/** Streaks of foam running down the waterfall. */
function FallStreak({ x, delay, s }: { x: number; delay: number; s: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [p, delay]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(p.value * 5, 1) * Math.min((1 - p.value) * 5, 1) * 0.85,
    transform: [{ translateY: p.value * 92 * s }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x * s, top: 0, width: 2.2 * s, height: 20 * s, borderRadius: 2 * s, backgroundColor: '#FFFFFF' }, aStyle]} />
  );
}

/** All the living parts of the forest, drawn in the same covered stage as the art. */
const ForestLife = React.memo(function ForestLife() {
  const { s, ox, oy } = useCover();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy, width: FOREST_W * s, height: FOREST_H * s }}>
      <SunBeams s={s} />
      <View style={{ position: 'absolute', left: 297 * s, top: 198 * s, width: 32 * s, height: 96 * s, overflow: 'hidden' }}>
        <FallStreak x={5} delay={0} s={s} />
        <FallStreak x={14} delay={400} s={s} />
        <FallStreak x={23} delay={750} s={s} />
      </View>
      <SwayVine x={104} y={40} len={80} delay={0} s={s} />
      <SwayVine x={132} y={16} len={58} delay={900} s={s} flip />
      <SwayVine x={272} y={20} len={70} delay={500} s={s} />
      <SwayVine x={318} y={46} len={84} delay={1300} s={s} flip />
      <FallingLeaf x={90} size={9} delay={0} period={9000} color="#7BD858" s={s} />
      <FallingLeaf x={250} size={8} delay={2600} period={10500} color="#B6E85C" s={s} />
      <FallingLeaf x={160} size={7} delay={5200} period={11500} color="#4FBF5A" s={s} />
      <FallingLeaf x={300} size={9} delay={7400} period={9500} color="#F2C94C" s={s} />
      <FallingLeaf x={40} size={8} delay={3800} period={12000} color="#9BE070" s={s} />
      {[[70, 330, 0], [120, 380, 400], [255, 350, 800], [300, 430, 1200], [90, 440, 1600], [210, 300, 200], [340, 470, 1000], [30, 500, 600]].map(([x, y, d], i) => (
        <Sparkle key={i} x={x} y={y} size={3.4 + (i % 3)} delay={d} color={i % 2 ? '#FFF6B0' : '#E8FFB8'} u={s} />
      ))}
    </View>
  );
});

/* --- toy blocks ------------------------------------------------------------- */

type CubeTone = {
  lo: string; mid: string; dark: string; top: string; side: string;
  glyphLo?: string; glyphDark?: string;
};

const CUBE_TONES: Record<'yellow' | 'red' | 'blue' | 'brown' | 'green' | 'purple' | 'orange', CubeTone> = {
  yellow: { lo: '#FFE45C', mid: '#FFC01E', dark: '#D98A00', top: '#FFF08A', side: '#E59A00' },
  red: { lo: '#FF8378', mid: '#E63E36', dark: '#A8201C', top: '#FF9F92', side: '#B82A24' },
  blue: { lo: '#86BCFF', mid: '#3B84EE', dark: '#1E4FB0', top: '#A9D2FF', side: '#2A62C4' },
  brown: { lo: '#9A6234', mid: '#74431B', dark: '#46280C', top: '#A87344', side: '#54320F', glyphLo: '#58B040', glyphDark: '#2A6A22' },
  green: { lo: '#86E58F', mid: '#3DB84A', dark: '#1F7A2A', top: '#A9F2A3', side: '#2A8C36' },
  purple: { lo: '#C692FF', mid: '#8B4AE0', dark: '#5A24A0', top: '#D9AEFF', side: '#6C32B8' },
  orange: { lo: '#FFB775', mid: '#FF8A2B', dark: '#B4520A', top: '#FFC894', side: '#D96A12' },
};

/** A soft, glossy toy cube seen a little from above: top, front and right faces. */
function ToyCube({ size, tone, glyph, smile }: {
  size: number; tone: keyof typeof CUBE_TONES; glyph?: Glyph; smile?: boolean;
}) {
  const uid = useUid('tc');
  const c = CUBE_TONES[tone];
  const edge = { strokeWidth: 8, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size * 1.04} viewBox="0 0 100 104">
      <Defs>
        <SvgLinear id={`${uid}f`} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={c.lo} />
          <Stop offset="0.55" stopColor={c.mid} />
          <Stop offset="1" stopColor={c.mid} />
        </SvgLinear>
        <SvgLinear id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.side} />
          <Stop offset="1" stopColor={c.dark} />
        </SvgLinear>
      </Defs>
      <Ellipse cx={50} cy={99} rx={42} ry={5.5} fill="#000000" opacity={0.26} />
      {/* right face */}
      <Path d="M82 34 L92 18 L92 76 L82 92 Z" fill={`url(#${uid}s)`} stroke={c.side} {...edge} />
      {/* top face */}
      <Path d="M10 30 L22 14 L88 14 L76 30 Z" fill={c.top} stroke={c.top} {...edge} />
      <Path d="M20 20 L44 18" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />
      {/* front face */}
      <Path d={roundRect(6, 26, 72, 72, 17)} fill={c.dark} />
      <Path d={roundRect(6, 26, 72, 69, 17)} fill={`url(#${uid}f)`} />
      <Path d={roundRect(6, 26, 72, 69, 17)} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.8} />
      {glyph ? (
        <G transform="translate(-8,14)">
          <GlyphShape glyph={glyph} fill={c.glyphDark ?? c.dark} dy={2.8} opacity={0.55} />
          <GlyphShape glyph={glyph} fill={c.glyphLo ?? c.lo} />
        </G>
      ) : null}
      {smile ? (
        <G>
          <Path d="M21 58 Q28 49 35 58" fill="none" stroke="#5A2E00" strokeWidth={3.8} strokeLinecap="round" />
          <Path d="M49 58 Q56 49 63 58" fill="none" stroke="#5A2E00" strokeWidth={3.8} strokeLinecap="round" />
          <Circle cx={18} cy={68} r={5.2} fill="#FF7A4A" opacity={0.5} />
          <Circle cx={66} cy={68} r={5.2} fill="#FF7A4A" opacity={0.5} />
          <Path d="M30 65 Q42 85 54 65 Z" fill="#7A2E00" stroke="#5A2E00" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M35.5 75 Q42 69.5 48.5 75 Q42 81 35.5 75 Z" fill="#FF7B7B" />
        </G>
      ) : null}
      <Path d={roundRect(12, 31, 38, 10, 5)} fill="#FFFFFF" fillOpacity={0.42} />
      <Circle cx={68} cy={36} r={2.8} fill="#FFFFFF" fillOpacity={0.75} />
    </Svg>
  );
}

/** A cube in the pyramid: drops in on load, breathes, and hops when tapped. */
function CubeBtn({ left, top, size, tone, glyph, smile, u, order, breathe }: {
  left: number; top: number; size: number; tone: keyof typeof CUBE_TONES; glyph?: Glyph;
  smile?: boolean; u: number; order: number; breathe: number;
}) {
  const enter = useSharedValue(0);
  const pop = useSharedValue(0);
  const hop = useSharedValue(0);
  const v = useLoop(2200 + breathe * 260, order * 200);
  useEffect(() => {
    enter.value = withDelay(180 + order * 110, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [enter, order]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 3),
    transform: [
      { translateY: (1 - enter.value) * -70 * u + (v.value - 0.5) * 2 * 1.6 * u + hop.value * -16 * u },
      { scaleX: 1 + pop.value * 0.1 },
      { scaleY: 1 - pop.value * 0.13 },
    ],
  }));
  return (
    <Pressable
      style={{ position: 'absolute', left: left * u, top: top * u, width: size * u, height: size * 1.04 * u }}
      onPressIn={() => {
        pop.value = withTiming(1, { duration: 70 });
        haptic.light();
        playSfx('place');
      }}
      onPressOut={() => {
        pop.value = withSpring(0, { damping: 6, stiffness: 320 });
        hop.value = withSequence(withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 7, stiffness: 240 }));
      }}
    >
      <Animated.View style={aStyle}>
        <ToyCube size={size * u} tone={tone} glyph={glyph} smile={smile} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The pyramid of five blocks: two rows of two with the smiley on top. The
 * spacing is the cube's own geometry, so nothing floats and nothing gaps: a
 * cube's front face is 72% of its width and its side face 14%, so a neighbour
 * sits 0.86 of a width along, and a cube resting on another sits 0.70 of a
 * height above it, exactly on the lower cube's top edge.
 */
function BlockPyramid({ u }: { u: number }) {
  const S = 70;
  const stepX = S * 0.86;
  const stepY = S * 0.7;
  const w = stepX + S;
  const h = stepY * 2 + S * 1.04;
  return (
    <View style={{ width: w * u, height: h * u }}>
      <View pointerEvents="none" style={{
        position: 'absolute', left: 6 * u, right: 2 * u, bottom: -3 * u, height: 16 * u,
        borderRadius: 40 * u, backgroundColor: '#0B3B1E', opacity: 0.3,
      }} />
      <CubeBtn left={0} top={stepY * 2} size={S} tone="green" glyph="clover" u={u} order={0} breathe={0} />
      <CubeBtn left={stepX} top={stepY * 2} size={S} tone="purple" glyph="star" u={u} order={1} breathe={1} />
      <CubeBtn left={0} top={stepY} size={S} tone="red" glyph="heart" u={u} order={2} breathe={2} />
      <CubeBtn left={stepX} top={stepY} size={S} tone="blue" glyph="star" u={u} order={3} breathe={3} />
      <CubeBtn left={stepX / 2} top={0} size={S} tone="yellow" smile u={u} order={4} breathe={4} />
      <Sparkle x={w * 0.1} y={h * 0.1} size={5} delay={100} color="#FFF6B0" u={u} />
      <Sparkle x={w * 0.94} y={h * 0.06} size={4.5} delay={650} color="#FFFFFF" u={u} />
      <Sparkle x={w * 0.02} y={h * 0.55} size={3.6} delay={1000} color="#FFF6B0" u={u} />
    </View>
  );
}

/* --- logo ------------------------------------------------------------------- */

/**
 * Chunky outlined display text, built from stacked copies:
 *   1. a run of copies pushed straight down  -> the extruded 3D lip
 *   2. eight copies round the glyph          -> the thick outline
 *   3. the fill colour on top
 *   4. a lighter copy clipped to the top half -> the glossy highlight
 * Every copy shares one font, size and width, so they line up exactly.
 */
function ChunkyText({ text, size, width, fill, hi, outline, ring, extrude }: {
  text: string; size: number; width: number;
  fill: string; hi: string; outline: string; ring: number; extrude: number;
}) {
  const lh = Math.round(size * 1.16);
  const pad = Math.ceil(ring);
  const base: TextStyle = {
    position: 'absolute', width, height: lh, textAlign: 'center',
    fontFamily: DISPLAY_FONT, fontWeight: DISPLAY_FONT ? 'normal' : '900',
    fontSize: size, lineHeight: lh, includeFontPadding: false,
  };
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.72, 0.72], [-0.72, 0.72], [0.72, -0.72], [-0.72, -0.72]];
  const lip = Array.from({ length: Math.ceil(extrude) }, (_, i) => i + 1);

  return (
    <View style={{ width: width + pad * 2, height: lh + pad * 2 + extrude }} pointerEvents="none">
      {lip.map((d) => (
        <Text key={`e${d}`} numberOfLines={1} style={[base, { color: outline, left: pad, top: pad + d }]}>{text}</Text>
      ))}
      {dirs.map(([dx, dy], i) => (
        <Text key={`o${i}`} numberOfLines={1} style={[base, { color: outline, left: pad + dx * ring, top: pad + dy * ring }]}>{text}</Text>
      ))}
      <Text numberOfLines={1} style={[base, { color: fill, left: pad, top: pad }]}>{text}</Text>
      <View style={{ position: 'absolute', left: pad, top: pad, width, height: lh * 0.5, overflow: 'hidden' }}>
        <Text numberOfLines={1} style={[base, { color: hi, left: 0, top: 0 }]}>{text}</Text>
      </View>
    </View>
  );
}

/** A curl of leaves that frames the logo. */
function LogoVine({ mirror, size = 1 }: { mirror?: boolean; size?: number }) {
  const leaf = (x: number, y: number, r: number, c: string, k: string) => (
    <Path key={k} d="M0 0 Q9 -10 20 0 Q9 8 0 0Z" fill={c} stroke="#0F5A2C" strokeWidth={1.2} transform={`translate(${x},${y}) rotate(${r})`} />
  );
  return (
    <Svg width={34 * size} height={54 * size} viewBox="0 0 34 54" style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M6 2 Q20 16 12 32 Q6 42 14 52" fill="none" stroke="#1F8A4A" strokeWidth={2.4} strokeLinecap="round" />
      {leaf(8, 8, 20, '#37B866', 'a')}
      {leaf(15, 20, -30, '#2A9C58', 'b')}
      {leaf(9, 30, 25, '#5CD07A', 'c')}
      {leaf(13, 42, -25, '#2A9C58', 'd')}
    </Svg>
  );
}

/** The BLOCK ADVENTURE logo: gold BLOCK, blue ADVENTURE on a dark plate, leaves. */
function GameLogo({ u }: { u: number }) {
  const uid = useUid('lg');
  const enter = useSharedValue(0);
  const glint = useLoop(2600);
  useEffect(() => { enter.value = withDelay(60, withSpring(1, { damping: 10, stiffness: 150 })); }, [enter]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 2.5),
    transform: [{ scale: 0.7 + enter.value * 0.3 }, { translateY: (glint.value - 0.5) * 2 * 1.5 * u }],
  }));
  const W = 300;
  const H = 148;
  return (
    <Animated.View pointerEvents="none" style={[{ width: W * u, height: H * u }, aStyle]}>
      {/* the dark plate behind ADVENTURE */}
      <Svg width={W * u} height={H * u} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}p`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2D58BC" />
            <Stop offset="1" stopColor="#12297A" />
          </SvgLinear>
        </Defs>
        <Path d={roundRect(14, 86, 272, 54, 18)} fill="#4A2508" transform="translate(0,4)" />
        <Path d={roundRect(14, 86, 272, 54, 18)} fill="#7A4318" />
        <Path d={roundRect(18, 90, 264, 46, 15)} fill={`url(#${uid}p)`} />
        <Path d={roundRect(22, 93, 256, 11, 5.5)} fill="#FFFFFF" fillOpacity={0.16} />
      </Svg>
      <View style={{ position: 'absolute', left: -2 * u, top: 28 * u }}><LogoVine size={u} /></View>
      <View style={{ position: 'absolute', right: -2 * u, top: 24 * u }}><LogoVine mirror size={u} /></View>
      <View style={{ position: 'absolute', left: 0, top: 104 * u, transform: [{ rotate: '160deg' }] }}><LogoVine size={u * 0.62} /></View>
      <View style={{ position: 'absolute', right: 0, top: 104 * u, transform: [{ rotate: '-160deg' }] }}><LogoVine mirror size={u * 0.62} /></View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 2 * u, alignItems: 'center' }}>
        <ChunkyText text="BLOCK" size={92 * u} width={270 * u} fill="#F7A20C" hi="#FFE45C"
          outline="#5E2400" ring={4 * u} extrude={6 * u} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 86 * u, alignItems: 'center' }}>
        <ChunkyText text="ADVENTURE" size={46 * u} width={262 * u} fill="#3CC4EE" hi="#B4F2FF"
          outline="#08245E" ring={2.6 * u} extrude={3 * u} />
      </View>
    </Animated.View>
  );
}

/* --- top bar ---------------------------------------------------------------- */

/** A shiny gold coin. */
function GoldCoin({ size }: { size: number }) {
  const uid = useUid('gcn');
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <SvgLinear id={uid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF29A" />
          <Stop offset="0.55" stopColor="#FFC22E" />
          <Stop offset="1" stopColor="#E08A00" />
        </SvgLinear>
      </Defs>
      <Circle cx={20} cy={22} r={18} fill="#8A4A00" />
      <Circle cx={20} cy={20} r={18} fill={`url(#${uid})`} stroke="#B86A00" strokeWidth={2} />
      <Circle cx={20} cy={20} r={12.4} fill="none" stroke="#C77C00" strokeWidth={2} />
      <Path d={starPath(20, 20.4, 7.4, 3.2)} fill="#FFF6C0" stroke="#C77C00" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M8 12 Q12 6 20 5" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** The dark coin counter with a gold coin and a green plus. */
function CoinBar({ coins, onPlus, u }: { coins: number; onPlus: () => void; u: number }) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.1 }] }));
  const H = 36 * u;
  const coin = H + 8 * u;
  return (
    <View style={{ height: coin, minWidth: 124 * u, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: coin / 2, right: 0, top: (coin - H) / 2 + 3 * u, height: H, borderRadius: H / 2, backgroundColor: 'rgba(10,6,0,0.5)' }} />
      <View style={{ marginLeft: coin / 2, height: H, borderRadius: H / 2, overflow: 'hidden', borderWidth: 2.5 * u, borderColor: '#D9922B' }}>
        <LinearGradient colors={gc('#5E361A', '#35190A')} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.4, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: coin / 2 + 6 * u, paddingRight: 4 * u, gap: 10 * u }}>
          <Text numberOfLines={1} style={{
            color: '#FFFFFF', fontSize: 21 * u, includeFontPadding: false,
            textShadowColor: 'rgba(20,6,0,0.95)', textShadowOffset: { width: 0, height: 1.6 }, textShadowRadius: 1,
          }}>{fmt(coins)}</Text>
          <AnimPressable
            accessibilityRole="button" accessibilityLabel="plus" hitSlop={8}
            onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
            onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
            onPress={onPlus}
            style={[{ width: 25 * u, height: 25 * u }, aStyle]}
          >
            <View style={{ position: 'absolute', left: 0, right: 0, top: 2 * u, height: 25 * u, borderRadius: 12.5 * u, backgroundColor: '#1D7A22' }} />
            <View style={{ height: 23 * u, borderRadius: 11.5 * u, overflow: 'hidden', borderWidth: 1.5, borderColor: '#C5F5A0' }}>
              <LinearGradient colors={gc('#8CF06A', '#35B932')} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={14 * u} color="#FFFFFF" />
              </View>
            </View>
          </AnimPressable>
        </View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <GoldCoin size={coin} />
      </View>
    </View>
  );
}

/** The round settings button. */
function SettingsBtn({ onPress, u }: { onPress: () => void; u: number }) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.08 }] }));
  const S = 44 * u;
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel="settings" hitSlop={8}
      style={[{ width: S, height: S }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 3 * u, height: S, borderRadius: S / 2, backgroundColor: 'rgba(8,14,40,0.6)' }} />
      <View style={{ width: S, height: S, borderRadius: S / 2, overflow: 'hidden', borderWidth: 3 * u, borderColor: '#5C6A96' }}>
        <LinearGradient colors={gc('#3A4A7E', '#1B2549')} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: S * 0.42, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gear" size={S * 0.52} color="#DCE4F8" />
        </View>
      </View>
    </AnimPressable>
  );
}

/* --- PLAY ------------------------------------------------------------------- */

/** The big green PLAY button: a gold rim, a glossy green face, a breathing glow and a sweeping shine. */
function PlayCta({ label, onPress, u }: { label: string; onPress: () => void; u: number }) {
  const press = useSharedValue(0);
  const pulse = useLoop(1500);
  const shine = useSharedValue(0);
  const W = 236 * u;
  const H = 72 * u;
  const lip = 8 * u;

  useEffect(() => {
    shine.value = withRepeat(
      withSequence(withDelay(1100, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })), withTiming(0, { duration: 0 })),
      -1,
      false,
    );
    return () => cancelAnimation(shine);
  }, [shine]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 5 * u }, { scale: 1 + pulse.value * 0.025 }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.5 + pulse.value * 0.5 }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 * u + shine.value * (W + 60 * u) }, { rotate: '18deg' }],
    opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
  }));

  return (
    <Animated.View style={aStyle}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -16 * u, right: -16 * u, top: -12 * u, bottom: -18 * u }, glow]}>
        {[0.3, 0.6, 1].map((k, i) => (
          <View key={i} style={{
            position: 'absolute', left: (1 - k) * 12 * u, right: (1 - k) * 12 * u, top: (1 - k) * 10 * u, bottom: (1 - k) * 12 * u,
            borderRadius: 40 * u, backgroundColor: '#B8FF6A', opacity: 0.1 + i * 0.05,
          }} />
        ))}
      </Animated.View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={label}
        onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
        onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
        onPress={onPress}
        style={{ width: W, height: H + lip }}
      >
        {/* the lip the button sits on */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: lip, height: H, borderRadius: H / 2, backgroundColor: '#5A2E08' }} />
        {/* gold-brown rim */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H, borderRadius: H / 2, overflow: 'hidden' }}>
          <LinearGradient colors={gc('#F5A93A', '#C7690F', '#8A4308')} style={StyleSheet.absoluteFill} />
        </View>
        {/* green face */}
        <View style={{
          position: 'absolute', left: 5 * u, right: 5 * u, top: 5 * u, height: H - 10 * u,
          borderRadius: (H - 10 * u) / 2, overflow: 'hidden', borderWidth: 2 * u, borderColor: '#1F7A1E',
        }}>
          <LinearGradient colors={gc('#9BF05C', '#4CCB33', '#2A9A26')} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={gc('rgba(255,255,255,0.6)', 'rgba(255,255,255,0)')}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (H - 10 * u) * 0.5 }} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -20 * u, width: 26 * u, height: H + 40 * u }, shineStyle]}>
            <LinearGradient colors={gc('rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)')}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * u, paddingBottom: 2 * u }}>
            <Svg width={30 * u} height={32 * u} viewBox="0 0 30 32">
              <Path d="M8 6 L25 16 L8 26 Z" fill="#1F6B1E" transform="translate(0,2.4)" stroke="#1F6B1E" strokeWidth={5} strokeLinejoin="round" />
              <Path d="M8 6 L25 16 L8 26 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={5} strokeLinejoin="round" />
              <Path d="M11 10 L18 14" stroke="#DFF6D0" strokeWidth={2.4} strokeLinecap="round" />
            </Svg>
            <ChunkyText text={label} size={42 * u} width={112 * u} fill="#FFFFFF" hi="#FFFFFF"
              outline="#1B6A1A" ring={2.6 * u} extrude={3 * u} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* --- the world arch ---------------------------------------------------------- */

const SIGN_W = 168;
const SIGN_H = 190;

/**
 * The gateway to your current world: a wooden sign on two posts giving the world
 * number and area, over a mossy boulder engraved with your level, on stone
 * steps among flowers. Tap it to open the map.
 */
function WorldSign({ world, area, level, levelNo, onPress, u }: {
  world: string; area: string; level: string; levelNo: number; onPress: () => void; u: number;
}) {
  const uid = useUid('wsn');
  const press = useSharedValue(0);
  const glow = useLoop(2400);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 * u }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + glow.value * 0.4 }));

  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={`${world} ${area} ${level} ${levelNo}`}
      style={[{ width: SIGN_W * u, height: SIGN_H * u }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <Svg width={(SIGN_W + 32) * u} height={(SIGN_H + 12) * u} viewBox={`-16 0 ${SIGN_W + 32} ${SIGN_H + 12}`}
        style={{ position: 'absolute', left: -16 * u, top: 0 }}>
        <Defs>
          <SvgLinear id={`${uid}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8A5628" />
            <Stop offset="1" stopColor="#5A3212" />
          </SvgLinear>
          <SvgLinear id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D5D7DE" />
            <Stop offset="0.55" stopColor="#A2A5B2" />
            <Stop offset="1" stopColor="#6E7184" />
          </SvgLinear>
          <SvgLinear id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4DB85A" />
            <Stop offset="1" stopColor="#1F7A34" />
          </SvgLinear>
        </Defs>

        {/* ground shadow */}
        <Ellipse cx={84} cy={186} rx={84} ry={8} fill="#0B3B1E" opacity={0.32} />

        {/* the posts the sign hangs on */}
        <Path d={roundRect(24, 46, 11, 96, 3)} fill="#6E4322" stroke="#3E2410" strokeWidth={1.8} />
        <Path d={roundRect(133, 46, 11, 96, 3)} fill="#6E4322" stroke="#3E2410" strokeWidth={1.8} />

        {/* the boulder */}
        <Path d="M30 152 Q20 96 84 82 Q148 96 138 152 Q124 172 84 174 Q44 172 30 152 Z" fill="#5C5F72" transform="translate(0,4)" />
        <Path d="M30 152 Q20 96 84 82 Q148 96 138 152 Q124 172 84 174 Q44 172 30 152 Z" fill={`url(#${uid}r)`} stroke="#4E5163" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M40 118 Q46 94 84 88 Q64 100 60 128 Z" fill="#FFFFFF" opacity={0.28} />
        <Path d="M112 96 Q134 110 132 148 Q120 158 106 156 Q120 128 112 96 Z" fill="#3E4154" opacity={0.28} />
        <Path d="M50 160 Q84 168 120 160" fill="none" stroke="#3E4154" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
        <Path d="M96 88 L92 100 L98 108 M40 138 L48 146 L44 156" fill="none" stroke="#4E5163" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <Ellipse cx={66} cy={87} rx={18} ry={5} fill="#5FBF4A" />
        <Ellipse cx={112} cy={96} rx={10} ry={4} fill="#5FBF4A" opacity={0.9} />
        <Ellipse cx={36} cy={140} rx={6} ry={9} fill="#5FBF4A" opacity={0.9} />

        {/* the sign */}
        <Path d="M16 72 V36 Q16 8 84 8 Q152 8 152 36 V72 Z" fill="#2E1808" transform="translate(0,3)" />
        <Path d="M16 72 V36 Q16 8 84 8 Q152 8 152 36 V72 Z" fill={`url(#${uid}w)`} stroke="#3A1E08" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M22 34 Q24 16 84 14 Q130 14 144 28" fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={5} strokeLinecap="round" />
        <Path d="M50 14 V72 M84 12 V72 M118 14 V72" stroke="#2E1808" strokeOpacity={0.35} strokeWidth={1.6} />
        {[[24, 30], [144, 30], [24, 64], [144, 64]].map(([nx, ny], i) => <Circle key={i} cx={nx} cy={ny} r={2.4} fill="#E7B33A" stroke="#7A4A00" strokeWidth={0.8} />)}
        <Path d={roundRect(38, 56, 92, 20, 10)} fill="#0F4A1E" transform="translate(0,2)" />
        <Path d={roundRect(38, 56, 92, 20, 10)} fill={`url(#${uid}g)`} stroke="#E7B33A" strokeWidth={1.8} />

        {/* ivy over the sign and boulder */}
        {[[18, 60, -160, '#2E9A45'], [14, 50, 150, '#4FBF5A'], [22, 74, 130, '#1F7A34'], [150, 60, -20, '#2E9A45'], [154, 50, 30, '#4FBF5A'], [146, 74, 50, '#1F7A34'],
          [34, 100, 150, '#4FBF5A'], [136, 108, 20, '#2E9A45'], [30, 122, 170, '#1F7A34'], [140, 128, 10, '#4FBF5A']].map(([lx, ly, la, lc], i) => (
          <Path key={i} d="M0 0 Q5 -7.5 12 0 Q5 6.5 0 0Z" fill={lc as string} stroke="#0F5A28" strokeWidth={0.7}
            transform={`translate(${lx},${ly}) rotate(${la})`} />
        ))}
        <Flower x={22} y={38} s={0.6} petal="#FFD84D" core="#FF9A2E" />
        <Flower x={146} y={40} s={0.6} petal="#FFFFFF" />

        {/* the steps */}
        <Path d={roundRect(34, 166, 100, 12, 5)} fill="#C9B48C" stroke="#7A6648" strokeWidth={1.2} />
        <Path d={roundRect(36, 167, 96, 3.4, 2)} fill="#FFFFFF" fillOpacity={0.35} />
        <Path d={roundRect(18, 177, 132, 13, 5)} fill="#DCCBA4" stroke="#7A6648" strokeWidth={1.2} />
        <Path d={roundRect(20, 178, 128, 3.6, 2)} fill="#FFFFFF" fillOpacity={0.35} />

        {/* bushes and flowers at the feet */}
        <Circle cx={8} cy={178} r={13} fill="#1F7A34" />
        <Circle cx={22} cy={183} r={10} fill="#2E9A45" />
        <Circle cx={160} cy={178} r={13} fill="#1F7A34" />
        <Circle cx={146} cy={183} r={10} fill="#2E9A45" />
        <Flower x={14} y={166} s={0.95} petal="#FF9BD0" core="#FFE9A8" />
        <Flower x={28} y={180} s={0.7} petal="#FFFFFF" />
        <Flower x={2} y={158} s={0.7} petal="#FFD84D" core="#FF9A2E" />
        <Flower x={154} y={166} s={0.95} petal="#FFFFFF" />
        <Flower x={140} y={181} s={0.7} petal="#FF9BD0" core="#FFE9A8" />
        <Flower x={164} y={158} s={0.7} petal="#FF9A2E" core="#FFE066" petals={5} />
        <Mushroom x={126} y={188} s={0.55} />
      </Svg>

      {/* a warm light breathing behind the carved number */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: 52 * u, top: 108 * u, width: 64 * u, height: 50 * u, borderRadius: 32 * u, backgroundColor: '#FFE9A0',
      }, glowStyle]} />

      <View pointerEvents="none" style={{ position: 'absolute', left: 16 * u, width: 136 * u, top: 12 * u, height: 40 * u, alignItems: 'center', justifyContent: 'center' }}>
        <ChunkyText text={world} size={22 * u} width={130 * u} fill="#FFFFFF" hi="#FFFFFF" outline="#2A1404" ring={1.5 * u} extrude={1 * u} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 38 * u, width: 92 * u, top: 56 * u, height: 20 * u, alignItems: 'center', justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ color: '#FFF1C8', fontSize: 9 * u, letterSpacing: 0.5, includeFontPadding: false }}>{area}</Text>
      </View>
      {/* the level, lettered like the game page: white on the stone with a dark outline */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 30 * u, width: 108 * u, top: 94 * u, alignItems: 'center' }}>
        <ChunkyText text={level} size={13 * u} width={104 * u} fill="#FFE58A" hi="#FFF6C8" outline="#3A1E08" ring={1.2 * u} extrude={0.8 * u} />
        <View style={{ marginTop: -2 * u }}>
          <ChunkyText text={String(levelNo)} size={44 * u} width={104 * u} fill="#FFFFFF" hi="#FFFFFF" outline="#3A1E08" ring={2 * u} extrude={1.6 * u} />
        </View>
      </View>

      <Sparkle x={40} y={70} size={4} delay={200} color="#FFFFFF" u={u} />
      <Sparkle x={130} y={96} size={3.4} delay={800} color="#FFF6B0" u={u} />
    </AnimPressable>
  );
}

/* --- cards ------------------------------------------------------------------ */

/** A small gold key, for the treasure-chest progress. */
function KeyGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={7.5} cy={9} r={5.2} fill="#FFD24D" stroke="#B87800" strokeWidth={1.6} />
      <Circle cx={6.4} cy={8} r={1.9} fill="#B87800" />
      <Path d="M11.2 12.6 L20 21 M16.4 17 L19 14.4 M18.6 19 L21 16.6" fill="none" stroke="#B87800" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11.2 12.6 L20 21 M16.4 17 L19 14.4 M18.6 19 L21 16.6" fill="none" stroke="#FFD24D" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The gift or chest, wiggling while there is something to collect. */
function WiggleArt({ active, children }: { active: boolean; children: React.ReactNode }) {
  const v = useLoop(700);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${active ? (v.value - 0.5) * 14 : 0}deg` }, { translateY: active ? -v.value * 2 : 0 }],
  }));
  return <Animated.View style={aStyle}>{children}</Animated.View>;
}

/** One of the two cards under PLAY: a chunky bevelled panel with art, a title and a status area. */
function HomeCard({ tone, art, title, below, badge, onPress, u }: {
  tone: 'green' | 'purple'; art: React.ReactNode; title: string; below?: React.ReactNode;
  badge?: string; onPress: () => void; u: number;
}) {
  const press = useSharedValue(0);
  const pulse = useLoop(1100);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 4 * u }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.14 }] }));
  const P = tone === 'green'
    ? { rim: ['#5BE56C', '#25B342'], body: ['#12305C', '#0A1D3E'], lip: '#04101F', edge: '#0A1D3E' }
    : { rim: ['#C79BFF', '#8A4FE8'], body: ['#12305C', '#0A1D3E'], lip: '#04101F', edge: '#0A1D3E' };
  const H = 68 * u;
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={title}
      style={[{ flex: 1, height: H + 5 * u }, aStyle]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, top: 5 * u, height: H, borderRadius: 16 * u, backgroundColor: P.lip }} />
      <View style={{ height: H, borderRadius: 16 * u, overflow: 'hidden' }}>
        <LinearGradient colors={gc(P.rim[0], P.rim[1])} style={StyleSheet.absoluteFill} />
        <View style={{
          position: 'absolute', left: 2.5 * u, right: 2.5 * u, top: 2.5 * u, bottom: 2.5 * u,
          borderRadius: 13.5 * u, overflow: 'hidden', borderWidth: 1.6 * u, borderColor: P.edge,
        }}>
          <LinearGradient colors={gc(P.body[0], P.body[1])} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '42%', backgroundColor: 'rgba(255,255,255,0.09)' }} />
        </View>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 * u, gap: 6 * u,
        }}>
          <View style={{ width: 44 * u, alignItems: 'center', justifyContent: 'center' }}>{art}</View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={3} style={{
              color: '#FFFFFF', fontSize: 15 * u, lineHeight: 17 * u, letterSpacing: 0.2, includeFontPadding: false, textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1.2 }, textShadowRadius: 0,
            }}>{title.replace(' ', '\n')}</Text>
            {below ? <View style={{ marginTop: 5 * u }}>{below}</View> : null}
          </View>
        </View>
      </View>
      {badge ? (
        <Animated.View style={[{
          position: 'absolute', top: -5 * u, right: -4 * u, minWidth: 22 * u, height: 22 * u, borderRadius: 11 * u,
          paddingHorizontal: 5 * u, backgroundColor: '#F0323F', borderWidth: 2 * u, borderColor: '#FFFFFF',
          alignItems: 'center', justifyContent: 'center',
        }, badgeStyle]}>
          <Text style={{ color: '#FFFFFF', fontSize: 12 * u, includeFontPadding: false }}>{badge}</Text>
        </Animated.View>
      ) : null}
    </AnimPressable>
  );
}

/* --- the Home screen -------------------------------------------------------- */

/** Clearance for the bottom navigation bar, which floats over the Home screen. */
const NAV_CLEARANCE = 96;

function HomeScreen({ save, onPlay, onTab, onChest, onSettings, onClaimDaily }: {
  save: Save; onPlay: (i: number) => void; onTab: (t: TabId) => void;
  onChest: () => void; onSettings: () => void; onClaimDaily: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const t = useT();
  const nextIndex = useMemo(() => {
    for (let i = 0; i < LEVELS.length; i++) if (!(save.stars[LEVELS[i].key] > 0)) return i;
    return LEVELS.length - 1;
  }, [save.stars]);
  const lv = LEVELS[nextIndex];
  const daily = dailyReady(save);
  const keys = Math.min(save.chest, CHEST_GOAL);
  const chestReady = keys >= CHEST_GOAL;

  // One scale for the whole layout: limited by the width, and by the height left
  // once the status bar and the navigation bar have taken theirs.
  const availH = height - insets.top - insets.bottom - NAV_CLEARANCE;
  const u = Math.max(0.6, Math.min(width / FOREST_W, availH / 610));

  return (
    <View style={StyleSheet.absoluteFill}>
      <ForestArt />
      <ForestLife />

      <View style={{
        flex: 1, paddingTop: insets.top + 10, paddingBottom: insets.bottom + NAV_CLEARANCE,
        paddingHorizontal: 18 * u,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <CoinBar coins={save.coins} onPlus={() => onTab('rewards')} u={u} />
          <SettingsBtn onPress={onSettings} u={u} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
          <GameLogo u={u * 0.82} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 * u }}>
            <WorldSign
              world={`${t('world').toUpperCase()} ${lv.stage + 1}`}
              area={(WORLDS[lv.stage].area ?? WORLDS[lv.stage].name).toUpperCase()}
              level={t('level').toUpperCase()} levelNo={nextIndex + 1}
              onPress={() => onTab('adventure')} u={u}
            />
            <View style={{ marginBottom: 6 * u }}>
              <BlockPyramid u={u} />
            </View>
          </View>
          <PlayCta label={t('play')} onPress={() => { haptic.medium(); onPlay(nextIndex); }} u={u} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 * u }}>
          <HomeCard
            tone="green" u={u} badge={daily ? '1' : undefined}
            title={t('dailyReward')}
            art={<WiggleArt active={daily}><GiftArt size={40 * u} /></WiggleArt>}
            onPress={() => { if (daily) onClaimDaily(); else onTab('rewards'); }}
          />
          <HomeCard
            tone="purple" u={u} badge={chestReady ? '1' : undefined}
            title={t('treasureChest')}
            art={<WiggleArt active={chestReady}><ChestArt size={46 * u} /></WiggleArt>}
            onPress={onChest}
          />
        </View>
      </View>
    </View>
  );
}

/* --- the welcome (loading) screen ------------------------------------------- */

/** How long the welcome screen shows before it hands over to Home. */
const WELCOME_MS = 3200;

/** A loading curve that speeds up and slows down like a real load, ending at exactly 1. */
function loadCurve(x: number) {
  if (x >= 1) return 1;
  if (x < 0.3) return (x / 0.3) * 0.38;
  if (x < 0.5) return 0.38 + ((x - 0.3) / 0.2) * 0.12;
  if (x < 0.85) return 0.5 + ((x - 0.5) / 0.35) * 0.42;
  return 0.92 + ((x - 0.85) / 0.15) * 0.08;
}

/** The loading line: a gold-rimmed navy track that fills with golden yellow, with a sweeping shine. */
function LoadBar({ progress, width, u }: { progress: number; width: number; u: number }) {
  const shine = useSharedValue(0);
  useEffect(() => {
    shine.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shine);
  }, [shine]);
  const H = 22 * u;
  const fill = Math.max(H - 6 * u, (width - 6 * u) * progress);
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -30 * u + shine.value * (width + 60 * u) }, { rotate: '20deg' }] }));
  return (
    <View style={{ width, height: H + 4 * u }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 4 * u, height: H, borderRadius: H / 2, backgroundColor: 'rgba(6,8,40,0.55)' }} />
      <View style={{ height: H, borderRadius: H / 2, overflow: 'hidden', borderWidth: 3 * u, borderColor: '#F2C24A', backgroundColor: '#101A55' }}>
        <View style={{ width: fill, height: '100%', borderRadius: H / 2, overflow: 'hidden' }}>
          <LinearGradient colors={gc('#FFF08A', '#FFC72E', '#F2A70E')} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.4)' }} />
          <Animated.View style={[{ position: 'absolute', top: -6 * u, width: 14 * u, height: H + 12 * u, backgroundColor: 'rgba(255,255,255,0.45)' }, shineStyle]} />
        </View>
      </View>
    </View>
  );
}

/** One of the drifting blocks on the welcome screen: drops in, then floats and turns a little. */
function FloatCube({ left, top, size, tone, glyph, rot, period, delay, u }: {
  left: number; top: number; size: number; tone: keyof typeof CUBE_TONES; glyph?: Glyph;
  rot: number; period: number; delay: number; u: number;
}) {
  const enter = useSharedValue(0);
  const v = useLoop(period, delay);
  useEffect(() => {
    enter.value = withDelay(200 + delay, withSpring(1, { damping: 8, stiffness: 120 }));
  }, [enter, delay]);
  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 3),
    transform: [
      { translateY: (1 - enter.value) * -90 * u + (v.value - 0.5) * 2 * 7 * u },
      { rotate: `${rot + (v.value - 0.5) * 6}deg` },
      { scale: 0.6 + 0.4 * Math.min(1, enter.value) },
    ],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: left * u, top: top * u, width: size * u, height: size * 1.04 * u }, aStyle]}>
      <ToyCube size={size * u} tone={tone} glyph={glyph} />
    </Animated.View>
  );
}

/**
 * The welcome screen: a dusk sea of floating islands, the logo, a scatter of
 * blocks drifting in the air, and a gold loading line that fills before the
 * game hands over to Home. There is nothing to tap here.
 */
function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height, u: su, ox, oy } = useStage();
  const t = useT();
  const [pct, setPct] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const start = Date.now();
    let handoff: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      const x = (Date.now() - start) / WELCOME_MS;
      setPct(loadCurve(Math.min(1, x)));
      if (x >= 1) {
        clearInterval(id);
        haptic.light();
        handoff = setTimeout(() => doneRef.current(), 350);
      }
    }, 40);
    return () => { clearInterval(id); if (handoff) clearTimeout(handoff); };
  }, []);

  const availH = height - insets.top - insets.bottom;
  const u = Math.max(0.6, Math.min(width / FOREST_W, availH / 640));
  const barW = Math.min(width - 90 * u, 250 * u);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WelcomeArt width={width} height={height} ox={ox} oy={oy} u={su} platform={false} />
        <LinearGradient
          colors={gc('rgba(96,34,170,0.6)', 'rgba(150,60,190,0.28)', 'rgba(255,140,170,0.2)', 'rgba(40,50,150,0.4)', 'rgba(8,14,80,0.62)')}
          locations={[0, 0.35, 0.6, 0.74, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={{ flex: 1, paddingTop: insets.top + 14 * u, paddingBottom: insets.bottom + 34 * u, alignItems: 'center' }}>
        <GameLogo u={u * 1.02} />

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 300 * u, height: 250 * u }}>
            <View pointerEvents="none" style={{
              position: 'absolute', left: 30 * u, right: 30 * u, top: 96 * u, height: 90 * u, borderRadius: 100 * u,
              backgroundColor: '#FFB84D', opacity: 0.16,
            }} />
            <FloatCube left={20} top={54} size={66} tone="red" glyph="star" rot={-10} period={3200} delay={0} u={u} />
            <FloatCube left={122} top={8} size={88} tone="yellow" glyph="star" rot={6} period={3600} delay={150} u={u} />
            <FloatCube left={68} top={108} size={70} tone="green" glyph="star" rot={-6} period={3000} delay={300} u={u} />
            <FloatCube left={196} top={96} size={66} tone="green" glyph="star" rot={10} period={3400} delay={450} u={u} />
            <FloatCube left={0} top={166} size={46} tone="purple" glyph="diamond" rot={-16} period={2800} delay={600} u={u} />
            <FloatCube left={128} top={150} size={78} tone="orange" glyph="star" rot={3} period={3800} delay={750} u={u} />
            <FloatCube left={262} top={158} size={44} tone="purple" glyph="diamond" rot={14} period={3100} delay={900} u={u} />
            <Sparkle x={108} y={40} size={5} delay={100} color="#FFF6B0" u={u} />
            <Sparkle x={270} y={150} size={4.5} delay={650} color="#FFFFFF" u={u} />
            <Sparkle x={40} y={140} size={4} delay={1000} color="#FFF6B0" u={u} />
            <Sparkle x={225} y={220} size={5} delay={400} color="#FFFFFF" u={u} />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 10 * u }}>
          <LoadBar progress={pct} width={barW} u={u} />
          <Text style={{
            color: '#FFFFFF', fontSize: 14 * u, letterSpacing: 0.6, includeFontPadding: false,
            textShadowColor: 'rgba(20,10,70,0.9)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 1,
          }}>{t('loading')}</Text>
        </View>
      </View>
    </View>
  );
}

/* --- shared scene pieces: stage, symbols, clouds, the floating-island art ---- */

const STAGE_W = 300;
const STAGE_H = 560;

function useStage() {
  const { width, height } = useWindowDimensions();
  const u = Math.min(width / STAGE_W, height / STAGE_H);
  return { width, height, u, ox: (width - STAGE_W * u) / 2, oy: (height - STAGE_H * u) / 2 };
}

/* --- symbol blocks -------------------------------------------------------- */

type Glyph = 'heart' | 'star' | 'diamond' | 'triangle' | 'circle' | 'clover' | 'cube';

function GlyphShape({ glyph, fill, dy = 0, opacity = 1 }: {
  glyph: Glyph; fill: string; dy?: number; opacity?: number;
}) {
  // A same-colour stroke rounds every corner, which is what makes the symbols
  // read as soft moulded plastic instead of sharp vector shapes.
  const p = { fill, opacity, stroke: fill, strokeWidth: 5, strokeLinejoin: 'round' as const };
  return (
    <G transform={`translate(0,${dy})`}>
      {glyph === 'star' ? <Path d={starPath(50, 47, 21, 9)} {...p} /> : null}
      {glyph === 'heart' ? <Path d="M50 68 C31 55 26 43 32 36 C38 29 47 32 50 40 C53 32 62 29 68 36 C74 43 69 55 50 68 Z" {...p} /> : null}
      {glyph === 'diamond' ? <Path d="M50 26 L72 47 L50 68 L28 47 Z" {...p} /> : null}
      {glyph === 'triangle' ? <Path d="M50 28 L72 66 L28 66 Z" {...p} /> : null}
      {glyph === 'circle' ? <Circle cx={50} cy={47} r={20} {...p} /> : null}
      {glyph === 'clover' ? (
        <>
          <Circle cx={50} cy={35} r={11} {...p} />
          <Circle cx={37} cy={54} r={11} {...p} />
          <Circle cx={63} cy={54} r={11} {...p} />
          <Circle cx={50} cy={48} r={8} {...p} />
          <Path d="M50 54 Q50 66 44 73" fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" opacity={opacity} />
        </>
      ) : null}
      {glyph === 'cube' ? (
        <>
          <Path d="M50 25 L71 37 L71 58 L50 70 L29 58 L29 37 Z" {...p} />
          <Path d="M50 47 L50 70 M50 47 L29 37 M50 47 L71 37" fill="none" stroke="#000000"
            strokeOpacity={0.26} strokeWidth={2.4} strokeLinecap="round" />
        </>
      ) : null}
    </G>
  );
}

const PUFFS: [number, number, number][] = [[-26, 4, 13], [-11, -5, 17], [9, -8, 19], [27, 1, 14], [0, 7, 15]];

function CloudShape() {
  return (
    <>
      <Ellipse cx={0} cy={13} rx={46} ry={9} fill="#9DB8F0" />
      {PUFFS.map(([x, y, r], i) => <Circle key={`s${i}`} cx={x} cy={y + 3} r={r} fill="#A7C0F4" />)}
      <Ellipse cx={0} cy={10} rx={44} ry={8} fill="#EAF2FF" />
      {PUFFS.map(([x, y, r], i) => <Circle key={`f${i}`} cx={x} cy={y} r={r} fill="#F6F9FF" />)}
    </>
  );
}

/* --- the static scene ----------------------------------------------------- */

type ArtIds = { sky: string; glow: string; rock: string; grass: string; fall: string; wall: string; roofB: string; roofM: string; water: string; halo: string };

function Island({ cx, cy, w, g, dim = 1, trees = 2, fall }: {
  cx: number; cy: number; w: number; g: ArtIds; dim?: number; trees?: number;
  fall?: { dx: number; len: number };
}) {
  const rock =
    `M${cx - w / 2} ${cy} Q${cx - w / 2 + w * 0.02} ${cy + w * 0.22} ${cx - w * 0.3} ${cy + w * 0.36} ` +
    `Q${cx - w * 0.15} ${cy + w * 0.55} ${cx - w * 0.06} ${cy + w * 0.72} Q${cx} ${cy + w * 0.82} ${cx + w * 0.07} ${cy + w * 0.7} ` +
    `Q${cx + w * 0.16} ${cy + w * 0.5} ${cx + w * 0.3} ${cy + w * 0.36} Q${cx + w / 2 - w * 0.02} ${cy + w * 0.22} ${cx + w / 2} ${cy} Z`;
  return (
    <G opacity={dim}>
      <Path d={rock} fill={`url(#${g.rock})`} />
      {fall ? (
        <>
          <Path d={roundRect(cx + fall.dx - w * 0.06, cy + w * 0.06, w * 0.12, fall.len, w * 0.05)} fill={`url(#${g.fall})`} />
          <Path d={roundRect(cx + fall.dx - w * 0.06, cy + w * 0.06, w * 0.12, fall.len, w * 0.05)} fill="#7FDCFF" fillOpacity={0.25} />
          <Path d={`M${cx + fall.dx - w * 0.02} ${cy + w * 0.1} L${cx + fall.dx - w * 0.02} ${cy + fall.len * 0.9}`} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.6} strokeLinecap="round" />
          <Path d={`M${cx + fall.dx + w * 0.025} ${cy + w * 0.16} L${cx + fall.dx + w * 0.025} ${cy + fall.len * 0.75}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
          <Ellipse cx={cx + fall.dx} cy={cy + w * 0.06 + fall.len} rx={w * 0.19} ry={w * 0.06} fill="#FFFFFF" opacity={0.6} />
          <Ellipse cx={cx + fall.dx} cy={cy + w * 0.06 + fall.len - 2} rx={w * 0.11} ry={w * 0.04} fill="#FFFFFF" opacity={0.8} />
        </>
      ) : null}
      <Path d={`M${cx - w * 0.22} ${cy + w * 0.14} L${cx - w * 0.1} ${cy + w * 0.4} M${cx + w * 0.14} ${cy + w * 0.12} L${cx + w * 0.06} ${cy + w * 0.5}`}
        stroke="#2A2050" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
      <Ellipse cx={cx} cy={cy + 1} rx={w / 2} ry={w * 0.1} fill="#2C7A3F" />
      <Ellipse cx={cx} cy={cy - 1} rx={w / 2 - 1} ry={w * 0.095} fill={`url(#${g.grass})`} />
      {trees >= 1 ? (
        <>
          <Rect x={cx - w * 0.2 - 1.2} y={cy - w * 0.11} width={2.4} height={w * 0.11} fill="#6B4A2E" />
          <Circle cx={cx - w * 0.2} cy={cy - w * 0.16} r={w * 0.11} fill="#2C9A56" />
          <Circle cx={cx - w * 0.23} cy={cy - w * 0.19} r={w * 0.06} fill="#6BE08A" opacity={0.75} />
        </>
      ) : null}
      {trees >= 2 ? (
        <>
          <Path d={`M${cx + w * 0.17} ${cy - w * 0.26} L${cx + w * 0.26} ${cy - w * 0.04} L${cx + w * 0.08} ${cy - w * 0.04} Z`} fill="#1F8F55" />
          <Path d={`M${cx + w * 0.17} ${cy - w * 0.19} L${cx + w * 0.28} ${cy + w * 0.0} L${cx + w * 0.06} ${cy + w * 0.0} Z`} fill="#187A48" />
        </>
      ) : null}
    </G>
  );
}

function Castle({ x, y, s, g }: { x: number; y: number; s: number; g: ArtIds }) {
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      <Circle cx={0} cy={-34} r={44} fill="#FFD98A" opacity={0.22} />
      <Rect x={-31} y={-44} width={14} height={44} rx={2} fill={`url(#${g.wall})`} />
      <Path d="M-33 -44 L-24 -66 L-15 -44 Z" fill={`url(#${g.roofB})`} />
      <Rect x={17} y={-50} width={14} height={50} rx={2} fill={`url(#${g.wall})`} />
      <Path d="M15 -50 L24 -74 L33 -50 Z" fill={`url(#${g.roofM})`} />
      <Rect x={-15} y={-58} width={30} height={58} rx={2} fill={`url(#${g.wall})`} />
      <Path d="M-19 -58 L0 -90 L19 -58 Z" fill={`url(#${g.roofB})`} />
      <Path d="M0 -90 L0 -102" stroke="#6A4A2E" strokeWidth={1.4} />
      <Path d="M0 -102 L10 -98 L0 -94 Z" fill="#FF4D6D" />
      <Path d="M24 -74 L24 -84" stroke="#6A4A2E" strokeWidth={1.2} />
      <Path d="M24 -84 L31 -81 L24 -78 Z" fill="#FFD84D" />
      {[[-7, -46], [2, -46], [-7, -30], [2, -30]].map(([wx, wy], i) => (
        <Rect key={i} x={wx} y={wy} width={5} height={8} rx={2.5} fill="#FFE58A" />
      ))}
      <Rect x={-28} y={-34} width={5} height={8} rx={2.5} fill="#FFE58A" />
      <Rect x={22} y={-38} width={5} height={8} rx={2.5} fill="#FFE58A" />
      <Path d="M-5 0 V-10 A5 5 0 0 1 5 -10 V0 Z" fill="#4A2B7A" />
    </G>
  );
}

/** Everything that never moves: sky, islands, castle, water, platform. */
const WelcomeArt = React.memo(function WelcomeArt({ width, height, ox, oy, u, platform = true }: {
  width: number; height: number; ox: number; oy: number; u: number; platform?: boolean;
}) {
  const uid = useUid('wa');
  const g: ArtIds = {
    sky: `${uid}sky`, glow: `${uid}glow`, rock: `${uid}rock`, grass: `${uid}grass`, fall: `${uid}fall`,
    wall: `${uid}wall`, roofB: `${uid}rb`, roofM: `${uid}rm`, water: `${uid}water`, halo: `${uid}halo`,
  };

  const stars = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number }[] = [];
    let seed = 71717;
    const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let i = 0; i < 70; i++) out.push({ x: -160 + next() * 620, y: -260 + next() * 470, r: 0.4 + next() * 1.1, o: 0.25 + next() * 0.6 });
    return out;
  }, []);

  const rocks: [number, number, number, number, string][] = [
    [26, 402, 36, 28, '#C9AE8B'], [60, 404, 42, 30, '#B69878'], [100, 402, 38, 28, '#CDB491'],
    [136, 405, 46, 30, '#B39575'], [180, 402, 40, 28, '#C6AB88'], [218, 404, 36, 30, '#B69878'],
    [250, 402, 26, 27, '#CDB491'],
    [42, 428, 34, 20, '#9C8065'], [76, 430, 40, 20, '#A88B6E'], [116, 431, 44, 19, '#977C62'],
    [160, 431, 42, 20, '#A88B6E'], [200, 430, 38, 20, '#9C8065'], [234, 428, 30, 20, '#A88B6E'],
  ];

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinear id={g.sky} gradientUnits="userSpaceOnUse" x1="0" y1="-80" x2="0" y2="440">
          <Stop offset="0" stopColor="#0A1450" />
          <Stop offset="0.28" stopColor="#17358F" />
          <Stop offset="0.55" stopColor="#2C5FD0" />
          <Stop offset="0.8" stopColor="#4E93EE" />
          <Stop offset="1" stopColor="#86CBFF" />
        </SvgLinear>
        <SvgRadial id={g.glow} gradientUnits="userSpaceOnUse" cx="150" cy="150" r="210">
          <Stop offset="0" stopColor="#A9DCFF" stopOpacity="0.5" />
          <Stop offset="0.5" stopColor="#5C9BFF" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#5C9BFF" stopOpacity="0" />
        </SvgRadial>
        <SvgRadial id={g.halo} gradientUnits="userSpaceOnUse" cx="146" cy="276" r="96">
          <Stop offset="0" stopColor="#FFE58A" stopOpacity="0.55" />
          <Stop offset="0.5" stopColor="#FFC93C" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#FFC93C" stopOpacity="0" />
        </SvgRadial>
        <SvgLinear id={g.rock} x1="0" y1="0" x2="0.25" y2="1">
          <Stop offset="0" stopColor="#9C88B8" />
          <Stop offset="0.55" stopColor="#5A4A86" />
          <Stop offset="1" stopColor="#2E2358" />
        </SvgLinear>
        <SvgLinear id={g.grass} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9CEB78" />
          <Stop offset="1" stopColor="#3DAE58" />
        </SvgLinear>
        <SvgLinear id={g.fall} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#8FE4FF" stopOpacity="0.55" />
        </SvgLinear>
        <SvgLinear id={g.wall} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F8EEFF" />
          <Stop offset="1" stopColor="#BFA2EE" />
        </SvgLinear>
        <SvgLinear id={g.roofB} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5C92FF" />
          <Stop offset="1" stopColor="#2143B8" />
        </SvgLinear>
        <SvgLinear id={g.roofM} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7BC8" />
          <Stop offset="1" stopColor="#B02A8A" />
        </SvgLinear>
        <SvgLinear id={g.water} gradientUnits="userSpaceOnUse" x1="0" y1="416" x2="0" y2="720">
          <Stop offset="0" stopColor="#4DB8F7" />
          <Stop offset="0.35" stopColor="#2A78DE" />
          <Stop offset="1" stopColor="#0E2E8F" />
        </SvgLinear>
      </Defs>

      <G transform={`translate(${ox},${oy}) scale(${u})`}>
        {/* sky */}
        <Rect x={-900} y={-1200} width={2100} height={2200} fill={`url(#${g.sky})`} />
        <Rect x={-900} y={-1200} width={2100} height={2200} fill={`url(#${g.glow})`} />
        {stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />)}

        {/* far islands, dimmer so they sit deeper in the haze */}
        <Island cx={82} cy={212} w={38} g={g} dim={0.5} trees={1} />
        <Island cx={204} cy={200} w={34} g={g} dim={0.45} trees={1} />

        {/* clouds behind the main islands */}
        <Cloud cx={26} cy={30} s={1.0} o={0.9} />
        <Cloud cx={252} cy={38} s={1.1} o={0.85} />
        <Cloud cx={62} cy={168} s={0.9} o={0.6} />
        <Cloud cx={240} cy={176} s={1.0} o={0.65} />

        {/* main islands */}
        <Island cx={20} cy={88} w={58} g={g} trees={1} />
        <Island cx={270} cy={72} w={44} g={g} trees={1} />
        <Island cx={30} cy={240} w={96} g={g} trees={2} fall={{ dx: -17, len: 96 }} />
        <Island cx={264} cy={238} w={116} g={g} trees={0} fall={{ dx: 24, len: 100 }} />
        <Castle x={262} y={234} s={0.72} g={g} />

        {/* clouds in front, hugging the horizon */}
        <Cloud cx={36} cy={344} s={1.35} o={0.92} />
        <Cloud cx={268} cy={350} s={1.3} o={0.92} />
        <Cloud cx={150} cy={412} s={2.2} o={0.75} />
        <Cloud cx={-20} cy={420} s={1.7} o={0.85} />
        <Cloud cx={320} cy={422} s={1.7} o={0.85} />

        {/* water */}
        <Rect x={-900} y={416} width={2100} height={1200} fill={`url(#${g.water})`} />
        <Ellipse cx={150} cy={417} rx={340} ry={13} fill="#D3F1FF" opacity={0.42} />
        {[[20, 440], [210, 448], [70, 470], [250, 478], [140, 500], [30, 520], [230, 530], [110, 548]].map(([x, y], i) => (
          <Path key={i} d={`M${x} ${y} q8 -3 16 0 t16 0 t16 0`} fill="none" stroke="#FFFFFF" strokeOpacity={0.24} strokeWidth={1.6} strokeLinecap="round" />
        ))}

        {platform ? (
        <G>
        {/* warm halo behind the floating block */}
        <Circle cx={146} cy={276} r={96} fill={`url(#${g.halo})`} />

        {/* the stone platform, its reflection, and the grass on top */}
        <Ellipse cx={150} cy={446} rx={138} ry={13} fill="#06184A" opacity={0.42} />
        <Path d="M26 394 Q30 432 72 445 Q150 460 228 445 Q270 432 274 394 Z" fill="#5C4863" />
        {rocks.map(([x, y, w, h, c], i) => (
          <G key={i}>
            <Path d={roundRect(x, y, w, h, 9)} fill={c} />
            <Path d={roundRect(x + 2, y + 2, w - 4, h * 0.4, 6)} fill="#FFFFFF" fillOpacity={0.2} />
            <Path d={roundRect(x, y + h * 0.7, w, h * 0.3, 8)} fill="#3A2A44" fillOpacity={0.22} />
          </G>
        ))}
        <Ellipse cx={150} cy={396} rx={126} ry={17} fill="#2C6B3C" />
        <Ellipse cx={150} cy={392} rx={124} ry={16} fill={`url(#${g.grass})`} />
        <Ellipse cx={150} cy={388} rx={104} ry={9} fill="#B8F58C" opacity={0.28} />
        {[[40, 396], [64, 402], [98, 406], [204, 406], [236, 402], [262, 396]].map(([x, y], i) => (
          <Ellipse key={i} cx={x} cy={y} rx={9} ry={4.5} fill="#5CD07A" />
        ))}
        {/* bushes and flowers on the corners */}
        <Circle cx={42} cy={384} r={9} fill="#2C9A56" />
        <Circle cx={34} cy={388} r={7} fill="#3FB868" />
        <Circle cx={258} cy={384} r={9} fill="#2C9A56" />
        <Circle cx={266} cy={388} r={7} fill="#3FB868" />
        {[[46, 380, '#FF7AC8'], [38, 383, '#FFD84D'], [254, 380, '#FF7AC8'], [262, 383, '#FFFFFF'], [50, 388, '#FFFFFF'], [250, 388, '#FFD84D']].map(([x, y, c], i) => (
          <Circle key={i} cx={x as number} cy={y as number} r={2.6} fill={c as string} />
        ))}
        </G>
        ) : null}
      </G>
    </Svg>
  );
});

function Cloud({ cx, cy, s, o = 1 }: { cx: number; cy: number; s: number; o?: number }) {
  return (
    <G transform={`translate(${cx},${cy}) scale(${s})`} opacity={o}>
      <CloudShape />
    </G>
  );
}


/* ==========================================================================
 * 11. REWARDS + PROFILE
 * ========================================================================== */

type RewardPrize = { coins: number; power?: PowerId };

/** The animated claim: a card pops, confetti fires, the prize counts in. */
function RewardPopup({ title, prize, onClose }: {
  title: string; prize: RewardPrize; onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    haptic.ok();
    playSfx('reward');
    [140, 260].forEach((ms) => setTimeout(haptic.light, ms));
  }, []);
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { zIndex: 4100 }]} pointerEvents="none">
        <Confetti count={30} />
      </View>
      <ModalCard plain quiet maxWidth={330}>
        <ParchmentCard
          onClose={onClose}
          lines={[{
            text: title, size: Math.max(15, Math.min(27, Math.floor(240 / (title.length * 0.52)))),
            fill: '#FFF6E4', hi: '#FFFFFF', outline: '#3A1E08',
          }]}
        >
          <View style={{ height: 108, alignItems: 'center', justifyContent: 'center' }}>
            <SunRays size={210} color="#FFE27A" opacity={0.55} />
            {prize.power ? <ChestArt size={112} /> : <GiftArt size={92} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <RewardTile icon={<CoinStack size={46} />} label={`+${prize.coins} ${t('coinsWord')}`} />
            {prize.power ? (
              <RewardTile
                icon={<Icon name={prize.power as IconName} size={34} color="#2E9A3A" />}
                label={`+1 ${POWER_BY_ID[prize.power].name}`}
              />
            ) : null}
          </View>
          <Btn label={t('claim')} tone="green" onPress={onClose} style={{ marginTop: 14 }} big />
        </ParchmentCard>
      </ModalCard>
    </>
  );
}





/* --- settings ------------------------------------------------------------- */


/* ==========================================================================
 * 13. BOTTOM NAVIGATION
 * ========================================================================== */


/* ==========================================================================
 * 10b. HOME + WORLD MAP
 * ========================================================================== */


/* --- the Home screen -------------------------------------------------------- */

/** The welcome scene's floating islands, tinted toward dusk, behind Home. */
function HomeBackdrop({ dim = 0 }: { dim?: number }) {
  const { width, height, u, ox, oy } = useStage();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <WelcomeArt width={width} height={height} ox={ox} oy={oy} u={u} />
      <LinearGradient
        colors={gc('rgba(78,26,160,0.5)', 'rgba(50,24,140,0.16)', 'rgba(24,12,90,0.5)')}
        style={StyleSheet.absoluteFill}
      />
      {dim > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080C34', opacity: dim }]} /> : null}
    </View>
  );
}

/* --- the world map --------------------------------------------------------- */

type NodeState = 'locked' | 'current' | 'done';

/**
 * What the map remembers between visits, so it can celebrate once rather than
 * every time: the furthest level it has shown you, and which worlds have already
 * had their opening fly-over.
 */
const MAP_MEMORY = { reached: -1, flown: new Set<number>() };

/** Three little stars over a finished level: the middle one lifted, gold when earned. */
function NodeStars({ count, size }: { count: number; size: number }) {
  return (
    <Svg width={size * 3.5} height={size * 1.75} viewBox="0 0 105 52">
      {[[19, 35, 0], [52, 21, 1], [86, 35, 2]].map(([cx, cy, i]) => {
        const on = (i as number) < count;
        const r = i === 1 ? 18 : 14.5;
        return (
          <G key={i as number}>
            <Path d={starPath(cx, cy + 2, r, r * 0.46)} fill="#000000" opacity={0.28} />
            <Path d={starPath(cx, cy, r, r * 0.46)} fill={on ? '#FFD53A' : '#2C3A66'}
              stroke={on ? '#B86A00' : '#18224A'} strokeWidth={2.6} strokeLinejoin="round" opacity={on ? 1 : 0.8} />
            {on ? <Path d={starPath(cx - 1.5, cy - 2, r * 0.5, r * 0.22)} fill="#FFF6B0" opacity={0.85} /> : null}
          </G>
        );
      })}
    </Svg>
  );
}

/** The round level button: a glossy blue disc in a pale bevel, or a grey padlocked one. */
function NodeFace({ size, state, boss }: { size: number; state: NodeState; boss: boolean }) {
  const uid = useUid('nf');
  const C = state === 'locked'
    ? { ring: '#242A38', bev1: '#A2ABBE', bev2: '#5E687C', in1: '#727B8E', in2: '#434A5C' }
    : boss
      ? { ring: '#0E6428', bev1: '#EDFFE4', bev2: '#9CE28C', in1: '#70E272', in2: '#1FA83A' }
      : { ring: '#153C88', bev1: '#F2FAFF', bev2: '#A8D8FF', in1: '#68C6FF', in2: '#2874E0' };
  if (state === 'locked') {
    // a dark stone badge, wider at the foot than at the shoulders
    const SH = 'M24 12 Q50 3 76 12 Q85 16 87 28 L94 74 Q97 95 78 97 L22 97 Q3 95 6 74 L13 28 Q15 16 24 12 Z';
    return (
      <Svg width={size} height={size * 1.08} viewBox="0 0 100 108">
        <Defs>
          <SvgLinear id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B6BFD2" />
            <Stop offset="1" stopColor="#5F697E" />
          </SvgLinear>
          <SvgLinear id={`${uid}i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5C657C" />
            <Stop offset="1" stopColor="#333A4E" />
          </SvgLinear>
        </Defs>
        <Ellipse cx={50} cy={101} rx={42} ry={6} fill="#000000" opacity={0.3} />
        <Path d={SH} fill="#1B2030" transform="translate(0,6)" />
        <Path d={SH} fill={`url(#${uid}b)`} stroke="#222838" strokeWidth={3} strokeLinejoin="round" />
        <Path d={SH} fill={`url(#${uid}i)`} transform="translate(50 54) scale(0.8) translate(-50 -54)" />
        <Path d="M26 20 Q50 11 74 20" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 100 108">
      <Defs>
        <SvgLinear id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.bev1} />
          <Stop offset="1" stopColor={C.bev2} />
        </SvgLinear>
        <SvgLinear id={`${uid}i`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.in1} />
          <Stop offset="1" stopColor={C.in2} />
        </SvgLinear>
      </Defs>
      <Ellipse cx={50} cy={100} rx={40} ry={7} fill="#000000" opacity={0.3} />
      <Circle cx={50} cy={58} r={46} fill={C.ring} />
      <Circle cx={50} cy={52} r={46} fill={C.ring} />
      <Circle cx={50} cy={52} r={42} fill={`url(#${uid}b)`} />
      <Circle cx={50} cy={53} r={34} fill={`url(#${uid}i)`} stroke={C.ring} strokeOpacity={0.4} strokeWidth={1.6} />
      <Ellipse cx={50} cy={34} rx={24} ry={11} fill="#FFFFFF" opacity={0.3} />
    </Svg>
  );
}

/** One level on the road: a numbered button, its stars, and a little life. */
function MapNode({ n, state, stars, size, boss, fresh, onPress, onLocked }: {
  n: number; state: NodeState; stars: number; size: number; boss: boolean; fresh: boolean;
  onPress: () => void; onLocked: () => void;
}) {
  const press = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(fresh ? 0 : 1);
  const bob = useLoop(900);
  useEffect(() => {
    if (!fresh) return;
    pop.value = withDelay(450, withSpring(1, { damping: 6, stiffness: 170 }));
    return () => cancelAnimation(pop);
  }, [fresh, pop]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.25 + pop.value * 1.2),
    transform: [
      { translateX: shake.value },
      { translateY: press.value * 3 },
      { scale: (0.4 + 0.6 * pop.value) * (state === 'current' ? 1 + bob.value * 0.06 : 1) },
    ],
  }));
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 6 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + bob.value * 0.5, transform: [{ scale: 0.94 + bob.value * 0.1 }] }));

  const tap = () => {
    if (state === 'locked') {
      shake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withRepeat(withTiming(6, { duration: 90 }), 4, true),
        withTiming(0, { duration: 60 }),
      );
      playSfx('locked');
      haptic.err();
      onLocked();
      return;
    }
    playSfx('select');
    haptic.light();
    onPress();
  };

  return (
    <AnimPressable
      accessibilityRole="button"
      accessibilityLabel={state === 'locked' ? `Level ${n}, locked` : `Level ${n}, ${stars} of 3 stars`}
      hitSlop={6}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={tap}
      style={[{ width: size, alignItems: 'center' }, aStyle]}
    >
      {state === 'current' ? (
        <Animated.View pointerEvents="none" style={[{
          position: 'absolute', left: -size * 0.14, top: -size * 0.1, width: size * 1.28, height: size * 1.28,
          borderRadius: size, backgroundColor: '#FFE27A',
        }, glowStyle]} />
      ) : null}
      <View style={{ width: size, height: size }}>
        <NodeFace size={size} state={state} boss={boss} />
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: size * 0.04, zIndex: 2 }]}>
          {state === 'locked' ? <Icon name="lock" size={size * 0.44} color="#E2E7F2" /> : (
            <Text style={{
              color: '#FFFFFF', fontSize: size * 0.5, includeFontPadding: false,
              textShadowColor: boss ? 'rgba(0,70,20,0.85)' : 'rgba(6,30,100,0.85)',
              textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0,
            }}>{n}</Text>
          )}
        </View>
      </View>

      {/* a finished level shows its stars above it; the last level of a world wears a crown */}
      {state === 'done' && !boss ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -size * 0.44, left: 0, right: 0, alignItems: 'center' }}>
          <NodeStars count={stars} size={size * 0.3} />
        </View>
      ) : null}
      {boss ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -size * 0.36, left: 0, right: 0, alignItems: 'center' }}>
          <Icon name="crown" size={size * 0.42} color={C.gold} />
        </View>
      ) : null}
      {boss && state === 'done' ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -size * 0.4, left: 0, right: 0, alignItems: 'center' }}>
          <NodeStars count={stars} size={size * 0.3} />
        </View>
      ) : null}

      {/* "you are here" */}
      {state === 'current' && !boss ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -size * 0.62, alignSelf: 'center' }, pinStyle]}>
          <Svg width={26} height={32} viewBox="0 0 26 32">
            <Path d="M13 31 C13 31 2 18 2 11 A11 11 0 0 1 24 11 C24 18 13 31 13 31 Z" fill="#FF5A6E" stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
            <Circle cx={13} cy={11} r={4.2} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      ) : null}
    </AnimPressable>
  );
}

/** Tapping a level opens this: its stars, what earns them, the goal, and PLAY. */
function LevelSheet({ level, save, onPlay, onClose }: {
  level: Level; save: Save; onPlay: () => void; onClose: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const def = worldDef(level.stage);
  const stars = save.stars[level.key] ?? 0;
  const best = save.best[level.key] ?? 0;
  const need = goalState(level, { lines: 0, score: 0, crystals: 0, iceBroken: 0 }).need;
  const rise = useSharedValue(0);
  useEffect(() => {
    playSfx('pop');
    rise.value = withSpring(1, { damping: 16, stiffness: 190 });
    return () => cancelAnimation(rise);
  }, [rise]);
  const dim = useAnimatedStyle(() => ({ opacity: rise.value }));
  const sheet = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.value * 1.5),
    transform: [{ translateY: (1 - rise.value) * 140 }],
  }));
  const close = () => { tapFx(); onClose(); };
  const earn = [t('goalStar'), fmt(level.stars[1]), fmt(level.stars[2])];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 3500 }]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, dim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
          <LinearGradient colors={gc('rgba(3,9,38,0.25)', 'rgba(5,12,48,0.7)')} style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents="box-none"
        style={[{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 14, alignItems: 'center' }, sheet]}>
        <View style={{ width: '100%', maxWidth: 380 }}>
          <Panel radius={26} tint="rgba(28,60,166,0.36)" glow={def.accent} style={{ padding: 18, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 27, letterSpacing: 1.2 }}>{t('level')} {level.index + 1}</Text>
                <Text style={{ color: def.accent, fontSize: 13, letterSpacing: 0.6 }}>{def.name}</Text>
              </View>
              <Pressable hitSlop={10} onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={{
                width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(4,10,44,0.9)',
                borderWidth: 1.5, borderColor: C.cardEdge, alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="close" size={15} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 14 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ alignItems: 'center', width: 76 }}>
                  <StarIcon filled={i < stars} size={i === 1 ? 58 : 50} />
                  <Text style={{ color: i < stars ? C.goldHi : C.textDim, fontSize: 12, marginTop: 4 }}>{earn[i]}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: C.textFaint, fontSize: 11, textAlign: 'center', marginTop: 2, letterSpacing: 0.6 }}>{t('starsAt')}</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Panel radius={16} style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
                <GoalGlyph objType={level.objType} size={28} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14 }}>{OBJ_TITLE[level.objType]}</Text>
                  <Text style={{ color: C.goldHi, fontSize: 13 }}>{fmt(need)}</Text>
                </View>
              </Panel>
              <Panel radius={16} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
                <Text style={{ color: C.textDim, fontSize: 11 }}>{t('movesShort')}</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 25, lineHeight: 28 }}>{level.moves}</Text>
              </Panel>
            </View>
            {best > 0 ? (
              <Text style={{ color: C.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                {t('best')}  <Text style={{ color: C.goldHi }}>{fmt(best)}</Text>
              </Text>
            ) : null}
            <Btn label={stars > 0 ? t('playAgain') : t('play')} icon="play" tone="gold" big onPress={onPlay} style={{ marginTop: 14 }} />
          </Panel>
        </View>
      </Animated.View>
    </View>
  );
}

/** The world's sign: a chunky wooden plank with leaves curling over its corners. */
function MapBanner({ name, width }: { name: string; width: number }) {
  const uid = useUid('mb');
  const k = width / 200;
  const leaf = (x: number, y: number, r: number, c: string, key: string) => (
    <Path key={key} d="M0 0 Q7 -11 17 0 Q7 8 0 0Z" fill={c} stroke="#0F5A28" strokeWidth={1.2} transform={`translate(${x},${y}) rotate(${r})`} />
  );
  const size = Math.min(24 * k, (172 * k) / (name.length * 0.5));
  return (
    <View style={{ width, height: 62 * k }}>
      <Svg width={width} height={62 * k} viewBox="0 0 200 62" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D69A55" />
            <Stop offset="0.5" stopColor="#A9692F" />
            <Stop offset="1" stopColor="#7A4820" />
          </SvgLinear>
        </Defs>
        <Path d={roundRect(8, 10, 184, 46, 10)} fill="#2E1808" transform="translate(0,3)" />
        <Path d={roundRect(8, 8, 184, 46, 10)} fill={`url(#${uid}w)`} stroke="#4A2A0E" strokeWidth={2.8} />
        <Path d={roundRect(13, 11, 174, 11, 5.5)} fill="#FFFFFF" fillOpacity={0.22} />
        <Path d="M16 32 H184 M16 41 H184" stroke="#5E3612" strokeOpacity={0.32} strokeWidth={1.4} />
        {[[17, 17], [183, 17], [17, 46], [183, 46]].map(([nx, ny], i) => <Circle key={i} cx={nx} cy={ny} r={2.4} fill="#E7B33A" stroke="#7A4A00" strokeWidth={0.9} />)}
        {leaf(14, 12, -145, '#3DBB58', 'l1')}
        {leaf(10, 16, 160, '#2E9A45', 'l2')}
        {leaf(18, 8, -105, '#5CD07A', 'l3')}
        {leaf(186, 12, -35, '#3DBB58', 'r1')}
        {leaf(190, 16, 20, '#2E9A45', 'r2')}
        {leaf(182, 8, -75, '#5CD07A', 'r3')}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 14 * k, right: 14 * k, top: 7 * k, height: 44 * k, alignItems: 'center', justifyContent: 'center' }}>
        <ChunkyText text={name} size={size} width={172 * k} fill="#FFE9A0" hi="#FFF9D8" outline="#3A1E08" ring={1.7 * k} extrude={1.3 * k} />
      </View>
    </View>
  );
}

/** A round blue arrow on the edge of the map, for stepping to the neighbouring world. */
function WorldArrow({ dir, label, onPress }: { dir: 'prev' | 'next'; label: string; onPress: () => void }) {
  const press = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.1 }] }));
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={`${dir === 'next' ? 'Next' : 'Previous'} world: ${label}`} hitSlop={10}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={() => { haptic.select(); playSfx('swipe'); onPress(); }}
      style={[{
        width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#2F74F0', borderWidth: 3, borderColor: '#D6ECFF',
        shadowColor: '#0A1E6A', shadowOpacity: 0.45, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
      }, aStyle]}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 2, left: 5, right: 5, height: 11, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      <Icon name={dir === 'prev' ? 'back' : 'next'} size={17} color="#FFFFFF" />
    </AnimPressable>
  );
}

/** The world's little mascot, sitting in the bottom corner: a cheerful block, or a snowman in the snow. */
function WorldMascot({ world }: { world: number }) {
  const uid = useUid('wm');
  const cube = (x: number, y: number, n: number, top: string, front: string, side: string, face: boolean, k: string) => {
    const w = n;
    const d = n * 0.34;
    return (
      <G key={k} transform={`translate(${x} ${y})`}>
        <Path d={`M0 0 L${w} 0 L${w + d} ${-d} L${d} ${-d} Z`} fill={top} stroke="#0000002E" strokeWidth={1.4} strokeLinejoin="round" />
        <Path d={`M${w} 0 L${w + d} ${-d} L${w + d} ${w - d} L${w} ${w} Z`} fill={side} stroke="#0000002E" strokeWidth={1.4} strokeLinejoin="round" />
        <Path d={roundRect(0, 0, w, w, n * 0.16)} fill={front} stroke="#0000002E" strokeWidth={1.4} />
        <Path d={roundRect(n * 0.08, n * 0.07, w * 0.84, n * 0.2, n * 0.09)} fill="#FFFFFF" fillOpacity={0.28} />
        {face ? (
          <G>
            <Path d={`M${w * 0.26} ${w * 0.42} Q${w * 0.32} ${w * 0.34} ${w * 0.38} ${w * 0.42}`} stroke="#3A1E08" strokeWidth={n * 0.06} strokeLinecap="round" fill="none" />
            <Path d={`M${w * 0.62} ${w * 0.42} Q${w * 0.68} ${w * 0.34} ${w * 0.74} ${w * 0.42}`} stroke="#3A1E08" strokeWidth={n * 0.06} strokeLinecap="round" fill="none" />
            <Path d={`M${w * 0.36} ${w * 0.56} Q${w * 0.5} ${w * 0.72} ${w * 0.64} ${w * 0.56} Z`} fill="#7A2A1E" stroke="#3A1E08" strokeWidth={n * 0.04} strokeLinejoin="round" />
            <Circle cx={w * 0.2} cy={w * 0.56} r={n * 0.07} fill="#FF7A8A" opacity={0.6} />
            <Circle cx={w * 0.8} cy={w * 0.56} r={n * 0.07} fill="#FF7A8A" opacity={0.6} />
          </G>
        ) : null}
      </G>
    );
  };
  if (world === 1) return null;
  if (world === 2) {
    return (
      <Svg width={64} height={92} viewBox="-40 -100 80 104">
        <Ellipse cx={0} cy={2} rx={30} ry={5} fill="#000000" opacity={0.18} />
        <Path d="M-22 -20 L-36 -34 M22 -20 L36 -38" stroke="#7A4A26" strokeWidth={3} strokeLinecap="round" transform="translate(0 -8)" />
        <Circle cx={0} cy={-20} r={21} fill="#FFFFFF" stroke="#8FB0D6" strokeWidth={2.4} />
        <Circle cx={0} cy={-47} r={16} fill="#FFFFFF" stroke="#8FB0D6" strokeWidth={2.4} />
        <Circle cx={0} cy={-72} r={13} fill="#FFFFFF" stroke="#8FB0D6" strokeWidth={2.4} />
        <Path d="M-13 -58 Q0 -52 13 -58 L13 -52 Q0 -46 -13 -52 Z" fill="#E8543E" />
        <Path d="M-14 -81 H14 M-9 -81 V-96 H9 V-81" fill="#2A2A3A" stroke="#2A2A3A" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M0 -71 L12 -69 L0 -66 Z" fill="#FF9A2E" />
        <Circle cx={-4.6} cy={-75} r={1.8} fill="#1B1B1B" />
        <Circle cx={4.6} cy={-75} r={1.8} fill="#1B1B1B" />
        {[-32, -21, -10].map((yy) => <Circle key={yy} cx={0} cy={yy} r={2} fill="#2A2A3A" />)}
      </Svg>
    );
  }
  const stack = world === 0;
  const c = world === 0 ? ['#FFE86A', '#FFC72E', '#D99A0E'] : world === 3 ? ['#FF8A80', '#F0433B', '#A8221C'] : ['#F6A0F0', '#D850D8', '#8E2A96'];
  return (
    <Svg width={72} height={stack ? 96 : 66} viewBox={`0 -22 72 ${stack ? 96 : 66}`}>
      <Ellipse cx={34} cy={stack ? 72 : 42} rx={32} ry={5} fill="#000000" opacity={0.2} />
      {stack ? cube(4, 44, 26, '#FF9AA0', '#F0433B', '#A8221C', false, 'r') : null}
      {stack ? cube(34, 44, 26, '#9CC8FF', '#3B7BEE', '#1B47A8', false, 'b') : null}
      {stack ? cube(18, 6, 30, c[0], c[1], c[2], true, 'y') : cube(14, 6, 34, c[0], c[1], c[2], true, 'y')}
    </Svg>
  );
}

/**
 * One world, top to bottom: sky and far ridges that slide slower than the
 * ground, then the terrain, the road, the scenery and the level nodes. Level 1
 * is at the bottom and the road climbs toward a landmark on the horizon. The
 * first time you open a world the camera flies down from that landmark to where
 * you are.
 */
function WorldView({ world, save, nextIndex, headerH, onSelect, onLocked }: {
  world: number; save: Save; nextIndex: number; headerH: number;
  onSelect: (levelIndex: number) => void; onLocked: (levelIndex: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const def = worldDef(world);
  const levels = useMemo(() => LEVELS.filter((lv) => lv.stage === world), [world]);
  const lay = useMemo(() => layoutWorld(def, width, height, headerH, levels.length), [def, width, height, headerH, levels.length]);
  const { g } = lay;
  const cleared = (i: number) => (save.stars[levels[i].key] ?? 0) > 0;

  // Where the camera should rest: on the level you are up to.
  let focus = levels.findIndex((lv) => !((save.stars[lv.key] ?? 0) > 0));
  if (focus < 0) focus = levels.length - 1;
  const maxScroll = Math.max(0, g.H - height);
  const target = Math.max(0, Math.min(maxScroll, lay.nodes[focus].y - height * 0.62));

  const [flyover] = useState(() => !MAP_MEMORY.flown.has(world) && target > 200);
  const [fresh] = useState(() => (MAP_MEMORY.reached >= 0 && nextIndex > MAP_MEMORY.reached ? nextIndex : -1));

  const scrollY = useSharedValue(flyover ? 0 : target);
  const drive = useSharedValue(-1);
  const aref = useAnimatedRef<Animated.ScrollView>();
  useDerivedValue(() => {
    if (drive.value >= 0) {
      scrollTo(aref, 0, drive.value, false);
      scrollY.value = drive.value;
    }
  });
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
    onBeginDrag: () => {
      if (drive.value >= 0) { cancelAnimation(drive); drive.value = -1; }
    },
  });

  useEffect(() => {
    MAP_MEMORY.flown.add(world);
    MAP_MEMORY.reached = Math.max(MAP_MEMORY.reached, nextIndex);
    let id: ReturnType<typeof setTimeout> | undefined;
    if (fresh >= 0 && LEVELS[fresh].stage === world) id = setTimeout(() => playSfx('unlock'), 520);
    if (flyover) {
      drive.value = 0;
      drive.value = withDelay(450, withTiming(target, {
        duration: Math.min(2600, 1000 + target * 0.9), easing: Easing.inOut(Easing.cubic),
      }, () => { drive.value = -1; }));
    }
    return () => { if (id) clearTimeout(id); cancelAnimation(drive); };
    // The camera and celebration are decided once, when the world opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let walked = 0;
  while (walked < levels.length - 1 && cleared(walked)) walked++;

  return (
    <Animated.View entering={FadeIn.duration(360)} exiting={FadeOut.duration(220)} style={StyleSheet.absoluteFill}>
      <WorldBackdrop def={def} g={g} scrollY={scrollY} />
      <Animated.ScrollView
        ref={aref}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: g.H }}
        contentOffset={{ x: 0, y: flyover ? 0 : target }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <WorldTerrain def={def} g={g} />
        <WorldRoad def={def} lay={lay} walked={walked} />
        <WorldDecor def={def} lay={lay} world={world} />
        {levels.map((lv, i) => {
          const boss = i === levels.length - 1;
          const size = boss ? NODE * 1.22 : NODE;
          const open = lv.index === 0 || (save.stars[LEVELS[lv.index - 1].key] ?? 0) > 0;
          const state: NodeState = !open ? 'locked' : lv.index === nextIndex ? 'current' : cleared(i) ? 'done' : 'current';
          return (
            <View key={lv.key} style={{ position: 'absolute', left: lay.nodes[i].x - size / 2, top: lay.nodes[i].y - size / 2 }}>
              <MapNode n={lv.index + 1} state={state} stars={save.stars[lv.key] ?? 0} size={size} boss={boss}
                fresh={lv.index === fresh} onPress={() => onSelect(lv.index)} onLocked={() => onLocked(lv.index)} />
            </View>
          );
        })}
      </Animated.ScrollView>
      <WorldFront def={def} g={g} />
    </Animated.View>
  );
}

/**
 * The Adventure tab: a header (world arrows, coins, banner, progress) over one
 * world at a time. Tapping a level is handled by the parent, which opens the
 * level sheet above the tab bar.
 */
function AdventureScreen({ save, world, setWorld, onSelect, onCoins, onBack }: {
  save: Save; world: number; setWorld: (w: number) => void; onSelect: (levelIndex: number) => void; onCoins: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const t = useT();
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null);
  // Back on the left and coins on the right; the world's big sign hangs centred a little below them.
  const bannerW = Math.max(140, Math.min(210, winW * 0.5));
  const bannerDrop = 18;
  const rowH = bannerDrop + 62 * (bannerW / 200);
  const headerH = insets.top + 8 + rowH + 12;
  const nextIndex = useMemo(() => {
    for (let i = 0; i < LEVELS.length; i++) if (!(save.stars[LEVELS[i].key] > 0)) return i;
    return LEVELS.length - 1;
  }, [save.stars]);

  const onLocked = useCallback((i: number) => {
    setHint({ text: `${t('level')} ${i} — ${t('clearFirst')}`, id: Date.now() });
  }, [t]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <WorldView key={world} world={world} save={save} nextIndex={nextIndex} headerH={headerH}
        onSelect={onSelect} onLocked={onLocked} />

      <LinearGradient colors={gc('rgba(4,12,44,0.3)', 'rgba(4,12,44,0)')} pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: headerH + 24 }} />
      <LinearGradient colors={gc('rgba(4,12,44,0)', 'rgba(4,12,44,0.35)')} pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 120 }} />

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
        <View pointerEvents="box-none" style={{ height: rowH, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: bannerDrop, alignItems: 'center' }}>
            <MapBanner name={worldDef(world).name} width={bannerW} />
          </View>
          <IconBtn name="back" size={44} onPress={onBack} />
          <CoinBar coins={save.coins} onPlus={onCoins} u={0.78} />
        </View>
      </View>

      <View pointerEvents="none" style={{ position: 'absolute', left: 12, bottom: insets.bottom + 92 }}>
        <WorldMascot world={world} />
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 4, right: 4, top: '43%', flexDirection: 'row', justifyContent: 'space-between' }}>
        {world > 0 ? <WorldArrow dir="prev" label={worldDef(world - 1).name} onPress={() => setWorld(world - 1)} /> : <View />}
        {world < STAGES.length - 1 ? <WorldArrow dir="next" label={worldDef(world + 1).name} onPress={() => setWorld(world + 1)} /> : <View />}
      </View>
      {hint ? <Toast key={hint.id} text={hint.text} onDone={() => setHint(null)} /> : null}
    </View>
  );
}

/* ==========================================================================
 * 13. BOTTOM NAVIGATION  (three tabs, exactly as in the reference)
 * ========================================================================== */

type TabId = 'home' | 'adventure' | 'rewards';

/** Small full-colour tab pictures: a cottage, a folded map with a pin, and the treasure chest. */
function HomeArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Ellipse cx={20} cy={37.5} rx={14} ry={2.2} fill="#000000" opacity={0.25} />
      <Path d="M28 9 h5 v9 h-5 Z" fill="#C0501F" stroke="#7A2A0A" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={roundRect(8, 18, 24, 18, 3)} fill="#FFE7B0" stroke="#7A4A1E" strokeWidth={2} />
      <Path d="M2.5 21 L20 4.5 L37.5 21 Z" fill="#FF7A3A" stroke="#A0400F" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M8 17 L20 7 L32 17" fill="none" stroke="#FFB07A" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      <Path d={roundRect(17, 25, 7, 11, 2)} fill="#8A4B1E" stroke="#4A2A0E" strokeWidth={1.4} />
      <Circle cx={22.3} cy={31} r={0.9} fill="#FFD54A" />
    </Svg>
  );
}

function MapArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Ellipse cx={20} cy={37.5} rx={15} ry={2.2} fill="#000000" opacity={0.25} />
      <Path d="M3.5 11 L14 7 L26 11 L36.5 7 L36.5 31 L26 35 L14 31 L3.5 35 Z" fill="#FFE7A0" stroke="#8A5A20" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 7 L26 11 L26 35 L14 31 Z" fill="#F2CE7A" />
      <Path d="M8 27 Q12 21 17 26 T24 28" fill="none" stroke="#C0762A" strokeWidth={1.6} strokeDasharray="2.4 2.4" strokeLinecap="round" />
      <Path d="M27.5 27 C27.5 27 20.5 19.5 20.5 14.5 A7 7 0 0 1 34.5 14.5 C34.5 19.5 27.5 27 27.5 27 Z" fill="#FF4B5C" stroke="#A01A2A" strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={27.5} cy={14.5} r={2.7} fill="#FFFFFF" />
    </Svg>
  );
}

const TABS: { id: TabId; art: (size: number) => React.ReactNode; key: StringKey }[] = [
  { id: 'home', art: (n) => <HomeArt size={n} />, key: 'home' },
  { id: 'adventure', art: (n) => <MapArt size={n} />, key: 'adventure' },
  { id: 'rewards', art: (n) => <ChestArt size={n} />, key: 'rewards' },
];

function BottomNav({ tab, onTab, alert }: {
  tab: TabId; onTab: (t: TabId) => void; alert: Partial<Record<TabId, boolean>>;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View pointerEvents="box-none" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: insets.bottom + 8, paddingTop: 6, paddingHorizontal: 12,
    }}>
      <Panel radius={24} tint="rgba(14,32,104,0.72)" border="#4C6BD8" bw={2.5} style={{ flexDirection: 'row', padding: 6, gap: 4 }}>
        {TABS.map((item) => (
          <NavItem key={item.id} art={item.art} label={t(item.key)}
            active={tab === item.id} alert={Boolean(alert[item.id])}
            onPress={() => { haptic.select(); playSfx('swipe'); onTab(item.id); }} />
        ))}
      </Panel>
    </View>
  );
}

function NavItem({ art, label, active, alert, onPress }: {
  art: (size: number) => React.ReactNode; label: string; active: boolean; alert: boolean; onPress: () => void;
}) {
  const v = useSharedValue(active ? 1 : 0);
  useEffect(() => { v.value = withSpring(active ? 1 : 0, { damping: 15, stiffness: 220 }); }, [active, v]);
  const fill = useAnimatedStyle(() => ({ opacity: v.value }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.14 }, { translateY: -v.value * 2 }] }));
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingTop: 5, paddingBottom: 5, borderRadius: 18 }}>
        <Animated.View pointerEvents="none" style={[{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, overflow: 'hidden', zIndex: 0,
          borderWidth: 2.5, borderColor: '#C77C00',
        }, fill]}>
          <LinearGradient colors={gc('#FFEA8A', '#FFCB33', '#F5A80E')} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '46%', backgroundColor: 'rgba(255,255,255,0.35)' }} />
        </Animated.View>
        <View style={{ zIndex: 1, alignItems: 'center' }}>
          <Animated.View style={[{ height: 34, alignItems: 'center', justifyContent: 'center' }, icon]}>
            {art(32)}
            {alert ? (
              <View style={{
                position: 'absolute', top: -2, right: -8, width: 13, height: 13,
                borderRadius: 7, backgroundColor: '#FF3B55', borderWidth: 2, borderColor: '#0D1E62',
              }} />
            ) : null}
          </Animated.View>
          <Text style={active
            ? { color: '#5A2E00', fontSize: 13, marginTop: 1, includeFontPadding: false }
            : { color: '#FFFFFF', fontSize: 13, marginTop: 1, includeFontPadding: false, textShadowColor: 'rgba(6,14,60,0.95)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 1 }}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* ==========================================================================
 * 11. REWARDS, TREASURE CHEST, SETTINGS, HOW TO PLAY
 * ========================================================================== */

/** A wrapped present with a gold bow, for the daily reward. */
function GiftArt({ size }: { size: number }) {
  const uid = useUid('gf');
  const rd = `url(#${uid}rd)`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <SvgLinear id={`${uid}yl`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD54A" />
          <Stop offset="1" stopColor="#FA9E12" />
        </SvgLinear>
        <SvgLinear id={`${uid}yr`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F9AE22" />
          <Stop offset="1" stopColor="#E5850A" />
        </SvgLinear>
        <SvgLinear id={`${uid}rd`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF5450" />
          <Stop offset="1" stopColor="#D9202A" />
        </SvgLinear>
      </Defs>
      <Ellipse cx={32} cy={61} rx={22} ry={2.6} fill="#000000" opacity={0.28} />
      {/* the box, seen from a corner */}
      <Path d="M9 29 L33 33 L33 59 L11 55 Z" fill={`url(#${uid}yl)`} />
      <Path d="M33 33 L56 28 L54 53 L33 59 Z" fill={`url(#${uid}yr)`} />
      <Path d="M19 30.5 L27 32 L27 58 L20 56.5 Z" fill={rd} />
      <Path d="M45 31 L50 30 L49.5 54 L45 55.5 Z" fill="#D9202A" />
      {/* the lid */}
      <Path d="M5 23 L33 29 L33 35 L6 29.5 Z" fill="#FFB52A" />
      <Path d="M33 29 L59 22 L57 28 L33 35 Z" fill="#F0A020" />
      <Path d="M5 23 L31 18 L59 22 L33 29 Z" fill="#FFD24D" />
      <Path d="M19 26 L27 27.5 L27 34 L20 32.5 Z" fill={rd} />
      <Path d="M45.5 24.5 L51 23.5 L50.5 29 L45.5 30 Z" fill="#D9202A" />
      <Path d="M27 27.5 L33 28.6 L44 24 L38 22.6 Z" fill="#F03A3E" />
      {/* the bow */}
      <Path d="M31 19 C22 18 12 14 15 8 C19 3 29 9 32 17" fill="none" stroke="#A8141E" strokeWidth={5.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M33 19 C42 18 52 14 49 8 C45 3 35 9 32 17" fill="none" stroke="#A8141E" strokeWidth={5.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M31 19 C22 18 12 14 15 8 C19 3 29 9 32 17" fill="none" stroke={rd} strokeWidth={3.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M33 19 C42 18 52 14 49 8 C45 3 35 9 32 17" fill="none" stroke={rd} strokeWidth={3.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={32} cy={18.5} r={3.6} fill="#FFC23A" stroke="#D98200" strokeWidth={1} />
    </Svg>
  );
}

/** Slowly turning shafts of light, fading out toward the edge. */
function SunRays({ size, color = '#FFF0A0', opacity = 0.36, period = 24000 }: {
  size: number; color?: string; opacity?: number; period?: number;
}) {
  const uid = useUid('sr');
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [spin, period]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', zIndex: -1, width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="-50 -50 100 100">
        <Defs>
          <SvgRadial id={uid} cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgRadial>
        </Defs>
        {Array.from({ length: 12 }, (_, i) => {
          const a0 = (i / 12) * Math.PI * 2;
          const a1 = a0 + Math.PI / 12;
          return (
            <Path key={i} fill={`url(#${uid})`}
              d={`M0 0 L${q2(Math.cos(a0) * 50)} ${q2(Math.sin(a0) * 50)} L${q2(Math.cos(a1) * 50)} ${q2(Math.sin(a1) * 50)} Z`} />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/** The treasure chest, drawn from a corner: a purple barrel-lidded chest in a thick orange-gold frame
 *  (arched bands over the lid, a band across the middle with a big star, corner posts, rivets). */
function ChestArt({ size }: { size: number; glow?: boolean }) {
  const uid = useUid('ch');
  const u = (n: string) => `url(#${uid}${n})`;
  const EDGE = '#C46A00';
  return (
    <Svg width={size} height={size * (108 / 118)} viewBox="0 0 118 108">
      <Defs>
        <SvgLinear id={`${uid}pf`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B82FD6" />
          <Stop offset="1" stopColor="#7C1AAE" />
        </SvgLinear>
        <SvgLinear id={`${uid}ps`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8A24B8" />
          <Stop offset="1" stopColor="#561088" />
        </SvgLinear>
        <SvgLinear id={`${uid}pl`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E060F0" />
          <Stop offset="1" stopColor="#B032D2" />
        </SvgLinear>
        <SvgLinear id={`${uid}gd`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFCB3C" />
          <Stop offset="0.5" stopColor="#FFA71A" />
          <Stop offset="1" stopColor="#F58500" />
        </SvgLinear>
        <SvgLinear id={`${uid}gs`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFB224" />
          <Stop offset="1" stopColor="#DE7600" />
        </SvgLinear>
        <SvgLinear id={`${uid}sg`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE46A" />
          <Stop offset="1" stopColor="#FFB81E" />
        </SvgLinear>
      </Defs>
      <Ellipse cx={58} cy={101} rx={52} ry={5} fill="#000000" opacity={0.3} />

      {/* the purple: side, front, lid */}
      <Path d="M72 50 L106 42 L106 82 L72 96 Z" fill={u('ps')} />
      <Path d="M6 41 L72 50 L72 96 L6 84 Z" fill={u('pf')} />
      <Path d="M6 41 C5 17 22 5 48 5 L90 9 C72 15 68 32 72 50 Z" fill={u('pl')} />
      <Path d="M72 50 C68 32 72 15 90 9 C104 13 107 28 106 42 Z" fill={u('ps')} />
      <Path d="M30 20 Q40 10 62 12" stroke="#F6A6F8" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.55} />
      <Ellipse cx={60} cy={19} rx={9} ry={4} fill="#FF7E8A" opacity={0.4} transform="rotate(8 60 19)" />

      {/* the two gold arches over the lid */}
      <Path d="M8 45 C6 22 22 6 52 5" fill="none" stroke={EDGE} strokeWidth={12.5} />
      <Path d="M8 45 C6 22 22 6 52 5" fill="none" stroke={u('gd')} strokeWidth={10.5} />
      <Path d="M5.5 44 C4 24 18 9 46 6.5" fill="none" stroke="#FFF0A8" strokeWidth={2} opacity={0.75} />
      <Path d="M73 51 C66 31 72 11 94 9 C106 13 108 28 107 43" fill="none" stroke={EDGE} strokeWidth={12.5} />
      <Path d="M73 51 C66 31 72 11 94 9 C106 13 108 28 107 43" fill="none" stroke={u('gd')} strokeWidth={10.5} />
      <Path d="M70 49 C64 32 69 13 92 6.5" fill="none" stroke="#FFF0A8" strokeWidth={2} opacity={0.75} />

      {/* the band across the middle, the posts and the bottom frame */}
      <Path d="M-1 39 L72 48.5 L72 63 L-1 53 Z" fill={u('gd')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M72 48.5 L109 40 L109 54 L72 63 Z" fill={u('gs')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M1 41 L71 50" stroke="#FFF0A8" strokeWidth={1.8} opacity={0.8} strokeLinecap="round" />
      <Path d="M-1 53 L10 54.5 L10 88 L-1 86 Z" fill={u('gd')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M-1 82 L72 96 L72 106 L1 92 Z" fill={u('gs')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M72 96 L108 81 L106 91 L72 106 Z" fill={u('gs')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M64 62 L79 60 L79 106 L64 104 Z" fill={u('gd')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d="M100 55 L109 53.5 L107 91 L100 93 Z" fill={u('gs')} stroke={EDGE} strokeWidth={0.9} strokeLinejoin="round" />
      {[[6, 45, 1.7], [68, 55, 1.7], [103, 47, 1.7], [5, 58, 1.5], [104, 60, 1.5], [71, 99, 1.5]].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFE98A" stroke="#B36000" strokeWidth={0.6} />
      ))}

      {/* the big star */}
      <Path d={starPath(37, 46.5, 17.5, 8.2)} fill="#000000" opacity={0.28} transform="translate(0,1.8)" />
      <Path d={starPath(37, 46.5, 17.5, 8.2)} fill={u('sg')} stroke="#D98200" strokeWidth={1.5} strokeLinejoin="round" />
      <Path d={starPath(35.5, 44.5, 8, 3.6)} fill="#FFF6C0" opacity={0.7} />
    </Svg>
  );
}

/** A little stack of coins, for the daily-reward cards. */
function CoinStack({ size, n = 4 }: { size: number; n?: number }) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 60 48">
      {[[30, 34], [18, 30], [42, 30], [30, 22]].slice(0, n).map(([x, y], i) => (
        <G key={i}>
          <Ellipse cx={x} cy={y + 4} rx={14} ry={6} fill="#B87800" />
          <Path d={`M${x - 14} ${y} v4 a14 6 0 0 0 28 0 v-4 Z`} fill="#E09400" />
          <Ellipse cx={x} cy={y} rx={14} ry={6} fill="#FFD24D" />
          <Ellipse cx={x} cy={y} rx={9} ry={3.6} fill="#FFE98A" />
        </G>
      ))}
    </Svg>
  );
}

/** A treasure chest thrown open and heaped with gold, with a few coins spilled in front. */
function OpenChestArt({ size }: { size: number }) {
  const uid = useUid('oc');
  const u = (n: string) => `url(#${uid}${n})`;
  const EDGE = '#B36000';
  const coin = (x: number, y: number, r: number, k: string) => (
    <G key={k}>
      <Ellipse cx={x} cy={y + 1.8} rx={r} ry={r * 0.5} fill="#B87800" />
      <Ellipse cx={x} cy={y} rx={r} ry={r * 0.5} fill="#FFD24D" stroke="#D98200" strokeWidth={0.9} />
      <Ellipse cx={x} cy={y} rx={r * 0.62} ry={r * 0.3} fill="#FFEC96" />
    </G>
  );
  return (
    <Svg width={size} height={size * (104 / 120)} viewBox="0 0 120 104">
      <Defs>
        <SvgLinear id={`${uid}pf`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B82FD6" />
          <Stop offset="1" stopColor="#7C1AAE" />
        </SvgLinear>
        <SvgLinear id={`${uid}gd`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFDA5A" />
          <Stop offset="1" stopColor="#F59A0C" />
        </SvgLinear>
        <SvgLinear id={`${uid}hp`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE46A" />
          <Stop offset="1" stopColor="#F5A50E" />
        </SvgLinear>
      </Defs>
      <Ellipse cx={60} cy={98} rx={54} ry={5} fill="#000000" opacity={0.28} />

      {/* the lid, swung back */}
      <Path d="M17 54 L23 17 Q60 3 97 17 L103 54 Z" fill="#4A0E78" />
      <Path d="M27 50 L31 24 Q60 13 89 24 L93 50 Z" fill="#6E1C9E" />
      <Path d="M17 54 L23 17 Q60 3 97 17 L103 54" fill="none" stroke={EDGE} strokeWidth={9} strokeLinejoin="round" />
      <Path d="M17 54 L23 17 Q60 3 97 17 L103 54" fill="none" stroke={u('gd')} strokeWidth={6.6} strokeLinejoin="round" />
      <Path d="M27 20 Q60 8 93 20" fill="none" stroke="#FFF0A8" strokeWidth={1.6} opacity={0.75} strokeLinecap="round" />

      {/* the heap of gold */}
      <Path d="M16 56 Q22 30 60 25 Q98 30 104 56 Z" fill={u('hp')} />
      {[[38, 34, 10], [62, 28, 10], [84, 35, 10], [50, 43, 10], [74, 44, 10], [28, 48, 9], [94, 48, 9], [61, 51, 10]].map(([x, y, r], i) => coin(x, y, r, `h${i}`))}

      {/* the body */}
      <Path d={roundRect(12, 52, 96, 42, 9)} fill={u('pf')} stroke="#4E0F7A" strokeWidth={2} />
      <Path d="M20 60 Q60 54 100 60" fill="none" stroke="#F6A6F8" strokeWidth={2.4} opacity={0.5} strokeLinecap="round" />
      <Path d={roundRect(8, 49, 104, 11, 4)} fill={u('gd')} stroke={EDGE} strokeWidth={1} />
      <Path d={roundRect(23, 58, 13, 36, 3)} fill={u('gd')} stroke={EDGE} strokeWidth={1} />
      <Path d={roundRect(84, 58, 13, 36, 3)} fill={u('gd')} stroke={EDGE} strokeWidth={1} />
      <Path d={roundRect(9, 86, 102, 9, 3)} fill={u('gd')} stroke={EDGE} strokeWidth={1} />
      <Path d={roundRect(52, 60, 16, 17, 4)} fill={u('gd')} stroke={EDGE} strokeWidth={1} />
      <Circle cx={60} cy={67} r={2.6} fill="#6E3A00" />
      <Path d="M60 68 L60 73" stroke="#6E3A00" strokeWidth={2.2} strokeLinecap="round" />
      {[[16, 54], [104, 54], [16, 90], [104, 90]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.6} fill="#FFE98A" stroke="#B36000" strokeWidth={0.6} />
      ))}

      {/* spilled coins */}
      {coin(108, 94, 8, 's1')}
      {coin(117, 99, 6.5, 's2')}
      {coin(9, 97, 7, 's3')}
    </Svg>
  );
}

/** The corner scene that hangs off the bottom of the daily card: the mascot and a heaped chest on grass. */
function RewardScene({ width, onChest }: { width: number; onChest: () => void }) {
  const uid = useUid('rs');
  const t = useT();
  const bob = useLoop(2000);
  const mascot = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 6 }] }));
  const H = 104;
  return (
    <View pointerEvents="box-none" style={{ width, height: H }}>
      <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#86D65A" />
            <Stop offset="1" stopColor="#3E9E36" />
          </SvgLinear>
        </Defs>
        <Path d={`M0 ${H} L0 84 Q${width * 0.2} 70 ${width * 0.42} 80 T${width * 0.75} 78 T${width} 82 L${width} ${H} Z`} fill="#2E7A2A" transform="translate(0,3)" />
        <Path d={`M0 ${H} L0 84 Q${width * 0.2} 70 ${width * 0.42} 80 T${width * 0.75} 78 T${width} 82 L${width} ${H} Z`} fill={`url(#${uid}g)`} />
        <Path d={`M8 86 Q${width * 0.2} 76 ${width * 0.42} 84`} stroke="#C4F29A" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 14, bottom: 14 }, mascot]}>
        <MascotBlock size={72} color={2} mood="happy" />
      </Animated.View>
      <View style={{ position: 'absolute', left: 92, bottom: 6 }}><CoinStack size={40} n={3} /></View>
      <View style={{ position: 'absolute', left: 122, bottom: 2 }}><CoinStack size={30} n={2} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('treasureChest')} hitSlop={6}
        onPress={() => { tapFx(); onChest(); }} style={{ position: 'absolute', right: 6, bottom: 6 }}>
        <OpenChestArt size={120} />
      </Pressable>
      <Sparkle x={width - 88} y={20} size={7} delay={0} color="#FFE58A" u={1} />
      <Sparkle x={width - 26} y={34} size={6} delay={500} color="#FFFFFF" u={1} />
      <Sparkle x={width - 58} y={8} size={5} delay={900} color="#FFFFFF" u={1} />
      <Sparkle x={104} y={28} size={5} delay={300} color="#FFE58A" u={1} />
    </View>
  );
}

const DAY_TONE = {
  claimed: { edge: '#2E8A3A', head: gc('#7DDB70', '#46B244'), body: gc('#EDFAD8', '#CDF0A4'), headInk: '#FFFFFF', ink: '#2C6A22' },
  ready: { edge: '#D98200', head: gc('#FFE682', '#FFC72E'), body: gc('#FFFAE0', '#FFEEAA'), headInk: '#6A3A00', ink: '#6A3A00' },
  locked: { edge: '#B98A4A', head: gc('#EFD196', '#D9AA5E'), body: gc('#FFF6DC', '#F6E3B2'), headInk: '#6B4220', ink: '#6B4220' },
} as const;

/** One day of the ladder: a "Day N" tab over a cream card holding the prize. `wide` lays the card out flat, for day 7. */
function DayCard({ day, prize, state, width, wide, onPress }: {
  day: number; prize: { coins: number; power?: PowerId }; state: 'claimed' | 'ready' | 'locked';
  width: number; wide?: boolean; onPress: () => void;
}) {
  const t = useT();
  const pulse = useLoop(900);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: state === 'ready' ? 1 + pulse.value * 0.045 : 1 }] }));
  const tone = DAY_TONE[state];
  const power = prize.power ? POWER_BY_ID[prize.power] : null;
  const art = power
    ? <ChestArt size={wide ? 58 : 50} />
    : <CoinStack size={52} n={prize.coins < 75 ? 2 : prize.coins < 150 ? 3 : 4} />;
  return (
    <AnimPressable style={[{ width }, aStyle]} disabled={state !== 'ready'} onPress={onPress}>
      {state === 'ready' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
          {[0.35, 0.7, 1].map((k, i) => (
            <View key={i} style={{
              position: 'absolute', top: -10 * k, left: -10 * k, right: -10 * k, bottom: -10 * k,
              borderRadius: 15 + 10 * k, backgroundColor: '#FFF27A', opacity: 0.32 * (1 - k * 0.55),
            }} />
          ))}
        </View>
      ) : null}
      <View style={{ borderRadius: 15, backgroundColor: tone.edge, paddingBottom: 3 }}>
        <View style={{ borderRadius: 13, overflow: 'hidden', borderWidth: 2, borderColor: tone.edge }}>
          <LinearGradient colors={tone.head} style={{ paddingVertical: 3, alignItems: 'center' }}>
            <Text style={{ color: tone.headInk, fontSize: 13.5, includeFontPadding: false }}>{t('dayWord')} {day}</Text>
          </LinearGradient>
          <LinearGradient colors={tone.body} style={{
            alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4,
            minHeight: wide ? 66 : 86, flexDirection: wide ? 'row' : 'column', gap: wide ? 16 : 0,
          }}>
            <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>{art}</View>
            <View style={{ alignItems: wide ? 'flex-start' : 'center', marginTop: wide ? 0 : 5 }}>
              <Text numberOfLines={1} style={{ color: tone.ink, fontSize: wide ? 19 : 13.5, includeFontPadding: false }}>
                {prize.coins} {t('coinsWord')}
              </Text>
              {power ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <Icon name={power.id as IconName} size={wide ? 15 : 12} color="#2E9A3A" />
                  <Text numberOfLines={1} style={{ color: '#2E9A3A', fontSize: wide ? 13 : 10.5, includeFontPadding: false }}>+1 {power.name}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>
      </View>
      {state === 'claimed' ? (
        <View style={{
          position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
          backgroundColor: '#35C24F', borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="check" size={13} color="#FFFFFF" />
        </View>
      ) : null}
    </AnimPressable>
  );
}

/** The big green pill under the ladder: a gift on the left, the label in the middle. Greys out until tomorrow. */
function ClaimButton({ label, ready, onPress, style }: {
  label: string; ready: boolean; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  const press = useSharedValue(0);
  const pulse = useLoop(1100);
  const H = 62;
  const tone: CandyName = ready ? 'green' : 'slate';
  const aStyle = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0.7,
    transform: [{ translateY: press.value * 3 }, { scale: ready ? 1 + pulse.value * 0.025 : 1 }],
  }));
  return (
    <AnimPressable
      accessibilityRole="button" accessibilityLabel={label} disabled={!ready}
      style={[aStyle, style]}
      onPressIn={() => { press.value = withTiming(1, { duration: 70 }); tapFx(); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 140 }); }}
      onPress={onPress}
    >
      <View style={{ height: H, paddingBottom: Math.round(H * 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Candy tone={tone} height={H} radius={H / 2} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, top: 0, bottom: Math.round(H * 0.1), justifyContent: 'center', zIndex: 1 }}>
          {ready ? <GiftArt size={42} /> : <Icon name="check" size={26} color="#FFFFFF" />}
        </View>
        <View style={{ zIndex: 1, paddingLeft: 30 }}>
          <OutlineText size={label.length > 14 ? 18 : 23} ink={CANDY[tone].ink}>{label}</OutlineText>
        </View>
      </View>
    </AnimPressable>
  );
}

/** The whole Daily Rewards panel: wooden frame on a leafy board, six day cards and a wide day 7, the claim pill, and the mascot with a chest of gold. */
function DailyRewardsBoard({ width, claimedCount, nextDay, ready, onClaim, onClose, onChest }: {
  width: number; claimedCount: number; nextDay: number; ready: boolean;
  onClaim: () => void; onClose: () => void; onChest: () => void;
}) {
  const t = useT();
  const gap = 8;
  const w3 = (width - 56 - gap * 2) / 3;
  const stateOf = (i: number): 'claimed' | 'ready' | 'locked' =>
    i < claimedCount ? 'claimed' : i === nextDay && ready ? 'ready' : 'locked';
  const words = t('dailyRewards').split(' ');
  const top = words.slice(0, -1).join(' ');
  const bottom = words[words.length - 1];
  const fit = (s: string, max: number, room: number) => Math.max(16, Math.min(max, Math.floor(room / (s.length * 0.52))));
  const room = width * 0.62 - 26;
  return (
    <ParchmentCard
      cardWidth={width} plankH={82} plankRatio={0.62} inner={LEAF_BOARD}
      onClose={onClose} footer={<RewardScene width={width} onChest={onChest} />} footerDrop={30}
      lines={[
        { text: top, size: fit(top, 22, room), fill: '#FFF6E4', hi: '#FFFFFF', outline: '#3A1E08' },
        { text: bottom, size: fit(bottom, 30, room), fill: '#FFC72E', hi: '#FFF08A', outline: '#5A2A00' },
      ]}
    >
      <View style={{
        borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: 'rgba(40,96,20,0.34)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)',
      }}>
        <Text style={{ color: '#FFF8DC', fontSize: 13, textAlign: 'center', textShadowColor: 'rgba(30,70,10,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>
          {t('dailySub')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: 14 }}>
        {[0, 1, 2].map((i) => <DayCard key={i} day={i + 1} prize={DAILY[i]} state={stateOf(i)} width={w3} onPress={onClaim} />)}
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: 12 }}>
        {[3, 4, 5].map((i) => <DayCard key={i} day={i + 1} prize={DAILY[i]} state={stateOf(i)} width={w3} onPress={onClaim} />)}
      </View>
      <View style={{ marginTop: 12 }}>
        <DayCard day={7} prize={DAILY[6]} state={stateOf(6)} width={width - 56} wide onPress={onClaim} />
      </View>
      <ClaimButton label={ready ? t('claimReward') : t('comeBack')} ready={ready} onPress={onClaim} style={{ marginTop: 14 }} />
      <View style={{ height: 62 }} />
    </ParchmentCard>
  );
}

/** The Rewards tab: just the daily board, sized to fit the space above the nav bar (no scrolling). */
function RewardsScreen({ save, onClaimDaily, onCoins, onChest, onClose }: {
  save: Save;
  onClose: () => void;
  onClaimDaily: () => void;
  onCoins: () => void;
  onChest: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = useT();
  const ready = dailyReady(save);
  const wrapped = save.dailyDay >= 7;
  const claimedCount = wrapped && ready ? 0 : save.dailyDay;
  const nextDay = wrapped ? 0 : save.dailyDay;
  const boardW = Math.min(370, width - 32);

  // The board has a natural height; measure it and the room we have, and shrink it to fit if it must.
  const [roomH, setRoomH] = useState(0);
  const [natH, setNatH] = useState(0);
  const k = roomH > 0 && natH > 0 ? Math.min(1, roomH / natH) : 1;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 26, flex: 1, letterSpacing: 0.6 }}>{t('rewards').toUpperCase()}</Text>
        <CoinPill coins={save.coins} onPlus={onCoins} />
      </View>
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e: LayoutChangeEvent) => setRoomH(e.nativeEvent.layout.height)}
      >
        <View style={{ width: boardW * k, height: natH * k, opacity: natH > 0 ? 1 : 0 }}>
          <View
            onLayout={(e: LayoutChangeEvent) => setNatH(e.nativeEvent.layout.height)}
            style={{ position: 'absolute', left: 0, top: 0, width: boardW, paddingBottom: 32, transform: [{ scale: k }], transformOrigin: 'left top' }}
          >
            <DailyRewardsBoard width={boardW} claimedCount={claimedCount} nextDay={nextDay} ready={ready}
              onClaim={onClaimDaily} onClose={onClose} onChest={onChest} />
          </View>
        </View>
      </View>
    </View>
  );
}

/* --- treasure chest page ---------------------------------------------------- */

/** One of the five key slots on the chest screen: a lit gold key, or an empty socket. */
function KeySlot({ filled }: { filled: boolean }) {
  return (
    <View style={{
      width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
      backgroundColor: filled ? 'rgba(255,210,77,0.22)' : 'rgba(255,255,255,0.06)',
      borderColor: filled ? '#FFD24D' : 'rgba(255,255,255,0.25)', borderStyle: filled ? 'solid' : 'dashed',
    }}>
      <View style={{ opacity: filled ? 1 : 0.28 }}>
        <KeyGlyph size={34} />
      </View>
    </View>
  );
}

function ChestScreen({ save, onClose, onOpen, onRewards }: {
  save: Save; onClose: () => void; onOpen: () => void; onRewards: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const t = useT();
  const [info, setInfo] = useState(false);
  const keys = Math.min(save.chest, CHEST_GOAL);
  const full = keys >= CHEST_GOAL;
  const pulse = useLoop(1800);
  const bob = useLoop(2400);
  const glow = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.5, transform: [{ scale: 0.92 + pulse.value * 0.12 }] }));
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.value - 0.5) * 12 }] }));
  const sparks = useMemo(() => {
    const r = seeded(31337);
    return Array.from({ length: 50 }, () => ({ x: r() * width, y: r() * height, s: 0.6 + r() * 1.8, o: 0.2 + r() * 0.6 }));
  }, [width, height]);
  const chestSize = Math.min(width * 0.72, 300);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 3500 }]}>
      <LinearGradient colors={gc('#2A1A88', '#1A1268', '#0A0838')} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {sparks.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={p.s} fill="#FFE9A8" opacity={p.o} />)}
      </Svg>

      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <IconBtn name="back" onPress={onClose} size={42} />
        <Text style={{
          flex: 1, textAlign: 'center', color: '#FFD84D', fontSize: 25, letterSpacing: 1,
          textShadowColor: 'rgba(80,30,0,0.8)', textShadowOffset: { width: 0, height: 2.5 }, textShadowRadius: 0,
        }}>
          {t('treasureChest').toUpperCase()}
        </Text>
        <IconBtn name="info" onPress={() => setInfo((v) => !v)} size={42} />
      </View>
      {info ? (
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Panel radius={14} style={{ padding: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>{t('chestInfo')}</Text>
          </Panel>
        </View>
      ) : null}

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <SunRays size={chestSize * 2.3} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: chestSize * 1.7, height: chestSize * 1.7 }, glow]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <SvgRadial id="chestHalo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#FFD84D" stopOpacity={0.62} />
                <Stop offset="0.45" stopColor="#FFB43C" stopOpacity={0.22} />
                <Stop offset="1" stopColor="#FFB43C" stopOpacity={0} />
              </SvgRadial>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#chestHalo)" />
          </Svg>
        </Animated.View>
        <Animated.View style={float}><ChestArt size={chestSize} glow /></Animated.View>
        <Sparkle x={width * 0.2} y={height * 0.3} size={7} delay={0} color="#FFE58A" u={1} />
        <Sparkle x={width * 0.82} y={height * 0.26} size={6} delay={500} color="#FFFFFF" u={1} />
        <Sparkle x={width * 0.12} y={height * 0.5} size={5} delay={900} color="#FFFFFF" u={1} />
        <Sparkle x={width * 0.88} y={height * 0.5} size={6} delay={300} color="#FFE58A" u={1} />
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 26 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, textAlign: 'center', marginBottom: 14 }}>{t('collectKeys')}</Text>
        <Panel radius={18} style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {Array.from({ length: CHEST_GOAL }, (_, i) => <KeySlot key={i} filled={i < keys} />)}
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginTop: 10 }}>{keys}/{CHEST_GOAL}</Text>
        </Panel>
        <Btn label={full ? t('openChest') : t('viewRewards')} icon={full ? 'chest' : 'gift'} tone="gold" big
          onPress={full ? onOpen : onRewards} style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}

/* --- settings --------------------------------------------------------------- */

const SETTING_INK = '#6B4220';

/** A round, glossy colour chip holding a white icon: pink music, blue sound, purple vibration... */
function IconChip({ icon, tones }: { icon: IconName; tones: readonly [string, string] }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={gc(tones[0], tones[1])} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 13, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      <Icon name={icon} size={19} color="#FFFFFF" />
    </View>
  );
}

const CHIP_TONES = {
  pink: ['#FF8AC0', '#E0388A'],
  blue: ['#6CB8FF', '#2A6EE0'],
  purple: ['#C08CFF', '#7A3AD0'],
  teal: ['#5ADCEA', '#1E9DB0'],
  gold: ['#FFDE55', '#F0A020'],
} as const;

/** A cream row in the settings card: a colour chip, a label and whatever sits on the right. */
function SettingRow({ icon, tones, label, right, onPress, children }: {
  icon: IconName; tones: readonly [string, string]; label: string; right?: React.ReactNode; onPress?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <View style={{ borderRadius: 15, backgroundColor: '#E2C07C', paddingBottom: 2.5 }}>
      <View style={{ borderRadius: 13, backgroundColor: '#FFF8E2', borderWidth: 1.5, borderColor: '#EBD198', paddingHorizontal: 12, paddingVertical: 8, minHeight: 50, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip icon={icon} tones={tones} />
          <Text numberOfLines={1} style={{ color: SETTING_INK, fontSize: 16, flex: 1, includeFontPadding: false }}>{label}</Text>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={() => { tapFx(); onPress(); }}>{body}</Pressable> : body;
}

/** A red cube with a star on it, one of the trio that sits above the Settings plank. */
function StarCube({ size }: { size: number }) {
  const uid = useUid('sc');
  const b = BRICKS[0];
  return (
    <Svg width={size} height={size * 1.12} viewBox="0 0 100 112">
      <Defs>
        <SvgLinear id={`${uid}f`} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={b.lo} />
          <Stop offset="0.5" stopColor={b.mid} />
          <Stop offset="1" stopColor={b.mid} />
        </SvgLinear>
      </Defs>
      <Path d={roundRect(4, 12, 92, 92, 24)} fill={b.dark} />
      <Path d={roundRect(4, 4, 92, 88, 24)} fill={`url(#${uid}f)`} />
      <Path d={roundRect(4, 4, 92, 88, 24)} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2} />
      <Path d={roundRect(11, 8, 50, 15, 7.5)} fill="#FFFFFF" fillOpacity={0.42} />
      <Path d={starPath(50, 50, 28, 12)} fill="#FF9FA0" stroke="#B5231D" strokeWidth={3} strokeLinejoin="round" />
      <Path d={starPath(45, 43, 11, 5)} fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
}

/** Red star cube, smiling yellow cube and blue cube, peeking over the plank. */
function CubeTrio() {
  const bob = useLoop(2200);
  const mid = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 4 }] }));
  return (
    <View style={{ width: 210, height: 72 }}>
      <View style={{ position: 'absolute', left: 8, top: 20, transform: [{ rotate: '-9deg' }] }}><StarCube size={44} /></View>
      <View style={{ position: 'absolute', right: 8, top: 20, transform: [{ rotate: '9deg' }] }}><MascotBlock size={44} color={5} mood="happy" /></View>
      <Animated.View style={[{ position: 'absolute', left: 71, top: 0 }, mid]}><MascotBlock size={68} color={2} mood="happy" /></Animated.View>
    </View>
  );
}

const RATE_URL = 'market://details?id=com.blockadventure.puzzle';
const RATE_WEB = 'https://play.google.com/store/apps/details?id=com.blockadventure.puzzle';

function SettingsCard({ save, setSetting, onClose, onReset, onHelp }: {
  save: Save; setSetting: SetSetting;
  onClose: () => void; onReset: () => void; onHelp: () => void;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const langIdx = LANGS.findIndex((l) => l.id === save.settings.lang);
  const lang = LANGS[Math.max(0, langIdx)];

  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(id);
  }, [confirm]);

  const chevron = <Icon name="next" size={18} color="#8A6A3A" />;

  const rate = async () => {
    try { await Linking.openURL(RATE_URL); return; } catch { /* fall through to the web page */ }
    try { await Linking.openURL(RATE_WEB); } catch { setNote(t('notOnStore')); }
  };

  return (
    <ModalCard plain maxWidth={340} onClose={onClose}>
      <ParchmentCard
        onClose={onClose} plankTop={62} plankH={56} topSlot={<CubeTrio />}
        lines={[{ text: titleCase(t('settings')), size: 30, fill: '#FFF6E4', hi: '#FFFFFF', outline: '#3A1E08' }]}
      >
      <View style={{ alignSelf: 'stretch', gap: 9 }}>
        <SettingRow icon="music" tones={CHIP_TONES.pink} label={t('music')}
          right={<Toggle light on={save.settings.music} onPress={() => setSetting('music', !save.settings.music)} />} />
        <SettingRow icon="sound" tones={CHIP_TONES.blue} label={t('soundEffects')}
          right={<Toggle light on={save.settings.sound} onPress={() => setSetting('sound', !save.settings.sound)} />} />
        <SettingRow icon="vibrate" tones={CHIP_TONES.purple} label={t('haptics')}
          right={<Toggle light on={save.settings.haptics} onPress={() => setSetting('haptics', !save.settings.haptics)} />} />
        <SettingRow icon="globe" tones={CHIP_TONES.teal} label={t('language')}
          right={<>
            <Text style={{ color: '#8A6A3A', fontSize: 14, includeFontPadding: false }}>{lang.label}</Text>
            {chevron}
          </>}
          onPress={() => setSetting('lang', LANGS[(Math.max(0, langIdx) + 1) % LANGS.length].id)} />
        <SettingRow icon="help" tones={CHIP_TONES.blue} label={t('help')} right={chevron} onPress={onHelp} />
        <SettingRow icon="star" tones={CHIP_TONES.gold} label={t('rateUs')} right={chevron} onPress={rate} />
      </View>
      {note ? <Text style={{ color: SETTING_INK, fontSize: 11.5, marginTop: 10, textAlign: 'center' }}>{note}</Text> : null}
      <Btn label={confirm ? t('confirmReset') : titleCase(t('resetRow'))} icon="replay" tone="danger" big
        onPress={() => { if (confirm) { setConfirm(false); onReset(); } else setConfirm(true); }}
        style={{ marginTop: 16 }} />
      <Text style={{ color: '#8A6A3A', fontSize: 11, textAlign: 'center', marginTop: 4 }}>{t('resetNote')}</Text>
      </ParchmentCard>
    </ModalCard>
  );
}

/* --- how to play ------------------------------------------------------------ */

/** A tiny grid of cells for the how-to illustrations. */
function MiniBoard({ cols, rows, filled = [], piece, burst }: {
  cols: number; rows: number; filled?: [number, number, number][];
  piece?: { cells: [number, number][]; color: number; dx: number; dy: number }; burst?: boolean;
}) {
  const s = 15;
  const W = cols * s;
  const H = rows * s;
  return (
    <Svg width={W + 4} height={H + 4} viewBox={`-2 -2 ${W + 4} ${H + 4}`}>
      <Path d={roundRect(-2, -2, W + 4, H + 4, 6)} fill="#0A1450" stroke="#4E82E8" strokeWidth={1.4} />
      {Array.from({ length: rows }).flatMap((_, r) => Array.from({ length: cols }).map((__, c) => (
        <Path key={`${r}${c}`} d={roundRect(c * s + 1, r * s + 1, s - 2, s - 2, 3)} fill="#16256E" />
      )))}
      {filled.map(([r, c, k], i) => (
        <Path key={i} d={roundRect(c * s + 1, r * s + 1, s - 2, s - 2, 3)} fill={BRICKS[k % BRICKS.length].mid} />
      ))}
      {piece ? piece.cells.map(([r, c], i) => (
        <Path key={`p${i}`} d={roundRect((c + piece.dx) * s + 1, (r + piece.dy) * s + 1, s - 2, s - 2, 3)}
          fill={BRICKS[piece.color].mid} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.2} />
      )) : null}
      {burst ? <Path d={starPath(W / 2, H / 2, 18, 8)} fill="#FFE45C" stroke="#FFF8C8" strokeWidth={1.4} /> : null}
    </Svg>
  );
}

function HowIllus({ kind }: { kind: 'drag' | 'row' | 'blast' | 'plan' | 'crystal' | 'ice' | 'stone' | 'rotate' }) {
  if (kind === 'drag') {
    return <MiniBoard cols={5} rows={3} filled={[[2, 0, 5], [2, 1, 5]]}
      piece={{ cells: [[0, 0], [0, 1]], color: 2, dx: 3, dy: 0.2 }} />;
  }
  if (kind === 'row') {
    return <MiniBoard cols={5} rows={3} filled={[[2, 0, 0], [2, 1, 3], [2, 2, 2], [2, 3, 5], [2, 4, 6]]} />;
  }
  if (kind === 'blast') return <MiniBoard cols={5} rows={3} burst />;
  if (kind === 'plan') {
    return <MiniBoard cols={5} rows={3}
      filled={[[0, 0, 0], [0, 2, 3], [1, 1, 5], [1, 3, 6], [2, 0, 2], [2, 2, 4], [2, 4, 0], [0, 4, 3]]} />;
  }
  return (
    <View style={{ width: 79, height: 49, borderRadius: 8, backgroundColor: '#0A1450', borderWidth: 1.4, borderColor: '#4E82E8', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'crystal' ? <Icon name="crystal" size={30} color={C.crystal} /> : null}
      {kind === 'ice' ? <Icon name="ice" size={30} color={C.ice} /> : null}
      {kind === 'stone' ? <Icon name="stone" size={30} color={C.stone} /> : null}
      {kind === 'rotate' ? <Icon name="rotate" size={30} color={C.goldHi} /> : null}
    </View>
  );
}

const HOW_PAGES: { title: string; steps: { text: string; kind: Parameters<typeof HowIllus>[0]['kind'] }[] }[] = [
  {
    title: 'HOW TO PLAY',
    steps: [
      { text: 'Drag blocks onto the grid.', kind: 'drag' },
      { text: 'Fill a whole row or column.', kind: 'row' },
      { text: 'It blasts and earns points!', kind: 'blast' },
      { text: 'Plan your moves. If no block fits, the level ends.', kind: 'plan' },
    ],
  },
  {
    title: 'GOALS & TIPS',
    steps: [
      { text: 'Crystals pop when a line clears through them.', kind: 'crystal' },
      { text: 'Ice breaks when a line clears through it.', kind: 'ice' },
      { text: 'Stone never clears, but it counts as filled.', kind: 'stone' },
      { text: 'Tap a block to rotate it. Power-ups help in a pinch.', kind: 'rotate' },
    ],
  },
];

function HowToPlay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const p = HOW_PAGES[page];
  const last = page === HOW_PAGES.length - 1;
  return (
    <ModalCard glow="#3D8BFF" maxWidth={340} onClose={onClose}>
      <Text style={{ color: '#FFFFFF', fontSize: 20, letterSpacing: 1.4 }}>{p.title}</Text>
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 14 }}>
        {p.steps.map((s, i) => (
          <Panel key={i} radius={14} tint="rgba(60,120,230,0.28)"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9 }}>
            <View style={{
              width: 26, height: 26, borderRadius: 13, backgroundColor: '#0A1450', borderWidth: 1.5,
              borderColor: '#6FA0FF', alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13 }}>{i + 1}</Text>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 13, flex: 1, lineHeight: 17 }}>{s.text}</Text>
            <HowIllus kind={s.kind} />
          </Panel>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 16 }}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 7, paddingLeft: 40 }}>
          {HOW_PAGES.map((_, i) => (
            <View key={i} style={{ width: i === page ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? C.gold : 'rgba(255,255,255,0.3)' }} />
          ))}
        </View>
        <Pressable
          onPress={() => { tapFx(); if (last) onClose(); else setPage(page + 1); }}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#3A78E8', borderWidth: 1.5, borderColor: '#9CC4FF', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={last ? 'check' : 'next'} size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </ModalCard>
  );
}

/* ==========================================================================
 * 14. ROOT
 * ========================================================================== */

/**
 * Last line of defence. An error thrown while rendering would otherwise take
 * the whole app down; this shows a recovery screen instead, and TRY AGAIN
 * remounts the game from the welcome screen (progress is in AsyncStorage).
 * It uses only core views so it cannot depend on whatever just failed.
 */
class CrashGuard extends React.Component<{ children: React.ReactNode }, { crashed: boolean; attempt: number }> {
  state = { crashed: false, attempt: 0 };

  static getDerivedStateFromError() { return { crashed: true }; }

  componentDidCatch(error: unknown) { console.warn('Block Adventure recovered from an error:', error); }

  render() {
    if (!this.state.crashed) return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return (
      <View style={{ flex: 1, backgroundColor: '#22124F', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <RNText style={{ color: '#FFC42E', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Something went wrong</RNText>
        <RNText style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginTop: 10, opacity: 0.85 }}>
          The game hit an unexpected problem. Tap below to start again.
        </RNText>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState((s) => ({ crashed: false, attempt: s.attempt + 1 }))}
          style={{ marginTop: 22, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FFC42E' }}
        >
          <RNText style={{ color: '#4A2C00', fontSize: 16, fontWeight: '800' }}>TRY AGAIN</RNText>
        </Pressable>
      </View>
    );
  }
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.sky3 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <CrashGuard>
          <Root />
        </CrashGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

type Route = { screen: 'welcome' } | { screen: 'tabs' } | { screen: 'game'; level: number };

function Root() {
  const { save, ready, edit, reset } = useSave();
  const { width, height } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts({ LilitaOne_400Regular });
  // If the font fails to load, text falls back to the system font rather than
  // blocking the game.
  DISPLAY_FONT = fontsLoaded && !fontError ? 'LilitaOne_400Regular' : undefined;

  const [route, setRoute] = useState<Route>({ screen: 'welcome' });
  const [tab, setTab] = useState<TabId>('home');
  const [mapWorld, setMapWorld] = useState(0);
  const [chestOpen, setChestOpen] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sheet, setSheet] = useState<number | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ title: string; prize: RewardPrize } | null>(null);

  useEffect(() => { audioInit(); }, []);
  useEffect(() => { void initAds(); }, []);

  /** Spend coins if the player has them. The check is repeated on the latest state, so a double tap cannot overspend. */
  const spendCoins = useCallback((n: number) => {
    if (save.coins < n) return false;
    edit((s) => (s.coins < n ? s : { ...s, coins: s.coins - n }));
    return true;
  }, [save.coins, edit]);

  // Once the save has loaded, push the stored switches and volumes into the engine.
  useEffect(() => {
    if (!ready) return;
    setSoundOn(save.settings.sound);
    setMusicOn(save.settings.music);
    setSfxVolume(save.settings.sfxVol);
    setMusicVolume(save.settings.musicVol);
  }, [ready, save.settings.sound, save.settings.music, save.settings.sfxVol, save.settings.musicVol]);

  // Each place has its own tune: the menus, the puzzle board, and one for every
  // world on the map. Changing world crossfades.
  useEffect(() => {
    if (!ready) return;
    setMusicTrack(
      route.screen === 'game' ? 'game'
        : route.screen === 'tabs' && tab === 'adventure' ? worldTrack(mapWorld)
          : 'menu',
    );
  }, [ready, route.screen, tab, mapWorld]);

  // Nothing plays behind the launcher.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAudioActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(k: K, v: Settings[K], quiet = false) => {
    edit((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
    // Apply the audio settings immediately, before the next render, so the
    // click that confirms a change reflects the NEW state: silent when you
    // turn sound off, audible when you turn it on.
    if (k === 'sound') setSoundOn(v as boolean);
    if (k === 'music') setMusicOn(v as boolean);
    if (k === 'sfxVol') setSfxVolume(v as number);
    if (k === 'musicVol') setMusicVolume(v as number);
    if (!quiet) tapFx();
  }, [edit]);

  /* --- navigation ------------------------------------------------------- */

  const nextStage = useMemo(() => {
    for (let i = 0; i < LEVELS.length; i++) if (!(save.stars[LEVELS[i].key] > 0)) return LEVELS[i].stage;
    return LEVELS[LEVELS.length - 1].stage;
  }, [save.stars]);

  /** Opening the map lands on the world you are actually up to. */
  const goTab = useCallback((t: TabId) => {
    if (t === 'adventure') setMapWorld(nextStage);
    setTab(t);
  }, [nextStage]);

  const toTabs = useCallback((t: TabId) => {
    setRoute({ screen: 'tabs' });
    goTab(t);
  }, [goTab]);

  const openLevel = useCallback((index: number) => {
    const lv = LEVELS[index];
    if (!lv) return;
    haptic.medium();
    playSfx('start');
    setSheet(null);
    const stageId = STAGES[lv.stage].id;
    setMapWorld(lv.stage);
    // Teach the rule before the very first level, then each obstacle once.
    if (!save.seenTutorial) {
      setTutorial(true);
      edit((s) => ({ ...s, seenTutorial: true }));
    } else if (!save.seenStages.includes(stageId) && STAGE_BRIEF[stageId]) {
      setBrief(stageId);
      edit((s) => ({ ...s, seenStages: [...s.seenStages, stageId] }));
    }
    setRoute({ screen: 'game', level: index });
  }, [save.seenTutorial, save.seenStages, edit]);

  const handleWin = useCallback((index: number, p: WinPayload) => {
    if (!LEVELS[index]) return;
    const key = LEVELS[index].key;
    edit((s) => ({
      ...s,
      stars: { ...s.stars, [key]: Math.max(s.stars[key] ?? 0, p.stars) },
      best: { ...s.best, [key]: Math.max(s.best[key] ?? 0, p.score) },
      coins: s.coins + p.coins,
      lines: s.lines + p.lines,
      blocks: s.blocks + p.blocks,
      bestCombo: Math.max(s.bestCombo, p.bestCombo),
      totalScore: s.totalScore + p.score,
      // A key only for a level you had never cleared before.
      chest: s.chest + ((s.stars[key] ?? 0) > 0 ? 0 : 1),
    }));
  }, [edit]);

  /* --- economy ---------------------------------------------------------- */

  const spendPower = useCallback((id: PowerId) => {
    edit((s) => ({ ...s, powers: { ...s.powers, [id]: Math.max(0, (s.powers[id] ?? 0) - 1) } }));
  }, [edit]);

  /** Buying is instant when you can afford it; the caller reports failure. */
  const buyPower = useCallback((id: PowerId) => {
    const cost = POWER_BY_ID[id].cost;
    if (save.coins < cost) return false;
    edit((s) => (s.coins < cost ? s : {
      ...s, coins: s.coins - cost,
      powers: { ...s.powers, [id]: (s.powers[id] ?? 0) + 1 },
    }));
    return true;
  }, [save.coins, edit]);

  const claimDaily = useCallback(() => {
    if (!dailyReady(save)) return;
    // After day 7 the ladder starts over at day 1.
    const day = save.dailyDay >= 7 ? 0 : save.dailyDay;
    const prize = DAILY[day];
    // Re-checked against the latest state, so a double tap cannot pay twice.
    edit((s) => (!dailyReady(s) ? s : {
      ...s,
      coins: s.coins + prize.coins,
      powers: prize.power ? { ...s.powers, [prize.power]: (s.powers[prize.power] ?? 0) + 1 } : s.powers,
      dailyDay: day + 1,
      dailyLast: todayKey(),
    }));
    setPopup({ title: `DAY ${day + 1}`, prize });
  }, [save, edit]);

  const openChest = useCallback(() => {
    if (save.chest < CHEST_GOAL) return;
    const pick = POWERS[Math.floor(Math.random() * POWERS.length)].id;
    const prize: RewardPrize = { coins: CHEST_COINS, power: pick };
    edit((s) => (s.chest < CHEST_GOAL ? s : {
      ...s,
      coins: s.coins + prize.coins,
      powers: { ...s.powers, [pick]: (s.powers[pick] ?? 0) + 1 },
      chest: s.chest - CHEST_GOAL,
    }));
    setPopup({ title: 'TREASURE CHEST', prize });
  }, [save.chest, edit]);

  /* --- chrome ----------------------------------------------------------- */

  const alerts = useMemo(() => ({
    rewards: dailyReady(save)
      || save.chest >= CHEST_GOAL,
  }), [save]);

  /**
   * Android Back. With no handler it quits the app from anywhere, losing the
   * level in progress. Instead it closes the top-most overlay, then steps back
   * one screen, and only lets the app exit from Home (or the welcome screen).
   */
  const gameBack = useRef<(() => void) | null>(null);
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (tutorial) { setTutorial(false); return true; }
    if (brief) { setBrief(null); return true; }
    if (settings) { setSettings(false); return true; }
    if (popup) { setPopup(null); return true; }
    if (chestOpen) { setChestOpen(false); return true; }
    if (sheet !== null) { setSheet(null); return true; }
    if (route.screen === 'game') { gameBack.current?.(); return true; }
    if (route.screen === 'tabs' && tab !== 'home') { goTab('home'); return true; }
    return false;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);

  if (!ready || !(fontsLoaded || fontError)) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop skin={0} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.gold, fontSize: 12, letterSpacing: 5 }}>BLOCK ADVENTURE</Text>
        </View>
      </View>
    );
  }

  // Each screen brings its own world: forest for menus, a themed scene for the
  // map (drawn by the map itself), and plain navy for play.
  const backdrop =
    route.screen === 'game' ? <GameBackdrop />
      : route.screen === 'tabs' && tab === 'rewards' ? <HomeBackdrop dim={0.32} />
        : null;

  return (
    <LangCtx.Provider value={save.settings.lang}>
      <View style={{ flex: 1, backgroundColor: '#0B1745' }}>
        {backdrop}

        {route.screen === 'welcome' ? (
          <WelcomeScreen onDone={() => toTabs('home')} />
        ) : route.screen === 'game' ? (
          <GameScreen
            key={route.level}
            level={LEVELS[route.level]}
            hasNext={route.level < LEVELS.length - 1}
            bestScore={save.best[LEVELS[route.level].key] ?? 0}
            bestStars={save.stars[LEVELS[route.level].key] ?? 0}
            save={save}
            backRef={gameBack}
            onExit={() => toTabs('adventure')}
            onHome={() => toTabs('home')}
            onCoins={() => toTabs('rewards')}
            onNext={() => openLevel(Math.min(route.level + 1, LEVELS.length - 1))}
            onWin={(p) => handleWin(route.level, p)}
            onSpendCoins={spendCoins}
            onSpendPower={spendPower}
            onBuyPower={buyPower}
            onHelp={() => setTutorial(true)}
            onSettings={() => setSettings(true)}
          />
        ) : (
          <>
            {tab === 'home' ? (
              <HomeScreen save={save} onPlay={openLevel} onTab={goTab} onClaimDaily={claimDaily}
                onChest={() => setChestOpen(true)} onSettings={() => setSettings(true)} />
            ) : tab === 'adventure' ? (
              <AdventureScreen save={save} world={mapWorld} setWorld={setMapWorld}
                onSelect={setSheet} onCoins={() => goTab('rewards')} onBack={() => goTab('home')} />
            ) : (
              <RewardsScreen save={save} onClaimDaily={claimDaily}
                onCoins={() => goTab('rewards')} onChest={() => setChestOpen(true)}
                onClose={() => goTab('home')} />
            )}
            <BottomNav tab={tab} onTab={goTab} alert={alerts} />
          </>
        )}

        {sheet !== null ? (
          <LevelSheet level={LEVELS[sheet]} save={save}
            onClose={() => setSheet(null)} onPlay={() => openLevel(sheet)} />
        ) : null}
        {chestOpen ? (
          <ChestScreen
            save={save}
            onClose={() => setChestOpen(false)}
            onOpen={openChest}
            onRewards={() => { setChestOpen(false); toTabs('rewards'); }}
          />
        ) : null}
        {popup ? (
          <RewardPopup title={popup.title} prize={popup.prize} onClose={() => setPopup(null)} />
        ) : null}
        {brief ? <BriefCard id={brief} onClose={() => setBrief(null)} /> : null}
        {settings ? (
          <SettingsCard
            save={save} setSetting={setSetting}
            onClose={() => setSettings(false)}
            onHelp={() => setTutorial(true)}
            onReset={() => {
              haptic.err();
              reset();
              setSettings(false);
              setMapWorld(0);
              setRoute({ screen: 'welcome' });
            }}
          />
        ) : null}
        {tutorial ? <HowToPlay onClose={() => setTutorial(false)} /> : null}
      </View>
    </LangCtx.Provider>
  );
}
