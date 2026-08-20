import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './context/settings_context';
import { SetupFlowProvider } from './context/setup_flow_context';
import { LibraryProvider } from './context/library_context';
import { PlayerProvider, usePlayer } from './context/player_context';
import { RemoteProvider } from './context/remote_context';
import { useSettings } from './context/settings_context';
import { useMediaSession } from './hooks/media_session';
import { useElectronBridge } from './hooks/electron_bridge';
import { isElectron } from './utils/electron';
import { useTrackNotifications } from './hooks/track_notifications';
import { useSpeechAnnouncements } from './hooks/speech_announcements';
import { useQueueFinishedSound } from './hooks/queue_finished_sound';
import { useScrobbler } from './hooks/scrobbler';
import { useAccentColor } from './hooks/accent_color';
import { useKeyboardShortcuts } from './hooks/keyboard_shortcuts';
import { usePageKeys } from './hooks/page_keys';
import { HomePage } from './pages/home';
import { LibraryPage } from './pages/library';
import { SearchPage } from './pages/search';
import { ArtistsPage } from './pages/artists';
import { ArtistDetailPage } from './pages/artist_detail';
import { AlbumsPage } from './pages/albums';
import { AlbumDetailPage } from './pages/album_detail';
import { QueuePage } from './pages/queue';
import { LyricsPage } from './pages/lyrics';
import { ShareLyricsPage } from './pages/share_lyrics';
import { SettingsPage } from './pages/settings';
import { AboutPage } from './pages/about';
import { ReleaseNotesPage } from './pages/release_notes';
import { LastfmPage } from './pages/lastfm';
import { RemotePage } from './pages/remote';
import { SetupFlowPage } from './pages/setup_flow';
import { Sidebar } from './components/sidebar';
import { PlayerBar } from './components/player_bar';
import { FullscreenPlayer } from './components/fs_player';
import { ToastContainer } from './components/toast_container';
import { UpdateModal } from './components/update_modal';
import { SetupLeaveModal } from './components/setup_leave_modal';

function MediaBridge() {
  useMediaSession();
  useElectronBridge();
  useTrackNotifications();
  useSpeechAnnouncements();
  useQueueFinishedSound();
  useScrobbler();
  return null;
}

function KeyboardShortcuts({ toggleFullscreen }: { toggleFullscreen: () => void }) {
  useKeyboardShortcuts({ toggleFullscreen });
  return null;
}

function Shell() {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const { current, artworkUrl } = usePlayer();
  const { settings } = useSettings();
  const accent = useAccentColor(artworkUrl);
  usePageKeys(settings.pageKeyMode);
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
    document.documentElement.classList.toggle('xe_reduced-motion', settings.reducedMotion);
  }, [settings.reducedMotion]);

  useEffect(() => {
    if (settings.theme === 'default') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme]);

  useEffect(() => {
    if (!current) setFullscreenOpen(false);
  }, [current]);
  useEffect(() => {
    if (!fullscreenOpen || !current) return;
    const previous = document.title;
    const { title, artist } = current.track;
    document.title = isElectron ? `${title} by ${artist}` : `${title} by ${artist} / Xebrine`;
    return () => {
      document.title = previous;
    };
  }, [fullscreenOpen, current]);

  return (
    <div
      className={`xe_app${settings.playerBarPosition === 'top' ? ' xe_app--player-top' : ''}${
        settings.playerBarLayout === 'compact' ? ' xe_app--player-compact' : ''
      }`}
      style={accentStyle}
    >
      <Sidebar onOpenFullscreen={() => setFullscreenOpen(true)} />
      <main className="xe_main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/artists" element={<ArtistsPage />} />
          <Route path="/artists/:artistName" element={<ArtistDetailPage />} />
          <Route path="/albums/:albumName" element={<AlbumDetailPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/lyrics" element={<LyricsPage />} />
          <Route path="/lyrics/share" element={<ShareLyricsPage />} />
          <Route path="/settings" element={<Navigate to="/settings/preferences" replace />} />
          <Route path="/settings/scrobbling" element={<Navigate to="/lastfm" replace />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/i" element={<Navigate to="/i/info" replace />} />
          <Route path="/i/flow/setup" element={<SetupFlowPage />} />
          <Route path="/i/:section" element={<AboutPage />} />
          <Route path="/i/release_notes" element={<ReleaseNotesPage />} />
          <Route path="/lastfm" element={<LastfmPage />} />
          <Route path="/remote" element={<RemotePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <FullscreenPlayer open={fullscreenOpen} onClose={() => setFullscreenOpen(false)} />
      <PlayerBar
        fullscreenOpen={fullscreenOpen && Boolean(current)}
        onToggleFullscreen={() => setFullscreenOpen((open) => !open)}
      />
      <MediaBridge />
      <KeyboardShortcuts
        toggleFullscreen={() => {
          if (current) setFullscreenOpen((open) => !open);
        }}
      />
      <ToastContainer />
      <UpdateModal />
    </div>
  );
}

export default function App() {
  return (
    <SetupFlowProvider>
      <SettingsProvider>
        <LibraryProvider>
          <PlayerProvider>
            <RemoteProvider>
              <Shell />
            </RemoteProvider>
          </PlayerProvider>
        </LibraryProvider>
      </SettingsProvider>
      <SetupLeaveModal />
    </SetupFlowProvider>
  );
}
