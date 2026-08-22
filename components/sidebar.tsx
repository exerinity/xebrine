import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { useRemote } from '../context/remote_context';
import { LATEST_VERSION } from '../pages/release_notes';
import { clamp } from '../utils/format';
import {
  DiscIcon,
  FullscreenIcon,
  HomeIcon,
  LastfmMarkIcon,
  LogoIcon,
  LyricsIcon,
  NoteIcon,
  PersonIcon,
  QueueIcon,
  RemoteIcon,
  SearchIcon,
  SettingsIcon
} from './icons';

export const NAV_LINKS = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/search', label: 'Search', icon: SearchIcon },
  { path: '/library', label: 'Library', icon: NoteIcon },
  { path: '/artists', label: 'Artists', icon: PersonIcon },
  { path: '/albums', label: 'Albums', icon: DiscIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
  { path: '/lyrics', label: 'Lyrics', icon: LyricsIcon },
  { path: '/lastfm', label: 'Last.fm', icon: LastfmMarkIcon },
  { path: '/remote', label: 'Remote', icon: RemoteIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon }
];

const WIDTH_KEY = 'xebrine.navWidth';
const MIN_WIDTH = 56;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 200;
const COLLAPSE_AT = 124;
const RAIL_WIDTH = 62;
const SMALL_SCREEN = 560;

function loadWidth(): number {
  const raw = localStorage.getItem(WIDTH_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? clamp(n, MIN_WIDTH, MAX_WIDTH) : DEFAULT_WIDTH;
}

interface SidebarProps {
  onOpenFullscreen?: () => void;
}

export function Sidebar({ onOpenFullscreen }: SidebarProps) {
  const { queue, current } = usePlayer();
  const remote = useRemote();
  const remoteWaiting = remote.pending.length;
  const remoteRunning = remote.phase === 'live' || remote.phase === 'connecting';
  const remoteState = remoteWaiting > 0 ? 'waiting' : remoteRunning ? 'live' : '';
  const [navWidth, setNavWidth] = useState(loadWidth);
  const navWidthRef = useRef(navWidth);
  navWidthRef.current = navWidth;
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia(`(max-width: ${SMALL_SCREEN}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${SMALL_SCREEN}px)`);
    const onChange = () => setSmallScreen(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const collapsed = smallScreen || navWidth <= COLLAPSE_AT;
  const width = smallScreen ? RAIL_WIDTH : navWidth;

  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    if (smallScreen || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = navWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: globalThis.PointerEvent) => {
      setNavWidth(clamp(startWidth + (ev.clientX - startX), MIN_WIDTH, MAX_WIDTH));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(WIDTH_KEY, String(navWidthRef.current));
      } catch {
        null;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const resetWidth = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setNavWidth(DEFAULT_WIDTH);
    try {
      localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
    } catch {
      null;
    }
  };

  return (
    <nav className={`xe_nav${collapsed ? ' xe_nav--collapsed' : ''}`} style={{ width }}>
      <Link to="/i" className="xe_nav__logo" title="About Xebrine">
        <LogoIcon size={22} />
        {!collapsed && <span>Xebrine {LATEST_VERSION}</span>}
      </Link>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) =>
            `xe_nav__link${isActive ? ' xe_nav__link--active' : ''}${
              link.path === '/remote' && remoteState ? ` xe_nav__link--remote-${remoteState}` : ''
            }`
          }
          title={
            link.path === '/remote' && remoteState
              ? remoteWaiting > 0
                ? `${remoteWaiting} device${remoteWaiting === 1 ? '' : 's'} waiting for approval`
                : `Remote session running (${remote.controllers.length} connected)`
              : collapsed
                ? link.label
                : undefined
          }
        >
          <span className="xe_nav__link-content">
            <link.icon size={16} />
            {!collapsed && link.label}
          </span>
          {link.path === '/queue' &&
            queue.length > 0 &&
            (collapsed ? (
              <span className="xe_nav__dot" />
            ) : (
              <span className="xe_nav__badge">{queue.length}</span>
            ))}
          {link.path === '/remote' &&
            remoteState &&
            (collapsed ? (
              <span className="xe_nav__dot" />
            ) : (
              <span className="xe_nav__badge">
                {remoteWaiting > 0 ? remoteWaiting : remote.controllers.length || '!'}
              </span>
            ))}
        </NavLink>
      ))}
      {current && (
        <div className="xe_nav__fullscreen-slot">
          <button
            type="button"
            className="xe_nav__link xe_nav__fullscreen"
            onClick={onOpenFullscreen}
            title="Open fullscreen player"
            aria-label="Open fullscreen player"
          >
            <span className="xe_nav__link-content">
              <FullscreenIcon size={16} />
              {!collapsed && 'Fullscreen'}
            </span>
          </button>
        </div>
      )}
      {!smallScreen && (
        <div
          className="xe_nav__resize"
          onPointerDown={startResize}
          onContextMenu={resetWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize, right-click to reset"
        />
      )}
    </nav>
  );
}
