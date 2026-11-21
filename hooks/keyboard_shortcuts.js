import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAX_VOLUME, usePlayer } from '../src/context/player';
import { dismissToast, toast } from '../utils/toast';
import {
  is_browser_history_arrow,
  is_browser_primary_chord,
  isTypingTarget,
  track_jump_digit
} from '../utils/keyboard';

const STATUS_DURATION = 1200;
const HOTKEYS_PATH = '/about/hotkeys';

export function useKeyboardShortcuts({ toggleFullscreen } = {}) {
  const player = usePlayer();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const ref = useRef(player);
  ref.current = player;
  const fullscreenRef = useRef(toggleFullscreen);
  fullscreenRef.current = toggleFullscreen;
  const routeRef = useRef({ navigate, pathname });
  routeRef.current = { navigate, pathname };
  const statusId = useRef(null);

  useEffect(() => {
    const status = (message) => {
      if (statusId.current !== null) dismissToast(statusId.current);
      statusId.current = toast.info(message, STATUS_DURATION);
    };

    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        const route = routeRef.current;
        if (route.pathname !== HOTKEYS_PATH) route.navigate(HOTKEYS_PATH);
        return;
      }

      const tag = e.target?.tagName?.toLowerCase() ?? '';
      if (tag === 'button' && e.code === 'Space') return;

      const { audioRef, seek, setVolume, togglePlay, next, prev, toggleShuffle, cycleRepeat } = ref.current;
      const audio = audioRef.current;
      if (!audio) return;

      const duration = () => (Number.isFinite(audio.duration) ? audio.duration : 0);

      const scrub = (amount) => {
        const dur = duration();
        const target = Math.max(0, Math.min(dur || audio.currentTime + amount, audio.currentTime + amount));
        seek(target);
      };

      const jumpToPercent = (percent) => {
        const dur = duration();
        const target = dur * percent;
        seek(target);
      };

      const changeVolume = (delta) => {
        const level = Math.max(0, Math.min(MAX_VOLUME, ref.current.volume + delta));
        setVolume(level);
      };

      if (is_browser_history_arrow(e)) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          if (e.code === 'KeyK' && is_browser_primary_chord(e)) return;
          e.preventDefault();
          togglePlay();
          break;

        case 'KeyR':
          if (!is_browser_primary_chord(e)) {
            e.preventDefault();
            seek(0);
            status('Restarted the track');
          }
          break;

        case 'KeyT':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          cycleRepeat();
          break;

        case 'KeyH':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          toggleShuffle();
          break;

        case 'KeyF':
          if (is_browser_primary_chord(e)) {
            const search = document.querySelector('.xe_search-input');
            if (search) {
              e.preventDefault();
              search.focus();
              search.select();
            }
          } else if (fullscreenRef.current) {
            e.preventDefault();
            fullscreenRef.current();
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) scrub(-1);
          else if (e.ctrlKey) scrub(-5);
          else scrub(-10);
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) scrub(1);
          else if (e.ctrlKey) scrub(5);
          else scrub(10);
          break;

        case 'KeyJ':
        case 'KeyA':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          if (e.altKey) scrub(-30);
          else if (e.shiftKey) scrub(-1);
          else scrub(-10);
          break;

        case 'KeyL':
        case 'KeyD':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          if (e.altKey) scrub(30);
          else if (e.shiftKey) scrub(1);
          else scrub(10);
          break;

        case 'KeyW':
        case 'ArrowUp':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          changeVolume(0.02);
          break;

        case 'KeyS':
        case 'ArrowDown':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          changeVolume(-0.02);
          break;

        case 'KeyZ':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          prev();
          break;

        case 'KeyX':
          if (is_browser_primary_chord(e)) return;
          e.preventDefault();
          next();
          break;

        default: {
          const num = track_jump_digit(e);
          if (num !== null) {
            e.preventDefault();
            let perc;
            if (num === 0) {
              perc = e.shiftKey ? 0.95 : 0;
            } else {
              perc = num * 0.1;
              if (e.shiftKey) perc = Math.max(0, perc - 0.05);
            }
            jumpToPercent(perc);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
