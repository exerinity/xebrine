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
import { readCoverArt } from '../management/metadata';
import { shouldIgnoreTrack } from '../utils/ignore_rules';
import { toast } from '../utils/toast';
import { electron } from '../utils/electron';
import { useSettings } from './settings_context';

const COVER_SCAN_CONCURRENCY = 3;

interface ScanProgress {
  folderName: string;
  done: number;
  total: number;
  omitted: number;
  audioSeconds: number;
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
  stopScan(): void;
  dismissScanReport(): void;
  restoreAccess(): Promise<void>;
  getFile(track: TrackMeta): Promise<File>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

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
  const scanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedFolders, storedTracks] = await Promise.all([
        dbGetAll<FolderRecord>('folders'),
        dbGetAll<TrackMeta>('tracks')
      ]);
      if (cancelled) return;
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

  const fillCoverFlags = useCallback(async (scanned: TrackMeta[]) => {
    let index = 0;
    const worker = async () => {
      while (index < scanned.length) {
        const track = scanned[index++];
        const folder = foldersRef.current.find((f) => f.id === track.folderId);
        if (!folder) continue;
        try {
          if (!(await hasReadPermission(folder))) continue;
          const file = await getTrackFile(track, folder);
          const cover = await readCoverArt(file);
          const hasCoverArt = cover !== null;
          if (hasCoverArt === track.hasCoverArt) continue;
          const updated = { ...track, hasCoverArt };
          await dbPut('tracks', updated);
          setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        } catch {
          null;
        }
      }
    };
    await Promise.all(Array.from({ length: COVER_SCAN_CONCURRENCY }, worker));
  }, []);

  const runScan = useCallback(
    async (folder: FolderRecord) => {
      const controller = new AbortController();
      scanAbortRef.current = controller;
      setScanning({ folderName: folder.name, done: 0, total: 0, omitted: 0, audioSeconds: 0 });
      setScanReport(null);
      let hidden = 0;
      let audioSeconds = 0;
      try {
        const { tracks: scanned, skipped, excluded } = await scanFolder(
          folder,
          settings.ignoreRules,
          (done, total, track, skippedByRules) => {
            if (shouldIgnoreTrack(track, settings.ignoreRules)) hidden++;
            if (Number.isFinite(track.duration)) audioSeconds += track.duration;
            setScanning({
              folderName: folder.name,
              done,
              total,
              omitted: skippedByRules + hidden,
              audioSeconds
            });
          },
          controller.signal
        );
        const aborted = controller.signal.aborted;
        const scannedIds = new Set(scanned.map((t) => t.id));
        const folderTracks = (await dbGetAll<TrackMeta>('tracks')).filter(
          (t) => t.folderId === folder.id
        );
        const isRescan = folderTracks.length > 0;
        const prevCount = folderTracks.filter(
          (t) => !shouldIgnoreTrack(t, settings.ignoreRules)
        ).length;

        const unseen = folderTracks.filter((t) => !scannedIds.has(t.id));
        const kept = aborted ? unseen : [];
        await dbWriteBatch('tracks', scanned, aborted ? [] : unseen.map((t) => t.id));
        const folderResult = [...scanned, ...kept];
        setTracks((prev) => [...prev.filter((t) => t.folderId !== folder.id), ...folderResult]);
        void fillCoverFlags(scanned);

        const found = folderResult.filter((t) => !shouldIgnoreTrack(t, settings.ignoreRules)).length;
        if (aborted) {
          toast.info(`Bailed scanning with ${found} track${found === 1 ? '' : 's'}`);
        } else {
          let message = `Done scanning "${folder.name}" - found ${found} track${found === 1 ? '' : 's'}.`;
          const delta = found - prevCount;
          if (isRescan && delta !== 0) {
            message += ` ${Math.abs(delta)} ${delta > 0 ? 'more' : 'less'} found than last scan.`;
          }
          if (excluded > 0) {
            message += ` Excluded ${excluded} file${excluded === 1 ? '' : 's'} as per your ignore rules`;
          }
          toast.success(message);
        }
        if (skipped.length > 0) setScanReport({ folderName: folder.name, skipped });
      } catch (err) {
        toast.error(`Scanning "${folder.name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      } finally {
        scanAbortRef.current = null;
        setScanning(null);
      }
    },
    [settings.ignoreRules, fillCoverFlags]
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
    const all = await dbGetAll<TrackMeta>('tracks');
    await dbWriteBatch(
      'tracks',
      [],
      all.filter((t) => t.folderId === folderId).map((t) => t.id)
    );
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setTracks((prev) => prev.filter((t) => t.folderId !== folderId));
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
