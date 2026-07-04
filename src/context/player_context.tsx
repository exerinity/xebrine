import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react';
import type { QueueItem, TrackMeta } from '../types';
import { initialQueue, makeItems, queueReducer } from '../queue/reducer';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds, pushRecent } from '../queue/history';
import { readCoverArt } from '../management/metadata';
import { useLibrary } from './library_context';
import { clamp } from '../utils/format';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextValue {
  queue: QueueItem[];
  position: number;
  current: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffled: boolean;
  repeatMode: RepeatMode;
  artworkUrl: string | null;
  loadError: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  playNow(tracks: TrackMeta[], startIndex?: number): void;
  enqueueNext(tracks: TrackMeta[]): void;
  enqueueEnd(tracks: TrackMeta[]): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  jumpTo(index: number): void;
  next(): void;
  prev(): void;
  togglePlay(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  clearQueue(): void;
  getAnalyser(): AnalyserNode;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const VOLUME_KEY = 'xebrine.volume';
const REPEAT_KEY = 'xebrine.repeat';

export const MAX_VOLUME = 1.5;

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  const v = raw === null ? NaN : parseFloat(raw);
  return Number.isFinite(v) ? clamp(v, 0, MAX_VOLUME) : 0.8;
}

function loadRepeat(): RepeatMode {
  const raw = localStorage.getItem(REPEAT_KEY);
  return raw === 'all' || raw === 'one' ? raw : 'off';
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { getFile } = useLibrary();
  const getFileRef = useRef(getFile);
  getFileRef.current = getFile;

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
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(loadRepeat);
  const repeatRef = useRef(repeatMode);
  repeatRef.current = repeatMode;
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const autoplayRef = useRef(false);
  const srcUrlRef = useRef<string | null>(null);
  const artUrlRef = useRef<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  function ensureAudioGraph(): { gain: GainNode; analyser: AnalyserNode } {
    if (gainNodeRef.current && analyserRef.current) {
      return { gain: gainNodeRef.current, analyser: analyserRef.current };
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    gainNodeRef.current = gain;
    analyserRef.current = analyser;
    return { gain, analyser };
  }

  function applyVolume(v: number) {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
      return;
    }
    if (v <= 1) {
      audio.volume = v;
      return;
    }
    audio.volume = 1;
    ensureAudioGraph().gain.gain.value = v;
  }

  const getAnalyser = useCallback(() => {
    const { analyser } = ensureAudioGraph();
    audioCtxRef.current?.resume().catch(() => {});
    return analyser;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  const current = state.items[state.position] ?? null;
  const currentKey = current?.key ?? null;

  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const s = stateRef.current;
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
    if (!isPlaying) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isPlaying]);

  useEffect(() => {
    applyVolume(volume);
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      null;
    }
  }, [audio, volume]);

  useEffect(() => {
    audio.loop = repeatMode === 'one';
    try {
      localStorage.setItem(REPEAT_KEY, repeatMode);
    } catch {
      null;
    }
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
        audio.src = url;
        setCurrentTime(0);
        if (autoplayRef.current) {
          audio.play().catch(() => {});
        }
        pushRecent(track.id);
        const art = await readCoverArt(file);
        if (cancelled) return;
        if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current);
        artUrlRef.current = art ? URL.createObjectURL(art) : null;
        setArtworkUrl(artUrlRef.current);
      } catch {
        if (!cancelled) {
          setLoadError(`Could not open ${track.title}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentKey]);

  const playNow = useCallback((tracks: TrackMeta[], startIndex = 0) => {
    autoplayRef.current = true;
    dispatch({ type: 'SET', items: makeItems(tracks), position: startIndex });
  }, []);

  const enqueueNext = useCallback((tracks: TrackMeta[]) => {
    dispatch({ type: 'ENQUEUE_NEXT', items: makeItems(tracks) });
  }, []);

  const enqueueEnd = useCallback((tracks: TrackMeta[]) => {
    dispatch({ type: 'ENQUEUE_END', items: makeItems(tracks) });
  }, []);

  const removeAt = useCallback(
    (index: number) => {
      if (index === stateRef.current.position) autoplayRef.current = !audio.paused;
      dispatch({ type: 'REMOVE', index });
    },
    [audio]
  );

  const move = useCallback((from: number, to: number) => {
    dispatch({ type: 'MOVE', from, to });
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
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
    if (audio.currentTime > 3 || stateRef.current.position <= 0) {
      audio.currentTime = 0;
      return;
    }
    autoplayRef.current = !audio.paused;
    dispatch({ type: 'ADVANCE', delta: -1 });
  }, [audio]);

  const togglePlay = useCallback(() => {
    if (!stateRef.current.items[stateRef.current.position]) return;
    if (audio.paused) {
      audioCtxRef.current?.resume().catch(() => {});
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [audio]);

  const seek = useCallback(
    (time: number) => {
      const target = clamp(time, 0, Number.isFinite(audio.duration) ? audio.duration : time);
      audio.currentTime = target;
      setCurrentTime(target);
    },
    [audio]
  );

  const toggleShuffle = useCallback(() => {
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

  const setVolume = useCallback((v: number) => {
    const clamped = clamp(v, 0, MAX_VOLUME);
    applyVolume(clamped);
    audioCtxRef.current?.resume().catch(() => {});
    setVolumeState(clamped);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const clearQueue = useCallback(() => {
    autoplayRef.current = false;
    dispatch({ type: 'CLEAR' });
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue: state.items,
      position: state.position,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      shuffled: state.shuffled,
      repeatMode,
      artworkUrl,
      loadError,
      audioRef,
      playNow,
      enqueueNext,
      enqueueEnd,
      removeAt,
      move,
      jumpTo,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      clearQueue,
      getAnalyser
    }),
    [
      state,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      repeatMode,
      artworkUrl,
      loadError,
      playNow,
      enqueueNext,
      enqueueEnd,
      removeAt,
      move,
      jumpTo,
      next,
      prev,
      togglePlay,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      clearQueue,
      getAnalyser
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
