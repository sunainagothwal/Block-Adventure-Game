/* World 1 — FOREST WORLD: a lush, sunlit woodland. A golden trail climbs from the
 * clearing past a wooden bridge and a waterfall, to a cave in the hillside. */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient as SvgRadial, Rect, Stop,
} from 'react-native-svg';
import { CloudDrift, Drift, Falling, Spin } from './ambient';
import { Bush, Flower, Mushroom, Pine, Place, RoundTree, Rock, Stump, Tuft, Treeline, type Pal } from './props';
import type { DecorKind, MapExtra, SceneGeom, WorldDef } from './types';
import { clamp, groundPaths, q2, ridgePath, seeded } from './util';

const LEAF: Pal = { dark: '#1B7F36', mid: '#2FAE48', light: '#9CEB6A', outline: '#0F5A28', trunk: '#7A4A26' };
const FIR: Pal = { dark: '#14663F', mid: '#22834F', light: '#7DDBA0', outline: '#0C4A2E', trunk: '#6E4322' };
const STONE: Pal = { dark: '#7C8794', mid: '#AEB7C4', light: '#E8EDF3', outline: '#5A6472', trunk: '' };
const SHRUB: Pal = { dark: '#1F7A38', mid: '#2FA046', light: '#8AE06A', outline: '#0F5A28', trunk: '' };

/** The winding of the trail. The map lays its nodes out from this too. */
const PATH = { centre: 0.5, swing: 0.24, wave: 1.05, phase: 3.8 };
/** Must match layoutWorld: the spacing of the levels and the gap under level 1. */
const STEP_Y = 88;
const BOTTOM_PAD = 130;

const nodeAt = (g: SceneGeom, i: number) => ({
  x: clamp(g.W * (PATH.centre + PATH.swing * Math.sin(i * PATH.wave + PATH.phase)), g.W * 0.16, g.W * 0.84),
  y: g.H - BOTTOM_PAD - i * STEP_Y,
});

const riverX = (g: SceneGeom, y: number) => g.W * 0.94 + Math.sin(y * 0.0085) * g.W * 0.025;
const groundTop = (g: SceneGeom, x: number) =>
  g.horizon + 8 + Math.sin((x / g.W) * Math.PI * 2 * 1.3 + 0.7) * 7 + Math.sin((x / g.W) * Math.PI * 2 * 3.1) * 3;

/* --- small props ------------------------------------------------------------------ */

function Lily({ x, y, s, v }: { x: number; y: number; s: number; v: number }) {
  const pink = v % 3 === 0;
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-4} rx={26} ry={9} fill="#2F9A46" stroke="#14622C" strokeWidth={2.4} />
      <Path d="M0 -4 L26 -9" stroke="#3AB5F0" strokeWidth={3} />
      <Ellipse cx={-5} cy={-6} rx={12} ry={3.4} fill="#7BDB6A" opacity={0.6} />
      {pink ? (
        <G>
          <Path d="M-2 -8 Q-9 -22 0 -26 Q9 -22 2 -8 Z" fill="#FF8FC4" stroke="#B4487E" strokeWidth={1.6} />
          <Path d="M-9 -8 Q-18 -16 -10 -22 Q-4 -18 -2 -8 Z" fill="#FFB0D6" stroke="#B4487E" strokeWidth={1.4} />
          <Circle cx={0} cy={-12} r={3} fill="#FFE45C" />
        </G>
      ) : null}
    </Place>
  );
}

function Butterfly({ c }: { c: string }) {
  return (
    <Svg width={26} height={20} viewBox="-13 -10 26 20">
      <Path d="M0 0 Q-12 -14 -12 -3 Q-12 6 0 2 Z" fill={c} stroke="#FFFFFF" strokeWidth={0.8} />
      <Path d="M0 0 Q12 -14 12 -3 Q12 6 0 2 Z" fill={c} stroke="#FFFFFF" strokeWidth={0.8} />
      <Path d="M0 2 Q-8 9 -4 8 Q0 6 0 2 Z M0 2 Q8 9 4 8 Q0 6 0 2 Z" fill={c} opacity={0.8} />
      <Path d="M0 -4 V6" stroke="#4A2E1A" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** A short run of wooden fence. */
function Fence({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={2} cy={2} rx={38} ry={5} fill="#000000" opacity={0.14} />
      <Rect x={-34} y={-26} width={68} height={6} rx={2} fill="#D29A5A" stroke="#6B4020" strokeWidth={2.2} />
      <Rect x={-34} y={-14} width={68} height={6} rx={2} fill="#D29A5A" stroke="#6B4020" strokeWidth={2.2} />
      {[-28, 0, 28].map((px) => (
        <G key={px}>
          <Rect x={px - 4.5} y={-38} width={9} height={39} rx={2.5} fill="#B97C40" stroke="#6B4020" strokeWidth={2.2} />
          <Rect x={px - 2.5} y={-36} width={3} height={30} rx={1.5} fill="#E2B27A" opacity={0.6} />
        </G>
      ))}
    </Place>
  );
}

function Log({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={2} rx={34} ry={5} fill="#000000" opacity={0.15} />
      <Rect x={-30} y={-20} width={58} height={20} rx={9} fill="#8A5A2E" stroke="#4A2A10" strokeWidth={2.4} />
      <Path d="M-22 -14 H18 M-24 -7 H14" stroke="#B57A42" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
      <Ellipse cx={28} cy={-10} rx={6} ry={10} fill="#E8C48A" stroke="#4A2A10" strokeWidth={2.2} />
      <Ellipse cx={28} cy={-10} rx={2.6} ry={4.6} fill="none" stroke="#B98A4A" strokeWidth={1.4} />
      <Path d="M-14 -20 Q-4 -28 6 -20 Z" fill="#4FAE4E" />
    </Place>
  );
}

function Fern({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Place x={x} y={y} s={s}>
      {[-64, -34, 0, 34, 64].map((a) => (
        <G key={a} transform={`rotate(${a})`}>
          <Path d="M0 0 Q-9 -26 0 -52 Q9 -26 0 0 Z" fill={Math.abs(a) > 40 ? '#2A9A44' : '#3DBB58'} stroke="#14622C" strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M0 -4 V-46" stroke="#14622C" strokeWidth={1.4} opacity={0.6} />
        </G>
      ))}
    </Place>
  );
}

/** A chunky toy block, for the pile by the trail. */
function Cube3D({ x, y, s, c, face }: {
  x: number; y: number; s: number; c: { mid: string; top: string; side: string; hi: string }; face?: boolean;
}) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={6} cy={3} rx={42} ry={7} fill="#000000" opacity={0.22} />
      <Path d="M30 -4 L46 -18 L46 -74 L30 -60 Z" fill={c.side} stroke="#3A2A20" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M-30 -60 L-14 -74 L46 -74 L30 -60 Z" fill={c.top} stroke="#3A2A20" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M-30 -48 Q-30 -60 -18 -60 L18 -60 Q30 -60 30 -48 L30 -12 Q30 0 18 0 L-18 0 Q-30 0 -30 -12 Z"
        fill={c.mid} stroke="#3A2A20" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M-24 -50 Q-24 -54 -18 -54 L6 -54" fill="none" stroke={c.hi} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      {face ? (
        <G>
          <Ellipse cx={-11} cy={-34} rx={3.6} ry={4.8} fill="#5A2E00" />
          <Ellipse cx={11} cy={-34} rx={3.6} ry={4.8} fill="#5A2E00" />
          <Circle cx={-9.8} cy={-36} r={1.3} fill="#FFFFFF" />
          <Circle cx={12.2} cy={-36} r={1.3} fill="#FFFFFF" />
          <Circle cx={-20} cy={-24} r={4} fill="#FF7A4A" opacity={0.5} />
          <Circle cx={20} cy={-24} r={4} fill="#FF7A4A" opacity={0.5} />
          <Path d="M-9 -24 Q0 -12 9 -24" fill="none" stroke="#5A2E00" strokeWidth={3.2} strokeLinecap="round" />
        </G>
      ) : null}
    </Place>
  );
}

const CUBE_YELLOW = { mid: '#FFC01E', top: '#FFF08A', side: '#E59A00', hi: '#FFFFFF' };
const CUBE_RED = { mid: '#E63E36', top: '#FF9F92', side: '#B82A24', hi: '#FFC0B8' };
const CUBE_BLUE = { mid: '#3B84EE', top: '#A9D2FF', side: '#2A62C4', hi: '#CFE4FF' };

/** A wooden signpost pointing on, with a block on it. */
function Signpost({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={2} cy={2} rx={30} ry={6} fill="#000000" opacity={0.2} />
      <Rect x={-5} y={-78} width={10} height={78} fill="#8A5A2E" stroke="#4A2A10" strokeWidth={2.4} />
      <Path d="M-52 -98 L30 -98 L52 -78 L30 -58 L-52 -58 Z" fill="#C98F52" stroke="#5A3418" strokeWidth={2.6} strokeLinejoin="round" />
      <Path d="M-46 -92 L28 -92 L44 -78" fill="none" stroke="#E8B77A" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      <Path d="M-44 -66 H26" stroke="#8A5A2E" strokeWidth={1.6} opacity={0.6} />
      <Circle cx={-44} cy={-92} r={2} fill="#4A2A10" />
      <Circle cx={-44} cy={-64} r={2} fill="#4A2A10" />
      <Path d="M-40 -90 L-16 -90 Q-10 -90 -10 -84 L-10 -68 Q-10 -62 -16 -62 L-34 -62 Q-40 -62 -40 -68 Z" fill="#FFC01E" stroke="#5A3418" strokeWidth={2} strokeLinejoin="round" />
      <Ellipse cx={-31} cy={-80} rx={1.8} ry={2.4} fill="#5A2E00" />
      <Ellipse cx={-19} cy={-80} rx={1.8} ry={2.4} fill="#5A2E00" />
      <Path d="M-30 -73 Q-25 -67 -20 -73" fill="none" stroke="#5A2E00" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M-2 -84 L20 -78 L-2 -72" fill="none" stroke="#4A2A10" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Bush x={-38} y={4} s={30} pal={SHRUB} />
    </Place>
  );
}

/** The wooden cabin, half hidden by the trees. */
function Cabin({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Pine x={x - 66} y={y + 4} s={78} pal={FIR} />
      <Bush x={x - 44} y={y + 10} s={30} pal={SHRUB} />
      <Bush x={x + 46} y={y + 12} s={26} pal={SHRUB} />
      <Place x={x} y={y} s={92}>
        <Ellipse cx={0} cy={2} rx={54} ry={9} fill="#000000" opacity={0.17} />
        <Rect x={-32} y={-44} width={64} height={44} fill="#CE8E4E" stroke="#6B4020" strokeWidth={2.4} />
        <Path d="M-32 -33 H32 M-32 -22 H32 M-32 -11 H32" stroke="#A66D33" strokeWidth={1.8} />
        <Rect x={16} y={-84} width={11} height={26} fill="#8A5A3A" stroke="#5A3820" strokeWidth={2} />
        <Path d="M-42 -42 L0 -82 L42 -42 Z" fill="#C0453A" stroke="#7A2A22" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M-37 -44 L-2 -77 L-2 -70 L-30 -44 Z" fill="#E8705E" opacity={0.7} />
        <Circle cx={21} cy={-95} r={5} fill="#FFFFFF" opacity={0.7} />
        <Circle cx={26} cy={-106} r={6.4} fill="#FFFFFF" opacity={0.55} />
        <Path d="M-10 0 V-22 A10 10 0 0 1 10 -22 V0 Z" fill="#6B3E1E" stroke="#3E2410" strokeWidth={2} />
        <Circle cx={5} cy={-12} r={1.4} fill="#FFD84D" />
        <Rect x={14} y={-35} width={14} height={14} fill="#FFE9A0" stroke="#6B4020" strokeWidth={2} />
        <Path d="M21 -35 V-21 M14 -28 H28" stroke="#6B4020" strokeWidth={1.6} />
        <Rect x={-28} y={-2} width={14} height={4} rx={2} fill="#A66D33" />
      </Place>
    </G>
  );
}

/** The cave the trail climbs to: a mossy hillside with a timber-framed tunnel. */
function Tunnel({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Place x={x} y={y} s={120}>
        <Ellipse cx={0} cy={3} rx={74} ry={9} fill="#000000" opacity={0.2} />
        <Path d="M-66 0 Q-64 -46 -32 -68 Q0 -88 36 -66 Q64 -46 66 0 Z" fill="#8E8878" stroke="#4A453A" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M-60 -6 Q-58 -40 -30 -62 Q-14 -72 -2 -74 Q-30 -50 -34 -6 Z" fill="#B4AD98" opacity={0.6} />
        <Path d="M40 -60 Q62 -44 64 -4 L46 -4 Q50 -34 34 -56 Z" fill="#5E5848" opacity={0.5} />
        <Path d="M-32 -68 Q0 -88 36 -66 Q8 -74 -32 -68 Z" fill="#54B04F" />
        <Circle cx={-24} cy={-72} r={10} fill="#2FA046" stroke="#0F5A28" strokeWidth={2} />
        <Circle cx={20} cy={-76} r={12} fill="#2FA046" stroke="#0F5A28" strokeWidth={2} />
        <Circle cx={-12} cy={-78} r={6} fill="#8AE06A" opacity={0.7} />
        <Path d="M-27 0 V-32 A27 27 0 0 1 27 -32 V0 Z" fill="#150E22" />
        <Path d="M-17 0 V-30 A17 17 0 0 1 17 -30 V0 Z" fill="#2A1C44" />
        <Ellipse cx={0} cy={-12} rx={7} ry={11} fill="#FFD98A" opacity={0.55} />
        <Path d="M-27 0 V-32 A27 27 0 0 1 27 -32 V0" fill="none" stroke="#4A453A" strokeWidth={10} strokeLinecap="round" />
        <Path d="M-27 0 V-32 A27 27 0 0 1 27 -32 V0" fill="none" stroke="#CDBF9E" strokeWidth={6.4} strokeLinecap="round" />
        <Rect x={-36} y={-40} width={8} height={40} rx={2} fill="#8A5A2E" stroke="#4A2A10" strokeWidth={2} />
        <Rect x={28} y={-40} width={8} height={40} rx={2} fill="#8A5A2E" stroke="#4A2A10" strokeWidth={2} />
        <Rect x={-40} y={-46} width={80} height={9} rx={3} fill="#A66D33" stroke="#4A2A10" strokeWidth={2} />
        <Path d="M-34 -36 Q-40 -20 -36 -6 M32 -36 Q38 -22 34 -8" fill="none" stroke="#1F7A34" strokeWidth={2.6} strokeLinecap="round" />
        {[[-38, -22], [-35, -12], [36, -24], [33, -14]].map(([lx, ly], i) => (
          <Ellipse key={i} cx={lx} cy={ly} rx={5} ry={3} fill={i % 2 ? '#4FBF5A' : '#2E9A45'} stroke="#0F5A28" strokeWidth={1.2} />
        ))}
      </Place>
      <Tuft x={x - 74} y={y + 4} s={34} c="#4EC25A" c2="#2E9A44" />
      <Tuft x={x + 76} y={y + 5} s={30} c="#4EC25A" c2="#2E9A44" />
      <Flower x={x - 62} y={y + 8} s={28} c="#FFD84D" />
      <Flower x={x + 64} y={y + 8} s={26} c="#FF7AC8" />
    </G>
  );
}

/* --- set-pieces along the trail ----------------------------------------------------- */

function extras(g: SceneGeom): MapExtra[] {
  const { W, H, horizon } = g;
  const out: MapExtra[] = [];

  // the cabin, tucked in the trees at the top left
  out.push({ top: horizon - 60, bottom: horizon + 200, node: <Cabin x={W * 0.15} y={horizon + 118} /> });

  // the cliff and the waterfall that feeds the river
  const fx = W * 0.885;
  out.push({
    top: horizon - 120, bottom: horizon + 84,
    node: (
      <G>
        <Path d={`M${q2(W * 0.7)} ${q2(horizon + 40)} Q${q2(W * 0.7)} ${q2(horizon - 30)} ${q2(W * 0.8)} ${q2(horizon - 70)} L${q2(W + 12)} ${q2(horizon - 96)} L${q2(W + 12)} ${q2(horizon + 40)} Z`}
          fill="#8C8676" stroke="#4A453A" strokeWidth={2.6} strokeLinejoin="round" />
        <Path d={`M${q2(W * 0.72)} ${q2(horizon + 30)} Q${q2(W * 0.72)} ${q2(horizon - 24)} ${q2(W * 0.8)} ${q2(horizon - 62)} L${q2(W * 0.84)} ${q2(horizon - 64)} Q${q2(W * 0.78)} ${q2(horizon - 20)} ${q2(W * 0.8)} ${q2(horizon + 30)} Z`}
          fill="#B4AD98" opacity={0.55} />
        <Path d={`M${q2(W * 0.8)} ${q2(horizon - 70)} L${q2(W + 12)} ${q2(horizon - 96)} L${q2(W + 12)} ${q2(horizon - 82)} Q${q2(W * 0.9)} ${q2(horizon - 64)} ${q2(W * 0.8)} ${q2(horizon - 58)} Z`} fill="#54B04F" />
        <Pine x={W * 0.78} y={horizon - 66} s={44} pal={FIR} />
        <Pine x={W * 0.96} y={horizon - 84} s={54} pal={FIR} />
        <Rect x={fx - 20} y={horizon - 80} width={40} height={128} rx={6} fill="url(#fo-fall)" />
        <Path d={`M${q2(fx - 8)} ${q2(horizon - 74)} V${q2(horizon + 34)} M${q2(fx + 6)} ${q2(horizon - 70)} V${q2(horizon + 24)}`}
          stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={2.2} strokeLinecap="round" />
        <Ellipse cx={fx} cy={horizon + 50} rx={40} ry={10} fill="#FFFFFF" opacity={0.7} />
        <Ellipse cx={fx} cy={horizon + 48} rx={24} ry={6} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={fx - 34} cy={horizon + 44} r={9} fill="#FFFFFF" opacity={0.4} />
        <Circle cx={fx + 34} cy={horizon + 46} r={10} fill="#FFFFFF" opacity={0.36} />
      </G>
    ),
  });

  // a spur of trail out to the wooden bridge over the river
  const a = nodeAt(g, 4);
  const b = nodeAt(g, 5);
  const bx = clamp((a.x + b.x) / 2 + Math.sin(4 * 1.9 + PATH.phase) * W * 0.07, W * 0.16, W * 0.84);
  const by = (a.y + b.y) / 2;
  const x1 = W + 10;
  const planks = Array.from({ length: Math.ceil((x1 - W * 0.79) / 9) }, (_, i) => W * 0.79 + i * 9);
  const posts = Array.from({ length: Math.ceil((x1 - W * 0.79) / 40) }, (_, i) => W * 0.8 + i * 40);
  out.push({
    top: by - 50, bottom: by + 56,
    node: (
      <G>
        <Path d={`M${q2(bx)} ${q2(by)} L${q2(W * 0.82)} ${q2(by)}`} stroke="#000000" strokeOpacity={0.1} strokeWidth={36} strokeLinecap="round" transform="translate(0 3)" />
        <Path d={`M${q2(bx)} ${q2(by)} L${q2(W * 0.82)} ${q2(by)}`} stroke="#B8782E" strokeWidth={32} strokeLinecap="round" />
        <Path d={`M${q2(bx)} ${q2(by)} L${q2(W * 0.82)} ${q2(by)}`} stroke="#F2C265" strokeWidth={25} strokeLinecap="round" />
        <Rect x={W * 0.79} y={by - 5} width={x1 - W * 0.79} height={36} fill="#000000" opacity={0.18} />
        {planks.map((px, i) => (
          <Rect key={i} x={px} y={by - 20} width={8} height={40} fill={i % 2 ? '#C98F52' : '#B97C40'} stroke="#5A3418" strokeWidth={1.6} />
        ))}
        <Rect x={W * 0.79} y={by - 26} width={x1 - W * 0.79} height={7} rx={3} fill="#D29A5A" stroke="#5A3418" strokeWidth={2} />
        <Rect x={W * 0.79} y={by + 18} width={x1 - W * 0.79} height={7} rx={3} fill="#D29A5A" stroke="#5A3418" strokeWidth={2} />
        {posts.map((px, i) => (
          <G key={i}>
            <Rect x={px} y={by - 36} width={9} height={22} rx={3} fill="#B97C40" stroke="#5A3418" strokeWidth={2} />
            <Rect x={px} y={by + 10} width={9} height={22} rx={3} fill="#B97C40" stroke="#5A3418" strokeWidth={2} />
          </G>
        ))}
      </G>
    ),
  });

  // a pile of blocks at the left edge, a signpost at the right
  const p2 = nodeAt(g, 2);
  const py = p2.y + 46;
  out.push({
    top: py - 130, bottom: py + 20, front: true,
    node: (
      <G>
        <Cube3D x={W * 0.03} y={py} s={64} c={CUBE_BLUE} />
        <Cube3D x={W * 0.14} y={py + 4} s={64} c={CUBE_RED} />
        <Cube3D x={W * 0.075} y={py - 44} s={62} c={CUBE_YELLOW} face />
      </G>
    ),
  });
  out.push({
    top: H - 190, bottom: H, front: true,
    node: <Signpost x={W * 0.86} y={H - 44} s={112} />,
  });
  return out;
}

const decor: DecorKind[] = [
  { id: 'oak', weight: 11, size: [78, 122], where: 'edge', draw: (p) => <RoundTree {...p} pal={LEAF} /> },
  { id: 'fir', weight: 5, size: [74, 112], where: 'edge', draw: (p) => <Pine {...p} pal={FIR} /> },
  { id: 'oakMid', weight: 4, size: [50, 70], where: 'any', spread: 1.2, draw: (p) => <RoundTree {...p} pal={LEAF} /> },
  { id: 'firMid', weight: 2, size: [52, 74], where: 'any', spread: 1.2, draw: (p) => <Pine {...p} pal={FIR} /> },
  { id: 'bush', weight: 5, size: [26, 42], where: 'any', draw: (p) => <Bush {...p} pal={SHRUB} berries={p.v % 4 === 0 ? '#FF5A6E' : undefined} /> },
  { id: 'shroom', weight: 3, size: [20, 30], where: 'near', draw: (p) => <Mushroom {...p} /> },
  { id: 'rock', weight: 3, size: [18, 30], where: 'near', draw: (p) => <Rock {...p} pal={STONE} /> },
  {
    id: 'flower', weight: 12, size: [22, 34], where: 'near',
    draw: (p) => <Flower {...p} c={['#FF7AC8', '#FFD84D', '#FFFFFF', '#8FC4FF', '#FF9A4A'][p.v % 5]} />,
  },
  { id: 'tuft', weight: 6, size: [20, 30], where: 'any', draw: (p) => <Tuft {...p} c="#4EC25A" c2="#2E9A44" /> },
  { id: 'stump', weight: 2, size: [26, 38], where: 'near', draw: (p) => <Stump {...p} pal={LEAF} /> },
  { id: 'fence', weight: 1.5, size: [34, 44], where: 'near', spread: 1.4, draw: (p) => <Fence {...p} /> },
  { id: 'log', weight: 1, size: [26, 34], where: 'near', spread: 1.4, draw: (p) => <Log {...p} /> },
  { id: 'fern', weight: 5, size: [24, 38], where: 'any', draw: (p) => <Fern {...p} /> },
  { id: 'lily', weight: 4, size: [24, 32], where: 'water', spread: 1.6, draw: (p) => <Lily {...p} /> },
];

export const forest: WorldDef = {
  name: 'Forest World',
  area: 'Green Valley',
  blurb: 'A lush woodland with a waterfall and a hidden cave',
  base: '#2A8A3E',
  skyStops: ['#3FA3EA', '#86CFFA', '#D8F4EE'],
  accent: '#7BE05A',
  pathShape: PATH,
  road: {
    edge: '#B8782E', fill: '#F2C265', dash: '#FFE6A8', width: 32,
    walkedEdge: '#C98A28', walkedFill: '#FFD870', walkedDash: '#FFF3C8',
  },
  decorCount: 200,
  extras,

  sky: (g) => {
    const sx = g.W * 0.8;
    const sy = g.headerH + 28;
    return (
      <>
        <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadial id="fo-sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFF6C4" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#FFF6C4" stopOpacity="0" />
            </SvgRadial>
          </Defs>
          <Circle cx={sx} cy={sy} r={96} fill="url(#fo-sun)" />
          <Circle cx={sx} cy={sy} r={28} fill="#FFE070" />
          <Circle cx={sx} cy={sy} r={23} fill="#FFF3A6" />
        </Svg>
        <Spin period={120000} style={{ position: 'absolute', left: sx - 110, top: sy - 110, width: 220, height: 220 }}>
          <Svg width={220} height={220} viewBox="-110 -110 220 220">
            {Array.from({ length: 12 }, (_, i) => (
              <Path key={i} d="M0 0 L-10 -108 L10 -108 Z" transform={`rotate(${i * 30})`} fill="#FFF3B0" opacity={0.2} />
            ))}
          </Svg>
        </Spin>
      </>
    );
  },

  far: [
    {
      // snow-capped mountains
      p: 0.12,
      draw: (g) => {
        const hz = g.horizon;
        const peaks: [number, number][] = [[0.08, 40], [0.26, 104], [0.44, 46], [0.62, 132], [0.8, 60], [0.94, 112]];
        let d = `M-20 ${hz + 70}`;
        d += ` L-20 ${hz - 20}`;
        for (const [fx, h] of peaks) d += ` L${q2(g.W * fx)} ${q2(hz - h)}`;
        d += ` L${q2(g.W + 20)} ${q2(hz - 10)} L${q2(g.W + 20)} ${hz + 70} Z`;
        return (
          <G>
            <Path d={d} fill="#96AAE8" />
            {peaks.filter(([, h]) => h > 90).map(([fx, h], i) => {
              const px = g.W * fx;
              const py = hz - h;
              return <Path key={i} d={`M${q2(px)} ${q2(py)} L${q2(px - 22)} ${q2(py + 32)} Q${q2(px - 9)} ${q2(py + 24)} ${q2(px)} ${q2(py + 34)} Q${q2(px + 10)} ${q2(py + 24)} ${q2(px + 22)} ${q2(py + 32)} Z`} fill="#F6FAFF" />;
            })}
          </G>
        );
      },
    },
    {
      p: 0.3,
      draw: (g) => (
        <>
          <Path d={ridgePath(g.W, g.horizon - 24, 64, 1.7, g.horizon + 100)} fill="#6DBE94" />
          <Treeline W={g.W} base={g.horizon - 24} amp={64} phase={1.7} color="#4BA47A" seed={4} />
        </>
      ),
    },
    {
      p: 0.52,
      draw: (g) => (
        <>
          <Path d={ridgePath(g.W, g.horizon - 2, 44, 2.6, g.horizon + 100)} fill="#3FA25A" />
          <Treeline W={g.W} base={g.horizon - 2} amp={44} phase={2.6} color="#2B8A4C" seed={9} step={13} size={[14, 30]} />
        </>
      ),
    },
  ],

  defs: (g) => (
    <>
      <SvgLinear id="fo-ground" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon} x2="0" y2={g.H}>
        <Stop offset="0" stopColor="#6ED24E" />
        <Stop offset="0.3" stopColor="#3FAE46" />
        <Stop offset="1" stopColor="#1F7F36" />
      </SvgLinear>
      <SvgRadial id="fo-patch" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#B4F27A" stopOpacity="0.65" />
        <Stop offset="1" stopColor="#B4F27A" stopOpacity="0" />
      </SvgRadial>
      <SvgRadial id="fo-shade" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#0B4A22" stopOpacity="0.4" />
        <Stop offset="1" stopColor="#0B4A22" stopOpacity="0" />
      </SvgRadial>
      <SvgLinear id="fo-fall" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
        <Stop offset="1" stopColor="#8FE4FF" stopOpacity="0.85" />
      </SvgLinear>
    </>
  ),

  terrain: (g) => {
    const r = seeded(11);
    const { edge, fill: d } = groundPaths(g.W, g.H, (x) => groundTop(g, x));
    let river = '';
    for (let y = g.horizon + 14; y <= g.H + 30; y += 16) river += `${river ? ' L' : 'M'}${q2(riverX(g, y))} ${y}`;
    const patches = Array.from({ length: 24 }, () => ({
      x: r() * g.W, y: g.horizon + 30 + r() * (g.H - g.horizon - 30), rx: 60 + r() * 110, ry: 26 + r() * 52,
    }));
    const shades = Array.from({ length: 26 }, (_, i) => ({
      x: (i % 2 ? g.W * 0.02 : g.W * 0.8) + r() * g.W * 0.16, y: g.horizon + 30 + r() * (g.H - g.horizon - 30),
      rx: 50 + r() * 60, ry: 30 + r() * 44,
    }));
    const stripes = Array.from({ length: 18 }, () => ({
      x: r() * g.W, y: g.horizon + 40 + r() * (g.H - g.horizon - 50), w: 40 + r() * 90,
    }));
    return (
      <>
        <Path d={d} fill="url(#fo-ground)" />
        {patches.map((p, i) => <Ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#fo-patch)" />)}
        {shades.map((p, i) => <Ellipse key={`s${i}`} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#fo-shade)" />)}
        {stripes.map((s, i) => (
          <Path key={i} d={`M${q2(s.x)} ${q2(s.y)} q${q2(s.w / 2)} -6 ${q2(s.w)} 0`} stroke="#1F7F36" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.3} />
        ))}
        <Path d={edge} fill="none" stroke="#A6EE7A" strokeWidth={4} opacity={0.75} />

        {/* the river down the right-hand side, with its sandy banks */}
        <Path d={river} fill="none" stroke="#000000" strokeOpacity={0.12} strokeWidth={g.W * 0.2} strokeLinecap="round" />
        <Path d={river} fill="none" stroke="#F0E2A8" strokeWidth={g.W * 0.18} strokeLinecap="round" />
        <Path d={river} fill="none" stroke="#3AB5F0" strokeWidth={g.W * 0.15} strokeLinecap="round" />
        <Path d={river} fill="none" stroke="#9EE3FF" strokeOpacity={0.6} strokeWidth={g.W * 0.07} strokeLinecap="round" />
        <Path d={river} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2.2} strokeDasharray="14 22" strokeLinecap="round" />
      </>
    );
  },

  inWater: (g, x, y) => y > g.horizon + 24 && x > riverX(g, y) - g.W * 0.095,

  decor,
  landmark: (g, x) => <Tunnel x={x} y={g.horizon + 40} />,

  ambient: {
    sky: (g) => (
      <>
        <CloudDrift W={g.W} y={g.headerH * 0.62} s={96} duration={150000} phase={0.15} color="#FFFFFF" shade="#D6ECFF" />
        <CloudDrift W={g.W} y={g.headerH + 70} s={70} duration={200000} phase={0.6} o={0.9} shade="#D6ECFF" />
      </>
    ),
    front: (g) => (
      <>
        <Falling W={g.W} H={g.screenH} count={10} color="#FFF3B0" size={[3, 6]} speed={[14000, 24000]} sway={26} seed={12} />
        <Drift W={g.W} y={g.screenH * 0.46} w={26} h={20} duration={26000} phase={0.2} bob={7}><Butterfly c="#FFB43C" /></Drift>
        <Drift W={g.W} y={g.screenH * 0.6} w={26} h={20} duration={34000} phase={0.7} dir={-1} bob={9}><Butterfly c="#FF7AC8" /></Drift>
      </>
    ),
  },
};
