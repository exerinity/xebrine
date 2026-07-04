import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { toSlugParam } from '../utils/slug';
import type { TrackMeta } from '../types';
import { PauseIcon, PlayIcon, PlayNextIcon, PlusIcon } from './icons';

interface TrackListProps {
  tracks: TrackMeta[];
}

export function TrackList({ tracks }: TrackListProps) {
  const { current, isPlaying, playNow, enqueueNext, enqueueEnd } = usePlayer();
  const navigate = useNavigate();
  const currentTrackId = current?.track.id;

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
          >
            <span className="xe_track-table__cell xe_track-table__cell--num">
              {active ? (isPlaying ? <PlayIcon size={13} /> : <PauseIcon size={13} />) : i + 1}
            </span>
            <span className="xe_track-table__cell xe_track-table__cell--title">{track.title}</span>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artists/${toSlugParam(track.artist)}`);
              }}
            >
              {track.artist}
            </button>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/artists/${toSlugParam(track.artist)}/${toSlugParam(track.album)}`, {
                  state: { from: `/artists/${toSlugParam(track.artist)}` }
                });
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
                title="Play from here"
                onClick={() => playNow(tracks, i)}
              >
                <PlayIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title="Play next"
                onClick={() => enqueueNext([track])}
              >
                <PlayNextIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title="Add to end of queue"
                onClick={() => enqueueEnd([track])}
              >
                <PlusIcon size={13} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
