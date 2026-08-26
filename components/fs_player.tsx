import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { useAlbumArt } from '../hooks/album_art';
import { useKenBurns } from '../hooks/ken_burns';
import { formatTime } from '../utils/format';
import type { QueueItem } from '../types';
import { LyricsPanel } from './lyrics';
import { ScrollingText } from './scrolling_text';
import { CloseIcon, LogoIcon, PauseIcon, PlayIcon } from './icons';

interface FullscreenPlayerProps {
  open: boolean;
  playerBarCollapsed: boolean;
  onClose(): void;
}

const EXIT_DURATION_MS = 200;

function TrackPreviewCard({
  item,
  onPlay,
  title
}: {
  item: QueueItem;
  onPlay(): void;
  title?: string;
}) {
  const artUrl = useAlbumArt(item.track.id, item.track);

  return (
    <button
      type="button"
      className="xe_fullscreen-player__track-card"
      onClick={onPlay}
      title={title}
    >
      <span className="xe_fullscreen-player__track-art">
        {artUrl ? <img src={artUrl} alt="" /> : <LogoIcon size={18} />}
      </span>
      <span className="xe_fullscreen-player__track-copy">
        <ScrollingText text={item.track.title} className="xe_fullscreen-player__track-title" />
        <ScrollingText text={item.track.artist} className="xe_fullscreen-player__track-artist" />
      </span>
    </button>
  );
}

export function FullscreenPlayer({ open, playerBarCollapsed, onClose }: FullscreenPlayerProps) {
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
  const { settings } = useSettings();
  const track = current?.track ?? null;
  const visible = open && Boolean(track);
  const [rendered, setRendered] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const washRef = useRef<HTMLDivElement | null>(null);
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

  useKenBurns(
    washRef,
    rendered &&
      Boolean(snapshotRef.current?.artworkUrl) &&
      settings.fsKenBurns &&
      !settings.reducedMotion,
    settings.fsKenBurnsIntensity
  );

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

  const tiltCover = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    event.currentTarget.style.setProperty('--cover-rotate-x', `${(y - 0.5) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-rotate-y', `${(0.5 - x) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-shine-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--cover-shine-y', `${y * 100}%`);
  };

  const resetCoverTilt = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty('--cover-rotate-x', '0deg');
    event.currentTarget.style.setProperty('--cover-rotate-y', '0deg');
    event.currentTarget.style.setProperty('--cover-shine-x', '50%');
    event.currentTarget.style.setProperty('--cover-shine-y', '18%');
  };

  return (
    <section
      className={`xe_fullscreen-player${leaving ? ' xe_fullscreen-player--leaving' : ''}`}
      role="dialog"
      aria-label="Now playing"
    >
      {displayArtworkUrl && (
        <div
          ref={washRef}
          className="xe_fullscreen-player__wash"
          style={{
            backgroundImage: `url(${displayArtworkUrl})`,
            filter: `blur(${settings.fsBlur}px) saturate(${settings.fsSaturate})`
          }}
          aria-hidden="true"
        />
      )}
      <div className="xe_fullscreen-player__top">
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
              onMouseMove={tiltCover}
              onMouseLeave={resetCoverTilt}
              title="Close fullscreen player"
              aria-label="Close fullscreen player"
            >
              {displayArtworkUrl ? <img src={displayArtworkUrl} alt="" /> : <LogoIcon size={88} />}
            </button>
          </div>
          <div className="xe_fullscreen-player__identity">
            <div
              className={`xe_fullscreen-player__state${
                playerBarCollapsed ? '' : ' xe_fullscreen-player__state--hidden'
              }`}
              aria-hidden={!playerBarCollapsed}
            >
              {displayPlaying ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
              <span>{formatTime(displayCurrentTime)} / {formatTime(displayDuration)}</span>
            </div>
            <ScrollingText text={displayTrack.title} className="xe_fullscreen-player__title" />
            <ScrollingText text={displayTrack.artist} className="xe_fullscreen-player__artist" />
            <div
              className={`xe_fullscreen-player__progress${
                playerBarCollapsed ? '' : ' xe_fullscreen-player__progress--hidden'
              }`}
              aria-hidden="true"
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section
          className="xe_fullscreen-player__panel xe_fullscreen-player__lyrics"
          aria-label="Lyrics, up next and just played"
        >
          <h2>Lyrics</h2>
          <LyricsPanel showToolbar={false} variant="fullscreen" />
          <div className="xe_fullscreen-player__queue" aria-label="Queue preview">
            <div className="xe_fullscreen-player__queue-item">
              <h3>Up next</h3>
              {nextItem ? (
                <TrackPreviewCard item={nextItem} onPlay={() => jumpTo(displayPosition + 1)} />
              ) : (
                <p className="xe_empty-note">Nothing up next</p>
              )}
            </div>
            <div className="xe_fullscreen-player__queue-item">
              <h3>Just played</h3>
              {displayJustPlayed ? (
                <TrackPreviewCard item={displayJustPlayed} onPlay={backToJustPlayed} title="Back to this track" />
              ) : (
                <p className="xe_empty-note">Nothing yet</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
