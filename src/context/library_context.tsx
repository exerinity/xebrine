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
import { dbDelete, dbGetAll, dbPut } from '../management/db';
import {
  getTrackFile,
  hasReadPermission,
  requestReadPermission,
  scanFolder
} from '../management/library';
import { readCoverArt } from '../management/metadata';
import { shouldIgnoreTrack } from '../utils/ignore_rules';
import { toast } from '../utils/toast';
import { useSettings } from './settings_context';

const COVER_SCAN_CONCURRENCY = 3;

interface ScanProgress {
  folderName: string;
  done: number;
  total: number;
  omitted: number;
}

interface LibraryContextValue {
  folders: FolderRecord[];
  tracks: TrackMeta[];
  scanning: ScanProgress | null;
  permissionNeeded: boolean;
  supported: boolean;
  addFolder(): Promise<void>;
  removeFolder(folderId: string): Promise<void>;
  rescanFolder(folderId: string): Promise<void>;
  restoreAccess(): Promise<void>;
  getFile(track: TrackMeta): Promise<File>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [scanning, setScanning] = useState<ScanProgress | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const supported = typeof window.showDirectoryPicker === 'function';

  const visibleTracks = useMemo(
    () => tracks.filter((t) => !shouldIgnoreTrack(t, settings.ignoreRules)),
    [tracks, settings.ignoreRules]
  );

  const foldersRef = useRef(folders);
  foldersRef.current = folders;

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
        if (!(await hasReadPermission(folder.handle))) {
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
          if (!(await hasReadPermission(folder.handle))) continue;
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
      setScanning({ folderName: folder.name, done: 0, total: 0, omitted: 0 });
      let omitted = 0;
      try {
        const scanned = await scanFolder(folder, (done, total, track) => {
          if (shouldIgnoreTrack(track, settings.ignoreRules)) omitted++;
          setScanning({ folderName: folder.name, done, total, omitted });
        });
        const scannedIds = new Set(scanned.map((t) => t.id));
        const folderTracks = (await dbGetAll<TrackMeta>('tracks')).filter(
          (t) => t.folderId === folder.id
        );
        const isRescan = folderTracks.length > 0;
        const prevCount = folderTracks.filter(
          (t) => !shouldIgnoreTrack(t, settings.ignoreRules)
        ).length;

        for (const track of scanned) await dbPut('tracks', track);
        const stale = folderTracks.filter((t) => !scannedIds.has(t.id));
        for (const track of stale) await dbDelete('tracks', track.id);
        setTracks((prev) => [...prev.filter((t) => t.folderId !== folder.id), ...scanned]);
        void fillCoverFlags(scanned);

        const found = scanned.filter((t) => !shouldIgnoreTrack(t, settings.ignoreRules)).length;
        let message = `Done scanning folder - found ${found} track${found === 1 ? '' : 's'}.`;
        const delta = found - prevCount;
        if (isRescan && delta !== 0) {
          message += ` ${Math.abs(delta)} ${delta > 0 ? 'more' : 'less'} found than last scan.`;
        }
        toast.success(message);
      } catch (err) {
        toast.error(`Scanning "${folder.name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      } finally {
        setScanning(null);
      }
    },
    [settings.ignoreRules, fillCoverFlags]
  );

  const addFolder = useCallback(async () => {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker({ id: 'xebrine-music', mode: 'read' });
    } catch {
      return;
    }
    const folder: FolderRecord = { id: crypto.randomUUID(), name: handle.name, handle };
    await dbPut('folders', folder);
    setFolders((prev) => [...prev, folder]);
    await runScan(folder);
  }, [runScan]);

  const removeFolder = useCallback(async (folderId: string) => {
    await dbDelete('folders', folderId);
    const all = await dbGetAll<TrackMeta>('tracks');
    for (const track of all.filter((t) => t.folderId === folderId)) {
      await dbDelete('tracks', track.id);
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setTracks((prev) => prev.filter((t) => t.folderId !== folderId));
  }, []);

  const rescanFolder = useCallback(
    async (folderId: string) => {
      const folder = foldersRef.current.find((f) => f.id === folderId);
      if (!folder) return;
      if (!(await hasReadPermission(folder.handle)) && !(await requestReadPermission(folder.handle))) {
        return;
      }
      await runScan(folder);
    },
    [runScan]
  );

  const restoreAccess = useCallback(async () => {
    let allGranted = true;
    for (const folder of foldersRef.current) {
      if (!(await hasReadPermission(folder.handle))) {
        if (!(await requestReadPermission(folder.handle))) allGranted = false;
      }
    }
    setPermissionNeeded(!allGranted);
  }, []);

  const getFile = useCallback(async (track: TrackMeta): Promise<File> => {
    const folder = foldersRef.current.find((f) => f.id === track.folderId);
    if (!folder) throw new Error(`Folder for track ${track.id} was removed`);
    if (!(await hasReadPermission(folder.handle))) {
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
        permissionNeeded,
        supported,
        addFolder,
        removeFolder,
        rescanFolder,
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
