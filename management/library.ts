import type { FolderRecord, TrackMeta } from '../types';
import { parseMetadata, SCAN_CONCURRENCY } from './scan_pool';
import {
  isIgnoredFormat,
  isIgnoredSize,
  shouldIgnoreTrack,
  type IgnoreRules
} from '../utils/ignore_rules';
import { electron } from '../utils/electron';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'm4a', 'mp4', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'webm'
]);
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

const DIRECTORY_CONCURRENCY = 6;
const DIRECTORY_TIMEOUT_MS = 15_000;
const PROGRESS_INTERVAL_MS = 100;
const MAX_IN_FLIGHT = SCAN_CONCURRENCY * 2;

interface ScanFile {
  name: string;
  relPath: string[];
  knownSize?: number;
  getFile(): Promise<File>;
}

interface WalkState {
  complete: boolean;
}

interface OrderedTrack {
  order: number;
  track: TrackMeta;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export type ScanMode = 'full' | 'new';

export interface ScanProgressUpdate {
  currentFilePath: string;
  done: number;
  total: number;
  omitted: number;
  audioSeconds: number;
  discovering: boolean;
}

export interface ScanOptions {
  mode?: ScanMode;
  existingTracks?: readonly TrackMeta[];
  onProgress?(progress: ScanProgressUpdate): void;
  signal?: AbortSignal;
}

export interface ScanResult {
  tracks: TrackMeta[];
  changedTracks: TrackMeta[];
  removedTrackIds: string[];
  skipped: SkippedFile[];
  excluded: number;
  aborted: boolean;
  complete: boolean;
}

function isAudioFile(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase();
  return extension !== undefined && AUDIO_EXTENSIONS.has(extension);
}

function isElectronFolder(folder: FolderRecord): folder is Extract<FolderRecord, { electronId: string }> {
  return 'electronId' in folder;
}

function abortError(): DOMException {
  return new DOMException('Scan aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(abortError()));
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error('timed out'))),
      timeoutMs
    );
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
}

async function listEntries(directory: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of directory.values()) entries.push(entry);
  return entries;
}

async function* walkBrowserFiles(
  folder: Extract<FolderRecord, { handle: FileSystemDirectoryHandle }>,
  skipped: SkippedFile[],
  state: WalkState,
  signal?: AbortSignal
): AsyncGenerator<ScanFile> {
  const directories: { handle: FileSystemDirectoryHandle; relPath: string[] }[] = [
    { handle: folder.handle, relPath: [] }
  ];

  while (directories.length > 0) {
    throwIfAborted(signal);
    const batch = directories.splice(0, DIRECTORY_CONCURRENCY);
    const listed = await Promise.all(
      batch.map(async (directory) => {
        try {
          const entries = await withTimeout(
            listEntries(directory.handle),
            DIRECTORY_TIMEOUT_MS,
            signal
          );
          return { directory, entries };
        } catch (error) {
          if (isAbortError(error)) throw error;
          state.complete = false;
          skipped.push({
            path: [folder.name, ...directory.relPath].join('/'),
            reason: 'folder could not be listed'
          });
          return null;
        }
      })
    );

    for (const result of listed) {
      if (!result) continue;
      for (const entry of result.entries) {
        const relPath = [...result.directory.relPath, entry.name];
        if (entry.kind === 'directory') {
          directories.push({
            handle: entry as FileSystemDirectoryHandle,
            relPath
          });
        } else if (isAudioFile(entry.name)) {
          const handle = entry as FileSystemFileHandle;
          yield {
            name: entry.name,
            relPath,
            getFile: () => handle.getFile()
          };
        }
      }
    }
  }
}

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

async function* walkElectronFiles(
  folder: Extract<FolderRecord, { electronId: string }>,
  skipped: SkippedFile[],
  state: WalkState,
  signal?: AbortSignal
): AsyncGenerator<ScanFile> {
  if (!electron) throw new Error('Desktop filesystem bridge is unavailable');
  const bridge = electron;
  const directories: string[][] = [[]];

  while (directories.length > 0) {
    throwIfAborted(signal);
    const batch = directories.splice(0, DIRECTORY_CONCURRENCY);
    const listed = await Promise.all(
      batch.map(async (relPath) => {
        try {
          const entries = await withTimeout(
            bridge.listDirectory(folder.electronId, relPath),
            DIRECTORY_TIMEOUT_MS,
            signal
          );
          return { relPath, entries };
        } catch (error) {
          if (isAbortError(error)) throw error;
          state.complete = false;
          skipped.push({
            path: [folder.name, ...relPath].join('/'),
            reason: 'folder could not be listed'
          });
          return null;
        }
      })
    );

    for (const result of listed) {
      if (!result) continue;
      for (const entry of result.entries) {
        const relPath = [...result.relPath, entry.name];
        if (entry.kind === 'directory') {
          directories.push(relPath);
        } else if (isAudioFile(entry.name)) {
          yield {
            name: entry.name,
            relPath,
            knownSize: entry.size,
            getFile: () => readElectronFile(folder.electronId, relPath)
          };
        }
      }
    }
  }
}

function walkAudioFiles(
  folder: FolderRecord,
  skipped: SkippedFile[],
  state: WalkState,
  signal?: AbortSignal
): AsyncGenerator<ScanFile> {
  return isElectronFolder(folder)
    ? walkElectronFiles(folder, skipped, state, signal)
    : walkBrowserFiles(folder, skipped, state, signal);
}

export function trackId(folderId: string, relPath: string[]): string {
  return `${folderId}:${relPath.join('/')}`;
}

export async function scanFolder(
  folder: FolderRecord,
  rules: IgnoreRules,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const mode = options.mode ?? 'full';
  const existingTracks = options.existingTracks ?? [];
  const existingById = new Map(existingTracks.map((track) => [track.id, track]));
  const skipped: SkippedFile[] = [];
  const walkState: WalkState = { complete: true };
  const orderedTracks: OrderedTrack[] = [];
  const changedTracks: TrackMeta[] = [];
  const inFlight = new Set<Promise<void>>();

  let order = 0;
  let done = 0;
  let total = 0;
  let excluded = 0;
  let hidden = 0;
  let audioSeconds = 0;
  let currentFilePath = '';
  let discovering = true;
  let aborted = false;
  let fatalError: unknown;
  let lastProgressAt = 0;

  const reportProgress = (force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
    lastProgressAt = now;
    options.onProgress?.({
      currentFilePath,
      done,
      total,
      omitted: excluded + hidden,
      audioSeconds,
      discovering
    });
  };

  const recordTrack = (track: TrackMeta, trackOrder: number, changed: boolean) => {
    orderedTracks.push({ order: trackOrder, track });
    if (changed) changedTracks.push(track);
    if (shouldIgnoreTrack(track, rules)) hidden++;
    if (Number.isFinite(track.duration)) audioSeconds += track.duration;
  };

  const processFile = async (source: ScanFile, trackOrder: number) => {
    const id = trackId(folder.id, source.relPath);
    const existing = existingById.get(id);
    const path = [folder.name, ...source.relPath].join('/');
    currentFilePath = path;

    try {
      if (source.knownSize !== undefined && isIgnoredSize(source.knownSize, rules)) {
        excluded++;
        done++;
        reportProgress();
        return;
      }

      const file = await source.getFile();
      throwIfAborted(options.signal);

      if (isIgnoredSize(file.size, rules)) {
        excluded++;
        done++;
        reportProgress();
        return;
      }

      if (
        mode === 'full' &&
        existing?.lastModified !== undefined &&
        existing.lastModified === file.lastModified &&
        existing.sizeBytes === file.size
      ) {
        recordTrack(existing, trackOrder, false);
        done++;
        reportProgress();
        return;
      }

      const parsed = await parseMetadata(file, options.signal);
      const track: TrackMeta = {
        id,
        folderId: folder.id,
        relPath: source.relPath,
        fileName: source.name,
        sizeBytes: file.size,
        lastModified: parsed.warning ? undefined : file.lastModified,
        ...parsed.tags
      };
      if (parsed.warning === 'unreadable') {
        skipped.push({ path, reason: 'unreadable or corrupt' });
      }
      recordTrack(track, trackOrder, true);
      done++;
      reportProgress();
    } catch (error) {
      if (isAbortError(error)) return;
      skipped.push({ path, reason: 'could not be read' });
      if (mode === 'full' && existing) recordTrack(existing, trackOrder, false);
      done++;
      reportProgress();
    }
  };

  try {
    for await (const source of walkAudioFiles(folder, skipped, walkState, options.signal)) {
      throwIfAborted(options.signal);
      const id = trackId(folder.id, source.relPath);
      if (mode === 'new' && existingById.has(id)) continue;
      if (isIgnoredFormat(source.name, rules)) {
        excluded++;
        continue;
      }

      total++;
      const trackOrder = order++;
      let task: Promise<void>;
      task = processFile(source, trackOrder).finally(() => inFlight.delete(task));
      inFlight.add(task);
      if (inFlight.size >= MAX_IN_FLIGHT) await Promise.race(inFlight);
    }
  } catch (error) {
    if (isAbortError(error)) {
      aborted = true;
    } else {
      fatalError = error;
    }
  } finally {
    discovering = false;
    reportProgress(true);
  }

  await Promise.all(inFlight);
  if (fatalError !== undefined) throw fatalError;
  aborted ||= options.signal?.aborted ?? false;
  reportProgress(true);

  orderedTracks.sort((a, b) => a.order - b.order);
  const tracks = orderedTracks.map(({ track }) => track);
  const returnedIds = new Set(tracks.map((track) => track.id));
  const complete = walkState.complete && !aborted;
  const removedTrackIds =
    mode === 'full' && complete
      ? existingTracks.filter((track) => !returnedIds.has(track.id)).map((track) => track.id)
      : [];

  return {
    tracks,
    changedTracks,
    removedTrackIds,
    skipped,
    excluded,
    aborted,
    complete
  };
}

export async function getTrackFile(track: TrackMeta, folder: FolderRecord): Promise<File> {
  if (isElectronFolder(folder)) return readElectronFile(folder.electronId, track.relPath);
  let directory = folder.handle;
  for (const segment of track.relPath.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(segment);
  }
  const fileHandle = await directory.getFileHandle(track.relPath[track.relPath.length - 1]);
  return fileHandle.getFile();
}

export async function hasReadPermission(folder: FolderRecord): Promise<boolean> {
  if (isElectronFolder(folder)) return electron ? electron.hasDirectory(folder.electronId) : false;
  return (await folder.handle.queryPermission({ mode: 'read' })) === 'granted';
}

export async function requestReadPermission(folder: FolderRecord): Promise<boolean> {
  if (isElectronFolder(folder)) return electron ? electron.hasDirectory(folder.electronId) : false;
  return (await folder.handle.requestPermission({ mode: 'read' })) === 'granted';
}
