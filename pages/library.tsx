import { useMemo, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { TrackListSkeleton } from '../components/skeletons';
import { SortSelect, type SortDirection, type SortOption } from '../components/sort_select';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { FolderIcon, KeyIcon, PlayIcon, SearchIcon, ShuffleIcon } from '../components/icons';
import {
  DeepSearchModal,
  EMPTY_DEEP_SEARCH,
  isDeepSearchActive,
  matchesDeepSearch,
  type DeepSearchCriteria
} from '../components/deep_search';

type LibrarySort = 'artist' | 'album' | 'title' | 'duration';

const SORT_OPTIONS: SortOption<LibrarySort>[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'title', label: 'Title' },
  { value: 'duration', label: 'Duration' }
];

export function LibraryPage() {
  const { tracks, scanning, permissionNeeded, supported, addFolder, restoreAccess } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('artist');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [deep, setDeep] = useState<DeepSearchCriteria>(EMPTY_DEEP_SEARCH);
  const [deepOpen, setDeepOpen] = useState(false);
  const deepActive = isDeepSearchActive(deep);
  usePageTitle('Library');

  const sorted = useMemo(() => {
    const copy = [...tracks];
    const factor = direction === 'asc' ? 1 : -1;
    switch (sort) {
      case 'artist':
        copy.sort(
          (a, b) =>
            factor *
            (a.artist.localeCompare(b.artist) ||
              a.album.localeCompare(b.album) ||
              (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
              a.title.localeCompare(b.title))
        );
        break;
      case 'album':
        copy.sort(
          (a, b) =>
            factor *
            (a.album.localeCompare(b.album) ||
              (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
              a.title.localeCompare(b.title))
        );
        break;
      case 'title':
        copy.sort((a, b) => factor * a.title.localeCompare(b.title));
        break;
      case 'duration':
        copy.sort((a, b) => factor * (a.duration - b.duration || a.title.localeCompare(b.title)));
        break;
    }
    return copy;
  }, [tracks, sort, direction]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = sorted;
    if (q) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }
    if (deepActive) result = result.filter((t) => matchesDeepSearch(t, deep));
    return result;
  }, [sorted, query, deep, deepActive]);

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
        <button
          type="button"
          className={`xe_btn${deepActive ? ' xe_btn--accent' : ''}`}
          onClick={() => setDeepOpen(true)}
          title={deepActive ? 'Deep Search is filtering these results' : undefined}
        >
          <SearchIcon size={14} />
          Deep search{deepActive ? 'ing' : ''}
        </button>
        <SortSelect
          value={sort}
          onChange={(value) => setSort(value)}
          options={SORT_OPTIONS}
          direction={direction}
          onDirectionChange={setDirection}
        />
        <button type="button" className="xe_btn" onClick={() => playNow(visible, 0)} disabled={visible.length === 0 || remoteLocked}>
          <PlayIcon size={14} />
          Play all
        </button>
        <button type="button" className="xe_btn" onClick={shuffleAll} disabled={visible.length === 0 || remoteLocked}>
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

      {tracks.length === 0 && !scanning ? (
        <div className="xe_empty-hero">
          <p>Your library is empty!</p>
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void addFolder()}>
            <FolderIcon size={14} />
            Add a folder
          </button>
        </div>
      ) : (
        <div className="xe_page__scroll">
          {scanning ? (
            <TrackListSkeleton rows={15} />
          ) : visible.length === 0 ? (
            <p className="xe_empty-note">No tracks match...</p>
          ) : (
            <>
              <TrackList tracks={paged} />
              {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
            </>
          )}
        </div>
      )}

      {deepOpen && (
        <DeepSearchModal
          initial={deep}
          onApply={(criteria) => {
            setDeep(criteria);
            setDeepOpen(false);
          }}
          onClose={() => setDeepOpen(false)}
        />
      )}
    </div>
  );
}
