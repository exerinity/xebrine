import type { TrackMeta } from '../types';
import { clamp } from './format';

export type IgnoredFormat = 'mp3' | 'aac' | 'm4a' | 'opus' | 'ogg' | 'flac' | 'wav';

export const IGNORABLE_FORMATS: IgnoredFormat[] = ['mp3', 'aac', 'm4a', 'opus', 'ogg', 'flac', 'wav'];

export interface IgnoreRules {
  missingCover: boolean;
  missingAlbum: boolean;
  missingArtist: boolean;
  missingTitle: boolean;
  missingAllTags: boolean;
  formats: IgnoredFormat[];
  maxSizeBytes: number | null;
}

export const MIN_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;
export const MAX_SIZE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
export const DEFAULT_SIZE_LIMIT_BYTES = 100 * 1024 * 1024;
export const SIZE_QUIP_THRESHOLD_BYTES = 750 * 1024 * 1024;

export const DEFAULT_IGNORE_RULES: IgnoreRules = {
  missingCover: false,
  missingAlbum: false,
  missingArtist: false,
  missingTitle: false,
  missingAllTags: false,
  formats: [],
  maxSizeBytes: null
};

export function normalizeIgnoreRules(rules: Partial<IgnoreRules> | null | undefined): IgnoreRules {
  const merged = { ...DEFAULT_IGNORE_RULES, ...rules };
  const max = merged.maxSizeBytes;
  return {
    ...merged,
    formats: Array.isArray(merged.formats) ? merged.formats : [],
    maxSizeBytes:
      typeof max === 'number' && Number.isFinite(max)
        ? clamp(max, MIN_SIZE_LIMIT_BYTES, MAX_SIZE_LIMIT_BYTES)
        : null
  };
}

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isIgnoredFormat(fileName: string, rules: IgnoreRules): boolean {
  return rules.formats.includes(extensionOf(fileName) as IgnoredFormat);
}

export function isIgnoredSize(sizeBytes: number, rules: IgnoreRules): boolean {
  return rules.maxSizeBytes !== null && sizeBytes > rules.maxSizeBytes;
}

export function shouldIgnoreTrack(track: TrackMeta, rules: IgnoreRules): boolean {
  if (rules.missingCover && !track.hasCoverArt) return true;
  if (rules.missingAlbum && !track.hasAlbumTag) return true;
  if (rules.missingArtist && !track.hasArtistTag) return true;
  if (rules.missingTitle && !track.hasTitleTag) return true;
  if (rules.missingAllTags && !track.hasTitleTag && !track.hasArtistTag && !track.hasAlbumTag) return true;
  if (rules.formats.includes(extensionOf(track.fileName) as IgnoredFormat)) return true;
  if (rules.maxSizeBytes !== null && track.sizeBytes > rules.maxSizeBytes) return true;
  return false;
}
