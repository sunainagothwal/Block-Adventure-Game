/* World 2 — SUNNY BEACH: turquoise sea down one side, warm sand, a lighthouse ahead. */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient as SvgRadial, Rect, Stop,
} from 'react-native-svg';
import { CloudDrift, Drift } from './ambient';
import {
  Bird, Buoy, BeachBall, Bush, Crab, Palm, Place, Rock, Sailboat, Sandcastle, Shell, Starfish, Surfboard,
  Tuft, Umbrella, type Pal,
} from './props';
import { Cliff, Deckchair, StiltHut } from './scenery';
import type { DecorKind, SceneGeom, WorldDef } from './types';
import { q2, seeded } from './util';

const PALM: Pal = { dark: '#1E9A4C', mid: '#3BC262', light: '#A4F07E', outline: '#136B34', trunk: '#A06E3C' };
const SANDSTONE: Pal = { dark: '#B39A72', mid: '#D6C298', light: '#F6EAD0', outline: '#8A7550', trunk: '' };
const SEAROCK: Pal = { dark: '#6C7C86', mid: '#98A8B2', light: '#D6E2E8', outline: '#4A5A64', trunk: '' };
const HEADLAND: Pal = { dark: '#B8844A', mid: '#DDB27A', light: '#F8E2B4', outline: '#8A5A2E', trunk: '' };
const DUNEGRASS: Pal = { dark: '#5DA84A', mid: '#7BC55E', light: '#B8EE8A', outline: '#3C7A34', trunk: '' };

const shoreX = (g: SceneGeom, y: number) =>
  g.W * 0.8 + Math.sin(y * 0.010 + 1) * g.W * 0.035 + Math.sin(y * 0.027) * g.W * 0.012;
const groundTop = (g: SceneGeom, x: number) =>
  g.horizon + 10 + Math.sin((x / g.W) * Math.PI * 2 * 1.6 + 0.4) * 4 + Math.sin((x / g.W) * Math.PI * 2 * 4.1) * 1.8;

const UMBRELLAS: [string, string][] = [['#FF5A6E', '#FFFFFF'], ['#3FA9F5', '#FFFFFF'], ['#FFC93C', '#FFFFFF'], ['#7BD86A', '#FFFFFF']];
const BOARDS = ['#FF5A6E', '#3FA9F5', '#FFC93C', '#B47AFF'];

function Lighthouse({ x, y }: { x: number; y: number }) {
  const hw = (h: number) => 15 - (6 * h) / 86;
  const band = (h0: number, h1: number, c: string) => (
    <Path key={h0} d={`M${q2(-hw(h0))} ${-h0} L${q2(-hw(h1))} ${-h1} L${q2(hw(h1))} ${-h1} L${q2(hw(h0))} ${-h0} Z`} fill={c} />
  );
  return (
    <G>
      <Rock x={x - 46} y={y + 8} s={44} pal={SEAROCK} />
      <Rock x={x + 48} y={y + 10} s={36} pal={SEAROCK} />
      <Place x={x} y={y} s={100}>
        <Ellipse cx={0} cy={3} rx={40} ry={8} fill="#000000" opacity={0.17} />
        <Path d="M-30 4 Q-26 -14 -12 -14 H12 Q26 -14 30 4 Z" fill="#B7A587" stroke="#7A6A4E" strokeWidth={2.4} strokeLinejoin="round" />
        {/* light beams */}
        <Path d="M0 -98 L-130 -124 L-130 -72 Z" fill="url(#bc-beamL)" />
        <Path d="M0 -98 L130 -124 L130 -72 Z" fill="url(#bc-beamR)" />
        {band(0, 18, '#FFFFFF')}
        {band(18, 36, '#E8543E')}
        {band(36, 54, '#FFFFFF')}
        {band(54, 72, '#E8543E')}
        {band(72, 86, '#FFFFFF')}
        <Path d={`M${-hw(0)} 0 L${-hw(86)} -86 L${hw(86)} -86 L${hw(0)} 0 Z`} fill="none" stroke="#7A3A2E" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M-11 -8 L-8 -80" stroke="#FFFFFF" strokeWidth={3} opacity={0.35} strokeLinecap="round" />
        <Path d="M-4 0 V-10 A4 4 0 0 1 4 -10 V0 Z" fill="#5A3A24" />
        <Rect x={-8} y={-52} width={5} height={7} rx={1.5} fill="#3A4A6A" />
        <Rect x={-19} y={-93} width={38} height={7} rx={1.5} fill="#5A6A7A" stroke="#3A4A5A" strokeWidth={2} />
        <Rect x={-10} y={-108} width={20} height={15} fill="#FFE98A" stroke="#7A6A3A" strokeWidth={2.2} />
        <Path d="M-6 -106 V-95 M0 -106 V-95 M6 -106 V-95" stroke="#C9A93A" strokeWidth={1.2} />
        <Path d="M-14 -108 L0 -124 L14 -108 Z" fill="#E8543E" stroke="#7A3A2E" strokeWidth={2.2} strokeLinejoin="round" />
        <Circle cx={0} cy={-127} r={2.6} fill="#5A6A7A" />
      </Place>
      <Palm x={x + 80} y={y + 16} s={74} pal={PALM} lean={-1} />
      <Palm x={x - 84} y={y + 18} s={66} pal={PALM} lean={1} />
    </G>
  );
}

const decor: DecorKind[] = [
  { id: 'palm', weight: 5, size: [82, 114], where: 'edge', draw: (p) => <Palm {...p} pal={PALM} lean={p.v % 2 ? 1 : -1} /> },
  {
    id: 'headland', weight: 3, size: [100, 140], where: 'edge', spread: 1.1,
    draw: (p) => <Cliff {...p} pal={HEADLAND} cap="#6FCB58" bands="#9A6A38" flip={p.v % 2 === 0} />,
  },
  { id: 'hut', weight: 1.4, size: [80, 100], where: 'edge', spread: 1.6, draw: (p) => <StiltHut {...p} flip={p.v % 2 === 0} /> },
  { id: 'chair', weight: 1.5, size: [40, 52], where: 'any', spread: 1.3, draw: (p) => <Deckchair {...p} c={UMBRELLAS[p.v % 4][0]} /> },
  {
    id: 'umbrella', weight: 3, size: [58, 78], where: 'any', spread: 1.2,
    draw: (p) => <Umbrella {...p} a={UMBRELLAS[p.v % 4][0]} b={UMBRELLAS[p.v % 4][1]} tilt={p.v % 2 ? 8 : -8} />,
  },
  { id: 'rock', weight: 2, size: [18, 30], where: 'near', draw: (p) => <Rock {...p} pal={SANDSTONE} /> },
  { id: 'starfish', weight: 3, size: [17, 23], where: 'near', draw: (p) => <Starfish {...p} c={p.v % 2 ? '#FF9A4A' : '#FF6F8E'} /> },
  { id: 'shell', weight: 3, size: [15, 21], where: 'near', draw: (p) => <Shell {...p} c={p.v % 2 ? '#FFD6E0' : '#FFF0C8'} /> },
  { id: 'crab', weight: 2, size: [22, 30], where: 'near', draw: (p) => <Crab {...p} /> },
  { id: 'castle', weight: 1, size: [40, 52], where: 'any', spread: 1.3, draw: (p) => <Sandcastle {...p} /> },
  { id: 'ball', weight: 1, size: [20, 26], where: 'near', draw: (p) => <BeachBall {...p} /> },
  { id: 'board', weight: 2, size: [52, 70], where: 'any', draw: (p) => <Surfboard {...p} c={BOARDS[p.v % 4]} tilt={p.v % 2 ? 9 : -9} /> },
  { id: 'grass', weight: 4, size: [22, 32], where: 'any', draw: (p) => <Tuft {...p} c="#7BC55E" c2="#4FA55A" /> },
  { id: 'dune', weight: 1, size: [28, 38], where: 'any', draw: (p) => <Bush {...p} pal={DUNEGRASS} /> },
  { id: 'boat', weight: 2, size: [42, 58], where: 'water', spread: 2.4, draw: (p) => <Sailboat {...p} /> },
  { id: 'buoy', weight: 2, size: [26, 34], where: 'water', spread: 2, draw: (p) => <Buoy {...p} /> },
  { id: 'searock', weight: 1, size: [34, 50], where: 'water', spread: 2, draw: (p) => <Rock {...p} pal={SEAROCK} /> },
];

export const beach: WorldDef = {
  name: 'Beach World',
  area: 'Sunny Beach',
  blurb: 'Warm sand, cool water, and a lighthouse',
  base: '#E4BC66',
  skyStops: ['#36B0F3', '#7FD6FF', '#D4F3FF'],
  accent: '#3FD0E0',
  pathShape: { centre: 0.4, swing: 0.24, wave: 1.05, phase: 1.2 },
  road: {
    edge: '#C08A4A', fill: '#FFEFC4', dash: '#FFFFFF', width: 32,
    walkedEdge: '#E0902B', walkedFill: '#FFD86A', walkedDash: '#FFF8D2',
  },

  sky: (g) => {
    const sx = g.W * 0.78;
    const sy = g.headerH + 34;
    return (
      <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadial id="bc-sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFBD0" stopOpacity="1" />
            <Stop offset="0.35" stopColor="#FFF3A0" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFF3A0" stopOpacity="0" />
          </SvgRadial>
        </Defs>
        <Circle cx={sx} cy={sy} r={110} fill="url(#bc-sun)" />
        <Circle cx={sx} cy={sy} r={32} fill="#FFE55A" />
        <Circle cx={sx} cy={sy} r={26} fill="#FFF7B8" />
      </Svg>
    );
  },

  far: [
    {
      // the open sea, out to the horizon
      p: 0.3,
      draw: (g) => {
        const r = seeded(21);
        const top = g.horizon - 40;
        const streaks = Array.from({ length: 26 }, () => ({ x: r() * g.W, y: top + 8 + r() * 70, w: 14 + r() * 40 }));
        return (
          <>
            <Rect x={0} y={top} width={g.W} height={140} fill="url(#bc-sea)" />
            <Path d={`M0 ${top} H${g.W}`} stroke="#DFF7FF" strokeWidth={2} opacity={0.8} />
            {streaks.map((s, i) => (
              <Path key={i} d={`M${q2(s.x)} ${q2(s.y)} h${q2(s.w)}`} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.28 + (i % 3) * 0.1} />
            ))}
            {/* a far-off island with two palms */}
            <Path d={`M${g.W * 0.08} ${top} Q${g.W * 0.16} ${top - 30} ${g.W * 0.3} ${top - 6} L${g.W * 0.32} ${top} Z`} fill="#4FA87A" />
            <Path d={`M${g.W * 0.12} ${top} Q${g.W * 0.19} ${top - 20} ${g.W * 0.28} ${top - 4} L${g.W * 0.3} ${top} Z`} fill="#3E9668" />
            <Path d={`M${g.W * 0.18} ${top - 14} q3 -12 3 -20 M${g.W * 0.24} ${top - 10} q-2 -10 -2 -16`} stroke="#2E7A56" strokeWidth={2} strokeLinecap="round" fill="none" />
            <Path d={`M${g.W * 0.18 - 8} ${top - 30} q8 -6 16 0 M${g.W * 0.24 - 7} ${top - 24} q7 -6 14 0`} stroke="#2E7A56" strokeWidth={2} strokeLinecap="round" fill="none" />
            <Place x={g.W * 0.6} y={top + 6} s={32}><Sailboat x={0} y={0} s={100} /></Place>
          </>
        );
      },
    },
    {
      // long rolling crests nearer the shore
      p: 0.5,
      draw: (g) => {
        const rows = [g.horizon - 10, g.horizon + 4, g.horizon + 18, g.horizon + 32];
        return (
          <>
            {rows.map((y, i) => {
              let d = `M-20 ${y}`;
              for (let x = -20; x < g.W + 20; x += 34) d += ` q8.5 -${5 + i} 17 0 t17 0`;
              return <Path key={i} d={d} stroke="#FFFFFF" strokeWidth={2.2 + i * 0.4} fill="none" strokeLinecap="round" opacity={0.3 + i * 0.09} transform={`translate(${(i % 2) * 12} 0)`} />;
            })}
          </>
        );
      },
    },
  ],

  defs: (g) => (
    <>
      <SvgLinear id="bc-sea" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon - 40} x2="0" y2={g.horizon + 100}>
        <Stop offset="0" stopColor="#1FA8DE" />
        <Stop offset="0.55" stopColor="#4CD0EA" />
        <Stop offset="1" stopColor="#8EEDF0" />
      </SvgLinear>
      <SvgLinear id="bc-beamL" x1="1" y1="0" x2="0" y2="0">
        <Stop offset="0" stopColor="#FFF6C0" stopOpacity="0.5" />
        <Stop offset="1" stopColor="#FFF6C0" stopOpacity="0" />
      </SvgLinear>
      <SvgLinear id="bc-beamR" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFF6C0" stopOpacity="0.5" />
        <Stop offset="1" stopColor="#FFF6C0" stopOpacity="0" />
      </SvgLinear>
      <SvgLinear id="bc-sand" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon} x2="0" y2={g.H}>
        <Stop offset="0" stopColor="#FFF0BE" />
        <Stop offset="0.3" stopColor="#F6DA96" />
        <Stop offset="1" stopColor="#E7BF6A" />
      </SvgLinear>
      <SvgLinear id="bc-water" gradientUnits="userSpaceOnUse" x1={g.W * 0.78} y1="0" x2={g.W} y2="0">
        <Stop offset="0" stopColor="#9BF0E8" />
        <Stop offset="0.35" stopColor="#3FD0E0" />
        <Stop offset="1" stopColor="#1596CC" />
      </SvgLinear>
    </>
  ),

  terrain: (g) => {
    const r = seeded(31);
    let sand = `M-20 ${g.H + 20}`;
    for (let x = -20; x <= g.W + 20; x += 12) sand += ` L${q2(x)} ${q2(groundTop(g, x))}`;
    sand += ` L${g.W + 20} ${g.H + 20} Z`;
    let top = '';
    for (let x = -20; x <= g.W + 20; x += 12) top += `${top ? ' L' : 'M'}${q2(x)} ${q2(groundTop(g, x))}`;

    let shore = '';
    for (let y = g.horizon + 6; y <= g.H + 30; y += 14) shore += `${shore ? ' L' : 'M'}${q2(shoreX(g, y))} ${y}`;
    const sea = `${shore} L${g.W + 30} ${g.H + 30} L${g.W + 30} ${g.horizon + 6} Z`;

    const ripples = Array.from({ length: 30 }, () => ({
      x: r() * g.W * 0.8, y: g.horizon + 40 + r() * (g.H - g.horizon - 50), w: 30 + r() * 80,
    }));
    const waves = Array.from({ length: 14 }, () => ({
      x: shoreX(g, 0) + 10 + r() * g.W * 0.12, y: g.horizon + 30 + r() * (g.H - g.horizon - 40), w: 16 + r() * 30,
    }));
    return (
      <>
        <Path d={sand} fill="url(#bc-sand)" />
        {ripples.map((p, i) => (
          <Path key={i} d={`M${q2(p.x)} ${q2(p.y)} q${q2(p.w / 2)} -5 ${q2(p.w)} 0`} stroke="#D9B26A" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.4} />
        ))}
        {/* wet sand + surf along the top edge, where the horizon sea laps the beach */}
        <Path d={top} fill="none" stroke="#D9B872" strokeWidth={16} opacity={0.55} transform="translate(0 6)" />
        <Path d={top} fill="none" stroke="#A8F0EE" strokeWidth={9} opacity={0.85} transform="translate(0 -1)" />
        <Path d={top} fill="none" stroke="#FFFFFF" strokeWidth={4.4} strokeDasharray="22 7" strokeLinecap="round" opacity={0.95} />

        {/* the sea down the right-hand side */}
        <Path d={shore} fill="none" stroke="#D9B872" strokeWidth={22} opacity={0.5} transform="translate(-6 0)" />
        <Path d={sea} fill="url(#bc-water)" />
        <Path d={shore} fill="none" stroke="#B8F6F0" strokeWidth={14} opacity={0.75} transform="translate(6 0)" />
        <Path d={shore} fill="none" stroke="#FFFFFF" strokeWidth={5} strokeDasharray="26 8" strokeLinecap="round" />
        {waves.map((w, i) => (
          <Path key={i} d={`M${q2(w.x)} ${q2(w.y)} q${q2(w.w / 4)} -5 ${q2(w.w / 2)} 0 t${q2(w.w / 2)} 0`} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.55} />
        ))}
      </>
    );
  },

  inWater: (g, x, y) => x > shoreX(g, y) - g.W * 0.045 && y > g.horizon,

  decor,
  landmark: (g, x) => <Lighthouse x={x} y={g.horizon + 36} />,

  ambient: {
    sky: (g) => (
      <>
        <CloudDrift W={g.W} y={g.headerH * 0.7} s={104} duration={170000} phase={0.3} shade="#D6ECFF" />
        <CloudDrift W={g.W} y={g.headerH + 62} s={72} duration={230000} phase={0.75} o={0.92} shade="#D6ECFF" />
        <Drift W={g.W} y={g.headerH + 40} w={34} h={16} duration={38000} phase={0.1} bob={5}>
          <Svg width={34} height={16} viewBox="-30 -14 60 28"><Bird x={0} y={0} s={100} c="#FFFFFF" /></Svg>
        </Drift>
        <Drift W={g.W} y={g.headerH + 78} w={26} h={12} duration={46000} phase={0.55} dir={-1} bob={4}>
          <Svg width={26} height={12} viewBox="-30 -14 60 28"><Bird x={0} y={0} s={100} c="#F4F8FF" /></Svg>
        </Drift>
      </>
    ),
  },
};
