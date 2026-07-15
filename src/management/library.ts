import type { FolderRecord, TrackMeta } from '../types';
import { parseTagsBatch } from './scan_pool';
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
export async function scanFolder(
  folder: FolderRecord,
  onProgress?: (done: number, total: number, track: TrackMeta) => void,
  signal?: AbortSignal
): Promise<TrackMeta[]> {
  const files = await collectAudioFiles(folder.handle);
  const tracks: (TrackMeta | undefined)[] = new Array(files.length);
  let done = 0;
  await parseTagsBatch(
    files.map((f) => f.handle),
    (index, parsed) => {
      const { handle, relPath } = files[index];
      if (parsed.warning === 'oversized') {
        toast.warning(
          `Skipped tags for "${handle.name}" (${parsed.sizeMB} MB file, too large to parse safely)`
        );
      } else if (parsed.warning === 'unreadable') {
        toast.warning(`Skipped "${handle.name}" (unreadable, corrupt, or took too long)`);
      }
      const track: TrackMeta = {
        id: trackId(folder.id, relPath),
        folderId: folder.id,
        relPath,
        fileName: handle.name,
        ...parsed.tags
      };
      tracks[index] = track;
      onProgress?.(++done, files.length, track);
    },
    signal
  );
  return tracks.filter((t): t is TrackMeta => t !== undefined);
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
