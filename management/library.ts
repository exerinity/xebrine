import type { FolderRecord, TrackMeta } from '../types';
import { parseTagsBatch } from './scan_pool';
import { isIgnoredFormat, isIgnoredSize, type IgnoreRules } from '../utils/ignore_rules';
import { electron } from '../utils/electron';
import { toast } from '../utils/toast';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'mp4', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'webm'
]);

function isAudioFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext !== undefined && AUDIO_EXTENSIONS.has(ext);
}

interface FoundFile {
  source: {
    name: string;
    getFile(): Promise<File>;
  };
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
        found.push({ source: handle, relPath: [...prefix, entry.name], sizeBytes: size });
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

function isElectronFolder(folder: FolderRecord): folder is Extract<FolderRecord, { electronId: string }> {
  return 'electronId' in folder;
}

const AUDIO_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm'
};

async function readElectronFile(folderId: string, relPath: string[]): Promise<File> {
  if (!electron) throw new Error('Desktop filesystem bridge is unavailable');
  const result = await electron.readFile(folderId, relPath);
  const name = relPath[relPath.length - 1];
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return new File([result.data], name, {
    type: AUDIO_MIME_TYPES[extension] ?? '',
    lastModified: result.lastModified
  });
}

async function collectElectronAudioFiles(
  folder: Extract<FolderRecord, { electronId: string }>,
  rules: IgnoreRules,
  skipped: SkippedFile[],
  stats: CollectStats,
  prefix: string[] = []
): Promise<FoundFile[]> {
  const found: FoundFile[] = [];
  let entries: Awaited<ReturnType<NonNullable<typeof electron>['listDirectory']>>;
  try {
    if (!electron) throw new Error('Desktop filesystem bridge is unavailable');
    entries = await withTimeout(electron.listDirectory(folder.electronId, prefix), DIR_LIST_TIMEOUT_MS);
  } catch {
    const path = [folder.name, ...prefix].join('/');
    skipped.push({ path, reason: 'folder could not be listed' });
    toast.warning(`Couldn't list "${path}" - skipping that folder`);
    return found;
  }

  for (const entry of entries) {
    const relPath = [...prefix, entry.name];
    if (entry.kind === 'directory') {
      found.push(...(await collectElectronAudioFiles(folder, rules, skipped, stats, relPath)));
      continue;
    }
    if (!isAudioFile(entry.name)) continue;
    if (isIgnoredFormat(entry.name, rules) || isIgnoredSize(entry.size, rules)) {
      stats.excluded++;
      continue;
    }
    found.push({
      source: {
        name: entry.name,
        getFile: () => readElectronFile(folder.electronId, relPath)
      },
      relPath,
      sizeBytes: entry.size
    });
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
  const files = isElectronFolder(folder)
    ? await collectElectronAudioFiles(folder, rules, skipped, stats)
    : await collectAudioFiles(folder.handle, folder.name, rules, skipped, stats);
  const tracks: (TrackMeta | undefined)[] = new Array(files.length);
  let done = 0;
  await parseTagsBatch(
    files.map((f) => f.source),
    (index, parsed) => {
      const { source, relPath, sizeBytes } = files[index];
      if (parsed.warning === 'unreadable') {
        const path = [folder.name, ...relPath].join('/');
        skipped.push({ path, reason: 'unreadable or corrupt' });
        toast.warning(`Omitting "${path}" (unreadable)`);
      }
      const track: TrackMeta = {
        id: trackId(folder.id, relPath),
        folderId: folder.id,
        relPath,
        fileName: source.name,
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
  if (isElectronFolder(folder)) {
    return readElectronFile(folder.electronId, track.relPath);
  }
  let dir = folder.handle;
  for (const segment of track.relPath.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(segment);
  }
  const fileHandle = await dir.getFileHandle(track.relPath[track.relPath.length - 1]);
  return fileHandle.getFile();
}

export async function hasReadPermission(folder: FolderRecord): Promise<boolean> {
  if (isElectronFolder(folder)) {
    return electron ? electron.hasDirectory(folder.electronId) : false;
  }
  return (await folder.handle.queryPermission({ mode: 'read' })) === 'granted';
}

export async function requestReadPermission(folder: FolderRecord): Promise<boolean> {
  if (isElectronFolder(folder)) {
    return electron ? electron.hasDirectory(folder.electronId) : false;
  }
  return (await folder.handle.requestPermission({ mode: 'read' })) === 'granted';
}
