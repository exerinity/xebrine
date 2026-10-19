import { useNavigate, useParams } from 'react-router-dom';
import { BackIcon, ChevronRightIcon, NoteIcon } from '../components/icons';
import { usePageTitle } from '../hooks/page_title';
import { AboutInfo } from './about/info';
import { AboutStats } from './about/stats';
import { AboutAcknowledgements } from './about/acknowledgements';
import { AboutHotkeys } from './about/hotkeys';
import { AboutDownload } from './about/download';

type SectionId = 'info' | 'stats' | 'acknowledgements' | 'hotkeys' | 'download';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'info', label: 'About Xebrine' },
  { id: 'stats', label: 'Cool stats' },
  { id: 'acknowledgements', label: 'Acknowledgements' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'download', label: 'Downloads' }
];

export function AboutPage() {
  const navigate = useNavigate();
  const { section: section_param } = useParams<{ section: string }>();
  const active = (SECTIONS.find((item) => item.id === section_param)?.id ?? SECTIONS[0].id) as SectionId;
  const section = SECTIONS.find((item) => item.id === active) ?? SECTIONS[0];
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
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`xe_split__item${item.id === active ? ' xe_split__item--active' : ''}`}
              aria-current={item.id === active}
              onClick={() => navigate(`/i/${item.id}`)}
            >
              <span>{item.label}</span>
              <ChevronRightIcon size={16} />
            </button>
          ))}
        </nav>

        <div className="xe_split__detail xe_page__scroll">
          <header className="xe_split__head">
            <h2 className="xe_split__title">{section.label}</h2>
          </header>
          <div className="xe_about">
            {active === 'info' && <AboutInfo />}
            {active === 'stats' && <AboutStats />}
            {active === 'acknowledgements' && <AboutAcknowledgements />}
            {active === 'hotkeys' && <AboutHotkeys />}
            {active === 'download' && <AboutDownload />}
          </div>
        </div>
      </div>
    </div>
  );
}
