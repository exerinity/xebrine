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
    version: '8',
    date: '2026-08-03',
    notes: [
      <>Added <Link to="/i/lastfm">Last.fm scrobbling!!!!!!!!!11111111111</Link> You can connect your account,
      manage how hard it should look for scrobble targets,
      and it even has an offline queue to bulk-scrobble previous offline listens,
      Still a lot to do, but give it a spin!</>,
      'The player bar can now be collapsed with an arrow on the top in the middle',
      'Made the fullscreen player more beautiful; especially in tandem with folding the player bar away',
      <>Added a <Link to="/settings">"Prevent exit"</Link> toggle</>,
      <><Link to="/settings/playback">The equalizer</Link> now has an intensity and preamp slider so it should now be listenable</>,
      <>Added a new <Link to="/search">Search</Link> page which, instead of a simple keyword filter,
      has a user-friendly advanced algorithmical to feel almost as natural as Spotify
      search (no idea how they do searching). No - it is not replacing every search bar; on the other pages, it is still a simple filter search, and it will remain that way.</>
    ]
  },
  {
    version: '7',
    date: '2026-07-30',
    notes: [
      'Added a Deep search to the library page, to search for songs based on one or more metadata objects',
      'Almost every page has a context menu now',
      'You can now use context menus in the one right-click drag, releasing on your target performs it'
    ]
  },
  {
    version: '6',
    date: '2026-07-22',
    notes: [
      <>Added <Link to="/home">home page</Link> and a sleep timer</>
    ]
  },
  {
    version: '5',
    date: '2026-07-16',
    notes: [
      'The BPM analysis engine has been completely reworked with a bespoke engine and the auto mix should feel (or sound) better',
      'Scanning folders is now done through a worker pool sized to CPU core count, so scanning speed should be tenfold',
      'When scanning, a small card now grows out of the player bar with progress',
      'Ported (most) themes from Voxity',
      'Fullscreen player overhauled to look less awkward'
    ]
  },
  {
    version: '4',
    date: '2026-07-14',
    notes: [
      <><Link to="/settings/a11y">The TTS engine can now be instructed how to pronounce artists</Link></>,
      <><Link to="/settings/share">Settings can be exported and imported and shared</Link></>,
      <><Link to="/lyrics/share">Added a lyrics sharer</Link>, which is a Spotify-inspired lyrics screenshotter</>,
      'Added a welcome modal'
    ]
  },
  {
    version: '3a',
    date: '2026-07-12',
    notes: [
      <>Made the <Link to="/settings/library">library settings</Link> look better</>,
      'The artists and albums search bar now has a little magnifying glass like library',
      'Added a search bar to the queue page to filter through enqueued tracks',
      'The context menu actions are now split up into categories: "enqueue track", "copy metadata" and "navigation"',
      'You can now right-click the scrubber to open a precise input modal'
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
