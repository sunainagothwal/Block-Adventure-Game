/* ============================================================================
 * WORLD SCENE
 *
 * A world is drawn in layers, back to front:
 *
 *   sky            fixed gradient
 *   sky art        sun / moon / stars, a hair of parallax
 *   sky ambient    clouds, gulls, aurora — drifting
 *   far ridges     each slides at its own fraction of the scroll speed
 *   ─────────────  the ScrollView starts here  ─────────────
 *   terrain        the ground, water, patches
 *   road           the curved level path, walked stretch in gold
 *   decor          trees, rocks, props — perspective-scaled, sorted by depth,
 *                  kept off the road and out of the water
 *   nodes          (drawn by the Adventure screen)
 *   front ambient  snow, fireflies — pinned to the screen
 *
 * Everything is react-native-svg vector art. There are no background images.
 * ========================================================================== */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';
import { forest } from './forest';
import { beach } from './beach';
import { snow } from './snow';
import { desert } from './desert';
import { night } from './night';
import type { DecorKind, SceneGeom, WorldDef } from './types';
import { lerp, sampleCurve, seeded, smoothSegments, type Pt } from './util';

export const WORLDS: WorldDef[] = [forest, beach, snow, desert, night];
export const worldDef = (i: number) => WORLDS[((i % WORLDS.length) + WORLDS.length) % WORLDS.length];

/* --- layout ------------------------------------------------------------------ */

export type Layout = {
  g: SceneGeom;
  /** Where each level's node sits (level 1 at the bottom, the last at the top). */
  nodes: Pt[];
  /** The road, one pair of path strings per level-to-level stretch. */
  stretches: string[][];
  /** The road as a dense polyline, for keeping scenery off it. */
  walk: Pt[];
  landmarkX: number;
};

export const STEP_Y = 88;
export const NODE = 58;

export function layoutWorld(def: WorldDef, W: number, screenH: number, headerH: number, count: number): Layout {
  const horizon = headerH + 132;
  const top = horizon + 108;
  const bottomPad = 130;
  const H = Math.max(top + (count - 1) * STEP_Y + bottomPad, screenH + 260);
  const bottom = H - bottomPad;
  const { centre, swing, wave, phase } = def.pathShape;
  const clampX = (x: number) => Math.max(W * 0.16, Math.min(W * 0.84, x));

  const nodes: Pt[] = Array.from({ length: count }, (_, i) => ({
    x: clampX(W * (centre + swing * Math.sin(i * wave + phase))),
    y: bottom - i * STEP_Y,
  }));

  // A bulge between every pair of nodes makes the road meander instead of
  // running straight from one to the next.
  const road: Pt[] = [];
  nodes.forEach((n, i) => {
    road.push(n);
    if (i < count - 1) {
      const m = nodes[i + 1];
      road.push({ x: clampX((n.x + m.x) / 2 + Math.sin(i * 1.9 + phase) * W * 0.07), y: (n.y + m.y) / 2 });
    }
  });
  const segs = smoothSegments(road);
  const stretches: string[][] = [];
  for (let i = 0; i < count - 1; i++) stretches.push([segs[2 * i], segs[2 * i + 1]]);

  return {
    g: { W, H, horizon, screenH, headerH },
    nodes, stretches, walk: sampleCurve(road, 8), landmarkX: nodes[count - 1].x,
  };
}

/* --- decoration placement -------------------------------------------------------- */

type Placed = { kind: DecorKind; x: number; y: number; s: number; v: number; top: number; bottom: number };

function placeDecor(def: WorldDef, lay: Layout, seed: number): Placed[] {
  const { g, walk, landmarkX } = lay;
  const { W, H, horizon } = g;
  const r = seeded(seed);
  const total = def.decor.reduce((s, k) => s + k.weight, 0);
  const pick = () => {
    let t = r() * total;
    for (const k of def.decor) { t -= k.weight; if (t <= 0) return k; }
    return def.decor[0];
  };
  const persp = (y: number) => lerp(0.52, 1.12, Math.max(0, Math.min(1, (y - horizon) / (H - horizon))));
  const yMin = horizon + 26;
  const yMax = H - 8;
  const items: Placed[] = [];

  for (let tries = 0; tries < 3200 && items.length < (def.decorCount ?? 130); tries++) {
    const kind = pick();
    let x: number;
    let y: number;
    if (kind.where === 'near') {
      const w = walk[Math.floor(r() * walk.length)];
      const side = r() < 0.5 ? -1 : 1;
      x = w.x + side * (46 + r() * 58);
      y = w.y + (r() - 0.5) * 50;
    } else if (kind.where === 'edge') {
      x = r() < 0.5 ? r() * W * 0.22 : W * (0.78 + r() * 0.22);
      y = yMin + r() * (yMax - yMin);
    } else {
      x = r() * W;
      y = yMin + r() * (yMax - yMin);
    }
    if (y < yMin || y > yMax || x < -6 || x > W + 6) continue;
    const s = (kind.size[0] + r() * (kind.size[1] - kind.size[0])) * persp(y) * (kind.where === 'edge' ? 1.12 : 1);
    const reach = s * 0.34;

    const wet = (px: number) => def.inWater(g, px, y);
    if (kind.where === 'water') {
      if (!(wet(x) && wet(x - reach) && wet(x + reach))) continue;
    } else if (wet(x) || wet(x - reach) || wet(x + reach)) {
      continue;
    }

    // keep the road (and the nodes on it) clear; tall things need more room
    const clear = 34 + (s > 40 ? s * 0.3 : 0);
    let ok = true;
    for (const w of walk) {
      const dx = w.x - x;
      const d1 = dx * dx + (w.y - y) * (w.y - y);
      const d2 = dx * dx + (w.y - (y - s * 0.4)) * (w.y - (y - s * 0.4));
      if (d1 < clear * clear || (s > 40 && d2 < clear * clear)) { ok = false; break; }
    }
    if (!ok) continue;
    if (Math.abs(x - landmarkX) < 70 && y < horizon + 78) continue;

    const spread = kind.spread ?? 1;
    for (const o of items) {
      const dx = o.x - x;
      const dy = (o.y - y) * 1.6;
      const m = (o.s + s) * 0.3 * spread;
      if (dx * dx + dy * dy < m * m) { ok = false; break; }
    }
    if (!ok) continue;

    items.push({ kind, x, y, s, v: Math.floor(r() * 1000), top: y - s * 1.12, bottom: y + s * 0.12 });
  }
  return items.sort((a, b) => a.y - b.y);
}

/* --- terrain ---------------------------------------------------------------------- */

export const WorldTerrain = React.memo(function WorldTerrain({ def, g }: { def: WorldDef; g: SceneGeom }) {
  return (
    <Svg width={g.W} height={g.H} viewBox={`0 0 ${g.W} ${g.H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>{def.defs(g)}</Defs>
      {def.terrain(g)}
      {def.decals?.(g)}
    </Svg>
  );
});

/* --- the road ---------------------------------------------------------------------- */

/** `walked` = how many level-to-level stretches have been travelled. */
export const WorldRoad = React.memo(function WorldRoad({ def, lay, walked }: {
  def: WorldDef; lay: Layout; walked: number;
}) {
  const { g, stretches } = lay;
  const all = useMemo(() => stretches.flat().join(' '), [stretches]);
  const done = useMemo(() => stretches.slice(0, Math.max(0, walked)).flat().join(' '), [stretches, walked]);
  const R = def.road;
  const stroke = (d: string, color: string, w: number, extra?: object) => (
    <Path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" {...extra} />
  );
  return (
    <Svg width={g.W} height={g.H} viewBox={`0 0 ${g.W} ${g.H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      {stroke(all, '#000000', R.width + 8, { strokeOpacity: 0.1, transform: 'translate(0 3)' })}
      {stroke(all, R.edge, R.width)}
      {stroke(all, R.fill, R.width - 7)}
      {stroke(all, R.dash, 3.2, { strokeDasharray: '2 10', strokeOpacity: 0.9 })}
      {done ? (
        <G>
          {stroke(done, R.walkedEdge, R.width)}
          {stroke(done, R.walkedFill, R.width - 7)}
          {stroke(done, R.walkedDash, 3.2, { strokeDasharray: '2 10', strokeOpacity: 0.95 })}
        </G>
      ) : null}
    </Svg>
  );
});

/* --- decor, in chunks ------------------------------------------------------------------ */

const CHUNK = 520;

/**
 * Scenery is split into horizontal chunks, each its own <Svg>, so no single
 * native view is thousands of pixels tall (some GPUs refuse textures that big).
 * A chunk is just a window onto the same map coordinates, so an item that
 * straddles a seam is drawn in both halves and lines up exactly.
 */
export const WorldDecor = React.memo(function WorldDecor({ def, lay, world }: {
  def: WorldDef; lay: Layout; world: number;
}) {
  const { g } = lay;
  const items = useMemo(() => placeDecor(def, lay, 700 + world * 31 + Math.round(g.W)), [def, lay, world, g.W]);
  const chunks = Math.ceil(g.H / CHUNK);
  return (
    <>
      {Array.from({ length: chunks }, (_, c) => {
        const y0 = c * CHUNK;
        const y1 = Math.min(g.H, y0 + CHUNK);
        const here = items.filter((it) => it.bottom >= y0 && it.top <= y1);
        const lm = def.landmark(g, lay.landmarkX);
        const ex = def.extras?.(g) ?? [];
        const behind = ex.filter((e) => !e.front && e.bottom >= y0 && e.top <= y1);
        const ahead = ex.filter((e) => e.front && e.bottom >= y0 && e.top <= y1);
        const showLm = y0 <= g.horizon + 60 && y1 >= g.horizon - 200;
        return (
          <Svg key={c} width={g.W} height={y1 - y0} viewBox={`0 ${y0} ${g.W} ${y1 - y0}`}
            style={{ position: 'absolute', left: 0, top: y0 }} pointerEvents="none">
            <Defs>{def.defs(g)}</Defs>
            {showLm ? lm : null}
            {behind.map((e, i) => <G key={`b${c}-${i}`}>{e.node}</G>)}
            {here.map((it, i) => <G key={`${c}-${i}`}>{it.kind.draw({ x: it.x, y: it.y, s: it.s, v: it.v })}</G>)}
            {ahead.map((e, i) => <G key={`a${c}-${i}`}>{e.node}</G>)}
          </Svg>
        );
      })}
    </>
  );
});

/* --- the backdrop: sky, sun, far ridges, ambient life ----------------------------------- */

function Layer({ p, scrollY, children }: { p: number; scrollY: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -scrollY.value * p }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

export const WorldBackdrop = React.memo(function WorldBackdrop({ def, g, scrollY }: {
  def: WorldDef; g: SceneGeom; scrollY: SharedValue<number>;
}) {
  const stops = def.skyStops;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: def.base }]}>
      {/* the sky itself is pinned */}
      <Svg width={g.W} height={g.screenH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={g.horizon + 20}>
            {stops.map((c, i) => <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />)}
          </SvgLinear>
        </Defs>
        <Rect x={0} y={0} width={g.W} height={g.screenH} fill="url(#sky)" />
      </Svg>

      <Layer p={0.05} scrollY={scrollY}>{def.sky(g)}</Layer>
      <Layer p={0.1} scrollY={scrollY}>{def.ambient.sky?.(g)}</Layer>

      {def.far.map((layer, i) => (
        <Layer key={i} p={layer.p} scrollY={scrollY}>
          <Svg width={g.W} height={g.horizon + 120} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>{def.defs(g)}</Defs>
            {layer.draw(g)}
          </Svg>
        </Layer>
      ))}
    </View>
  );
});

export const WorldFront = React.memo(function WorldFront({ def, g }: { def: WorldDef; g: SceneGeom }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{def.ambient.front?.(g)}</View>;
});

