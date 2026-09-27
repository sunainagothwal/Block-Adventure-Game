/* ============================================================================
 * AMBIENT MOTION
 *
 * Small, cheap, UI-thread animations that make a world feel alive: clouds
 * drift, stars twinkle, snow falls, fireflies wander. Each is a single
 * Animated.View driven by one looping clock — nothing touches the JS thread
 * after mount.
 * ========================================================================== */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';
import { Cloud } from './props';
import { seeded } from './util';

/** A looping 0..1 clock. Linear, so wrapping it never shows a seam. */
export function useClock(duration: number, delay = 0) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(p);
  }, [duration, delay, p]);
  return p;
}

/** A looping 0..1..0 value with a soft ease, for breathing and twinkling. */
export function useSwing(period: number, delay = 0) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(p);
  }, [period, delay, p]);
  return p;
}

/** Slides its child across the whole screen, forever, with an optional gentle bob. */
export function Drift({ W, y, w, h, duration, phase = 0, dir = 1, bob = 0, children }: {
  W: number; y: number; w: number; h: number; duration: number; phase?: number; dir?: 1 | -1; bob?: number;
  children: React.ReactNode;
}) {
  const p = useClock(duration);
  const style = useAnimatedStyle(() => {
    const t = (p.value + phase) % 1;
    const span = W + w * 2;
    const x = dir > 0 ? -w + t * span : W + w - t * span;
    return { transform: [{ translateX: x }, { translateY: bob ? Math.sin(t * Math.PI * 2 * 6) * bob : 0 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: y, width: w, height: h }, style]}>
      {children}
    </Animated.View>
  );
}

/** Fades between `min` and full opacity. */
export function Twinkle({ period, delay = 0, min = 0.2, style, children }: {
  period: number; delay?: number; min?: number; style?: object; children: React.ReactNode;
}) {
  const p = useSwing(period, delay);
  const a = useAnimatedStyle(() => ({ opacity: min + (1 - min) * p.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, a]}>{children}</Animated.View>;
}

/** Breathes: a slow scale and opacity swell. */
export function Breathe({ period, delay = 0, amp = 0.05, min = 0.7, style, children }: {
  period: number; delay?: number; amp?: number; min?: number; style?: object; children: React.ReactNode;
}) {
  const p = useSwing(period, delay);
  const a = useAnimatedStyle(() => ({ opacity: min + (1 - min) * p.value, transform: [{ scale: 1 + amp * p.value }] }));
  return <Animated.View pointerEvents="none" style={[style, a]}>{children}</Animated.View>;
}

/** Turns forever. */
export function Spin({ period, style, children }: { period: number; style?: object; children: React.ReactNode }) {
  const p = useClock(period);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 360}deg` }] }));
  return <Animated.View pointerEvents="none" style={[style, a]}>{children}</Animated.View>;
}

/** Slides side to side, for ribbons and wave crests. */
export function Slide({ period, amp, delay = 0, style, children }: {
  period: number; amp: number; delay?: number; style?: object; children: React.ReactNode;
}) {
  const p = useSwing(period, delay);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: (p.value - 0.5) * 2 * amp }] }));
  return <Animated.View pointerEvents="none" style={[style, a]}>{children}</Animated.View>;
}

/* --- snow / petals / dust: things that fall ------------------------------------ */

function Flake({ x0, size, duration, phase, sway, swayCycles, H, color, opacity }: {
  x0: number; size: number; duration: number; phase: number; sway: number; swayCycles: number;
  H: number; color: string; opacity: number;
}) {
  const p = useClock(duration);
  const a = useAnimatedStyle(() => {
    const t = (p.value + phase) % 1;
    return {
      transform: [
        { translateX: x0 + Math.sin(t * Math.PI * 2 * swayCycles) * sway },
        { translateY: -12 + t * (H + 24) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity,
    }, a]} />
  );
}

/** A screenful of drifting specks — snow, petals, ash, pollen. */
export function Falling({ W, H, count, color = '#FFFFFF', seed = 5, size = [2, 5], speed = [9000, 17000], sway = 18 }: {
  W: number; H: number; count: number; color?: string; seed?: number; size?: [number, number];
  speed?: [number, number]; sway?: number;
}) {
  const items = React.useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: count }, () => ({
      x0: r() * W, size: size[0] + r() * (size[1] - size[0]),
      duration: speed[0] + r() * (speed[1] - speed[0]), phase: r(),
      sway: sway * (0.4 + r() * 0.8), swayCycles: 1 + Math.floor(r() * 3), opacity: 0.55 + r() * 0.4,
    }));
  }, [W, count, seed, size, speed, sway]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((f, i) => <Flake key={i} {...f} H={H} color={color} />)}
    </View>
  );
}

/* --- fireflies ------------------------------------------------------------------- */

function Firefly({ cx, cy, ax, ay, period, phase, color, size }: {
  cx: number; cy: number; ax: number; ay: number; period: number; phase: number; color: string; size: number;
}) {
  const p = useClock(period);
  const a = useAnimatedStyle(() => {
    const t = p.value + phase;
    return {
      opacity: 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3)),
      transform: [
        { translateX: cx + Math.sin(t * Math.PI * 2) * ax },
        { translateY: cy + Math.cos(t * Math.PI * 2 * 2) * ay },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size * 4, height: size * 4, alignItems: 'center', justifyContent: 'center' }, a]}>
      <View style={{ position: 'absolute', width: size * 4, height: size * 4, borderRadius: size * 2, backgroundColor: color, opacity: 0.16 }} />
      <View style={{ position: 'absolute', width: size * 2.2, height: size * 2.2, borderRadius: size * 1.1, backgroundColor: color, opacity: 0.3 }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF' }} />
    </Animated.View>
  );
}

export function Fireflies({ W, H, count, color = '#FFE58A', seed = 9, area }: {
  W: number; H: number; count: number; color?: string; seed?: number; area?: [number, number];
}) {
  const items = React.useMemo(() => {
    const r = seeded(seed);
    const [y0, y1] = area ?? [H * 0.35, H * 0.95];
    return Array.from({ length: count }, () => ({
      cx: 10 + r() * (W - 20), cy: y0 + r() * (y1 - y0), ax: 14 + r() * 28, ay: 8 + r() * 18,
      period: 9000 + r() * 9000, phase: r(), size: 3 + r() * 2,
    }));
  }, [W, H, count, seed, area]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((f, i) => <Firefly key={i} {...f} color={color} />)}
    </View>
  );
}

/* --- a shooting star ---------------------------------------------------------------- */

export function ShootingStar({ W, y, period = 11000, delay = 3000 }: { W: number; y: number; period?: number; delay?: number }) {
  const p = useClock(period, delay);
  const a = useAnimatedStyle(() => {
    const t = p.value / 0.09;
    const on = t >= 0 && t <= 1;
    return {
      opacity: on ? Math.sin(t * Math.PI) : 0,
      transform: [{ translateX: W * 0.85 - t * W * 0.5 }, { translateY: y + t * 90 }, { rotate: '-28deg' }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: 90, height: 6 }, a]}>
      <Svg width={90} height={6} viewBox="0 0 90 6">
        <Defs>
          <SvgLinear id="ss" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
          </SvgLinear>
        </Defs>
        <Path d="M0 3 L86 3" stroke="url(#ss)" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M86 3 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** A cloud that drifts across the sky. `s` is its width in px. */
export function CloudDrift({ W, y, s, duration, phase = 0, dir = 1, color = '#FFFFFF', shade = '#DCEFFF', o = 1 }: {
  W: number; y: number; s: number; duration: number; phase?: number; dir?: 1 | -1;
  color?: string; shade?: string; o?: number;
}) {
  const w = s;
  const h = s * 0.78;
  return (
    <Drift W={W} y={y} w={w} h={h} duration={duration} phase={phase} dir={dir}>
      <Svg width={w} height={h} viewBox="-50 -40 100 78"><Cloud x={0} y={0} s={100} color={color} shade={shade} o={o} /></Svg>
    </Drift>
  );
}
