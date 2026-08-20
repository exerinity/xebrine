import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { groupAlbums, albumKey } from '../utils/groups';
import { useAlbumArt } from '../hooks/album_art';
import { useTrackMenu } from '../hooks/track_menu';
import { toSlugParam } from '../utils/slug';
import { AlbumCard } from './albums';
import { ContextMenu } from '../components/context_menu';
import {
  FolderIcon,
  KeyIcon,
  LogoIcon,
  NoteIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  ShuffleIcon
} from '../components/icons';
import type { TrackMeta } from '../types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function pickRandom(tracks: TrackMeta[], excludeId?: string): TrackMeta | null {
  if (tracks.length === 0) return null;
  if (tracks.length === 1 || !excludeId) {
    return tracks[Math.floor(Math.random() * tracks.length)];
  }
  let pick: TrackMeta;
  do {
    pick = tracks[Math.floor(Math.random() * tracks.length)];
  } while (pick.id === excludeId);
  return pick;
}

function RandomSongCard({ track, onAnother }: { track: TrackMeta; onAnother(): void }) {
  const { playNow, enqueueEnd, remoteLocked } = usePlayer();
  const { buildMenu } = useTrackMenu();
  const art = useAlbumArt(albumKey(track), track);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className="xe_home-song-card"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="xe_home-song-card__art">
        {art ? <img src={art} alt="" loading="lazy" /> : <LogoIcon size={30} />}
      </div>
      <div className="xe_home-song-card__info">
        <span className="xe_home-song-card__title">{track.title}</span>
        <span className="xe_home-song-card__artist">{track.artist}</span>
      </div>
      <div className="xe_home-song-card__actions">
        <button type="button" className="xe_btn xe_btn--accent" onClick={() => playNow([track], 0)} disabled={remoteLocked}>
          <PlayIcon size={14} />
          Play
        </button>
        <button type="button" className="xe_btn" onClick={() => enqueueEnd([track])} disabled={remoteLocked}>
          <PlusIcon size={14} />
          Enqueue
        </button>
        <button type="button" className="xe_btn xe_btn--quiet" onClick={onAnother}>
          <RefreshIcon size={14} />
          Pick another
        </button>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(track)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

export function HomePage() {
  const { tracks, permissionNeeded, supported, addFolder, restoreAccess } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const navigate = useNavigate();
  const needsSetup = !localStorage.getItem('hai');

  const [randomTrack, setRandomTrack] = useState<TrackMeta | null>(null);
  useEffect(() => {
    setRandomTrack(pickRandom(tracks));
  }, [tracks.length]);

  const [albumSeed, setAlbumSeed] = useState(0);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const randomAlbums = useMemo(
    () => intelligentShuffle(albums, (a) => ({ id: a.key, artist: a.artist })).slice(0, 9),
    [albums.length, albumSeed]
  );

  const shuffleAll = () => {
    const order = intelligentShuffle(tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds());
    playNow(order, 0);
  };

  if (!supported) {
    return (
      <div className="xe_page">
        <h1 className="xe_page__title">Not Supported</h1>
        <p className="xe_empty-note">
          The browser you're using doesn't seem to support (or you have denied access to)
          the File System Access API, which is required for Xebrine to read your music files. Please
          try again using a different browser that supports it. In the meantime, <a href="https://voxity.dev" target="_blank">try Voxity</a>?
        </p>
      </div>
    );
  }

  return (
    <div className="xe_page">
      <div className="xe_home-greeting">
        <h1 className="xe_page__title">{getGreeting()}</h1>
      </div>

      {needsSetup && (
        <div className="xe_banner xe_home-setup-banner">
          <span>Welcome to Xebrine! Would you like to go through a setup flow?</span>
          <button
            type="button"
            className="xe_btn xe_btn--accent"
            onClick={() => navigate('/i/flow/setup')}
          >
            Start setup
          </button>
        </div>
      )}

      {permissionNeeded && (
        <div className="xe_banner">
          <span>Xebrine needs permission to read your music folders again.</span>
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void restoreAccess()}>
            <KeyIcon size={14} />
            Restore access
          </button>
        </div>
      )}

      <div className="xe_page__scroll">
        <div className="xe_home-ctas">
          <button
            type="button"
            className="xe_btn xe_btn--cta"
            onClick={shuffleAll}
            disabled={tracks.length === 0 || remoteLocked}
          >
            <ShuffleIcon size={16} />
            Shuffle all music
          </button>
          <button
            type="button"
            className="xe_btn xe_btn--cta"
            onClick={() => playNow(tracks, 0)}
            disabled={tracks.length === 0 || remoteLocked}
          >
            <PlayIcon size={16} />
            Play all music
          </button>
          <button type="button" className="xe_btn xe_btn--cta" onClick={() => void addFolder()}>
            <FolderIcon size={16} />
            Add folder
          </button>
          <button type="button" className="xe_btn xe_btn--cta" onClick={() => navigate('/library')}>
            <NoteIcon size={16} />
            Go to library
          </button>
        </div>

        {tracks.length === 0 ? (
          <p className="xe_empty-note">Your library is empty!</p>
        ) : (
          <>
            <section className="xe_home-section">
              <div className="xe_home-section__header">
                <h2 className="xe_home-section__title">Pick some random albums</h2>
                <button
                  type="button"
                  className="xe_btn xe_btn--quiet"
                  onClick={() => setAlbumSeed((seed) => seed + 1)}
                  disabled={albums.length <= 1}
                >
                  <RefreshIcon size={14} />
                  Reshuffle
                </button>
              </div>
              <div className="xe_home-carousel">
                {randomAlbums.map((album) => (
                  <div className="xe_home-carousel__item" key={album.key}>
                    <AlbumCard
                      album={album}
                      onOpen={() =>
                        navigate(`/albums/${toSlugParam(album.album)}`, {
                          state: { from: '/' }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {randomTrack && (
              <section className="xe_home-section">
                <h2 className="xe_home-section__title">...or a random song</h2>
                <RandomSongCard
                  track={randomTrack}
                  onAnother={() => setRandomTrack((prev) => pickRandom(tracks, prev?.id))}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
