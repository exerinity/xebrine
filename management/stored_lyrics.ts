import { dbDelete, dbPut } from './db';
import type { Lyrics, StoredLyrics } from '../types';

interface LyricsChange {
  trackId: string;
  lyrics: Lyrics | null;
}

const listeners = new Set<(change: LyricsChange) => void>();

export function subscribeLyricsChanges(listener: (change: LyricsChange) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(change: LyricsChange): void {
  for (const listener of listeners) listener(change);
}

export async function saveLyrics(trackId: string, lyrics: Lyrics): Promise<void> {
  const stored = { trackId, lyrics } satisfies StoredLyrics;
  await dbPut('lyrics', stored);
  notify(stored);
}

export async function deleteLyrics(trackId: string): Promise<void> {
  await dbDelete('lyrics', trackId);
  notify({ trackId, lyrics: null });
}
