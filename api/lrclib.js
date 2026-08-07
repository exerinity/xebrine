import { parseLrc } from '../utils/lyrics';

const BASE = 'https://lrclib.net/api';

/** @typedef {'strict' | 'lax'} LrclibMode */

async function getStrict(track, signal) {
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

async function searchLax(track, signal) {
  const params = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.title
  });
  const res = await fetch(`${BASE}/search?${params}`, { signal });
  if (!res.ok) throw new Error(`LRCLIB responded with ${res.status}`);
  const results = await res.json();
  const score = (r) => {
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

/**
 * @param {import('../types').TrackMeta} track
 * @param {LrclibMode} mode
 * @param {AbortSignal} [signal]
 * @returns {Promise<import('../types').Lyrics | null>}
 */
export async function fetchLyrics(track, mode, signal) {
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
