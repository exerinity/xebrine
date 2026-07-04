import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { groupArtists, groupAlbums } from '../utils/groups';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { BackIcon, PlayIcon, ShuffleIcon } from '../components/icons';
import { slugify, toSlugParam } from '../utils/slug';
import { useScrollRestoration } from '../hooks/scroll_restoration';

export function ArtistDetailPage() {
  const { artistName = '' } = useParams();
  const navigate = useNavigate();
  const { tracks } = useLibrary();
  const { playNow } = usePlayer();
  const scrollRef = useScrollRestoration<HTMLDivElement>();

  const artists = useMemo(() => groupArtists(tracks), [tracks]);
  const artist = useMemo(
    () => artists.find((a) => slugify(a.name) === artistName.toLowerCase()),
    [artists, artistName]
  );

  if (!artist) {
    return (
      <div className="xe_page">
        <div className="xe_page__toolbar">
          <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate('/artists')}>
            <BackIcon size={16} />
            Artists
          </button>
        </div>
        <p className="xe_empty-note">No results for that artist</p>
      </div>
    );
  }

  const albums = groupAlbums(artist.tracks);
  const shuffle = () =>
    playNow(
      intelligentShuffle(artist.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
      0
    );

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate('/artists')}>
          <BackIcon size={16} />
          Artists
        </button>
        <h1 className="xe_page__title">{artist.name}</h1>
        <span className="xe_page__meta">
          {artist.albumCount} album{artist.albumCount === 1 ? '' : 's'} / {artist.tracks.length}{' '}
          track{artist.tracks.length === 1 ? '' : 's'}
        </span>
        <button type="button" className="xe_btn" onClick={() => playNow(artist.tracks, 0)}>
          <PlayIcon size={14} />
          Play all
        </button>
        <button type="button" className="xe_btn" onClick={shuffle}>
          <ShuffleIcon size={14} />
          Shuffle
        </button>
      </div>
      <div className="xe_page__scroll" ref={scrollRef}>
        {albums.map((album) => (
          <section key={album.key} className="xe_album-section">
            <h2 className="xe_album-section__title">
              <button
                type="button"
                className="xe_album-section__link"
                onClick={() =>
                  navigate(`/artists/${toSlugParam(artist.name)}/${toSlugParam(album.album)}`, {
                    state: { from: `/artists/${toSlugParam(artist.name)}` }
                  })
                }
              >
                {album.album}
              </button>
              {album.year ? <span className="xe_album-section__year"> / {album.year}</span> : null}
            </h2>
            <TrackList tracks={album.tracks} />
          </section>
        ))}
      </div>
    </div>
  );
}
