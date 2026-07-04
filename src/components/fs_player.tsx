import { useEffect } from 'react';
import { usePlayer } from '../context/player_context';
import { useAlbumArt } from '../hooks/album_art';
import { formatTime } from '../utils/format';
import type { QueueItem } from '../types';
import { LyricsPanel } from './lyrics';
import { ScrollingText } from './scrolling_text';
import { CloseIcon, NoteIcon, PauseIcon, PlayIcon } from './icons';

interface FullscreenPlayerProps {
  open: boolean;
  onClose(): void;
}

function UpNextPreview({ item, onPlay }: { item: QueueItem; onPlay(): void }) {
  const artUrl = useAlbumArt(item.track.id, item.track);

  return (
    <button type="button" className="xe_fullscreen-player__next-card" onClick={onPlay}>
      <span className="xe_fullscreen-player__next-art">
        {artUrl ? <img src={artUrl} alt="" /> : <NoteIcon size={42} />}
      </span>
      <span className="xe_fullscreen-player__next-copy">
        <ScrollingText text={item.track.title} className="xe_fullscreen-player__next-title" />
        <ScrollingText text={item.track.artist} className="xe_fullscreen-player__next-artist" />
        <span className="xe_fullscreen-player__next-duration">{formatTime(item.track.duration)}</span>
      </span>
    </button>
  );
}

export function FullscreenPlayer({ open, onClose }: FullscreenPlayerProps) {
  const {
    current,
    queue,
    position,
    isPlaying,
    artworkUrl,
    currentTime,
    duration,
    jumpTo
  } = usePlayer();
  const track = current?.track ?? null;
  const nextItem = queue[position + 1] ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open || !track) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <section className="xe_fullscreen-player" role="dialog" aria-label="Now playing">
      {artworkUrl && (
        <div
          className="xe_fullscreen-player__wash"
          style={{ backgroundImage: `url(${artworkUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="xe_fullscreen-player__top">
        <span className="xe_fullscreen-player__eyebrow">{isPlaying ? 'Now playing' : 'Now paused'}</span>
        <button type="button" className="xe_icon-btn" onClick={onClose} title="Close the player">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="xe_fullscreen-player__layout">
        <section className="xe_fullscreen-player__hero" aria-label="Current track">
          <div className="xe_fullscreen-player__cover-wrap">
            <div className="xe_fullscreen-player__cover-glow" aria-hidden="true" />
            <button
              type="button"
              className="xe_fullscreen-player__cover"
              onClick={onClose}
              title="Close fullscreen player"
              aria-label="Close fullscreen player"
            >
              {artworkUrl ? <img src={artworkUrl} alt="" /> : <NoteIcon size={88} />}
            </button>
          </div>
          <div className="xe_fullscreen-player__identity">
            <div className="xe_fullscreen-player__state">
              {isPlaying ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <ScrollingText text={track.title} className="xe_fullscreen-player__title" />
            <ScrollingText text={track.artist} className="xe_fullscreen-player__artist" />
            <div className="xe_fullscreen-player__progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section className="xe_fullscreen-player__panel xe_fullscreen-player__lyrics" aria-label="Lyrics">
          <h2>Lyrics</h2>
          <LyricsPanel showToolbar={false} variant="fullscreen" />
        </section>

        <section className="xe_fullscreen-player__panel xe_fullscreen-player__queue" aria-label="Up next">
          <h2>Up next</h2>
          {nextItem ? (
            <UpNextPreview item={nextItem} onPlay={() => jumpTo(position + 1)} />
          ) : (
            <p className="xe_empty-note">Nothing up next</p>
          )}
        </section>
      </div>
    </section>
  );
}
