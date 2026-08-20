import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { groupArtists, groupAlbums, type AlbumGroup } from '../utils/groups';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { BackIcon, GridIcon, ListIcon, LogoIcon, PlayIcon, ShuffleIcon } from '../components/icons';
import { slugify, toSlugParam } from '../utils/slug';
import { useAlbumArt } from '../hooks/album_art';
import { useScrollRestoration } from '../hooks/scroll_restoration';
import { usePageTitle } from '../hooks/page_title';
import { SortSelect, type SortDirection, type SortOption } from '../components/sort_select';
import { AlbumCard } from './albums';

type AlbumsView = 'list' | 'grid';
const VIEW_KEY = 'xebrine.artistAlbumsView';

function loadView(): AlbumsView {
  return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
}

type AlbumsSort = 'year' | 'title' | 'tracks';

const SORT_OPTIONS: SortOption<AlbumsSort>[] = [
  { value: 'year', label: 'Year' },
  { value: 'title', label: 'Title' },
  { value: 'tracks', label: 'Tracks' }
];

const SORT_KEY = 'xebrine.artistAlbumsSort';

function loadSort(): { sort: AlbumsSort; direction: SortDirection } {
  const raw = localStorage.getItem(SORT_KEY);
  if (raw === 'title-desc') {
    try {
      localStorage.setItem(SORT_KEY, 'title');
      localStorage.setItem(`${SORT_KEY}.direction`, 'desc');
    } catch {
      null;
    }
    return { sort: 'title', direction: 'desc' };
  }
  return {
    sort: SORT_OPTIONS.some((o) => o.value === raw) ? (raw as AlbumsSort) : 'year',
    direction:
      localStorage.getItem(`${SORT_KEY}.direction`) === 'desc' || raw === 'tracks' ? 'desc' : 'asc'
  };
}

function AlbumSection({ album, onOpen }: { album: AlbumGroup; onOpen(): void }) {
  const art = useAlbumArt(album.key, album.tracks[0]);
  return (
    <section className="xe_album-section">
      <div className="xe_album-section__head">
        <button
          type="button"
          className="xe_album-section__cover"
          onClick={onOpen}
          title={`Open ${album.album}`}
        >
          {art ? <img src={art} alt="" loading="lazy" /> : <LogoIcon size={30} />}
        </button>
        <div className="xe_album-section__heading">
          <button type="button" className="xe_album-section__link" onClick={onOpen}>
            {album.album}
          </button>
          <span className="xe_album-section__meta">
            {album.year ? `${album.year} / ` : ''}
            {album.tracks.length} song{album.tracks.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <TrackList tracks={album.tracks} />
    </section>
  );
}

export function ArtistDetailPage() {
  const { artistName = '' } = useParams();
  const navigate = useNavigate();
  const { tracks } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const scrollRef = useScrollRestoration();
  const [view, setView] = useState<AlbumsView>(loadView);
  const [{ sort, direction }, setSortState] = useState(loadSort);

  const changeView = (value: AlbumsView) => {
    setView(value);
    try {
      localStorage.setItem(VIEW_KEY, value);
    } catch {
      null;
    }
  };

  const changeSort = (value: AlbumsSort) => {
    setSortState((current) => ({ ...current, sort: value }));
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      null;
    }
  };

  const changeDirection = (value: SortDirection) => {
    setSortState((current) => ({ ...current, direction: value }));
    try {
      localStorage.setItem(`${SORT_KEY}.direction`, value);
    } catch {
      null;
    }
  };

  const artists = useMemo(() => groupArtists(tracks), [tracks]);
  const artist = useMemo(
    () => artists.find((a) => slugify(a.name) === artistName.toLowerCase()),
    [artists, artistName]
  );
  usePageTitle(artist ? [artist.name, 'Artists'] : 'Artists');

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

  const albums = groupAlbums(artist.tracks).sort((a, b) => {
    const factor = direction === 'asc' ? 1 : -1;
    switch (sort) {
      case 'title':
        return factor * a.album.localeCompare(b.album);
      case 'tracks':
        return factor * (a.tracks.length - b.tracks.length || a.album.localeCompare(b.album));
      default:
        return factor * ((a.year ?? 0) - (b.year ?? 0) || a.album.localeCompare(b.album));
    }
  });
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
        <button type="button" className="xe_btn" onClick={() => playNow(artist.tracks, 0)} disabled={remoteLocked}>
          <PlayIcon size={14} />
          Play all
        </button>
        <button type="button" className="xe_btn" onClick={shuffle} disabled={remoteLocked}>
          <ShuffleIcon size={14} />
          Shuffle
        </button>
        <SortSelect
          value={sort}
          onChange={changeSort}
          options={SORT_OPTIONS}
          direction={direction}
          onDirectionChange={changeDirection}
        />
        <div className="xe_view-toggle">
          <button
            type="button"
            className={`xe_icon-btn${view === 'list' ? ' xe_icon-btn--active' : ''}`}
            title="List view"
            onClick={() => changeView('list')}
          >
            <ListIcon size={16} />
          </button>
          <button
            type="button"
            className={`xe_icon-btn${view === 'grid' ? ' xe_icon-btn--active' : ''}`}
            title="Grid view"
            onClick={() => changeView('grid')}
          >
            <GridIcon size={16} />
          </button>
        </div>
      </div>
      <div className="xe_page__scroll" ref={scrollRef}>
        {view === 'list' ? (
          albums.map((album) => (
            <AlbumSection
              key={album.key}
              album={album}
              onOpen={() =>
                navigate(`/albums/${toSlugParam(album.album)}`, {
                  state: { from: `/artists/${toSlugParam(artist.name)}` }
                })
              }
            />
          ))
        ) : (
          <div className="xe_album-grid">
            {albums.map((album) => (
              <AlbumCard
                key={album.key}
                album={album}
                onOpen={() =>
                  navigate(`/albums/${toSlugParam(album.album)}`, {
                    state: { from: `/artists/${toSlugParam(artist.name)}` }
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
