import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAX_VOLUME, usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { dismissToast, toast } from '../utils/toast';
import { isTypingTarget } from '../utils/keyboard';

const STATUS_DURATION = 1200;
const HOTKEYS_PATH = '/i/hotkeys';

interface KeyboardShortcutOptions {
  toggleFullscreen?: () => void;
}
export function useKeyboardShortcuts({ toggleFullscreen }: KeyboardShortcutOptions = {}) {
  const player = usePlayer();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const ref = useRef(player);
  ref.current = player;
  const fullscreenRef = useRef(toggleFullscreen);
  fullscreenRef.current = toggleFullscreen;
  const routeRef = useRef({ navigate, pathname });
  routeRef.current = { navigate, pathname };
  const statusId = useRef<number | null>(null);

  useEffect(() => {
    const status = (message: string) => {
      if (statusId.current !== null) dismissToast(statusId.current);
      statusId.current = toast.info(message, STATUS_DURATION);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        const route = routeRef.current;
        if (route.pathname !== HOTKEYS_PATH) route.navigate(HOTKEYS_PATH);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
      if (tag === 'button' && e.code === 'Space') return;

      const { audioRef, seek, setVolume, togglePlay, next, prev, toggleShuffle, cycleRepeat } = ref.current;
      const audio = audioRef.current;
      if (!audio) return;

      const duration = () => (Number.isFinite(audio.duration) ? audio.duration : 0);

      const scrub = (amount: number) => {
        const dur = duration();
        const target = Math.max(0, Math.min(dur || audio.currentTime + amount, audio.currentTime + amount));
        seek(target);
        const pct = dur ? Math.round((target / dur) * 100) : 0;
        status(`Scrubbing to ${formatTime(target)} / ${formatTime(dur)} (${amount >= 0 ? '+' : ''}${amount}s, ${pct}%)`);
      };

      const jumpToPercent = (percent: number) => {
        const dur = duration();
        const target = dur * percent;
        seek(target);
        status(`Jumping to ${Math.round(percent * 100)}% (${formatTime(target)} / ${formatTime(dur)})`);
      };

      const changeVolume = (delta: number) => {
        const level = Math.max(0, Math.min(MAX_VOLUME, ref.current.volume + delta));
        setVolume(level);
        status(`Volume: ${Math.round(level * 100)}%`);
      };

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;

        case 'KeyR':
          if (!e.ctrlKey) {
            e.preventDefault();
            seek(0);
            status('Restarted the track');
          }
          break;

        case 'KeyT':
          cycleRepeat();
          break;

        case 'KeyH':
          e.preventDefault();
          toggleShuffle();
          break;

        case 'KeyF':
          if (e.ctrlKey || e.metaKey) {
            const search = document.querySelector<HTMLInputElement>('.xe_search-input');
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
        case 'KeyJ':
        case 'KeyA':
          e.preventDefault();
          if (e.altKey) scrub(-30);
          else if (e.shiftKey) scrub(-1);
          else if (e.ctrlKey) scrub(-5);
          else scrub(-10);
          break;

        case 'ArrowRight':
        case 'KeyL':
        case 'KeyD':
          e.preventDefault();
          if (e.altKey) scrub(30);
          else if (e.shiftKey) scrub(1);
          else if (e.ctrlKey) scrub(5);
          else scrub(10);
          break;

        case 'KeyW':
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.02);
          break;

        case 'KeyS':
        case 'ArrowDown':
          if (!e.ctrlKey) {
            e.preventDefault();
            changeVolume(-0.02);
          }
          break;

        case 'KeyZ':
          prev();
          break;

        case 'KeyX':
          next();
          break;

        default:
          if (e.code.startsWith('Digit')) {
            const num = parseInt(e.code.slice(5), 10);
            if (!isNaN(num)) {
              e.preventDefault();
              let perc: number;
              if (num === 0) {
                perc = e.shiftKey ? 0.95 : 0;
              } else {
                perc = num * 0.1;
                if (e.shiftKey) perc = Math.max(0, perc - 0.05);
              }
              jumpToPercent(perc);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
