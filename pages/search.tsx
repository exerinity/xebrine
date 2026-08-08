import { useMemo, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { TrackListSkeleton } from '../components/skeletons';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { PlayIcon, SearchIcon, ShuffleIcon } from '../components/icons';
import { buildSearchIndex, searchIndex } from '../utils/smart_search';

export function SearchPage() {
  const { tracks, scanning } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const [query, setQuery] = useState('');
  usePageTitle('Search');

  const index = useMemo(() => buildSearchIndex(tracks), [tracks]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(results);

  const shuffleResults = () => {
    const order = intelligentShuffle(results, (t) => ({ id: t.id, artist: t.artist }), getRecentIds());
    playNow(order, 0);
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Search</h1>
        {query.trim() !== '' && results.length > 0 && (
          <>
            <button type="button" className="xe_btn" onClick={() => playNow(results, 0)} disabled={remoteLocked}>
              <PlayIcon size={14} />
              Play all
            </button>
            <button type="button" className="xe_btn" onClick={shuffleResults} disabled={remoteLocked}>
              <ShuffleIcon size={14} />
              Shuffle
            </button>
            <span className="xe_page__meta">
              {results.length} match{results.length === 1 ? '' : 'es'}
            </span>
          </>
        )}
      </div>
      <div className="xe_search-field xe_search-field--big">
        <SearchIcon size={16} />
        <input
          className="xe_search-input xe_search-input--big"
          type="search"
          placeholder='Search...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.trim() === '' ? null : scanning ? (
        <div className="xe_page__scroll">
          <TrackListSkeleton rows={10} />
        </div>
      ) : results.length === 0 ? (
        <p className="xe_empty-note">No matches for "{query}"...</p>
      ) : (
        <div className="xe_page__scroll">
          <TrackList tracks={paged} />
          {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
