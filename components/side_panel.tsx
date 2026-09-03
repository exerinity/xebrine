import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent
} from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { LyricsPanel } from './lyrics';
import { QueueList } from './queue_list';
import { ScrollingText } from './scrolling_text';
import {
  CloseIcon,
  ExternalLinkIcon,
  LogoIcon,
  LyricsIcon,
  QueueIcon,
  SearchIcon
} from './icons';

export type SidePanelView = 'queue' | 'lyrics';

const WIDTH_KEY = 'xebrine.sidePanelWidth';
const MIN_WIDTH = 300;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 370;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function loadWidth(): number {
  const saved = localStorage.getItem(WIDTH_KEY);
  const width = saved ? Number.parseFloat(saved) : Number.NaN;
  return Number.isFinite(width) ? clampWidth(width) : DEFAULT_WIDTH;
}

interface SidePanelProps {
  open: boolean;
  view: SidePanelView;
  onViewChange(view: SidePanelView): void;
  onClose(): void;
}

export function SidePanel({ open, view, onViewChange, onClose }: SidePanelProps) {
  const navigate = useNavigate();
  const { queue, current, artworkUrl } = usePlayer();
  const [query, setQuery] = useState('');
  const [panelWidth, setPanelWidth] = useState(loadWidth);
  const [resizing, setResizing] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const track = current?.track ?? null;
  const totalSeconds = queue.reduce((sum, item) => sum + item.track.duration, 0);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  const openFullPage = () => {
    onClose();
    navigate(`/${view}`);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!open || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = clampWidth(startWidth - (moveEvent.clientX - startX));
      panelWidthRef.current = nextWidth;
      setPanelWidth(nextWidth);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizing(false);
      try {
        localStorage.setItem(WIDTH_KEY, String(panelWidthRef.current));
      } catch {
        null;
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const resetWidth = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    panelWidthRef.current = DEFAULT_WIDTH;
    setPanelWidth(DEFAULT_WIDTH);
    try {
      localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
    } catch {
      null;
    }
  };

  return (
    <aside
      className={`xe_side-panel${open ? ' xe_side-panel--open' : ''}${
        resizing ? ' xe_side-panel--resizing' : ''
      }`}
      style={{ '--side-panel-width': `${panelWidth}px` } as CSSProperties}
      aria-label="Queue and lyrics side panel"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="xe_side-panel__inner">
        {open && (
          <div
            className="xe_side-panel__resize"
            onPointerDown={startResize}
            onContextMenu={resetWidth}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize side panel"
            title="Drag to resize, right-click to reset"
          />
        )}
        <header className="xe_side-panel__header">
          <div className="xe_side-panel__selector" role="tablist" aria-label="Side panel view">
            <button
              type="button"
              id="xe-side-panel-queue-tab"
              className={`xe_side-panel__tab${view === 'queue' ? ' xe_side-panel__tab--active' : ''}`}
              role="tab"
              aria-selected={view === 'queue'}
              aria-controls="xe-side-panel-content"
              tabIndex={open ? 0 : -1}
              onClick={() => onViewChange('queue')}
            >
              <QueueIcon size={16} />
              Queue
              {queue.length > 0 && <span className="xe_side-panel__count">{queue.length}</span>}
            </button>
            <button
              type="button"
              id="xe-side-panel-lyrics-tab"
              className={`xe_side-panel__tab${view === 'lyrics' ? ' xe_side-panel__tab--active' : ''}`}
              role="tab"
              aria-selected={view === 'lyrics'}
              aria-controls="xe-side-panel-content"
              tabIndex={open ? 0 : -1}
              onClick={() => onViewChange('lyrics')}
            >
              <LyricsIcon size={16} />
              Lyrics
            </button>
          </div>
          <button
            type="button"
            className="xe_mini-btn"
            onClick={openFullPage}
            title={`Open the full ${view} page`}
            aria-label={`Open the full ${view} page`}
            tabIndex={open ? 0 : -1}
          >
            <ExternalLinkIcon size={15} />
          </button>
          <button
            type="button"
            className="xe_mini-btn"
            onClick={onClose}
            title="Close side panel"
            aria-label="Close side panel"
            tabIndex={open ? 0 : -1}
          >
            <CloseIcon size={15} />
          </button>
        </header>

        <div
          id="xe-side-panel-content"
          className="xe_side-panel__content"
          role="tabpanel"
          aria-labelledby={`xe-side-panel-${view}-tab`}
        >
          {view === 'queue' ? (
            <div className="xe_side-panel__queue">
              <div className="xe_side-panel__queue-head">
                <div className="xe_side-panel__meta">
                  {queue.length} track{queue.length === 1 ? '' : 's'} / {formatTime(totalSeconds)}
                </div>
                <label className="xe_search-field xe_side-panel__search">
                  <SearchIcon size={14} />
                  <input
                    className="xe_search-input"
                    type="search"
                    placeholder="Search queue..."
                    value={query}
                    tabIndex={open ? 0 : -1}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <div className="xe_side-panel__scroll">
                <QueueList query={query} variant="panel" />
              </div>
            </div>
          ) : (
            <div className="xe_side-panel__lyrics">
              {track && (
                <div className="xe_side-panel__now-playing">
                  <div className="xe_side-panel__art">
                    {artworkUrl ? <img src={artworkUrl} alt="" /> : <LogoIcon size={24} />}
                  </div>
                  <div className="xe_side-panel__titles">
                    <ScrollingText text={track.title} className="xe_side-panel__title" />
                    <ScrollingText text={track.artist} className="xe_side-panel__artist" />
                  </div>
                </div>
              )}
              <LyricsPanel showToolbar={false} variant="sidebar" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
