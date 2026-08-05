import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { useDragReorder } from '../hooks/drag_reorder';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { formatTime } from '../utils/format';
import { toSlugParam } from '../utils/slug';
import { displayArtist } from '../utils/groups';
import type { TrackMeta } from '../types';
import { ContextMenu, type ContextMenuItem } from './context_menu';
import { CloseIcon, DragIcon, PauseIcon, PlayIcon } from './icons';
import { ExplicitBadge } from './explicit_badge';

interface MenuState {
  x: number;
  y: number;
  track: TrackMeta;
  index: number;
}

export function QueueList({ query = '' }: { query?: string }) {
  const { queue, position, isPlaying, jumpTo, removeAt, move, enqueueEnd } = usePlayer();
  const { listRef, dragging, handleProps, itemStyle } = useDragReorder(move);
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0;

  const entries = useMemo(() => {
    const all = queue.map((item, index) => ({ item, index }));
    if (!filtering) return all;
    return all.filter(
      ({ item }) =>
        item.track.title.toLowerCase().includes(needle) ||
        item.track.artist.toLowerCase().includes(needle)
    );
  }, [queue, needle, filtering]);

  const { visible, hasMore, sentinelRef } = useInfiniteScroll(entries);

  const goToArtist = (track: TrackMeta) => navigate(`/artists/${toSlugParam(displayArtist(track))}`);
  const goToAlbum = (track: TrackMeta) => {
    const albumArtist = displayArtist(track);
    navigate(`/artists/${toSlugParam(albumArtist)}/${toSlugParam(track.album)}`, {
      state: { from: `/artists/${toSlugParam(albumArtist)}` }
    });
  };

  const menuItems = (m: MenuState): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    if (position >= 0 && m.index !== position) {
      items.push(
        {
          label: 'Move to above current',
          heading: 'Reorder...',
          onSelect: () => move(m.index, m.index < position ? position - 1 : position)
        },
        {
          label: 'Move to below current',
          onSelect: () => move(m.index, m.index < position ? position : position + 1)
        }
      );
    }
    items.push(
      { label: 'Play now', heading: 'Queue...', onSelect: () => jumpTo(m.index) },
      { label: 'Remove', onSelect: () => removeAt(m.index) },
      { label: 'Go to album', heading: 'Navigation...', onSelect: () => goToAlbum(m.track) },
      { label: 'Go to artist', onSelect: () => goToArtist(m.track) },
      { label: 'Re-add', separatorBefore: true, onSelect: () => enqueueEnd([m.track]) }
    );
    return items;
  };

  if (queue.length === 0) {
    return <p className="xe_empty-note">The queue is empty!</p>;
  }

  if (filtering && entries.length === 0) {
    return <p className="xe_empty-note">No queued tracks match “{query.trim()}”</p>;
  }

  return (
    <>
      <div className="xe_queue-list" ref={listRef}>
        {visible.map(({ item, index }) => {
          const isCurrent = index === position;
          const isDragged = dragging?.from === index;
          return (
            <div
              key={item.key}
              className={`xe_queue-row${isCurrent ? ' xe_queue-row--current' : ''}${
                isDragged ? ' xe_queue-row--dragging' : ''
              }`}
              style={filtering ? undefined : itemStyle(index)}
              onDoubleClick={() => jumpTo(index)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, track: item.track, index });
              }}
            >
              {filtering ? (
                <span className="xe_queue-row__handle xe_queue-row__handle--disabled" title="Clear search to reorder">
                  <DragIcon size={16} />
                </span>
              ) : (
                <span className="xe_queue-row__handle" title="Drag to reorder" {...handleProps(index)}>
                  <DragIcon size={16} />
                </span>
              )}
              <span className="xe_queue-row__num">
                {isCurrent ? (isPlaying ? <PlayIcon size={13} /> : <PauseIcon size={13} />) : index + 1}
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
                onClick={() => removeAt(index)}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
