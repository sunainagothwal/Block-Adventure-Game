/* ============================================================================
 * SCENERY PROPS
 *
 * Every prop is drawn in a normalised box about 100 units tall with its BASE at
 * the origin (0,0) and extending upward (negative y). `Place` moves and scales
 * that box, so a world just says "a tree, 60px tall, here". Flat fills, a dark
 * outline, a light side and a soft ground shadow — the same cartoon language as
 * the rest of the game.
 * ========================================================================== */

import React from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { q2, ridgeY, seeded } from './util';

export type Pal = { dark: string; mid: string; light: string; outline: string; trunk: string };
type At = { x: number; y: number; s: number };

const O = 2.4; // outline width, in prop units

export function Place({ x, y, s, children }: At & { children: React.ReactNode }) {
  return <G transform={`translate(${q2(x)} ${q2(y)}) scale(${q2(s / 100)})`}>{children}</G>;
}
const Shadow = ({ w = 34, o = 0.15 }: { w?: number; o?: number }) => (
  <Ellipse cx={1.5} cy={1.5} rx={w} ry={w * 0.19} fill="#000000" opacity={o} />
);

/* --- trees & plants ---------------------------------------------------------- */

export function RoundTree({ x, y, s, pal }: At & { pal: Pal }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow />
      <Rect x={-5.5} y={-40} width={11} height={41} rx={3} fill={pal.trunk} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={-23} cy={-55} r={23} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={23} cy={-53} r={22} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={0} cy={-72} r={28} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={0} cy={-52} r={27} fill={pal.mid} />
      <Path d="M-8 -30 Q8 -22 24 -34" fill="none" stroke={pal.dark} strokeWidth={6} strokeLinecap="round" opacity={0.3} />
      <Path d="M-31 -64 A14 14 0 0 1 -15 -78" fill="none" stroke={pal.light} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
      <Circle cx={-10} cy={-84} r={7} fill={pal.light} opacity={0.55} />
      <Circle cx={16} cy={-62} r={4.5} fill={pal.light} opacity={0.4} />
    </Place>
  );
}

export function Pine({ x, y, s, pal, snow }: At & { pal: Pal; snow?: boolean }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={26} />
      <Rect x={-4.5} y={-18} width={9} height={19} fill={pal.trunk} stroke={pal.outline} strokeWidth={O} />
      {[0, 1, 2].map((i) => {
        const by = -14 - i * 24;
        const hw = 33 - i * 7;
        const top = by - 40;
        const cap = top + (by - top) * 0.56;
        return (
          <G key={i}>
            <Path d={`M0 ${top} L${hw} ${by} L${-hw} ${by} Z`} fill={i % 2 ? pal.mid : pal.dark}
              stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
            <Path d={`M0 ${top} L${-hw} ${by} L${q2(-hw * 0.15)} ${by} Z`} fill={pal.light} opacity={0.4} />
            {snow ? (
              <Path d={`M0 ${top} L${q2(hw * 0.62)} ${q2(cap + 2)} Q${q2(hw * 0.3)} ${q2(cap - 6)} 0 ${q2(cap)} Q${q2(-hw * 0.3)} ${q2(cap - 6)} ${q2(-hw * 0.62)} ${q2(cap + 2)} Z`}
                fill="#FFFFFF" />
            ) : null}
          </G>
        );
      })}
    </Place>
  );
}

export function Palm({ x, y, s, pal, lean = 1 }: At & { pal: Pal; lean?: number }) {
  const tx = 14 * lean;
  const ty = -84;
  const frond = (a: number, len: number) => {
    const r = (a * Math.PI) / 180;
    const ex = tx + Math.cos(r) * len;
    const ey = ty + Math.sin(r) * len * 0.5 + 18;
    const mx = (tx + ex) / 2;
    return `M${tx} ${ty} Q${q2(mx)} ${ty - 24} ${q2(ex)} ${q2(ey)} Q${q2(mx)} ${ty - 4} ${tx} ${ty} Z`;
  };
  const trunk = `M0 0 Q${4 * lean} -46 ${tx} ${ty}`;
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={30} />
      <Path d={trunk} fill="none" stroke={pal.outline} strokeWidth={10} strokeLinecap="round" />
      <Path d={trunk} fill="none" stroke={pal.trunk} strokeWidth={6.4} strokeLinecap="round" />
      <Path d={trunk} fill="none" stroke={pal.light} strokeWidth={6} strokeDasharray="1.6 6" opacity={0.3} />
      {[-172, -142, -110, -72, -40, -8, 24].map((a, i) => (
        <Path key={i} d={frond(a, 44)} fill={i % 2 ? pal.dark : pal.mid} stroke={pal.outline} strokeWidth={1.8} strokeLinejoin="round" />
      ))}
      <Circle cx={tx - 3} cy={ty + 5} r={4.2} fill="#8A5A2E" stroke={pal.outline} strokeWidth={1.4} />
      <Circle cx={tx + 4} cy={ty + 6} r={4.2} fill="#8A5A2E" stroke={pal.outline} strokeWidth={1.4} />
    </Place>
  );
}

export function Saguaro({ x, y, s, pal, flower = '#FF6F9F' }: At & { pal: Pal; flower?: string }) {
  const arm = (d: string) => (
    <>
      <Path d={d} fill="none" stroke={pal.outline} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} fill="none" stroke={pal.mid} strokeWidth={10.4} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={28} o={0.18} />
      {arm('M-6 -44 H-21 V-68')}
      {arm('M6 -58 H21 V-82')}
      <Rect x={-10.5} y={-98} width={21} height={99} rx={10.5} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Rect x={-6} y={-92} width={4.4} height={82} rx={2.2} fill={pal.light} opacity={0.55} />
      <Path d="M3 -92 V-8 M8 -86 V-14" stroke={pal.dark} strokeWidth={1.3} opacity={0.5} fill="none" />
      <Circle cx={0} cy={-98} r={4.4} fill={flower} />
      <Circle cx={0} cy={-98} r={1.7} fill="#FFE45C" />
    </Place>
  );
}

export function Barrel({ x, y, s, pal, flower = '#FFD84D' }: At & { pal: Pal; flower?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={26} o={0.18} />
      <Ellipse cx={0} cy={-19} rx={21} ry={19} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Path d="M0 -38 Q-11 -19 0 0 M0 -38 Q11 -19 0 0 M0 -38 Q-20 -19 -13 -4 M0 -38 Q20 -19 13 -4" fill="none" stroke={pal.dark} strokeWidth={2} opacity={0.55} />
      <Path d="M-14 -30 Q-19 -22 -17 -12" fill="none" stroke={pal.light} strokeWidth={3.5} strokeLinecap="round" opacity={0.6} />
      {[-9, 0, 9].map((dx, i) => <Circle key={i} cx={dx} cy={-39 + (i === 1 ? -1 : 1)} r={4} fill={flower} stroke={pal.outline} strokeWidth={1} />)}
    </Place>
  );
}

export function Bush({ x, y, s, pal, berries }: At & { pal: Pal; berries?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={32} />
      <Circle cx={-18} cy={-16} r={16} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={18} cy={-15} r={15} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={0} cy={-24} r={20} fill={pal.mid} stroke={pal.outline} strokeWidth={O} />
      <Circle cx={0} cy={-14} r={17} fill={pal.mid} />
      <Circle cx={-8} cy={-31} r={7} fill={pal.light} opacity={0.6} />
      {berries ? [[-14, -14], [6, -10], [14, -24], [-4, -26]].map(([bx, by], i) => <Circle key={i} cx={bx} cy={by} r={3.2} fill={berries} />) : null}
    </Place>
  );
}

export function Flower({ x, y, s, c, stem = '#2E8B3A' }: At & { c: string; stem?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Path d="M0 0 Q2 -10 0 -19" fill="none" stroke={stem} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M0 -8 Q7 -12 10 -8" fill="none" stroke={stem} strokeWidth={2} strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = (k * 72 - 90) * (Math.PI / 180);
        return <Circle key={k} cx={q2(Math.cos(a) * 6)} cy={q2(-24 + Math.sin(a) * 6)} r={4.6} fill={c} />;
      })}
      <Circle cx={0} cy={-24} r={3.2} fill="#FFE45C" />
    </Place>
  );
}

export function Tuft({ x, y, s, c, c2 }: At & { c: string; c2: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Path d="M-10 0 Q-12 -14 -18 -22 Q-6 -16 -3 0 Z" fill={c2} />
      <Path d="M-3 0 Q-2 -22 -1 -34 Q5 -18 5 0 Z" fill={c} />
      <Path d="M5 0 Q10 -14 20 -20 Q12 -8 11 0 Z" fill={c2} />
    </Place>
  );
}

export function Stump({ x, y, s, pal }: At & { pal: Pal }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={26} />
      <Path d="M-18 -26 L-20 0 Q0 7 20 0 L18 -26 Z" fill={pal.trunk} stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
      <Ellipse cx={0} cy={-26} rx={18} ry={7} fill="#E8C48A" stroke={pal.outline} strokeWidth={O} />
      <Ellipse cx={0} cy={-26} rx={10} ry={3.6} fill="none" stroke="#B98A4A" strokeWidth={1.4} />
      <Ellipse cx={0} cy={-26} rx={4} ry={1.5} fill="none" stroke="#B98A4A" strokeWidth={1.2} />
    </Place>
  );
}

export function Rock({ x, y, s, pal, snow }: At & { pal: Pal; snow?: boolean }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={30} o={0.17} />
      <Path d="M-28 0 Q-31 -16 -14 -24 Q2 -32 18 -21 Q32 -12 28 0 Z" fill={pal.mid} stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-22 -14 Q-14 -26 2 -27 Q-8 -20 -12 -8 Z" fill={pal.light} opacity={0.6} />
      <Path d="M8 -4 Q18 -8 26 -2 L28 0 L6 0 Z" fill={pal.dark} opacity={0.35} />
      {snow ? <Path d="M-15 -23 Q2 -34 18 -22 Q6 -26 -15 -23 Z" fill="#FFFFFF" /> : null}
    </Place>
  );
}

export function Mushroom({ x, y, s, cap = '#F0433B', spot = '#FFFFFF', outline = '#7A1E1A' }: At & { cap?: string; spot?: string; outline?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={20} />
      <Path d="M-6 0 L-5 -22 Q0 -25 5 -22 L6 0 Q0 3 -6 0 Z" fill="#FFF1DC" stroke={outline} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-24 -22 Q-24 -50 0 -50 Q24 -50 24 -22 Q0 -14 -24 -22 Z" fill={cap} stroke={outline} strokeWidth={O} strokeLinejoin="round" />
      <Circle cx={-9} cy={-36} r={4.4} fill={spot} />
      <Circle cx={8} cy={-40} r={3.6} fill={spot} />
      <Circle cx={13} cy={-29} r={2.8} fill={spot} />
      <Path d="M-19 -38 Q-15 -46 -8 -47" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.5} />
    </Place>
  );
}

/** A mushroom that glows, for the night world. */
export function GlowMushroom({ x, y, s, glow, cap, stem = '#E8DCFF' }: At & { glow: string; cap: string; stem?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-26} rx={46} ry={34} fill={glow} opacity={0.1} />
      <Ellipse cx={0} cy={-26} rx={30} ry={22} fill={glow} opacity={0.14} />
      <Path d="M-6 0 L-5 -22 Q0 -25 5 -22 L6 0 Q0 3 -6 0 Z" fill={stem} />
      <Path d="M-24 -22 Q-24 -50 0 -50 Q24 -50 24 -22 Q0 -14 -24 -22 Z" fill={cap} stroke={glow} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={-9} cy={-35} r={3.8} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={9} cy={-39} r={3} fill="#FFFFFF" opacity={0.85} />
    </Place>
  );
}

/* --- crystals ------------------------------------------------------------------ */

export function Crystals({ x, y, s, pal, glow }: At & { pal: Pal; glow?: string }) {
  const shard = (dx: number, h: number, w: number, c: string, k: number) => (
    <G key={k}>
      <Path d={`M${dx} ${-h} L${dx + w} ${-h * 0.3} L${q2(dx + w * 0.5)} 0 L${q2(dx - w * 0.5)} 0 L${dx - w} ${-h * 0.3} Z`}
        fill={c} stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
      <Path d={`M${dx} ${-h} L${dx + w} ${-h * 0.3} L${dx} ${q2(-h * 0.22)} Z`} fill="#FFFFFF" opacity={0.42} />
      <Path d={`M${dx} ${-h} L${dx - w} ${-h * 0.3} L${dx - q2(w * 0.3)} ${q2(-h * 0.25)} Z`} fill={pal.dark} opacity={0.3} />
    </G>
  );
  return (
    <Place x={x} y={y} s={s}>
      {glow ? <Ellipse cx={0} cy={-34} rx={50} ry={40} fill={glow} opacity={0.12} /> : null}
      {glow ? <Ellipse cx={0} cy={-30} rx={30} ry={26} fill={glow} opacity={0.14} /> : null}
      <Ellipse cx={0} cy={1} rx={34} ry={7} fill={glow ?? '#000000'} opacity={0.2} />
      {shard(-19, 62, 12, pal.mid, 0)}
      {shard(19, 48, 11, pal.light, 1)}
      {shard(0, 96, 15, pal.mid, 2)}
    </Place>
  );
}

/* --- beach ------------------------------------------------------------------------ */

export function Umbrella({ x, y, s, a, b, tilt = 8 }: At & { a: string; b: string; tilt?: number }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={30} o={0.14} />
      <G transform={`rotate(${tilt})`}>
        <Path d="M0 0 L-1 -66" stroke="#8A5A2E" strokeWidth={3.4} strokeLinecap="round" />
        <Path d="M-38 -58 Q-38 -90 0 -92 Q38 -90 38 -58 Q28 -64 19 -58 Q9.5 -64 0 -58 Q-9.5 -64 -19 -58 Q-28 -64 -38 -58 Z"
          fill={a} stroke="#00000033" strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M0 -92 Q-21 -84 -19 -58 Q-9.5 -64 0 -58 Z" fill={b} />
        <Path d="M0 -92 Q21 -84 19 -58 Q9.5 -64 0 -58 Z" fill={b} />
        <Path d="M-30 -74 Q-22 -86 -8 -89" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.45} />
        <Circle cx={0} cy={-93} r={2.6} fill="#8A5A2E" />
      </G>
    </Place>
  );
}

export function Starfish({ x, y, s, c = '#FF9A4A' }: At & { c?: string }) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 5 : 12;
    const a = (i * 36 - 90) * (Math.PI / 180);
    d += `${i ? 'L' : 'M'}${q2(Math.cos(a) * r)} ${q2(-12 + Math.sin(a) * r)} `;
  }
  return (
    <Place x={x} y={y} s={s}>
      <Path d={`${d}Z`} fill={c} stroke="#B4521A" strokeWidth={1.8} strokeLinejoin="round" />
      {[[0, -18], [-8, -10], [8, -10], [-5, -3], [5, -3]].map(([dx, dy], i) => <Circle key={i} cx={dx} cy={dy} r={1.1} fill="#FFE1B8" />)}
    </Place>
  );
}

export function Shell({ x, y, s, c = '#FFD6E0' }: At & { c?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={1} cy={1} rx={13} ry={3} fill="#000000" opacity={0.13} />
      <Path d="M0 0 Q-15 -6 -13 -18 Q0 -28 13 -18 Q15 -6 0 0 Z" fill={c} stroke="#C9788C" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M0 0 L-8 -20 M0 0 L0 -23 M0 0 L8 -20" stroke="#C9788C" strokeWidth={1.3} opacity={0.7} fill="none" />
    </Place>
  );
}

export function Crab({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={20} />
      <Path d="M-12 -6 L-20 -2 M-11 -9 L-21 -8 M12 -6 L20 -2 M11 -9 L21 -8" stroke="#C0392B" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M-11 -14 L-17 -24 M11 -14 L17 -24" stroke="#C0392B" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Circle cx={-19} cy={-27} r={6} fill="#FF6B5A" stroke="#8A2A1E" strokeWidth={1.6} />
      <Circle cx={19} cy={-27} r={6} fill="#FF6B5A" stroke="#8A2A1E" strokeWidth={1.6} />
      <Ellipse cx={0} cy={-9} rx={14} ry={9} fill="#FF6B5A" stroke="#8A2A1E" strokeWidth={2} />
      <Circle cx={-5} cy={-18} r={3} fill="#FFFFFF" stroke="#8A2A1E" strokeWidth={1.2} />
      <Circle cx={5} cy={-18} r={3} fill="#FFFFFF" stroke="#8A2A1E" strokeWidth={1.2} />
      <Circle cx={-5} cy={-18} r={1.2} fill="#1B1B1B" />
      <Circle cx={5} cy={-18} r={1.2} fill="#1B1B1B" />
    </Place>
  );
}

export function Sandcastle({ x, y, s }: At) {
  const sand = '#F2D08A';
  const dark = '#D9AE62';
  const line = '#B98A3E';
  const tower = (cx: number, w: number, h: number) => (
    <G key={cx}>
      <Rect x={cx - w / 2} y={-h} width={w} height={h} fill={sand} stroke={line} strokeWidth={1.8} />
      {[0, 1, 2].map((k) => <Rect key={k} x={cx - w / 2 + k * (w / 3)} y={-h - 5} width={w / 3 - 1.4} height={6} fill={sand} stroke={line} strokeWidth={1.4} />)}
      <Path d={`M${cx - w / 2} ${-h} h${w} v${h * 0.35} h${-w} Z`} fill={dark} opacity={0.3} />
    </G>
  );
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={34} />
      <Rect x={-30} y={-20} width={60} height={20} rx={3} fill={sand} stroke={line} strokeWidth={1.8} />
      {tower(-24, 14, 38)}
      {tower(24, 14, 38)}
      {tower(0, 18, 54)}
      <Path d="M-4 0 V-9 A4 4 0 0 1 4 -9 V0 Z" fill={dark} />
      <Path d="M0 -62 V-76" stroke="#8A5A2E" strokeWidth={1.8} />
      <Path d="M0 -76 L13 -72 L0 -68 Z" fill="#FF5A6E" />
    </Place>
  );
}

export function BeachBall({ x, y, s }: At) {
  const wedge = (a0: number, a1: number, c: string) => {
    const p = (a: number) => `${q2(Math.cos((a * Math.PI) / 180) * 12)} ${q2(-12 + Math.sin((a * Math.PI) / 180) * 12)}`;
    return <Path d={`M0 -12 L${p(a0)} A12 12 0 0 1 ${p(a1)} Z`} fill={c} />;
  };
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={14} />
      <Circle cx={0} cy={-12} r={12} fill="#FFFFFF" />
      {wedge(-90, -30, '#FF5A6E')}
      {wedge(30, 90, '#4AA8FF')}
      {wedge(150, 210, '#FFC93C')}
      <Circle cx={0} cy={-12} r={12} fill="none" stroke="#00000033" strokeWidth={1.4} />
      <Circle cx={-4} cy={-17} r={3} fill="#FFFFFF" opacity={0.6} />
    </Place>
  );
}

export function Surfboard({ x, y, s, c, tilt = 10 }: At & { c: string; tilt?: number }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={16} />
      <G transform={`rotate(${tilt})`}>
        <Path d="M0 -84 Q11 -52 6 0 L-6 0 Q-11 -52 0 -84 Z" fill={c} stroke="#00000033" strokeWidth={1.8} />
        <Path d="M0 -82 V0" stroke="#FFFFFF" strokeWidth={2.4} opacity={0.85} />
        <Path d="M-4 -60 Q-6 -40 -4 -12" fill="none" stroke="#FFFFFF" strokeWidth={2} opacity={0.35} />
      </G>
    </Place>
  );
}

export function Sailboat({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={4} rx={34} ry={6} fill="#FFFFFF" opacity={0.45} />
      <Path d="M-24 -2 L24 -2 L17 9 L-17 9 Z" fill="#E8543E" stroke="#8A2A1E" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M0 -2 V-64" stroke="#7A4A26" strokeWidth={2.4} />
      <Path d="M2 -6 L2 -62 L26 -10 Z" fill="#FFFFFF" stroke="#B8C8D8" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M-2 -8 L-2 -50 L-18 -10 Z" fill="#FFF1C4" stroke="#B8C8D8" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M0 -64 L10 -60 L0 -56 Z" fill="#FFC93C" />
    </Place>
  );
}

export function Buoy({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={3} rx={20} ry={4.5} fill="#FFFFFF" opacity={0.4} />
      <Path d="M-11 -2 L-8 -26 H8 L11 -2 Z" fill="#FF5A6E" stroke="#8A2A3E" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M-9.5 -12 H9.5 L10.4 -7 H-10.4 Z" fill="#FFFFFF" />
      <Path d="M0 -26 V-36" stroke="#5A4A3A" strokeWidth={2} />
      <Circle cx={0} cy={-38} r={3.2} fill="#FFC93C" />
    </Place>
  );
}

/* --- snow -------------------------------------------------------------------------- */

export function Igloo({ x, y, s }: At) {
  const line = '#8FB0D6';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={44} o={0.14} />
      <Path d="M-40 0 A40 40 0 0 1 40 0 Z" fill="#FFFFFF" stroke={line} strokeWidth={O} />
      <Path d="M-30 -22 H30 M-22 -36 H22 M-10 -46 H10" stroke={line} strokeWidth={1.6} fill="none" />
      <Path d="M-14 0 V-22 M14 0 V-22 M0 -22 V-36 M-20 -22 V-36 M20 -22 V-36" stroke={line} strokeWidth={1.4} fill="none" opacity={0.8} />
      <Path d="M-15 0 V-11 A15 15 0 0 1 15 -11 V0 Z" fill="#3F5F9A" stroke={line} strokeWidth={2} />
      <Path d="M-30 -30 Q-24 -42 -10 -46" fill="none" stroke="#DCEBFF" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </Place>
  );
}

export function Snowman({ x, y, s }: At) {
  const line = '#8FB0D6';
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={26} o={0.13} />
      <Path d="M-22 -20 L-34 -34 M22 -20 L34 -36" stroke="#7A4A26" strokeWidth={2.6} strokeLinecap="round" transform="translate(0 -8)" />
      <Circle cx={0} cy={-20} r={20} fill="#FFFFFF" stroke={line} strokeWidth={O} />
      <Circle cx={0} cy={-46} r={15} fill="#FFFFFF" stroke={line} strokeWidth={O} />
      <Circle cx={0} cy={-69} r={12} fill="#FFFFFF" stroke={line} strokeWidth={O} />
      <Path d="M-12 -55 Q0 -50 12 -55 L12 -50 Q0 -45 -12 -50 Z" fill="#E8543E" />
      <Path d="M8 -52 L12 -38 L4 -38 Z" fill="#E8543E" />
      <Path d="M-13 -78 H13 M-8 -78 V-92 H8 V-78" fill="#2A2A3A" stroke="#2A2A3A" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M0 -68 L11 -66 L0 -63 Z" fill="#FF9A2E" />
      <Circle cx={-4.4} cy={-72} r={1.7} fill="#1B1B1B" />
      <Circle cx={4.4} cy={-72} r={1.7} fill="#1B1B1B" />
      {[-30, -20, -10].map((yy) => <Circle key={yy} cx={0} cy={yy} r={1.8} fill="#2A2A3A" />)}
      <Path d="M-8 -28 Q-2 -24 4 -28" fill="none" stroke="#DCEBFF" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </Place>
  );
}

export function Mound({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Path d="M-38 1 Q-28 -30 0 -30 Q28 -30 38 1 Z" fill="#FFFFFF" />
      <Path d="M8 -2 Q26 -14 34 -2 Z" fill="#BFD6F0" opacity={0.7} />
      <Path d="M-30 -8 Q-24 -24 -4 -27" fill="none" stroke="#E6F1FF" strokeWidth={3} strokeLinecap="round" />
    </Place>
  );
}

export function Penguin({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={18} o={0.14} />
      <Path d="M-12 -2 L-16 2 L-6 2 Z M12 -2 L16 2 L6 2 Z" fill="#FF9A2E" />
      <Path d="M-14 -30 Q-22 -22 -18 -12 Q-14 -18 -12 -22 Z M14 -30 Q22 -22 18 -12 Q14 -18 12 -22 Z" fill="#26304A" />
      <Ellipse cx={0} cy={-26} rx={14} ry={26} fill="#26304A" stroke="#151B30" strokeWidth={2} />
      <Ellipse cx={0} cy={-22} rx={9} ry={19} fill="#FFFFFF" />
      <Circle cx={-5} cy={-42} r={2.6} fill="#FFFFFF" />
      <Circle cx={5} cy={-42} r={2.6} fill="#FFFFFF" />
      <Circle cx={-5} cy={-42} r={1.1} fill="#1B1B1B" />
      <Circle cx={5} cy={-42} r={1.1} fill="#1B1B1B" />
      <Path d="M-3.4 -38 L0 -33 L3.4 -38 Z" fill="#FF9A2E" />
    </Place>
  );
}

/* --- desert ------------------------------------------------------------------------- */

export function Tent({ x, y, s, a, b }: At & { a: string; b: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={38} o={0.18} />
      <Path d="M-38 0 L0 -60 L38 0 Z" fill={a} stroke="#00000044" strokeWidth={O} strokeLinejoin="round" />
      <Path d="M0 -60 L38 0 L14 0 Z" fill="#000000" opacity={0.12} />
      <Path d="M-28 -16 L28 -16 L24 -8 L-24 -8 Z" fill={b} />
      <Path d="M-9 0 L0 -30 L9 0 Z" fill="#3A2416" />
      <Path d="M0 -60 V-72" stroke="#7A4A26" strokeWidth={2.4} />
      <Path d="M0 -72 L12 -68 L0 -64 Z" fill={b} />
    </Place>
  );
}

export function Jar({ x, y, s, c }: At & { c: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={16} o={0.18} />
      <Path d="M-8 -36 Q-22 -22 -14 -6 Q-11 0 0 0 Q11 0 14 -6 Q22 -22 8 -36 Z" fill={c} stroke="#6A3A1E" strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-8 -36 L-7 -44 H7 L8 -36 Z" fill={c} stroke="#6A3A1E" strokeWidth={O} strokeLinejoin="round" />
      <Ellipse cx={0} cy={-45} rx={9} ry={2.6} fill="#5A2E16" stroke="#6A3A1E" strokeWidth={1.6} />
      <Path d="M-17 -22 Q0 -17 17 -22" fill="none" stroke="#FFE1B0" strokeWidth={2.6} opacity={0.8} />
      <Path d="M-15 -30 Q-19 -20 -13 -10" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.3} />
    </Place>
  );
}

export function Mesa({ x, y, s, pal }: At & { pal: Pal }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={40} o={0.2} />
      <Path d="M-38 0 L-34 -34 L-24 -40 L-14 -40 L-8 -52 L12 -52 L18 -40 L30 -38 L36 -30 L40 0 Z" fill={pal.mid} stroke={pal.outline} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M-37 -12 L38 -12 L39 -20 L-35 -20 Z" fill={pal.dark} opacity={0.5} />
      <Path d="M-34 -34 L-24 -40 L-14 -40 L-8 -52 L2 -52 L-10 -36 L-18 -30 Z" fill={pal.light} opacity={0.55} />
      <Path d="M18 -40 L30 -38 L36 -30 L40 0 L22 0 Z" fill="#000000" opacity={0.12} />
    </Place>
  );
}

export function Tumbleweed({ x, y, s }: At) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={1} rx={16} ry={3} fill="#000000" opacity={0.15} />
      <Circle cx={0} cy={-14} r={13} fill="none" stroke="#9A6A34" strokeWidth={2} />
      <Path d="M-12 -12 Q0 -26 12 -14 M-10 -4 Q4 -20 12 -8 M-6 -24 Q8 -10 0 -1 M-13 -16 Q-2 -8 8 -24" fill="none" stroke="#B8843E" strokeWidth={1.8} />
    </Place>
  );
}

export function Pyramid({ x, y, s, light = '#F7D48E', dark = '#D9A85A', line = '#B98A3E' }: At & { light?: string; dark?: string; line?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Shadow w={52} o={0.16} />
      <Path d="M-50 0 L0 -74 L50 0 Z" fill={light} stroke={line} strokeWidth={O} strokeLinejoin="round" />
      <Path d="M0 -74 L50 0 L10 0 Z" fill={dark} />
      <Path d="M-40 -15 H42 M-30 -30 H32 M-20 -45 H22 M-10 -59 H12" stroke={line} strokeWidth={1.2} opacity={0.55} fill="none" />
    </Place>
  );
}

/* --- night -------------------------------------------------------------------------- */

export function Lantern({ x, y, s, glow = '#FFD98A' }: At & { glow?: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Ellipse cx={0} cy={-62} rx={44} ry={44} fill={glow} opacity={0.1} />
      <Ellipse cx={0} cy={-62} rx={26} ry={26} fill={glow} opacity={0.16} />
      <Shadow w={14} o={0.25} />
      <Rect x={-2.4} y={-60} width={4.8} height={60} fill="#2A1C5A" />
      <Path d="M-10 -60 H10 L8 -78 H-8 Z" fill={glow} stroke="#2A1C5A" strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M-11 -78 H11 L0 -88 Z" fill="#2A1C5A" />
      <Path d="M-4 -74 V-64" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
    </Place>
  );
}

export function MoonFlower({ x, y, s, glow, petal }: At & { glow: string; petal: string }) {
  return (
    <Place x={x} y={y} s={s}>
      <Circle cx={0} cy={-38} r={26} fill={glow} opacity={0.14} />
      <Path d="M0 0 Q4 -20 0 -34" fill="none" stroke="#3A9A8A" strokeWidth={3} strokeLinecap="round" />
      <Path d="M0 -14 Q-12 -16 -16 -26" fill="none" stroke="#3A9A8A" strokeWidth={2.6} strokeLinecap="round" />
      {[-60, -30, 0, 30, 60].map((a, i) => (
        <Path key={i} d="M0 -36 Q-7 -50 0 -62 Q7 -50 0 -36 Z" fill={petal} stroke={glow} strokeWidth={1.2} transform={`rotate(${a} 0 -36)`} />
      ))}
      <Circle cx={0} cy={-36} r={4.6} fill="#FFF6C8" />
    </Place>
  );
}

/* --- sky pieces ----------------------------------------------------------------------- */

export function Cloud({ x, y, s, color = '#FFFFFF', shade = '#DCEFFF', o = 1 }: { x: number; y: number; s: number; color?: string; shade?: string; o?: number }) {
  const puffs: [number, number, number][] = [[-30, 4, 15], [-12, -6, 20], [10, -10, 22], [30, 0, 16], [0, 8, 18]];
  return (
    <G transform={`translate(${q2(x)} ${q2(y)}) scale(${q2(s / 100)})`} opacity={o}>
      {puffs.map(([dx, dy, r], i) => <Circle key={`s${i}`} cx={dx} cy={dy + 5} r={r} fill={shade} />)}
      {puffs.map(([dx, dy, r], i) => <Circle key={i} cx={dx} cy={dy} r={r} fill={color} />)}
      <Path d="M-40 14 H42" stroke={color} strokeWidth={14} strokeLinecap="round" />
    </G>
  );
}

export function Bird({ x, y, s, c = '#3A4A6A' }: { x: number; y: number; s: number; c?: string }) {
  return (
    <G transform={`translate(${q2(x)} ${q2(y)}) scale(${q2(s / 100)})`}>
      <Path d="M-24 0 Q-12 -14 0 0 Q12 -14 24 0" fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

export function StarShape({ cx, cy, r, fill = '#FFFFFF', o = 1 }: { cx: number; cy: number; r: number; fill?: string; o?: number }) {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.28 : r;
    const a = (i * 45 - 90) * (Math.PI / 180);
    d += `${i ? 'L' : 'M'}${q2(cx + Math.cos(a) * rr)} ${q2(cy + Math.sin(a) * rr)} `;
  }
  return <Path d={`${d}Z`} fill={fill} opacity={o} />;
}

/** A row of tiny pine silhouettes standing along a ridge line — depth for cheap. */
export function Treeline({ W, base, amp, phase, color, seed = 3, step = 15, size = [9, 19], waves }: {
  W: number; base: number; amp: number; phase: number; color: string; seed?: number; step?: number; size?: [number, number];
  waves?: [number, number][];
}) {
  const r = seeded(seed);
  const out: React.ReactNode[] = [];
  for (let x = 6; x < W + 10; x += step * (0.7 + r() * 0.6)) {
    const y = ridgeY(W, base, amp, phase, x, waves) + 2;
    const h = size[0] + r() * (size[1] - size[0]);
    const w = h * 0.42;
    out.push(<Path key={out.length} d={`M${q2(x)} ${q2(y - h)} L${q2(x + w)} ${q2(y)} L${q2(x - w)} ${q2(y)} Z`} fill={color} />);
  }
  return <G>{out}</G>;
}
