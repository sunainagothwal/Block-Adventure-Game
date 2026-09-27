import type { ReactNode } from 'react';

/** Everything a world needs to know about the screen it is drawn on. */
export type SceneGeom = {
  /** Screen width. */
  W: number;
  /** Total height of the scrolling map. */
  H: number;
  /** Where the ground meets the sky, in map coordinates. */
  horizon: number;
  /** Height of the visible screen. */
  screenH: number;
  /** Height of the header the map slides under. */
  headerH: number;
};

/** One kind of scenery: how often it appears, how big, and where it may grow. */
export type DecorKind = {
  id: string;
  weight: number;
  /** Nominal height range in px, before the perspective scale is applied. */
  size: [number, number];
  /**
   *  any    — anywhere on dry ground
   *  edge   — hugging the left and right margins (big things)
   *  near   — a little way off the road (small things you'd notice walking)
   *  water  — only on water
   */
  where: 'any' | 'edge' | 'near' | 'water';
  /** Extra breathing room around it, as a multiple of its size. */
  spread?: number;
  draw: (p: { x: number; y: number; s: number; v: number }) => ReactNode;
};

/** A fixed set-piece in map coordinates: a house, a bridge, a signpost. */
export type MapExtra = {
  top: number;
  bottom: number;
  /** Drawn in front of the scenery instead of behind it. */
  front?: boolean;
  node: ReactNode;
};

export type Ambient = {
  /** Screen-space animation drawn in front of the map, behind the header. */
  front?: (g: SceneGeom) => ReactNode;
  /** Animated sky pieces that drift with the sky layer (clouds, gulls, aurora). */
  sky?: (g: SceneGeom) => ReactNode;
};

export type ParallaxLayer = {
  /** 0 = pinned to the screen, 1 = scrolls with the ground. */
  p: number;
  /** Drawn in map coordinates; everything below the horizon is hidden by the ground. */
  draw: (g: SceneGeom) => ReactNode;
};

export type WorldDef = {
  name: string;
  /** The area's own name, shown on the Home sign (defaults to the world name). */
  area?: string;
  blurb: string;
  /** Shown behind everything, so an overscroll bounce never flashes black. */
  base: string;
  /** Sky gradient, top to horizon. */
  skyStops: string[];
  /** Sky art in screen coordinates — sun, moon, stars — as self-contained nodes (Svg and/or animated views). */
  sky: (g: SceneGeom) => ReactNode;
  /** Distant ridges that slide slower than the ground. */
  far: ParallaxLayer[];
  /** Gradients and clips the terrain and scenery refer to. */
  defs: (g: SceneGeom) => ReactNode;
  /** The ground itself, in map coordinates. */
  terrain: (g: SceneGeom) => ReactNode;
  /** True where scenery must not grow (water). */
  inWater: (g: SceneGeom, x: number, y: number) => boolean;
  /** Small drawings on the ground under the road: shadows, ripples, patches. */
  decals?: (g: SceneGeom) => ReactNode;
  decor: DecorKind[];
  /** How many pieces of scenery to scatter (default 130). */
  decorCount?: number;
  /** Fixed set-pieces placed by the world itself. */
  extras?: (g: SceneGeom) => MapExtra[];
  /** The landmark at the far end of the road, drawn at (x, y) at the horizon. */
  landmark: (g: SceneGeom, x: number) => ReactNode;
  ambient: Ambient;
  road: {
    edge: string; fill: string; dash: string; width: number;
    /** The stretch already travelled. */
    walkedEdge: string; walkedFill: string; walkedDash: string;
  };
  /** How the winding road sits: centre (0..1 of the width), swing, and wavelength. */
  pathShape: { centre: number; swing: number; wave: number; phase: number };
  /** Accent used by the level nodes' glow. */
  accent: string;
};
