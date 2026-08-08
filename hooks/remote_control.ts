import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/player_context';
import {
  isValidPin,
  type ControlInbound,
  type ControlOutbound,
  type RemoteCommand,
  type RemotePeer,
  type RemoteQueueEntry,
  type RemoteState
} from '../utils/remote_protocol';
import { parseMessage, remoteUrl, startKeepalive } from './remote_socket';

export type ControlPhase =
  | 'idle'
  | 'connecting'
  | 'pending'
  | 'approved'
  | 'denied'
  | 'ended'
  | 'error';

export interface RemoteControl {
  phase: ControlPhase;
  host: RemotePeer | null;
  state: RemoteState | null;
  queue: RemoteQueueEntry[];
  error: string;
  connect(pin: string): void;
  disconnect(): void;
  send(cmd: RemoteCommand): void;
}

const LOCKED_PHASES: ControlPhase[] = ['connecting', 'pending', 'approved'];

export function useRemoteControl(): RemoteControl {
  const { setRemoteLocked } = usePlayer();
  const socketRef = useRef<WebSocket | null>(null);
  const keepaliveRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<ControlPhase>('idle');
  const [host, setHost] = useState<RemotePeer | null>(null);
  const [state, setState] = useState<RemoteState | null>(null);
  const [queue, setQueue] = useState<RemoteQueueEntry[]>([]);
  const [error, setError] = useState('');

  const release = useCallback(() => {
    keepaliveRef.current?.();
    keepaliveRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close(1000, 'done');
    setState(null);
    setQueue([]);
  }, []);

  const disconnect = useCallback(() => {
    release();
    setPhase('idle');
    setHost(null);
    setError('');
  }, [release]);

  const connect = useCallback((pin: string) => {
    if (socketRef.current || !isValidPin(pin)) return;
    setPhase('connecting');
    setError('');
    setState(null);
    setQueue([]);

    const socket = new WebSocket(remoteUrl('join', { pin }));
    socketRef.current = socket;
    const stopKeepalive = startKeepalive(socket);
    keepaliveRef.current = stopKeepalive;
    let rejected = false;

    socket.addEventListener('message', (event) => {
      const message = parseMessage<ControlInbound>(event.data);
      if (!message) return;

      switch (message.t) {
        case 'pending':
          setPhase('pending');
          return;
        case 'approved':
          setHost(message.host);
          setPhase('approved');
          return;
        case 'denied':
          rejected = true;
          setPhase('denied');
          release();
          return;
        case 'state':
          setState(message.state);
          return;
        case 'queue':
          setQueue(message.items);
          return;
        case 'ended':
          rejected = true;
          setPhase('ended');
          setError(message.reason);
          release();
          return;
        case 'error':
          rejected = true;
          setPhase('error');
          setError(message.message);
          release();
          return;
      }
    });

    socket.addEventListener('error', () => {
      if (!rejected) setError('The host could not be reached');
    });

    socket.addEventListener('close', () => {
      stopKeepalive();
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setState(null);
      setQueue([]);
      if (rejected) return;
      setPhase('ended');
      setError((current) => current || 'The connection to the host was severed');
    });
  }, [release]);

  const sendCmd = useCallback((cmd: RemoteCommand) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ t: 'cmd', cmd } satisfies ControlOutbound));
  }, []);

  const locked = LOCKED_PHASES.includes(phase);
  useEffect(() => {
    setRemoteLocked(locked);
  }, [locked, setRemoteLocked]);

  useEffect(() => {
    return () => {
      keepaliveRef.current?.();
      keepaliveRef.current = null;
      socketRef.current?.close(1000, 'controller left');
      socketRef.current = null;
      setRemoteLocked(false);
    };
  }, [setRemoteLocked]);

  return { phase, host, state, queue, error, connect, disconnect, send: sendCmd };
}
