import { useMemo, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../src/context/player';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { TrackList } from '../components/track_list';
import { ScanStatusBanner } from '../components/scan_status_banner';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { PlayIcon, SearchIcon, ShuffleIcon } from '../components/icons';
import { buildSearchIndex, searchIndex } from '../utils/smart_search';

const QUERY_KEY = 'xebrine.searchQuery';

function loadQuery(): string {
  try {
    return localStorage.getItem(QUERY_KEY) ?? '';
  } catch {
    return '';
  }
}

export function SearchPage() {
  const { tracks } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const [query, setQuery] = useState(loadQuery);
  usePageTitle('Search');

  const index = useMemo(() => buildSearchIndex(tracks), [tracks]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(results);

  const changeQuery = (value: string) => {
    setQuery(value);
    try {
      localStorage.setItem(QUERY_KEY, value);
    } catch {
      null;
    }
  };

  const shuffleResults = () => {
    const order = intelligentShuffle(results, (t) => ({ id: t.id, artist: t.artist }), getRecentIds());
    playNow(order, 0);
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar xe_search-toolbar">
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

      <ScanStatusBanner />

      <div className="xe_search-field xe_search-field--big">
        <SearchIcon size={16} />
        <input
          className="xe_search-input xe_search-input--big"
          type="search"
          placeholder='Search...'
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.trim() === '' ? null : results.length === 0 ? (
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
