import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/icons';
import { usePageTitle } from '../hooks/page_title';

interface Release {
  version: string;
  date: string;
  notes: React.ReactNode[];
}

const RELEASES: Release[] = [
  {
    version: '3a',
    date: '2026-07-12',
    notes: [
      <>Made the <Link to="/settings/library">library settings</Link> look better</>,
      'The artists and albums search bar now has a little magnifying glass like library',
      'Added a search bar to the queue page to filter through enqueued tracks',
      'The context menu actions are now split up into categories: "enqueue track", "copy metadata" and "navigation"'
    ]
  },
  {
    version: '3',
    date: '2026-07-10',
    notes: [
      'Added a visualizer to the now playing bar',
      'Added a new settings category: Accessibility, with reduced motion and announce song changes',
      'The logo in the about page can spin if you click it',
      'Polished the Acknowledgements section in the about page',
      'The about page and settings pages\' sections now update the path (i.e., /settings/playback)',
      'Added a new settings category: Toys',
      'Tags can now have an Explicit tag',
      'Added new animations, most notably to the fullscreen viewer; it slides up and down now',
      'Added a modal component',
      'Adjusted the responsiveness of the app, it should be more mobile-friendly',
      'Added a new setting to change what clicking on the fields in the player bar does: copy or open, and the opposite can be performed by right-clicking',

    ]
  },
  {
    version: '2',
    date: '2026-07-05',
    notes: [
      'Added an Automix feature, an about page, and a settings page',
      'LRCLIB is now configurable to lax or strict querying',
      'Cover art now supplies an ambient and accent color'
    ]
  },
  {
    version: '1',
    date: '2026-07-02',
    notes: [
      'First release',
      'Added a fullscreen viewer, timed lyrics, and the artists / albums pages'
    ]
  },
  {
    version: '0',
    date: '2026-06-03',
    notes: [
      '🐵🔧'
    ]
  }
];

export function ReleaseNotesPage() {
  const navigate = useNavigate();
  usePageTitle('Release notes');

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <button type="button" className="xe_btn xe_btn--quiet xe_btn--back" onClick={() => navigate(-1)}>
          <BackIcon size={16} />
          Back
        </button>
        <h1 className="xe_page__title">Release notes</h1>
      </div>

      <div className="xe_page__scroll xe_about">
        <p>Welcome to the Release notes for Xebrine! Please note, that these are not exhaustive, and only
          covering major/some minor updates. In other words, I may make an update without listing it in this
          document.</p>
        {RELEASES.map((release) => (
          <section key={release.version} className="xe_about__release">
            <h2 className="xe_about__heading">
              Version {release.version} <span className="xe_about__version">{release.date}</span>
            </h2>
            <ul className="xe_about__list">
              {release.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
