import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_VOLUME, REMOTE_LOCK_MESSAGE, usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { ScrollingText } from './scrolling_text';
import { Scrubber } from './scrubber';
import { Slider } from './slider';
import { Visualizer } from './visualizer';
import { ContextMenu, type ContextMenuItem } from './context_menu';
import { toast } from '../utils/toast';
import { toSlugParam } from '../utils/slug';
import { displayArtist } from '../utils/groups';
import {
  AutoMixIcon,
  AutoPlayIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  LastfmIcon,
  ShuffleIcon,
  VisualizerIcon,
  VolumeIcon
} from './icons';
import { useLastfmSession } from '../hooks/lastfm_session';
import { useScrobbleStatus } from '../hooks/scrobble_status';
import { SCROBBLE_STATUS_LABEL } from '../utils/scrobble_status';
import { AUTO_PLAY_LABELS } from '../queue/auto_play';
import { ExplicitBadge } from './explicit_badge';
import { ScanDrawer } from './scan_drawer';
import { AutoMixDrawer } from './auto_mix_drawer';
import { SleepTimerControl } from './sleep_timer';

interface PlayerBarProps {
  fullscreenOpen?: boolean;
  onToggleFullscreen?: () => void;
}

export function PlayerBar({ fullscreenOpen = false, onToggleFullscreen }: PlayerBarProps) {
  const navigate = useNavigate();
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
    getAnalyser,
    autoMixEnabled,
    autoMixPhase,
    autoMixColor,
    toggleAutoMix,
    remoteLocked
  } = usePlayer();
  const { settings, update } = useSettings();
  const lastfm = useLastfmSession();
  const scrobbleStatus = useScrobbleStatus();
  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 0.8);
  const [copiedField, setCopiedField] = useState<'title' | 'artist' | 'album' | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const [visualizerOn, setVisualizerOn] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [nowEntering, setNowEntering] = useState(false);
  const [scrobbleMenu, setScrobbleMenu] = useState<{ x: number; y: number } | null>(null);

  const track = current?.track ?? null;
  const hadTrackRef = useRef(Boolean(track));
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

  useEffect(() => {
    document.documentElement.classList.toggle('xe_player-hidden', collapsed);
    return () => document.documentElement.classList.remove('xe_player-hidden');
  }, [collapsed]);

  useEffect(() => {
    const hasTrack = Boolean(track);
    if (hasTrack && !hadTrackRef.current) setNowEntering(true);
    hadTrackRef.current = hasTrack;
  }, [track]);

  const copyField = (field: 'title' | 'artist' | 'album', value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`Copied the ${field}`))
      .catch(() => toast.error(`Couldn't copy the ${field}`));
    setCopiedField(field);
    if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => setCopiedField(null), 1000);
  };

  const openField = (field: 'title' | 'artist' | 'album') => {
    if (!track) return;
    if (fullscreenOpen) onToggleFullscreen?.();
    const artistSlug = toSlugParam(displayArtist(track));
    if (field === 'artist') {
      navigate(`/artists/${artistSlug}`);
    } else {
      navigate(`/artists/${artistSlug}/${toSlugParam(track.album)}`, { state: { from: `/artists/${artistSlug}` } });
    }
  };

  const handleFieldClick = (field: 'title' | 'artist' | 'album', value: string) => {
    if (settings.playerBarClickAction === 'open') {
      openField(field);
    } else {
      copyField(field, value);
    }
  };

  const handleFieldContextMenu = (e: MouseEvent, field: 'title' | 'artist' | 'album', value: string) => {
    if (!track) return;
    e.preventDefault();
    if (settings.playerBarClickAction === 'open') {
      copyField(field, value);
    } else {
      openField(field);
    }
  };

  const fieldTooltip = (field: 'title' | 'artist' | 'album', value: string) => {
    const target = field === 'artist' ? track!.artist : track!.album;
    if (settings.playerBarClickAction === 'open') {
      return copiedField === field ? 'Copied!' : `Go to "${target}" (right-click to copy)`;
    }
    return copiedField === field ? 'Copied!' : `Copy "${value}" (right-click to open)`;
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

  const autoMixLabel = autoMixEnabled ? 'Enabled' : 'Disabled';
  const autoMixBusy = autoMixEnabled && (autoMixPhase === 'analyzing-current' || autoMixPhase === 'analyzing-next');
  const scrobbleMenuItems: ContextMenuItem[] = lastfm
    ? [
        {
          label: settings.scrobbleEnabled ? 'Disable scrobbling' : 'Enable scrobbling',
          heading: 'Last.fm...',
          onSelect: () => update({ scrobbleEnabled: !settings.scrobbleEnabled })
        },
        {
          label: 'Go to Last.fm settings',
          onSelect: () => {
            if (fullscreenOpen) onToggleFullscreen?.();
            navigate('/i/lastfm');
          }
        },
        {
          label: 'Open profile',
          icon: <ExternalLinkIcon size={14} />,
          onSelect: () => {
            window.open(
              `https://www.last.fm/user/${encodeURIComponent(lastfm.username)}`,
              '_blank',
              'noopener,noreferrer'
            );
          }
        }
      ]
    : [];

  return (
    <>
      <button
        type="button"
        className={`xe_player-handle${collapsed ? ' xe_player-handle--collapsed' : ''}`}
        onClick={() => setCollapsed((value) => !value)}
        title={collapsed ? 'Show the player' : 'Hide the player'}
        aria-label={collapsed ? 'Show the player' : 'Hide the player'}
        aria-expanded={!collapsed}
      >
        <span className="xe_player-handle__tab">
          <ChevronRightIcon size={14} />
        </span>
      </button>
      <footer className={`xe_player-bar${collapsed ? ' xe_player-bar--collapsed' : ''}`}>
        {visualizerOn && <Visualizer analyser={analyser} />}
        <ScanDrawer />
        <div
          className={`xe_player-bar__now${nowEntering ? ' xe_player-bar__now--entering' : ''}`}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setNowEntering(false);
          }}
        >
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
                  title={fieldTooltip('title', track.title)}
                  suffix={<ExplicitBadge trackId={track.id} />}
                  onClick={() => handleFieldClick('title', track.title)}
                  onContextMenu={(e) => handleFieldContextMenu(e, 'title', track.title)}
                />
                <ScrollingText
                  text={track.artist}
                  className="xe_player-bar__subtitle"
                  title={fieldTooltip('artist', track.artist)}
                  onClick={() => handleFieldClick('artist', track.artist)}
                  onContextMenu={(e) => handleFieldContextMenu(e, 'artist', track.artist)}
                />
                <ScrollingText
                  text={track.album}
                  className="xe_player-bar__subtitle"
                  title={fieldTooltip('album', track.album)}
                  onClick={() => handleFieldClick('album', track.album)}
                  onContextMenu={(e) => handleFieldContextMenu(e, 'album', track.album)}
                />
                {loadError && <span className="xe_player-bar__error">{loadError}</span>}
              </>
            )}
            {!track && remoteLocked && (
              <span className="xe_player-bar__error">{REMOTE_LOCK_MESSAGE}</span>
            )}
          </div>
        </div>

        <div className="xe_player-bar__center">
          <div className="xe_player-bar__controls">
            <span className="xe_player-bar__percent" aria-hidden="true" title="Percent elapsed">
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
            <span className="xe_player-bar__percent" aria-hidden="true" title="Percent remaining">
              {remainingLabel}
            </span>
          </div>
          <Scrubber />
        </div>

        <div className="xe_player-bar__volume">
          <div className="xe_automix-pill-wrap">
            <AutoMixDrawer />
            <button
              type="button"
              className={`xe_automix-pill${autoMixEnabled ? ' xe_automix-pill--on' : ''}${
                autoMixEnabled && autoMixColor ? ` xe_automix-pill--${autoMixColor}` : ''
              }${autoMixBusy ? ' xe_automix-pill--busy' : ''}${
                autoMixPhase === 'mixing' ? ' xe_automix-pill--mixing' : ''
              }`}
              onClick={toggleAutoMix}
              title={`Auto mix is ${autoMixLabel.toLowerCase()}`}
              aria-pressed={autoMixEnabled}
            >
              <AutoMixIcon size={14} />
              <span className="xe_automix-pill__label" title={`Auto mix is ${autoMixLabel.toLowerCase()}`}>
                {autoMixLabel}
              </span>
            </button>
          </div>
          <SleepTimerControl />
          {lastfm && (
            <button
              type="button"
              className={`xe_scrobble-pill xe_scrobble-pill--${scrobbleStatus}`}
              onClick={() => update({ scrobbleEnabled: !settings.scrobbleEnabled })}
              onContextMenu={(e) => {
                e.preventDefault();
                setScrobbleMenu({ x: e.clientX, y: e.clientY });
              }}
              title={
                settings.scrobbleEnabled
                  ? `Scrobbling to ${lastfm.username} - click to suspend`
                  : 'Scrobbling is suspended - click to resume'
              }
              aria-pressed={settings.scrobbleEnabled}
            >
              <LastfmIcon size={14} />
              <span className="xe_scrobble-pill__label">
                {SCROBBLE_STATUS_LABEL[scrobbleStatus]}
              </span>
            </button>
          )}
          <button
            type="button"
            className={`xe_icon-btn${settings.autoPlay ? ' xe_icon-btn--active' : ''}`}
            onClick={() => update({ autoPlay: !settings.autoPlay })}
            title={
              settings.autoPlay
                ? `Auto play is on (${AUTO_PLAY_LABELS[settings.autoPlayLevel].toLowerCase()}) - click to turn off`
                : 'Auto play is off - click to keep playing when the queue runs out'
            }
            aria-pressed={settings.autoPlay}
          >
            <AutoPlayIcon size={16} />
          </button>
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
      {scrobbleMenu && lastfm && (
        <ContextMenu
          x={scrobbleMenu.x}
          y={scrobbleMenu.y}
          items={scrobbleMenuItems}
          onClose={() => setScrobbleMenu(null)}
        />
      )}
    </>
  );
}
