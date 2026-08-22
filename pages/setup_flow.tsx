import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { connectLastfm } from '../api/lastfm';
import { CheckIcon, FolderIcon, LastfmIcon, PlayIcon } from '../components/icons';
import { Spinner } from '../components/spinner';
import { useLastfmSession } from '../hooks/lastfm_session';
import { usePageTitle } from '../hooks/page_title';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { useSetupFlow } from '../context/setup_flow_context';
import { setLastfmSession } from '../utils/lastfm_session';
import { THEMES } from '../utils/themes';
import { toast } from '../utils/toast';

const SETUP_KEY = 'hai';

const STEPS = [
  'Add music',
  'Pick a theme',
  'Place control position',
  'Got Last.fm?',
  'Finish'
] as const;

export function SetupFlowPage() {
  const navigate = useNavigate();
  const { folders, tracks, scanning, supported, addFolder } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const { settings, update } = useSettings();
  const { step, setStep, setNavigationGuard } = useSetupFlow();
  const lastfm = useLastfmSession();
  const [connecting, setConnecting] = useState(false);
  usePageTitle('Setup');

  useEffect(() => {
    setNavigationGuard(step < STEPS.length - 1);
  }, [setNavigationGuard, step]);

  if (localStorage.getItem(SETUP_KEY)) return <Navigate to="/" replace />;

  const connect = async () => {
    setConnecting(true);
    try {
      const session = await connectLastfm();
      setLastfmSession(session);
      toast.success(`Connected to Last.fm as ${session.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not connect to Last.fm');
    } finally {
      setConnecting(false);
    }
  };

  const finish = (play: boolean) => {
    setNavigationGuard(false);
    try {
      localStorage.setItem(SETUP_KEY, '1');
    } catch {
      null;
    }
    if (play && tracks.length > 0) playNow(tracks, 0);
    navigate('/', { replace: true });
  };

  return (
    <div className="xe_page xe_setup">
      <div className="xe_page__scroll xe_setup__scroll">
        <div className="xe_setup__shell">
          <header className="xe_setup__header">
            <h1>Welcome to Xebrine!</h1>
            <p>Let's get you set up, then some music playing! A few steps:</p>
          </header>

          <ol className="xe_setup__progress" aria-label="Setup progress">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={`${index === step ? 'xe_setup__progress-item--active' : ''}${index < step ? ' xe_setup__progress-item--done' : ''
                  }`}
                aria-current={index === step ? 'step' : undefined}
              >
                <span>{index < step ? <CheckIcon size={15} /> : index + 1}</span>
                <small>{label}</small>
              </li>
            ))}
          </ol>

          <section className="xe_setup__card">
            {step === 0 && (
              <>
                <span className="xe_setup__step-label">Step 1/5</span>
                <h2>Choose a folder to scan</h2>
                <p>
                  Pick the folder for Xebrine to scan. Ideally, pick your parent music folder, at /home/exerinity/Music or C:/Users/exerinity/Music.
                </p>
                {supported ? (
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent xe_setup__primary-action"
                    onClick={() => void addFolder()}
                    disabled={scanning !== null}
                  >
                    {scanning ? <Spinner size={15} /> : <FolderIcon size={16} />}
                    {scanning ? `Scanning ${scanning.folderName}...` : 'Choose a music folder'}
                  </button>
                ) : (
                  <p className="xe_setup__notice">
                    Folder access is not supported in this browser
                  </p>
                )}
                {folders.length > 0 && (
                  <div className="xe_setup__success">
                    <CheckIcon size={17} />
                    {folders.length} folder{folders.length === 1 ? '' : 's'} added
                    {tracks.length > 0
                      ? `, with ${tracks.length.toLocaleString()} track${tracks.length === 1 ? '' : 's'} found`
                      : ''}
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <span className="xe_setup__step-label">Step 2/5</span>
                <h2>Choose a theme</h2>
                <p>Adaptive picks colors from the album cover of whatever song is playing and dynamically colors the app based on it. You can change this later in Settings.</p>
                <div className="xe_settings__chip-row xe_setup__themes">
                  {THEMES.map((theme) => {
                    const selected = settings.theme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`xe_theme-swatch${selected ? ' xe_theme-swatch--active' : ''}${theme.id === 'adaptive' ? ' xe_theme-swatch--adaptive' : ''
                          }`}
                        aria-pressed={selected}
                        onClick={() => update({ theme: theme.id })}
                      >
                        <span
                          className="xe_theme-swatch__dot"
                          style={{
                            background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)`,
                            borderColor: theme.swatch[2]
                          }}
                        />
                        {theme.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <span className="xe_setup__step-label">Step 3/5</span>
                <h2>Where should the controls go?</h2>
                <p>You can further adjust this in Settings, by making it compact and swapping the order of the controls & slider.</p>
                <div className="xe_setup__choices">
                  {(['top', 'bottom'] as const).map((position) => (
                    <button
                      key={position}
                      type="button"
                      className={`xe_setup__choice${settings.playerBarPosition === position ? ' xe_setup__choice--active' : ''
                        }`}
                      aria-pressed={settings.playerBarPosition === position}
                      onClick={() => update({ playerBarPosition: position })}
                    >
                      <span className={`xe_setup__player-preview xe_setup__player-preview--${position}`}>
                        <i />
                      </span>
                      <strong>{position === 'top' ? 'Top' : 'Bottom'}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <span className="xe_setup__step-label">Step 4/5</span>
                <h2>Got Last.fm?</h2>
                <p>
                  Keep the scrobbling going by connecting Xebrine to Last.fm. You can adjust the scrobbler
                  behavior in the Last.fm settings.
                </p>
                {lastfm ? (
                  <div className="xe_setup__success">
                    <CheckIcon size={17} /> Connected as {lastfm.username}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent xe_setup__primary-action"
                    onClick={() => void connect()}
                    disabled={connecting}
                  >
                    {connecting ? <Spinner size={15} /> : <LastfmIcon size={16} />}
                    {connecting ? 'Waiting for Last.fm...' : 'Connect Last.fm'}
                  </button>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <span className="xe_setup__step-label">Step 5/5</span>
                <h2>Now get playing!</h2>
                <p>
                  Xebrine is all yours. I highly recommend you perform more setup by going through
                  <Link to="/settings">the settings page</Link> - Xebrine has a fair few settings you can change.
                  <br></br>
                  And again - welcome aboard, and I hope you enjoy using Xebrine!
                  - <a href="https://exerinity.com" target="_blank">exerinity</a>
                </p>
                {tracks.length > 0 ? (
                  <div className="xe_setup__ready">
                    <strong>{tracks.length.toLocaleString()} tracks have been imported</strong>
                  </div>
                ) : (
                  <div className="xe_setup__ready">
                    <strong>Take a look around</strong>
                    <span>Add a folder from Home or Library whenever you're ready to listen</span>
                  </div>
                )}
              </>
            )}
          </section>

          <footer className="xe_setup__actions">
            {step > 0 && (
              <button type="button" className="xe_btn xe_btn--quiet" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <span />
            {step < STEPS.length - 1 ? (
              <button type="button" className="xe_btn xe_btn--accent" onClick={() => setStep(step + 1)}>
                {step === 0 && folders.length === 0 ? 'Skip for now' : 'Continue'}
              </button>
            ) : (
              <>
                {tracks.length > 0 && (
                  <button
                    type="button"
                    className="xe_btn xe_btn--accent"
                    onClick={() => finish(true)}
                    disabled={remoteLocked}
                  >
                    <PlayIcon size={15} />
                    Start playing
                  </button>
                )}
                <button type="button" className="xe_btn" onClick={() => finish(false)}>
                  Let me in already
                </button>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
