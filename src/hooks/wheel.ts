import { useEffect, useRef, type RefObject } from 'react';

export function useWheel(ref: RefObject<HTMLElement | null>, onStep: (direction: 1 | -1) => void): void {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      onStepRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
}
