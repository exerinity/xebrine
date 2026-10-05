import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../context/settings_context';
import { useLastfmSession } from '../hooks/lastfm_session';
import { setLastfmSession } from '../utils/lastfm_session';
import {
  connectLastfm,
  fetchProfile,
  fetchRecentTracks,
  type LastfmProfile,
  type RecentTrack
} from '../api/lastfm';
import {
  clearPending,
  flushScrobbles,
  pendingScrobbles,
  subscribePending,
  type PendingScrobble
} from '../management/scrobbles';
import type { ScrobbleIgnoreRules } from '../utils/scrobble_rules';
import { toast } from '../utils/toast';
import { LastfmIcon, LogoIcon, RefreshIcon } from './icons';
import { Spinner } from './spinner';
import { Slider } from './slider';
import { LASTFM_COUNTRIES } from '../utils/countries';
import { estimateCountryFromTimezone } from '../utils/timezone_country';

function stamp(unix: number | null): string {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function ScrobblingSettings() {
  const { settings, update } = useSettings();
  const session = useLastfmSession();
  const estimatedCountry = estimateCountryFromTimezone();
  const [profile, setProfile] = useState<LastfmProfile | null>(null);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [pending, setPending] = useState<PendingScrobble[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshPending = useCallback(() => {
    pendingScrobbles()
      .then(setPending)
      .catch(() => setPending([]));
  }, []);

  useEffect(() => {
    refreshPending();
    return subscribePending(refreshPending);
  }, [refreshPending]);

  const loadAccount = useCallback((username: string) => {
    setLoading(true);
    Promise.all([fetchProfile(username), fetchRecentTracks(username, 25)])
      .then(([info, tracks]) => {
        setProfile(info);
        setRecent(tracks);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Couldn't load your Last.fm profile: ${message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setRecent([]);
      return;
    }
    loadAccount(session.username);
  }, [session?.username, loadAccount]);

  const connect = () => {
    setConnecting(true);
    connectLastfm()
      .then((next) => {
        setLastfmSession(next);
        toast.success(`Connected to Last.fm as ${next.username}`);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(message);
      })
      .finally(() => setConnecting(false));
  };

  const disconnect = () => {
    setLastfmSession(null);
    toast.info('Disconnected from Last.fm');
  };

  const retry = () => {
    if (!session) return;
    flushScrobbles(session.sessionKey)
      .then((sent) => {
        if (sent > 0) toast.success(`Sent ${sent} pending scrobble${sent === 1 ? '' : 's'}`);
        else toast.info('Nothing was waiting to be sent');
        loadAccount(session.username);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Still couldn't send them: ${message}`, 0);
      });
  };

  const updateRules = (patch: Partial<ScrobbleIgnoreRules>) =>
    update({ scrobbleIgnoreRules: { ...settings.scrobbleIgnoreRules, ...patch } });

  const rules = settings.scrobbleIgnoreRules;

  return (
    <>
      <section className="xe_settings__section">
        <h2>Last.fm account</h2>
        {session ? (
          <>
            <div className="xe_scrobble-profile">
              <div className="xe_scrobble-profile__art">
                {profile?.image ? (
                  <img src={profile.image} alt="" loading="lazy" />
                ) : (
                  <LogoIcon size={30} />
                )}
              </div>
              <div className="xe_scrobble-profile__info">
                <strong className="xe_scrobble-profile__name">
                  {profile?.realname || session.username}
                </strong>
                <span className="xe_scrobble-profile__meta">
                  {profile ? (
                    <>
                      {profile.playcount.toLocaleString()} scrobbles
                      {profile.country ? ` / ${profile.country}` : ''}
                      {profile.registered
                        ? ` / Joined ${new Date(profile.registered * 1000).getFullYear()}`
                        : ''}
                    </>
                  ) : (
                    <span className="xe_scrobble-profile__loading">
                      <Spinner size={11} />
                      Loading profile...
                    </span>
                  )}
                </span>
                {profile?.url && (
                  <a
                    className="xe_scrobble-profile__link"
                    href={profile.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open my profile on Last.fm
                  </a>
                )}
              </div>
              <div className="xe_scrobble-profile__actions">
                <button
                  type="button"
                  className="xe_btn"
                  onClick={() => loadAccount(session.username)}
                  disabled={loading}
                >
                  <RefreshIcon size={14} />
                  Refresh
                </button>
                <button type="button" className="xe_btn xe_btn--quiet" onClick={disconnect}>
                  Disconnect
                </button>
              </div>
            </div>
            <p className="xe_settings__hint">Logged in as {session.username}</p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="xe_btn xe_btn--accent"
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? <Spinner size={14} /> : <LastfmIcon size={14} />}
              {connecting ? 'Waiting for Last.fm...' : 'Connect your Last.fm account'}
            </button>
          </>
        )}
      </section>

      <section className="xe_settings__section">
        <h2>Loved tracks</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.lastfmLovedTracks}
            disabled={!session}
            onChange={(event) => update({ lastfmLovedTracks: event.target.checked })}
          />
          <span>Show and update loved tracks from the player bar</span>
        </label>
        <p className="xe_settings__hint">
          Xebrine checks whether the current track is loved, then lets you love or unlove it on Last.fm
        </p>
      </section>

      <section className="xe_settings__section">
        <h2>Last.fm amenities</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.lastfmAmenities}
            onChange={(event) => update({ lastfmAmenities: event.target.checked })}
          />
          <span>Add Last.fm features to the home page</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.lastfmGeoAmenities}
            disabled={!settings.lastfmAmenities}
            onChange={(event) => update({ lastfmGeoAmenities: event.target.checked })}
          />
          <span>Share my country to power the geo trending section</span>
        </label>
        <label className="xe_settings__geo-country">
          <span>If you don't want to send your country, you can select any here:</span>
          <select
            className="xe_eq__select"
            value={settings.lastfmGeoCountry}
            disabled={!settings.lastfmAmenities}
            onChange={(event) => update({ lastfmGeoCountry: event.target.value })}
          >
            <option value="">
              Estimate from timezone{estimatedCountry ? ` (${estimatedCountry})` : ''}
            </option>
            {LASTFM_COUNTRIES.map((country) => (
              <option value={country.code} key={country.code}>{country.name}</option>
            ))}
          </select>
        </label>
        <div className="xe_settings__geo-limit">
          <span>Trending chart search depth</span>
          <div className="xe_settings__slider-row">
            <Slider
              value={settings.lastfmTrendingLimit}
              min={15}
              max={500}
              wheelStep={5}
              resetTo={50}
              disabled={!settings.lastfmAmenities}
              onChange={(value) => update({ lastfmTrendingLimit: Math.round(value / 5) * 5 })}
              ariaLabel="Trending chart search depth"
            />
            <span className="xe_settings__slider-value">{settings.lastfmTrendingLimit}</span>
          </div>
          <p className="xe_settings__hint">
            Search further down the worldwide and country charts when your library is large and matching tracks are buried below the top results
          </p>
        </div>
        <div className="xe_settings__geo-limit">
          <span>Tracks shown in each amenity</span>
          <div className="xe_settings__slider-row">
            <Slider
              value={settings.lastfmAmenitiesDisplayLimit}
              min={1}
              max={50}
              wheelStep={1}
              resetTo={9}
              disabled={!settings.lastfmAmenities}
              onChange={(value) => update({ lastfmAmenitiesDisplayLimit: Math.round(value) })}
              ariaLabel="Tracks shown in each Last.fm amenity"
            />
            <span className="xe_settings__slider-value">{settings.lastfmAmenitiesDisplayLimit}</span>
          </div>
          <p className="xe_settings__hint">
            This caps the cards shown in every Last.fm amenity on Home without changing how far down the charts Xebrine searches
          </p>
        </div>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.lastfmGeoHideWorldwideDuplicates}
            disabled={!settings.lastfmAmenities}
            onChange={(event) => update({ lastfmGeoHideWorldwideDuplicates: event.target.checked })}
          />
          <span>Hide tracks already shown in worldwide Trending</span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Scrobbling</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.scrobbleEnabled}
            onChange={(e) => update({ scrobbleEnabled: e.target.checked })}
          />
          <span>Scrobble tracks as I listen</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={settings.scrobbleNowPlaying}
            onChange={(e) => update({ scrobbleNowPlaying: e.target.checked })}
          />
          <span>Send a now playing status</span>
        </label>
        <p className="xe_settings__hint">
          Tracks over 30 seconds are scrobbled either after 4 minutes or 50% playback, whichever comes first
        </p>
      </section>

      <section className="xe_settings__section">
        <h2>Metadata matching</h2>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="scrobble-mode"
            checked={settings.scrobbleMode === 'strict'}
            onChange={() => update({ scrobbleMode: 'strict' })}
          />
          <span>
            <strong>Strict</strong> sends everything exactly as tagged - title, artist, album, album
            artist, track number and duration. Best fidelity, but poor tags may not match anything
          </span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="radio"
            name="scrobble-mode"
            checked={settings.scrobbleMode === 'lax'}
            onChange={() => update({ scrobbleMode: 'lax' })}
          />
          <span>
            <strong>Lax</strong> sends only the title and artist, letting Last.fm do its best to
            match the rest
          </span>
        </label>
      </section>

      <section className="xe_settings__section">
        <h2>Never scrobble tracks that...</h2>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={rules.missingTitle}
            onChange={(e) => updateRules({ missingTitle: e.target.checked })}
          />
          <span>Have no title tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={rules.missingArtist}
            onChange={(e) => updateRules({ missingArtist: e.target.checked })}
          />
          <span>Have no artist tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={rules.missingAlbum}
            onChange={(e) => updateRules({ missingAlbum: e.target.checked })}
          />
          <span>Have no album tag</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={rules.missingCover}
            onChange={(e) => updateRules({ missingCover: e.target.checked })}
          />
          <span>Have no cover art</span>
        </label>
        <label className="xe_settings__radio">
          <input
            type="checkbox"
            checked={rules.minDurationSeconds !== null}
            onChange={(e) => updateRules({ minDurationSeconds: e.target.checked ? 60 : null })}
          />
          <span>Are shorter than a set length</span>
        </label>
        {rules.minDurationSeconds !== null && (
          <label className="xe_scrobble-duration">
            <input
              className="xe_scrobble-duration__input"
              type="number"
              min={31}
              max={3600}
              value={rules.minDurationSeconds}
              onChange={(e) =>
                updateRules({ minDurationSeconds: Math.max(31, Number(e.target.value) || 31) })
              }
            />
            <span className="xe_scrobble-duration__unit">seconds</span>
          </label>
        )}
      </section>

      <section className="xe_settings__section">
        <h2>Offline / failed scrobbles queue</h2>
        {pending.length === 0 ? (
          <p className="xe_settings__hint">
            There are no enqueued scrobbles - if a scrobble is unsuccessful, either for being offline or otherwise did not complete, it will be enqueued here to try later
          </p>
        ) : (
          <>
            <ul className="xe_scrobble-list">
              {pending.map((item) => (
                <li key={item.id} className="xe_scrobble-list__item">
                  <span className="xe_scrobble-list__title">{item.track}</span>
                  <span className="xe_scrobble-list__meta">
                    {item.artist} / {stamp(item.timestamp)}
                    {item.attempts > 0 ? ` / ${item.attempts} failed attempts` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="xe_settings__chip-row">
              <button type="button" className="xe_btn xe_btn--accent" onClick={retry} disabled={!session}>
                <RefreshIcon size={14} />
                Push {pending.length} now
              </button>
              <button type="button" className="xe_btn xe_btn--quiet" onClick={() => void clearPending()}>
                Forget about it
              </button>
            </div>
          </>
        )}
      </section>

      {session && (
        <section className="xe_settings__section">
          <h2>Recent scrobbles</h2>
          {recent.length === 0 ? (
            <p className="xe_settings__hint">
              {loading ? (
                <span className="xe_scrobble-profile__loading">
                  <Spinner size={11} />
                  Loading your history...
                </span>
              ) : (
                'Nothing!'
              )}
            </p>
          ) : (
            <ul className="xe_scrobble-list">
              {recent.map((item, i) => (
                <li key={`${item.url}-${item.playedAt ?? i}`} className="xe_scrobble-list__item">
                  <span className="xe_scrobble-list__title">
                    {item.track}
                    {item.nowPlaying && <span className="xe_scrobble-list__badge">Now playing</span>}
                  </span>
                  <span className="xe_scrobble-list__meta">
                    {item.artist}
                    {item.album ? ` / ${item.album}` : ''}
                    {item.playedAt ? ` / ${stamp(item.playedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
