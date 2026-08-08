import { useState } from 'react';
import { REMOTE_LOCK_MESSAGE, usePlayer } from '../context/player_context';
import { useTrackMenu } from '../hooks/track_menu';
import { formatTime } from '../utils/format';
import type { TrackMeta } from '../types';
import { ContextMenu } from './context_menu';
import { PauseIcon, PlayIcon, PlayNextIcon, PlusIcon } from './icons';
import { ExplicitBadge } from './explicit_badge';

interface TrackListProps {
  tracks: TrackMeta[];
}

interface MenuState {
  x: number;
  y: number;
  track: TrackMeta;
  index: number;
}

export function TrackList({ tracks }: TrackListProps) {
  const { current, isPlaying, playNow, enqueueNext, enqueueEnd, remoteLocked } = usePlayer();
  const { buildMenu, goToArtist, goToAlbum } = useTrackMenu();
  const currentTrackId = current?.track.id;
  const [menu, setMenu] = useState<MenuState | null>(null);

  return (
    <div className="xe_track-table">
      <div className="xe_track-table__row xe_track-table__row--head">
        <span className="xe_track-table__cell xe_track-table__cell--num">#</span>
        <span className="xe_track-table__cell">Title</span>
        <span className="xe_track-table__cell">Artist</span>
        <span className="xe_track-table__cell">Album</span>
        <span className="xe_track-table__cell xe_track-table__cell--dur">Time</span>
        <span className="xe_track-table__cell xe_track-table__cell--actions" />
      </div>
      {tracks.map((track, i) => {
        const active = track.id === currentTrackId;
        return (
          <div
            key={track.id}
            className={`xe_track-table__row${active ? ' xe_track-table__row--active' : ''}`}
            onDoubleClick={() => playNow(tracks, i)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, track, index: i });
            }}
          >
            <span className="xe_track-table__cell xe_track-table__cell--num">
              {active ? (isPlaying ? <PlayIcon size={13} /> : <PauseIcon size={13} />) : i + 1}
            </span>
            <span className="xe_track-table__cell xe_track-table__cell--title">
              {track.title}
              <ExplicitBadge trackId={track.id} />
            </span>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              onClick={(e) => {
                e.stopPropagation();
                goToArtist(track);
              }}
            >
              {track.artist}
            </button>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              onClick={(e) => {
                e.stopPropagation();
                goToAlbum(track);
              }}
            >
              {track.album}
            </button>
            <span className="xe_track-table__cell xe_track-table__cell--dur">
              {formatTime(track.duration)}
            </span>
            <span className="xe_track-table__cell xe_track-table__cell--actions">
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : 'Play from here'}
                disabled={remoteLocked}
                onClick={() => playNow(tracks, i)}
              >
                <PlayIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : 'Play next'}
                disabled={remoteLocked}
                onClick={() => enqueueNext([track])}
              >
                <PlayNextIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : 'Add to end of queue'}
                disabled={remoteLocked}
                onClick={() => enqueueEnd([track])}
              >
                <PlusIcon size={13} />
              </button>
            </span>
          </div>
        );
      })}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(menu.track, () => playNow(tracks, menu.index))}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
