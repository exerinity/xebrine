import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import { formatTime } from '../utils/format';
import { AutoMixIcon, CheckIcon } from './icons';
import { Spinner } from './spinner';

interface MixStatus {
  label: string;
  detail: string;
  spinner: boolean;
  done: boolean;
  progress: number | null;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
}

type PerformanceWithMemory = Performance & { memory?: PerformanceMemory };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function AutoMixDrawer() {
  const {
    autoMixEnabled,
    autoMixPhase,
    autoMixColor,
    autoMixBpm,
    autoMixProgress,
    currentTime,
    duration
  } = usePlayer();
  const { settings } = useSettings();
  const [justDone, setJustDone] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const prevPhaseRef = useRef(autoMixPhase);
  const doneTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = autoMixPhase;
    if ((prev === 'mixing' || prev === 'switching') && autoMixPhase === 'idle') {
      setJustDone(true);
      if (doneTimeoutRef.current) window.clearTimeout(doneTimeoutRef.current);
      doneTimeoutRef.current = window.setTimeout(() => setJustDone(false), 1800);
    } else if (autoMixPhase !== 'idle') {
      setJustDone(false);
    }
  }, [autoMixPhase]);

  useEffect(() => {
    return () => {
      if (doneTimeoutRef.current) window.clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoMixPhase !== 'mixing') {
      setMemoryUsage(null);
      return;
    }
    const updateMemoryUsage = () => {
      const memory = (performance as PerformanceWithMemory).memory;
      setMemoryUsage(memory && Number.isFinite(memory.usedJSHeapSize) ? memory.usedJSHeapSize : null);
    };
    updateMemoryUsage();
    const timer = window.setInterval(updateMemoryUsage, 1000);
    return () => window.clearInterval(timer);
  }, [autoMixPhase]);

  const fade = settings.autoMixDuration;
  const mixPoint = duration - fade;
  const secondsUntilMix = mixPoint - currentTime;
  const trackFadeProgress = fade > 0 ? clamp01((currentTime - mixPoint) / fade) : 0;
  const fadeProgress = autoMixProgress ?? trackFadeProgress;
  const hasMixPoint = duration > fade && duration > 0;

  const status = getStatus({
    phase: autoMixPhase,
    justDone,
    fadeProgress,
    secondsUntilMix,
    hasMixPoint,
    mixPoint,
    currentTime,
    bpm: autoMixBpm,
    memoryUsage,
    transitionDuration: fade
  });

  const accent = autoMixColor ? ` xe_automix-drawer--${autoMixColor}` : '';

  return (
    <div
      className={`xe_automix-drawer${autoMixEnabled ? ' xe_automix-drawer--open' : ''}${accent}`}
      aria-hidden={!autoMixEnabled}
    >
      <div className="xe_automix-drawer__head">
        {status.spinner ? (
          <Spinner size={11} />
        ) : status.done ? (
          <CheckIcon size={11} />
        ) : (
          <AutoMixIcon size={12} />
        )}
        <span className="xe_automix-drawer__title">{status.label}</span>
      </div>
      <div
        className={`xe_automix-drawer__bar${
          status.progress === null ? ' xe_automix-drawer__bar--indeterminate' : ''
        }`}
      >
        <div
          className="xe_automix-drawer__fill"
          style={status.progress === null ? undefined : { width: `${status.progress * 100}%` }}
        />
      </div>
      <div className="xe_automix-drawer__meta">{status.detail}</div>
    </div>
  );
}

function getStatus(input: {
  phase: string;
  justDone: boolean;
  fadeProgress: number;
  secondsUntilMix: number;
  hasMixPoint: boolean;
  mixPoint: number;
  currentTime: number;
  bpm: { current: number; next: number } | null;
  memoryUsage: number | null;
  transitionDuration: number;
}): MixStatus {
  const {
    phase,
    justDone,
    fadeProgress,
    secondsUntilMix,
    hasMixPoint,
    mixPoint,
    currentTime,
    bpm,
    memoryUsage,
    transitionDuration
  } = input;

  if (phase === 'analyzing-current') {
    return { label: 'Analyzing current...', detail: 'Reading the BPM of the current song', spinner: true, done: false, progress: null };
  }
  if (phase === 'analyzing-next') {
    return { label: 'Analyzing next...', detail: 'Reading the BPM of the next song', spinner: true, done: false, progress: null };
  }
  if (phase === 'mixing') {
    const progressLabel = `${Math.round(clamp01(fadeProgress) * 100)}%`;
    const memoryLabel = memoryUsage === null ? '--' : formatMemory(memoryUsage);
    return fadeProgress < 0.55
      ? {
          label: 'Mixing...',
          detail: `Auto mix ongoing: ${progressLabel} - MEM: ${memoryLabel}`,
          spinner: true,
          done: false,
          progress: fadeProgress
        }
      : {
          label: 'Finishing up...',
          detail: `Auto mix ongoing: ${progressLabel} - MEM: ${memoryLabel}`,
          spinner: true,
          done: false,
          progress: fadeProgress
        };
  }
  if (phase === 'switching') {
    return { label: 'Changing playback', detail: 'Handing over to the next track', spinner: false, done: false, progress: 1 };
  }
  if (justDone) {
    return { label: 'Done', detail: 'Mixed into the next track', spinner: false, done: true, progress: 1 };
  }
  if (hasMixPoint && secondsUntilMix > 0) {
    const transitionTime = formatTime(Math.ceil(secondsUntilMix));
    const transitionDurationLabel = `(${formatSeconds(transitionDuration)}s)`;
    return {
      label: 'Auto mix ready',
      detail: bpm
        ? `${formatBpm(bpm.current)} > ${formatBpm(bpm.next)} - transition starts in ${transitionTime} ${transitionDurationLabel}`
        : `Transition starts in ${transitionTime} ${transitionDurationLabel}`,
      spinner: false,
      done: false,
      progress: mixPoint > 0 ? clamp01(currentTime / mixPoint) : 0
    };
  }
  return { label: 'Enqueue more songs to auto mix', detail: 'There is no song up next', spinner: false, done: false, progress: null };
}

function formatBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1).replace(/\.0$/, '');
}

function formatMemory(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatSeconds(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1).replace(/\.0$/, '');
}
