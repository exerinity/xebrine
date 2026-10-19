import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../src/context/player';
import { resolve_playlists } from '../utils/playlists';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { PlaylistCover } from '../components/playlist_cover';
import { TrackList } from '../components/track_list';
import { BackIcon, PlayIcon, ShuffleIcon } from '../components/icons';
import { formatTime } from '../utils/format';
import { usePageTitle } from '../hooks/page_title';
import { toast } from '../utils/toast';
import { slugify } from '../utils/slug';

export function PlaylistDetailPage() {
  const { playlistName = '' } = useParams();
  const navigate = useNavigate();
  const { playlists, tracks } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const playlist = useMemo(
    () => resolve_playlists(playlists, tracks).find((item) => slugify(item.name) === playlistName.toLowerCase()),
    [playlists, tracks, playlistName]
  );
  usePageTitle(playlist ? [playlist.name, 'Playlists'] : 'Playlists');

  if (!playlist) {
    return (
      <div className="xe_page">
        <div className="xe_page__toolbar">
          <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate('/playlists')}>
            <BackIcon size={16} />
            Playlists
          </button>
        </div>
        <p className="xe_empty-note">No results for that playlist</p>
      </div>
    );
  }

  const total = playlist.tracks.reduce((sum, track) => sum + track.duration, 0);
  const source = { type: 'playlist' as const, name: playlist.name };
  const shuffle = () =>
    playNow(
      intelligentShuffle(playlist.tracks, (track) => ({ id: track.id, artist: track.artist }), getRecentIds()),
      0,
      source
    );
  const copy_title = () => {
    navigator.clipboard
      .writeText(playlist.name)
      .then(() => toast.success('Copied the playlist title'))
      .catch(() => toast.error("Couldn't copy the playlist title"));
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate('/playlists')}>
          <BackIcon size={16} />
          Playlists
        </button>
      </div>
      <div className="xe_album-hero">
        <div className="xe_album-hero__art xe_playlist-hero__art">
          <PlaylistCover playlist_id={playlist.id} tracks={playlist.tracks} icon_size={48} />
        </div>
        <div className="xe_album-hero__info">
          <h1 className="xe_album-hero__title">
            <button type="button" className="xe_album-hero__title-btn" title="Copy playlist title" onClick={copy_title}>
              {playlist.name}
            </button>
          </h1>
          <p className="xe_album-hero__meta">
            {playlist.tracks.length} track{playlist.tracks.length === 1 ? '' : 's'} / {formatTime(total)} total
          </p>
          <div className="xe_album-hero__actions">
            <button
              type="button"
              className="xe_btn xe_btn--accent"
              onClick={() => playNow(playlist.tracks, 0, source)}
              disabled={remoteLocked || playlist.tracks.length === 0}
            >
              <PlayIcon size={14} />
              Play
            </button>
            {playlist.tracks.length > 1 && (
              <button type="button" className="xe_btn" onClick={shuffle} disabled={remoteLocked}>
                <ShuffleIcon size={14} />
                Shuffle
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="xe_page__scroll">
        {playlist.tracks.length > 0
          ? <TrackList tracks={playlist.tracks} source={source} />
          : <p className="xe_empty-note">There were no track matches for this playlist entry</p>}
      </div>
    </div>
  );
}
