import { parseBlob, selectCover } from 'music-metadata';

const MAX_COVER_PARSE_SIZE = 100 * 1024 * 1024;

export interface TrackTags {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  duration: number;
  trackNo?: number;
  year?: number;
  genre?: string;
  hasTitleTag: boolean;
  hasArtistTag: boolean;
  hasAlbumTag: boolean;
  hasCoverArt: boolean;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function fallbackTags(fileName: string): TrackTags {
  return {
    title: stripExtension(fileName),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    hasTitleTag: false,
    hasArtistTag: false,
    hasAlbumTag: false,
    hasCoverArt: false
  };
}

export async function readCoverArt(file: File): Promise<Blob | null> {
  if (file.size > MAX_COVER_PARSE_SIZE) return null;
  try {
    const meta = await parseBlob(file);
    const cover = selectCover(meta.common.picture);
    if (!cover) return null;
    return new Blob([cover.data as BlobPart], { type: cover.format });
  } catch {
    return null;
  }
}
