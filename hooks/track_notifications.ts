import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';

export function useTrackNotifications(): void {
  const { current, artworkUrl, isPlaying } = usePlayer();
  const { settings } = useSettings();

  const artworkRef = useRef(artworkUrl);
  artworkRef.current = artworkUrl;
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const enabledRef = useRef(settings.notifications);
  enabledRef.current = settings.notifications;

  const track = current?.track ?? null;

  useEffect(() => {
    if (!track) return;
    const timer = setTimeout(() => {
      if (!enabledRef.current || !playingRef.current) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const notification = new Notification(track.title, {
        body: `${track.artist} from ${track.album}`,
        icon: artworkRef.current ?? '/app/media/icon-192.png',
        tag: 'xebrine-now-playing',
        silent: true
      });
      setTimeout(() => notification.close(), 5000);
    }, 400);
    return () => clearTimeout(timer);
  }, [current?.key]);
}
