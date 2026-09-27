/* World 5 — NIGHT SKY: twinkling stars, an aurora, glowing crystals, an observatory. */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient as SvgRadial, Rect, Stop,
} from 'react-native-svg';
import { Breathe, Fireflies, ShootingStar, Twinkle } from './ambient';
import {
  Bush, Crystals, GlowMushroom, Lantern, MoonFlower, Place, RoundTree, Rock, StarShape, Tuft, Treeline, type Pal,
} from './props';
import { Castle, CloudBank, FloatIsle } from './scenery';
import type { DecorKind, SceneGeom, WorldDef } from './types';
import { groundPaths, q2, ridgePath, seeded } from './util';

const LEAF: Pal = { dark: '#3A2A9A', mid: '#5B3FCC', light: '#B8A2FF', outline: '#1E1458', trunk: '#2E2070' };
const CYAN: Pal = { dark: '#2A8FA8', mid: '#5CE6F0', light: '#DFFFFF', outline: '#1B5A88', trunk: '' };
const VIOLET: Pal = { dark: '#5B2FC8', mid: '#9B72FF', light: '#E4D6FF', outline: '#2A1A66', trunk: '' };
const STONE: Pal = { dark: '#4E3E92', mid: '#6E5AB0', light: '#A896E8', outline: '#2A1A66', trunk: '' };
const SHRUB: Pal = { dark: '#3A2E8A', mid: '#4E3EB0', light: '#8A78F0', outline: '#20146A', trunk: '' };

const lake = (g: SceneGeom) => ({ x: g.W * 0.84, y: g.horizon + 500, rx: g.W * 0.2, ry: 68 });
const groundTop = (g: SceneGeom, x: number) =>
  g.horizon + 10 + Math.sin((x / g.W) * Math.PI * 2 * 1.2 + 0.3) * 8 + Math.sin((x / g.W) * Math.PI * 2 * 3.4) * 3;

function Lotus({ x, y, s, v }: { x: number; y: number; s: number; v: number }) {
  const c = v % 2 ? '#FF7AD9' : '#5CE6F0';
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-8} rx={34} ry={20} fill={c} opacity={0.14} />
      <Ellipse cx={0} cy={-4} rx={24} ry={8} fill="#2A5A8A" stroke="#7AB8E8" strokeWidth={1.6} />
      <Path d="M-3 -6 Q-11 -20 0 -26 Q11 -20 3 -6 Z" fill={c} />
      <Path d="M-9 -6 Q-19 -14 -10 -21 Q-4 -16 -3 -6 Z M9 -6 Q19 -14 10 -21 Q4 -16 3 -6 Z" fill={c} opacity={0.75} />
      <Circle cx={0} cy={-12} r={2.6} fill="#FFF6C8" />
    </Place>
  );
}

function Observatory({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Crystals x={x - 92} y={y + 8} s={56} pal={CYAN} glow="#5CE6F0" />
      <Crystals x={x + 96} y={y + 10} s={48} pal={VIOLET} glow="#B08CFF" />
      <Lantern x={x - 56} y={y + 12} s={52} />
      <Lantern x={x + 58} y={y + 14} s={48} />
      <Place x={x} y={y} s={100}>
        <Path d="M0 -98 L-40 -230 L40 -230 Z" fill="url(#nt-beam)" />
        <Ellipse cx={0} cy={4} rx={54} ry={9} fill="#000000" opacity={0.3} />
        <Path d="M-40 4 Q-30 -10 0 -10 Q30 -10 40 4 Z" fill="#3A2A8A" stroke="#1E1458" strokeWidth={2.4} />
        <Path d="M-20 -6 L-15 -62 L15 -62 L20 -6 Z" fill="#5A48B8" stroke="#1E1458" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M-15 -62 L-19 -8 L-9 -8 L-7 -62 Z" fill="#8E7CF0" opacity={0.55} />
        <Rect x={-4} y={-16} width={8} height={10} rx={4} fill="#20146A" />
        <Rect x={-6} y={-46} width={12} height={9} rx={2} fill="#FFE98A" stroke="#20146A" strokeWidth={1.6} />
        <Path d="M-26 -62 A26 26 0 0 1 26 -62 Z" fill="#8A6CFF" stroke="#1E1458" strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M-26 -62 A26 26 0 0 1 -10 -84 L-4 -62 Z" fill="#B8A2FF" opacity={0.6} />
        <Path d="M2 -87 L10 -85 L14 -62 L4 -62 Z" fill="#20146A" />
        <Path d="M8 -80 L36 -110" stroke="#1E1458" strokeWidth={11} strokeLinecap="round" />
        <Path d="M8 -80 L36 -110" stroke="#C8BAFF" strokeWidth={7} strokeLinecap="round" />
        <Circle cx={38} cy={-112} r={5} fill="#FFF6C8" />
        <Path d="M0 -88 V-100" stroke="#1E1458" strokeWidth={2.4} />
        <StarShape cx={0} cy={-106} r={7} fill="#FFE98A" />
      </Place>
    </G>
  );
}

const decor: DecorKind[] = [
  { id: 'tree', weight: 3, size: [70, 104], where: 'edge', draw: (p) => <RoundTree {...p} pal={LEAF} /> },
  {
    id: 'isle', weight: 5, size: [96, 140], where: 'edge', spread: 1.1,
    draw: (p) => <FloatIsle {...p} glow={p.v % 2 ? '#5CE6F0' : '#FF7AD9'} top={p.v % 2 ? '#7C5CE0' : '#6A4CCF'} flip={p.v % 2 === 0} />,
  },
  { id: 'cloudbank', weight: 3, size: [70, 100], where: 'any', spread: 1.4, draw: (p) => <CloudBank {...p} /> },
  {
    id: 'crystal', weight: 4, size: [36, 60], where: 'any',
    draw: (p) => <Crystals {...p} pal={p.v % 2 ? CYAN : VIOLET} glow={p.v % 2 ? '#5CE6F0' : '#B08CFF'} />,
  },
  {
    id: 'shroom', weight: 4, size: [24, 36], where: 'near',
    draw: (p) => (p.v % 2
      ? <GlowMushroom {...p} glow="#5CE6F0" cap="#3AB8D8" />
      : <GlowMushroom {...p} glow="#FF7AD9" cap="#D84AB0" />),
  },
  { id: 'moonflower', weight: 4, size: [36, 50], where: 'near', draw: (p) => <MoonFlower {...p} glow="#B8A2FF" petal={p.v % 2 ? '#E4D6FF' : '#BDF4FF'} /> },
  { id: 'lantern', weight: 1, size: [54, 70], where: 'near', spread: 2.4, draw: (p) => <Lantern {...p} /> },
  { id: 'rock', weight: 2, size: [18, 30], where: 'near', draw: (p) => <Rock {...p} pal={STONE} /> },
  { id: 'tuft', weight: 3, size: [22, 32], where: 'any', draw: (p) => <Tuft {...p} c="#6EE8E0" c2="#4A3EB0" /> },
  { id: 'shrub', weight: 3, size: [26, 38], where: 'any', draw: (p) => <Bush {...p} pal={SHRUB} berries="#FFE58A" /> },
  { id: 'lotus', weight: 4, size: [28, 38], where: 'water', spread: 1.6, draw: (p) => <Lotus {...p} /> },
];

export const night: WorldDef = {
  name: 'Night Sky World',
  area: 'Night Sky',
  blurb: 'Stargazing under an aurora',
  base: '#20135A',
  skyStops: ['#080428', '#1E1268', '#5A2E96', '#E888B4'],
  accent: '#B08CFF',
  pathShape: { centre: 0.5, swing: 0.27, wave: 0.9, phase: 1.0 },
  road: {
    edge: '#2A1A66', fill: '#CDBBFF', dash: '#FFFFFF', width: 30,
    walkedEdge: '#C8842A', walkedFill: '#FFD66A', walkedDash: '#FFF6C8',
  },

  sky: (g) => {
    const r = seeded(61);
    const stars = Array.from({ length: 78 }, () => ({
      x: r() * g.W, y: 6 + r() * (g.horizon - 10), r: 0.6 + r() * 1.5, o: 0.5 + r() * 0.5,
    }));
    const groups = [0, 1, 2].map((k) => stars.filter((_, i) => i % 3 === k));
    const sparkles = Array.from({ length: 9 }, () => ({ x: r() * g.W, y: 10 + r() * (g.horizon - 40), r: 3 + r() * 3 }));
    const mx = g.W * 0.115;
    const my = g.headerH * 0.78;
    return (
      <>
        {groups.map((grp, k) => (
          <Twinkle key={k} period={2400 + k * 1100} delay={k * 700} min={0.3}>
            <Svg width={g.W} height={g.screenH}>
              {grp.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />)}
            </Svg>
          </Twinkle>
        ))}
        <Twinkle period={3200} delay={400} min={0.4}>
          <Svg width={g.W} height={g.screenH}>
            {sparkles.map((s, i) => <StarShape key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 3 === 0 ? '#BDF4FF' : '#FFF6D0'} />)}
          </Svg>
        </Twinkle>
        <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadial id="nt-moon" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFF1C0" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#FFF1C0" stopOpacity="0" />
            </SvgRadial>
            <SvgRadial id="nt-planet" cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor="#FFB8E0" />
              <Stop offset="1" stopColor="#C8509A" />
            </SvgRadial>
          </Defs>
          <Circle cx={mx} cy={my} r={92} fill="url(#nt-moon)" />
          <Path d={`M${mx + 10} ${my - 26} A30 30 0 1 0 ${mx + 10} ${my + 26} A26 26 0 0 1 ${mx + 10} ${my - 26} Z`} fill="#FFF3C8" />
          <Path d={`M${mx - 14} ${my - 12} q3 -3 6 0 M${mx - 20} ${my + 8} q2 -2 5 0`} stroke="#E8D8A0" strokeWidth={2} fill="none" strokeLinecap="round" />
          <G transform={`translate(${g.W * 0.87} ${g.headerH * 0.82})`}>
            <Ellipse cx={0} cy={0} rx={26} ry={7} fill="none" stroke="#FFD0F0" strokeWidth={2.6} opacity={0.7} transform="rotate(-18)" />
            <Circle cx={0} cy={0} r={13} fill="url(#nt-planet)" />
            <Path d="M-24 4 Q0 12 24 -4" fill="none" stroke="#FFD0F0" strokeWidth={2.6} opacity={0.9} transform="rotate(-18)" />
          </G>
        </Svg>
      </>
    );
  },

  far: [
    {
      p: 0.18,
      draw: (g) => (
        <Path d={ridgePath(g.W, g.horizon - 30, 100, 0.9, g.horizon + 100, [[2.1, 1], [4.4, 0.6], [9.3, 0.3]])} fill="#382682" />
      ),
    },
    {
      p: 0.42,
      draw: (g) => (
        <>
          <Path d={ridgePath(g.W, g.horizon - 4, 60, 2.7, g.horizon + 100, [[1.7, 1], [3.9, 0.5], [7.7, 0.25]])} fill="#281A6E" />
          <Treeline W={g.W} base={g.horizon - 4} amp={60} phase={2.7} color="#1A1058" seed={6} waves={[[1.7, 1], [3.9, 0.5], [7.7, 0.25]]} />
        </>
      ),
    },
  ],

  defs: (g) => (
    <>
      <SvgLinear id="nt-ground" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon} x2="0" y2={g.H}>
        <Stop offset="0" stopColor="#5A3CB4" />
        <Stop offset="0.3" stopColor="#3C2686" />
        <Stop offset="1" stopColor="#22145E" />
      </SvgLinear>
      <SvgLinear id="nt-beam" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#FFF6C8" stopOpacity="0.32" />
        <Stop offset="1" stopColor="#FFF6C8" stopOpacity="0" />
      </SvgLinear>
      <SvgRadial id="nt-patch" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#8A6CFF" stopOpacity="0.55" />
        <Stop offset="1" stopColor="#8A6CFF" stopOpacity="0" />
      </SvgRadial>
      <SvgRadial id="nt-water" cx="50%" cy="35%" r="75%">
        <Stop offset="0" stopColor="#8A7CFF" />
        <Stop offset="0.6" stopColor="#4A3ABA" />
        <Stop offset="1" stopColor="#2A1E88" />
      </SvgRadial>
    </>
  ),

  terrain: (g) => {
    const r = seeded(71);
    const { edge, fill: d } = groundPaths(g.W, g.H, (x) => groundTop(g, x));
    const patches = Array.from({ length: 22 }, () => ({
      x: r() * g.W, y: g.horizon + 30 + r() * (g.H - g.horizon - 30), rx: 60 + r() * 110, ry: 26 + r() * 50,
    }));
    const glitter = Array.from({ length: 64 }, () => ({
      x: r() * g.W, y: g.horizon + 20 + r() * (g.H - g.horizon - 30), s: 1.6 + r() * 3, c: ['#5CE6F0', '#FF7AD9', '#FFE58A', '#FFFFFF'][Math.floor(r() * 4)], o: 0.4 + r() * 0.6,
    }));
    const l = lake(g);
    return (
      <>
        <Path d={d} fill="url(#nt-ground)" />
        {patches.map((p, i) => <Ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#nt-patch)" />)}
        <Path d={edge} fill="none" stroke="#B8A2FF" strokeWidth={4} opacity={0.5} />
        {glitter.map((s, i) => <StarShape key={i} cx={s.x} cy={s.y} r={s.s} fill={s.c} o={s.o} />)}

        {/* a still lake holding the moon */}
        <Ellipse cx={l.x} cy={l.y} rx={l.rx + 16} ry={l.ry + 14} fill="#B8A2FF" opacity={0.18} />
        <Ellipse cx={l.x} cy={l.y + 3} rx={l.rx + 8} ry={l.ry + 6} fill="#1E1458" />
        <Ellipse cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} fill="url(#nt-water)" stroke="#B8A2FF" strokeWidth={2.4} />
        <Ellipse cx={l.x - l.rx * 0.2} cy={l.y - l.ry * 0.1} rx={l.rx * 0.22} ry={l.ry * 0.5} fill="#FFF3C8" opacity={0.85} />
        <Ellipse cx={l.x - l.rx * 0.2} cy={l.y - l.ry * 0.1} rx={l.rx * 0.34} ry={l.ry * 0.7} fill="#FFF3C8" opacity={0.18} />
        <Path d={`M${q2(l.x - l.rx * 0.6)} ${q2(l.y + l.ry * 0.3)} h${q2(l.rx * 0.7)} M${q2(l.x - l.rx * 0.1)} ${q2(l.y + l.ry * 0.55)} h${q2(l.rx * 0.6)} M${q2(l.x - l.rx * 0.5)} ${q2(l.y - l.ry * 0.5)} h${q2(l.rx * 0.5)}`} stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" opacity={0.4} />
        {[[0.4, -0.3], [0.55, 0.15], [-0.6, 0.1], [0.05, 0.5], [-0.35, -0.45]].map(([dx, dy], i) => (
          <StarShape key={i} cx={l.x + dx * l.rx} cy={l.y + dy * l.ry} r={3.4} fill="#FFFFFF" o={0.85} />
        ))}
      </>
    );
  },

  inWater: (g, x, y) => {
    const l = lake(g);
    const dx = (x - l.x) / (l.rx + 22);
    const dy = (y - l.y) / (l.ry + 18);
    return dx * dx + dy * dy < 1;
  },

  decor,
  landmark: (g, x) => (
    <G>
      <Crystals x={x - 104} y={g.horizon + 48} s={56} pal={CYAN} glow="#5CE6F0" />
      <Crystals x={x + 108} y={g.horizon + 50} s={48} pal={VIOLET} glow="#B08CFF" />
      <Lantern x={x - 70} y={g.horizon + 52} s={52} />
      <Lantern x={x + 72} y={g.horizon + 54} s={48} />
      <Castle x={x} y={g.horizon + 46} s={128} />
    </G>
  ),

  ambient: {
    sky: (g) => (
      <>
        <Breathe period={9000} amp={0.02} min={0.55} style={StyleSheet.absoluteFill}>
          <Svg width={g.W} height={g.screenH}>
            <Defs>
              <SvgLinear id="nt-aur1" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#5CFFC0" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#5CFFC0" stopOpacity="0.32" />
                <Stop offset="1" stopColor="#5CD0FF" stopOpacity="0" />
              </SvgLinear>
              <SvgLinear id="nt-aur2" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#C88CFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#C88CFF" stopOpacity="0.26" />
                <Stop offset="1" stopColor="#FF8CD8" stopOpacity="0" />
              </SvgLinear>
            </Defs>
            <Path d={`M0 ${g.headerH + 30} C${g.W * 0.25} ${g.headerH - 20} ${g.W * 0.5} ${g.headerH + 90} ${g.W} ${g.headerH + 10} L${g.W} ${g.headerH + 130} C${g.W * 0.6} ${g.headerH + 190} ${g.W * 0.3} ${g.headerH + 90} 0 ${g.headerH + 160} Z`} fill="url(#nt-aur1)" />
            <Path d={`M0 ${g.headerH + 90} C${g.W * 0.3} ${g.headerH + 30} ${g.W * 0.6} ${g.headerH + 130} ${g.W} ${g.headerH + 60} L${g.W} ${g.headerH + 170} C${g.W * 0.5} ${g.headerH + 230} ${g.W * 0.25} ${g.headerH + 130} 0 ${g.headerH + 210} Z`} fill="url(#nt-aur2)" />
          </Svg>
        </Breathe>
        <ShootingStar W={g.W} y={g.headerH + 10} period={12000} delay={4000} />
      </>
    ),
    front: (g) => <Fireflies W={g.W} H={g.screenH} count={14} color="#9FF7FF" seed={23} area={[g.screenH * 0.4, g.screenH * 0.92]} />,
  },
};
