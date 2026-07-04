import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './context/settings_context';
import { LibraryProvider } from './context/library_context';
import { PlayerProvider, usePlayer } from './context/player_context';
import { useMediaSession } from './hooks/media_session';
import { useTrackNotifications } from './hooks/track_notifications';
import { useAccentColor } from './hooks/accent_color';
import { LibraryPage } from './pages/library';
import { ArtistsPage } from './pages/artists';
import { ArtistDetailPage } from './pages/artist_detail';
import { AlbumsPage } from './pages/albums';
import { AlbumDetailPage } from './pages/album_detail';
import { QueuePage } from './pages/queue';
import { LyricsPage } from './pages/lyrics';
import { SettingsPage } from './pages/settings';
import { PlayerBar } from './components/player_bar';
import { FullscreenPlayer } from './components/fs_player';
import { ToastContainer } from './components/toast_container';
import {
  DiscIcon,
  HomeIcon,
  LogoIcon,
  LyricsIcon,
  PersonIcon,
  QueueIcon,
  SettingsIcon
} from './components/icons';

const NAV_LINKS = [
  { path: '/home', label: 'Library', icon: HomeIcon },
  { path: '/artists', label: 'Artists', icon: PersonIcon },
  { path: '/albums', label: 'Albums', icon: DiscIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
  { path: '/lyrics', label: 'Lyrics', icon: LyricsIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon }
];

function MediaBridge() {
  useMediaSession();
  useTrackNotifications();
  return null;
}

function SpaceToPlayPause() {
  const { togglePlay } = usePlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);
  return null;
}

function Shell() {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const { queue, current, artworkUrl } = usePlayer();
  const accent = useAccentColor(artworkUrl);
  const accentStyle = useMemo(
    () =>
      ({
        '--accent': accent.accent,
        '--accent-bright': accent.accentBright,
        '--accent-text': accent.accentText,
        '--accent-soft': accent.accentSoft,
        '--accent-glow': accent.accentGlow,
        '--accent-wash': accent.accentWash
      }) as CSSProperties,
    [accent]
  );

  useEffect(() => {
    if (!current) setFullscreenOpen(false);
  }, [current]);

  return (
    <div className="xe_app" style={accentStyle}>
      <nav className="xe_nav">
        <div className="xe_nav__logo">
          <LogoIcon size={22} />
          <span>Xebrine</span>
        </div>
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) => `xe_nav__link${isActive ? ' xe_nav__link--active' : ''}`}
          >
            <span className="xe_nav__link-content">
              <link.icon size={16} />
              {link.label}
            </span>
            {link.path === '/queue' && queue.length > 0 && (
              <span className="xe_nav__badge">{queue.length}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <main className="xe_main">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<LibraryPage />} />
          <Route path="/artists" element={<ArtistsPage />} />
          <Route path="/artists/:artistName" element={<ArtistDetailPage />} />
          <Route path="/artists/:artistName/:albumName" element={<AlbumDetailPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/lyrics" element={<LyricsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
      <FullscreenPlayer open={fullscreenOpen} onClose={() => setFullscreenOpen(false)} />
      <PlayerBar
        fullscreenOpen={fullscreenOpen && Boolean(current)}
        onToggleFullscreen={() => setFullscreenOpen((open) => !open)}
      />
      <MediaBridge />
      <SpaceToPlayPause />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <LibraryProvider>
        <PlayerProvider>
          <Shell />
        </PlayerProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
