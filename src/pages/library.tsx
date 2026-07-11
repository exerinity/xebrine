import { useMemo, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { TrackListSkeleton } from '../components/skeletons';
import { Spinner } from '../components/spinner';
import { SortSelect, type SortOption } from '../components/sort_select';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { FolderIcon, KeyIcon, PlayIcon, SearchIcon, ShuffleIcon } from '../components/icons';

type LibrarySort = 'artist' | 'album' | 'title' | 'title-desc' | 'duration';

const SORT_OPTIONS: SortOption<LibrarySort>[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'title', label: 'Title (A - Z)' },
  { value: 'title-desc', label: 'Title (Z - A)' },
  { value: 'duration', label: 'Duration' }
];

export function LibraryPage() {
  const { tracks, scanning, permissionNeeded, supported, addFolder, restoreAccess } = useLibrary();
  const { playNow } = usePlayer();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('artist');
  usePageTitle('Library');

  const sorted = useMemo(() => {
    const copy = [...tracks];
    switch (sort) {
      case 'artist':
        copy.sort(
          (a, b) =>
            a.artist.localeCompare(b.artist) ||
            a.album.localeCompare(b.album) ||
            (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
            a.title.localeCompare(b.title)
        );
        break;
      case 'album':
        copy.sort(
          (a, b) =>
            a.album.localeCompare(b.album) ||
            (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
            a.title.localeCompare(b.title)
        );
        break;
      case 'title':
        copy.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        copy.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'duration':
        copy.sort((a, b) => a.duration - b.duration);
        break;
    }
    return copy;
  }, [tracks, sort]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(visible);

  const shuffleAll = () => {
    const order = intelligentShuffle(visible, (t) => ({ id: t.id, artist: t.artist }), getRecentIds());
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
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Library</h1>
        <div className="xe_search-field">
          <SearchIcon size={14} />
          <input
            className="xe_search-input"
            type="search"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SortSelect value={sort} onChange={(v) => setSort(v)} options={SORT_OPTIONS} />
        <button type="button" className="xe_btn" onClick={() => playNow(visible, 0)} disabled={visible.length === 0}>
          <PlayIcon size={14} />
          Play all
        </button>
        <button type="button" className="xe_btn" onClick={shuffleAll} disabled={visible.length === 0}>
          <ShuffleIcon size={14} />
          Shuffle all
        </button>
        <button type="button" className="xe_btn xe_btn--accent" onClick={() => void addFolder()}>
          <FolderIcon size={14} />
          Add folder
        </button>
        <span className="xe_page__meta">{visible.length} tracks</span>
      </div>

      {permissionNeeded && (
        <div className="xe_banner">
          <span>Xebrine needs permission to read your music folders again.</span>
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void restoreAccess()}>
            <KeyIcon size={14} />
            Restore access
          </button>
        </div>
      )}

      {scanning && (
        <div className="xe_banner xe_banner--info">
          <Spinner />
          <span>
            Scanning <strong>{scanning.folderName}</strong>: read {scanning.done}
            {scanning.total > 0 ? ` / ${scanning.total}` : ''} files so far...
            {scanning.omitted > 0 ? ` (${scanning.omitted} to be omitted by your filter)` : ''}
          </span>
        </div>
      )}

      {tracks.length === 0 && !scanning ? (
        <div className="xe_empty-hero">
          <p>Your library is empty.</p>
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void addFolder()}>
            <FolderIcon size={14} />
            Add a music folder
          </button>
        </div>
      ) : (
        <div className="xe_page__scroll">
          {scanning ? (
            <TrackListSkeleton rows={15} />
          ) : (
            <>
              <TrackList tracks={paged} />
              {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
