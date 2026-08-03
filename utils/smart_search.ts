import type { TrackMeta } from '../types';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j - 1], dp[j]);
      prev = temp;
    }
  }
  return dp[b.length];
}

function fuzzyThreshold(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

function scoreTokenAgainstWords(token: string, docWords: string[]): number {
  let best = 0;
  for (const w of docWords) {
    if (w === token) return 100;
    if (w.startsWith(token) || token.startsWith(w)) best = Math.max(best, 78);
    else if (w.includes(token)) best = Math.max(best, 60);
  }
  if (best > 0) return best;
  const threshold = fuzzyThreshold(token.length);
  if (threshold > 0) {
    for (const w of docWords) {
      if (Math.abs(w.length - token.length) > threshold) continue;
      const d = levenshtein(token, w);
      if (d <= threshold) best = Math.max(best, 45 - d * 10);
    }
  }
  return best;
}

export interface SearchIndexEntry {
  track: TrackMeta;
  titleWords: string[];
  artistWords: string[];
  albumWords: string[];
  titleNormalized: string;
}

export function buildSearchIndex(tracks: TrackMeta[]): SearchIndexEntry[] {
  return tracks.map((track) => ({
    track,
    titleWords: words(track.title),
    artistWords: words(track.artist),
    albumWords: words(track.album),
    titleNormalized: normalize(track.title)
  }));
}

export function searchIndex(index: SearchIndexEntry[], query: string): TrackMeta[] {
  const tokens = words(query);
  if (tokens.length === 0) return [];
  const fullQuery = tokens.join(' ');
  const scored: { track: TrackMeta; score: number }[] = [];

  for (const entry of index) {
    let total = 0;
    let matched = true;
    for (const token of tokens) {
      const best = Math.max(
        scoreTokenAgainstWords(token, entry.titleWords) * 1.3,
        scoreTokenAgainstWords(token, entry.artistWords) * 1.15,
        scoreTokenAgainstWords(token, entry.albumWords)
      );
      if (best <= 0) {
        matched = false;
        break;
      }
      total += best;
    }
    if (!matched) continue;
    if (entry.titleNormalized === fullQuery) total += 500;
    else if (entry.titleNormalized.includes(fullQuery)) total += 150;
    scored.push({ track: entry.track, score: total });
  }

  scored.sort((a, b) => b.score - a.score || a.track.title.localeCompare(b.track.title));
  return scored.map((s) => s.track);
}

export function searchTracks(tracks: TrackMeta[], query: string): TrackMeta[] {
  return searchIndex(buildSearchIndex(tracks), query);
}
