import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { usePlayer } from '../src/context/player';
import { useLibrary } from '../context/library_context';
import { useRemote } from '../context/remote_context';
import { useSettings } from '../context/settings_context';
import { AUTO_PLAY_LABELS, AUTO_PLAY_LEVELS } from '../queue/auto_play';
import { clamp } from '../utils/format';
import { THEMES } from '../utils/themes';
import {
  DiscIcon,
  FullscreenIcon,
  HomeIcon,
  LastfmMarkIcon,
  PlaylistIcon,
  LogoIcon,
  LyricsIcon,
  NoteIcon,
  PersonIcon,
  QueueIcon,
  RadioIcon,
  RemoteIcon,
  SearchIcon,
  SettingsIcon
} from './icons';
import { ContextMenu, type ContextMenuItem } from './context_menu';

export const NAV_LINKS = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/search', label: 'Search', icon: SearchIcon },
  { path: '/library', label: 'Library', icon: NoteIcon },
  { path: '/artists', label: 'Artists', icon: PersonIcon },
  { path: '/albums', label: 'Albums', icon: DiscIcon },
  { path: '/playlists', label: 'Playlists', icon: PlaylistIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
  { path: '/lyrics', label: 'Lyrics', icon: LyricsIcon },
  { path: '/lastfm', label: 'Last.fm', icon: LastfmMarkIcon },
  { path: '/remote', label: 'Remote', icon: RemoteIcon },
  { path: '/radio', label: 'Radio', icon: RadioIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon }
];

const WIDTH_KEY = 'xebrine.navWidth';
const MIN_WIDTH = 56;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 200;
const COLLAPSE_AT = 124;
const RAIL_WIDTH = 62;
const SMALL_SCREEN = 560;
const SETTINGS_SECTIONS = [
  { id: 'preferences', label: 'Main preferences' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'home', label: 'Home layout' },
  { id: 'library', label: 'Library settings' },
  { id: 'playback', label: 'Playback settings' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'toys', label: 'Toys' },
  { id: 'share', label: 'Share settings' },
  { id: 'settings', label: 'All settings' }
];

function loadWidth(): number {
  const raw = localStorage.getItem(WIDTH_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? clamp(n, MIN_WIDTH, MAX_WIDTH) : DEFAULT_WIDTH;
}

interface SidebarProps {
  onOpenFullscreen?: () => void;
  page_key_cursor_path?: string | null;
}

export function Sidebar({ onOpenFullscreen, page_key_cursor_path }: SidebarProps) {
  const navigate = useNavigate();
  const { queue, current, radio_station, autoMixEnabled, toggleAutoMix } = usePlayer();
  const { folders, scanning, rescanFolder, scanNewFiles } = useLibrary();
  const { settings, update } = useSettings();
  const remote = useRemote();
  const remoteWaiting = remote.pending.length;
  const hasRemoteStatus = remoteWaiting > 0 || remote.phase === 'live' || remote.phase === 'connecting';
  const [navWidth, setNavWidth] = useState(loadWidth);
  const navWidthRef = useRef(navWidth);
  navWidthRef.current = navWidth;
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia(`(max-width: ${SMALL_SCREEN}px)`).matches
  );
  const [settingsMenu, setSettingsMenu] = useState<{ x: number; y: number } | null>(null);
  const [remoteMenu, setRemoteMenu] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen_menu, set_fullscreen_menu] = useState<{ x: number; y: number } | null>(null);

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

  const set_notifications = async (enabled: boolean) => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    update({ notifications: enabled });
  };

  const main_preferences_menu: ContextMenuItem[] = [
    {
      label: 'LRCLIB config',
      submenu: [
        {
          label: 'Strict',
          checked: settings.lrclibMode === 'strict',
          onSelect: () => update({ lrclibMode: 'strict' })
        },
        {
          label: 'Lax',
          checked: settings.lrclibMode === 'lax',
          onSelect: () => update({ lrclibMode: 'lax' })
        }
      ]
    },
    {
      label: 'Page keys navigation',
      submenu: [
        {
          label: 'Disabled',
          checked: settings.pageKeyMode === 'off',
          onSelect: () => update({ pageKeyMode: 'off' })
        },
        {
          label: 'Shift',
          checked: settings.pageKeyMode === 'shift',
          onSelect: () => update({ pageKeyMode: 'shift' })
        },
        {
          label: 'Enabled',
          checked: settings.pageKeyMode === 'page',
          onSelect: () => update({ pageKeyMode: 'page' })
        }
      ]
    },
    {
      label: 'Notifications',
      checked: settings.notifications,
      onSelect: () => void set_notifications(!settings.notifications)
    },
    {
      label: 'Prevent exit',
      checked: settings.preventExit,
      onSelect: () => update({ preventExit: !settings.preventExit })
    }
  ];

  const appearance_menu: ContextMenuItem[] = [
    {
      label: 'Theme',
      submenu: THEMES.map((theme) => ({
        label: theme.label,
        checked: settings.theme === theme.id,
        onSelect: () => update({ theme: theme.id })
      }))
    },
    {
      label: 'Page background',
      checked: settings.showBackgroundIcon,
      onSelect: () => update({ showBackgroundIcon: !settings.showBackgroundIcon })
    },
    {
      label: 'Player bar position',
      submenu: [
        {
          label: 'Top',
          checked: settings.playerBarPosition === 'top',
          onSelect: () => update({ playerBarPosition: 'top' })
        },
        {
          label: 'Bottom',
          checked: settings.playerBarPosition === 'bottom',
          onSelect: () => update({ playerBarPosition: 'bottom' })
        }
      ]
    },
    {
      label: 'Slider position',
      submenu: [
        {
          label: 'Above',
          checked: settings.playerBarSliderPosition === 'above',
          onSelect: () => update({ playerBarSliderPosition: 'above' })
        },
        {
          label: 'Below',
          checked: settings.playerBarSliderPosition === 'below',
          onSelect: () => update({ playerBarSliderPosition: 'below' })
        }
      ]
    },
    {
      label: 'Player layout',
      submenu: [
        {
          label: 'Comfortable',
          checked: settings.playerBarLayout === 'comfortable',
          onSelect: () => update({ playerBarLayout: 'comfortable' })
        },
        {
          label: 'Compact',
          checked: settings.playerBarLayout === 'compact',
          onSelect: () => update({ playerBarLayout: 'compact' })
        }
      ]
    },
    {
      label: 'Player bar pills',
      submenu: [
        {
          label: 'Auto mix',
          checked: settings.showAutoMixPill,
          onSelect: () => update({ showAutoMixPill: !settings.showAutoMixPill })
        },
        {
          label: 'Sleep timer',
          checked: settings.showSleepTimerPill,
          onSelect: () => update({ showSleepTimerPill: !settings.showSleepTimerPill })
        }
      ]
    },
    {
      label: 'Fullscreen style',
      submenu: [
        {
          label: 'Maximal',
          checked: settings.fsPlayerStyle === 'maximal',
          onSelect: () => update({ fsPlayerStyle: 'maximal' })
        },
        {
          label: 'Minimal',
          checked: settings.fsPlayerStyle === 'minimal',
          onSelect: () => update({ fsPlayerStyle: 'minimal' })
        }
      ]
    }
  ];

  const playback_menu: ContextMenuItem[] = [
    {
      label: 'Auto play',
      submenu: AUTO_PLAY_LEVELS.map((level) => ({
        label: AUTO_PLAY_LABELS[level],
        checked: settings.autoPlayLevel === level,
        onSelect: () => update({ autoPlayLevel: level })
      }))
    },
    {
      label: 'Auto mix',
      checked: autoMixEnabled,
      onSelect: toggleAutoMix
    },
    {
      label: 'Equalizer',
      checked: settings.eqEnabled,
      onSelect: () => update({ eqEnabled: !settings.eqEnabled })
    }
  ];

  const accessibility_menu: ContextMenuItem[] = [
    {
      label: 'Reduced motion',
      checked: settings.reducedMotion,
      onSelect: () => update({ reducedMotion: !settings.reducedMotion })
    },
    {
      label: 'Announce song changes',
      checked: settings.announceTrackChanges,
      onSelect: () => update({ announceTrackChanges: !settings.announceTrackChanges })
    }
  ];

  const scan_for_new_files = async () => {
    if (scanning !== null) return;
    for (const folder of folders) await scanNewFiles(folder.id);
  };

  const rescan_library = async () => {
    if (scanning !== null) return;
    for (const folder of folders) await rescanFolder(folder.id);
  };

  const library_menu: ContextMenuItem[] = [
    {
      label: 'Scan for new files',
      onSelect: () => void scan_for_new_files()
    },
    {
      label: 'Rescan',
      onSelect: () => void rescan_library()
    }
  ];

  return (
    <nav className={`xe_nav${collapsed ? ' xe_nav--collapsed' : ''}`} style={{ width }}>
      <Link to="/i" className="xe_nav__logo" title="About Xebrine" draggable={false}>
        <LogoIcon size={22} />
        {!collapsed && <span>Xebrine</span>}
      </Link>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) =>
            `xe_nav__link${isActive ? ' xe_nav__link--active' : ''}${page_key_cursor_path === link.path ? ' xe_nav__link--cursor' : ''}`
          }
          title={
            link.path === '/remote' && hasRemoteStatus
              ? remoteWaiting > 0
                ? `${remoteWaiting} device${remoteWaiting === 1 ? '' : 's'} waiting for approval`
                : `Remote session running (${remote.controllers.length} connected)`
              : collapsed
                ? link.label
                : undefined
          }
          draggable={false}
          onContextMenu={(event) => {
            if (link.path === '/remote') {
              event.preventDefault();
              setRemoteMenu({ x: event.clientX, y: event.clientY });
              return;
            }
            if (link.path !== '/settings') return;
            event.preventDefault();
            setSettingsMenu({ x: event.clientX, y: event.clientY });
          }}
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
            hasRemoteStatus &&
            (collapsed ? (
              <span className="xe_nav__dot" />
            ) : (
              <span className="xe_nav__badge">
                {remoteWaiting > 0 ? remoteWaiting : remote.controllers.length || '!'}
              </span>
            ))}
        </NavLink>
      ))}
      {(current || radio_station) && (
        <div className="xe_nav__fullscreen-slot">
          <button
            type="button"
            className="xe_nav__link xe_nav__fullscreen"
            onClick={onOpenFullscreen}
            onContextMenu={(event) => {
              event.preventDefault();
              set_fullscreen_menu({ x: event.clientX, y: event.clientY });
            }}
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
      {settingsMenu && (
        <ContextMenu
          x={settingsMenu.x}
          y={settingsMenu.y}
          items={SETTINGS_SECTIONS.map((section) => ({
            label: section.label,
            onSelect: () => navigate(`/settings/${section.id}`),
            submenu:
              section.id === 'preferences'
                ? main_preferences_menu
                : section.id === 'appearance'
                  ? appearance_menu
                  : section.id === 'library'
                    ? library_menu
                  : section.id === 'playback'
                    ? playback_menu
                    : section.id === 'a11y'
                      ? accessibility_menu
                      : undefined
          }))}
          onClose={() => setSettingsMenu(null)}
        />
      )}
      {remoteMenu && (
        <ContextMenu
          x={remoteMenu.x}
          y={remoteMenu.y}
          items={[
            { label: 'Host', onSelect: () => navigate('/remote?role=host') },
            { label: 'Control', onSelect: () => navigate('/remote?role=control') }
          ]}
          onClose={() => setRemoteMenu(null)}
        />
      )}
      {fullscreen_menu && (
        <ContextMenu
          x={fullscreen_menu.x}
          y={fullscreen_menu.y}
          items={[
            {
              heading: 'Change fullscreen mode...',
              label: 'Change to maximal player',
              onSelect: () => {
                update({ fsPlayerStyle: 'maximal' });
                onOpenFullscreen?.();
              }
            },
            {
              label: 'Change to minimal player',
              onSelect: () => {
                update({ fsPlayerStyle: 'minimal' });
                onOpenFullscreen?.();
              }
            }
          ]}
          onClose={() => set_fullscreen_menu(null)}
        />
      )}
    </nav>
  );
}
