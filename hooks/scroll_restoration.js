import { useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map();
export function useScrollRestoration() {
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const detachRef = useRef(/** @type {(() => void) | null} */ (null));

  const ref = useCallback(/** @param {HTMLElement | null} el */ (el) => {
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
