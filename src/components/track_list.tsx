import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { toSlugParam } from '../utils/slug';
import { displayArtist } from '../utils/groups';
import { toast } from '../utils/toast';
import type { TrackMeta } from '../types';
import { ContextMenu, type ContextMenuItem } from './context_menu';
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
  const { current, isPlaying, playNow, enqueueNext, enqueueEnd } = usePlayer();
  const navigate = useNavigate();
  const currentTrackId = current?.track.id;
  const [menu, setMenu] = useState<MenuState | null>(null);

  const goToArtist = (track: TrackMeta) => navigate(`/artists/${toSlugParam(displayArtist(track))}`);
  const goToAlbum = (track: TrackMeta) => {
    const albumArtist = displayArtist(track);
    navigate(`/artists/${toSlugParam(albumArtist)}/${toSlugParam(track.album)}`, {
      state: { from: `/artists/${toSlugParam(albumArtist)}` }
    });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`Copied the ${label}`))
      .catch(() => toast.error(`Couldn't copy the ${label}`));
  };

  const menuItems = (m: MenuState): ContextMenuItem[] => [
    { label: 'Play now', heading: 'Enqueue track...', onSelect: () => playNow(tracks, m.index) },
    { label: 'Play next', onSelect: () => enqueueNext([m.track]) },
    { label: 'Enqueue', onSelect: () => enqueueEnd([m.track]) },
    { label: 'Copy title', heading: 'Copy metadata...', onSelect: () => copy(m.track.title, 'title') },
    {
      label: 'Copy info',
      onSelect: () => copy(`${m.track.title} by ${m.track.artist}`, 'info')
    },
    { label: 'Go to album', heading: 'Navigation...', onSelect: () => goToAlbum(m.track) },
    { label: 'Go to artist', onSelect: () => goToArtist(m.track) }
  ];

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
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
