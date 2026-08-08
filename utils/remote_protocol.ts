export const PIN_LENGTH = 9;
export const PIN_TTL_MS = 10 * 60 * 1000;
export const IDLE_NO_REMOTE_MS = 5 * 60 * 1000;
export const IDLE_NO_COMMAND_MS = 10 * 60 * 1000;
export const MAX_CONTROLLERS = 8;
export const MAX_PENDING = 5;
export const MAX_QUEUE_ENTRIES = 200;
export const KEEPALIVE_MS = 25_000;
export const KEEPALIVE_PING = 'ping';
export const KEEPALIVE_PONG = 'pong';

export type RemoteRepeatMode = 'off' | 'all' | 'one';

export interface RemotePeer {
  id: string;
  device: string;
  ip: string;
  country: string;
}

export interface RemoteState {
  hasTrack: boolean;
  title: string;
  artist: string;
  album: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  maxVolume: number;
  shuffled: boolean;
  repeatMode: RemoteRepeatMode;
  position: number;
}

export interface RemoteQueueEntry {
  key: string;
  title: string;
  artist: string;
  duration: number;
}

export type RemoteCommand =
  | { t: 'toggle' }
  | { t: 'next' }
  | { t: 'prev' }
  | { t: 'seek'; time: number }
  | { t: 'volume'; volume: number }
  | { t: 'shuffle' }
  | { t: 'repeat' }
  | { t: 'jumble' }
  | { t: 'jump'; index: number }
  | { t: 'remove'; index: number };

export type HostInbound =
  | { t: 'ready'; pin: string; expiresAt: number; peer: RemotePeer }
  | { t: 'pin'; pin: string; expiresAt: number }
  | { t: 'request'; peer: RemotePeer }
  | { t: 'withdrawn'; id: string }
  | { t: 'joined'; peer: RemotePeer }
  | { t: 'left'; id: string }
  | { t: 'command'; id: string; cmd: RemoteCommand }
  | { t: 'expired'; reason: string }
  | { t: 'error'; message: string };

export type HostOutbound =
  | { t: 'approve'; id: string }
  | { t: 'deny'; id: string }
  | { t: 'kick'; id: string }
  | { t: 'regen' }
  | { t: 'state'; state: RemoteState }
  | { t: 'queue'; items: RemoteQueueEntry[] };

export type ControlInbound =
  | { t: 'pending' }
  | { t: 'approved'; host: RemotePeer }
  | { t: 'denied' }
  | { t: 'state'; state: RemoteState }
  | { t: 'queue'; items: RemoteQueueEntry[] }
  | { t: 'ended'; reason: string }
  | { t: 'error'; message: string };

export type ControlOutbound = { t: 'cmd'; cmd: RemoteCommand };

export function normalizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export function isValidPin(pin: string): boolean {
  return pin.length === PIN_LENGTH && /^\d+$/.test(pin);
}

export function formatPin(pin: string): string {
  return pin.replace(/(\d{3})(?=\d)/g, '$1 ');
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function asCommand(raw: unknown): RemoteCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const cmd = raw as Record<string, unknown>;
  switch (cmd.t) {
    case 'toggle':
    case 'next':
    case 'prev':
    case 'shuffle':
    case 'repeat':
    case 'jumble':
      return { t: cmd.t };
    case 'seek':
      return isFinitePositive(cmd.time) ? { t: 'seek', time: cmd.time } : null;
    case 'volume':
      return isFinitePositive(cmd.volume) ? { t: 'volume', volume: cmd.volume } : null;
    case 'jump':
      return Number.isInteger(cmd.index) ? { t: 'jump', index: cmd.index as number } : null;
    case 'remove':
      return Number.isInteger(cmd.index) ? { t: 'remove', index: cmd.index as number } : null;
    default:
      return null;
  }
}
