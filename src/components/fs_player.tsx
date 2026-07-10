import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/player_context';
import { useAlbumArt } from '../hooks/album_art';
import { formatTime } from '../utils/format';
import type { QueueItem } from '../types';
import { LyricsPanel } from './lyrics';
import { ScrollingText } from './scrolling_text';
import { CloseIcon, LogoIcon, NoteIcon, PauseIcon, PlayIcon } from './icons';

interface FullscreenPlayerProps {
  open: boolean;
  onClose(): void;
}

const EXIT_DURATION_MS = 200;

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

function JustPlayedCard({ item, onPlay }: { item: QueueItem; onPlay(): void }) {
  const artUrl = useAlbumArt(item.track.id, item.track);

  return (
    <button type="button" className="xe_fullscreen-player__prev-card" onClick={onPlay} title="Back to this track">
      <span className="xe_fullscreen-player__prev-art">
        {artUrl ? <img src={artUrl} alt="" /> : <NoteIcon size={20} />}
      </span>
      <span className="xe_fullscreen-player__prev-copy">
        <span className="xe_fullscreen-player__prev-label">Just played</span>
        <span className="xe_fullscreen-player__prev-title">{item.track.title}</span>
        <span className="xe_fullscreen-player__prev-artist">{item.track.artist}</span>
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
    justPlayed,
    jumpTo,
    playNow
  } = usePlayer();
  const track = current?.track ?? null;
  const visible = open && Boolean(track);
  const [rendered, setRendered] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const snapshotRef = useRef<{
    track: NonNullable<typeof track>;
    queue: typeof queue;
    position: number;
    isPlaying: boolean;
    artworkUrl: typeof artworkUrl;
    currentTime: number;
    duration: number;
    justPlayed: typeof justPlayed;
  } | null>(null);
  if (track) {
    snapshotRef.current = { track, queue, position, isPlaying, artworkUrl, currentTime, duration, justPlayed };
  }

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setLeaving(false);
      return;
    }
    if (!rendered) return;
    setLeaving(true);
    const timeout = window.setTimeout(() => {
      setRendered(false);
      setLeaving(false);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [visible, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!rendered || !snapshotRef.current) return null;

  const {
    track: displayTrack,
    queue: displayQueue,
    position: displayPosition,
    isPlaying: displayPlaying,
    artworkUrl: displayArtworkUrl,
    currentTime: displayCurrentTime,
    duration: displayDuration,
    justPlayed: displayJustPlayed
  } = snapshotRef.current;
  const nextItem = displayQueue[displayPosition + 1] ?? null;
  const progress = displayDuration > 0 ? Math.min(100, (displayCurrentTime / displayDuration) * 100) : 0;

  const backToJustPlayed = () => {
    if (!displayJustPlayed) return;
    const index = displayQueue.findIndex((item) => item.key === displayJustPlayed.key);
    if (index >= 0) jumpTo(index);
    else playNow([displayJustPlayed.track], 0);
  };

  return (
    <section
      className={`xe_fullscreen-player${leaving ? ' xe_fullscreen-player--leaving' : ''}`}
      role="dialog"
      aria-label="Now playing"
    >
      {displayArtworkUrl && (
        <div
          className="xe_fullscreen-player__wash"
          style={{ backgroundImage: `url(${displayArtworkUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="xe_fullscreen-player__top">
        {displayJustPlayed && <JustPlayedCard item={displayJustPlayed} onPlay={backToJustPlayed} />}
        <button type="button" className="xe_icon-btn" onClick={onClose} title="Close the player">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="xe_fullscreen-player__layout">
        <section className="xe_fullscreen-player__hero" aria-label="Current track">
          <span className="xe_fullscreen-player__eyebrow">
            <LogoIcon size={14} />
            {displayPlaying ? 'Now playing' : 'Now paused'}
          </span>
          <div className="xe_fullscreen-player__cover-wrap">
            <div className="xe_fullscreen-player__cover-glow" aria-hidden="true" />
            <button
              type="button"
              className="xe_fullscreen-player__cover"
              onClick={onClose}
              title="Close fullscreen player"
              aria-label="Close fullscreen player"
            >
              {displayArtworkUrl ? <img src={displayArtworkUrl} alt="" /> : <NoteIcon size={88} />}
            </button>
          </div>
          <div className="xe_fullscreen-player__identity">
            <div className="xe_fullscreen-player__state">
              {displayPlaying ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
              <span>{formatTime(displayCurrentTime)} / {formatTime(displayDuration)}</span>
            </div>
            <ScrollingText text={displayTrack.title} className="xe_fullscreen-player__title" />
            <ScrollingText text={displayTrack.artist} className="xe_fullscreen-player__artist" />
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
            <UpNextPreview item={nextItem} onPlay={() => jumpTo(displayPosition + 1)} />
          ) : (
            <p className="xe_empty-note">Nothing up next</p>
          )}
        </section>
      </div>
    </section>
  );
}
