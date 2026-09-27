/* World 4 — DESERT DUNES: warm rolling sand, an oasis, and pyramids on the horizon. */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient as SvgRadial, Stop,
} from 'react-native-svg';
import { Breathe, CloudDrift, Drift } from './ambient';
import {
  Barrel, Bird, Flower, Jar, Mesa, Palm, Pyramid, Rock, Saguaro, Tent, Tuft, Tumbleweed, type Pal,
} from './props';
import { Bones, Cliff, RuinGate } from './scenery';
import type { DecorKind, SceneGeom, WorldDef } from './types';
import { groundPaths, q2, ridgePath, seeded } from './util';

const CACTUS: Pal = { dark: '#2E8A44', mid: '#4CB85E', light: '#98E88C', outline: '#1B6030', trunk: '' };
const RED: Pal = { dark: '#A0552A', mid: '#D08048', light: '#F2B47C', outline: '#74381C', trunk: '' };
const CANYON: Pal = { dark: '#9A4E24', mid: '#D4803E', light: '#F6B878', outline: '#6A3216', trunk: '' };
const PEBBLE: Pal = { dark: '#A86E42', mid: '#C8905C', light: '#F0CFA0', outline: '#7A4A2A', trunk: '' };
const OASIS_PALM: Pal = { dark: '#238A44', mid: '#3FB85E', light: '#A0EC80', outline: '#146A34', trunk: '#A26E3A' };

const oasis = (g: SceneGeom) => ({ x: g.W * 0.84, y: g.horizon + 520, rx: g.W * 0.2, ry: 62 });
const groundTop = (g: SceneGeom, x: number) =>
  g.horizon + 10 + Math.sin((x / g.W) * Math.PI * 2 * 0.9 + 1.4) * 10 + Math.sin((x / g.W) * Math.PI * 2 * 2.3) * 4;

const decor: DecorKind[] = [
  {
    id: 'canyon', weight: 5, size: [120, 170], where: 'edge', spread: 1.1,
    draw: (p) => <Cliff {...p} pal={CANYON} cap="#F6D48A" bands="#7A3A18" fall={p.v % 5 === 0} fallColor="#7FE0F0" flip={p.v % 2 === 0} />,
  },
  { id: 'ruins', weight: 1.4, size: [84, 112], where: 'edge', spread: 1.6, draw: (p) => <RuinGate {...p} /> },
  { id: 'bones', weight: 1.2, size: [40, 54], where: 'near', spread: 1.4, draw: (p) => <Bones {...p} /> },
  { id: 'saguaro', weight: 5, size: [66, 104], where: 'edge', draw: (p) => <Saguaro {...p} pal={CACTUS} flower={p.v % 2 ? '#FF6F9F' : '#FFB43C'} /> },
  { id: 'barrel', weight: 3, size: [26, 38], where: 'near', draw: (p) => <Barrel {...p} pal={CACTUS} flower={p.v % 2 ? '#FFD84D' : '#FF8FB8'} /> },
  { id: 'mesa', weight: 1, size: [48, 74], where: 'edge', spread: 1.3, draw: (p) => <Mesa {...p} pal={RED} /> },
  { id: 'tent', weight: 1, size: [54, 68], where: 'any', spread: 1.6, draw: (p) => <Tent {...p} a={p.v % 2 ? '#F0E2C4' : '#E8A868'} b={p.v % 2 ? '#E8543E' : '#3A8AC8'} /> },
  { id: 'jar', weight: 2, size: [28, 38], where: 'near', draw: (p) => <Jar {...p} c={p.v % 2 ? '#D9803E' : '#C8683A'} /> },
  { id: 'weed', weight: 2, size: [24, 32], where: 'near', draw: (p) => <Tumbleweed {...p} /> },
  { id: 'rock', weight: 2, size: [18, 30], where: 'near', draw: (p) => <Rock {...p} pal={PEBBLE} /> },
  { id: 'bloom', weight: 3, size: [22, 30], where: 'near', draw: (p) => <Flower {...p} c={p.v % 2 ? '#FF6F9F' : '#FFE066'} stem="#3E9A48" /> },
  { id: 'scrub', weight: 4, size: [22, 32], where: 'any', draw: (p) => <Tuft {...p} c="#C8B04E" c2="#9A8A3C" /> },
];

export const desert: WorldDef = {
  name: 'Desert World',
  area: 'Desert Dunes',
  blurb: 'Golden dunes, a shady oasis and ancient pyramids',
  base: '#D8813A',
  skyStops: ['#3A96E0', '#86CDF4', '#FFE2AE'],
  accent: '#FFC65A',
  pathShape: { centre: 0.48, swing: 0.27, wave: 0.8, phase: 2.1 },
  road: {
    edge: '#A8672C', fill: '#FCE8B8', dash: '#FFF5D6', width: 32,
    walkedEdge: '#C8742A', walkedFill: '#FFD466', walkedDash: '#FFF6C8',
  },

  sky: (g) => {
    const sx = g.W * 0.68;
    const sy = g.headerH + 42;
    return (
      <>
        <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadial id="ds-sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFF7C8" stopOpacity="1" />
              <Stop offset="0.4" stopColor="#FFE08A" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
            </SvgRadial>
          </Defs>
          <Circle cx={sx} cy={sy} r={130} fill="url(#ds-sun)" />
        </Svg>
        <Breathe period={5200} amp={0.05} min={0.86} style={{ position: 'absolute', left: sx - 40, top: sy - 40, width: 80, height: 80 }}>
          <Svg width={80} height={80} viewBox="-40 -40 80 80">
            <Circle r={36} fill="#FFE070" opacity={0.5} />
            <Circle r={30} fill="#FFE870" />
            <Circle r={24} fill="#FFF7B4" />
          </Svg>
        </Breathe>
      </>
    );
  },

  far: [
    {
      p: 0.18,
      draw: (g) => (
        <>
          <Path d={ridgePath(g.W, g.horizon - 34, 70, 0.6, g.horizon + 100)} fill="#F8D7A6" />
          <Path d={`M${g.W * 0.14} ${g.horizon - 46} L${g.W * 0.19} ${g.horizon - 84} L${g.W * 0.245} ${g.horizon - 46} Z`} fill="#EDBE8A" />
          <Path d={`M${g.W * 0.19} ${g.horizon - 84} L${g.W * 0.245} ${g.horizon - 46} L${g.W * 0.2} ${g.horizon - 46} Z`} fill="#DDA872" />
          <Path d={`M${g.W * 0.26} ${g.horizon - 44} L${g.W * 0.295} ${g.horizon - 68} L${g.W * 0.33} ${g.horizon - 44} Z`} fill="#EDBE8A" />
          <Path d={`M${g.W * 0.295} ${g.horizon - 68} L${g.W * 0.33} ${g.horizon - 44} L${g.W * 0.3} ${g.horizon - 44} Z`} fill="#DDA872" />
        </>
      ),
    },
    {
      p: 0.42,
      draw: (g) => (
        <>
          <Path d={ridgePath(g.W, g.horizon - 2, 52, 2.0, g.horizon + 100)} fill="#EDB36C" />
          <Path d={ridgePath(g.W, g.horizon + 8, 40, 3.4, g.horizon + 100)} fill="#E6A257" />
        </>
      ),
    },
  ],

  defs: (g) => (
    <>
      <SvgLinear id="ds-ground" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon} x2="0" y2={g.H}>
        <Stop offset="0" stopColor="#F9CD7C" />
        <Stop offset="0.3" stopColor="#F0AA52" />
        <Stop offset="1" stopColor="#D9823C" />
      </SvgLinear>
      <SvgLinear id="ds-dune" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFDC96" />
        <Stop offset="1" stopColor="#F2AE5C" stopOpacity="0" />
      </SvgLinear>
      <SvgRadial id="ds-water" cx="45%" cy="40%" r="70%">
        <Stop offset="0" stopColor="#8EF0EC" />
        <Stop offset="0.6" stopColor="#3FC4CC" />
        <Stop offset="1" stopColor="#1E9AB4" />
      </SvgRadial>
    </>
  ),

  terrain: (g) => {
    const r = seeded(51);
    const { edge, fill: d } = groundPaths(g.W, g.H, (x) => groundTop(g, x));
    const dunes = Array.from({ length: 11 }, () => ({
      x: r() * g.W, y: g.horizon + 60 + r() * (g.H - g.horizon - 80), rx: 110 + r() * 130, ry: 26 + r() * 40,
    }));
    const ripples = Array.from({ length: 70 }, () => ({
      x: r() * g.W, y: g.horizon + 30 + r() * (g.H - g.horizon - 40), w: 24 + r() * 60,
    }));
    const o = oasis(g);
    return (
      <>
        <Path d={d} fill="url(#ds-ground)" />
        {dunes.map((p, i) => (
          <G key={i}>
            <Ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#ds-dune)" opacity={0.85} />
            <Path d={`M${q2(p.x - p.rx * 0.8)} ${q2(p.y - p.ry * 0.3)} Q${q2(p.x)} ${q2(p.y - p.ry * 1.05)} ${q2(p.x + p.rx * 0.8)} ${q2(p.y - p.ry * 0.3)}`} fill="none" stroke="#FFE3A8" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          </G>
        ))}
        {ripples.map((p, i) => (
          <G key={i}>
            <Path d={`M${q2(p.x)} ${q2(p.y)} q${q2(p.w / 2)} -5 ${q2(p.w)} 0`} stroke="#FFE7B4" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.5} />
            <Path d={`M${q2(p.x + 3)} ${q2(p.y + 4)} q${q2(p.w / 2)} -5 ${q2(p.w)} 0`} stroke="#C8702E" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.28} />
          </G>
        ))}
        <Path d={edge} fill="none" stroke="#FFE7B0" strokeWidth={4} opacity={0.8} />

        {/* the oasis */}
        <Ellipse cx={o.x} cy={o.y + 6} rx={o.rx + 16} ry={o.ry + 12} fill="#E0A45A" opacity={0.55} />
        <Ellipse cx={o.x} cy={o.y + 2} rx={o.rx + 12} ry={o.ry + 8} fill="#7FCB6A" />
        <Ellipse cx={o.x} cy={o.y} rx={o.rx + 6} ry={o.ry + 3} fill="#F8E2A8" />
        <Ellipse cx={o.x} cy={o.y} rx={o.rx} ry={o.ry} fill="url(#ds-water)" stroke="#187E94" strokeWidth={2.4} />
        <Ellipse cx={o.x - o.rx * 0.25} cy={o.y - o.ry * 0.3} rx={o.rx * 0.45} ry={o.ry * 0.16} fill="#FFFFFF" opacity={0.45} />
        <Path d={`M${q2(o.x - o.rx * 0.4)} ${q2(o.y + o.ry * 0.3)} q6 -3 12 0 t12 0 M${q2(o.x + o.rx * 0.1)} ${q2(o.y + o.ry * 0.05)} q6 -3 12 0 t12 0`} stroke="#FFFFFF" strokeWidth={1.8} fill="none" opacity={0.7} strokeLinecap="round" />
      </>
    );
  },

  decals: (g) => {
    const o = oasis(g);
    return (
      <G>
        <Palm x={o.x - o.rx * 0.9} y={o.y - o.ry * 0.5} s={86} pal={OASIS_PALM} lean={1} />
        <Palm x={o.x + o.rx * 0.78} y={o.y - o.ry * 0.7} s={98} pal={OASIS_PALM} lean={-1} />
        <Palm x={o.x + o.rx * 0.1} y={o.y - o.ry * 1.0} s={78} pal={OASIS_PALM} lean={1} />
      </G>
    );
  },

  inWater: (g, x, y) => {
    const o = oasis(g);
    const dx = (x - o.x) / (o.rx + 22);
    const dy = (y - o.y) / (o.ry + 18);
    return dx * dx + dy * dy < 1;
  },

  decor,
  landmark: (g, x) => (
    <G>
      <Pyramid x={x - 104} y={g.horizon + 40} s={92} />
      <Pyramid x={x + 108} y={g.horizon + 44} s={78} />
      <Pyramid x={x} y={g.horizon + 46} s={158} />
      <Palm x={x - 150} y={g.horizon + 54} s={64} pal={OASIS_PALM} lean={1} />
    </G>
  ),

  ambient: {
    sky: (g) => (
      <>
        <CloudDrift W={g.W} y={g.headerH * 0.7} s={110} duration={210000} phase={0.4} color="#FFF6E6" shade="#FFE2B8" o={0.55} />
        <CloudDrift W={g.W} y={g.headerH + 70} s={80} duration={260000} phase={0.9} color="#FFF6E6" shade="#FFE2B8" o={0.5} />
        <Drift W={g.W} y={g.headerH + 34} w={42} h={20} duration={60000} phase={0.3} bob={3}>
          <Svg width={42} height={20} viewBox="-30 -14 60 28"><Bird x={0} y={0} s={100} c="#8A5A3A" /></Svg>
        </Drift>
      </>
    ),
  },
};
