import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRightIcon } from '../components/icons';
import { usePageTitle } from '../hooks/page_title';
import { PreferencesSettings } from './settings/preferences';
import { HomeSettings } from './settings/home';
import { AppearanceSettings } from './settings/appearance';
import { LibrarySettings } from './settings/library';
import { PlaybackSettings } from './settings/playback';
import { AccessibilitySettings } from './settings/accessibility';
import { ToysSettings } from './settings/toys';
import { ShareSettings } from './settings/share';

type SectionId = 'all' | 'preferences' | 'appearance' | 'home' | 'library' | 'playback' | 'a11y' | 'toys' | 'share';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'preferences', label: 'Main preferences' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'home', label: 'Home layout' },
  { id: 'library', label: 'Library settings' },
  { id: 'playback', label: 'Playback settings' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'toys', label: 'Toys' },
  { id: 'share', label: 'Share settings' },
  { id: 'all', label: 'All settings' },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section: string }>();
  const active =
    sectionParam === 'settings'
      ? 'all'
      : ((SECTIONS.find((s) => s.id === sectionParam)?.id ?? SECTIONS[1].id) as SectionId);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  usePageTitle('Settings');

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
              onClick={() => navigate(s.id === 'all' ? '/settings/settings' : `/settings/${s.id}`)}
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

          {(active === 'all' || active === 'preferences') && <PreferencesSettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'home') && <HomeSettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'appearance') && <AppearanceSettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'library') && <LibrarySettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'playback') && <PlaybackSettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'a11y') && <AccessibilitySettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'toys') && <ToysSettings show_heading={active === 'all'} />}
          {(active === 'all' || active === 'share') && <ShareSettings show_heading={active === 'all'} />}
        </div>
      </div>
    </div>
  );
}
