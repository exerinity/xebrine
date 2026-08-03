import { sendScrobbles, type ScrobbleEntry } from '../api/lastfm';
import { dbDelete, dbGetAll, dbPut } from './db';

const MAX_BATCH = 50;
const MAX_ATTEMPTS = 20;

export interface PendingScrobble extends ScrobbleEntry {
  id: string;
  attempts: number;
  lastError?: string;
}

const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

export function subscribePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toEntry(item: PendingScrobble): ScrobbleEntry {
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

export async function pendingScrobbles(): Promise<PendingScrobble[]> {
  const all = await dbGetAll<PendingScrobble>('scrobbles');
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function queueScrobble(entry: ScrobbleEntry): Promise<void> {
  const id = `${entry.timestamp}-${entry.artist}-${entry.track}`;
  await dbPut('scrobbles', { ...entry, id, attempts: 0 } satisfies PendingScrobble);
  announce();
}

export async function discardScrobble(id: string): Promise<void> {
  await dbDelete('scrobbles', id);
  announce();
}

export async function clearPending(): Promise<void> {
  const all = await pendingScrobbles();
  for (const item of all) await dbDelete('scrobbles', item.id);
  announce();
}

export async function flushScrobbles(sessionKey: string): Promise<number> {
  if (!navigator.onLine) return 0;
  const all = await pendingScrobbles();
  if (all.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    const batch = all.slice(i, i + MAX_BATCH);
    try {
      await sendScrobbles(sessionKey, batch.map(toEntry));
      for (const item of batch) await dbDelete('scrobbles', item.id);
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      for (const item of batch) {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) await dbDelete('scrobbles', item.id);
        else await dbPut('scrobbles', { ...item, attempts, lastError: message });
      }
      announce();
      throw error;
    }
  }

  announce();
  return sent;
}
