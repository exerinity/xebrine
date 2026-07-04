import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { groupAlbums, type AlbumGroup } from '../utils/groups';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { useAlbumArt } from '../hooks/album_art';
import { NoteIcon, PlayIcon, PlusIcon, ShuffleIcon } from '../components/icons';
import { SortSelect, type SortOption } from '../components/sort_select';
import { toSlugParam } from '../utils/slug';
import { useScrollRestoration } from '../hooks/scroll_restoration';

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

function AlbumCard({ album, onOpen }: { album: AlbumGroup; onOpen(): void }) {
  const { playNow, enqueueEnd } = usePlayer();
  const art = useAlbumArt(album.key, album.tracks[0]);

  return (
    <div className="xe_album-card" onClick={onOpen}>
      <div className="xe_album-card__art">
        {art ? <img src={art} alt="" loading="lazy" /> : <NoteIcon size={36} />}
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
            title="Add to queue"
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
        by {album.artist}
      </span>
    </div>
  );
}

export function AlbumsPage() {
  const { tracks } = useLibrary();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AlbumSort>(loadSort);
  const scrollRef = useScrollRestoration<HTMLDivElement>();

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

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Albums</h1>
        <input
          className="xe_search-input"
          type="search"
          placeholder="Search albums…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SortSelect value={sort} onChange={changeSort} options={SORT_OPTIONS} />
        <span className="xe_page__meta">{albums.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="xe_empty-note">
          {tracks.length === 0 ? 'Your library is empty!' : 'No albums match...'}
        </p>
      ) : (
        <div className="xe_page__scroll" ref={scrollRef}>
          <div className="xe_album-grid">
            {visible.map((a) => (
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
        </div>
      )}
    </div>
  );
}
