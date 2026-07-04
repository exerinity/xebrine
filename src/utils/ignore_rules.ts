import type { TrackMeta } from '../types';

export type IgnoredFormat = 'mp3' | 'aac' | 'm4a' | 'opus' | 'ogg' | 'flac' | 'wav';

export const IGNORABLE_FORMATS: IgnoredFormat[] = ['mp3', 'aac', 'm4a', 'opus', 'ogg', 'flac', 'wav'];

export interface IgnoreRules {
  missingCover: boolean;
  missingAlbum: boolean;
  missingArtist: boolean;
  missingTitle: boolean;
  missingAllTags: boolean;
  formats: IgnoredFormat[];
}

export const DEFAULT_IGNORE_RULES: IgnoreRules = {
  missingCover: false,
  missingAlbum: false,
  missingArtist: false,
  missingTitle: false,
  missingAllTags: false,
  formats: []
};

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function shouldIgnoreTrack(track: TrackMeta, rules: IgnoreRules): boolean {
  if (rules.missingCover && !track.hasCoverArt) return true;
  if (rules.missingAlbum && !track.hasAlbumTag) return true;
  if (rules.missingArtist && !track.hasArtistTag) return true;
  if (rules.missingTitle && !track.hasTitleTag) return true;
  if (rules.missingAllTags && !track.hasTitleTag && !track.hasArtistTag && !track.hasAlbumTag) return true;
  if (rules.formats.includes(extensionOf(track.fileName) as IgnoredFormat)) return true;
  return false;
}
