import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../../../utils/format';

const MAX_SLEEP_TIMER_SECONDS = 12 * 60 * 60;

export function useSleepTimer(audio: HTMLAudioElement) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  const endAtRef = useRef<number | null>(null);
  endAtRef.current = endAt;
  const pausedRemainingRef = useRef<number | null>(null);
  pausedRemainingRef.current = pausedRemaining;

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const target = endAtRef.current;
      if (target === null) return;
      const seconds = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds <= 0) {
        audio.pause();
        setEndAt(null);
        setFinished(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endAt, audio]);

  const currentSeconds = useCallback(() => {
    if (pausedRemainingRef.current !== null) return pausedRemainingRef.current;
    if (endAtRef.current !== null) {
      return Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
    }
    return 0;
  }, []);

  const add = useCallback(
    (minutes: number) => {
      const seconds = clamp(currentSeconds() + minutes * 60, 0, MAX_SLEEP_TIMER_SECONDS);
      setFinished(false);
      setPausedRemaining(null);
      setEndAt(Date.now() + seconds * 1000);
    },
    [currentSeconds]
  );

  const setMinutes = useCallback((minutes: number) => {
    const seconds = clamp(Math.round(minutes * 60), 0, MAX_SLEEP_TIMER_SECONDS);
    setFinished(false);
    setPausedRemaining(null);
    if (seconds <= 0) {
      setEndAt(null);
      setRemaining(0);
      return;
    }
    setEndAt(Date.now() + seconds * 1000);
  }, []);

  const togglePaused = useCallback(() => {
    if (pausedRemainingRef.current !== null) {
      const seconds = pausedRemainingRef.current;
      setPausedRemaining(null);
      setEndAt(Date.now() + seconds * 1000);
      return;
    }
    if (endAtRef.current !== null) {
      const seconds = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setEndAt(null);
      setPausedRemaining(seconds);
      setRemaining(seconds);
    }
  }, []);

  const cancel = useCallback(() => {
    setEndAt(null);
    setPausedRemaining(null);
    setRemaining(0);
  }, []);

  const dismissFinished = useCallback(() => {
    setFinished(false);
  }, []);

  return {
    remaining,
    paused: pausedRemaining !== null,
    finished,
    add,
    setMinutes,
    togglePaused,
    cancel,
    dismissFinished
  };
}
