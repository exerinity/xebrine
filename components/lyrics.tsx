import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import {
  fetchLyrics,
  LrclibError,
  lyricsFromLrclibRecord,
  type LrclibRecord
} from '../api/lrclib';
import { parseLyricsFile, toLrc } from '../utils/lyrics';
import { dbDelete, dbGet, dbPut } from '../management/db';
import { containsProfanity } from '../utils/profanity';
import { isExplicitId, markExplicit } from '../utils/explicit_tracks';
import { openSearch, searchLabel } from '../utils/search_engine';
import { toast } from '../utils/toast';
import type { Lyrics, StoredLyrics, TrackMeta } from '../types';
import { LyricsSkeleton } from './skeletons';
import { Spinner } from './spinner';
import { Modal } from './modal';
import { LrclibSearchModal } from './lrclib_search_modal';
import { ContextMenu, type ContextMenuItem } from './context_menu';
import { DownloadIcon, NoteIcon, SearchIcon, ShareIcon, TrashIcon, UploadIcon } from './icons';

type Status = 'idle' | 'waiting' | 'loading' | 'notfound' | 'error' | 'ratelimited' | 'badfile';
const AUTO_SEARCH_DELAY_MS = 2000;
const NUDGE_SECONDS = 5;
const HEADING_MAX = 25;
const ACCEPTED_LYRICS_FILE = /\.(lrc|srt|vtt)$/i;

const STATUS_TEXT: Record<Exclude<Status, 'idle'>, string> = {
  waiting: 'Holding off search for a moment...',
  loading: 'Searching LRCLIB...',
  notfound: 'No lyrics found',
  error: 'LRCLIB request failed - are you online?',
  ratelimited: 'LRCLIB is rate limiting you - slow down!',
  badfile: 'Could not read any lyrics from that file'
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function lineHeading(text: string): string {
  const trimmed = text.trim() || '♪';
  return trimmed.length > HEADING_MAX ? `${trimmed.slice(0, HEADING_MAX)}...` : trimmed;
}

interface LyricsPanelProps {
  showToolbar?: boolean;
  variant?: 'page' | 'fullscreen';
  droppedFile?: File | null;
  onDroppedFileHandled?(): void;
}

export function LyricsPanel({
  showToolbar = true,
  variant = 'page',
  droppedFile = null,
  onDroppedFileHandled
}: LyricsPanelProps) {
  const { current, seek, audioRef } = usePlayer();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const track = current?.track ?? null;

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lrclibSearchOpen, setLrclibSearchOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const userScrollUntil = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const menuOpenRef = useRef(false);
  const trackIdRef = useRef(track?.id);

  menuOpenRef.current = menu !== null;
  trackIdRef.current = track?.id;

  const runSearch = useCallback(
    async (target: TrackMeta, signal: AbortSignal) => {
      setStatus('loading');
      try {
        const found = await fetchLyrics(target, settings.lrclibMode, signal);
        if (signal.aborted) return;
        if (found) {
          setLyrics(found);
          setStatus('idle');
          await dbPut('lyrics', { trackId: target.id, lyrics: found } satisfies StoredLyrics);
        } else {
          setLyrics(null);
          setStatus('notfound');
        }
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        setLyrics(null);
        setStatus(error instanceof LrclibError && error.status === 429 ? 'ratelimited' : 'error');
      }
    },
    [settings.lrclibMode]
  );

  useEffect(() => {
    requestAbortRef.current?.abort();
    setLyrics(null);
    setStatus('idle');
    setActiveIndex(-1);
    setLrclibSearchOpen(false);
    setMenu(null);
    if (!track) return;
    let cancelled = false;
    let timer = 0;
    const controller = new AbortController();
    requestAbortRef.current = controller;

    (async () => {
      const stored = await dbGet<StoredLyrics>('lyrics', track.id);
      if (cancelled || controller.signal.aborted) return;
      if (stored) {
        setLyrics(stored.lyrics);
      } else {
        setStatus('waiting');
        timer = window.setTimeout(() => {
          if (!cancelled && !controller.signal.aborted) void runSearch(track, controller.signal);
        }, AUTO_SEARCH_DELAY_MS);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [track?.id, runSearch]);

  useEffect(() => {
    if (!track || !lyrics || !settings.tagExplicitSongs || isExplicitId(track.id)) return;
    const text = lyrics.lines.map((line) => line.text).join(' ');
    if (containsProfanity(text)) markExplicit(track.id);
  }, [track, lyrics, settings.tagExplicitSongs]);

  useEffect(() => {
    if (!lyrics?.synced) {
      setActiveIndex(-1);
      return;
    }
    const lines = lyrics.lines;
    let raf = 0;
    const tick = () => {
      const t = (audioRef.current?.currentTime ?? 0) + 0.05;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if ((lines[i].time as number) <= t) idx = i;
        else break;
      }
      setActiveIndex((prev) => (prev === idx ? prev : idx));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics, audioRef]);

  useEffect(() => {
    if (activeIndex < 0 || menuOpenRef.current || Date.now() < userScrollUntil.current) return;
    const container = containerRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;
    container.scrollTo({
      top: line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2,
      behavior: 'smooth'
    });
  }, [activeIndex]);

  const markUserScroll = () => {
    userScrollUntil.current = Date.now() + 4000;
  };

  const preferUserLyrics = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setStatus('idle');
  }, []);

  const applyLrclibRecord = async (record: LrclibRecord) => {
    if (!track) return;
    const targetId = track.id;
    const found = lyricsFromLrclibRecord(record);
    if (!found) throw new Error('That LRCLIB entry has no usable synced or plain lyrics');
    preferUserLyrics();
    await dbPut('lyrics', { trackId: targetId, lyrics: found } satisfies StoredLyrics);
    if (trackIdRef.current !== targetId) return;
    setLyrics(found);
    setStatus('idle');
    setLrclibSearchOpen(false);
  };

  const importFile = useCallback(async (file: File) => {
    if (!ACCEPTED_LYRICS_FILE.test(file.name)) {
      toast.error("That's not an accepted lyrics file type");
      return;
    }
    if (!track) return;
    preferUserLyrics();
    const parsed = parseLyricsFile(file.name, await file.text());
    if (!parsed) {
      setStatus('badfile');
      return;
    }
    setLyrics(parsed);
    setStatus('idle');
    await dbPut('lyrics', { trackId: track.id, lyrics: parsed } satisfies StoredLyrics);
  }, [track, preferUserLyrics]);

  useEffect(() => {
    if (!droppedFile) return;
    void importFile(droppedFile).finally(onDroppedFileHandled);
  }, [droppedFile, importFile, onDroppedFileHandled]);

  const applyPaste = async () => {
    if (!track) return;
    preferUserLyrics();
    const parsed = parseLyricsFile('', pasteText);
    if (!parsed) {
      setStatus('badfile');
      return;
    }
    setLyrics(parsed);
    setStatus('idle');
    await dbPut('lyrics', { trackId: track.id, lyrics: parsed } satisfies StoredLyrics);
    setPasteOpen(false);
    setPasteText('');
  };

  const exportLrc = () => {
    if (!lyrics || !track) return;
    const blob = new Blob([toLrc(lyrics.lines)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.artist} - ${track.title}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItems = (index: number): ContextMenuItem[] => {
    const line = lyrics?.lines[index];
    if (!line) return [];
    const items: ContextMenuItem[] = [];
    if (line.time !== null) {
      const time = line.time;
      items.push(
        { label: 'Jump to this line', onSelect: () => seek(time) },
        {
          label: `Jump to ${NUDGE_SECONDS} seconds before this line`,
          onSelect: () => seek(time - NUDGE_SECONDS)
        },
        {
          label: `Jump to ${NUDGE_SECONDS} seconds after this line`,
          onSelect: () => seek(time + NUDGE_SECONDS)
        }
      );
    }
    if (line.text.trim()) {
      items.push(
        {
          label: 'Copy this line',
          separatorBefore: items.length > 0,
          onSelect: () =>
            navigator.clipboard
              .writeText(line.text)
              .then(() => toast.success('Copied the line'))
              .catch(() => toast.error("Couldn't copy the line"))
        },
        {
          label: searchLabel(settings.searchEngine, settings.customSearchUrl),
          onSelect: () => openSearch(line.text, settings.searchEngine, settings.customSearchUrl)
        }
      );
    }
    if (items[0]) items[0].heading = '"' + lineHeading(line.text) + '"';
    return items;
  };

  const removeLyrics = async () => {
    if (!track) return;
    await dbDelete('lyrics', track.id);
    setLyrics(null);
    setStatus('idle');
  };

  if (!track) {
    return <p className="xe_empty-note">When a song begins playing, the lyrics will be queried - and shown, if any - here.</p>;
  }

  return (
    <div className={`xe_lyrics-panel xe_lyrics-panel--${variant}`}>
      {showToolbar && (
        <div className="xe_lyrics-panel__toolbar">
          <button
            type="button"
            className="xe_btn"
            onClick={() => {
              preferUserLyrics();
              setLrclibSearchOpen(true);
            }}
          >
            <SearchIcon size={14} />
            Search LRCLIB
          </button>
          <button type="button" className="xe_btn" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon size={14} />
            Import LRC/SRT/VTT
          </button>
          <button type="button" className="xe_btn" onClick={() => setPasteOpen(true)}>
            <NoteIcon size={14} />
            Paste LRC/SRT/VTT
          </button>
          {lyrics && lyrics.synced && (
            <button type="button" className="xe_btn" onClick={exportLrc}>
              <DownloadIcon size={14} />
              Download as LRC
            </button>
          )}
          {lyrics && (
            <button type="button" className="xe_btn" onClick={() => navigate('/lyrics/share')}>
              <ShareIcon size={14} />
              Share as image
            </button>
          )}
          {lyrics && (
            <button type="button" className="xe_btn xe_btn--quiet" onClick={removeLyrics}>
              <TrashIcon size={14} />
              Remove
            </button>
          )}
          {lyrics && (
            <span className="xe_lyrics-panel__badge">
              {lyrics.source === 'lrclib' ? 'LRCLIB' : 'Imported'} / {lyrics.synced ? 'synced' : 'unsynced'}
            </span>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc,.srt,.vtt"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />

      {lrclibSearchOpen && (
        <LrclibSearchModal
          track={track}
          onSelect={applyLrclibRecord}
          onClose={() => setLrclibSearchOpen(false)}
        />
      )}

      {pasteOpen && (
        <Modal
          title="Paste lyrics"
          onClose={() => {
            setPasteOpen(false);
            setPasteText('');
          }}
        >
          <div className="xe_paste-form">
            <textarea
              className="xe_paste-form__input"
              autoFocus
              placeholder="Paste LRC, SRT, or VTT lyrics here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="xe_paste-form__actions">
              <button
                type="button"
                className="xe_btn xe_btn--quiet"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="xe_btn xe_btn--accent"
                onClick={applyPaste}
                disabled={pasteText.trim() === ''}
              >
                Apply
              </button>
            </div>
          </div>
        </Modal>
      )}

      {status === 'waiting' || status === 'loading' ? (
        <>
          <p className="xe_lyrics-panel__status">
            <Spinner />
            {STATUS_TEXT[status]}
          </p>
          {status === 'loading' && <LyricsSkeleton />}
        </>
      ) : (
        status !== 'idle' && <p className="xe_lyrics-panel__status">{STATUS_TEXT[status]}</p>
      )}

      {lyrics && (
        <div
          className="xe_lyrics-panel__lines"
          ref={containerRef}
          onWheel={markUserScroll}
          onTouchMove={markUserScroll}
        >
          {lyrics.lines.map((line, i) => {
            const clickable = line.time !== null;
            return (
              <button
                key={i}
                type="button"
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className={`xe_lyrics-line${i === activeIndex ? ' xe_lyrics-line--active' : ''}${
                  clickable ? '' : ' xe_lyrics-line--static'
                }`}
                onClick={clickable ? () => seek(line.time as number) : undefined}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!clickable && !line.text.trim()) return;
                  markUserScroll();
                  setMenu({ x: e.clientX, y: e.clientY, index: i });
                }}
                tabIndex={clickable ? 0 : -1}
              >
                {line.text || '♪'}
              </button>
            );
          })}
          <div className="xe_lyrics-panel__spacer" />
          {menu && (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              items={menuItems(menu.index)}
              onClose={() => setMenu(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
