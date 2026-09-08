import { useEffect, useRef } from 'react';
import { MAX_VOLUME, usePlayer, type RepeatMode } from '../src/context/player';
import { clamp } from '../utils/format';
import {
  electron,
  type ElectronControl,
  type ElectronLoop,
  type ElectronPlaybackState
} from '../utils/electron';

type Player = ReturnType<typeof usePlayer>;

const PUSH_INTERVAL = 1000;
const REPEAT_CYCLE: RepeatMode[] = ['off', 'all', 'one'];

const LOOP_BY_MODE: Record<RepeatMode, ElectronLoop> = {
  off: 'None',
  all: 'Playlist',
  one: 'Track'
};

function modeFromLoop(loop: string): RepeatMode {
  if (loop === 'Track') return 'one';
  if (loop === 'Playlist') return 'all';
  return 'off';
}

function snapshot(player: Player): ElectronPlaybackState {
  const track = player.current?.track ?? null;
  const duration = Number.isFinite(player.duration) ? player.duration : 0;
  return {
    trackId: player.radio_station?.stationuuid ?? player.current?.key ?? null,
    title: player.radio_station?.name ?? track?.title ?? '',
    artist: player.radio_station ? 'Live radio' : track?.artist ?? '',
    album: track?.album ?? '',
    status: (track || player.radio_station) ? (player.isPlaying ? 'playing' : 'paused') : 'stopped',
    durationSeconds: duration,
    currentSeconds: clamp(player.currentTime, 0, duration || player.currentTime),
    volume: player.volume,
    shuffle: player.shuffled,
    loop: player.radio_station ? 'None' : LOOP_BY_MODE[player.repeatMode],
    canGoNext: !player.radio_station && (player.position < player.queue.length - 1 || player.repeatMode === 'all'),
    canGoPrevious: !player.radio_station && player.queue.length > 0
  };
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function applyControl(player: Player, control: ElectronControl, payload?: number | boolean | string) {
  switch (control) {
    case 'play':
      if (!player.isPlaying) player.togglePlay();
      break;
    case 'pause':
      if (player.isPlaying) player.togglePlay();
      break;
    case 'playpause':
      player.togglePlay();
      break;
    case 'stop':
      if (player.isPlaying) player.togglePlay();
      player.seek(0);
      break;
    case 'next':
      player.next();
      break;
    case 'previous':
      player.prev();
      break;
    case 'seek':
      if (typeof payload === 'number') player.seek(payload);
      break;
    case 'volume':
      if (typeof payload === 'number') player.setVolume(clamp(payload, 0, MAX_VOLUME));
      break;
    case 'shuffle':
      if (typeof payload === 'boolean' && payload !== player.shuffled) player.toggleShuffle();
      break;
    case 'loop': {
      if (typeof payload !== 'string') break;
      const target = REPEAT_CYCLE.indexOf(modeFromLoop(payload));
      const steps = (target - REPEAT_CYCLE.indexOf(player.repeatMode) + REPEAT_CYCLE.length) % REPEAT_CYCLE.length;
      for (let i = 0; i < steps; i += 1) player.cycleRepeat();
      break;
    }
  }
}

export function useElectronBridge(): void {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;

  const trackId = player.radio_station?.stationuuid ?? player.current?.key ?? null;

  useEffect(() => {
    const bridge = electron;
    if (!bridge) return;
    const push = () => bridge.updateState(snapshot(playerRef.current));
    push();
    const timer = window.setInterval(push, PUSH_INTERVAL);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    electron?.updateState(snapshot(playerRef.current));
  }, [
    trackId,
    player.isPlaying,
    player.volume,
    player.shuffled,
    player.repeatMode,
    player.duration,
    player.queue.length,
    player.position
  ]);

  useEffect(() => {
    const bridge = electron;
    if (!bridge) return;
    if (!player.artworkUrl) {
      bridge.setArtwork(trackId, null);
      return;
    }
    let cancelled = false;
    void toDataUrl(player.artworkUrl).then((dataUrl) => {
      if (!cancelled) bridge.setArtwork(trackId, dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId, player.artworkUrl]);

  useEffect(() => {
    const bridge = electron;
    if (!bridge) return;
    bridge.onControl((control, payload) => applyControl(playerRef.current, control, payload));
    return () => bridge.offControl();
  }, []);
}
