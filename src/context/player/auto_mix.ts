import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from 'react';
import {
  analyze_track,
  classify_bpm_diff,
  equal_power_fade_curves,
  plan_crossfade,
  type TrackAnalysis
} from '../../../audio/bpm';
import { readCoverArt } from '../../../management/metadata';
import type { QueueItem, TrackMeta } from '../../../types';
import { toast } from '../../../utils/toast';
import type { PlayerAudioGraph } from './audio_graph';
import { loadAutoMix, saveAutoMix } from './storage';
import type { AutoMixBpm, AutoMixColor, AutoMixPhase, RepeatMode } from './types';

const FADE_CURVES = equal_power_fade_curves(64);
const MEDIA_LATENCY = 0;

interface QueueSnapshot {
  items: QueueItem[];
  position: number;
}

export interface AutoMixPresentation {
  key: string;
  artworkReady: boolean;
  artworkUrl: string | null;
}

interface UseAutoMixOptions {
  audio: HTMLAudioElement;
  audioGraph: PlayerAudioGraph;
  current: QueueItem | null;
  getFile(track: TrackMeta): Promise<File>;
  queueRef: RefObject<QueueSnapshot>;
  repeatMode: RepeatMode;
  transitionDuration: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setDuration: Dispatch<SetStateAction<number>>;
}

export function useAutoMix({
  audio,
  audioGraph,
  current,
  getFile,
  queueRef,
  repeatMode,
  transitionDuration,
  setCurrentTime,
  setDuration
}: UseAutoMixOptions) {
  const {
    audioContextRef,
    mediaFadeGainRef,
    mixFadeGainRef,
    ensureGraph,
    ensureMixBus,
    clearRateGlide,
    glidePlaybackRateToUnity
  } = audioGraph;
  const getFileRef = useRef(getFile);
  getFileRef.current = getFile;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const transitionDurationRef = useRef(transitionDuration);
  transitionDurationRef.current = transitionDuration;

  const [enabled, setEnabled] = useState(loadAutoMix);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [phase, setPhase] = useState<AutoMixPhase>('idle');
  const [color, setColor] = useState<AutoMixColor>(null);
  const [bpm, setBpm] = useState<AutoMixBpm | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [presentation, setPresentation] = useState<AutoMixPresentation | null>(null);
  const presentationRef = useRef<AutoMixPresentation | null>(null);
  const preparedArtworkRef = useRef<AutoMixPresentation | null>(null);
  const pendingMixRef = useRef<{
    key: string;
    outgoing: TrackAnalysis;
    incoming: TrackAnalysis;
    status: 'green' | 'orange' | 'red';
  } | null>(null);
  const crossfadeActiveRef = useRef(false);
  const mixSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mixStartContextTimeRef = useRef(0);
  const mixStartOffsetRef = useRef(0);
  const mixRateRef = useRef(1);
  const mixFadeDurationRef = useRef(0);
  const handoffPendingRef = useRef(false);
  const preloadedBufferRef = useRef<{ key: string; buffer: AudioBuffer } | null>(null);
  const preloadingKeyRef = useRef<string | null>(null);
  const crossfadeTargetKeyRef = useRef<string | null>(null);
  const midpointTimerRef = useRef<number | null>(null);

  const setPresentedTrack = useCallback((next: AutoMixPresentation | null) => {
    presentationRef.current = next;
    setPresentation(next);
  }, []);

  const clearMidpointTimer = useCallback(() => {
    if (midpointTimerRef.current === null) return;
    window.clearInterval(midpointTimerRef.current);
    midpointTimerRef.current = null;
  }, []);

  const clearPreparedArtwork = useCallback(() => {
    const prepared = preparedArtworkRef.current;
    if (prepared?.artworkUrl) URL.revokeObjectURL(prepared.artworkUrl);
    preparedArtworkRef.current = null;
  }, []);

  const clearPresentation = useCallback(
    (resetTiming = false) => {
      const hadPresentation = presentationRef.current !== null;
      setPresentedTrack(null);
      clearPreparedArtwork();
      if (resetTiming && hadPresentation) {
        setCurrentTime(audio.currentTime);
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      }
    },
    [audio, clearPreparedArtwork, setCurrentTime, setDuration, setPresentedTrack]
  );

  useEffect(
    () => () => {
      if (midpointTimerRef.current !== null) window.clearInterval(midpointTimerRef.current);
      const prepared = preparedArtworkRef.current;
      if (prepared?.artworkUrl) URL.revokeObjectURL(prepared.artworkUrl);
    },
    []
  );

  const prepareArtwork = useCallback(
    (nextItem: QueueItem) => {
      clearPreparedArtwork();
      const prepared: AutoMixPresentation = {
        key: nextItem.key,
        artworkReady: false,
        artworkUrl: null
      };
      preparedArtworkRef.current = prepared;

      void (async () => {
        try {
          const file = await getFileRef.current(nextItem.track);
          const artwork = await readCoverArt(file);
          if (preparedArtworkRef.current !== prepared) return;
          prepared.artworkReady = true;
          prepared.artworkUrl = artwork ? URL.createObjectURL(artwork) : null;
          if (presentationRef.current?.key === prepared.key) {
            setPresentedTrack({ ...prepared });
          }
        } catch {
          if (preparedArtworkRef.current !== prepared) return;
          prepared.artworkReady = true;
          if (presentationRef.current?.key === prepared.key) {
            setPresentedTrack({ ...prepared });
          }
        }
      })();
    },
    [clearPreparedArtwork, setPresentedTrack]
  );

  const cancelCrossfade = useCallback(() => {
    clearRateGlide();
    audio.playbackRate = 1;
    clearMidpointTimer();
    crossfadeTargetKeyRef.current = null;
    clearPresentation(true);
    setProgress(null);
    mixStartContextTimeRef.current = 0;
    mixFadeDurationRef.current = 0;
    if (!crossfadeActiveRef.current) return;
    crossfadeActiveRef.current = false;
    handoffPendingRef.current = false;
    setPhase('idle');
    const context = audioContextRef.current;
    if (context && mediaFadeGainRef.current) {
      mediaFadeGainRef.current.gain.cancelScheduledValues(context.currentTime);
      mediaFadeGainRef.current.gain.setValueAtTime(1, context.currentTime);
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
    if (context && mixFadeGainRef.current) {
      mixFadeGainRef.current.gain.cancelScheduledValues(context.currentTime);
      mixFadeGainRef.current.gain.setValueAtTime(0, context.currentTime);
    }
  }, [audio, audioContextRef, clearMidpointTimer, clearPresentation, clearRateGlide, mediaFadeGainRef, mixFadeGainRef]);

  const scheduleMidpoint = useCallback(
    (nextItem: QueueItem, startTime: number, fadeSeconds: number) => {
      clearMidpointTimer();
      const midpoint = startTime + fadeSeconds / 2;
      const markIncomingAsCurrent = () => {
        const context = audioContextRef.current;
        if (
          !context ||
          !crossfadeActiveRef.current ||
          crossfadeTargetKeyRef.current !== nextItem.key
        ) {
          clearMidpointTimer();
          return;
        }
        if (context.currentTime < midpoint) return;

        const queue = queueRef.current;
        if (queue.items[queue.position + 1]?.key !== nextItem.key) {
          cancelCrossfade();
          return;
        }
        const prepared = preparedArtworkRef.current;
        setPresentedTrack({
          key: nextItem.key,
          artworkReady: prepared?.key === nextItem.key && prepared.artworkReady,
          artworkUrl: prepared?.key === nextItem.key ? prepared.artworkUrl : null
        });
        setProgress((previous) => Math.max(previous ?? 0, 0.5));
        const source = mixSourceRef.current;
        const incomingTime = Math.max(
          0,
          mixStartOffsetRef.current +
            mixRateRef.current * (context.currentTime - mixStartContextTimeRef.current)
        );
        setCurrentTime(incomingTime);
        if (source?.buffer) setDuration(source.buffer.duration);
        clearMidpointTimer();
      };

      midpointTimerRef.current = window.setInterval(markIncomingAsCurrent, 50);
      markIncomingAsCurrent();
    },
    [
      audioContextRef,
      cancelCrossfade,
      clearMidpointTimer,
      queueRef,
      setCurrentTime,
      setDuration,
      setPresentedTrack
    ]
  );

  const finishHandoff = useCallback(
    (handoffRate = 1) => {
      const context = audioContextRef.current;
      const source = mixSourceRef.current;
      const mediaFadeGain = mediaFadeGainRef.current;
      const mixFadeGain = mixFadeGainRef.current;
      if (!context || !source) {
        crossfadeActiveRef.current = false;
        crossfadeTargetKeyRef.current = null;
        clearMidpointTimer();
        clearPresentation(true);
        handoffPendingRef.current = false;
        setProgress(null);
        mixStartContextTimeRef.current = 0;
        mixFadeDurationRef.current = 0;
        setPhase('idle');
        return;
      }
      const now = context.currentTime;
      const swapSeconds = 0.12;
      if (mediaFadeGain) {
        mediaFadeGain.gain.cancelScheduledValues(now);
        mediaFadeGain.gain.setValueAtTime(mediaFadeGain.gain.value, now);
        mediaFadeGain.gain.linearRampToValueAtTime(1, now + swapSeconds);
      }
      if (mixFadeGain) {
        mixFadeGain.gain.cancelScheduledValues(now);
        mixFadeGain.gain.setValueAtTime(mixFadeGain.gain.value, now);
        mixFadeGain.gain.linearRampToValueAtTime(0, now + swapSeconds);
      }
      try {
        source.stop(now + swapSeconds + 0.03);
      } catch {
        null;
      }
      window.setTimeout(() => {
        if (mixSourceRef.current !== source) return;
        try {
          source.disconnect();
        } catch {
          null;
        }
        mixSourceRef.current = null;
        if (mixFadeGain) mixFadeGain.gain.value = 0;
        crossfadeActiveRef.current = false;
        crossfadeTargetKeyRef.current = null;
        clearMidpointTimer();
        handoffPendingRef.current = false;
        setProgress(null);
        mixStartContextTimeRef.current = 0;
        mixFadeDurationRef.current = 0;
        setPhase('idle');
        glidePlaybackRateToUnity(handoffRate);
      }, (swapSeconds + 0.06) * 1000);
    },
    [
      audioContextRef,
      clearMidpointTimer,
      clearPresentation,
      glidePlaybackRateToUnity,
      mediaFadeGainRef,
      mixFadeGainRef
    ]
  );

  const preloadBuffer = useCallback(
    async (nextItem: QueueItem) => {
      if (preloadingKeyRef.current === nextItem.key) return;
      if (preloadedBufferRef.current?.key === nextItem.key) return;
      preloadingKeyRef.current = nextItem.key;
      try {
        ensureGraph();
        const context = audioContextRef.current!;
        const file = await getFileRef.current(nextItem.track);
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        preloadedBufferRef.current = { key: nextItem.key, buffer };
      } catch {
        null;
      } finally {
        preloadingKeyRef.current = null;
      }
    },
    [audioContextRef, ensureGraph]
  );

  const startCrossfade = useCallback(
    async (
      nextItem: QueueItem,
      requestedFade: number,
      mix: {
        outgoing: TrackAnalysis;
        incoming: TrackAnalysis;
        status: 'green' | 'orange' | 'red';
      }
    ) => {
      crossfadeActiveRef.current = true;
      mixStartContextTimeRef.current = 0;
      mixFadeDurationRef.current = 0;
      setProgress(0);
      setPhase('mixing');
      try {
        const mixFadeGain = ensureMixBus();
        const context = audioContextRef.current!;
        await context.resume().catch(() => {});

        let audioBuffer: AudioBuffer;
        const preloaded = preloadedBufferRef.current;
        if (preloaded?.key === nextItem.key) {
          audioBuffer = preloaded.buffer;
          preloadedBufferRef.current = null;
        } else {
          const file = await getFileRef.current(nextItem.track);
          if (!crossfadeActiveRef.current) return;
          audioBuffer = await context.decodeAudioData(await file.arrayBuffer());
          if (!crossfadeActiveRef.current) return;
        }

        const leadSeconds = 0.06;
        const startTime = context.currentTime + leadSeconds;
        const outgoingPosition = audio.currentTime + leadSeconds - MEDIA_LATENCY;
        const plan = plan_crossfade(
          mix.outgoing,
          mix.incoming,
          outgoingPosition,
          requestedFade,
          mix.status !== 'red'
        );

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = plan.playback_rate;
        source.connect(mixFadeGain);
        mixSourceRef.current = source;
        mixStartContextTimeRef.current = startTime;
        mixStartOffsetRef.current = plan.incoming_offset;
        mixRateRef.current = plan.playback_rate;
        mixFadeDurationRef.current = plan.fade_seconds;
        crossfadeTargetKeyRef.current = nextItem.key;
        prepareArtwork(nextItem);
        source.start(startTime, plan.incoming_offset);

        const mediaFadeGain = mediaFadeGainRef.current!;
        mediaFadeGain.gain.cancelScheduledValues(startTime);
        mediaFadeGain.gain.setValueCurveAtTime(FADE_CURVES.fade_out, startTime, plan.fade_seconds);
        mixFadeGain.gain.cancelScheduledValues(startTime);
        mixFadeGain.gain.setValueCurveAtTime(FADE_CURVES.fade_in, startTime, plan.fade_seconds);
        scheduleMidpoint(nextItem, startTime, plan.fade_seconds);
      } catch (error) {
        console.error('Auto mix crossfade failed', error);
        crossfadeActiveRef.current = false;
        crossfadeTargetKeyRef.current = null;
        clearMidpointTimer();
        clearPresentation(true);
        setProgress(null);
        mixStartContextTimeRef.current = 0;
        mixFadeDurationRef.current = 0;
        setPhase('idle');
      }
    },
    [
      audio,
      audioContextRef,
      clearMidpointTimer,
      clearPresentation,
      ensureMixBus,
      mediaFadeGainRef,
      prepareArtwork,
      scheduleMidpoint
    ]
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      const activePresentation = presentationRef.current;
      const context = audioContextRef.current;
      const source = mixSourceRef.current;
      if (crossfadeActiveRef.current && context && mixStartContextTimeRef.current > 0) {
        const fadeDuration = mixFadeDurationRef.current;
        setProgress(
          fadeDuration > 0
            ? Math.min(
                1,
                Math.max(0, (context.currentTime - mixStartContextTimeRef.current) / fadeDuration)
              )
            : 1
        );
      }
      if (activePresentation && context && source?.buffer) {
        setCurrentTime(
          Math.max(
            0,
            mixStartOffsetRef.current +
              mixRateRef.current * (context.currentTime - mixStartContextTimeRef.current)
          )
        );
        setDuration(source.buffer.duration);
      } else {
        setCurrentTime(time);
      }

      if (!enabledRef.current || crossfadeActiveRef.current || repeatModeRef.current === 'one') return;
      const queue = queueRef.current;
      const nextItem = queue.items[queue.position + 1];
      const audioDuration = audio.duration;
      const fadeSeconds = transitionDurationRef.current;
      const mix = pendingMixRef.current;
      if (
        !nextItem ||
        !mix ||
        mix.key !== nextItem.key ||
        !Number.isFinite(audioDuration) ||
        audioDuration <= fadeSeconds
      ) {
        return;
      }
      if (audioDuration - time <= fadeSeconds + 6) void preloadBuffer(nextItem);
      if (audioDuration - time <= fadeSeconds) void startCrossfade(nextItem, fadeSeconds, mix);
    },
    [audio, audioContextRef, preloadBuffer, queueRef, setCurrentTime, setDuration, startCrossfade]
  );

  const shouldHoldDuration = useCallback(() => presentationRef.current !== null, []);

  const beginHandoff = useCallback(() => {
    const queue = queueRef.current;
    if (
      !crossfadeActiveRef.current ||
      !mixSourceRef.current ||
      queue.position + 1 >= queue.items.length
    ) {
      return false;
    }
    handoffPendingRef.current = true;
    setProgress(1);
    setPhase('switching');
    return true;
  }, [queueRef]);

  const consumeHandoff = useCallback(() => {
    const isHandoff = handoffPendingRef.current;
    handoffPendingRef.current = false;
    const context = audioContextRef.current;
    if (!isHandoff || !mixSourceRef.current || !context) return null;
    const rate = mixRateRef.current > 0 ? mixRateRef.current : 1;
    return {
      rate,
      position: () =>
        Math.max(
          0,
          mixStartOffsetRef.current +
            rate * (context.currentTime - mixStartContextTimeRef.current)
        )
    };
  }, [audioContextRef]);

  const clearPendingMix = useCallback(() => {
    pendingMixRef.current = null;
  }, []);

  const completePresentation = useCallback(
    (key: string) => {
      if (presentationRef.current?.key === key) clearPresentation();
    },
    [clearPresentation]
  );

  const currentKey = current?.key ?? null;
  const nextKey = queueRef.current.items[queueRef.current.position + 1]?.key ?? null;
  useEffect(() => {
    preloadedBufferRef.current = null;
    pendingMixRef.current = null;
    setBpm(null);
    if (!enabled || !current) {
      setPhase('idle');
      setColor(null);
      return;
    }
    const nextItem = queueRef.current.items[queueRef.current.position + 1];
    if (!nextItem) {
      setPhase('idle');
      setColor(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setPhase('analyzing-current');
        const currentFile = await getFileRef.current(current.track);
        const currentAnalysis = await analyze_track(current.track.id, currentFile);
        if (cancelled) return;

        setPhase('analyzing-next');
        const nextFile = await getFileRef.current(nextItem.track);
        const nextAnalysis = await analyze_track(nextItem.track.id, nextFile);
        if (cancelled) return;

        const status = classify_bpm_diff(currentAnalysis.bpm, nextAnalysis.bpm);
        pendingMixRef.current = {
          key: nextItem.key,
          outgoing: currentAnalysis,
          incoming: nextAnalysis,
          status
        };
        setBpm({ current: currentAnalysis.bpm, next: nextAnalysis.bpm });
        setColor(status);
        setPhase('idle');
        toast.info(
          `auto mix: ${currentAnalysis.bpm} BPM (${Math.round(currentAnalysis.confidence * 100)}%) -> ` +
            `${nextAnalysis.bpm} BPM (${Math.round(nextAnalysis.confidence * 100)}%)`
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPhase('idle');
          setColor(null);
          const reason = error instanceof Error ? error.message : String(error);
          toast.error(`bpm was not analyzed (${reason})`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentKey, nextKey, enabled, current, queueRef]);

  const toggle = useCallback(() => {
    setEnabled((wasEnabled) => {
      const next = !wasEnabled;
      if (!next) cancelCrossfade();
      saveAutoMix(next);
      return next;
    });
  }, [cancelCrossfade]);

  return {
    enabled,
    phase,
    color,
    bpm,
    progress,
    presentation,
    crossfadeActiveRef,
    mixSourceRef,
    cancelCrossfade,
    finishHandoff,
    handleTimeUpdate,
    shouldHoldDuration,
    beginHandoff,
    consumeHandoff,
    clearPendingMix,
    completePresentation,
    toggle
  };
}
