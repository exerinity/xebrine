import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MAX_VOLUME, usePlayer } from '../context/player_context';
import { ScrollingText } from './scrolling_text';
import { Scrubber } from './scrubber';
import { Slider } from './slider';
import { Visualizer } from './visualizer';
import { toast } from '../utils/toast';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VisualizerIcon,
  VolumeIcon
} from './icons';

interface PlayerBarProps {
  fullscreenOpen?: boolean;
  onToggleFullscreen?: () => void;
}

export function PlayerBar({ fullscreenOpen = false, onToggleFullscreen }: PlayerBarProps) {
  const {
    current,
    isPlaying,
    volume,
    shuffled,
    repeatMode,
    artworkUrl,
    loadError,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    getAnalyser
  } = usePlayer();
  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 0.8);
  const [copiedField, setCopiedField] = useState<'title' | 'artist' | 'album' | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const [visualizerOn, setVisualizerOn] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const track = current?.track ?? null;
  const volumeLevel = volume <= 0 ? 0 : volume < 0.34 ? 1 : volume < 0.67 ? 2 : 3;
  const boosted = volume > 1;
  const elapsedPercent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  const remainingPercent = 100 - elapsedPercent;
  const elapsedLabel = track ? `${elapsedPercent}%` : '--%';
  const remainingLabel = track ? `${remainingPercent}%` : '--%';
  if (volume > 0) lastAudibleVolumeRef.current = volume;

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const copyField = (field: 'title' | 'artist' | 'album', value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`Copied the ${field}`))
      .catch(() => toast.error(`Couldn't copy the ${field}`));
    setCopiedField(field);
    if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => setCopiedField(null), 1000);
  };

  const toggleMute = () => {
    if (volume > 0) {
      lastAudibleVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastAudibleVolumeRef.current || 0.8);
    }
  };

  const toggleVisualizer = () => {
    setVisualizerOn((on) => {
      if (!on) setAnalyser(getAnalyser());
      return !on;
    });
  };

  return (
    <footer className="xe_player-bar">
      {visualizerOn && <Visualizer analyser={analyser} />}
      <div className="xe_player-bar__now">
        {artworkUrl && (
          <button
            type="button"
            className={`xe_player-bar__art xe_player-bar__art--button${
              fullscreenOpen ? ' xe_player-bar__art--hidden' : ''
            }`}
            onClick={onToggleFullscreen}
            disabled={!track}
            title="Open fullscreen player"
            aria-label="Open fullscreen player"
          >
            <img src={artworkUrl} alt="" />
          </button>
        )}
        <div className="xe_player-bar__titles">
          {track && (
            <>
              <ScrollingText
                text={track.title}
                className="xe_player-bar__title"
                title={copiedField === 'title' ? 'Copied!' : `Copy "${track.title}"`}
                onClick={() => copyField('title', track.title)}
              />
              <ScrollingText
                text={track.artist}
                className="xe_player-bar__subtitle"
                title={copiedField === 'artist' ? 'Copied!' : `Copy "${track.artist}"`}
                onClick={() => copyField('artist', track.artist)}
              />
              <ScrollingText
                text={track.album}
                className="xe_player-bar__subtitle"
                title={copiedField === 'album' ? 'Copied!' : `Copy "${track.album}"`}
                onClick={() => copyField('album', track.album)}
              />
              {loadError && <span className="xe_player-bar__error">{loadError}</span>}
            </>
          )}
        </div>
      </div>

      <div className="xe_player-bar__center">
        <div className="xe_player-bar__controls">
          <span className="xe_player-bar__percent" aria-hidden="true">
            {elapsedLabel}
          </span>
          <button
            type="button"
            className={`xe_icon-btn${shuffled ? ' xe_icon-btn--active' : ''}`}
            onClick={toggleShuffle}
            title={shuffled ? 'Restore original order' : 'Enable shuffle'}
            disabled={!track}
          >
            <ShuffleIcon size={18} />
          </button>
          <button type="button" className="xe_icon-btn" onClick={prev} title="Previous" disabled={!track}>
            <PrevIcon size={20} />
          </button>
          <button
            type="button"
            className="xe_icon-btn xe_icon-btn--primary"
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            disabled={!track}
          >
            {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button type="button" className="xe_icon-btn" onClick={next} title="Next" disabled={!track}>
            <NextIcon size={20} />
          </button>
          <button
            type="button"
            className={`xe_icon-btn${repeatMode !== 'off' ? ' xe_icon-btn--active' : ''}`}
            onClick={cycleRepeat}
            title={
              repeatMode === 'off'
                ? 'Repeat queue'
                : repeatMode === 'all'
                  ? 'Repeat current track'
                  : 'Repeat off'
            }
            disabled={!track}
          >
            {repeatMode === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
          </button>
          <span className="xe_player-bar__percent" aria-hidden="true">
            {remainingLabel}
          </span>
        </div>
        <Scrubber />
      </div>

      <div className="xe_player-bar__volume">
        <button
          type="button"
          className={`xe_icon-btn${visualizerOn ? ' xe_icon-btn--active' : ''}`}
          onClick={toggleVisualizer}
          title={visualizerOn ? 'Hide visualizer' : 'Show visualizer'}
          aria-pressed={visualizerOn}
        >
          <VisualizerIcon size={16} />
        </button>
        <button
          type="button"
          className="xe_player-bar__volume-label"
          onClick={toggleMute}
          aria-label={volume > 0 ? `Mute volume, currently ${Math.round(volume * 100)}%` : 'Restore volume'}
          title={volume > 0 ? 'Mute' : 'Restore volume'}
        >
          <VolumeIcon size={18} level={volumeLevel} />
        </button>
        <div
          className={`xe_player-bar__volume-slider-wrap${
            boosted ? ' xe_player-bar__volume-slider-wrap--boosted' : ''
          }`}
          data-tooltip={`${Math.round(volume * 100)}%${boosted ? ' (+)' : ''}`}
          style={{ '--volume-tooltip-x': `${(volume / MAX_VOLUME) * 100}%` } as CSSProperties}
          onContextMenu={(e) => {
            e.preventDefault();
            setVolume(1);
          }}
        >
          <Slider
            value={volume}
            max={MAX_VOLUME}
            markAt={1}
            onChange={setVolume}
            wheelStep={0.05}
            ariaLabel="Volume (drag past 100% to boost, up to 150%)"
            className={`xe_player-bar__volume-slider${boosted ? ' xe_player-bar__volume-slider--boosted' : ''}`}
          />
        </div>
      </div>
    </footer>
  );
}
