import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import { useKenBurns } from '../hooks/ken_burns';
import { formatTime } from '../utils/format';
import { LyricsPanel } from './lyrics';
import { ScrollingText } from './scrolling_text';
import { TrackPreviewCard } from './track_preview_card';
import { AutoMixDrawer } from './auto_mix_drawer';
import { CloseIcon, LogoIcon, PauseIcon, PlayIcon } from './icons';
import { FullscreenMinimalPlayer } from './fs_minimal';
import { useCoverDeformation } from '../hooks/cover_deformation';

interface FullscreenPlayerProps {
  open: boolean;
  playerBarCollapsed: boolean;
  onClose(): void;
}

const EXIT_DURATION_MS = 200;
const MINIMAL_ROTATION_BASE_SECONDS = 220;

export function FullscreenPlayer({ open, playerBarCollapsed, onClose }: FullscreenPlayerProps) {
  const {
    current,
    radio_station,
    queue,
    position,
    isPlaying,
    artworkUrl,
    currentTime,
    duration,
    justPlayed,
    autoMixEnabled,
    jumpTo,
    playNow
  } = usePlayer();
  const { settings } = useSettings();
  const minimal = settings.fsPlayerStyle === 'minimal';
  const track = radio_station ? { title: radio_station.name, artist: 'Live radio' } : current?.track ?? null;
  const visible = open && Boolean(track);
  const [rendered, setRendered] = useState(visible);
  const [leaving, setLeaving] = useState(false);
  const washRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLButtonElement | null>(null);
  const coverHandlers = useCoverDeformation(
    coverRef,
    settings.reducedMotion,
    () => onClose()
  );
  const snapshotRef = useRef<{
    track: NonNullable<typeof track>;
    trackId: string | null;
    radio: boolean;
    queue: typeof queue;
    position: number;
    isPlaying: boolean;
    artworkUrl: typeof artworkUrl;
    currentTime: number;
    duration: number;
    justPlayed: typeof justPlayed;
  } | null>(null);
  if (track) {
    snapshotRef.current = {
      radio: !!radio_station,
      track,
      trackId: radio_station ? null : current?.track.id ?? null,
      queue,
      position,
      isPlaying,
      artworkUrl,
      currentTime,
      duration,
      justPlayed
    };
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
      !minimal &&
      settings.fsKenBurns &&
      !settings.reducedMotion,
    settings.fsKenBurnsIntensity
  );

  if (!rendered || !snapshotRef.current) return null;

  const {
    radio: display_radio,
    track: displayTrack,
    trackId: displayTrackId,
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
  const backgroundBlur = minimal ? settings.fsMinimalBlur : settings.fsBlur;
  const backgroundSaturate = minimal ? 1 : settings.fsSaturate;
  const minimal_rotation_speed = minimal && Number.isFinite(settings.fsMinimalRotationSpeed)
    ? Math.min(4, Math.max(0, settings.fsMinimalRotationSpeed))
    : 0;

  const backToJustPlayed = () => {
    if (!displayJustPlayed) return;
    const index = displayQueue.findIndex((item) => item.key === displayJustPlayed.key);
    if (index >= 0) jumpTo(index);
    else playNow([displayJustPlayed.track], 0);
  };

  return (
    <section
      className={`xe_fullscreen-player xe_fullscreen-player--${minimal ? 'minimal' : 'maximal'}${leaving ? ' xe_fullscreen-player--leaving' : ''}`}
      role="dialog"
      aria-label="Now playing"
    >
      {displayArtworkUrl && (
        <div
          ref={washRef}
          className={`xe_fullscreen-player__wash${minimal ? ' xe_fullscreen-player__wash--minimal' : ''}${minimal_rotation_speed > 0 ? ' xe_fullscreen-player__wash--rotating' : ''}`}
          style={{
            backgroundImage: `url(${displayArtworkUrl})`,
            filter: `blur(${backgroundBlur}px) saturate(${backgroundSaturate})`,
            animationDuration: minimal_rotation_speed > 0 ? `${MINIMAL_ROTATION_BASE_SECONDS / minimal_rotation_speed}s` : undefined
          }}
          aria-hidden="true"
        />
      )}
      <div className="xe_fullscreen-player__top">
        <button type="button" className="xe_icon-btn" onClick={onClose} title="Close the player">
          <CloseIcon size={20} />
        </button>
      </div>

      {minimal ? (
        <FullscreenMinimalPlayer
          artworkUrl={displayArtworkUrl}
          radio={display_radio}
          trackId={displayTrackId}
          coverRef={coverRef}
          coverHandlers={coverHandlers}
        />
      ) : (
        <div className="xe_fullscreen-player__layout">
          <section className="xe_fullscreen-player__hero" aria-label="Current track">
            <div className="xe_fullscreen-player__cover-wrap">
              <div className="xe_fullscreen-player__cover-glow" aria-hidden="true" />
              <button
                ref={coverRef}
                type="button"
                className="xe_fullscreen-player__cover"
                {...coverHandlers}
                title="Click to close fullscreen player, drag to deform cover art"
                aria-label="Click to close fullscreen player, drag to deform cover art"
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
                <span>{display_radio ? 'LIVE' : `${formatTime(displayCurrentTime)} / ${formatTime(displayDuration)}`}</span>
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
            aria-label={`Lyrics, up next, just played${autoMixEnabled ? ' and auto mix' : ''}`}
          >
            {display_radio ? <p className="xe_empty-note">Live radio</p> : <>
            <h2>Lyrics</h2>
            <LyricsPanel showToolbar={false} variant="fullscreen" />
            <div className={`xe_fullscreen-player__queue${autoMixEnabled ? ' xe_fullscreen-player__queue--auto-mix' : ''}`} aria-label="Queue preview">
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
              <div className="xe_fullscreen-player__queue-item xe_fullscreen-player__auto-mix" aria-hidden={!autoMixEnabled}>
                <h3>Auto mix</h3>
                <AutoMixDrawer inline />
              </div>
            </div>
            </>}
          </section>
        </div>
      )}
    </section>
  );
}
