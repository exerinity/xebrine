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
import { intelligentShuffle, jumble } from '../queue/shuffle';
import { getRecentIds, pushRecent } from '../queue/history';
import { pickAutoPlayTrack } from '../queue/auto_play';
import { readCoverArt } from '../management/metadata';
import { useLibrary } from './library_context';
import { useSettings } from './settings_context';
import { clamp } from '../utils/format';
import {
  analyzeTrack,
  classifyBpmDiff,
  planCrossfade,
  equalPowerFadeCurves,
  type TrackAnalysis
} from '../audio/bpm';
import { toast } from '../utils/toast';
import {
  EQ_BANDS,
  EQ_Q,
  dbToGain,
  normalizeBands,
  normalizeIntensity,
  normalizePreamp
} from '../audio/eq';

export type RepeatMode = 'off' | 'all' | 'one';
export type AutoMixPhase = 'idle' | 'analyzing-current' | 'analyzing-next' | 'mixing' | 'switching';
export type AutoMixColor = 'green' | 'orange' | 'red' | null;

const FADE_CURVES = equalPowerFadeCurves(64);
const MEDIA_LATENCY = 0.0;

export interface PlayerContextValue {
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
  justPlayed: QueueItem | null;
  playNow(tracks: TrackMeta[], startIndex?: number): void;
  enqueueNext(tracks: TrackMeta[]): void;
  enqueueEnd(tracks: TrackMeta[]): void;
  removeAt(index: number): void;
  removeAbove(index: number): void;
  removeBelow(index: number): void;
  move(from: number, to: number): void;
  jumpTo(index: number): void;
  next(): void;
  prev(): void;
  togglePlay(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  duckVolume(ducking: boolean): void;
  toggleShuffle(): void;
  jumbleQueue(): void;
  cycleRepeat(): void;
  clearQueue(): void;
  clearOthers(): void;
  getAnalyser(): AnalyserNode;
  autoMixEnabled: boolean;
  autoMixPhase: AutoMixPhase;
  autoMixColor: AutoMixColor;
  toggleAutoMix(): void;
  sleepTimerRemaining: number;
  sleepTimerPaused: boolean;
  addSleepTimer(minutes: number): void;
  setSleepTimerMinutes(minutes: number): void;
  togglePauseSleepTimer(): void;
  cancelSleepTimer(): void;
  remoteLocked: boolean;
  setRemoteLocked(locked: boolean): void;
}

export const REMOTE_LOCK_MESSAGE = 'Playback disabled during remote controlling';

const PlayerContext = createContext<PlayerContextValue | null>(null);

const VOLUME_KEY = 'xebrine.volume';
const REPEAT_KEY = 'xebrine.repeat';
const AUTOMIX_KEY = 'xebrine.automix';

export const MAX_VOLUME = 1.5;
const DUCK_FACTOR = 0.25;
const DUCK_FADE_MS = 300;
const MAX_SLEEP_TIMER_SECONDS = 12 * 60 * 60;

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  const v = raw === null ? NaN : parseFloat(raw);
  return Number.isFinite(v) ? clamp(v, 0, MAX_VOLUME) : 1;
}

function loadRepeat(): RepeatMode {
  const raw = localStorage.getItem(REPEAT_KEY);
  return raw === 'all' || raw === 'one' ? raw : 'off';
}

function loadAutoMix(): boolean {
  return localStorage.getItem(AUTOMIX_KEY) === '1';
}

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
  const autoMixDurationRef = useRef(settings.autoMixDuration);
  autoMixDurationRef.current = settings.autoMixDuration;

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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const volumeFadeFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fadeGainARef = useRef<GainNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[] | null>(null);
  const eqPreampRef = useRef<GainNode | null>(null);

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

  const [sleepTimerEndAt, setSleepTimerEndAt] = useState<number | null>(null);
  const [sleepTimerPausedRemaining, setSleepTimerPausedRemaining] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const sleepTimerEndAtRef = useRef<number | null>(null);
  sleepTimerEndAtRef.current = sleepTimerEndAt;
  const sleepTimerPausedRemainingRef = useRef<number | null>(null);
  sleepTimerPausedRemainingRef.current = sleepTimerPausedRemaining;
  const sleepTimerPaused = sleepTimerPausedRemaining !== null;

  const [autoMixEnabled, setAutoMixEnabledState] = useState(loadAutoMix);
  const autoMixEnabledRef = useRef(autoMixEnabled);
  autoMixEnabledRef.current = autoMixEnabled;
  const [autoMixPhase, setAutoMixPhase] = useState<AutoMixPhase>('idle');
  const [autoMixColor, setAutoMixColor] = useState<AutoMixColor>(null);
  const pendingMixRef = useRef<{
    key: string;
    outgoing: TrackAnalysis;
    incoming: TrackAnalysis;
    status: 'green' | 'orange' | 'red';
  } | null>(null);
  const crossfadeActiveRef = useRef(false);
  const mixSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mixFadeGainRef = useRef<GainNode | null>(null);
  const mixStartCtxTimeRef = useRef(0);
  const mixStartOffsetRef = useRef(0);
  const mixRateRef = useRef(1);
  const handoffPendingRef = useRef(false);
  const preloadedBufferRef = useRef<{ key: string; buffer: AudioBuffer } | null>(null);
  const preloadingKeyRef = useRef<string | null>(null);
  const rateGlideRef = useRef<number | null>(null);

  function ensureAudioGraph(): { gain: GainNode; analyser: AnalyserNode } {
    if (gainNodeRef.current && analyserRef.current) {
      return { gain: gainNodeRef.current, analyser: analyserRef.current };
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const fadeGainA = ctx.createGain();
    fadeGainA.gain.value = 1;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    const eqPreamp = ctx.createGain();
    eqPreamp.gain.value = 1;

    const eqFilters = EQ_BANDS.map((freq) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = EQ_Q;
      filter.gain.value = 0;
      return filter;
    });

    source.connect(fadeGainA);
    fadeGainA.connect(gain);
    gain.connect(eqPreamp);
    let tail: AudioNode = eqPreamp;
    for (const filter of eqFilters) {
      tail.connect(filter);
      tail = filter;
    }
    tail.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    fadeGainARef.current = fadeGainA;
    gainNodeRef.current = gain;
    analyserRef.current = analyser;
    eqFiltersRef.current = eqFilters;
    eqPreampRef.current = eqPreamp;
    return { gain, analyser };
  }

  function ensureMixBus(): GainNode {
    const { gain: masterGain } = ensureAudioGraph();
    if (mixFadeGainRef.current) return mixFadeGainRef.current;
    const ctx = audioCtxRef.current!;
    const fadeGain = ctx.createGain();
    fadeGain.gain.value = 0;
    fadeGain.connect(masterGain);
    mixFadeGainRef.current = fadeGain;
    return fadeGain;
  }

  function clearRateGlide() {
    if (rateGlideRef.current !== null) {
      window.clearInterval(rateGlideRef.current);
      rateGlideRef.current = null;
    }
  }

  function glidePlaybackRateToUnity(from: number) {
    clearRateGlide();
    if (!(from > 0) || Math.abs(from - 1) < 1e-3) {
      audio.playbackRate = 1;
      return;
    }
    const steps = 30;
    let i = 0;
    audio.playbackRate = from;
    rateGlideRef.current = window.setInterval(() => {
      i++;
      const x = i / steps;
      const eased = 1 - (1 - x) * (1 - x);
      audio.playbackRate = i >= steps ? 1 : from + (1 - from) * eased;
      if (i >= steps) clearRateGlide();
    }, 50);
  }

  function cancelCrossfade() {
    clearRateGlide();
    audio.playbackRate = 1;
    if (!crossfadeActiveRef.current) return;
    crossfadeActiveRef.current = false;
    handoffPendingRef.current = false;
    setAutoMixPhase('idle');
    const ctx = audioCtxRef.current;
    if (ctx && fadeGainARef.current) {
      fadeGainARef.current.gain.cancelScheduledValues(ctx.currentTime);
      fadeGainARef.current.gain.setValueAtTime(1, ctx.currentTime);
    }
    if (mixSourceRef.current) {
      try {
        mixSourceRef.current.stop();
      } catch {
        null;
      }
      mixSourceRef.current.disconnect();
      mixSourceRef.current = null;
    }
    if (ctx && mixFadeGainRef.current) {
      mixFadeGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      mixFadeGainRef.current.gain.setValueAtTime(0, ctx.currentTime);
    }
  }

  function finishHandoff(handoffRate = 1) {
    const ctx = audioCtxRef.current;
    const src = mixSourceRef.current;
    const fadeGainA = fadeGainARef.current;
    const mixFadeGain = mixFadeGainRef.current;
    if (!ctx || !src) {
      crossfadeActiveRef.current = false;
      handoffPendingRef.current = false;
      setAutoMixPhase('idle');
      return;
    }
    const now = ctx.currentTime;
    const SWAP = 0.12;
    if (fadeGainA) {
      fadeGainA.gain.cancelScheduledValues(now);
      fadeGainA.gain.setValueAtTime(fadeGainA.gain.value, now);
      fadeGainA.gain.linearRampToValueAtTime(1, now + SWAP);
    }
    if (mixFadeGain) {
      mixFadeGain.gain.cancelScheduledValues(now);
      mixFadeGain.gain.setValueAtTime(mixFadeGain.gain.value, now);
      mixFadeGain.gain.linearRampToValueAtTime(0, now + SWAP);
    }
    try {
      src.stop(now + SWAP + 0.03);
    } catch {
      null;
    }
    window.setTimeout(
      () => {
        if (mixSourceRef.current === src) {
          try {
            src.disconnect();
          } catch {
            null;
          }
          mixSourceRef.current = null;
          if (mixFadeGain) mixFadeGain.gain.value = 0;
          crossfadeActiveRef.current = false;
          handoffPendingRef.current = false;
          setAutoMixPhase('idle');
          glidePlaybackRateToUnity(handoffRate);
        }
      },
      (SWAP + 0.06) * 1000
    );
  }

  async function preloadMixBuffer(nextItem: QueueItem) {
    if (preloadingKeyRef.current === nextItem.key) return;
    if (preloadedBufferRef.current?.key === nextItem.key) return;
    preloadingKeyRef.current = nextItem.key;
    try {
      ensureAudioGraph();
      const ctx = audioCtxRef.current!;
      const file = await getFileRef.current(nextItem.track);
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      preloadedBufferRef.current = { key: nextItem.key, buffer };
    } catch {
      null;
    } finally {
      preloadingKeyRef.current = null;
    }
  }

  async function startCrossfade(
    nextItem: QueueItem,
    requestedFade: number,
    mix: { outgoing: TrackAnalysis; incoming: TrackAnalysis; status: 'green' | 'orange' | 'red' }
  ) {
    crossfadeActiveRef.current = true;
    setAutoMixPhase('mixing');
    try {
      const mixFadeGain = ensureMixBus();
      const ctx = audioCtxRef.current!;
      await ctx.resume().catch(() => {});

      let audioBuffer: AudioBuffer;
      const preloaded = preloadedBufferRef.current;
      if (preloaded && preloaded.key === nextItem.key) {
        audioBuffer = preloaded.buffer;
        preloadedBufferRef.current = null;
      } else {
        const file = await getFileRef.current(nextItem.track);
        if (!crossfadeActiveRef.current) return;
        audioBuffer = await ctx.decodeAudioData(await file.arrayBuffer());
        if (!crossfadeActiveRef.current) return;
      }

      const lead = 0.06;
      const startWhen = ctx.currentTime + lead;
      const outgoingPosAtStart = audio.currentTime + lead - MEDIA_LATENCY;
      const plan = planCrossfade(
        mix.outgoing,
        mix.incoming,
        outgoingPosAtStart,
        requestedFade,
        mix.status !== 'red'
      );

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = plan.playbackRate;
      source.connect(mixFadeGain);
      mixSourceRef.current = source;
      mixStartCtxTimeRef.current = startWhen;
      mixStartOffsetRef.current = plan.incomingOffset;
      mixRateRef.current = plan.playbackRate;
      source.start(startWhen, plan.incomingOffset);

      const fadeGainA = fadeGainARef.current!;
      fadeGainA.gain.cancelScheduledValues(startWhen);
      fadeGainA.gain.setValueCurveAtTime(FADE_CURVES.fadeOut, startWhen, plan.fadeSeconds);
      mixFadeGain.gain.cancelScheduledValues(startWhen);
      mixFadeGain.gain.setValueCurveAtTime(FADE_CURVES.fadeIn, startWhen, plan.fadeSeconds);
    } catch (err) {
      console.error('Auto mix crossfade failed', err);
      crossfadeActiveRef.current = false;
      setAutoMixPhase('idle');
    }
  }

  function cancelVolumeFade() {
    if (volumeFadeFrameRef.current !== null) {
      cancelAnimationFrame(volumeFadeFrameRef.current);
      volumeFadeFrameRef.current = null;
    }
    const gain = gainNodeRef.current;
    const ctx = audioCtxRef.current;
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    }
  }

  function applyVolume(v: number) {
    cancelVolumeFade();
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

  function fadeVolumeTo(target: number, durationMs: number) {
    cancelVolumeFade();
    if (durationMs <= 0) {
      applyVolume(target);
      return;
    }

    if (gainNodeRef.current) {
      const gain = gainNodeRef.current;
      const ctx = audioCtxRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
        return;
      }
      gain.gain.value = target;
      return;
    }

    if (target > 1) {
      audio.volume = 1;
      const { gain } = ensureAudioGraph();
      const ctx = audioCtxRef.current!;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(1, now);
      gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
      return;
    }

    const start = audio.volume;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = clamp((now - startTime) / durationMs, 0, 1);
      audio.volume = start + (target - start) * t;
      if (t < 1) {
        volumeFadeFrameRef.current = requestAnimationFrame(step);
      } else {
        volumeFadeFrameRef.current = null;
      }
    };
    volumeFadeFrameRef.current = requestAnimationFrame(step);
  }

  const getAnalyser = useCallback(() => {
    const { analyser } = ensureAudioGraph();
    audioCtxRef.current?.resume().catch(() => {});
    return analyser;
  }, [volume]);

  const current = state.items[state.position] ?? null;
  const currentKey = current?.key ?? null;
  const nextKey = state.items[state.position + 1]?.key ?? null;

  const [justPlayed, setJustPlayed] = useState<QueueItem | null>(null);
  const lastCurrentRef = useRef<QueueItem | null>(null);
  useEffect(() => {
    setJustPlayed(lastCurrentRef.current);
    lastCurrentRef.current = current;
  }, [currentKey]);

  useEffect(() => {
    const onTime = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      if (autoMixEnabledRef.current && !crossfadeActiveRef.current && repeatRef.current !== 'one') {
        const s = stateRef.current;
        const nextItem = s.items[s.position + 1];
        const dur = audio.duration;
        const fadeSeconds = autoMixDurationRef.current;
        const mix = pendingMixRef.current;
        if (nextItem && mix && mix.key === nextItem.key && Number.isFinite(dur) && dur > fadeSeconds) {
          if (dur - t <= fadeSeconds + 6) void preloadMixBuffer(nextItem);
          if (dur - t <= fadeSeconds) void startCrossfade(nextItem, fadeSeconds, mix);
        }
      }
    };
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setIsPlaying(true);
      audioCtxRef.current?.resume().catch(() => {});
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onEnded = () => {
      const s = stateRef.current;
      if (crossfadeActiveRef.current && mixSourceRef.current && s.position + 1 < s.items.length) {
        handoffPendingRef.current = true;
        autoplayRef.current = true;
        setAutoMixPhase('switching');
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
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      null;
    }
  }, [audio, volume, ducking]);

  useEffect(() => {
    audio.loop = repeatMode === 'one';
    try {
      localStorage.setItem(REPEAT_KEY, repeatMode);
    } catch {
      null;
    }
  }, [audio, repeatMode]);

  useEffect(() => {
    if (sleepTimerEndAt === null) return;
    const tick = () => {
      const endAt = sleepTimerEndAtRef.current;
      if (endAt === null) return;
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        audio.pause();
        setSleepTimerEndAt(null);
        toast.info('Sleep timer elapsed, playback paused');
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndAt, audio]);

  useEffect(() => {
    const bands = normalizeBands(settings.eqBands);
    const intensity = normalizeIntensity(settings.eqIntensity);
    const preampDb = normalizePreamp(settings.eqPreamp);
    const active = settings.eqEnabled && (bands.some((v) => v !== 0) || preampDb !== 0);
    if (!active && !eqFiltersRef.current) return;
    ensureAudioGraph();
    const ctx = audioCtxRef.current!;
    const filters = eqFiltersRef.current!;
    filters.forEach((filter, i) => {
      const target = active ? bands[i] * intensity : 0;
      filter.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
    });
    eqPreampRef.current!.gain.setTargetAtTime(
      active ? dbToGain(preampDb) : 1,
      ctx.currentTime,
      0.02
    );
  }, [settings.eqEnabled, settings.eqBands, settings.eqIntensity, settings.eqPreamp]);

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
        pendingMixRef.current = null;
        const isHandoff = handoffPendingRef.current;
        handoffPendingRef.current = false;
        audio.src = url;

        if (isHandoff && mixSourceRef.current && audioCtxRef.current) {
          const ctx = audioCtxRef.current;
          const rate = mixRateRef.current > 0 ? mixRateRef.current : 1;
          const bufferPos = () =>
            Math.max(
              0,
              mixStartOffsetRef.current + rate * (ctx.currentTime - mixStartCtxTimeRef.current)
            );
          const startMedia = () => {
            if (cancelled) return;
            clearRateGlide();
            audio.playbackRate = rate;
            audio.currentTime = bufferPos();
            audioCtxRef.current?.resume().catch(() => {});
            audio.play().then(
              () => {
                if (cancelled) return;
                audio.currentTime = bufferPos();
                finishHandoff(rate);
              },
              () => {
                if (!cancelled) finishHandoff(rate);
              }
            );
          };
          setCurrentTime(bufferPos());
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

  useEffect(() => {
    preloadedBufferRef.current = null;
    if (!autoMixEnabled || !current) {
      setAutoMixPhase('idle');
      setAutoMixColor(null);
      return;
    }
    const s = stateRef.current;
    const nextItem = s.items[s.position + 1];
    if (!nextItem) {
      setAutoMixPhase('idle');
      setAutoMixColor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setAutoMixPhase('analyzing-current');
        const curFile = await getFileRef.current(current.track);
        const curAnalysis = await analyzeTrack(current.track.id, curFile);
        if (cancelled) return;

        setAutoMixPhase('analyzing-next');
        const nextFile = await getFileRef.current(nextItem.track);
        const nextAnalysis = await analyzeTrack(nextItem.track.id, nextFile);
        if (cancelled) return;

        const status = classifyBpmDiff(curAnalysis.bpm, nextAnalysis.bpm);
        pendingMixRef.current = {
          key: nextItem.key,
          outgoing: curAnalysis,
          incoming: nextAnalysis,
          status
        };
        setAutoMixColor(status);
        setAutoMixPhase('idle');
        toast.info(
          `auto mix: ${curAnalysis.bpm} BPM (${Math.round(curAnalysis.confidence * 100)}%) -> ` +
            `${nextAnalysis.bpm} BPM (${Math.round(nextAnalysis.confidence * 100)}%)`
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setAutoMixPhase('idle');
          setAutoMixColor(null);
          const reason = err instanceof Error ? err.message : String(err);
          toast.error(`bpm was not analyzed (${reason})`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentKey, nextKey, autoMixEnabled, current]);

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

  const currentSleepTimerSeconds = () => {
    if (sleepTimerPausedRemainingRef.current !== null) return sleepTimerPausedRemainingRef.current;
    if (sleepTimerEndAtRef.current !== null) {
      return Math.max(0, Math.round((sleepTimerEndAtRef.current - Date.now()) / 1000));
    }
    return 0;
  };

  const addSleepTimer = useCallback((minutes: number) => {
    const seconds = clamp(currentSleepTimerSeconds() + minutes * 60, 0, MAX_SLEEP_TIMER_SECONDS);
    setSleepTimerPausedRemaining(null);
    setSleepTimerEndAt(Date.now() + seconds * 1000);
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: number) => {
    const seconds = clamp(Math.round(minutes * 60), 0, MAX_SLEEP_TIMER_SECONDS);
    setSleepTimerPausedRemaining(null);
    if (seconds <= 0) {
      setSleepTimerEndAt(null);
      setSleepTimerRemaining(0);
      return;
    }
    setSleepTimerEndAt(Date.now() + seconds * 1000);
  }, []);

  const togglePauseSleepTimer = useCallback(() => {
    if (sleepTimerPausedRemainingRef.current !== null) {
      const seconds = sleepTimerPausedRemainingRef.current;
      setSleepTimerPausedRemaining(null);
      setSleepTimerEndAt(Date.now() + seconds * 1000);
      return;
    }
    if (sleepTimerEndAtRef.current !== null) {
      const seconds = Math.max(0, Math.round((sleepTimerEndAtRef.current - Date.now()) / 1000));
      setSleepTimerEndAt(null);
      setSleepTimerPausedRemaining(seconds);
      setSleepTimerRemaining(seconds);
    }
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerEndAt(null);
    setSleepTimerPausedRemaining(null);
    setSleepTimerRemaining(0);
  }, []);

  const toggleAutoMix = useCallback(() => {
    setAutoMixEnabledState((on) => {
      const next = !on;
      if (!next) cancelCrossfade();
      try {
        localStorage.setItem(AUTOMIX_KEY, next ? '1' : '0');
      } catch {
        null;
      }
      return next;
    });
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
      toggleAutoMix,
      sleepTimerRemaining,
      sleepTimerPaused,
      addSleepTimer,
      setSleepTimerMinutes,
      togglePauseSleepTimer,
      cancelSleepTimer,
      remoteLocked,
      setRemoteLocked
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
      toggleAutoMix,
      sleepTimerRemaining,
      sleepTimerPaused,
      addSleepTimer,
      setSleepTimerMinutes,
      togglePauseSleepTimer,
      cancelSleepTimer,
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
