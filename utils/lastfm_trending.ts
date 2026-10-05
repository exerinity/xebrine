import type { TrackMeta } from '../types';

export interface TrendingTrack {
  title: string;
  artist: string;
  image: string | null;
  playcount?: number;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*[([]\s*(?:feat\.?|ft\.?)\s+[^)\]]*[)\]]/g, '')
    .replace(/\s+\b(?:feat\.?|ft\.?)\s+.*$/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function key(title: string, artist: string): string {
  return `${normalize(title)}\u0000${normalize(artist)}`;
}

export function matchTrendingTracks(chart: TrendingTrack[], library: TrackMeta[]) {
  const local = new Map<string, TrackMeta>();
  for (const track of library) {
    const trackKey = key(track.title, track.artist);
    if (!local.has(trackKey)) local.set(trackKey, track);
  }

  return chart.flatMap((entry) => {
    const track = local.get(key(entry.title, entry.artist));
    return track ? [{ entry, track }] : [];
  });
}
