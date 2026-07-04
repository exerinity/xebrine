import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { BackIcon, LogoIcon } from '../components/icons';

export function AboutPage() {
  const navigate = useNavigate();
  const { tracks, folders } = useLibrary();

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate(-1)}>
          <BackIcon size={16} />
          Back
        </button>
        <h1 className="xe_page__title">About Xebrine</h1>
      </div>
      <div className="xe_page__scroll">
        <div className="xe_about">
          <div className="xe_about__hero">
            <span className="xe_about__logo">
              <LogoIcon size={60} />
            </span>
            <div>
              <h2 className="xe_about__name">Xebrine Alpha</h2>
            </div>
          </div>

          <p className="xe_about__lead">
            Xebrine is the spiritual successor to the venerable <a href="https://voxity.dev" target="_blank" rel="noopener noreferrer">Voxity</a> PWA music player.
          </p>
          <p className="xe_about__text">
            It is a
            clear-cut and modern reimplementation of the same core ideas: fast, bizarre, and very opinionated. Point Xebrine at a folder and it crawls your collection, reads the tags and cover art, and
            keeps everything organized.
          </p>

          <h3 className="xe_about__heading">Current stats</h3>
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

          <h3 className="xe_about__heading">Stack</h3>
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
              <code>essentia.js</code>
              <span>0.1.3</span>
            </li>
            <li>
              <code>music-metadata</code>
              <span>11.0.0</span>
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
          <ul className="xe_about__list">
            <li>Folder-based library, organized by artist and album</li>
            <li>Queue with intelligent shuffle and repeat modes</li>
            <li>Volume boost to 150%</li>
            <li>Live spectrum visualizer</li>
            <li>18-band equalizer with a stack of presets</li>
            <li>Beat-matched auto mix</li>
            <li>Synced and interactive (click to jump) lyrics</li>
            <li>System notifications</li>
            <li>Artwork-driven accent theming that recolors the app for every track</li>
          </ul>

          <h3 className="xe_about__heading">Acknowledgements</h3>
          <ul className="xe_about__list">
            <li>
              <a href="https://mtg.github.io/essentia.js/" target="_blank" rel="noopener noreferrer">
                essentia.js
              </a>: BPM and beat detection for auto mix
            </li>
            <li>
              <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">
                LRCLIB
              </a>: lyrics
            </li>
            <li>
              <a
                href="https://github.com/borewit/music-metadata"
                target="_blank"
                rel="noopener noreferrer"
              >
                music-metadata
              </a>: audio tag and artwork parsing
            </li>
            <li>
              Twitter: Chirp font
            </li>
            <li>
              <a href="https://voxity.dev" target="_blank" rel="noopener noreferrer">
                Voxity
              </a>: the original
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
