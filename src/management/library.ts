import type { FolderRecord, TrackMeta } from '../types';
import { fallbackTags, MAX_PARSE_FILE_SIZE, readTrackTags, type TrackTags } from './metadata';
import { toast } from '../utils/toast';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'mp4', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'webm'
]);

function isAudioFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext !== undefined && AUDIO_EXTENSIONS.has(ext);
}

interface FoundFile {
  handle: FileSystemFileHandle;
  relPath: string[];
}

const DIR_LIST_TIMEOUT_MS = 15000;

async function listEntries(dir: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of dir.values()) entries.push(entry);
  return entries;
}

async function collectAudioFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string[] = []
): Promise<FoundFile[]> {
  const found: FoundFile[] = [];
  let entries: FileSystemHandle[];
  try {
    entries = await withTimeout(listEntries(dir), DIR_LIST_TIMEOUT_MS);
  } catch {
    toast.warning(`Couldn't list "${prefix.join('/') || dir.name}" — skipping that folder`);
    return found;
  }

  for (const entry of entries) {
    try {
      if (entry.kind === 'file') {
        if (isAudioFile(entry.name)) {
          found.push({ handle: entry as FileSystemFileHandle, relPath: [...prefix, entry.name] });
        }
      } else if (entry.kind === 'directory') {
        found.push(
          ...(await collectAudioFiles(entry as FileSystemDirectoryHandle, [...prefix, entry.name]))
        );
      }
    } catch {
      toast.warning(`Couldn't read "${[...prefix, entry.name].join('/')}" — skipping`);
    }
  }
  return found;
}

export function trackId(folderId: string, relPath: string[]): string {
  return `${folderId}:${relPath.join('/')}`;
}

const SCAN_DELAY_MS = 75;
const TAG_READ_TIMEOUT_MS = 8000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
async function readFileTags(handle: FileSystemFileHandle): Promise<TrackTags> {
  const file = await handle.getFile();
  if (file.size > MAX_PARSE_FILE_SIZE) {
    toast.warning(
      `Skipped tags for "${handle.name}" (${Math.round(file.size / 1024 / 1024)} MB file, too large to parse safely)`
    );
    return fallbackTags(handle.name);
  }
  return readTrackTags(file);
}

export async function scanFolder(
  folder: FolderRecord,
  onProgress?: (done: number, total: number, track: TrackMeta) => void
): Promise<TrackMeta[]> {
  const files = await collectAudioFiles(folder.handle);
  const tracks: TrackMeta[] = [];
  for (let i = 0; i < files.length; i++) {
    if (i > 0) await delay(SCAN_DELAY_MS);
    const { handle, relPath } = files[i];
    let tags: TrackTags;
    try {
      tags = await withTimeout(readFileTags(handle), TAG_READ_TIMEOUT_MS);
    } catch {
      toast.warning(`Skipped "${handle.name}" (unreadable, corrupt, or took too long)`);
      tags = fallbackTags(handle.name);
    }
    const track: TrackMeta = {
      id: trackId(folder.id, relPath),
      folderId: folder.id,
      relPath,
      fileName: handle.name,
      ...tags
    };
    tracks.push(track);
    onProgress?.(i + 1, files.length, track);
  }
  return tracks;
}

export async function getTrackFile(
  track: TrackMeta,
  folder: FolderRecord
): Promise<File> {
  let dir = folder.handle;
  for (const segment of track.relPath.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(segment);
  }
  const fileHandle = await dir.getFileHandle(track.relPath[track.relPath.length - 1]);
  return fileHandle.getFile();
}

export async function hasReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: 'read' })) === 'granted';
}

export async function requestReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}
