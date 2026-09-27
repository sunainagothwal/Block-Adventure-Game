/* ============================================================================
 * SET-PIECE SCENERY
 *
 * The bigger pieces that give each world its landscape: rock walls with
 * waterfalls, a log cabin, a stilt hut, temple ruins, floating islands and a
 * castle. Same conventions as props.tsx: about 100 units tall, base at the
 * origin, drawn upward, moved and scaled with `Place`.
 * ========================================================================== */

import React from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Place, type Pal } from './props';
import { q2 } from './util';

type At = { x: number; y: number; s: number };
const O = 2.4;

const Shadow = ({ w = 44, o = 0.16 }: { w?: number; o?: number }) => (
  <Ellipse cx={2} cy={2} rx={w} ry={w * 0.16} fill="#000000" opacity={o} />
);

/* --- rock walls ------------------------------------------------------------------ */

/**
 * A stratified rock wall that frames the side of the map. `cap` is what lies on
 * top (grass, snow, sand), `fall` puts a waterfall down its face, and `flip`
 * mirrors it so the wall can hug either margin.
 */
export function Cliff({ x, y, s, pal, cap, fall, fallColor = '#8FE0FF', foam = '#FFFFFF', flip, bands }: At & {
  pal: Pal; cap: string; fall?: boolean; fallColor?: string; foam?: string; flip?: boolean; bands?: string;
}) {
  const body = 'M-52 0 L-49 -44 L-38 -58 L-32 -80 L-15 -92 L5 -87 L19 -97 L35 -80 L41 -58 L49 -44 L54 0 Z';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={56} o={0.2} />
      <G transform={flip ? 'scale(-1 1)' : undefined}>
        <Path d={body} fill={pal.mid} stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
        <Path d="M-49 -44 L-38 -58 L-32 -80 L-15 -92 L-18 -60 L-26 -30 L-32 0 L-52 0 Z" fill={pal.light} opacity={0.55} />
        <Path d="M19 -97 L35 -80 L41 -58 L49 -44 L54 0 L24 0 L27 -50 Z" fill={pal.dark} opacity={0.5} />
        {/* strata */}
        <Path d="M-50 -22 H-8 M6 -24 H52 M-46 -42 H-14 M0 -44 H46 M-30 -64 H-6 M8 -68 H36" stroke={bands ?? pal.dark} strokeWidth={2.2} strokeLinecap="round" opacity={0.4} fill="none" />
        <Path d="M-38 -10 l8 -4 M-6 -32 l9 -3 M22 -14 l9 -4 M-20 -52 l8 -3" stroke={pal.light} strokeWidth={2} strokeLinecap="round" opacity={0.5} fill="none" />
        {/* what lies on top */}
        <Path d="M-32 -80 L-15 -92 L5 -87 L19 -97 L35 -80 Q22 -70 8 -78 Q-6 -66 -18 -76 Q-26 -70 -32 -80 Z" fill={cap} stroke={pal.outline} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M-24 -86 Q-14 -94 -4 -89" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} fill="none" />
        {fall ? (
          <G>
            <Path d="M-14 -84 L4 -84 L8 -6 L-18 -6 Z" fill={fallColor} stroke={pal.outline} strokeWidth={1.6} strokeLinejoin="round" />
            <Path d="M-10 -80 L-2 -80 L-4 -8 L-12 -8 Z" fill="#FFFFFF" opacity={0.6} />
            <Path d="M-4 -70 V-40 M-9 -56 V-22 M1 -30 V-10" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
            <Ellipse cx={-5} cy={-4} rx={26} ry={7} fill={fallColor} stroke={pal.outline} strokeWidth={1.6} />
            <Ellipse cx={-5} cy={-5} rx={20} ry={4.6} fill={foam} opacity={0.9} />
            <Circle cx={-20} cy={-10} r={3.2} fill={foam} opacity={0.85} />
            <Circle cx={10} cy={-11} r={2.6} fill={foam} opacity={0.85} />
          </G>
        ) : null}
      </G>
    </Place>
  );
}

/** A frozen pillar of ice, hanging where a waterfall stopped. */
export function IceSpire({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={30} o={0.12} />
      <Path d="M-26 0 L-20 -44 L-12 -30 L-4 -78 L4 -34 L12 -58 L18 -26 L26 0 Z" fill="#BDE6FF" stroke="#4A88C6" strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-4 -78 L-12 -30 L-6 -4 L-2 -30 Z" fill="#FFFFFF" opacity={0.6} />
      <Path d="M12 -58 L18 -26 L26 0 L14 0 Z" fill="#7DB6E8" opacity={0.6} />
    </Place>
  );
}

/* --- snow ------------------------------------------------------------------------- */

export function Cabin({ x, y, s, flip }: At & { flip?: boolean }) {
  const wood = '#A8683A';
  const woodDark = '#7A4626';
  const line = '#4A2A16';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={52} o={0.16} />
      <G transform={flip ? 'scale(-1 1)' : undefined}>
        {/* chimney and smoke */}
        <Rect x={16} y={-84} width={12} height={26} fill="#8A8A9A" stroke={line} strokeWidth={2} />
        <Path d="M22 -88 q-8 -10 2 -18 q10 -8 2 -18" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.55} />
        {/* walls */}
        <Rect x={-40} y={-44} width={80} height={44} fill={wood} stroke={line} strokeWidth={O} />
        <Path d="M-40 -34 H40 M-40 -24 H40 M-40 -14 H40 M-40 -4 H40" stroke={woodDark} strokeWidth={2} opacity={0.7} />
        <Rect x={10} y={-44} width={30} height={44} fill="#000000" opacity={0.14} />
        {[-40, 40].map((cx) => <Rect key={cx} x={cx - 4} y={-46} width={8} height={48} rx={3} fill={woodDark} stroke={line} strokeWidth={1.6} />)}
        {/* roof with a thick coat of snow */}
        <Path d="M-50 -42 L0 -82 L50 -42 Z" fill="#7A3C22" stroke={line} strokeWidth={O} strokeLinejoin="round" />
        <Path d="M-52 -40 L0 -86 L52 -40 Q40 -46 30 -41 Q20 -50 8 -44 Q-4 -54 -14 -45 Q-28 -52 -36 -42 Q-44 -46 -52 -40 Z" fill="#FFFFFF" stroke="#B8D0EC" strokeWidth={1.6} strokeLinejoin="round" />
        {/* lit windows and door */}
        <Rect x={-32} y={-34} width={16} height={16} rx={2} fill="#FFE07A" stroke={line} strokeWidth={2} />
        <Path d="M-24 -34 V-18 M-32 -26 H-16" stroke={line} strokeWidth={1.6} />
        <Rect x={16} y={-34} width={16} height={16} rx={2} fill="#FFE07A" stroke={line} strokeWidth={2} />
        <Path d="M24 -34 V-18 M16 -26 H32" stroke={line} strokeWidth={1.6} />
        <Path d="M-8 0 V-24 A8 8 0 0 1 8 -24 V0 Z" fill="#4A2A16" stroke={line} strokeWidth={2} />
        <Circle cx={4} cy={-12} r={1.4} fill="#FFD54A" />
        <Ellipse cx={0} cy={2} rx={44} ry={5} fill="#FFFFFF" opacity={0.9} />
        {/* string lights */}
        {[-36, -18, 0, 18, 36].map((cx, i) => <Circle key={cx} cx={cx} cy={-48 + (i % 2) * 3} r={2.2} fill={i % 2 ? '#FF7A8A' : '#FFE07A'} />)}
      </G>
    </Place>
  );
}

/* --- beach ------------------------------------------------------------------------ */

export function StiltHut({ x, y, s, flip }: At & { flip?: boolean }) {
  const line = '#5A3A1E';
  const thatch = '#D9A64A';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={46} o={0.16} />
      <G transform={flip ? 'scale(-1 1)' : undefined}>
        {/* stilts and deck */}
        {[-30, -10, 10, 30].map((cx) => <Rect key={cx} x={cx - 3} y={-30} width={6} height={32} fill="#9A6A38" stroke={line} strokeWidth={1.6} />)}
        <Rect x={-42} y={-34} width={84} height={7} rx={2} fill="#C48A48" stroke={line} strokeWidth={2} />
        {/* walls */}
        <Rect x={-32} y={-64} width={64} height={30} fill="#E8C98A" stroke={line} strokeWidth={O} />
        <Path d="M-32 -54 H32 M-32 -44 H32" stroke="#B98A4A" strokeWidth={1.6} opacity={0.7} />
        <Rect x={-24} y={-58} width={14} height={14} rx={2} fill="#7AD4F0" stroke={line} strokeWidth={1.8} />
        <Path d="M8 -34 V-52 A7 7 0 0 1 22 -52 V-34 Z" fill="#7A4A26" stroke={line} strokeWidth={1.8} />
        {/* thatched roof */}
        <Path d="M-48 -62 L0 -104 L48 -62 Z" fill={thatch} stroke={line} strokeWidth={O} strokeLinejoin="round" />
        <Path d="M-38 -66 L-30 -74 M-24 -68 L-14 -80 M-8 -70 L0 -84 M10 -70 L14 -82 M26 -68 L30 -76 M-44 -64 L44 -64" stroke="#8A5E1E" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} fill="none" />
        <Path d="M0 -104 L48 -62 L14 -62 Z" fill="#000000" opacity={0.14} />
        <Path d="M0 -104 V-112" stroke={line} strokeWidth={2.4} />
        {/* ladder */}
        <Path d="M30 -34 L38 0 M38 -34 L46 0" stroke={line} strokeWidth={2} />
        <Path d="M33 -22 H41 M35 -11 H43" stroke={line} strokeWidth={1.8} />
      </G>
    </Place>
  );
}

export function Deckchair({ x, y, s, c = '#FF5A6E' }: At & { c?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={30} o={0.14} />
      <Path d="M-26 -8 L-14 -34 L-2 -28 L-10 -6 Z" fill={c} stroke="#00000033" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M-10 -6 L14 -8 L22 0 L-8 0 Z" fill="#FFFFFF" stroke="#00000033" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M-14 -34 L-4 -50 L4 -44" stroke="#8A5A2E" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M-26 -8 L-30 0 M22 0 L26 4" stroke="#8A5A2E" strokeWidth={3} strokeLinecap="round" />
    </Place>
  );
}

/* --- desert ------------------------------------------------------------------------ */

export function RuinGate({ x, y, s }: At) {
  const sand = '#EBC488';
  const dark = '#C9975A';
  const line = '#8A5A2A';
  const col = (cx: number, h: number) => (
    <G key={cx}>
      <Rect x={cx - 9} y={-h} width={18} height={h} fill={sand} stroke={line} strokeWidth={O} />
      <Rect x={cx + 1} y={-h} width={8} height={h} fill={dark} opacity={0.5} />
      <Rect x={cx - 12} y={-h - 5} width={24} height={7} rx={1.5} fill={sand} stroke={line} strokeWidth={2} />
      <Rect x={cx - 12} y={-4} width={24} height={6} rx={1.5} fill={sand} stroke={line} strokeWidth={2} />
      <Path d={`M${cx - 4} ${-h + 8} V-8 M${cx + 3} ${-h + 12} V-10`} stroke={line} strokeWidth={1.2} opacity={0.5} />
    </G>
  );
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={62} o={0.2} />
      {col(-34, 70)}
      {col(34, 52)}
      <Path d="M-46 -78 H30 L26 -92 H-42 Z" fill={sand} stroke={line} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-34 -70 V-52 M-20 -70 V-56" stroke={line} strokeWidth={1.4} opacity={0.5} />
      <Rect x={-54} y={-2} width={108} height={7} rx={2} fill={dark} stroke={line} strokeWidth={2} />
      <Rect x={-46} y={-9} width={92} height={8} rx={2} fill={sand} stroke={line} strokeWidth={2} />
      <Path d="M-8 0 V-24 A10 10 0 0 1 12 -24 V0 Z" fill="#5A3A22" opacity={0.85} />
      <Path d="M38 -58 L46 -50 L44 -40 L52 -34" stroke={line} strokeWidth={1.6} fill="none" opacity={0.6} />
      <Circle cx={54} cy={-3} r={5} fill={sand} stroke={line} strokeWidth={1.6} />
      <Circle cx={-56} cy={-2} r={4} fill={sand} stroke={line} strokeWidth={1.6} />
    </Place>
  );
}

export function Bones({ x, y, s }: At) {
  const b = '#F6EAD0';
  const l = '#A8804A';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={34} o={0.14} />
      <Path d="M-34 -6 Q-10 -30 12 -14 Q22 -6 30 -12" stroke={l} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d="M-34 -6 Q-10 -30 12 -14 Q22 -6 30 -12" stroke={b} strokeWidth={5.6} strokeLinecap="round" fill="none" />
      {[-22, -10, 2, 14].map((cx, i) => <Path key={cx} d={`M${cx} ${-16 - (i % 2) * 6} V0`} stroke={b} strokeWidth={3.4} strokeLinecap="round" />)}
      <Ellipse cx={-38} cy={-8} rx={9} ry={6.4} fill={b} stroke={l} strokeWidth={1.6} />
      <Circle cx={-40} cy={-9} r={1.7} fill="#3A2A1A" />
    </Place>
  );
}

/* --- night ------------------------------------------------------------------------- */

/** A chunk of sky-rock adrift on a bed of cloud, with a glowing crystal hanging beneath. */
export function FloatIsle({ x, y, s, top = '#7C5CE0', rock = '#4A3A9A', line = '#1E1458', glow = '#5CE6F0', flip }: At & {
  top?: string; rock?: string; line?: string; glow?: string; flip?: boolean;
}) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-8} rx={60} ry={26} fill={glow} opacity={0.12} />
      <G transform={flip ? 'scale(-1 1)' : undefined}>
        {/* the rock underneath, tapering to a point */}
        <Path d="M-46 -34 L-38 -18 L-24 -10 L-14 6 L-4 -2 L6 12 L16 -4 L30 -12 L44 -26 L46 -34 Z" fill={rock} stroke={line} strokeWidth={O} strokeLinejoin="round" />
        <Path d="M-46 -34 L-38 -18 L-24 -10 L-14 6 L-10 -20 Z" fill="#8A78E8" opacity={0.4} />
        <Path d="M30 -12 L44 -26 L46 -34 L20 -34 Z" fill="#000000" opacity={0.2} />
        {/* the lawn on top */}
        <Path d="M-50 -34 Q-46 -52 -22 -54 Q0 -60 24 -54 Q48 -52 50 -34 Q0 -22 -50 -34 Z" fill={top} stroke={line} strokeWidth={O} strokeLinejoin="round" />
        <Path d="M-38 -46 Q-20 -58 6 -54" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.35} fill="none" />
        {/* a hanging crystal */}
        <Path d="M-2 -6 L-7 6 L-2 20 L4 6 Z" fill={glow} stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
        {/* a little tree */}
        <Rect x={19} y={-72} width={5} height={20} fill="#2E2070" />
        <Circle cx={21} cy={-80} r={12} fill="#5B3FCC" stroke={line} strokeWidth={1.8} />
        <Circle cx={16} cy={-84} r={5} fill="#B8A2FF" opacity={0.6} />
        {/* glowing sprouts */}
        {[-30, -18, -6].map((cx, i) => <Circle key={cx} cx={cx} cy={-52 + (i % 2) * 2} r={2.6} fill={glow} />)}
      </G>
    </Place>
  );
}

/** A soft bank of cloud, the sea the night world's islands float on. */
export function CloudBank({ x, y, s, color = '#9A7CF0', hi = '#D8C8FF', o = 0.85 }: At & { color?: string; hi?: string; o?: number }) {
  const puffs: [number, number, number][] = [[-56, -8, 20], [-34, -18, 26], [-8, -24, 30], [22, -18, 26], [48, -10, 22], [68, -4, 16]];
  return (
    <Place x={x} y={y} s={s}>
      <G opacity={o}>
        {puffs.map(([dx, dy, r], i) => <Circle key={`b${i}`} cx={dx} cy={dy + 6} r={r} fill={color} />)}
        {puffs.map(([dx, dy, r], i) => <Circle key={i} cx={dx} cy={dy} r={r} fill={hi} opacity={0.9} />)}
        <Path d="M-76 6 H80" stroke={hi} strokeWidth={14} strokeLinecap="round" opacity={0.9} />
        <Path d="M-70 4 H74" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
      </G>
    </Place>
  );
}

/** A fairy-tale castle on the far peak, its windows lit. */
export function Castle({ x, y, s }: At) {
  const wall = '#8A78E8';
  const dark = '#5A48B8';
  const roof = '#FF7AD9';
  const line = '#1E1458';
  const win = '#FFE98A';
  const tower = (cx: number, w: number, h: number, spire: number) => (
    <G key={cx}>
      <Rect x={cx - w / 2} y={-h} width={w} height={h} fill={wall} stroke={line} strokeWidth={O} />
      <Rect x={cx} y={-h} width={w / 2} height={h} fill={dark} opacity={0.5} />
      <Path d={`M${cx - w / 2 - 3} ${-h} L${cx} ${-h - spire} L${cx + w / 2 + 3} ${-h} Z`} fill={roof} stroke={line} strokeWidth={O} strokeLinejoin="round" />
      <Path d={`M${cx} ${-h - spire} L${cx + w / 2 + 3} ${-h} L${cx + 2} ${-h} Z`} fill="#C8509A" />
      <Path d={`M${cx} ${-h - spire} V${-h - spire - 10}`} stroke={line} strokeWidth={1.8} />
      <Path d={`M${cx} ${-h - spire - 10} l10 3 l-10 3 Z`} fill="#FFE98A" />
      <Rect x={cx - 3} y={-h * 0.6} width={6} height={9} rx={3} fill={win} />
    </G>
  );
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-40} rx={92} ry={70} fill="#FFE98A" opacity={0.08} />
      <Shadow w={64} o={0.25} />
      {tower(-48, 22, 58, 30)}
      {tower(48, 22, 58, 30)}
      {tower(-26, 18, 80, 30)}
      {tower(26, 18, 80, 30)}
      <Rect x={-24} y={-64} width={48} height={64} fill={wall} stroke={line} strokeWidth={O} />
      <Rect x={0} y={-64} width={24} height={64} fill={dark} opacity={0.5} />
      {[-20, -10, 0, 10, 16].map((cx) => <Rect key={cx} x={cx} y={-71} width={6} height={8} fill={wall} stroke={line} strokeWidth={1.4} />)}
      <Path d="M-9 0 V-22 A9 9 0 0 1 9 -22 V0 Z" fill="#2A1C5A" stroke={line} strokeWidth={2} />
      <Rect x={-17} y={-52} width={7} height={11} rx={3.5} fill={win} />
      <Rect x={10} y={-52} width={7} height={11} rx={3.5} fill={win} />
      <Path d="M-14 -64 L0 -112 L14 -64 Z" fill={roof} stroke={line} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M0 -112 L14 -64 L2 -64 Z" fill="#C8509A" />
      <Path d="M0 -112 V-128" stroke={line} strokeWidth={2} />
      <Path d="M0 -128 l14 4 l-14 4 Z" fill="#FFE98A" />
      <Path d={`M-64 4 Q-40 -8 0 -8 Q40 -8 64 4 Z`} fill="#6A54C8" stroke={line} strokeWidth={2} />
      {[-70, 70].map((cx) => <Path key={cx} d={`M${cx} 4 l${q2(cx > 0 ? 8 : -8)} 12 l${q2(cx > 0 ? -14 : 14)} -6 Z`} fill="#5CE6F0" stroke={line} strokeWidth={1.4} />)}
    </Place>
  );
}
