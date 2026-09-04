import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { FolderRecord, TrackMeta } from '../types';
import { dbDelete, dbGetAll, dbPut, dbWriteBatch } from '../management/db';
import {
  getTrackFile,
  hasReadPermission,
  requestReadPermission,
  scanFolder,
  type SkippedFile
} from '../management/library';
import { shouldIgnoreTrack } from '../utils/ignore_rules';
import { toast } from '../utils/toast';
import { electron } from '../utils/electron';
import { useSettings } from './settings_context';

interface ScanProgress {
  folderName: string;
  currentFilePath: string;
  done: number;
  total: number;
  omitted: number;
  audioSeconds: number;
  discovering: boolean;
}

export interface ScanReport {
  folderName: string;
  skipped: SkippedFile[];
}

interface LibraryContextValue {
  folders: FolderRecord[];
  tracks: TrackMeta[];
  scanning: ScanProgress | null;
  scanReport: ScanReport | null;
  permissionNeeded: boolean;
  supported: boolean;
  addFolder(): Promise<void>;
  removeFolder(folderId: string): Promise<void>;
  rescanFolder(folderId: string): Promise<void>;
  scanNewFiles(folderId: string): Promise<void>;
  stopScan(): void;
  dismissScanReport(): void;
  restoreAccess(): Promise<void>;
  getFile(track: TrackMeta): Promise<File>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function formatLibraryRuntime(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [days, hours, minutes, seconds]
    .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
    .join(':');
}

function formatScanDuration(elapsedMs: number): string {
  const elapsedSeconds = Math.max(0, elapsedMs / 1000);
  const [value, unit] =
    elapsedSeconds < 60
      ? [elapsedSeconds, 'second'] as const
      : elapsedSeconds < 3_600
        ? [elapsedSeconds / 60, 'minute'] as const
        : [elapsedSeconds / 3_600, 'hour'] as const;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [scanning, setScanning] = useState<ScanProgress | null>(null);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const supported = electron !== null || typeof window.showDirectoryPicker === 'function';

  const visibleTracks = useMemo(
    () => tracks.filter((t) => !shouldIgnoreTrack(t, settings.ignoreRules)),
    [tracks, settings.ignoreRules]
  );

  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const scanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedFolders, storedTracks] = await Promise.all([
        dbGetAll<FolderRecord>('folders'),
        dbGetAll<TrackMeta>('tracks')
      ]);
      if (cancelled) return;
      foldersRef.current = storedFolders;
      tracksRef.current = storedTracks;
      setFolders(storedFolders);
      setTracks(storedTracks);
      for (const folder of storedFolders) {
        if (!(await hasReadPermission(folder))) {
          if (!cancelled) setPermissionNeeded(true);
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runScan = useCallback(
    async (folder: FolderRecord, mode: 'full' | 'new' = 'full') => {
      const startedAt = performance.now();
      const controller = new AbortController();
      scanAbortRef.current = controller;
      setScanning({
        folderName: folder.name,
        currentFilePath: '',
        done: 0,
        total: 0,
        omitted: 0,
        audioSeconds: 0,
        discovering: true
      });
      setScanReport(null);
      try {
        const folderTracks = tracksRef.current.filter(
          (track) => track.folderId === folder.id
        );
        const {
          tracks: scanned,
          changedTracks,
          removedTrackIds,
          skipped,
          excluded,
          aborted,
          complete
        } = await scanFolder(folder, settings.ignoreRules, {
          mode,
          existingTracks: folderTracks,
          signal: controller.signal,
          onProgress: (progress) => {
            setScanning({
              folderName: folder.name,
              ...progress
            });
          }
        });
        const scannedIds = new Set(scanned.map((t) => t.id));
        const isRescan = folderTracks.length > 0;
        const prevCount = folderTracks.filter(
          (t) => !shouldIgnoreTrack(t, settings.ignoreRules)
        ).length;

        const unseen = folderTracks.filter((t) => !scannedIds.has(t.id));
        const kept = mode === 'new' || aborted || !complete ? unseen : [];
        await dbWriteBatch('tracks', changedTracks, removedTrackIds);
        const folderResult = mode === 'new' ? [...folderTracks, ...scanned] : [...scanned, ...kept];
        const nextTracks = [
          ...tracksRef.current.filter((track) => track.folderId !== folder.id),
          ...folderResult
        ];
        tracksRef.current = nextTracks;
        setTracks(nextTracks);

        const includedTracks = folderResult.filter(
          (track) => !shouldIgnoreTrack(track, settings.ignoreRules)
        );
        const found = includedTracks.length;
        const added = scanned.filter((t) => !shouldIgnoreTrack(t, settings.ignoreRules)).length;
        const libraryRuntime = includedTracks.reduce(
          (total, track) => total + (Number.isFinite(track.duration) ? track.duration : 0),
          0
        );
        if (aborted) {
          toast.info(
            mode === 'new'
              ? `Stopped searching after adding ${added} new track${added === 1 ? '' : 's'}`
              : `Bailed scanning with ${found} track${found === 1 ? '' : 's'}`
          );
        } else {
          let message =
            mode === 'new'
              ? `Done searching "${folder.name}" - found ${added} new track${added === 1 ? '' : 's'}.`
              : `Done scanning "${folder.name}" - found ${found} track${found === 1 ? '' : 's'}.`;
          const delta = found - prevCount;
          if (mode === 'full' && isRescan && delta !== 0) {
            message += ` ${Math.abs(delta)} ${delta > 0 ? 'more' : 'less'} found than last scan.`;
          }
          if (excluded > 0) {
            message += ` Excluded ${excluded} file${excluded === 1 ? '' : 's'} as per your ignore rules.`;
          }
          message += ` ${formatLibraryRuntime(libraryRuntime)} runtime, took ${formatScanDuration(performance.now() - startedAt)}`;
          toast.success(message, 20000);
        }
        if (skipped.length > 0) setScanReport({ folderName: folder.name, skipped });
      } catch (err) {
        toast.error(`Scanning "${folder.name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      } finally {
        scanAbortRef.current = null;
        setScanning(null);
      }
    },
    [settings.ignoreRules]
  );

  const stopScan = useCallback(() => {
    scanAbortRef.current?.abort();
  }, []);

  const dismissScanReport = useCallback(() => {
    setScanReport(null);
  }, []);

  const addFolder = useCallback(async () => {
    let folder: FolderRecord | null = null;
    let electronId: string | null = null;
    try {
      if (electron) {
        const selected = await electron.pickDirectory();
        if (!selected) return;
        electronId = selected.id;
        folder = {
          id: crypto.randomUUID(),
          name: selected.name,
          electronId: selected.id
        };
      } else {
        const handle = await window.showDirectoryPicker({ id: 'xebrine-music', mode: 'read' });
        folder = { id: crypto.randomUUID(), name: handle.name, handle };
      }
      const selectedFolder = folder;
      await dbPut('folders', selectedFolder);
      setFolders((prev) => [...prev, selectedFolder]);
      await runScan(selectedFolder);
    } catch (err) {
      if (electronId) void electron?.forgetDirectory(electronId);
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error(`Couldn't add that folder: ${err instanceof Error ? err.message : 'unknown error'}`);
      return;
    }
  }, [runScan]);

  const removeFolder = useCallback(async (folderId: string) => {
    await dbDelete('folders', folderId);
    const all = tracksRef.current;
    await dbWriteBatch(
      'tracks',
      [],
      all.filter((t) => t.folderId === folderId).map((t) => t.id)
    );
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    const nextTracks = all.filter((track) => track.folderId !== folderId);
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    const folder = foldersRef.current.find((item) => item.id === folderId);
    if (folder && 'electronId' in folder) void electron?.forgetDirectory(folder.electronId);
  }, []);

  const rescanFolder = useCallback(
    async (folderId: string) => {
      const folder = foldersRef.current.find((f) => f.id === folderId);
      if (!folder) return;
      if (!(await hasReadPermission(folder)) && !(await requestReadPermission(folder))) {
        return;
      }
      await runScan(folder);
    },
    [runScan]
  );

  const scanNewFiles = useCallback(
    async (folderId: string) => {
      const folder = foldersRef.current.find((f) => f.id === folderId);
      if (!folder) return;
      if (!(await hasReadPermission(folder)) && !(await requestReadPermission(folder))) {
        return;
      }
      await runScan(folder, 'new');
    },
    [runScan]
  );

  const restoreAccess = useCallback(async () => {
    let allGranted = true;
    for (const folder of foldersRef.current) {
      if (!(await hasReadPermission(folder))) {
        if (!(await requestReadPermission(folder))) allGranted = false;
      }
    }
    setPermissionNeeded(!allGranted);
  }, []);

  const getFile = useCallback(async (track: TrackMeta): Promise<File> => {
    const folder = foldersRef.current.find((f) => f.id === track.folderId);
    if (!folder) throw new Error(`Folder for track ${track.id} was removed`);
    if (!(await hasReadPermission(folder))) {
      setPermissionNeeded(true);
      throw new Error('Folder access needs to be restored');
    }
    return getTrackFile(track, folder);
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        folders,
        tracks: visibleTracks,
        scanning,
        scanReport,
        permissionNeeded,
        supported,
        addFolder,
        removeFolder,
        rescanFolder,
        scanNewFiles,
        stopScan,
        dismissScanReport,
        restoreAccess,
        getFile
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
