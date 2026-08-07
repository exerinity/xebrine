import { useEffect, useRef } from 'react';

/**
 * @param {import('react').RefObject<HTMLElement | null>} ref
 * @param {(direction: 1 | -1) => void} onStep
 */
export function useWheel(ref, onStep) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      onStepRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
}
