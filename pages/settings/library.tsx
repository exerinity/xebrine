import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../context/settings_context';
import { useLibrary } from '../../context/library_context';
import { DEFAULT_SIZE_LIMIT_BYTES, IGNORABLE_FORMATS, MAX_SIZE_LIMIT_BYTES, MIN_SIZE_LIMIT_BYTES, SIZE_QUIP_THRESHOLD_BYTES, type IgnoredFormat, type IgnoreRules } from '../../utils/ignore_rules';
import { Slider } from '../../components/slider';
import { FolderIcon, KeyIcon, RefreshIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { clamp, formatBytes } from '../../utils/format';

const REMOVE_CONFIRM_MS = 2000;

const SIZE_SLIDER_RATIO = MAX_SIZE_LIMIT_BYTES / MIN_SIZE_LIMIT_BYTES;

function sizeToSlider(bytes: number): number {
  return Math.log(bytes / MIN_SIZE_LIMIT_BYTES) / Math.log(SIZE_SLIDER_RATIO);
}

function sliderToSize(fraction: number): number {
  const bytes = MIN_SIZE_LIMIT_BYTES * SIZE_SLIDER_RATIO ** fraction;
  const MB = 1024 * 1024;
  return clamp(Math.round(bytes / MB) * MB, MIN_SIZE_LIMIT_BYTES, MAX_SIZE_LIMIT_BYTES);
}

export function LibrarySettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();
  const {
    folders,
    tracks,
    playlists,
    permissionNeeded,
    scanning,
    addFolder,
    removeFolder,
    rescanFolder,
    scanNewFiles,
    restoreAccess
  } = useLibrary();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmRemoveTimer = useRef<number | null>(null);

  const folderSongCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of tracks) {
      counts.set(track.folderId, (counts.get(track.folderId) ?? 0) + 1);
    }
    return counts;
  }, [tracks]);
  const playlisted_track_count = useMemo(
    () => playlists.reduce((total, playlist) => total + playlist.trackIds.length, 0),
    [playlists]
  );

  const toggleRule = (key: keyof Omit<IgnoreRules, 'formats' | 'maxSizeBytes'>) => {
    update({ ignoreRules: { ...settings.ignoreRules, [key]: !settings.ignoreRules[key] } });
  };

  const setMaxSize = (maxSizeBytes: number | null) => {
    update({ ignoreRules: { ...settings.ignoreRules, maxSizeBytes } });
  };

  const toggleFormat = (format: IgnoredFormat) => {
    const formats = settings.ignoreRules.formats.includes(format)
      ? settings.ignoreRules.formats.filter((f) => f !== format)
      : [...settings.ignoreRules.formats, format];
    update({ ignoreRules: { ...settings.ignoreRules, formats } });
  };

  const rescanAll = async () => {
    for (const folder of folders) {
      await rescanFolder(folder.id);
    }
  };

  const scan_all_new_files = async () => {
    for (const folder of folders) {
      await scanNewFiles(folder.id);
    }
  };

  useEffect(() => {
    return () => {
      if (confirmRemoveTimer.current !== null) window.clearTimeout(confirmRemoveTimer.current);
    };
  }, []);

  const requestRemoveFolder = (folderId: string) => {
    if (confirmRemoveTimer.current !== null) window.clearTimeout(confirmRemoveTimer.current);
    if (confirmRemoveId === folderId) {
      confirmRemoveTimer.current = null;
      setConfirmRemoveId(null);
      void removeFolder(folderId);
      return;
    }
    setConfirmRemoveId(folderId);
    confirmRemoveTimer.current = window.setTimeout(() => {
      confirmRemoveTimer.current = null;
      setConfirmRemoveId(null);
    }, REMOVE_CONFIRM_MS);
  };

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Library settings</h2>}
      <section className="xe_settings__section">
        <h2>Ignore tracks that lack...</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.missingCover}
            onChange={() => toggleRule('missingCover')}
          />
          <span>an album cover</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.missingAlbum}
            onChange={() => toggleRule('missingAlbum')}
          />
          <span>an album tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.missingArtist}
            onChange={() => toggleRule('missingArtist')}
          />
          <span>an artist tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.missingTitle}
            onChange={() => toggleRule('missingTitle')}
          />
          <span>a title tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.missingAllTags}
            onChange={() => toggleRule('missingAllTags')}
          />
          <span>all metadata</span>
        </label>
        <p className="xe_settings__hint">Or are in a certain format...</p>
        <div className="xe_settings__chip-row">
          {IGNORABLE_FORMATS.map((format) => {
            const activeFormat = settings.ignoreRules.formats.includes(format);
            return (
              <button
                key={format}
                type="button"
                className={`xe_settings__chip${activeFormat ? ' xe_settings__chip--active' : ''}`}
                aria-pressed={activeFormat}
                onClick={() => toggleFormat(format)}
              >
                .{format}
              </button>
            );
          })}
        </div>
        <p className="xe_settings__hint">Or are larger than...</p>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.ignoreRules.maxSizeBytes !== null}
            onChange={() =>
              setMaxSize(
                settings.ignoreRules.maxSizeBytes === null ? DEFAULT_SIZE_LIMIT_BYTES : null
              )
            }
          />
          <span>a certain file size</span>
        </label>
        {settings.ignoreRules.maxSizeBytes !== null && (
          <div className="xe_settings__slider-row">
            <Slider
              value={sizeToSlider(settings.ignoreRules.maxSizeBytes)}
              min={0}
              max={1}
              wheelStep={0.02}
              resetTo={sizeToSlider(DEFAULT_SIZE_LIMIT_BYTES)}
              onChange={(v) => setMaxSize(sliderToSize(v))}
              ariaLabel="Ignore tracks larger than"
            />
            <span className="xe_settings__slider-value">
              {formatBytes(settings.ignoreRules.maxSizeBytes)}
              <span
                className={`xe_settings__quip${settings.ignoreRules.maxSizeBytes > SIZE_QUIP_THRESHOLD_BYTES
                  ? ' xe_settings__quip--shown'
                  : ''
                  }`}
              >
                {' '}
                - <i title="Do you really have files this large?" style={{ cursor: 'help' }}>(wtf?)</i>
              </span>
            </span>
          </div>
        )}
        <p className="xe_settings__hint">
          Xebrine automatically omits formats that the browser cannot play, e.g., .aiff, .alac, etc. Thus, use these settings sparingly, and only if your library is full of botchy ripped music with improper tagging. A well-tagged folder with clean streams shouldn't need any of these applied.
        </p>
      </section>

      <section className="xe_settings__section">
        <h2>Library</h2>
        <p className="xe_settings__hint">
          <strong>{tracks.length}</strong> track{tracks.length === 1 ? '' : 's'} and <strong>{playlists.length}</strong> playlist{playlists.length === 1 ? '' : 's'} (total <strong>{playlisted_track_count}</strong> playlisted) across <strong>{folders.length}</strong> folder
          {folders.length === 1 ? '' : 's'}
        </p>
        {permissionNeeded && (
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void restoreAccess()}>
            <KeyIcon size={14} />
            Regain
          </button>
        )}
        <ul className="xe_settings__folders">
          {folders.map((folder) => (
            <li key={folder.id}>
              <div className="xe_settings__folder-info">
                <span className="xe_settings__folder-name">{folder.name}</span>
                <span className="xe_settings__folder-count">
                  {folderSongCounts.get(folder.id) ?? 0} song
                  {(folderSongCounts.get(folder.id) ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div className="xe_settings__folder-actions">
                <button
                  type="button"
                  className="xe_btn"
                  onClick={() => void scanNewFiles(folder.id)}
                  disabled={scanning !== null}
                  aria-label={`Search ${folder.name} for new files only`}
                >
                  <SearchIcon size={14} />
                  Search for new files only
                </button>
                <button
                  type="button"
                  className="xe_btn xe_btn--accent"
                  onClick={() => void rescanFolder(folder.id)}
                  disabled={scanning !== null}
                  aria-label={`Rescan ${folder.name}`}
                >
                  <RefreshIcon size={14} />
                  Rescan
                </button>
                <button
                  type="button"
                  className={`xe_btn xe_settings__folder-remove${confirmRemoveId === folder.id
                    ? ' xe_settings__folder-remove--armed'
                    : ''
                    }`}
                  onClick={() => requestRemoveFolder(folder.id)}
                  aria-label={
                    confirmRemoveId === folder.id
                      ? `Confirm removing ${folder.name}`
                      : `Remove ${folder.name}`
                  }
                >
                  <TrashIcon size={14} />
                  {confirmRemoveId === folder.id ? 'Really?' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="xe_settings__actions">
          <button type="button" className="xe_btn" onClick={() => void addFolder()} disabled={scanning !== null}>
            <FolderIcon size={14} />
            Add folder
          </button>
          <button
            type="button"
            className="xe_btn"
            onClick={() => void scan_all_new_files()}
            disabled={scanning !== null || folders.length === 0}
          >
            <SearchIcon size={14} />
            Search all for new files
          </button>
          <button
            type="button"
            className="xe_btn"
            onClick={() => void rescanAll()}
            disabled={scanning !== null || folders.length === 0}
          >
            <RefreshIcon size={14} />
            Rescan all
          </button>
        </div>
      </section>
    </>
  );
}
