import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMemo, useRef, useState } from 'react';
import { useSettings, type Settings } from '../context/settings_context';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import {
  DEFAULT_SIZE_LIMIT_BYTES,
  IGNORABLE_FORMATS,
  MAX_SIZE_LIMIT_BYTES,
  MIN_SIZE_LIMIT_BYTES,
  SIZE_QUIP_THRESHOLD_BYTES,
  type IgnoredFormat,
  type IgnoreRules
} from '../utils/ignore_rules';
import { Slider } from '../components/slider';
import { Equalizer } from '../components/equalizer';
import {
  ChevronRightIcon,
  FolderIcon,
  KeyIcon,
  LastfmWordmark,
  PlayIcon,
  RefreshIcon,
  TrashIcon
} from '../components/icons';
import { usePageTitle } from '../hooks/page_title';
import { toast, type ToastVariant } from '../utils/toast';
import { speakText } from '../utils/speech';
import { applyPronunciations } from '../utils/pronunciation';
import { parseSettingsJson, paramsToSettings, settingsToParams } from '../utils/settings_transfer';
import { clamp, formatBytes } from '../utils/format';
import { ExplicitIcon } from '../components/explicit_badge';
import { ScrobblingSettings } from '../components/scrobbling_settings';
import { Modal } from '../components/modal';
import { PROFANITY_WORDS } from '../utils/profanity';
import { THEMES } from '../utils/themes';
import {
  buildSearchUrl,
  ENGINE_GROUPS,
  engineKind,
  QUERY_TOKEN,
  SEARCH_ENGINES,
  type SearchEngineId
} from '../utils/search_engine';

type SectionId = 'preferences' | 'library' | 'playback' | 'scrobbling' | 'a11y' | 'toys' | 'share';

const SEARCH_PREVIEW = '4x4=12 by deadmau5';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'preferences', label: 'Main preferences' },
  { id: 'library', label: 'Library settings' },
  { id: 'playback', label: 'Playback settings' },
  { id: 'scrobbling', label: 'Last.fm scrobbling' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'toys', label: 'Toys' },
  { id: 'share', label: 'Share settings' }
];

const TOAST_VARIANTS: ToastVariant[] = ['success', 'error', 'info', 'warning'];

const SIZE_SLIDER_RATIO = MAX_SIZE_LIMIT_BYTES / MIN_SIZE_LIMIT_BYTES;

function sizeToSlider(bytes: number): number {
  return Math.log(bytes / MIN_SIZE_LIMIT_BYTES) / Math.log(SIZE_SLIDER_RATIO);
}

function sliderToSize(fraction: number): number {
  const bytes = MIN_SIZE_LIMIT_BYTES * SIZE_SLIDER_RATIO ** fraction;
  const MB = 1024 * 1024;
  return clamp(Math.round(bytes / MB) * MB, MIN_SIZE_LIMIT_BYTES, MAX_SIZE_LIMIT_BYTES);
}

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
    restoreAccess
  } = useLibrary();
  const { current } = usePlayer();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info');
  const [toastMessage, setToastMessage] = useState('');
  const [showFilteredWords, setShowFilteredWords] = useState(false);
  const [pronArtist, setPronArtist] = useState('');
  const [pronSay, setPronSay] = useState('');
  const [pendingImport, setPendingImport] = useState<{
    settings: Partial<Settings>;
    fromUrl: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section: string }>();
  const active = (SECTIONS.find((s) => s.id === sectionParam)?.id ?? SECTIONS[0].id) as SectionId;
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  usePageTitle('Settings');

  const folderSongCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of tracks) {
      counts.set(track.folderId, (counts.get(track.folderId) ?? 0) + 1);
    }
    return counts;
  }, [tracks]);

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

  const addPronunciation = () => {
    const artist = pronArtist.trim();
    const pronunciation = pronSay.trim();
    if (!artist || !pronunciation) return;
    const rest = settings.artistPronunciations.filter(
      (p) => p.artist.toLowerCase() !== artist.toLowerCase()
    );
    update({ artistPronunciations: [...rest, { artist, pronunciation }] });
    setPronArtist('');
    setPronSay('');
  };

  const removePronunciation = (artist: string) => {
    update({
      artistPronunciations: settings.artistPronunciations.filter((p) => p.artist !== artist)
    });
  };

  const announceCurrentSong = () => {
    if (current)
      speakText(
        applyPronunciations(
          `Now playing: ${current.track.title} by ${current.track.artist}`,
          settings.artistPronunciations
        )
      );
    else speakText('no');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xebrine-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseSettingsJson(await file.text());
      if (Object.keys(parsed).length === 0) {
        toast.error('Nothing to do with this file');
        return;
      }
      setPendingImport({ settings: parsed, fromUrl: false });
    } catch {
      toast.error('Invalid Xebrine settings JSON');
    }
  };

  const shareUrl = `${window.location.origin}/settings/share?${settingsToParams(settings)}`;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share URL copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const incomingSettings = paramsToSettings(searchParams);
  const incomingCount = Object.keys(incomingSettings).length;

  const applyPendingImport = () => {
    if (!pendingImport) return;
    const count = Object.keys(pendingImport.settings).length;
    update(pendingImport.settings);
    toast.success(`Applied ${count} setting${count === 1 ? '' : 's'}`);
    const fromUrl = pendingImport.fromUrl;
    setPendingImport(null);
    if (fromUrl) navigate('/settings/share');
  };

  const formatValue = (value: unknown) =>
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

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
            {active === 'scrobbling' && <LastfmWordmark height={20} />}
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
                <h2>Theme</h2>
                <div className="xe_settings__chip-row">
                  {THEMES.map((themeOption) => {
                    const active = settings.theme === themeOption.id;
                    return (
                      <button
                        key={themeOption.id}
                        type="button"
                        className={`xe_theme-swatch${active ? ' xe_theme-swatch--active' : ''}${
                          themeOption.id === 'adaptive' ? ' xe_theme-swatch--adaptive' : ''
                        }`}
                        aria-pressed={active}
                        onClick={() => update({ theme: themeOption.id })}
                      >
                        <span
                          className="xe_theme-swatch__dot"
                          style={{
                            background: `linear-gradient(135deg, ${themeOption.swatch[0]} 50%, ${themeOption.swatch[1]} 50%)`,
                            borderColor: themeOption.swatch[2]
                          }}
                        />
                        {themeOption.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="xe_settings__section">
                <h2>Context menu search engine/source</h2>
                <select
                  className="xe_sort-select"
                  aria-label="Context menu search engine/source"
                  value={settings.searchEngine}
                  onChange={(e) => update({ searchEngine: e.target.value as SearchEngineId })}
                >
                  {ENGINE_GROUPS.map((group) => (
                    <optgroup key={group.kind} label={group.label}>
                      {SEARCH_ENGINES.filter((engine) => engineKind(engine.id) === group.kind).map(
                        (engine) => (
                          <option key={engine.id} value={engine.id}>
                            {engine.label}
                          </option>
                        )
                      )}
                    </optgroup>
                  ))}
                </select>
                {settings.searchEngine === 'custom' && (
                  <>
                    <input
                      type="text"
                      className="xe_search-input xe_settings__search-url"
                      placeholder={`https://sigma.com/search?q=${QUERY_TOKEN}`}
                      value={settings.customSearchUrl}
                      onChange={(e) => update({ customSearchUrl: e.target.value })}
                    />
                    <p className="xe_settings__hint">
                      Put <code>{QUERY_TOKEN}</code> where the query goes
                    </p>
                  </>
                )}
                <p className="xe_settings__hint">
                  This will open {' '}
                  <u>{buildSearchUrl(SEARCH_PREVIEW, settings.searchEngine, settings.customSearchUrl)}</u> {' '}
                  when selected
                </p>
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
                <h2>Prevent exit</h2>
                <label className="xe_settings__radio">
                  <input
                    type="checkbox"
                    checked={settings.preventExit}
                    onChange={(e) => update({ preventExit: e.target.checked })}
                  />
                  <span>Ask for confirmation before closing while a track is playing</span>
                </label>
                <p className="xe_settings__hint">
                  When off, the "Leave site?" prompt will not appear
                </p>
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
                        className={`xe_settings__quip${
                          settings.ignoreRules.maxSizeBytes > SIZE_QUIP_THRESHOLD_BYTES
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
                  Currently crawling <strong>{tracks.length}</strong> track{tracks.length === 1 ? '' : 's'} across <strong>{folders.length}</strong> folder
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

          {active === 'scrobbling' && <ScrobblingSettings />}

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

              <section className="xe_settings__section">
                <h2>Artist pronunciation</h2>
                <div className="xe_settings__pron-row">
                  <input
                    type="text"
                    className="xe_search-input"
                    placeholder="Who? (e.g. deadmau5)"
                    value={pronArtist}
                    onChange={(e) => setPronArtist(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPronunciation()}
                  />
                  <input
                    type="text"
                    className="xe_search-input"
                    placeholder="Pronounce as? (e.g. dead mouse)"
                    value={pronSay}
                    onChange={(e) => setPronSay(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPronunciation()}
                  />
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent"
                    onClick={addPronunciation}
                    disabled={!pronArtist.trim() || !pronSay.trim()}
                  >
                    Add
                  </button>
                </div>
                {settings.artistPronunciations.length > 0 && (
                  <ul className="xe_settings__folders">
                    {settings.artistPronunciations.map((p) => (
                      <li key={p.artist}>
                        <div className="xe_settings__folder-info">
                          <span className="xe_settings__folder-name">{p.artist}</span>
                          <span className="xe_settings__folder-count">as <i>{p.pronunciation}</i></span>
                        </div>
                        <div className="xe_settings__folder-actions">
                          <button
                            type="button"
                            className="xe_btn xe_btn--accent"
                            onClick={() => speakText(p.pronunciation)}
                            aria-label={`Play pronunciation for ${p.artist}`}
                          >
                            <PlayIcon size={14} />
                            Test
                          </button>
                          <button
                            type="button"
                            className="xe_btn xe_settings__folder-remove"
                            onClick={() => removePronunciation(p.artist)}
                            aria-label={`Remove pronunciation for ${p.artist}`}
                          >
                            <TrashIcon size={14} />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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

          {active === 'share' && (
            <>
              {incomingCount > 0 && (
                <div className="xe_banner xe_banner--info">
                  <span>
                    <strong>{incomingCount}</strong> shared setting{incomingCount === 1 ? '' : 's'} to apply
                  </span>
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent"
                    onClick={() => setPendingImport({ settings: incomingSettings, fromUrl: true })}
                  >
                    Review & apply
                  </button>
                </div>
              )}

              {pendingImport && (
                <Modal title="Import these settings?" onClose={() => setPendingImport(null)}>
                  <ul className="xe_settings__import-list">
                    {Object.entries(pendingImport.settings).map(([key, value]) => (
                      <li key={key}>
                        <span className="xe_settings__import-key">{key}</span>
                        <span className="xe_settings__import-value">{formatValue(value)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="xe_settings__actions">
                    <button type="button" className="xe_btn xe_btn--accent" onClick={applyPendingImport}>
                      Apply {Object.keys(pendingImport.settings).length} setting
                      {Object.keys(pendingImport.settings).length === 1 ? '' : 's'}
                    </button>
                    <button type="button" className="xe_btn" onClick={() => setPendingImport(null)}>
                      Cancel
                    </button>
                  </div>
                </Modal>
              )}

              <section className="xe_settings__section">
                <h2>As a file</h2>
                <p className="xe_settings__hint">
                  Export every setting to a JSON file, or load one back in
                </p>
                <div className="xe_settings__actions">
                  <button type="button" className="xe_btn" onClick={exportJson}>
                    Export JSON
                  </button>
                  <button type="button" className="xe_btn" onClick={() => fileInputRef.current?.click()}>
                    Import JSON
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importJson(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </section>

              <section className="xe_settings__section">
                <h2>As a link (recommended)</h2>
                <p className="xe_settings__hint">
                  Packs all settings into parameters in a URL
                </p>
                <input type="text" className="xe_search-input xe_settings__share-url" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
                <div className="xe_settings__actions">
                  <button type="button" className="xe_btn xe_btn--accent" onClick={copyShareUrl}>
                    Copy link
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
