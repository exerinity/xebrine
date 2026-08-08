import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOLUME, usePlayer, type PlayerContextValue } from '../context/player_context';
import { displayArtist } from '../utils/groups';
import { toast } from '../utils/toast';
import {
  MAX_QUEUE_ENTRIES,
  type HostInbound,
  type HostOutbound,
  type RemoteCommand,
  type RemotePeer,
  type RemoteQueueEntry,
  type RemoteState
} from '../utils/remote_protocol';
import { parseMessage, remoteUrl, startKeepalive } from './remote_socket';

export type HostPhase = 'idle' | 'connecting' | 'live' | 'error';

export interface RemoteHost {
  phase: HostPhase;
  pin: string;
  expiresAt: number;
  self: RemotePeer | null;
  pending: RemotePeer[];
  controllers: RemotePeer[];
  error: string;
  start(): void;
  stop(): void;
  approve(id: string): void;
  deny(id: string): void;
  kick(id: string): void;
  regenerate(): void;
}

const PLAYING_TICK_MS = 1000;
const IDLE_TICK_MS = 5000;

function snapshot(player: PlayerContextValue): RemoteState {
  const track = player.current?.track ?? null;
  return {
    hasTrack: Boolean(track),
    title: track?.title ?? '',
    artist: track ? displayArtist(track) : '',
    album: track?.album ?? '',
    currentTime: player.currentTime,
    duration: player.duration,
    isPlaying: player.isPlaying,
    volume: player.volume,
    maxVolume: MAX_VOLUME,
    shuffled: player.shuffled,
    repeatMode: player.repeatMode,
    position: player.position
  };
}

function queueSnapshot(player: PlayerContextValue): RemoteQueueEntry[] {
  return player.queue.slice(0, MAX_QUEUE_ENTRIES).map((item) => ({
    key: item.key,
    title: item.track.title,
    artist: displayArtist(item.track),
    duration: item.track.duration
  }));
}

function applyCommand(player: PlayerContextValue, cmd: RemoteCommand): void {
  switch (cmd.t) {
    case 'toggle':
      player.togglePlay();
      return;
    case 'next':
      player.next();
      return;
    case 'prev':
      player.prev();
      return;
    case 'seek':
      player.seek(cmd.time);
      return;
    case 'volume':
      player.setVolume(cmd.volume);
      return;
    case 'shuffle':
      player.toggleShuffle();
      return;
    case 'repeat':
      player.cycleRepeat();
      return;
    case 'jumble':
      player.jumbleQueue();
      return;
    case 'jump':
      player.jumpTo(cmd.index);
      return;
    case 'remove':
      player.removeAt(cmd.index);
      return;
  }
}

export function useRemoteHost(): RemoteHost {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;

  const socketRef = useRef<WebSocket | null>(null);
  const keepaliveRef = useRef<(() => void) | null>(null);
  const lastStateRef = useRef('');
  const lastQueueRef = useRef('');

  const [phase, setPhase] = useState<HostPhase>('idle');
  const [pin, setPin] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [self, setSelf] = useState<RemotePeer | null>(null);
  const [pending, setPending] = useState<RemotePeer[]>([]);
  const [controllers, setControllers] = useState<RemotePeer[]>([]);
  const [error, setError] = useState('');

  const send = useCallback((message: HostOutbound) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const pushState = useCallback(
    (force = false) => {
      const state = snapshot(playerRef.current);
      const signature = JSON.stringify({ ...state, currentTime: 0 });
      if (!force && signature === lastStateRef.current) return;
      lastStateRef.current = signature;
      send({ t: 'state', state });
    },
    [send]
  );

  const pushQueue = useCallback(
    (force = false) => {
      const items = queueSnapshot(playerRef.current);
      const encoded = JSON.stringify(items);
      if (!force && encoded === lastQueueRef.current) return;
      lastQueueRef.current = encoded;
      send({ t: 'queue', items });
    },
    [send]
  );

  const stop = useCallback(() => {
    keepaliveRef.current?.();
    keepaliveRef.current = null;
    socketRef.current?.close(1000, 'host left');
    socketRef.current = null;
    setPhase('idle');
    setPin('');
    setExpiresAt(0);
    setSelf(null);
    setPending([]);
    setControllers([]);
  }, []);

  const start = useCallback(() => {
    if (socketRef.current) return;
    setPhase('connecting');
    setError('');

    const socket = new WebSocket(remoteUrl('host'));
    socketRef.current = socket;
    const stopKeepalive = startKeepalive(socket);
    keepaliveRef.current = stopKeepalive;

    socket.addEventListener('message', (event) => {
      const message = parseMessage<HostInbound>(event.data);
      if (!message) return;

      switch (message.t) {
        case 'ready':
          setPhase('live');
          setPin(message.pin);
          setExpiresAt(message.expiresAt);
          setSelf(message.peer);
          return;
        case 'pin':
          setPin(message.pin);
          setExpiresAt(message.expiresAt);
          return;
        case 'request':
          setPending((list) => [...list.filter((p) => p.id !== message.peer.id), message.peer]);
          return;
        case 'withdrawn':
          setPending((list) => list.filter((p) => p.id !== message.id));
          return;
        case 'joined':
          setPending((list) => list.filter((p) => p.id !== message.peer.id));
          setControllers((list) => [...list.filter((p) => p.id !== message.peer.id), message.peer]);
          pushState(true);
          pushQueue(true);
          return;
        case 'left':
          setControllers((list) => list.filter((p) => p.id !== message.id));
          setPending((list) => list.filter((p) => p.id !== message.id));
          return;
        case 'command':
          applyCommand(playerRef.current, message.cmd);
          return;
        case 'expired':
          setError(message.reason);
          setPhase('error');
          setPending([]);
          setControllers([]);
          keepaliveRef.current?.();
          keepaliveRef.current = null;
          socketRef.current = null;
          socket.close(1000, 'expired');
          return;
        case 'error':
          setError(message.message);
          return;
      }
    });

    socket.addEventListener('error', () => {
      setError('The connection has been severed');
    });

    socket.addEventListener('close', () => {
      stopKeepalive();
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setPhase((current) => (current === 'idle' ? current : 'error'));
      setPending([]);
      setControllers([]);
      setError((current) => current || 'The remote session ended unexpectedly');
    });
  }, [pushQueue, pushState]);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (phase !== 'live' || controllers.length === 0) return;
    pushState();
  }, [
    phase,
    controllers.length,
    pushState,
    player.current,
    player.isPlaying,
    player.duration,
    player.volume,
    player.shuffled,
    player.repeatMode,
    player.position
  ]);

  useEffect(() => {
    if (phase !== 'live' || controllers.length === 0) return;
    pushQueue();
  }, [phase, controllers.length, pushQueue, player.queue]);

  useEffect(() => {
    if (phase !== 'live' || controllers.length === 0) return;
    const interval = player.isPlaying ? PLAYING_TICK_MS : IDLE_TICK_MS;
    const timer = window.setInterval(() => pushState(true), interval);
    return () => window.clearInterval(timer);
  }, [phase, controllers.length, player.isPlaying, pushState]);

  const approve = useCallback(
    (id: string) => {
      send({ t: 'approve', id });
    },
    [send]
  );

  const deny = useCallback(
    (id: string) => {
      setPending((list) => list.filter((p) => p.id !== id));
      send({ t: 'deny', id });
    },
    [send]
  );

  const kick = useCallback(
    (id: string) => {
      setControllers((list) => list.filter((p) => p.id !== id));
      send({ t: 'kick', id });
    },
    [send]
  );

  const regenerate = useCallback(() => {
    send({ t: 'regen' });
    toast.info('Regenerating the PIN...');
  }, [send]);

  return {
    phase,
    pin,
    expiresAt,
    self,
    pending,
    controllers,
    error,
    start,
    stop,
    approve,
    deny,
    kick,
    regenerate
  };
}
