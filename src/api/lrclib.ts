import type { Lyrics, TrackMeta } from '../types';
import { parseLrc } from '../utils/lyrics';

const BASE = 'https://lrclib.net/api';

export type LrclibMode = 'strict' | 'lax';

interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

async function getStrict(track: TrackMeta, signal?: AbortSignal): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.title,
    album_name: track.album,
    duration: String(Math.round(track.duration))
  });
  const res = await fetch(`${BASE}/get?${params}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB responded with ${res.status}`);
  return res.json();
}

async function searchLax(track: TrackMeta, signal?: AbortSignal): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.title
  });
  const res = await fetch(`${BASE}/search?${params}`, { signal });
  if (!res.ok) throw new Error(`LRCLIB responded with ${res.status}`);
  const results: LrclibRecord[] = await res.json();
  const score = (r: LrclibRecord) => {
    let s = r.syncedLyrics ? 4 : r.plainLyrics ? 1 : 0;
    if (track.duration > 0 && r.duration > 0) {
      s += 2 / (1 + Math.abs(r.duration - track.duration));
    }
    return s;
  };
  const best = results
    .filter((r) => r.syncedLyrics || r.plainLyrics || r.instrumental)
    .sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
}

export async function fetchLyrics(
  track: TrackMeta,
  mode: LrclibMode,
  signal?: AbortSignal
): Promise<Lyrics | null> {
  const record = mode === 'strict' ? await getStrict(track, signal) : await searchLax(track, signal);
  if (!record) return null;
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    if (lines.length > 0) return { synced: true, source: 'lrclib', lines };
  }
  if (record.plainLyrics) {
    const lines = record.plainLyrics
      .split(/\r?\n/)
      .map((text) => ({ time: null, text: text.trim() }));
    return { synced: false, source: 'lrclib', lines };
  }
  if (record.instrumental) {
    return { synced: false, source: 'lrclib', lines: [{ time: null, text: 'This song is an instrumental' }] };
  }
  return null;
}
