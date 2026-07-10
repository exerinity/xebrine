import { usePlayer } from '../context/player_context';
import { useDragReorder } from '../hooks/drag_reorder';
import { formatTime } from '../utils/format';
import { CloseIcon, DragIcon, PauseIcon, PlayIcon } from './icons';
import { ExplicitBadge } from './explicit_badge';

export function QueueList() {
  const { queue, position, isPlaying, jumpTo, removeAt, move } = usePlayer();
  const { listRef, dragging, handleProps, itemStyle } = useDragReorder(move);

  if (queue.length === 0) {
    return <p className="xe_empty-note">The queue is empty!</p>;
  }

  return (
    <div className="xe_queue-list" ref={listRef}>
      {queue.map((item, i) => {
        const isCurrent = i === position;
        const isDragged = dragging?.from === i;
        return (
          <div
            key={item.key}
            className={`xe_queue-row${isCurrent ? ' xe_queue-row--current' : ''}${
              isDragged ? ' xe_queue-row--dragging' : ''
            }`}
            style={itemStyle(i)}
            onDoubleClick={() => jumpTo(i)}
          >
            <span className="xe_queue-row__handle" title="Drag to reorder" {...handleProps(i)}>
              <DragIcon size={16} />
            </span>
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
