import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { QueueItem, TrackMeta } from '../../../types';
import { initialQueue, makeItems, queueReducer } from '../../../queue/reducer';
import { intelligentShuffle, jumble } from '../../../queue/shuffle';
import { getRecentIds, pushRecent } from '../../../queue/history';
import { pickAutoPlayTrack } from '../../../queue/auto_play';
import { readCoverArt } from '../../../management/metadata';
import { useLibrary } from '../../../context/library_context';
import { useSettings } from '../../../context/settings_context';
import { clamp } from '../../../utils/format';
import { toast } from '../../../utils/toast';
import { usePlayerAudioGraph } from './audio_graph';
import { useAutoMix } from './auto_mix';
import {
  MAX_VOLUME,
  REMOTE_LOCK_MESSAGE,
  type PlayerContextValue,
  type RepeatMode
} from './types';
import {
  loadRepeat,
  loadVolume,
  saveRepeat,
  saveVolume
} from './storage';
import { useSleepTimer } from './sleep_timer';

const PlayerContext = createContext<PlayerContextValue | null>(null);
const DUCK_FACTOR = 0.25;
const DUCK_FADE_MS = 300;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { getFile, tracks: library } = useLibrary();
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const getFileRef = useRef(getFile);
  getFileRef.current = getFile;

  const { settings } = useSettings();
  const autoPlayRef = useRef(settings.autoPlay);
  autoPlayRef.current = settings.autoPlay;
  const autoPlayLevelRef = useRef(settings.autoPlayLevel);
  autoPlayLevelRef.current = settings.autoPlayLevel;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current;

  const [state, dispatch] = useReducer(queueReducer, initialQueue);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(loadVolume);
  const [ducking, setDucking] = useState(false);
  const duckingRef = useRef(ducking);
  duckingRef.current = ducking;
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(loadRepeat);
  const repeatRef = useRef(repeatMode);
  repeatRef.current = repeatMode;
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const autoplayRef = useRef(false);
  const srcUrlRef = useRef<string | null>(null);
  const artUrlRef = useRef<string | null>(null);

  const audioGraph = usePlayerAudioGraph(audio, volume, {
    enabled: settings.eqEnabled,
    bands: settings.eqBands,
    preamp: settings.eqPreamp,
    intensity: settings.eqIntensity
  });
  const {
    audioContextRef: audioCtxRef,
    mediaFadeGainRef: fadeGainARef,
    clearRateGlide,
    applyVolume,
    fadeVolumeTo,
    getAnalyser
  } = audioGraph;

  const [remoteLocked, setRemoteLockedState] = useState(false);
  const remoteLockedRef = useRef(remoteLocked);
  remoteLockedRef.current = remoteLocked;

  function autoPlayNext(): boolean {
    if (!autoPlayRef.current || remoteLockedRef.current) return false;
    const s = stateRef.current;
    const finished = s.items[s.position]?.track;
    if (!finished) return false;
    const pick = pickAutoPlayTrack(
      libraryRef.current,
      finished,
      autoPlayLevelRef.current,
      getRecentIds()
    );
    if (!pick) return false;
    autoplayRef.current = true;
    dispatch({ type: 'ENQUEUE_END', items: makeItems([pick]) });
    dispatch({ type: 'ADVANCE', delta: 1 });
    return true;
  }

  function refuseWhenLocked(): boolean {
    if (!remoteLockedRef.current) return false;
    toast.warning(REMOTE_LOCK_MESSAGE);
    return true;
  }

  const {
    remaining: sleepTimerRemaining,
    paused: sleepTimerPaused,
    finished: sleepTimerFinished,
    add: addSleepTimer,
    setMinutes: setSleepTimerMinutes,
    togglePaused: togglePauseSleepTimer,
    cancel: cancelSleepTimer,
    dismissFinished: dismissSleepTimerFinished
  } = useSleepTimer(audio);

  const current = state.items[state.position] ?? null;
  const currentKey = current?.key ?? null;
  const {
    enabled: autoMixEnabled,
    phase: autoMixPhase,
    color: autoMixColor,
    bpm: autoMixBpm,
    progress: autoMixProgress,
    presentation: autoMixPresentation,
    crossfadeActiveRef,
    cancelCrossfade,
    finishHandoff,
    handleTimeUpdate: handleAutoMixTimeUpdate,
    shouldHoldDuration: shouldAutoMixHoldDuration,
    beginHandoff: beginAutoMixHandoff,
    consumeHandoff: consumeAutoMixHandoff,
    clearPendingMix,
    completePresentation: completeAutoMixPresentation,
    toggle: toggleAutoMix
  } = useAutoMix({
    audio,
    audioGraph,
    current,
    getFile,
    queueRef: stateRef,
    repeatMode,
    transitionDuration: settings.autoMixDuration,
    setCurrentTime,
    setDuration
  });

  const presentedPosition = autoMixPresentation
    ? state.items.findIndex((item) => item.key === autoMixPresentation.key)
    : -1;
  const displayPosition = presentedPosition >= 0 ? presentedPosition : state.position;
  const displayCurrent = state.items[displayPosition] ?? null;
  const displayArtworkUrl =
    presentedPosition >= 0 && autoMixPresentation?.artworkReady
      ? autoMixPresentation.artworkUrl
      : artworkUrl;

  const [justPlayed, setJustPlayed] = useState<QueueItem | null>(null);
  const lastCurrentRef = useRef<QueueItem | null>(null);
  useEffect(() => {
    setJustPlayed(lastCurrentRef.current);
    lastCurrentRef.current = current;
  }, [currentKey]);

  useEffect(() => {
    const onTime = () => {
      const t = audio.currentTime;
      handleAutoMixTimeUpdate(t);
    };
    const onDuration = () => {
      if (shouldAutoMixHoldDuration()) return;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onPlay = () => {
      setIsPlaying(true);
      audioCtxRef.current?.resume().catch(() => {});
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onEnded = () => {
      const s = stateRef.current;
      if (beginAutoMixHandoff()) {
        autoplayRef.current = true;
        dispatch({ type: 'ADVANCE', delta: 1 });
        return;
      }
      if (crossfadeActiveRef.current) cancelCrossfade();
      if (s.position + 1 < s.items.length) {
        autoplayRef.current = true;
        dispatch({ type: 'ADVANCE', delta: 1 });
      } else if (repeatRef.current === 'all' && s.items.length > 0) {
        autoplayRef.current = true;
        if (s.position === 0) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          dispatch({ type: 'JUMP', index: 0 });
        }
      } else if (autoPlayNext()) {
        return;
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio]);

  useEffect(() => {
    if (!isPlaying || !settings.preventExit) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isPlaying, settings.preventExit]);

  useEffect(() => {
    fadeVolumeTo(volume * (ducking ? DUCK_FACTOR : 1), DUCK_FADE_MS);
    saveVolume(volume);
  }, [audio, volume, ducking]);

  useEffect(() => {
    audio.loop = repeatMode === 'one';
    saveRepeat(repeatMode);
  }, [audio, repeatMode]);

  useEffect(() => {
    setLoadError(null);
    if (!current) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current);
      srcUrlRef.current = null;
      artUrlRef.current = null;
      setArtworkUrl(null);
      return;
    }
    let cancelled = false;
    const track = current.track;
    (async () => {
      try {
        const file = await getFileRef.current(track);
        if (cancelled) return;
        const url = URL.createObjectURL(file);
        if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
        srcUrlRef.current = url;
        clearPendingMix();
        const handoff = consumeAutoMixHandoff();
        audio.src = url;

        if (handoff) {
          const { rate, position: bufferPosition } = handoff;
          const startMedia = () => {
            if (cancelled) return;
            clearRateGlide();
            audio.playbackRate = rate;
            audio.currentTime = bufferPosition();
            audioCtxRef.current?.resume().catch(() => {});
            audio.play().then(
              () => {
                if (cancelled) return;
                audio.currentTime = bufferPosition();
                finishHandoff(rate);
              },
              () => {
                if (!cancelled) finishHandoff(rate);
              }
            );
          };
          setCurrentTime(bufferPosition());
          if (audio.readyState >= 1) startMedia();
          else audio.addEventListener('loadedmetadata', startMedia, { once: true });
        } else {
          clearRateGlide();
          audio.playbackRate = 1;
          setCurrentTime(0);
          if (fadeGainARef.current && audioCtxRef.current) {
            fadeGainARef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
            fadeGainARef.current.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
          }
          if (autoplayRef.current) {
            audioCtxRef.current?.resume().catch(() => {});
            audio.play().catch(() => {});
          }
        }
        pushRecent(track.id);
        const art = await readCoverArt(file);
        if (cancelled) return;
        if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current);
        artUrlRef.current = art ? URL.createObjectURL(art) : null;
        setArtworkUrl(artUrlRef.current);
        completeAutoMixPresentation(current.key);
      } catch {
        if (!cancelled) {
          setLoadError(`Could not open ${track.title}`);
          completeAutoMixPresentation(current.key);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentKey]);

  const playNow = useCallback((tracks: TrackMeta[], startIndex = 0) => {
    if (refuseWhenLocked()) return;
    cancelCrossfade();
    autoplayRef.current = true;
    dispatch({ type: 'SET', items: makeItems(tracks), position: startIndex });
  }, []);

  const enqueueNext = useCallback((tracks: TrackMeta[]) => {
    if (refuseWhenLocked()) return;
    dispatch({ type: 'ENQUEUE_NEXT', items: makeItems(tracks) });
  }, []);

  const enqueueEnd = useCallback((tracks: TrackMeta[]) => {
    if (refuseWhenLocked()) return;
    dispatch({ type: 'ENQUEUE_END', items: makeItems(tracks) });
  }, []);

  const removeAt = useCallback(
    (index: number) => {
      if (remoteLockedRef.current) return;
      if (index === stateRef.current.position) autoplayRef.current = !audio.paused;
      dispatch({ type: 'REMOVE', index });
    },
    [audio]
  );

  const removeAbove = useCallback(
    (index: number) => {
      if (remoteLockedRef.current || index <= 0) return;
      if (stateRef.current.position < index) autoplayRef.current = !audio.paused;
      dispatch({ type: 'REMOVE_ABOVE', index });
    },
    [audio]
  );

  const removeBelow = useCallback(
    (index: number) => {
      if (remoteLockedRef.current || index >= stateRef.current.items.length - 1) return;
      if (stateRef.current.position > index) autoplayRef.current = !audio.paused;
      dispatch({ type: 'REMOVE_BELOW', index });
    },
    [audio]
  );

  const move = useCallback((from: number, to: number) => {
    if (remoteLockedRef.current) return;
    dispatch({ type: 'MOVE', from, to });
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      if (refuseWhenLocked()) return;
      cancelCrossfade();
      if (index === stateRef.current.position) {
        audio.currentTime = 0;
        audioCtxRef.current?.resume().catch(() => {});
        audio.play().catch(() => {});
        return;
      }
      autoplayRef.current = true;
      dispatch({ type: 'JUMP', index });
    },
    [audio]
  );

  const next = useCallback(() => {
    if (remoteLockedRef.current) return;
    cancelCrossfade();
    const s = stateRef.current;
    autoplayRef.current = !audio.paused;
    if (s.position + 1 >= s.items.length) {
      if (repeatRef.current !== 'off' && s.items.length > 0) {
        if (s.position === 0) {
          audio.currentTime = 0;
        } else {
          dispatch({ type: 'JUMP', index: 0 });
        }
      }
      return;
    }
    dispatch({ type: 'ADVANCE', delta: 1 });
  }, [audio]);

  const prev = useCallback(() => {
    if (remoteLockedRef.current) return;
    cancelCrossfade();
    if (audio.currentTime > 3 || stateRef.current.position <= 0) {
      audio.currentTime = 0;
      return;
    }
    autoplayRef.current = !audio.paused;
    dispatch({ type: 'ADVANCE', delta: -1 });
  }, [audio]);

  const togglePlay = useCallback(() => {
    if (refuseWhenLocked()) return;
    if (!stateRef.current.items[stateRef.current.position]) return;
    if (audio.paused) {
      audioCtxRef.current?.resume().catch(() => {});
      audio.play().catch(() => {});
    } else {
      audio.pause();
      if (crossfadeActiveRef.current) audioCtxRef.current?.suspend().catch(() => {});
    }
  }, [audio]);

  const seek = useCallback(
    (time: number) => {
      if (remoteLockedRef.current) return;
      cancelCrossfade();
      const target = clamp(time, 0, Number.isFinite(audio.duration) ? audio.duration : time);
      audio.currentTime = target;
      setCurrentTime(target);
    },
    [audio]
  );

  const toggleShuffle = useCallback(() => {
    if (remoteLockedRef.current) return;
    const s = stateRef.current;
    if (s.shuffled) {
      dispatch({ type: 'UNSHUFFLE' });
    } else {
      const upcoming = s.items.slice(s.position + 1);
      const shuffledUpcoming = intelligentShuffle(
        upcoming,
        (item) => ({ id: item.track.id, artist: item.track.artist }),
        getRecentIds()
      );
      dispatch({ type: 'APPLY_SHUFFLE', upcoming: shuffledUpcoming });
    }
  }, []);

  const jumbleQueue = useCallback(() => {
    if (remoteLockedRef.current) return;
    cancelCrossfade();
    dispatch({ type: 'JUMBLE', items: jumble(stateRef.current.items) });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = clamp(v, 0, MAX_VOLUME);
    applyVolume(clamped * (duckingRef.current ? DUCK_FACTOR : 1));
    audioCtxRef.current?.resume().catch(() => {});
    setVolumeState(clamped);
  }, []);

  const duckVolume = useCallback((duck: boolean) => {
    setDucking(duck);
  }, []);

  const cycleRepeat = useCallback(() => {
    if (remoteLockedRef.current) return;
    setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const clearQueue = useCallback(() => {
    cancelCrossfade();
    autoplayRef.current = false;
    dispatch({ type: 'CLEAR' });
  }, []);

  const clearOthers = useCallback(() => {
    if (remoteLockedRef.current) return;
    cancelCrossfade();
    dispatch({ type: 'KEEP_CURRENT' });
  }, []);

  const setRemoteLocked = useCallback(
    (locked: boolean) => {
      setRemoteLockedState(locked);
      remoteLockedRef.current = locked;
      if (!locked) return;
      cancelCrossfade();
      autoplayRef.current = false;
      audio.pause();
      dispatch({ type: 'CLEAR' });
    },
    [audio]
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue: state.items,
      position: displayPosition,
      current: displayCurrent,
      isPlaying,
      currentTime,
      duration,
      volume,
      shuffled: state.shuffled,
      repeatMode,
      artworkUrl: displayArtworkUrl,
      loadError,
      audioRef,
      justPlayed,
      playNow,
      enqueueNext,
      enqueueEnd,
      removeAt,
      removeAbove,
      removeBelow,
      move,
      jumpTo,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      duckVolume,
      toggleShuffle,
      jumbleQueue,
      cycleRepeat,
      clearQueue,
      clearOthers,
      getAnalyser,
      autoMixEnabled,
      autoMixPhase,
      autoMixColor,
      autoMixBpm,
      autoMixProgress,
      toggleAutoMix,
      sleepTimerRemaining,
      sleepTimerPaused,
      sleepTimerFinished,
      addSleepTimer,
      setSleepTimerMinutes,
      togglePauseSleepTimer,
      cancelSleepTimer,
      dismissSleepTimerFinished,
      remoteLocked,
      setRemoteLocked
    }),
    [
      state,
      displayPosition,
      displayCurrent,
      isPlaying,
      currentTime,
      duration,
      volume,
      repeatMode,
      displayArtworkUrl,
      loadError,
      justPlayed,
      playNow,
      enqueueNext,
      enqueueEnd,
      removeAt,
      removeAbove,
      removeBelow,
      move,
      jumpTo,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      duckVolume,
      toggleShuffle,
      jumbleQueue,
      cycleRepeat,
      clearQueue,
      clearOthers,
      getAnalyser,
      autoMixEnabled,
      autoMixPhase,
      autoMixColor,
      autoMixBpm,
      autoMixProgress,
      toggleAutoMix,
      sleepTimerRemaining,
      sleepTimerPaused,
      sleepTimerFinished,
      addSleepTimer,
      setSleepTimerMinutes,
      togglePauseSleepTimer,
      cancelSleepTimer,
      dismissSleepTimerFinished,
      remoteLocked,
      setRemoteLocked
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
