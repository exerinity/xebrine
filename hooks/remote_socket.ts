import { KEEPALIVE_MS, KEEPALIVE_PING } from '../utils/remote_protocol';

export function remoteUrl(path: string, query?: Record<string, string>): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  return `${protocol}//${window.location.host}/i/services/remote/${path}${search}`;
}

export function startKeepalive(socket: WebSocket): () => void {
  const timer = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send(KEEPALIVE_PING);
  }, KEEPALIVE_MS);
  return () => window.clearInterval(timer);
}

export function parseMessage<T>(data: unknown): T | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}
