import { usePlayer } from '../context/player_context';
import { useDragReorder } from '../hooks/drag_reorder';
import { formatTime } from '../utils/format';
import { CloseIcon, DragIcon, PauseIcon, PlayIcon } from './icons';
import { ExplicitBadge } from './explicit_badge';

export function QueueList({ query = '' }: { query?: string }) {
  const { queue, position, isPlaying, jumpTo, removeAt, move } = usePlayer();
  const { listRef, dragging, handleProps, itemStyle } = useDragReorder(move);

  if (queue.length === 0) {
    return <p className="xe_empty-note">The queue is empty!</p>;
  }

  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0;
  const matches = (item: (typeof queue)[number]) =>
    !filtering ||
    item.track.title.toLowerCase().includes(needle) ||
    item.track.artist.toLowerCase().includes(needle);

  if (filtering && !queue.some(matches)) {
    return <p className="xe_empty-note">No queued tracks match “{query.trim()}”</p>;
  }

  return (
    <div className="xe_queue-list" ref={listRef}>
      {queue.map((item, i) => {
        if (!matches(item)) return null;
        const isCurrent = i === position;
        const isDragged = dragging?.from === i;
        return (
          <div
            key={item.key}
            className={`xe_queue-row${isCurrent ? ' xe_queue-row--current' : ''}${
              isDragged ? ' xe_queue-row--dragging' : ''
            }`}
            style={filtering ? undefined : itemStyle(i)}
            onDoubleClick={() => jumpTo(i)}
          >
            {filtering ? (
              <span className="xe_queue-row__handle xe_queue-row__handle--disabled" title="Clear search to reorder">
                <DragIcon size={16} />
              </span>
            ) : (
              <span className="xe_queue-row__handle" title="Drag to reorder" {...handleProps(i)}>
                <DragIcon size={16} />
              </span>
            )}
            <span className="xe_queue-row__num">
              {isCurrent ? (isPlaying ? <PlayIcon size={13} /> : <PauseIcon size={13} />) : i + 1}
            </span>
            <span className="xe_queue-row__titles">
              <span className="xe_queue-row__title">
                {item.track.title}
                <ExplicitBadge trackId={item.track.id} />
              </span>
              <span className="xe_queue-row__artist">{item.track.artist}</span>
            </span>
            <span className="xe_queue-row__dur">{formatTime(item.track.duration)}</span>
            <button
              type="button"
              className="xe_mini-btn"
              title="Remove from queue"
              onClick={() => removeAt(i)}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
