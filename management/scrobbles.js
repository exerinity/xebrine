import { sendScrobbles } from '../api/lastfm';
import { dbDelete, dbGetAll, dbPut, dbWriteBatch } from './db';
import { is_online } from '../utils/online_status';

const MAX_BATCH = 50;
let activeFlush = Promise.resolve();

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

async function flushPending(sessionKey) {
  if (!is_online()) return 0;
  const all = await pendingScrobbles();
  if (all.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    if (!is_online()) break;
    const batch = all.slice(i, i + MAX_BATCH);
    try {
      await sendScrobbles(sessionKey, batch.map(toEntry));
      await dbWriteBatch('scrobbles', [], batch.map((item) => item.id));
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = typeof error?.status === 'number' ? error.status : 0;
      const transient = !is_online() || error instanceof TypeError || status === 429 || status >= 500;
      if (transient) {
        await dbWriteBatch('scrobbles', batch.map((item) => ({ ...item, lastError: message })));
        announce();
        throw error;
      }
      const retries = batch.map((item) => ({ ...item, attempts: item.attempts + 1, lastError: message }));
      await dbWriteBatch('scrobbles', retries);
      announce();
      throw error;
    }
  }

  announce();
  return sent;
}

export function flushScrobbles(sessionKey) {
  const result = activeFlush.then(() => flushPending(sessionKey));
  activeFlush = result.catch(() => undefined);
  return result;
}
