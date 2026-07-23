import { useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();
export function useScrollRestoration<T extends HTMLElement>() {
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const detachRef = useRef<(() => void) | null>(null);

  const ref = useCallback((el: T | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!el) return;

    const saved = scrollPositions.get(pathnameRef.current);
    if (saved) el.scrollTop = saved;

    const onScroll = () => scrollPositions.set(pathnameRef.current, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    detachRef.current = () => {
      scrollPositions.set(pathnameRef.current, el.scrollTop);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  return ref;
}
