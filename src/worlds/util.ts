/* Small geometry + randomness helpers shared by every world. */

export type Pt = { x: number; y: number };

export const q2 = (n: number) => Math.round(n * 100) / 100;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A tiny deterministic PRNG, so a world never reshuffles between visits. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Cubic = { a: Pt; b: Pt; c: Pt; d: Pt };

/** Catmull-Rom through the points, as one cubic Bézier per pair. */
export function cubics(pts: Pt[]): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    out.push({
      a: p1,
      b: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      d: p2,
    });
  }
  return out;
}

const seg = (c: Cubic) =>
  `C${q2(c.b.x)} ${q2(c.b.y)} ${q2(c.c.x)} ${q2(c.c.y)} ${q2(c.d.x)} ${q2(c.d.y)}`;

/** One smooth path through every point. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  return `M${q2(pts[0].x)} ${q2(pts[0].y)} ` + cubics(pts).map(seg).join(' ');
}

/** The same curve, split per pair so each stretch of road can be styled alone. */
export function smoothSegments(pts: Pt[]): string[] {
  return cubics(pts).map((c) => `M${q2(c.a.x)} ${q2(c.a.y)} ${seg(c)}`);
}

/** The curve as a dense polyline, for keeping scenery off the road. */
export function sampleCurve(pts: Pt[], per = 10): Pt[] {
  const out: Pt[] = [];
  for (const c of cubics(pts)) {
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const u = 1 - t;
      out.push({
        x: u * u * u * c.a.x + 3 * u * u * t * c.b.x + 3 * u * t * t * c.c.x + t * t * t * c.d.x,
        y: u * u * u * c.a.y + 3 * u * u * t * c.b.y + 3 * u * t * t * c.c.y + t * t * t * c.d.y,
      });
    }
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

/** A rolling ridge line, closed along `bottom`, from a few summed sine waves. */
export function ridgePath(
  W: number, base: number, amp: number, phase: number, bottom: number,
  waves: [number, number][] = [[1.2, 1], [2.7, 0.5], [5.3, 0.22]],
): string {
  let d = `M-20 ${q2(bottom)}`;
  const norm = waves.reduce((s, w) => s + w[1], 0);
  for (let x = -20; x <= W + 20; x += 12) {
    let v = 0;
    for (let i = 0; i < waves.length; i++) v += waves[i][1] * Math.sin((x / W) * Math.PI * 2 * waves[i][0] + phase * (i + 1.3));
    d += ` L${q2(x)} ${q2(base - amp * (0.5 + (0.5 * v) / norm))}`;
  }
  return `${d} L${q2(W + 20)} ${q2(bottom)} Z`;
}

/** The y of a matching ridge at x, for standing things on it. */
export function ridgeY(
  W: number, base: number, amp: number, phase: number, x: number,
  waves: [number, number][] = [[1.2, 1], [2.7, 0.5], [5.3, 0.22]],
): number {
  const norm = waves.reduce((s, w) => s + w[1], 0);
  let v = 0;
  for (let i = 0; i < waves.length; i++) v += waves[i][1] * Math.sin((x / W) * Math.PI * 2 * waves[i][0] + phase * (i + 1.3));
  return base - amp * (0.5 + (0.5 * v) / norm);
}

/** A ground surface: its top edge as a polyline, and the same closed down to the bottom of the map. */
export function groundPaths(W: number, H: number, top: (x: number) => number) {
  let edge = '';
  for (let x = -20; x <= W + 20; x += 12) edge += `${edge ? ' L' : 'M'}${q2(x)} ${q2(top(x))}`;
  return { edge, fill: `${edge} L${W + 20} ${H + 20} L-20 ${H + 20} Z` };
}
