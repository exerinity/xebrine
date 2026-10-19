import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Acknowledgement {
  name: string;
  url: string;
  role: ReactNode;
}

const DEPENDENCY_ACKNOWLEDGEMENTS: { heading: string; items: Acknowledgement[] }[] = [
  {
    heading: 'Application',
    items: [
      { name: 'React', url: 'https://react.dev', role: 'React React React' },
      { name: 'react-dom', url: 'https://react.dev', role: 'rendering' },
      { name: 'react-router-dom', url: 'https://reactrouter.com', role: 'routing, navigation' },
      {
        name: 'music-metadata',
        url: 'https://github.com/borewit/music-metadata',
        role: 'embedded artwork extraction'
      },
      { name: 'mediainfo.js', url: 'https://mediainfo.js.org', role: 'fast audio metadata scanning' },
      {
        name: 'meSpeak',
        url: 'https://github.com/mikolalysenko/mespeak',
        role: 'the library used for the TTS announcer because the speech synthesis API is very inconsistent across devices'
      }
    ]
  },
  {
    heading: 'Compilation',
    items: [
      { name: 'Vite', url: 'https://vite.dev', role: 'bundler' },
      {
        name: '@vitejs/plugin-react',
        url: 'https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react',
        role: 'React JSX transformation and Fast Refresh'
      },
      {
        name: 'vite-plugin-pwa',
        url: 'https://vite-pwa-org.netlify.app',
        role: 'the thing that makes the pwa a pwa'
      },
      { name: 'Workbox', url: 'https://developer.chrome.com/docs/workbox', role: 'precaching' },
      { name: 'TypeScript', url: 'https://www.typescriptlang.org', role: '75% of the codebase' }
    ]
  },
  {
    heading: 'Types',
    items: [
      {
        name: '@types/react',
        url: 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react',
        role: 'React definitions'
      },
      {
        name: '@types/react-dom',
        url: 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom',
        role: 'React DOM definitions'
      },
      {
        name: '@types/wicg-file-system-access',
        url: 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/wicg-file-system-access',
        role: 'File System Access API definitions'
      }
    ]
  },
  {
    heading: 'Icon generation',
    items: [
      { name: 'ab_glyph', url: 'https://crates.io/crates/ab_glyph', role: 'font glyph loading / rendering' },
      { name: 'image', url: 'https://crates.io/crates/image', role: 'PNG composition' },
      {
        name: 'yeslogic-fontconfig-sys',
        url: 'https://crates.io/crates/yeslogic-fontconfig-sys',
        role: 'system font discovery'
      }
    ]
  }
];

const EXTERNAL_ACKNOWLEDGEMENTS: Acknowledgement[] = [
  { name: 'LRCLIB', url: 'https://lrclib.net', role: 'lyrics' },
  { name: 'Last.fm', url: 'https://www.last.fm', role: <Link to="/lastfm">scrobbling</Link> },
  { name: 'Cloudflare Workers', url: 'https://workers.dev', role: 'basically where this thing lives' },
  { name: 'Inter', url: 'https://rsms.me/inter/', role: 'font' },
  { name: 'Voxity', url: 'https://voxity.dev', role: 'THE KING' }
];

export function AboutAcknowledgements() {
  return (
    <>
      <p className="xe_about__text">
        This is a list of what Xebrine was built with and what it uses. You can view the source
        here: <a href="https://github.com/xebrine/xebrine" target="_blank">github.com/xebrine/xebrine</a>
      </p>
      {DEPENDENCY_ACKNOWLEDGEMENTS.map((group) => (
        <section key={group.heading}>
          <h3 className="xe_about__heading">{group.heading}</h3>
          <ul className="xe_about__list">
            {group.items.map((item) => (
              <li key={item.name}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a>: {item.role}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h3 className="xe_about__heading">Miscellaneous</h3>
      <ul className="xe_about__list">
        {EXTERNAL_ACKNOWLEDGEMENTS.map((item) => (
          <li key={item.name}>
            <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a>: {item.role}
          </li>
        ))}
      </ul>
    </>
  );
}
