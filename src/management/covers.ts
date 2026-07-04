import { dbGet, dbPut } from './db';
import { readCoverArt } from './metadata';
import type { TrackMeta } from '../types';

interface StoredCover {
  key: string;
  blob: Blob;
}

const memCache = new Map<string, Promise<string | null>>();

const MAX_CONCURRENT = 4;
let active = 0;
const waiters: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}
export function getAlbumArt(
  key: string,
  sample: TrackMeta,
  getFile: (track: TrackMeta) => Promise<File>
): Promise<string | null> {
  let promise = memCache.get(key);
  if (!promise) {
    promise = withSlot(() => load(key, sample, getFile));
    memCache.set(key, promise);
  }
  return promise;
}

async function load(
  key: string,
  sample: TrackMeta,
  getFile: (track: TrackMeta) => Promise<File>
): Promise<string | null> {
  try {
    const stored = await dbGet<StoredCover>('covers', key);
    if (stored) return stored.blob.size > 0 ? URL.createObjectURL(stored.blob) : null;
    const file = await getFile(sample);
    const art = await readCoverArt(file);
    await dbPut('covers', { key, blob: art ?? new Blob([]) } satisfies StoredCover);
    return art ? URL.createObjectURL(art) : null;
  } catch {
    memCache.delete(key);
    return null;
  }
}
