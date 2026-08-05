import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { groupAlbums, type AlbumGroup } from '../utils/groups';
import { openSearch, searchLabel } from '../utils/search_engine';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { useAlbumArt } from '../hooks/album_art';
import { LogoIcon, PlayIcon, PlusIcon, SearchIcon, ShuffleIcon } from '../components/icons';
import { ContextMenu, type ContextMenuItem } from '../components/context_menu';
import { SortSelect, type SortOption } from '../components/sort_select';
import { toSlugParam } from '../utils/slug';
import { useScrollRestoration } from '../hooks/scroll_restoration';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';

type AlbumSort = 'artist' | 'title' | 'title-desc' | 'tracks';

const SORT_OPTIONS: SortOption<AlbumSort>[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'tracks', label: 'Tracks' }
];

const SORT_KEY = 'xebrine.albumsSort';

function loadSort(): AlbumSort {
  const raw = localStorage.getItem(SORT_KEY);
  return SORT_OPTIONS.some((o) => o.value === raw) ? (raw as AlbumSort) : 'artist';
}

export function AlbumCard({ album, onOpen }: { album: AlbumGroup; onOpen(): void }) {
  const { playNow, enqueueEnd } = usePlayer();
  const { settings } = useSettings();
  const art = useAlbumArt(album.key, album.tracks[0]);
  const navigate = useNavigate();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const menuItems: ContextMenuItem[] = [
    {
      label: 'Open album artist',
      heading: 'Navigation...',
      onSelect: () => navigate(`/artists/${toSlugParam(album.artist)}`)
    },
    {
      label: searchLabel(settings.searchEngine, settings.customSearchUrl),
      onSelect: () =>
        openSearch(
          `${album.album} by ${album.artist}`,
          settings.searchEngine,
          settings.customSearchUrl
        )
    },
    {
      label: 'Enqueue this album',
      heading: 'Queue...',
      onSelect: () => enqueueEnd(album.tracks)
    },
    { label: 'Play this album now', onSelect: () => playNow(album.tracks, 0) },
    {
      label: 'Shuffle this album',
      onSelect: () =>
        playNow(
          intelligentShuffle(album.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
          0
        )
    }
  ];

  return (
    <div
      className="xe_album-card"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="xe_album-card__art">
        {art ? <img src={art} alt="" loading="lazy" /> : <LogoIcon size={36} />}
        <div className="xe_album-card__actions">
          <button
            type="button"
            className="xe_album-card__action"
            title="Shuffle album"
            onClick={(e) => {
              e.stopPropagation();
              playNow(
                intelligentShuffle(album.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
                0
              );
            }}
          >
            <ShuffleIcon size={14} />
          </button>
          <button
            type="button"
            className="xe_album-card__action"
            title="Enqueue"
            onClick={(e) => {
              e.stopPropagation();
              enqueueEnd(album.tracks);
            }}
          >
            <PlusIcon size={14} />
          </button>
          <button
            type="button"
            className="xe_album-card__play"
            title="Play album"
            onClick={(e) => {
              e.stopPropagation();
              playNow(album.tracks, 0);
            }}
          >
            <PlayIcon size={18} />
          </button>
        </div>
      </div>
      <span className="xe_album-card__title">{album.album}</span>
      <span className="xe_album-card__artist">
        by{' '}
        <button
          type="button"
          className="xe_album-card__artist-link"
          title={`Go to ${album.artist}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/artists/${toSlugParam(album.artist)}`);
          }}
        >
          {album.artist}
        </button>
      </span>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

export function AlbumsPage() {
  const { tracks } = useLibrary();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AlbumSort>(loadSort);
  const scrollRef = useScrollRestoration<HTMLDivElement>();
  usePageTitle('Albums');

  const changeSort = (value: AlbumSort) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      null;
    }
  };

  const albums = useMemo(() => groupAlbums(tracks), [tracks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? albums.filter((a) => a.album.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
      : albums;
    const copy = [...filtered];
    switch (sort) {
      case 'artist':
        copy.sort(
          (a, b) =>
            a.artist.localeCompare(b.artist) ||
            (a.year ?? 0) - (b.year ?? 0) ||
            a.album.localeCompare(b.album)
        );
        break;
      case 'title':
        copy.sort((a, b) => a.album.localeCompare(b.album));
        break;
      case 'title-desc':
        copy.sort((a, b) => b.album.localeCompare(a.album));
        break;
      case 'tracks':
        copy.sort((a, b) => b.tracks.length - a.tracks.length || a.album.localeCompare(b.album));
        break;
    }
    return copy;
  }, [albums, query, sort]);

  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(visible);

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Albums</h1>
        <div className="xe_search-field">
          <SearchIcon size={14} />
          <input
            className="xe_search-input"
            type="search"
            placeholder="Search albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SortSelect value={sort} onChange={changeSort} options={SORT_OPTIONS} />
        <span className="xe_page__meta">{albums.length} albums</span>
      </div>
      {visible.length === 0 ? (
        <p className="xe_empty-note">
          {tracks.length === 0 ? 'Your library is empty!' : 'No albums match...'}
        </p>
      ) : (
        <div className="xe_page__scroll" ref={scrollRef}>
          <div className="xe_album-grid">
            {paged.map((a) => (
              <AlbumCard
                key={a.key}
                album={a}
                onOpen={() =>
                  navigate(`/artists/${toSlugParam(a.artist)}/${toSlugParam(a.album)}`, {
                    state: { from: '/albums' }
                  })
                }
              />
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
