import { useState } from 'react';
import { usePlayer } from '../context/player_context';
import { QueueList } from '../components/queue_list';
import { formatTime } from '../utils/format';
import { usePageTitle } from '../hooks/page_title';
import { SearchIcon, ShuffleIcon, TrashIcon } from '../components/icons';

export function QueuePage() {
  const { queue, current, shuffled, toggleShuffle, clearQueue, clearOthers } = usePlayer();
  const totalSeconds = queue.reduce((sum, item) => sum + item.track.duration, 0);
  const [query, setQuery] = useState('');
  usePageTitle('Queue');

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Queue</h1>
        <span className="xe_page__meta">
          currently {queue.length} track{queue.length === 1 ? '' : 's'} enqueued, {formatTime(totalSeconds)} total time
        </span>
        <div className="xe_search-field">
          <SearchIcon size={14} />
          <input
            className="xe_search-input"
            type="search"
            placeholder="Search queue..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`xe_btn${shuffled ? ' xe_btn--accent' : ''}`}
          onClick={toggleShuffle}
          disabled={queue.length === 0}
        >
          <ShuffleIcon size={14} />
          Shuffle {shuffled ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          className="xe_btn xe_btn--quiet"
          onClick={clearOthers}
          disabled={!current || queue.length <= 1}
        >
          <TrashIcon size={14} />
          Clear others
        </button>
        <button type="button" className="xe_btn xe_btn--quiet" onClick={clearQueue} disabled={queue.length === 0}>
          <TrashIcon size={14} />
          Clear queue
        </button>
      </div>
      <div className="xe_page__scroll">
        <QueueList query={query} />
      </div>
    </div>
  );
}
