export interface LastfmSession {
  username: string;
  sessionKey: string;
}

const KEY = 'xebrine.lastfm';

function load(): LastfmSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastfmSession>;
    if (typeof parsed?.username !== 'string' || typeof parsed?.sessionKey !== 'string') return null;
    if (!parsed.username || !parsed.sessionKey) return null;
    return { username: parsed.username, sessionKey: parsed.sessionKey };
  } catch {
    return null;
  }
}

let session: LastfmSession | null = load();
const listeners = new Set<() => void>();

export function getLastfmSession(): LastfmSession | null {
  return session;
}

export function setLastfmSession(next: LastfmSession | null): void {
  session = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    null;
  }
  for (const listener of listeners) listener();
}

export function subscribeLastfmSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
