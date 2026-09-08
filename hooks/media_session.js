import { useEffect, useRef } from 'react';
import { usePlayer } from '../src/context/player';

export function useMediaSession() {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;

  const track = player.current?.track ?? null;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = player.radio_station
      ? new MediaMetadata({ title: player.radio_station.name, artist: 'Live radio' })
      : track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: player.artworkUrl
            ? [{ src: player.artworkUrl, sizes: '512x512' }]
            : []
        })
      : null;
  }, [player.current?.key, player.artworkUrl, player.radio_station]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused';
  }, [player.isPlaying, player.radio_station]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      if (player.radio_station) { navigator.mediaSession.setPositionState(); return; }
      navigator.mediaSession.setPositionState({
        duration: player.duration || 0,
        position: Math.min(player.currentTime, player.duration || 0),
        playbackRate: 1
      });
    } catch {
      null;
    }
  }, [player.currentTime, player.duration, player.radio_station]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const live = () => Boolean(playerRef.current.radio_station);
    ms.setActionHandler('play', () => { if (!playerRef.current.isPlaying) playerRef.current.togglePlay(); });
    ms.setActionHandler('pause', () => { if (playerRef.current.isPlaying) playerRef.current.togglePlay(); });
    ms.setActionHandler('previoustrack', () => { if (!live()) playerRef.current.prev(); });
    ms.setActionHandler('nexttrack', () => { if (!live()) playerRef.current.next(); });
    ms.setActionHandler('seekto', (details) => {
      if (live()) return;
      if (details.seekTime !== undefined && details.seekTime !== null) {
        playerRef.current.seek(details.seekTime);
      }
    });
    ms.setActionHandler('seekbackward', (details) => {
      if (live()) return;
      const p = playerRef.current;
      p.seek(p.currentTime - (details.seekOffset ?? 10));
    });
    ms.setActionHandler('seekforward', (details) => {
      if (live()) return;
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
