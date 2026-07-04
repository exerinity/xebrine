import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { clamp } from '../utils/format';
import {
  DiscIcon,
  HomeIcon,
  LogoIcon,
  LyricsIcon,
  PersonIcon,
  QueueIcon,
  SettingsIcon
} from './icons';

const NAV_LINKS = [
  { path: '/home', label: 'Library', icon: HomeIcon },
  { path: '/artists', label: 'Artists', icon: PersonIcon },
  { path: '/albums', label: 'Albums', icon: DiscIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
  { path: '/lyrics', label: 'Lyrics', icon: LyricsIcon },
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

export function Sidebar() {
  const { queue } = usePlayer();
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

  return (
    <nav className={`xe_nav${collapsed ? ' xe_nav--collapsed' : ''}`} style={{ width }}>
      <Link to="/about" className="xe_nav__logo" title="About Xebrine">
        <LogoIcon size={22} />
        {!collapsed && <span>Xebrine</span>}
      </Link>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) => `xe_nav__link${isActive ? ' xe_nav__link--active' : ''}`}
          title={collapsed ? link.label : undefined}
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
        </NavLink>
      ))}
      {!smallScreen && (
        <div
          className="xe_nav__resize"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize"
        />
      )}
    </nav>
  );
}
