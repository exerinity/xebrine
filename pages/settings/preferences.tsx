import { useState } from 'react';
import { useSettings } from '../../context/settings_context';
import { Slider } from '../../components/slider';
import { PAGE_KEY_HINTS, PAGE_KEY_LABELS, PAGE_KEY_MODES, pageKeyLevel, pageKeyModeFromLevel } from '../../utils/page_keys';
import { buildSearchUrl, ENGINE_GROUPS, engineKind, QUERY_TOKEN, SEARCH_ENGINES, type SearchEngineId } from '../../utils/search_engine';

const SEARCH_PREVIEW = '4x4=12 by deadmau5';

export function PreferencesSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const enableNotifications = async (enabled: boolean) => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      setNotifPermission(await Notification.requestPermission());
    }
    update({ notifications: enabled });
  };

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Main preferences</h2>}
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
        <h2>Default context menu search engine/source</h2>
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
            <strong>Open field</strong> navigates to the artist or album page, or opens the radio station website
          </span>
        </label>
        <p className="xe_settings__hint">Secondary clicking will always do the opposite action set here</p>
      </section>

      <section className="xe_settings__section">
        <h2>Page keys navigation</h2>
        <div className="xe_settings__slider-row">
          <Slider
            value={pageKeyLevel(settings.pageKeyMode)}
            min={1}
            max={PAGE_KEY_MODES.length}
            wheelStep={1}
            resetTo={1}
            markAt={2}
            onChange={(v) => update({ pageKeyMode: pageKeyModeFromLevel(v) })}
            ariaLabel="Page keys navigation mode"
          />
        </div>
        <div className="xe_settings__stops">
          {PAGE_KEY_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`xe_settings__stop${settings.pageKeyMode === mode ? ' xe_settings__stop--active' : ''
                }`}
              aria-pressed={settings.pageKeyMode === mode}
              onClick={() => update({ pageKeyMode: mode })}
            >
              {PAGE_KEY_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="xe_settings__hint">{PAGE_KEY_HINTS[settings.pageKeyMode]}</p>
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
    </>
  );
}
