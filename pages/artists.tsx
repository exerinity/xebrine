import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { groupArtists, type ArtistGroup } from '../utils/groups';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { toSlugParam } from '../utils/slug';
import { toast } from '../utils/toast';
import { SortSelect, type SortOption } from '../components/sort_select';
import { ContextMenu, type ContextMenuItem } from '../components/context_menu';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { SearchIcon } from '../components/icons';

type ArtistSort = 'name' | 'name-desc' | 'albums' | 'tracks';

const SORT_OPTIONS: SortOption<ArtistSort>[] = [
  { value: 'name', label: 'Name (A - Z)' },
  { value: 'name-desc', label: 'Name (Z - A)' },
  { value: 'albums', label: 'Albums' },
  { value: 'tracks', label: 'Tracks' }
];

const SORT_KEY = 'xebrine.artistsSort';

function loadSort(): ArtistSort {
  const raw = localStorage.getItem(SORT_KEY);
  return SORT_OPTIONS.some((o) => o.value === raw) ? (raw as ArtistSort) : 'name';
}

export function ArtistsPage() {
  const { tracks } = useLibrary();
  const { playNow, enqueueEnd } = usePlayer();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ArtistSort>(loadSort);
  const [menu, setMenu] = useState<{ x: number; y: number; artist: ArtistGroup } | null>(null);
  usePageTitle('Artists');

  const copyName = (name: string) => {
    navigator.clipboard
      .writeText(name)
      .then(() => toast.success('Copied the artist name'))
      .catch(() => toast.error("Couldn't copy the artist name"));
  };

  const menuItems = (artist: ArtistGroup): ContextMenuItem[] => [
    {
      label: 'Open this artist',
      heading: 'Navigation...',
      onSelect: () => navigate(`/artists/${toSlugParam(artist.name)}`)
    },
    {
      label: 'Play all music',
      heading: 'Queue...',
      onSelect: () => playNow(artist.tracks, 0)
    },
    {
      label: 'Shuffle all music',
      onSelect: () =>
        playNow(
          intelligentShuffle(artist.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
          0
        )
    },
    { label: 'Enqueue all music', onSelect: () => enqueueEnd(artist.tracks) },
    {
      label: 'Google this artist',
      separatorBefore: true,
      onSelect: () =>
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(artist.name)}`,
          '_blank',
          'noopener,noreferrer'
        )
    },
    { label: 'Copy name', onSelect: () => copyName(artist.name) }
  ];

  const changeSort = (value: ArtistSort) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      null;
    }
  };

  const artists = useMemo(() => groupArtists(tracks), [tracks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? artists.filter((a) => a.name.toLowerCase().includes(q)) : artists;
    const copy = [...filtered];
    switch (sort) {
      case 'name':
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        copy.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'albums':
        copy.sort((a, b) => b.albumCount - a.albumCount || a.name.localeCompare(b.name));
        break;
      case 'tracks':
        copy.sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name));
        break;
    }
    return copy;
  }, [artists, query, sort]);

  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(visible);

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Artists</h1>
        <div className="xe_search-field">
          <SearchIcon size={14} />
          <input
            className="xe_search-input"
            type="search"
            placeholder="Search artists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SortSelect value={sort} onChange={changeSort} options={SORT_OPTIONS} />
        <span className="xe_page__meta">{artists.length} artists</span>
      </div>
      {visible.length === 0 ? (
        <p className="xe_empty-note">
          {tracks.length === 0 ? 'Your library is empty!' : 'No artists match...'}
        </p>
      ) : (
        <div className="xe_page__scroll">
          {paged.map((a) => (
            <button
              key={a.name}
              type="button"
              className="xe_artist-row"
              onClick={() => navigate(`/artists/${toSlugParam(a.name)}`)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, artist: a });
              }}
            >
              <span className="xe_artist-row__name">{a.name}</span>
              <span className="xe_artist-row__meta">
                {a.albumCount} album{a.albumCount === 1 ? '' : 's'} / {a.tracks.length} track
                {a.tracks.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
        </div>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.artist)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
