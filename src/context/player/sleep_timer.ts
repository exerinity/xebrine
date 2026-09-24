import { useCallback, useEffect, useRef, useState } from 'react';

export type SleepTimerMode = 'off' | 'duration' | 'until' | 'song' | 'songs' | 'queue' | 'battery';
export type SleepTimerSelection =
  | { mode: 'duration'; value: number }
  | { mode: 'until'; value: string }
  | { mode: 'song' }
  | { mode: 'songs'; value: number }
  | { mode: 'queue' }
  | { mode: 'battery'; value: number };

type BatteryLike = EventTarget & { level: number };
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryLike> };

export function useSleepTimer(audio: HTMLAudioElement) {
  const [mode, setMode] = useState<SleepTimerMode>('off');
  const [remaining, setRemaining] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const modeRef = useRef<SleepTimerMode>('off');
  const songsLeftRef = useRef(0);
  const batteryThresholdRef = useRef(0);
  const batteryLevelRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    modeRef.current = 'off';
    setMode('off');
    endAtRef.current = null;
    songsLeftRef.current = 0;
    setRemaining(0);
  }, []);

  const stopPlayback = useCallback(() => {
    clear();
    audio.pause();
    setFinished(true);
  }, [audio, clear]);

  const setTimer = useCallback((selection: SleepTimerSelection) => {
    setFinished(false);
    modeRef.current = selection.mode;
    setMode(selection.mode);
    endAtRef.current = null;
    songsLeftRef.current = 0;
    if (selection.mode === 'duration') {
      endAtRef.current = Date.now() + selection.value * 60_000;
    } else if (selection.mode === 'until') {
      const [hours, minutes] = selection.value.split(':').map(Number);
      const deadline = new Date();
      deadline.setHours(hours, minutes, 0, 0);
      if (deadline.getTime() <= Date.now()) deadline.setDate(deadline.getDate() + 1);
      endAtRef.current = deadline.getTime();
    } else if (selection.mode === 'songs') {
      songsLeftRef.current = selection.value;
    } else if (selection.mode === 'battery') {
      batteryThresholdRef.current = selection.value;
      if (batteryLevelRef.current !== null && batteryLevelRef.current <= selection.value) {
        stopPlayback();
        return;
      }
    }
    setRemaining(endAtRef.current ? Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)) : 0);
  }, [stopPlayback]);

  const handleSongEnded = useCallback((atQueueEnd: boolean) => {
    const activeMode = modeRef.current;
    if (activeMode === 'song' || (activeMode === 'songs' && songsLeftRef.current <= 1) ||
      (activeMode === 'queue' && atQueueEnd)) {
      stopPlayback();
      return true;
    }
    if (activeMode === 'songs') songsLeftRef.current -= 1;
    return false;
  }, [stopPlayback]);

  useEffect(() => {
    const update = () => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const seconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) stopPlayback();
    };
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [stopPlayback]);

  useEffect(() => {
    let battery: BatteryLike | null = null;
    let disposed = false;
    const readLevel = () => {
      const level = battery?.level;
      const percent = typeof level === 'number' && Number.isFinite(level) ? Math.round(level * 100) : null;
      batteryLevelRef.current = percent;
      setBatteryLevel(percent);
      if (typeof level === 'number' && Number.isFinite(level) && modeRef.current === 'battery' &&
        level * 100 <= batteryThresholdRef.current) stopPlayback();
    };
    const getBattery = (navigator as NavigatorWithBattery).getBattery;
    if (!getBattery) {
      setBatteryLevel(null);
      return;
    }
    getBattery.call(navigator).then((result) => {
      if (disposed) return;
      battery = result;
      readLevel();
      battery.addEventListener('levelchange', readLevel);
    }).catch(() => setBatteryLevel(null));
    return () => {
      disposed = true;
      battery?.removeEventListener('levelchange', readLevel);
    };
  }, [stopPlayback]);

  const dismissFinished = useCallback(() => setFinished(false), []);

  return { mode, remaining, batteryLevel, finished, setTimer, cancel: clear, handleSongEnded, dismissFinished };
}
