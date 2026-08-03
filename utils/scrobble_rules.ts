import type { TrackMeta } from '../types';

export type ScrobbleMode = 'strict' | 'lax';

export const MIN_SCROBBLE_DURATION = 30;
export const SCROBBLE_CAP_SECONDS = 240;

export interface ScrobblePayload {
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  duration?: number;
  trackNumber?: number;
}

export interface ScrobbleIgnoreRules {
  missingTitle: boolean;
  missingArtist: boolean;
  missingAlbum: boolean;
  missingCover: boolean;
  minDurationSeconds: number | null;
}

export const DEFAULT_SCROBBLE_IGNORE_RULES: ScrobbleIgnoreRules = {
  missingTitle: false,
  missingArtist: false,
  missingAlbum: false,
  missingCover: false,
  minDurationSeconds: null
};

export function normalizeScrobbleIgnoreRules(
  rules: Partial<ScrobbleIgnoreRules> | null | undefined
): ScrobbleIgnoreRules {
  const merged = { ...DEFAULT_SCROBBLE_IGNORE_RULES, ...rules };
  const min = merged.minDurationSeconds;
  return {
    missingTitle: Boolean(merged.missingTitle),
    missingArtist: Boolean(merged.missingArtist),
    missingAlbum: Boolean(merged.missingAlbum),
    missingCover: Boolean(merged.missingCover),
    minDurationSeconds:
      typeof min === 'number' && Number.isFinite(min) && min > 0 ? Math.min(min, 3600) : null
  };
}

const PLACEHOLDER = /^(unknown|unknown artist|unknown album|untitled|n\/a|\[unknown\])$/i;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

function usable(value: string): boolean {
  return value.length > 0 && !PLACEHOLDER.test(value);
}

export function isScrobbleLength(duration: number): boolean {
  return duration > MIN_SCROBBLE_DURATION;
}

export function scrobbleThreshold(duration: number): number {
  return Math.min(duration / 2, SCROBBLE_CAP_SECONDS);
}

export function shouldIgnoreScrobble(track: TrackMeta, rules: ScrobbleIgnoreRules): boolean {
  if (rules.missingTitle && !track.hasTitleTag) return true;
  if (rules.missingArtist && !track.hasArtistTag) return true;
  if (rules.missingAlbum && !track.hasAlbumTag) return true;
  if (rules.missingCover && !track.hasCoverArt) return true;
  if (rules.minDurationSeconds !== null && track.duration < rules.minDurationSeconds) return true;
  return false;
}

export function buildScrobblePayload(track: TrackMeta, mode: ScrobbleMode): ScrobblePayload | null {
  const artist = clean(track.artist);
  const title = clean(track.title);
  if (!usable(artist) || !usable(title)) return null;
  if (mode === 'lax') return { artist, track: title };

  const payload: ScrobblePayload = { artist, track: title };
  const album = clean(track.album);
  if (usable(album)) payload.album = album;
  const albumArtist = clean(track.albumArtist);
  if (usable(albumArtist) && albumArtist !== artist) payload.albumArtist = albumArtist;
  if (track.duration > 0) payload.duration = Math.round(track.duration);
  if (track.trackNo && track.trackNo > 0) payload.trackNumber = track.trackNo;
  return payload;
}
