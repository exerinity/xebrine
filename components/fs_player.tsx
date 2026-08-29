import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
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
const DRAG_THRESHOLD_PX = 4;
type CoverDeformation = [number, number, number, number, number, number];

const RESTING_DEFORMATION: CoverDeformation = [1, 0, 0, 1, 0, 0];

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
  const coverRef = useRef<HTMLButtonElement | null>(null);
  const coverDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    width: number;
    height: number;
    dragged: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, width: 1, height: 1, dragged: false });
  const suppressCoverClickRef = useRef(false);
  const coverMotionRef = useRef<{
    current: CoverDeformation;
    target: CoverDeformation;
    velocity: CoverDeformation;
    frame: number | null;
    lastTime: number;
  }>({
    current: [...RESTING_DEFORMATION],
    target: [...RESTING_DEFORMATION],
    velocity: [0, 0, 0, 0, 0, 0],
    frame: null,
    lastTime: 0
  });
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

  useEffect(() => {
    return () => {
      const frame = coverMotionRef.current.frame;
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

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

  const writeCoverDeformation = (values: CoverDeformation) => {
    const cover = coverRef.current;
    if (!cover) return;
    cover.style.setProperty('--cover-deform-a', values[0].toFixed(5));
    cover.style.setProperty('--cover-deform-b', values[1].toFixed(5));
    cover.style.setProperty('--cover-deform-c', values[2].toFixed(5));
    cover.style.setProperty('--cover-deform-d', values[3].toFixed(5));
    cover.style.setProperty('--cover-drag-x', `${values[4].toFixed(3)}px`);
    cover.style.setProperty('--cover-drag-y', `${values[5].toFixed(3)}px`);
  };

  const animateCoverDeformation = (time: number) => {
    const motion = coverMotionRef.current;
    const elapsed = motion.lastTime === 0 ? 1 / 60 : Math.min((time - motion.lastTime) / 1000, 0.032);
    const dragging = coverDragRef.current.pointerId !== null;
    const stiffness = dragging ? 250 : 165;
    const damping = dragging ? 19 : 7;
    let settled = !dragging;

    motion.lastTime = time;
    for (let index = 0; index < motion.current.length; index += 1) {
      const displacement = motion.target[index] - motion.current[index];
      motion.velocity[index] += displacement * stiffness * elapsed;
      motion.velocity[index] *= Math.exp(-damping * elapsed);
      motion.current[index] += motion.velocity[index] * elapsed;

      const positionTolerance = index < 4 ? 0.0005 : 0.04;
      const velocityTolerance = index < 4 ? 0.005 : 0.4;
      if (Math.abs(displacement) > positionTolerance || Math.abs(motion.velocity[index]) > velocityTolerance) {
        settled = false;
      }
    }

    writeCoverDeformation(motion.current);

    if (settled) {
      motion.current = [...RESTING_DEFORMATION];
      motion.target = [...RESTING_DEFORMATION];
      motion.velocity = [0, 0, 0, 0, 0, 0];
      motion.frame = null;
      motion.lastTime = 0;
      writeCoverDeformation(motion.current);
      coverRef.current?.classList.remove('xe_fullscreen-player__cover--deforming');
      return;
    }

    motion.frame = window.requestAnimationFrame(animateCoverDeformation);
  };

  const startCoverAnimation = () => {
    const motion = coverMotionRef.current;
    coverRef.current?.classList.add('xe_fullscreen-player__cover--deforming');
    if (motion.frame !== null) return;
    motion.lastTime = 0;
    motion.frame = window.requestAnimationFrame(animateCoverDeformation);
  };

  const setRestingDeformation = () => {
    coverMotionRef.current.target = [...RESTING_DEFORMATION];
    startCoverAnimation();
  };

  const beginCoverDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || settings.reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    coverDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      dragged: false
    };
    suppressCoverClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const deformCover = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = coverDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < DRAG_THRESHOLD_PX && !drag.dragged) return;

    drag.dragged = true;
    suppressCoverClickRef.current = true;
    const directionX = distance > 0 ? deltaX / distance : 1;
    const directionY = distance > 0 ? deltaY / distance : 0;
    const strength = Math.min(distance / (Math.min(drag.width, drag.height) * 0.48), 1);
    const stretch = strength * 0.28;
    const squash = strength * 0.1;
    const cross = (stretch + squash) * directionX * directionY;
    const maxOffset = Math.min(drag.width, drag.height) * 0.12;
    const offsetScale = distance > 0 ? Math.min(distance * 0.18, maxOffset) / distance : 0;

    coverMotionRef.current.target = [
      1 + stretch * directionX * directionX - squash * directionY * directionY,
      cross,
      cross,
      1 + stretch * directionY * directionY - squash * directionX * directionX,
      deltaX * offsetScale,
      deltaY * offsetScale
    ];
    startCoverAnimation();
  };

  const endCoverDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = coverDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.pointerId = null;
    setRestingDeformation();
  };

  const activateCover = () => {
    if (suppressCoverClickRef.current) {
      suppressCoverClickRef.current = false;
      return;
    }
    onClose();
  };

  const tiltCover = (event: MouseEvent<HTMLButtonElement>) => {
    if (coverDragRef.current.pointerId !== null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    event.currentTarget.style.setProperty('--cover-rotate-x', `${(y - 0.5) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-rotate-y', `${(0.5 - x) * 10}deg`);
    event.currentTarget.style.setProperty('--cover-shine-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--cover-shine-y', `${y * 100}%`);
  };

  const resetCoverTilt = (event: MouseEvent<HTMLButtonElement>) => {
    if (coverDragRef.current.pointerId !== null) return;
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
              ref={coverRef}
              type="button"
              className="xe_fullscreen-player__cover"
              onClick={activateCover}
              onMouseMove={tiltCover}
              onMouseLeave={resetCoverTilt}
              onPointerDown={beginCoverDrag}
              onPointerMove={deformCover}
              onPointerUp={endCoverDrag}
              onPointerCancel={endCoverDrag}
              title="Close fullscreen player"
              aria-label="Close fullscreen player"
            >
              {displayArtworkUrl ? <img src={displayArtworkUrl} alt="" draggable={false} /> : <LogoIcon size={88} />}
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
