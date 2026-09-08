import { useEffect, useRef } from 'react';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';

const SOUND_URL = '/app/sfx/finished.ogg';

export function useQueueFinishedSound() {
  const { audioRef, queue, position, repeatMode, radio_station } = usePlayer();
  const { settings } = useSettings();

  const radio_ref = useRef(radio_station);
  radio_ref.current = radio_station;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const positionRef = useRef(position);
  positionRef.current = position;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const autoPlayRef = useRef(settings.autoPlay);
  autoPlayRef.current = settings.autoPlay;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (radio_ref.current) return;
      const hasNext = positionRef.current + 1 < queueRef.current.length;
      const willRepeat = repeatModeRef.current !== 'off';
      if (!hasNext && !willRepeat && !autoPlayRef.current) {
        new Audio(SOUND_URL).play().catch(() => {});
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audioRef]);
}
