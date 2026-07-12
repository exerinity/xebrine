import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useSettings } from '../context/settings_context';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { IGNORABLE_FORMATS, type IgnoredFormat, type IgnoreRules } from '../utils/ignore_rules';
import { Spinner } from '../components/spinner';
import { Slider } from '../components/slider';
import { Equalizer } from '../components/equalizer';
import { ChevronRightIcon, CloseIcon, FolderIcon, KeyIcon, RefreshIcon, TrashIcon } from '../components/icons';
import { useScanEta, formatEta } from '../hooks/scan_eta';
import { usePageTitle } from '../hooks/page_title';
import { toast, type ToastVariant } from '../utils/toast';
import { speakText } from '../utils/speech';
import { ExplicitIcon } from '../components/explicit_badge';
import { Modal } from '../components/modal';
import { PROFANITY_WORDS } from '../utils/profanity';

type SectionId = 'preferences' | 'library' | 'playback' | 'a11y' | 'toys';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'preferences', label: 'Main preferences' },
  { id: 'library', label: 'Library settings' },
  { id: 'playback', label: 'Playback settings' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'toys', label: 'Toys' }
];

const TOAST_VARIANTS: ToastVariant[] = ['success', 'error', 'info', 'warning'];

const FS_BG_PRESETS: { label: string; blur: number; saturate: number }[] = [
  { label: 'None', blur: 0, saturate: 1 },
  { label: 'Cinematic', blur: 56, saturate: 1.35 },
  { label: 'Vague', blur: 32, saturate: 1.1 },
  { label: 'Dramatic', blur: 80, saturate: 1.9 },
  { label: 'Maximum', blur: 120, saturate: 3 }
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
  const { current } = usePlayer();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info');
  const [toastMessage, setToastMessage] = useState('');
  const [showFilteredWords, setShowFilteredWords] = useState(false);
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section: string }>();
  const active = (SECTIONS.find((s) => s.id === sectionParam)?.id ?? SECTIONS[0].id) as SectionId;
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

  const createToast = () => {
    toast[toastVariant](toastMessage.trim() || `This is a ${toastVariant} toast`);
  };

  const announceCurrentSong = () => {
    if (current) speakText(`Now playing: ${current.track.title} by ${current.track.artist}`);
    else speakText('no');
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
              onClick={() => navigate(`/settings/${s.id}`)}
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

          {active === 'preferences' && (
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
                <h2>What should clicking fields in the player bar do?</h2>
                <label className="xe_settings__radio">
                  <input
                    type="radio"
                    name="player-bar-click-action"
                    checked={settings.playerBarClickAction === 'copy'}
                    onChange={() => update({ playerBarClickAction: 'copy' })}
                  />
                  <span>
                    <strong>Copy field</strong> copies the title, artist, or album text to your clipboard
                  </span>
                </label>
                <label className="xe_settings__radio">
                  <input
                    type="radio"
                    name="player-bar-click-action"
                    checked={settings.playerBarClickAction === 'open'}
                    onChange={() => update({ playerBarClickAction: 'open' })}
                  />
                  <span>
                    <strong>Open field</strong> navigates to the artist or album page
                  </span>
                </label>
                <p className="xe_settings__hint">Secondary clicking will always do the opposite action set here</p>
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
                <h2>Fullscreen player background</h2>
                <p className="xe_settings__hint">
                  Right-click a slider to reset it to default
                </p>
                <div className="xe_settings__chip-row">
                  {FS_BG_PRESETS.map((preset) => {
                    const activePreset =
                      settings.fsBlur === preset.blur && settings.fsSaturate === preset.saturate;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`xe_settings__chip${activePreset ? ' xe_settings__chip--active' : ''}`}
                        aria-pressed={activePreset}
                        onClick={() => update({ fsBlur: preset.blur, fsSaturate: preset.saturate })}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <h2>Blur</h2>
                <div className="xe_settings__slider-row">
                  <Slider
                    value={settings.fsBlur}
                    min={0}
                    max={120}
                    wheelStep={1}
                    resetTo={56}
                    onChange={(v) => update({ fsBlur: Math.round(v) })}
                    ariaLabel="Fullscreen player background blur"
                  />
                  <span className="xe_settings__slider-value">{settings.fsBlur}px</span>
                </div>
                <h2>Saturation</h2>
                <div className="xe_settings__slider-row">
                  <Slider
                    value={settings.fsSaturate}
                    min={0}
                    max={3}
                    wheelStep={0.05}
                    resetTo={1.35}
                    onChange={(v) => update({ fsSaturate: Math.round(v * 100) / 100 })}
                    ariaLabel="Fullscreen player background saturation"
                  />
                  <span className="xe_settings__slider-value">{settings.fsSaturate.toFixed(2)}x</span>
                </div>
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
                  Xebrine automatically omits formats that the browser cannot play, e.g., .aiff, .alac, etc. Thus, use these settings sparingly, and only if your library is full of botchy ripped music with improper tagging. A well-tagged folder with clean streams shouldn't need any of these applied.
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
                      className="xe_btn xe_banner__stop"
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
                      <div className="xe_settings__folder-actions">
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
                          className="xe_btn xe_settings__folder-remove"
                          onClick={() => void removeFolder(folder.id)}
                          aria-label={`Remove ${folder.name}`}
                        >
                          <TrashIcon size={14} />
                          Remove
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

          {active === 'playback' && (
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
                    resetTo={15}
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

          {active === 'a11y' && (
            <>
              <section className="xe_settings__section">
                <h2>Motion</h2>
                <label className="xe_settings__radio">
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(e) => update({ reducedMotion: e.target.checked })}
                  />
                  <span>Reduced motion</span>
                </label>
              </section>

              <section className="xe_settings__section">
                <h2>Speech</h2>
                <label className="xe_settings__radio">
                  <input
                    type="checkbox"
                    checked={settings.announceTrackChanges}
                    onChange={(e) => update({ announceTrackChanges: e.target.checked })}
                  />
                  <span>Announce when a song is finished or changes over TTS</span>
                </label>
              </section>
            </>
          )}

          {active === 'toys' && (
            <>
              <section className="xe_settings__section">
                <h2>Create a toast notification</h2>
                <input
                  type="text"
                  className="xe_search-input"
                  placeholder={`This is a ${toastVariant} toast`}
                  value={toastMessage}
                  onChange={(e) => setToastMessage(e.target.value)}
                />
                <div className="xe_settings__chip-row">
                  {TOAST_VARIANTS.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      className={`xe_settings__chip xe_settings__chip--${variant}${variant === toastVariant ? ' xe_settings__chip--active' : ''}`}
                      aria-pressed={variant === toastVariant}
                      onClick={() => setToastVariant(variant)}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
                <div className="xe_settings__actions">
                  <button
                    type="button"
                    className={`xe_btn xe_btn--accent xe_btn--toast-${toastVariant}`}
                    onClick={createToast}
                  >
                    Create toast
                  </button>
                </div>
              </section>

              <section className="xe_settings__section">
                <h2>Announce currently playing song</h2>
                <div className="xe_settings__actions">
                  <button type="button" className="xe_btn" onClick={announceCurrentSong}>
                    Announce
                  </button>
                </div>
              </section>

              <section className="xe_settings__section">
                <h2>Tag explicit songs?</h2>
                <label className="xe_settings__radio">
                  <input
                    type="checkbox"
                    checked={settings.tagExplicitSongs}
                    onChange={(e) => update({ tagExplicitSongs: e.target.checked })}
                  />
                  <span>
                    Scan lyrics for profanity and mark profane songs with an <ExplicitIcon />
                  </span>
                </label>
                <p className="xe_settings__hint">
                  Runs whenever lyrics are found for a track (freshly fetched, imported, or already cached). Once a
                  song is tagged, it stays tagged in this browser, even if the setting is later turned off.<br></br>
                  <i>Note:</i> this is not automatic (you must initiate a lyrics search) and is pretty rudimentary{' '}
                  <button type="button" className="xe_link-btn" onClick={() => setShowFilteredWords(true)}>
                    (show words to filter)
                  </button>
                </p>
                {showFilteredWords && (
                  <Modal title="Filtered words" onClose={() => setShowFilteredWords(false)}>
                    <div className="xe_settings__chip-row">
                      {PROFANITY_WORDS.map((word) => (
                        <span key={word} className="xe_settings__chip">
                          {word}
                        </span>
                      ))}
                    </div>
                  </Modal>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
