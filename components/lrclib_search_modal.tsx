import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LrclibError,
  lyricsFromLrclibRecord,
  searchLyricsRecords,
  type LrclibRecord
} from '../api/lrclib';
import type { LyricLine, TrackMeta } from '../types';
import { formatTime } from '../utils/format';
import { FloatingInput } from './floating_input';
import { SearchIcon } from './icons';
import { Modal } from './modal';
import { Spinner } from './spinner';
import { is_online, use_online } from '../hooks/online_status';

interface SearchDraft {
  keyword: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: string;
}

interface LrclibSearchModalProps {
  track: TrackMeta;
  onSelect(record: LrclibRecord): void | Promise<void>;
  onClose(): void;
}

function draftFromTrack(track: TrackMeta): SearchDraft {
  const duration = track.duration >= 1 && track.duration <= 3600 ? String(Math.round(track.duration)) : '';
  return {
    keyword: '',
    trackName: track.title,
    artistName: track.artist,
    albumName: track.album,
    duration
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function parsedDuration(value: string): number | null {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 1 && duration <= 3600 ? duration : null;
}

function targetDuration(draft: SearchDraft, track: TrackMeta): number {
  return parsedDuration(draft.duration) ?? (track.duration > 0 ? track.duration : 0);
}

function durationDelta(record: LrclibRecord, target: number): number {
  if (target <= 0 || record.duration <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(record.duration - target);
}

function formatLineTime(line: LyricLine): string {
  return line.time == null ? '-' : formatTime(line.time);
}

export function LrclibSearchModal({ track, onSelect, onClose }: LrclibSearchModalProps) {
  const online = use_online();
  const [draft, setDraft] = useState<SearchDraft>(() => draftFromTrack(track));
  const [results, setResults] = useState<LrclibRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [omitUnsynced, setOmitUnsynced] = useState(true);
  const [sortClosest, setSortClosest] = useState(true);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const set = (patch: Partial<SearchDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const keywordQuery = draft.keyword.trim();
  const usingKeywords = Boolean(keywordQuery);
  const validation = usingKeywords
    ? null
    : draft.trackName.trim()
      ? null
      : 'Enter keywords, or a title';
  const cooldownSeconds = Math.max(0, Math.ceil((rateLimitUntil - clock) / 1000));
  const sortTarget = targetDuration(draft, track);

  const displayedResults = useMemo(() => {
    const prepared = results
      .filter((record) => !omitUnsynced || Boolean(record.syncedLyrics))
      .map((record) => ({
        record,
        lyrics: lyricsFromLrclibRecord(record),
        delta: durationDelta(record, sortTarget)
      }));
    if (sortClosest) {
      prepared.sort((a, b) => a.delta - b.delta || a.record.id - b.record.id);
    }
    return prepared;
  }, [omitUnsynced, results, sortClosest, sortTarget]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!rateLimitUntil) return;
    const update = () => {
      const now = Date.now();
      setClock(now);
      if (now >= rateLimitUntil) {
        setRateLimitUntil(0);
        setError(null);
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [rateLimitUntil]);

  const close = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    onClose();
  };

  const clearForm = () => {
    setDraft({ keyword: '', trackName: '', artistName: '', albumName: '', duration: '' });
    setResults([]);
    setSearched(false);
    setError(null);
  };

  const useCurrentTrack = () => {
    const current = draftFromTrack(track);
    set({
      trackName: current.trackName,
      artistName: current.artistName,
      albumName: current.albumName,
      duration: current.duration
    });
    setResults([]);
    setSearched(false);
    setError(null);
  };

  const search = async () => {
    if (validation || loading || cooldownSeconds > 0) return;
    if (!is_online()) {
      setError('You are offline. Connect to the internet to search LRCLIB');
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setSearched(false);
    setResults([]);

    try {
      const found = usingKeywords
        ? await searchLyricsRecords({ q: draft.keyword }, controller.signal)
        : await searchLyricsRecords(
            {
              trackName: draft.trackName,
              artistName: draft.artistName,
              albumName: draft.albumName
            },
            controller.signal
          );
      if (controller.signal.aborted || !mountedRef.current) return;
      setResults(found);
      setSearched(true);
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught) || !mountedRef.current) return;
      if (caught instanceof LrclibError) {
        if (caught.status === 429) {
          const retryAfterMs = caught.retryAfterMs ?? 30_000;
          setRateLimitUntil(Date.now() + retryAfterMs);
          setClock(Date.now());
          setError('LRCLIB is rate limiting you - slow down!');
        } else {
          setError(caught.message);
        }
      } else {
        setError(is_online() ? 'Could not reach LRCLIB' : 'You are offline. Connect to the internet to search LRCLIB');
      }
    } finally {
      if (requestRef.current === controller && mountedRef.current) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const apply = async (record: LrclibRecord) => {
    setApplyingId(record.id);
    setError(null);
    try {
      await onSelect(record);
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught.message : 'Could not apply those lyrics');
      setApplyingId(null);
    }
  };

  return (
    <Modal title="Search LRCLIB" wide onClose={close}>
      <div className="xe_lrclib-search">
        <form
          className="xe_lrclib-search__form"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          {!online && (
            <p className="xe_lrclib-search__validation" role="status">
              You are offline. Connect to the internet to search LRCLIB
            </p>
          )}

          <FloatingInput
            containerClassName="xe_lrclib-search__field xe_lrclib-search__field--wide"
            label="Keywords"
            autoFocus
            value={draft.keyword}
            placeholder="avicii wake me up"
            onChange={(event) => set({ keyword: event.target.value })}
          />
          {usingKeywords && (
            <p className="xe_lrclib-search__hint">Search will use keywords and ignore the fields below</p>
          )}

          <div className="xe_lrclib-search__or" role="separator" aria-label="or">
            <span>or</span>
          </div>

          <div className="xe_lrclib-search__fields">
            <FloatingInput
              containerClassName="xe_lrclib-search__field"
              label="Title"
              value={draft.trackName}
              onChange={(event) => set({ trackName: event.target.value })}
              placeholder="wake me up"
            />
            <FloatingInput
              containerClassName="xe_lrclib-search__field"
              label="Artist"
              value={draft.artistName}
              onChange={(event) => set({ artistName: event.target.value })}
              placeholder="avicii"
            />
            <FloatingInput
              containerClassName="xe_lrclib-search__field"
              label="Album"
              value={draft.albumName}
              onChange={(event) => set({ albumName: event.target.value })}
              placeholder="true"
            />
            <FloatingInput
              containerClassName="xe_lrclib-search__field"
              label="Duration (seconds)"
              inputMode="decimal"
              min="1"
              max="3600"
              step="0.1"
              type="number"
              value={draft.duration}
              onChange={(event) => set({ duration: event.target.value })}
              placeholder="249"
            />
          </div>

          {validation && (
            <p className="xe_lrclib-search__validation" role="status">
              {validation}
            </p>
          )}

          <div className="xe_lrclib-search__actions">
            <div className="xe_lrclib-search__actions-start">
              <button type="button" className="xe_btn xe_btn--quiet" onClick={clearForm}>
                Clear
              </button>
              <button type="button" className="xe_btn xe_btn--quiet" onClick={useCurrentTrack}>
                Use current track
              </button>
            </div>
            <button
              type="submit"
              className="xe_btn xe_btn--accent"
              disabled={Boolean(validation) || loading || cooldownSeconds > 0 || !online}
              title={!online ? 'Reconnect to search LRCLIB' : validation ?? undefined}
            >
              {loading ? <Spinner /> : <SearchIcon size={14} />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <section className="xe_lrclib-search__results" aria-busy={loading}>
          <div className="xe_lrclib-search__results-header">
            <div className="xe_lrclib-search__filters">
              <label className="xe_lrclib-search__filter">
                <input
                  type="checkbox"
                  checked={omitUnsynced}
                  onChange={(event) => setOmitUnsynced(event.target.checked)}
                />
                <span>Omit unsynced</span>
              </label>
              <label className="xe_lrclib-search__filter">
                <input
                  type="checkbox"
                  checked={sortClosest}
                  onChange={(event) => setSortClosest(event.target.checked)}
                />
                <span>Sort by closest timing</span>
              </label>
            </div>
            {!loading && results.length > 0 && (
              <strong>
                {displayedResults.length === results.length
                  ? `${results.length} result${results.length === 1 ? '' : 's'}`
                  : `${displayedResults.length} of ${results.length}`}
              </strong>
            )}
          </div>
          {loading && (
            <div className="xe_lrclib-search__status" role="status">
              <Spinner /> Searching LRCLIB...
            </div>
          )}
          {error && (
            <p className="xe_lrclib-search__error" role="alert">
              {cooldownSeconds > 0
                ? `${error} Search again in ${cooldownSeconds} second${cooldownSeconds === 1 ? '' : 's'}.`
                : error}
            </p>
          )}
          {!loading && !error && searched && results.length === 0 && (
            <p className="xe_lrclib-search__empty" role="status">
              No results
            </p>
          )}
          {!loading && !error && searched && results.length > 0 && displayedResults.length === 0 && (
            <p className="xe_lrclib-search__empty" role="status">
              No synced entries in these results
            </p>
          )}
          {!loading && displayedResults.length > 0 && (
            <ul className="xe_lrclib-search__result-list">
              {displayedResults.map(({ record, lyrics, delta }) => {
                const preview = lyrics?.lines.filter((line) => line.text.trim()).slice(0, 6) ?? [];
                const trackName = record.trackName || record.name;
                return (
                  <li key={record.id} className="xe_lrclib-search__result">
                    <div className="xe_lrclib-search__result-main">
                      <div className="xe_lrclib-search__result-heading">
                        <div>
                          <h3>{trackName}</h3>
                          <p>
                            {record.artistName || 'Unknown artist'}
                            {record.albumName ? ` / ${record.albumName}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="xe_btn xe_btn--accent xe_btn--small"
                          disabled={!lyrics || applyingId !== null}
                          title={lyrics ? `Use lyrics for ${trackName}` : 'This entry has no usable lyrics data'}
                          onClick={() => void apply(record)}
                        >
                          {applyingId === record.id ? <Spinner /> : null}
                          {applyingId === record.id ? 'Applying...' : 'Use lyrics'}
                        </button>
                      </div>
                      <div className="xe_lrclib-search__metadata">
                        <span>{formatTime(record.duration)}</span>
                        {record.syncedLyrics ? <span>Synced</span> : record.instrumental ? <span>Instrumental</span> : <span>Unsynced</span>}
                        {Number.isFinite(delta) && delta !== Number.POSITIVE_INFINITY && (
                          <span>
                            {Math.round(delta) === 0 ? 'Matching duration' : `${Math.round(delta)}s off`}
                          </span>
                        )}
                      </div>
                      {preview.length > 0 && (
                        <div className="xe_lrclib-search__preview">
                          {preview.map((line, index) => (
                            <span key={`${line.time ?? 'plain'}-${index}`} className="xe_lrclib-search__preview-line">
                              <span className="xe_lrclib-search__preview-time">{formatLineTime(line)}</span>
                              <span className="xe_lrclib-search__preview-text">{line.text}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
