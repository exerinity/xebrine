import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import { fetchLyrics } from '../api/lrclib';
import { parseLyricsFile, toLrc } from '../utils/lyrics';
import { dbDelete, dbGet, dbPut } from '../management/db';
import type { Lyrics, StoredLyrics, TrackMeta } from '../types';
import { LyricsSkeleton } from './skeletons';
import { Spinner } from './spinner';
import { DownloadIcon, SearchIcon, TrashIcon, UploadIcon } from './icons';

type Status = 'idle' | 'waiting' | 'loading' | 'notfound' | 'error' | 'badfile';
const AUTO_SEARCH_DELAY_MS = 2000;

const STATUS_TEXT: Record<Exclude<Status, 'idle'>, string> = {
  waiting: 'Holding off search for a moment...',
  loading: 'Searching LRCLIB...',
  notfound: 'No lyrics found',
  error: 'LRCLIB request failed - are you online?',
  badfile: 'Could not read any lyrics from that file'
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface LyricsPanelProps {
  showToolbar?: boolean;
  variant?: 'page' | 'fullscreen';
}

export function LyricsPanel({ showToolbar = true, variant = 'page' }: LyricsPanelProps) {
  const { current, seek, audioRef } = usePlayer();
  const { settings } = useSettings();
  const track = current?.track ?? null;

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const userScrollUntil = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);

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
        setStatus('error');
      }
    },
    [settings.lrclibMode]
  );

  const search = useCallback(
    async (target: TrackMeta) => {
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      await runSearch(target, controller.signal);
    },
    [runSearch]
  );

  useEffect(() => {
    requestAbortRef.current?.abort();
    setLyrics(null);
    setStatus('idle');
    setActiveIndex(-1);
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
    if (activeIndex < 0 || Date.now() < userScrollUntil.current) return;
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

  const importFile = async (file: File) => {
    if (!track) return;
    const parsed = parseLyricsFile(file.name, await file.text());
    if (!parsed) {
      setStatus('badfile');
      return;
    }
    setLyrics(parsed);
    setStatus('idle');
    await dbPut('lyrics', { trackId: track.id, lyrics: parsed } satisfies StoredLyrics);
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
          <button type="button" className="xe_btn" onClick={() => search(track)} disabled={status === 'loading'}>
            <SearchIcon size={14} />
            Search LRCLIB ({settings.lrclibMode})
          </button>
          <button type="button" className="xe_btn" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon size={14} />
            Import LRC/SRT/VTT
          </button>
          {lyrics && lyrics.synced && (
            <button type="button" className="xe_btn" onClick={exportLrc}>
              <DownloadIcon size={14} />
              Download as LRC
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
        accept=".lrc,.srt,.vtt,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />

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
                tabIndex={clickable ? 0 : -1}
              >
                {line.text || '♪'}
              </button>
            );
          })}
          <div className="xe_lyrics-panel__spacer" />
        </div>
      )}
    </div>
  );
}
