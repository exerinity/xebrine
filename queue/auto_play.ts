import { displayArtist } from '../utils/groups';
import type { TrackMeta } from '../types';

export const AUTO_PLAY_LEVELS = [1, 2, 3, 4] as const;
export type AutoPlayLevel = (typeof AUTO_PLAY_LEVELS)[number];

export const AUTO_PLAY_LABELS: Record<AutoPlayLevel, string> = {
  1: 'Anything',
  2: 'Same artist',
  3: 'Artist + length',
  4: 'Similar length'
};

const FALLBACKS: Record<AutoPlayLevel, AutoPlayLevel[]> = {
  1: [1],
  2: [2, 1],
  3: [3, 2, 1],
  4: [4, 1]
};

const LENGTH_TOLERANCE = 0.2;

export function isAutoPlayLevel(value: unknown): value is AutoPlayLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function sameArtist(candidate: TrackMeta, finished: TrackMeta): boolean {
  return displayArtist(candidate).toLowerCase() === displayArtist(finished).toLowerCase();
}

function similarLength(candidate: TrackMeta, finished: TrackMeta): boolean {
  if (!finished.duration || !candidate.duration) return false;
  return Math.abs(candidate.duration - finished.duration) <= finished.duration * LENGTH_TOLERANCE;
}

function matches(candidate: TrackMeta, finished: TrackMeta, level: AutoPlayLevel): boolean {
  switch (level) {
    case 1:
      return true;
    case 2:
      return sameArtist(candidate, finished);
    case 3:
      return sameArtist(candidate, finished) && similarLength(candidate, finished);
    case 4:
      return similarLength(candidate, finished);
  }
}

export function pickAutoPlayTrack(
  library: TrackMeta[],
  finished: TrackMeta,
  level: AutoPlayLevel,
  recentIds: string[] = []
): TrackMeta | null {
  const pool = library.filter((track) => track.id !== finished.id);
  if (pool.length === 0) return null;

  const recent = new Set(recentIds);

  for (const attempt of FALLBACKS[level]) {
    const candidates = pool.filter((track) => matches(track, finished, attempt));
    if (candidates.length === 0) continue;
    const fresh = candidates.filter((track) => !recent.has(track.id));
    const from = fresh.length > 0 ? fresh : candidates;
    return from[Math.floor(Math.random() * from.length)];
  }

  return null;
}
