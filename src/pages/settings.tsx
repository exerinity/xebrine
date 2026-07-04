import { useState } from 'react';
import { useSettings } from '../context/settings_context';
import { useLibrary } from '../context/library_context';
import { IGNORABLE_FORMATS, type IgnoredFormat, type IgnoreRules } from '../utils/ignore_rules';
import { Spinner } from '../components/spinner';
import { Slider } from '../components/slider';
import { Equalizer } from '../components/equalizer';
import { FolderIcon, KeyIcon, RefreshIcon, TrashIcon } from '../components/icons';

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { folders, tracks, permissionNeeded, scanning, addFolder, removeFolder, rescanFolder, restoreAccess } =
    useLibrary();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const toggleRule = (key: keyof Omit<IgnoreRules, 'formats'>) => {
    update({ ignoreRules: { ...settings.ignoreRules, [key]: !settings.ignoreRules[key] } });
  };

  const toggleFormat = (format: IgnoredFormat) => {
    const formats = settings.ignoreRules.formats.includes(format)
      ? settings.ignoreRules.formats.filter((f) => f !== format)
      : [...settings.ignoreRules.formats, format];
    update({ ignoreRules: { ...settings.ignoreRules, formats } });
  };

  const enableNotifications = async (enabled: boolean) => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      setNotifPermission(await Notification.requestPermission());
    }
    update({ notifications: enabled });
  };

  const rescanAll = async () => {
    null;
    for (const folder of folders) {
      await rescanFolder(folder.id);
    }
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Settings</h1>
      </div>
      <div className="xe_page__scroll xe_settings">
        <section className="xe_settings__section">
          <h2>LRCLIB configuration</h2>
          <label className="xe_settings__radio">
            <input
              type="radio"
              name="lrclib-mode"
              checked={settings.lrclibMode === 'strict'}
              onChange={() => update({ lrclibMode: 'strict' })}
            />
            <span>
              <strong>Strict</strong> requires an exact match of artist, title, album, and duration. Obviously requires thorough metadata
            </span>
          </label>
          <label className="xe_settings__radio">
            <input
              type="radio"
              name="lrclib-mode"
              checked={settings.lrclibMode === 'lax'}
              onChange={() => update({ lrclibMode: 'lax' })}
            />
            <span>
              <strong>Lax</strong> just searches for the title and artist and going for the first result, if any
            </span>
          </label>
        </section>

        <section className="xe_settings__section">
          <h2>Notifications</h2>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => void enableNotifications(e.target.checked)}
            />
            <span>Send a notification on track change</span>
          </label>
          {settings.notifications && notifPermission === 'denied' && (
            <p className="xe_settings__hint">
              Notifications are blocked by the browser. Allow them?
            </p>
          )}
        </section>

        <section className="xe_settings__section">
          <h2>Ignore tracks that…</h2>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.ignoreRules.missingCover}
              onChange={() => toggleRule('missingCover')}
            />
            <span>Lack an album cover</span>
          </label>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.ignoreRules.missingAlbum}
              onChange={() => toggleRule('missingAlbum')}
            />
            <span>Lack an album tag</span>
          </label>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.ignoreRules.missingArtist}
              onChange={() => toggleRule('missingArtist')}
            />
            <span>Lack an artist tag</span>
          </label>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.ignoreRules.missingTitle}
              onChange={() => toggleRule('missingTitle')}
            />
            <span>Lack a title tag</span>
          </label>
          <label className="xe_settings__radio">
            <input
              type="checkbox"
              checked={settings.ignoreRules.missingAllTags}
              onChange={() => toggleRule('missingAllTags')}
            />
            <span>Lack all metadata</span>
          </label>
          <p className="xe_settings__hint">Or are in a certain format:</p>
          <div className="xe_settings__chip-row">
            {IGNORABLE_FORMATS.map((format) => {
              const active = settings.ignoreRules.formats.includes(format);
              return (
                <button
                  key={format}
                  type="button"
                  className={`xe_settings__chip${active ? ' xe_settings__chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleFormat(format)}
                >
                  .{format}
                </button>
              );
            })}
          </div>
        </section>

        <section className="xe_settings__section">
          <h2>Auto mix</h2>
          <p className="xe_settings__hint">
            Auto mix is an experimental... automatic mixing subsystem. It works by analyzing the BPM of the currently playing track and the next enqueued track then calculates the BPM difference and ease of crossfading while beat-matching
          </p>
          <div className="xe_settings__slider-row">
            <Slider
              value={settings.autoMixDuration}
              min={5}
              max={90}
              wheelStep={1}
              onChange={(v) => update({ autoMixDuration: Math.round(v) })}
              ariaLabel="Auto mix duration"
            />
            <span className="xe_settings__slider-value">{settings.autoMixDuration}s</span>
          </div>
          <p className="xe_settings__hint">
            A <span style={{ color: '#3ddc84' }}>Green</span> pill means the current and next track BPMs are compatible for a smooth mix
            <br></br>
            An <span style={{ color: '#f5a623' }}>Orange</span> pill means the BPMs are less-than-optimal but Xebrine will try mixing them anyway
            <br></br>
            A <span style={{ color: '#f5524a'}}>Red</span> pill means the BPMs are way too incompatible for mixing and they will just simply crossfade
          </p>
        </section>

        <Equalizer />

        <section className="xe_settings__section">
          <h2>Library</h2>
          <p className="xe_settings__hint">
            Currently crawling <strong>{tracks.length}</strong> track{tracks.length === 1 ? '' : 's'} across <strong>{folders.length}</strong> folder
            {folders.length === 1 ? '' : 's'}
          </p>
          {permissionNeeded && (
            <button type="button" className="xe_btn xe_btn--accent" onClick={() => void restoreAccess()}>
              <KeyIcon size={14} />
              Regain
            </button>
          )}
          {scanning && (
            <div className="xe_banner xe_banner--info">
              <Spinner />
              <span>
                Scanning <strong>{scanning.folderName}</strong>: read {scanning.done}
                {scanning.total > 0 ? ` / ${scanning.total}` : ''} files so far...
                {scanning.omitted > 0 ? ` (${scanning.omitted} to be omitted by your filter)` : ''}
              </span>
            </div>
          )}
          <ul className="xe_settings__folders">
            {folders.map((folder) => (
              <li key={folder.id}>
                <span className="xe_settings__folder-name">{folder.name}</span>
                <button
                  type="button"
                  className="xe_btn xe_btn--small"
                  onClick={() => void rescanFolder(folder.id)}
                  disabled={scanning !== null}
                >
                  <RefreshIcon size={13} />
                  Rescan
                </button>
                <button
                  type="button"
                  className="xe_btn xe_btn--small xe_btn--quiet"
                  onClick={() => void removeFolder(folder.id)}
                >
                  <TrashIcon size={13} />
                  Remove
                </button>
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
              onClick={() => void rescanAll()}
              disabled={scanning !== null || folders.length === 0}
            >
              <RefreshIcon size={14} />
              Rescan all
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
