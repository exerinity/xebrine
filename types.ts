export interface BrowserFolderRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

export interface ElectronFolderRecord {
  id: string;
  name: string;
  electronId: string;
}

export type FolderRecord = BrowserFolderRecord | ElectronFolderRecord;

export interface TrackMeta {
  id: string;
  folderId: string;
  relPath: string[];
  fileName: string;
  sizeBytes: number;
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

export interface LyricLine {
  time: number | null;
  text: string;
}

export interface Lyrics {
  synced: boolean;
  source: 'lrclib' | 'file';
  lines: LyricLine[];
}

export interface StoredLyrics {
  trackId: string;
  lyrics: Lyrics;
}

export interface QueueItem {
  key: string;
  track: TrackMeta;
}
