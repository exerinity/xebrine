import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_LINKS } from '../components/sidebar';
import { clamp } from '../utils/format';
import type { PageKeyMode } from '../utils/page_keys';

export function usePageKeys(mode: PageKeyMode) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const ref = useRef({ mode, pathname, navigate });
  ref.current = { mode, pathname, navigate };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;

      const { mode, pathname, navigate } = ref.current;
      if (mode === 'off') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (mode === 'shift' && !e.shiftKey) return;

      const index = NAV_LINKS.findIndex(
        (link) => pathname === link.path || pathname.startsWith(`${link.path}/`)
      );
      if (index < 0) return;

      e.preventDefault();
      const next = clamp(index + (e.key === 'PageDown' ? 1 : -1), 0, NAV_LINKS.length - 1);
      if (next !== index) navigate(NAV_LINKS[next].path);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
