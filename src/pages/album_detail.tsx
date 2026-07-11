import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { groupAlbums } from '../utils/groups';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { useAlbumArt } from '../hooks/album_art';
import { TrackList } from '../components/track_list';
import { BackIcon, NoteIcon, PlayIcon, ShuffleIcon } from '../components/icons';
import { formatTime } from '../utils/format';
import { CoverModal } from '../components/cover_modal';
import { slugify, toSlugParam } from '../utils/slug';
import { usePageTitle } from '../hooks/page_title';
import { toast } from '../utils/toast';

export function AlbumDetailPage() {
  const { artistName = '', albumName = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tracks } = useLibrary();
  const { playNow } = usePlayer();
  const [coverOpen, setCoverOpen] = useState(false);

  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const album = useMemo(
    () =>
      albums.find(
        (a) =>
          slugify(a.artist) === artistName.toLowerCase() && slugify(a.album) === albumName.toLowerCase()
      ),
    [albums, artistName, albumName]
  );

  usePageTitle(album ? [album.album, 'Albums'] : 'Albums');

  const art = useAlbumArt(album?.key ?? '', album?.tracks[0]);
  const cameFrom = (location.state as { from?: string } | null)?.from;
  const backTarget = cameFrom ?? `/artists/${toSlugParam(album?.artist ?? artistName)}`;
  const backLabel = cameFrom === '/albums' ? 'Albums' : album?.artist || artistName || 'Back';

  if (!album) {
    return (
      <div className="xe_page">
        <div className="xe_page__toolbar">
          <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate(backTarget)}>
            <BackIcon size={16} />
            {backLabel}
          </button>
        </div>
        <p className="xe_empty-note">No results for that album</p>
      </div>
    );
  }

  const copyTitle = () => {
    navigator.clipboard
      .writeText(album.album)
      .then(() => toast.success('Copied the album title'))
      .catch(() => toast.error("Couldn't copy the album title"));
  };

  const total = album.tracks.reduce((sum, t) => sum + t.duration, 0);
  const shuffle = () =>
    playNow(
      intelligentShuffle(album.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
      0
    );

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate(backTarget)}>
          <BackIcon size={16} />
          {backLabel}
        </button>
      </div>
      <div className="xe_album-hero">
        <button
          type="button"
          className="xe_album-hero__art"
          onClick={() => art && setCoverOpen(true)}
          disabled={!art}
          title={art ? 'Enlarge cover' : undefined}
        >
          {art ? <img src={art} alt="" /> : <NoteIcon size={48} />}
        </button>
        <div className="xe_album-hero__info">
          <h1 className="xe_album-hero__title">
            <button type="button" className="xe_album-hero__title-btn" title="Copy album title" onClick={copyTitle}>
              {album.album}
            </button>
          </h1>
          <p className="xe_album-hero__meta">
            by <strong>{album.artist}</strong>
            {album.year ? ` / released ${album.year}` : ''} / {album.tracks.length} track
            {album.tracks.length === 1 ? '' : 's'} / {formatTime(total)} total
          </p>
          <div className="xe_album-hero__actions">
            <button type="button" className="xe_btn xe_btn--accent" onClick={() => playNow(album.tracks, 0)}>
              <PlayIcon size={14} />
              Play
            </button>
            <button type="button" className="xe_btn" onClick={shuffle}>
              <ShuffleIcon size={14} />
              Shuffle
            </button>
          </div>
        </div>
      </div>
      <div className="xe_page__scroll">
        <TrackList tracks={album.tracks} />
      </div>
      {coverOpen && art && (
        <CoverModal src={art} alt={`${album.album} cover`} onClose={() => setCoverOpen(false)} />
      )}
    </div>
  );
}
