import { clamp } from './format';

/** @typedef {'mp3' | 'aac' | 'm4a' | 'opus' | 'ogg' | 'flac' | 'wav'} IgnoredFormat */

/** @type {IgnoredFormat[]} */
export const IGNORABLE_FORMATS = ['mp3', 'aac', 'm4a', 'opus', 'ogg', 'flac', 'wav'];

/**
 * @typedef {Object} IgnoreRules
 * @property {boolean} missingCover
 * @property {boolean} missingAlbum
 * @property {boolean} missingArtist
 * @property {boolean} missingTitle
 * @property {boolean} missingAllTags
 * @property {IgnoredFormat[]} formats
 * @property {number | null} maxSizeBytes
 */

export const MIN_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;
export const MAX_SIZE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
export const DEFAULT_SIZE_LIMIT_BYTES = 100 * 1024 * 1024;
export const SIZE_QUIP_THRESHOLD_BYTES = 750 * 1024 * 1024;

export const DEFAULT_IGNORE_RULES = {
  missingCover: false,
  missingAlbum: false,
  missingArtist: false,
  missingTitle: false,
  missingAllTags: false,
  formats: [],
  maxSizeBytes: null
};

export function normalizeIgnoreRules(rules) {
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

function extensionOf(fileName) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isIgnoredFormat(fileName, rules) {
  return rules.formats.includes(extensionOf(fileName));
}

export function isIgnoredSize(sizeBytes, rules) {
  return rules.maxSizeBytes !== null && sizeBytes > rules.maxSizeBytes;
}

export function shouldIgnoreTrack(track, rules) {
  if (rules.missingCover && !track.hasCoverArt) return true;
  if (rules.missingAlbum && !track.hasAlbumTag) return true;
  if (rules.missingArtist && !track.hasArtistTag) return true;
  if (rules.missingTitle && !track.hasTitleTag) return true;
  if (rules.missingAllTags && !track.hasTitleTag && !track.hasArtistTag && !track.hasAlbumTag) return true;
  if (rules.formats.includes(extensionOf(track.fileName))) return true;
  if (rules.maxSizeBytes !== null && track.sizeBytes > rules.maxSizeBytes) return true;
  return false;
}
