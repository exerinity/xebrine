import { useEffect, type RefObject } from 'react';
import { clamp } from '../utils/format';

export const KEN_BURNS_MIN_INTENSITY = 0.2;
export const KEN_BURNS_MAX_INTENSITY = 5;
export const KEN_BURNS_DEFAULT_INTENSITY = 2;

const SCALE_MIN = 1.15;
const SCALE_MAX = 2.2;
const LEG_MIN_SECONDS = 10;
const LEG_MAX_SECONDS = 20;

interface Waypoint {
  x: number;
  y: number;
  scale: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function nextWaypoint(): Waypoint {
  const scale = rand(SCALE_MIN, SCALE_MAX);
  const reach = ((scale - 1) / 2) * 100;
  return { x: rand(-reach, reach), y: rand(-reach, reach), scale };
}

export function useKenBurns(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  intensity: number
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const speed = clamp(intensity, KEN_BURNS_MIN_INTENSITY, KEN_BURNS_MAX_INTENSITY);
    const legSeconds = () => rand(LEG_MIN_SECONDS, LEG_MAX_SECONDS) / speed;

    let from: Waypoint = { x: 0, y: 0, scale: SCALE_MIN };
    let to = nextWaypoint();
    let duration = legSeconds();
    let progress = 0;
    let last: number | null = null;
    let raf = 0;

    const frame = (now: number) => {
      if (last === null) last = now;
      progress += (now - last) / 1000 / duration;
      last = now;

      if (progress >= 1) {
        progress = 0;
        from = to;
        to = nextWaypoint();
        duration = legSeconds();
      }

      const eased = easeInOut(progress);
      const x = lerp(from.x, to.x, eased);
      const y = lerp(from.y, to.y, eased);
      const scale = lerp(from.scale, to.scale, eased);
      el.style.transform = `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) scale(${scale.toFixed(4)})`;
      raf = requestAnimationFrame(frame);
    };

    el.style.willChange = 'transform';
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      el.style.willChange = '';
      el.style.transform = '';
    };
  }, [ref, enabled, intensity]);
}
