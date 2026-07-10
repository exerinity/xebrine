import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/player_context';

const SOUND_URL = '/app/sfx/finished.ogg';

export function useQueueFinishedSound(): void {
  const { audioRef, queue, position, repeatMode } = usePlayer();

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const positionRef = useRef(position);
  positionRef.current = position;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const hasNext = positionRef.current + 1 < queueRef.current.length;
      const willRepeat = repeatModeRef.current !== 'off';
      if (!hasNext && !willRepeat) {
        new Audio(SOUND_URL).play().catch(() => {});
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audioRef]);
}
