/* World 3 — SNOWY PEAKS: cold blue mountains, a frozen lake, an ice palace at the top. */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient as SvgRadial, Rect, Stop,
} from 'react-native-svg';
import { CloudDrift, Falling } from './ambient';
import {
  Bush, Crystals, Igloo, Mound, Penguin, Pine, Place, Rock, Snowman, StarShape, Treeline, type Pal,
} from './props';
import { Cabin, Cliff, IceSpire } from './scenery';
import type { DecorKind, SceneGeom, WorldDef } from './types';
import { groundPaths, q2, ridgePath, seeded } from './util';

const FIR: Pal = { dark: '#1D6A5E', mid: '#2E8C7A', light: '#93E4D0', outline: '#124A44', trunk: '#6A4A32' };
const ICE: Pal = { dark: '#5C9AD6', mid: '#9BD4FF', light: '#E6F7FF', outline: '#3F78B4', trunk: '' };
const BOULDER: Pal = { dark: '#7F94B4', mid: '#A9BBD6', light: '#E6EEF8', outline: '#5A6E8E', trunk: '' };
const FROST: Pal = { dark: '#7FA6D8', mid: '#B4D2F2', light: '#F0F8FF', outline: '#4A6EA8', trunk: '' };
const HOLLY: Pal = { dark: '#2C7A60', mid: '#3C9A78', light: '#8AE0B8', outline: '#1B5A46', trunk: '' };

/** Frozen lakes: centre as a fraction of the width, radii in px. */
const lakes = (g: SceneGeom) => [
  { x: g.W * 0.86, y: g.horizon + 470, rx: g.W * 0.2, ry: 74 },
  { x: g.W * 0.9, y: g.horizon + 930, rx: g.W * 0.17, ry: 62 },
];
const groundTop = (g: SceneGeom, x: number) =>
  g.horizon + 10 + Math.sin((x / g.W) * Math.PI * 2 * 1.1 + 2.2) * 9 + Math.sin((x / g.W) * Math.PI * 2 * 2.7) * 4;

/** A snow-capped mountain: lit left face, shaded right face, a jagged white cap. */
function Mountain({ cx, base, h, w, body, shade, cap, capShade }: {
  cx: number; base: number; h: number; w: number; body: string; shade: string; cap: string; capShade: string;
}) {
  const ax = cx;
  const ay = base - h;
  const zig: [number, number][] = [[-0.38, 0.62], [-0.22, 0.54], [-0.1, 0.64], [0.04, 0.52], [0.18, 0.63], [0.3, 0.55], [0.38, 0.62]];
  const edge = zig.map(([dx, f]) => `L${q2(cx + dx * w)} ${q2(base - h * f)}`).join(' ');
  return (
    <G>
      <Path d={`M${q2(cx - w)} ${base} L${ax} ${ay} L${q2(cx + w)} ${base} Z`} fill={body} />
      <Path d={`M${ax} ${ay} L${q2(cx + w)} ${base} L${q2(cx + w * 0.05)} ${base} Z`} fill={shade} />
      <Path d={`M${ax} ${ay} ${edge} Z`} fill={cap} />
      <Path d={`M${ax} ${ay} L${q2(cx + 0.38 * w)} ${q2(base - h * 0.62)} L${q2(cx + 0.3 * w)} ${q2(base - h * 0.55)} L${q2(cx + 0.18 * w)} ${q2(base - h * 0.63)} L${q2(cx + 0.04 * w)} ${q2(base - h * 0.52)} Z`} fill={capShade} />
    </G>
  );
}

function IcePalace({ x, y }: { x: number; y: number }) {
  const wall = '#E4F4FF';
  const shade = '#B4D8F4';
  const line = '#6FA6DA';
  const win = '#FFE9A0';
  const tower = (cx: number, w: number, h: number, spire: number) => (
    <G key={cx}>
      <Rect x={cx - w / 2} y={-h} width={w} height={h} fill={wall} stroke={line} strokeWidth={2.4} />
      <Rect x={cx} y={-h} width={w / 2} height={h} fill={shade} opacity={0.55} />
      <Path d={`M${cx - w / 2 - 3} ${-h} L${cx} ${-h - spire} L${cx + w / 2 + 3} ${-h} Z`} fill="#8FC4F2" stroke={line} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d={`M${cx} ${-h - spire} L${cx + w / 2 + 3} ${-h} L${cx + 2} ${-h} Z`} fill="#6AA4E0" />
      <Path d={`M${cx - 3} ${-h * 0.62} h6 v9 a3 3 0 0 1 -6 0 Z`} fill={win} />
    </G>
  );
  return (
    <G>
      <Pine x={x - 84} y={y + 8} s={70} pal={FIR} snow />
      <Pine x={x + 86} y={y + 10} s={62} pal={FIR} snow />
      <Place x={x} y={y} s={100}>
        <Ellipse cx={0} cy={4} rx={80} ry={10} fill="#5A78A8" opacity={0.2} />
        {tower(-52, 24, 60, 34)}
        {tower(52, 24, 60, 34)}
        {tower(-30, 18, 78, 30)}
        {tower(30, 18, 78, 30)}
        <Rect x={-26} y={-66} width={52} height={66} fill={wall} stroke={line} strokeWidth={2.4} />
        <Rect x={0} y={-66} width={26} height={66} fill={shade} opacity={0.5} />
        {[-22, -12, -2, 8, 18].map((cx) => <Rect key={cx} x={cx} y={-73} width={7} height={8} fill={wall} stroke={line} strokeWidth={1.6} />)}
        <Path d="M-9 0 V-20 A9 9 0 0 1 9 -20 V0 Z" fill="#3F5F9A" stroke={line} strokeWidth={2} />
        <Path d="M-19 -50 h6 v10 a3 3 0 0 1 -6 0 Z M13 -50 h6 v10 a3 3 0 0 1 -6 0 Z" fill={win} />
        <Path d="M-15 -66 L0 -118 L15 -66 Z" fill="#9CCDF6" stroke={line} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d="M0 -118 L15 -66 L2 -66 Z" fill="#6AA4E0" />
        <Path d="M0 -118 V-134" stroke="#5A78A8" strokeWidth={2} />
        <Path d="M0 -134 L16 -129 L0 -124 Z" fill="#FF7A9A" />
        <Path d="M-70 4 Q-40 -10 0 -10 Q40 -10 70 4 Z" fill="#FFFFFF" opacity={0.95} />
        <Path d="M-56 -2 Q-30 -12 -8 -9" fill="none" stroke="#DCEBFF" strokeWidth={3} strokeLinecap="round" />
      </Place>
    </G>
  );
}

const decor: DecorKind[] = [
  { id: 'pine', weight: 5, size: [72, 108], where: 'edge', draw: (p) => <Pine {...p} pal={FIR} snow /> },
  {
    id: 'cliff', weight: 5, size: [120, 170], where: 'edge', spread: 1.1,
    draw: (p) => <Cliff {...p} pal={FROST} cap="#FFFFFF" bands="#8FB0DA" fall={p.v % 3 !== 0} fallColor="#D6EEFF" foam="#F4FBFF" flip={p.v % 2 === 0} />,
  },
  { id: 'cabin', weight: 1.4, size: [82, 104], where: 'edge', spread: 1.5, draw: (p) => <Cabin {...p} flip={p.v % 2 === 0} /> },
  { id: 'spire', weight: 1.5, size: [40, 64], where: 'any', draw: (p) => <IceSpire {...p} /> },
  { id: 'snowman', weight: 1, size: [48, 60], where: 'near', spread: 1.4, draw: (p) => <Snowman {...p} /> },
  { id: 'igloo', weight: 1, size: [42, 54], where: 'any', spread: 1.5, draw: (p) => <Igloo {...p} /> },
  { id: 'ice', weight: 2, size: [30, 48], where: 'any', draw: (p) => <Crystals {...p} pal={ICE} /> },
  { id: 'mound', weight: 6, size: [24, 36], where: 'any', draw: (p) => <Mound {...p} /> },
  { id: 'rock', weight: 2, size: [20, 32], where: 'near', draw: (p) => <Rock {...p} pal={BOULDER} snow /> },
  { id: 'penguin', weight: 2, size: [32, 42], where: 'near', draw: (p) => <Penguin {...p} /> },
  { id: 'holly', weight: 3, size: [26, 36], where: 'any', draw: (p) => <Bush {...p} pal={HOLLY} berries="#FF5A6E" /> },
  { id: 'lakepenguin', weight: 3, size: [32, 40], where: 'water', spread: 2.6, draw: (p) => <Penguin {...p} /> },
];

export const snow: WorldDef = {
  name: 'Snowy World',
  area: 'Snowy Peaks',
  blurb: 'Crisp air, frozen lakes and a palace of ice',
  base: '#CFE1F7',
  skyStops: ['#8FBDEF', '#C9E0FA', '#FFEAF2'],
  accent: '#9BD4FF',
  pathShape: { centre: 0.5, swing: 0.28, wave: 1.25, phase: 0.2 },
  road: {
    edge: '#7FA0D0', fill: '#F6FBFF', dash: '#B4D0F2', width: 32,
    walkedEdge: '#D99A3A', walkedFill: '#FFE07A', walkedDash: '#FFF8D6',
  },

  sky: (g) => {
    const sx = g.W * 0.24;
    const sy = g.headerH + 62;
    return (
      <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadial id="sn-sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF4F0" stopOpacity="0.95" />
            <Stop offset="0.4" stopColor="#FFDDEA" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#FFDDEA" stopOpacity="0" />
          </SvgRadial>
        </Defs>
        <Circle cx={sx} cy={sy} r={104} fill="url(#sn-sun)" />
        <Circle cx={sx} cy={sy} r={23} fill="#FFFBF2" />
      </Svg>
    );
  },

  far: [
    {
      p: 0.16,
      draw: (g) => {
        const b = g.horizon + 44;
        const W = g.W;
        return (
          <>
            <Mountain cx={W * 0.06} base={b} h={150} w={110} body="#B3C8EA" shade="#96AEDC" cap="#FFFFFF" capShade="#DCE8FA" />
            <Mountain cx={W * 0.3} base={b} h={214} w={132} body="#A9C0E6" shade="#8BA6D8" cap="#FFFFFF" capShade="#D6E4F8" />
            <Mountain cx={W * 0.56} base={b} h={168} w={116} body="#B3C8EA" shade="#96AEDC" cap="#FFFFFF" capShade="#DCE8FA" />
            <Mountain cx={W * 0.8} base={b} h={232} w={138} body="#A6BEE6" shade="#889FD6" cap="#FFFFFF" capShade="#D6E4F8" />
            <Mountain cx={W * 1.02} base={b} h={160} w={110} body="#B3C8EA" shade="#96AEDC" cap="#FFFFFF" capShade="#DCE8FA" />
          </>
        );
      },
    },
    {
      p: 0.4,
      draw: (g) => {
        const b = g.horizon + 26;
        const W = g.W;
        return (
          <>
            <Mountain cx={W * 0.16} base={b} h={118} w={100} body="#8EA8DA" shade="#728CC8" cap="#F4F8FF" capShade="#CCDBF3" />
            <Mountain cx={W * 0.46} base={b} h={146} w={112} body="#889FD6" shade="#6C86C4" cap="#F4F8FF" capShade="#CCDBF3" />
            <Mountain cx={W * 0.74} base={b} h={110} w={96} body="#8EA8DA" shade="#728CC8" cap="#F4F8FF" capShade="#CCDBF3" />
            <Mountain cx={W * 0.98} base={b} h={130} w={104} body="#889FD6" shade="#6C86C4" cap="#F4F8FF" capShade="#CCDBF3" />
            <Path d={ridgePath(W, g.horizon - 2, 26, 3.1, g.horizon + 100)} fill="#DCE8FA" />
            <Treeline W={W} base={g.horizon - 2} amp={26} phase={3.1} color="#3C7E80" seed={8} step={13} size={[10, 20]} />
          </>
        );
      },
    },
  ],

  defs: (g) => (
    <>
      <SvgLinear id="sn-ground" gradientUnits="userSpaceOnUse" x1="0" y1={g.horizon} x2="0" y2={g.H}>
        <Stop offset="0" stopColor="#F6FBFF" />
        <Stop offset="0.3" stopColor="#DCEBFB" />
        <Stop offset="1" stopColor="#B4CFEF" />
      </SvgLinear>
      <SvgRadial id="sn-drift" cx="50%" cy="40%" r="60%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
        <Stop offset="1" stopColor="#BFD6F0" stopOpacity="0.55" />
      </SvgRadial>
      <SvgRadial id="sn-ice" cx="40%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#E4F8FF" />
        <Stop offset="0.6" stopColor="#B4E4FA" />
        <Stop offset="1" stopColor="#86C6EC" />
      </SvgRadial>
    </>
  ),

  terrain: (g) => {
    const r = seeded(41);
    const { edge, fill: d } = groundPaths(g.W, g.H, (x) => groundTop(g, x));
    const drifts = Array.from({ length: 26 }, () => ({
      x: r() * g.W, y: g.horizon + 30 + r() * (g.H - g.horizon - 40), rx: 40 + r() * 90, ry: 12 + r() * 26,
    }));
    const sparkles = Array.from({ length: 46 }, () => ({
      x: r() * g.W, y: g.horizon + 20 + r() * (g.H - g.horizon - 30), s: 2.4 + r() * 3.4, o: 0.5 + r() * 0.5,
    }));
    return (
      <>
        <Path d={d} fill="url(#sn-ground)" />
        {drifts.map((p, i) => <Ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#sn-drift)" opacity={0.85} />)}
        {lakes(g).map((l, i) => (
          <G key={i}>
            <Ellipse cx={l.x} cy={l.y + 6} rx={l.rx + 10} ry={l.ry + 8} fill="#FFFFFF" />
            <Ellipse cx={l.x} cy={l.y + 4} rx={l.rx + 10} ry={l.ry + 8} fill="none" stroke="#B4CEEC" strokeWidth={3} />
            <Ellipse cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} fill="url(#sn-ice)" stroke="#6FAEDC" strokeWidth={2.4} />
            <Ellipse cx={l.x - l.rx * 0.25} cy={l.y - l.ry * 0.35} rx={l.rx * 0.5} ry={l.ry * 0.2} fill="#FFFFFF" opacity={0.5} />
            <Path d={`M${q2(l.x - l.rx * 0.5)} ${q2(l.y + l.ry * 0.2)} l${q2(l.rx * 0.3)} ${q2(-l.ry * 0.15)} l${q2(l.rx * 0.2)} ${q2(l.ry * 0.25)} M${q2(l.x + l.rx * 0.1)} ${q2(l.y - l.ry * 0.1)} l${q2(l.rx * 0.25)} ${q2(l.ry * 0.2)} l${q2(l.rx * 0.15)} ${q2(-l.ry * 0.1)}`} stroke="#FFFFFF" strokeWidth={1.8} fill="none" opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ))}
        {sparkles.map((s, i) => <StarShape key={i} cx={s.x} cy={s.y} r={s.s} fill="#FFFFFF" o={s.o} />)}
        <Path d={edge} fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={0.9} />
      </>
    );
  },

  inWater: (g, x, y) => lakes(g).some((l) => {
    const dx = (x - l.x) / (l.rx + 16);
    const dy = (y - l.y) / (l.ry + 14);
    return dx * dx + dy * dy < 1;
  }),

  decor,
  decorCount: 150,
  landmark: (g, x) => <IcePalace x={x} y={g.horizon + 38} />,

  ambient: {
    sky: (g) => (
      <>
        <CloudDrift W={g.W} y={g.headerH * 0.66} s={100} duration={190000} phase={0.35} color="#FFFFFF" shade="#D6E2FA" o={0.9} />
        <CloudDrift W={g.W} y={g.headerH + 66} s={68} duration={250000} phase={0.8} color="#FFFFFF" shade="#D6E2FA" o={0.8} />
      </>
    ),
    front: (g) => <Falling W={g.W} H={g.screenH} count={34} color="#FFFFFF" size={[2, 5.5]} speed={[9000, 18000]} sway={20} seed={17} />,
  },
};
