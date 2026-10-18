import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_LINKS } from '../components/sidebar';
import { clamp } from '../utils/format';
import { isTypingTarget } from '../utils/keyboard';
import type { PageKeyMode } from '../utils/page_keys';

const NAVIGATION_DELAY_MS = 200;

export function usePageKeys(mode: PageKeyMode) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [cursor_path, set_cursor_path] = useState<string | null>(null);
  const cursor_index = useRef<number | null>(null);
  const navigation_timer = useRef<number | null>(null);
  const pressed_keys = useRef(new Set<string>());

  const ref = useRef({ mode, pathname, navigate });
  ref.current = { mode, pathname, navigate };

  const clear_pending = useCallback(() => {
    if (navigation_timer.current !== null) window.clearTimeout(navigation_timer.current);
    navigation_timer.current = null;
    cursor_index.current = null;
    pressed_keys.current.clear();
    set_cursor_path(null);
  }, []);

  useEffect(() => {
    clear_pending();
  }, [clear_pending, mode, pathname]);

  useEffect(() => {
    const schedule_navigation = () => {
      if (cursor_index.current === null || pressed_keys.current.size > 0) return;
      if (navigation_timer.current !== null) window.clearTimeout(navigation_timer.current);
      navigation_timer.current = window.setTimeout(() => {
        const next = cursor_index.current;
        clear_pending();
        if (next === null) return;
        const { pathname, navigate } = ref.current;
        const index = NAV_LINKS.findIndex(
          (link) => pathname === link.path || pathname.startsWith(`${link.path}/`)
        );
        if (index >= 0 && next !== index) navigate(NAV_LINKS[next].path);
      }, NAVIGATION_DELAY_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;

      const { mode, pathname } = ref.current;
      if (mode === 'off') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (mode === 'shift' && !e.shiftKey) return;
      if ((e.target instanceof Element && isTypingTarget(e.target)) || document.querySelector('[aria-modal="true"]')) return;

      const index = NAV_LINKS.findIndex(
        (link) => pathname === link.path || pathname.startsWith(`${link.path}/`)
      );
      if (index < 0) return;

      const previous = cursor_index.current ?? index;
      const next = clamp(previous + (e.key === 'PageDown' ? 1 : -1), 0, NAV_LINKS.length - 1);
      if (next === previous && cursor_index.current === null) return;

      e.preventDefault();
      pressed_keys.current.add(e.key);
      cursor_index.current = next;
      set_cursor_path(NAV_LINKS[next].path);
      if (navigation_timer.current !== null) window.clearTimeout(navigation_timer.current);
      navigation_timer.current = null;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      pressed_keys.current.delete(e.key);
      schedule_navigation();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear_pending);
    window.addEventListener('pointerdown', clear_pending);
    window.addEventListener('focusin', clear_pending);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear_pending);
      window.removeEventListener('pointerdown', clear_pending);
      window.removeEventListener('focusin', clear_pending);
      if (navigation_timer.current !== null) window.clearTimeout(navigation_timer.current);
    };
  }, [clear_pending]);

  return cursor_path;
}
