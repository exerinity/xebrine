import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { BackIcon, ChevronRightIcon, LogoIcon, NoteIcon } from '../components/icons';
import { usePageTitle } from '../hooks/page_title';

const HOTKEYS: { chords: string[][]; action: string }[] = [
  { chords: [['Space'], ['K']], action: 'Play / pause' },
  { chords: [['F']], action: 'Toggle the fullscreen player' },
  { chords: [['Ctrl', 'F']], action: 'Focus the search bar' },
  { chords: [['R']], action: 'Restart the current track' },
  { chords: [['T']], action: 'Cycle repeat mode' },
  { chords: [['H']], action: 'Toggle shuffle' },
  { chords: [['Z']], action: 'Previous track' },
  { chords: [['X']], action: 'Next track' },
  { chords: [['Arrow Left'], ['J'], ['A']], action: 'Seek back 10s (Shift 1s / Ctrl 5s / Alt 30s)' },
  { chords: [['Arrow Right'], ['L'], ['D']], action: 'Seek forward 10s (Shift 1s / Ctrl 5s / Alt 30s)' },
  { chords: [['Arrow Up'], ['W']], action: 'Volume up' },
  { chords: [['Arrow Down'], ['S']], action: 'Volume down' },
  { chords: [['0 - 9']], action: 'Jump to 0 - 90% of the track (Shift nudges 5%)' }
];

type SectionId = 'info' | 'stats' | 'acknowledgements' | 'hotkeys';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'info', label: 'About Xebrine' },
  { id: 'stats', label: 'Library stats' },
  { id: 'acknowledgements', label: 'Acknowledgements' },
  { id: 'hotkeys', label: 'Hotkeys' }
];

export function AboutPage() {
  const navigate = useNavigate();
  const { tracks, folders } = useLibrary();
  const { section: sectionParam } = useParams<{ section: string }>();
  const active = (SECTIONS.find((s) => s.id === sectionParam)?.id ?? SECTIONS[0].id) as SectionId;
  const [spinning, setSpinning] = useState(false);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  usePageTitle('About');

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate(-1)}>
          <BackIcon size={16} />
          Back
        </button>
        <h1 className="xe_page__title">About</h1>
        <button type="button" className="xe_btn xe_btn--quiet" onClick={() => navigate('/i/release_notes')}>
          <NoteIcon size={16} />
          Release notes
        </button>
      </div>

      <div className="xe_split">
        <nav className="xe_split__nav" aria-label="About sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`xe_split__item${s.id === active ? ' xe_split__item--active' : ''}`}
              aria-current={s.id === active}
              onClick={() => navigate(`/i/${s.id}`)}
            >
              <span>{s.label}</span>
              <ChevronRightIcon size={16} />
            </button>
          ))}
        </nav>

        <div className="xe_split__detail xe_page__scroll">
          <header className="xe_split__head">
            <h2 className="xe_split__title">{section.label}</h2>
          </header>

          <div className="xe_about">
            {active === 'info' && (
              <>
                <div className="xe_about__hero">
                  <span
                    className={`xe_about__logo${spinning ? ' xe_about__logo--spin' : ''}`}
                    onClick={() => setSpinning(true)}
                    onAnimationEnd={() => setSpinning(false)}
                  >
                    <LogoIcon size={60} />
                  </span>
                  <div>
                    <h2 className="xe_about__name">Xebrine Alpha</h2>
                  </div>
                </div>

                <p className="xe_about__lead">
                  Xebrine <i>(zeh-brine)</i> is the React-made heavy-duty spiritual-successor to the venerable{' '}
                  <a href="https://voxity.dev" target="_blank" rel="noopener noreferrer">
                    Voxity
                  </a>{' '}
                  PWA music player by <a href="https://exerinity.com" target="_blank">exerinity</a>. Xebrine was released exactly 1 year after Voxity was created.
                </p>
                <p className="xe_about__text">
                  It is a clear-cut and modern reimplementation of the same core ideas: fast, bizarre, and very opinionated.
                  Point Xebrine at a folder and it crawls your collection, reads the tags and cover art, and keeps everything
                  organized.
                  <br></br><small>
                    (No - Xebrine is not <i>replacing</i> Voxity nor am I canning it, this is just something more)
                  </small>
                </p>

                <h3 className="xe_about__heading">Stack</h3>
                <p className="xe_about__text">
                  <Link to="/i/acknowledgements">(see all in acknowledgements)</Link>
                </p>
                <ul className="xe_about__list xe_about__packages">
                  <li>
                    <code>react</code>
                    <span>19.0.0</span>
                  </li>
                  <li>
                    <code>react-dom</code>
                    <span>19.0.0</span>
                  </li>
                  <li>
                    <code>react-router-dom</code>
                    <span>7.18.1</span>
                  </li>
                  <li>
                    <code>vite</code>
                    <span>6.3.0</span>
                  </li>
                  <li>
                    <code>@vitejs/plugin-react</code>
                    <span>4.4.0</span>
                  </li>
                  <li>
                    <code>vite-plugin-pwa</code>
                    <span>1.0.0</span>
                  </li>
                  <li>
                    <code>typescript</code>
                    <span>5.8.0</span>
                  </li>
                </ul>

                <h3 className="xe_about__heading">Features</h3>

                <h4 className="xe_about__subheading">Library</h4>
                <ul className="xe_about__list xe_about__list--group">
                  <li>Folder-based library read straight from disk via the File System Access API, organized by artist and album</li>
                  <li>Fully local: tracks, cover art, and lyrics are cached in IndexedDB</li>
                  <li><Link to="/settings/library">Scan filters</Link> to omit tracks missing tags or cover art, or in unwanted formats, with live scan progress and an ETA</li>
                  <li>Search, sorting, and infinite scrolling on the library, artists, and albums pages</li>
                </ul>

                <h4 className="xe_about__subheading">Queue & playback</h4>
                <ul className="xe_about__list xe_about__list--group">
                  <li><Link to="/queue">Queue</Link> with intelligent shuffle (recently-played weighting and artist spreading), repeat modes, drag-to-reorder, play next / add to queue, and clear others</li>
                  <li>Rudimentary beat-matched <Link to="/settings/playback">auto mix</Link>: BPM analysis in a worker, tempo matching, and equal-power crossfades</li>
                  <li>Fullscreen player with lyrics, up next, and a just-played card</li>
                  <li><Link to="/settings/preferences">Configurable player bar fields</Link>: click to copy or to open the artist / album, right-click for the opposite</li>
                </ul>

                <h4 className="xe_about__subheading">Sound</h4>
                <ul className="xe_about__list xe_about__list--group">
                  <li><Link to="/settings/playback">18-band equalizer</Link> with a stack of presets</li>
                  <li>Volume boost to 150%</li>
                  <li>Live spectrum visualizer</li>
                </ul>

                <h4 className="xe_about__subheading">Lyrics</h4>
                <ul className="xe_about__list xe_about__list--group">
                  <li>Synced and interactive (click to jump) lyrics from LRCLIB (<Link to="/settings/preferences">strict or lax matching</Link>)</li>
                  <li><Link to="/lyrics">LRC/SRT/VTT import and LRC export</Link></li>
                  <li>Optional <Link to="/settings/toys">explicit tagging</Link> that scans lyrics for profanity and badges offending tracks</li>
                </ul>

                <h4 className="xe_about__subheading">Interface</h4>
                <ul className="xe_about__list xe_about__list--group">
                  <li>Artwork-derived accent theming that recolors the app for every track</li>
                  <li>Context menus, toasts, scrolling marquee titles, and a resizable collapsing sidebar</li>
                  <li>Keyboard shortcuts for nearly everything (<Link to="/i/hotkeys">see Hotkeys</Link>)</li>
                  <li><Link to="/settings/a11y">Reduced motion</Link> mode</li>
                </ul>

                <h4 className="xe_about__subheading">System</h4>
                <ul className="xe_about__list">
                  <li>Media Session integration: hardware media keys, OS now-playing info, and seeking</li>
                  <li><Link to="/settings/preferences">System notifications</Link> on track change</li>
                  <li><Link to="/settings/a11y">Spoken track announcements</Link> with volume ducking</li>
                  <li>Installable PWA that works offline</li>
                </ul>
              </>
            )}

            {active === 'stats' && (
              <div className="xe_about__stats">
                <div className="xe_about__stat">
                  <strong>{tracks.length}</strong>
                  <span>track{tracks.length === 1 ? '' : 's'}</span>
                </div>
                <div className="xe_about__stat">
                  <strong>{folders.length}</strong>
                  <span>folder{folders.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            )}

            {active === 'acknowledgements' && (
              <>
                <h3 className="xe_about__heading">Dependencies</h3>
                <ul className="xe_about__list">
                  <li>
                    <a href="https://mtg.github.io/essentia.js/" target="_blank" rel="noopener noreferrer">
                      essentia.js
                    </a>
                    : BPM and beat detection for auto mix
                  </li>
                  <li>
                    <a href="https://github.com/borewit/music-metadata" target="_blank" rel="noopener noreferrer">
                      music-metadata
                    </a>
                    : audio tag and artwork parsing
                  </li>
                  <li>
                    <a href="https://github.com/mikolalysenko/mespeak" target="_blank" rel="noopener noreferrer">
                      meSpeak
                    </a>
                    : offline text-to-speech fallback for track announcements
                  </li>
                </ul>

                <h3 className="xe_about__heading">External links</h3>
                <ul className="xe_about__list">
                  <li>
                    <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">
                      LRCLIB
                    </a>
                    : lyrics
                  </li>
                  <li>
                    <a href="https://fonts.google.com/specimen/Google+Sans+Flex" target="_blank" rel="noopener noreferrer">
                      Google
                    </a>
                    : Google Sans Flex font
                  </li>
                  <li>
                    <a href="https://voxity.dev" target="_blank" rel="noopener noreferrer">
                      Voxity
                    </a>
                    : the original
                  </li>
                </ul>
              </>
            )}

            {active === 'hotkeys' && (
              <table className="xe_hotkeys">
                <tbody>
                  {HOTKEYS.map((row) => (
                    <tr key={row.action}>
                      <th scope="row">
                        {row.chords.map((chord, ci) => (
                          <span key={ci} className="xe_hotkeys__chord">
                            {ci > 0 && <span className="xe_hotkeys__sep">or</span>}
                            {chord.map((key, ki) => (
                              <span key={ki} className="xe_hotkeys__key">
                                {ki > 0 && <span className="xe_hotkeys__plus">+</span>}
                                <kbd>{key}</kbd>
                              </span>
                            ))}
                          </span>
                        ))}
                      </th>
                      <td>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
