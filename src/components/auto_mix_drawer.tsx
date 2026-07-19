import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/player_context';
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

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function AutoMixDrawer() {
  const { autoMixEnabled, autoMixPhase, autoMixColor, currentTime, duration } = usePlayer();
  const { settings } = useSettings();
  const [justDone, setJustDone] = useState(false);
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

  const fade = settings.autoMixDuration;
  const mixPoint = duration - fade;
  const secondsUntilMix = mixPoint - currentTime;
  const fadeProgress = fade > 0 ? clamp01((currentTime - mixPoint) / fade) : 0;
  const hasMixPoint = duration > fade && duration > 0;

  const status = getStatus({
    phase: autoMixPhase,
    justDone,
    fadeProgress,
    secondsUntilMix,
    hasMixPoint,
    mixPoint,
    currentTime
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
}): MixStatus {
  const { phase, justDone, fadeProgress, secondsUntilMix, hasMixPoint, mixPoint, currentTime } = input;

  if (phase === 'analyzing-current') {
    return { label: 'Loading...', detail: 'Reading the BPM of the current song', spinner: true, done: false, progress: null };
  }
  if (phase === 'analyzing-next') {
    return { label: 'Loading...', detail: 'Reading the BPM of the next song', spinner: true, done: false, progress: null };
  }
  if (phase === 'mixing') {
    return fadeProgress < 0.55
      ? {
          label: 'Mixing...',
          detail: 'Blending the two tracks',
          spinner: true,
          done: false,
          progress: fadeProgress
        }
      : {
          label: 'Finishing up...',
          detail: 'Fading out the outgoing track',
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
    return {
      label: 'Auto mix is idling',
      detail: `Transition will start in ${formatTime(Math.ceil(secondsUntilMix))}`,
      spinner: false,
      done: false,
      progress: mixPoint > 0 ? clamp01(currentTime / mixPoint) : 0
    };
  }
  return { label: 'Auto mix is idling', detail: 'Waiting for a mix point', spinner: false, done: false, progress: 0 };
}
