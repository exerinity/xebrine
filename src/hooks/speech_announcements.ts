import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { speakWithMeSpeak, stopMeSpeak } from '../utils/mespeak';
import { applyPronunciations } from '../utils/pronunciation';

export function useSpeechAnnouncements(): void {
  const { current, duckVolume, audioRef, queue, position, repeatMode } = usePlayer();
  const { settings } = useSettings();

  const enabledRef = useRef(settings.announceTrackChanges);
  enabledRef.current = settings.announceTrackChanges;
  const pronunciationsRef = useRef(settings.artistPronunciations);
  pronunciationsRef.current = settings.artistPronunciations;
  const duckVolumeRef = useRef(duckVolume);
  duckVolumeRef.current = duckVolume;
  const speechIdRef = useRef(0);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const positionRef = useRef(position);
  positionRef.current = position;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const stopSpeaking = () => {
    speechIdRef.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopMeSpeak();
    duckVolumeRef.current(false);
  };

  const announce = (rawMessage: string) => {
    const message = applyPronunciations(rawMessage, pronunciationsRef.current);
    stopSpeaking();
    const id = speechIdRef.current;
    const restore = () => {
      if (speechIdRef.current === id) duckVolumeRef.current(false);
    };

    duckVolumeRef.current(true);
    if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.onend = restore;
      utterance.onerror = restore;
      window.speechSynthesis.speak(utterance);
    } else {
      speakWithMeSpeak(message, restore).catch(restore);
    }
  };

  const track = current?.track ?? null;

  useEffect(() => {
    stopSpeaking();
    if (!track) return;
    const timer = setTimeout(() => {
      if (!enabledRef.current) return;
      announce(`Now playing: ${track.title} by ${track.artist}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [current?.key]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (!enabledRef.current) return;
      const hasNext = positionRef.current + 1 < queueRef.current.length;
      const willRepeat = repeatModeRef.current !== 'off';
      if (!hasNext && !willRepeat) {
        announce('There are no more tracks');
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audioRef]);
}
