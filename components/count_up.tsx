import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/settings_context';

const DEFAULT_DURATION = 1100;

interface CountUpProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: (value: number) => string;
}

export function CountUp({ value, duration = DEFAULT_DURATION, delay = 0, format }: CountUpProps) {
  const { settings } = useSettings();
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (settings.reducedMotion) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start - delay;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      setDisplay(value * (1 - (1 - t) ** 3));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, delay, settings.reducedMotion]);

  return <>{format ? format(display) : Math.round(display).toLocaleString()}</>;
}
