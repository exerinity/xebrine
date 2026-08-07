import { sendScrobbles } from '../api/lastfm';
import { dbDelete, dbGetAll, dbPut, dbWriteBatch } from './db';

const MAX_BATCH = 50;
const MAX_ATTEMPTS = 20;

/**
 * @typedef {import('../api/lastfm').ScrobbleEntry & { id: string, attempts: number, lastError?: string }} PendingScrobble
 */

const listeners = new Set();

function announce() {
  for (const listener of listeners) listener();
}

export function subscribePending(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toEntry(item) {
  return {
    artist: item.artist,
    track: item.track,
    album: item.album,
    albumArtist: item.albumArtist,
    duration: item.duration,
    trackNumber: item.trackNumber,
    timestamp: item.timestamp
  };
}

export async function pendingScrobbles() {
  const all = await dbGetAll('scrobbles');
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function queueScrobble(entry) {
  const id = `${entry.timestamp}-${entry.artist}-${entry.track}`;
  await dbPut('scrobbles', { ...entry, id, attempts: 0 });
  announce();
}

export async function discardScrobble(id) {
  await dbDelete('scrobbles', id);
  announce();
}

export async function clearPending() {
  const all = await pendingScrobbles();
  await dbWriteBatch('scrobbles', [], all.map((item) => item.id));
  announce();
}

export async function flushScrobbles(sessionKey) {
  if (!navigator.onLine) return 0;
  const all = await pendingScrobbles();
  if (all.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    const batch = all.slice(i, i + MAX_BATCH);
    try {
      await sendScrobbles(sessionKey, batch.map(toEntry));
      await dbWriteBatch('scrobbles', [], batch.map((item) => item.id));
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const retries = [];
      const exhausted = [];
      for (const item of batch) {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) exhausted.push(item.id);
        else retries.push({ ...item, attempts, lastError: message });
      }
      await dbWriteBatch('scrobbles', retries, exhausted);
      announce();
      throw error;
    }
  }

  announce();
  return sent;
}
