import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { report_station_play, station_stream_url, type radio_station_record } from '../../../api/radio_browser';

export function use_radio_playback(
  audio: HTMLAudioElement,
  station: radio_station_record | null,
  set_load_error: Dispatch<SetStateAction<string | null>>
): boolean {
  const [connecting, set_connecting] = useState(false);
  useEffect(() => {
    if (!station) { set_connecting(false); return; }
    let cancelled = false;
    let stopped = false;
    let reported = false;
    let timeout: ReturnType<typeof setTimeout>;
    const fail = () => {
      if (cancelled || stopped) return;
      clearTimeout(timeout);
      set_connecting(false);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      set_load_error('The connection was severed');
    };
    const waiting = () => {
      if (stopped || audio.paused) return;
      set_connecting(true);
      clearTimeout(timeout);
      timeout = setTimeout(fail, 25000);
    };
    const playing = () => {
      if (stopped) return;
      clearTimeout(timeout);
      set_connecting(false);
      if (!reported) { reported = true; report_station_play(station.stationuuid); }
    };
    const paused = () => {
      if (!audio.paused) return;
      stopped = true;
      clearTimeout(timeout);
      set_connecting(false);
      if (audio.hasAttribute('src')) {
        audio.removeAttribute('src');
        audio.load();
      }
    };
    audio.addEventListener('playing', playing);
    audio.addEventListener('waiting', waiting);
    audio.addEventListener('pause', paused);
    audio.addEventListener('error', fail);
    audio.addEventListener('ended', fail);
    audio.loop = false;
    audio.playbackRate = 1;
    audio.src = station_stream_url(station);
    set_load_error(null);
    set_connecting(true);
    timeout = setTimeout(fail, 25000);
    void audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      fail();
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      audio.removeEventListener('playing', playing);
      audio.removeEventListener('waiting', waiting);
      audio.removeEventListener('pause', paused);
      audio.removeEventListener('error', fail);
      audio.removeEventListener('ended', fail);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [audio, station, set_load_error]);
  return connecting;
}
