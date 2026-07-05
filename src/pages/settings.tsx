import { useState } from 'react';
import { useSettings } from '../context/settings_context';
import { useLibrary } from '../context/library_context';
import { IGNORABLE_FORMATS, type IgnoredFormat, type IgnoreRules } from '../utils/ignore_rules';
import { Spinner } from '../components/spinner';
import { Slider } from '../components/slider';
import { Equalizer } from '../components/equalizer';
import { ChevronRightIcon, CloseIcon, FolderIcon, KeyIcon, RefreshIcon, TrashIcon } from '../components/icons';
import { useScanEta, formatEta } from '../hooks/scan_eta';
import { usePageTitle } from '../hooks/page_title';

type SectionId = 'management' | 'library' | 'audio';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'management', label: 'Management' },
  { id: 'library', label: 'Library' },
  { id: 'audio', label: 'Audio' }
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const {
    folders,
    tracks,
    permissionNeeded,
    scanning,
    addFolder,
    removeFolder,
    rescanFolder,
    stopScan,
    restoreAccess
  } = useLibrary();
  const eta = useScanEta(scanning);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [active, setActive] = useState<SectionId>('management');
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  usePageTitle('Settings');

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
    for (const folder of folders) {
      await rescanFolder(folder.id);
    }
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Settings</h1>
      </div>

      <div className="xe_split">
        <nav className="xe_split__nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`xe_split__item${s.id === active ? ' xe_split__item--active' : ''}`}
              aria-current={s.id === active}
              onClick={() => setActive(s.id)}
            >
              <span>{s.label}</span>
              <ChevronRightIcon size={16} />
            </button>
          ))}
        </nav>

        <div className="xe_split__detail xe_page__scroll xe_settings">
          <header className="xe_split__head">
            <h2 className="xe_split__title">{section.label}</h2>
          </header>

          {active === 'management' && (
            <>
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
            </>
          )}

          {active === 'library' && (
            <>
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
                <p className="xe_settings__hint">
                  Xebrine automatically omits formats that the browser cannot play, e.g., .aiff, .alac, etc. Thus, use these settings sparingly, and only if your library is full of botchy pirated music with improper tagging.
                </p>
              </section>

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
                      {eta !== null && <span className="xe_banner__eta">{formatEta(eta)}</span>}
                    </span>
                    <button
                      type="button"
                      className="xe_btn xe_btn--small xe_btn--quiet xe_banner__stop"
                      onClick={stopScan}
                    >
                      <CloseIcon size={13} />
                      Stop scanning here
                    </button>
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
            </>
          )}

          {active === 'audio' && (
            <>
              <section className="xe_settings__section">
                <h2>Auto mix</h2>
                <p className="xe_settings__hint">
                  Auto mix is an experimental... automatic mixing subsystem. It works by analyzing the BPM of the currently playing track and the next enqueued track then calculates the BPM difference and ease of crossfading while beat-matching
                </p>
                <p className="xe_settings__hint">
                  This is <strong>extremely</strong> broken and will not work for most tracks. If you just queue every song on your drive expecting smooth transitions, you'll not get that.
                  I tuned this (and am still vigorously tuning it) basically for very long progressive house tracks like deadmau5, with super long 128 bpm intro and outros. This feature is <strong>incompatible</strong> for SoundCloud rappers, pop music, and basically anything that doesn't have a long intro/outro with the same BPM.
                </p>
                <p className="xe_settings__hint">
                  You may notice skips or gaps between or during mixing. This is expected as - by normal, Xebrine uses - and attempts to cleanly transition playback from - a traditional HTML5 audio element to play music. However, during mixing, Xebrine uses the Web Audio API to process the audio and crossfade it. I've made efforts to mitigate / eliminate that gap, but you may still notice it.
                </p>
                <p className="xe_settings__hint">
                  If you notice that during mixing, the next track sounds slowed down or sped up, that's... because it is. Xebrine will attempt to match the BPM of the next track to the current track, and if the next track is too far off in BPM, it will be sped up or slowed down to match. This is also expected and intended - I don't really have any better solutions yet.
                </p>
                <p className="xe_settings__hint">
                  As a programmer (and amateur DJ who has played a few times), I'm trying really hard to make this DJ software-like, bare with me...
                </p>
                <h2>Transition duration</h2>
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
                  <small><i>What do the pills mean?</i></small><br></br>
                  A <span style={{ color: '#3ddc84' }}>Green</span> pill means the current and next track BPMs are compatible for a mix
                  <br></br>
                  An <span style={{ color: '#f5a623' }}>Orange</span> pill means the BPMs are less-than-optimal but Xebrine will try mixing them anyway
                  <br></br>
                  A <span style={{ color: '#f5524a' }}>Red</span> pill means the BPMs are way too incompatible for mixing and they will just simply crossfade without processing
                </p>
              </section>

              <Equalizer />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
