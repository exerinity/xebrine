import type { LastfmSession } from '../utils/lastfm_session';
import type { ScrobblePayload } from '../utils/scrobble_rules';

const BASE = '/i/services/lastfm';

export interface ScrobbleEntry extends ScrobblePayload {
  timestamp: number;
}

export interface LastfmProfile {
  name: string;
  realname: string;
  url: string;
  image: string | null;
  playcount: number;
  registered: number | null;
  country: string;
}

export interface RecentTrack {
  artist: string;
  track: string;
  album: string;
  url: string;
  image: string | null;
  nowPlaying: boolean;
  playedAt: number | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error || `Last.fm request failed (${res.status})`);
  return data as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function connectLastfm(): Promise<LastfmSession> {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${BASE}/auth/start`, 'xebrine-lastfm', 'width=520,height=760');
    if (!popup) {
      reject(new Error('Your browser blocked the Last.fm sign-in window'));
      return;
    }

    let settled = false;
    const finish = () => {
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(poll);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; error?: string } & Partial<LastfmSession>;
      if (!data || data.source !== 'xebrine-lastfm') return;
      finish();
      if (data.error || !data.username || !data.sessionKey) {
        reject(new Error(data.error || 'Last.fm did not return a session'));
        return;
      }
      resolve({ username: data.username, sessionKey: data.sessionKey });
    };

    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        finish();
        reject(new Error('The Last.fm sign-in was cancelled'));
      }
    }, 500);
  });
}

export function sendNowPlaying(sessionKey: string, track: ScrobblePayload): Promise<void> {
  return post('/nowplaying', { sessionKey, track: { ...track, timestamp: 0 } });
}

export function sendScrobbles(
  sessionKey: string,
  scrobbles: ScrobbleEntry[]
): Promise<{ accepted: number; ignored: number }> {
  return post('/scrobble', { sessionKey, scrobbles });
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const sized = images as { '#text'?: string; size?: string }[];
  const preferred =
    sized.find((i) => i.size === 'extralarge') ?? sized.find((i) => i.size === 'large') ?? sized[0];
  const url = preferred?.['#text'];
  return url ? url : null;
}

export async function fetchProfile(username: string): Promise<LastfmProfile> {
  const data = await request<{ user?: Record<string, unknown> }>(
    `/user?username=${encodeURIComponent(username)}`
  );
  const user = data.user ?? {};
  const registered = user.registered as { unixtime?: string } | undefined;
  return {
    name: String(user.name ?? username),
    realname: String(user.realname ?? ''),
    url: String(user.url ?? ''),
    image: firstImage(user.image),
    playcount: Number(user.playcount ?? 0),
    registered: registered?.unixtime ? Number(registered.unixtime) : null,
    country: String(user.country ?? '')
  };
}

export async function fetchRecentTracks(username: string, limit = 25): Promise<RecentTrack[]> {
  const data = await request<{ recenttracks?: { track?: unknown } }>(
    `/recent?username=${encodeURIComponent(username)}&limit=${limit}`
  );
  const raw = data.recenttracks?.track;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return (list as Record<string, unknown>[]).map((t) => {
    const attr = t['@attr'] as { nowplaying?: string } | undefined;
    const date = t.date as { uts?: string } | undefined;
    const artist = t.artist as { '#text'?: string; name?: string } | undefined;
    const album = t.album as { '#text'?: string } | undefined;
    return {
      artist: String(artist?.['#text'] ?? artist?.name ?? ''),
      track: String(t.name ?? ''),
      album: String(album?.['#text'] ?? ''),
      url: String(t.url ?? ''),
      image: firstImage(t.image),
      nowPlaying: attr?.nowplaying === 'true',
      playedAt: date?.uts ? Number(date.uts) : null
    };
  });
}
