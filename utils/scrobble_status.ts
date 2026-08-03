export type ScrobbleStatus = 'off' | 'ready' | 'tracking' | 'sending' | 'scrobbled' | 'failed';

export const SCROBBLE_STATUS_LABEL: Record<ScrobbleStatus, string> = {
  off: 'Disabled',
  ready: 'Ready',
  tracking: 'Scrobbling',
  sending: 'Sending...',
  scrobbled: 'Scrobbled',
  failed: 'Failed'
};

let status: ScrobbleStatus = 'ready';
const listeners = new Set<() => void>();

export function getScrobbleStatus(): ScrobbleStatus {
  return status;
}

export function setScrobbleStatus(next: ScrobbleStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}

export function subscribeScrobbleStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
