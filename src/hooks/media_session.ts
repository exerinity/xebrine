import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/player_context';

export function useMediaSession(): void {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;

  const track = player.current?.track ?? null;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: player.artworkUrl
            ? [{ src: player.artworkUrl, sizes: '512x512' }]
            : []
        })
      : null;
  }, [player.current?.key, player.artworkUrl]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused';
  }, [player.isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: player.duration || 0,
        position: Math.min(player.currentTime, player.duration || 0),
        playbackRate: 1
      });
    } catch {
      null;
    }
  }, [player.currentTime, player.duration]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => playerRef.current.togglePlay());
    ms.setActionHandler('pause', () => playerRef.current.togglePlay());
    ms.setActionHandler('previoustrack', () => playerRef.current.prev());
    ms.setActionHandler('nexttrack', () => playerRef.current.next());
    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        playerRef.current.seek(details.seekTime);
      }
    });
    ms.setActionHandler('seekbackward', (details) => {
      const p = playerRef.current;
      p.seek(p.currentTime - (details.seekOffset ?? 10));
    });
    ms.setActionHandler('seekforward', (details) => {
      const p = playerRef.current;
      p.seek(p.currentTime + (details.seekOffset ?? 10));
    });
    return () => {
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('nexttrack', null);
      ms.setActionHandler('seekto', null);
      ms.setActionHandler('seekbackward', null);
      ms.setActionHandler('seekforward', null);
    };
  }, []);
}
