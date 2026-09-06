import { useCallback, useEffect, useRef } from 'react';
import {
  EQ_BANDS,
  EQ_Q,
  db_to_gain,
  normalize_bands,
  normalize_intensity,
  normalize_preamp
} from '../../../audio/eq';
import { clamp } from '../../../utils/format';

interface EqualizerSettings {
  enabled: boolean;
  bands: number[];
  preamp: number;
  intensity: number;
}

export function usePlayerAudioGraph(
  audio: HTMLAudioElement,
  volume: number,
  equalizer: EqualizerSettings
) {
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const volumeFadeFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaFadeGainRef = useRef<GainNode | null>(null);
  const mixFadeGainRef = useRef<GainNode | null>(null);
  const equalizerFiltersRef = useRef<BiquadFilterNode[] | null>(null);
  const equalizerPreampRef = useRef<GainNode | null>(null);
  const rateGlideRef = useRef<number | null>(null);

  const ensureGraph = useCallback((): { gain: GainNode; analyser: AnalyserNode } => {
    if (gainNodeRef.current && analyserRef.current) {
      return { gain: gainNodeRef.current, analyser: analyserRef.current };
    }
    const context = new AudioContext();
    const source = context.createMediaElementSource(audio);
    const mediaFadeGain = context.createGain();
    mediaFadeGain.gain.value = 1;
    const gain = context.createGain();
    gain.gain.value = volumeRef.current;
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;

    const equalizerPreamp = context.createGain();
    equalizerPreamp.gain.value = 1;
    const equalizerFilters = EQ_BANDS.map((frequency) => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = frequency;
      filter.Q.value = EQ_Q;
      filter.gain.value = 0;
      return filter;
    });

    source.connect(mediaFadeGain);
    mediaFadeGain.connect(gain);
    gain.connect(equalizerPreamp);
    let tail: AudioNode = equalizerPreamp;
    for (const filter of equalizerFilters) {
      tail.connect(filter);
      tail = filter;
    }
    tail.connect(analyser);
    analyser.connect(context.destination);

    audioContextRef.current = context;
    mediaFadeGainRef.current = mediaFadeGain;
    gainNodeRef.current = gain;
    analyserRef.current = analyser;
    equalizerFiltersRef.current = equalizerFilters;
    equalizerPreampRef.current = equalizerPreamp;
    return { gain, analyser };
  }, [audio]);

  const ensureMixBus = useCallback(() => {
    const { gain } = ensureGraph();
    if (mixFadeGainRef.current) return mixFadeGainRef.current;
    const context = audioContextRef.current!;
    const mixFadeGain = context.createGain();
    mixFadeGain.gain.value = 0;
    mixFadeGain.connect(gain);
    mixFadeGainRef.current = mixFadeGain;
    return mixFadeGain;
  }, [ensureGraph]);

  const clearRateGlide = useCallback(() => {
    if (rateGlideRef.current === null) return;
    window.clearInterval(rateGlideRef.current);
    rateGlideRef.current = null;
  }, []);

  const glidePlaybackRateToUnity = useCallback(
    (from: number) => {
      clearRateGlide();
      if (!(from > 0) || Math.abs(from - 1) < 1e-3) {
        audio.playbackRate = 1;
        return;
      }
      const steps = 30;
      let step = 0;
      audio.playbackRate = from;
      rateGlideRef.current = window.setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - (1 - progress) * (1 - progress);
        audio.playbackRate = step >= steps ? 1 : from + (1 - from) * eased;
        if (step >= steps) clearRateGlide();
      }, 50);
    },
    [audio, clearRateGlide]
  );

  const cancelVolumeFade = useCallback(() => {
    if (volumeFadeFrameRef.current !== null) {
      cancelAnimationFrame(volumeFadeFrameRef.current);
      volumeFadeFrameRef.current = null;
    }
    const gain = gainNodeRef.current;
    const context = audioContextRef.current;
    if (gain && context) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
    }
  }, []);

  const applyVolume = useCallback(
    (nextVolume: number) => {
      cancelVolumeFade();
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = nextVolume;
        return;
      }
      if (nextVolume <= 1) {
        audio.volume = nextVolume;
        return;
      }
      audio.volume = 1;
      ensureGraph().gain.gain.value = nextVolume;
    },
    [audio, cancelVolumeFade, ensureGraph]
  );

  const fadeVolumeTo = useCallback(
    (target: number, durationMs: number) => {
      cancelVolumeFade();
      if (durationMs <= 0) {
        applyVolume(target);
        return;
      }

      if (gainNodeRef.current) {
        const gain = gainNodeRef.current;
        const context = audioContextRef.current;
        if (context) {
          const now = context.currentTime;
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
          return;
        }
        gain.gain.value = target;
        return;
      }

      if (target > 1) {
        audio.volume = 1;
        const { gain } = ensureGraph();
        const context = audioContextRef.current!;
        const now = context.currentTime;
        gain.gain.setValueAtTime(1, now);
        gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
        return;
      }

      const start = audio.volume;
      const startTime = performance.now();
      const step = (now: number) => {
        const progress = clamp((now - startTime) / durationMs, 0, 1);
        audio.volume = start + (target - start) * progress;
        if (progress < 1) {
          volumeFadeFrameRef.current = requestAnimationFrame(step);
        } else {
          volumeFadeFrameRef.current = null;
        }
      };
      volumeFadeFrameRef.current = requestAnimationFrame(step);
    },
    [applyVolume, audio, cancelVolumeFade, ensureGraph]
  );

  const getAnalyser = useCallback(() => {
    const { analyser } = ensureGraph();
    audioContextRef.current?.resume().catch(() => {});
    return analyser;
  }, [ensureGraph]);

  useEffect(() => {
    const bands = normalize_bands(equalizer.bands);
    const intensity = normalize_intensity(equalizer.intensity);
    const preampDb = normalize_preamp(equalizer.preamp);
    const active = equalizer.enabled && (bands.some((value) => value !== 0) || preampDb !== 0);
    if (!active && !equalizerFiltersRef.current) return;
    ensureGraph();
    const context = audioContextRef.current!;
    equalizerFiltersRef.current!.forEach((filter, index) => {
      const target = active ? bands[index] * intensity : 0;
      filter.gain.setTargetAtTime(target, context.currentTime, 0.02);
    });
    equalizerPreampRef.current!.gain.setTargetAtTime(
      active ? db_to_gain(preampDb) : 1,
      context.currentTime,
      0.02
    );
  }, [equalizer.enabled, equalizer.bands, equalizer.intensity, equalizer.preamp, ensureGraph]);

  return {
    audioContextRef,
    mediaFadeGainRef,
    mixFadeGainRef,
    ensureGraph,
    ensureMixBus,
    clearRateGlide,
    glidePlaybackRateToUnity,
    applyVolume,
    fadeVolumeTo,
    getAnalyser
  };
}

export type PlayerAudioGraph = ReturnType<typeof usePlayerAudioGraph>;
