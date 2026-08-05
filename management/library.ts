import type { FolderRecord, TrackMeta } from '../types';
import { parseTagsBatch } from './scan_pool';
import { isIgnoredFormat, isIgnoredSize, type IgnoreRules } from '../utils/ignore_rules';
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
  sizeBytes: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

const DIR_LIST_TIMEOUT_MS = 15000;

async function listEntries(dir: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of dir.values()) entries.push(entry);
  return entries;
}

interface CollectStats {
  excluded: number;
}

async function collectAudioFiles(
  dir: FileSystemDirectoryHandle,
  rootName: string,
  rules: IgnoreRules,
  skipped: SkippedFile[],
  stats: CollectStats,
  prefix: string[] = []
): Promise<FoundFile[]> {
  const found: FoundFile[] = [];
  let entries: FileSystemHandle[];
  try {
    entries = await withTimeout(listEntries(dir), DIR_LIST_TIMEOUT_MS);
  } catch {
    const path = [rootName, ...prefix].join('/');
    skipped.push({ path, reason: 'folder could not be listed' });
    toast.warning(`Couldn't list "${path}" - skipping that folder`);
    return found;
  }

  for (const entry of entries) {
    try {
      if (entry.kind === 'file') {
        if (!isAudioFile(entry.name)) continue;
        if (isIgnoredFormat(entry.name, rules)) {
          stats.excluded++;
          continue;
        }
        const handle = entry as FileSystemFileHandle;
        const { size } = await handle.getFile();
        if (isIgnoredSize(size, rules)) {
          stats.excluded++;
          continue;
        }
        found.push({ handle, relPath: [...prefix, entry.name], sizeBytes: size });
      } else if (entry.kind === 'directory') {
        found.push(
          ...(await collectAudioFiles(
            entry as FileSystemDirectoryHandle,
            rootName,
            rules,
            skipped,
            stats,
            [...prefix, entry.name]
          ))
        );
      }
    } catch {
      const path = [rootName, ...prefix, entry.name].join('/');
      skipped.push({ path, reason: 'could not be read' });
      toast.warning(`Couldn't read "${path}" - skipping`);
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
export interface ScanResult {
  tracks: TrackMeta[];
  skipped: SkippedFile[];
  excluded: number;
}

export async function scanFolder(
  folder: FolderRecord,
  rules: IgnoreRules,
  onProgress?: (done: number, total: number, track: TrackMeta, excluded: number) => void,
  signal?: AbortSignal
): Promise<ScanResult> {
  const skipped: SkippedFile[] = [];
  const stats: CollectStats = { excluded: 0 };
  const files = await collectAudioFiles(folder.handle, folder.name, rules, skipped, stats);
  const tracks: (TrackMeta | undefined)[] = new Array(files.length);
  let done = 0;
  await parseTagsBatch(
    files.map((f) => f.handle),
    (index, parsed) => {
      const { handle, relPath, sizeBytes } = files[index];
      if (parsed.warning === 'unreadable') {
        const path = [folder.name, ...relPath].join('/');
        skipped.push({ path, reason: 'unreadable or corrupt' });
        toast.warning(`Omitting "${path}" (unreadable)`);
      }
      const track: TrackMeta = {
        id: trackId(folder.id, relPath),
        folderId: folder.id,
        relPath,
        fileName: handle.name,
        sizeBytes,
        ...parsed.tags
      };
      tracks[index] = track;
      onProgress?.(++done, files.length, track, stats.excluded);
    },
    signal
  );
  return {
    tracks: tracks.filter((t): t is TrackMeta => t !== undefined),
    skipped,
    excluded: stats.excluded
  };
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
