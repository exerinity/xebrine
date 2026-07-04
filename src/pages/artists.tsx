import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { groupArtists } from '../utils/groups';
import { toSlugParam } from '../utils/slug';
import { SortSelect, type SortOption } from '../components/sort_select';

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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ArtistSort>(loadSort);

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

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Artists</h1>
        <input
          className="xe_search-input"
          type="search"
          placeholder="Search artists…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SortSelect value={sort} onChange={changeSort} options={SORT_OPTIONS} />
        <span className="xe_page__meta">{artists.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="xe_empty-note">
          {tracks.length === 0 ? 'Your library is empty!' : 'No artists match...'}
        </p>
      ) : (
        <div className="xe_page__scroll">
          {visible.map((a) => (
            <button
              key={a.name}
              type="button"
              className="xe_artist-row"
              onClick={() => navigate(`/artists/${toSlugParam(a.name)}`)}
            >
              <span className="xe_artist-row__name">{a.name}</span>
              <span className="xe_artist-row__meta">
                {a.albumCount} album{a.albumCount === 1 ? '' : 's'} / {a.tracks.length} track
                {a.tracks.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
