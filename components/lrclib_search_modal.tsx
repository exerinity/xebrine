import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  getLyricsById,
  getLyricsBySignature,
  LrclibError,
  lyricsFromLrclibRecord,
  searchLyricsRecords,
  type LrclibRecord
} from '../api/lrclib';
import type { TrackMeta } from '../types';
import { formatTime } from '../utils/format';
import { FloatingInput } from './floating_input';
import { SearchIcon } from './icons';
import { Modal } from './modal';
import { Spinner } from './spinner';

type SearchMode = 'keyword' | 'fields' | 'signature' | 'id';

interface SearchDraft {
  keyword: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: string;
  id: string;
}

interface LrclibSearchModalProps {
  track: TrackMeta;
  onSelect(record: LrclibRecord): void | Promise<void>;
  onClose(): void;
}

const MODES: { id: SearchMode; label: string; hint: string }[] = [
  {
    id: 'keyword',
    label: 'Keywords',
    hint: 'General search'
  },
  {
    id: 'fields',
    label: 'Fields',
    hint: 'Track title with optional artist and album filters'
  },
  {
    id: 'signature',
    label: 'Signature',
    hint: 'Best (or even exact) match using title, artist, album, and duration'
  },
  {
    id: 'id',
    label: 'LRCLIB ID',
    hint: 'Absolute LRCLIB ID'
  }
];

function draftFromTrack(track: TrackMeta): SearchDraft {
  const duration = track.duration >= 1 && track.duration <= 3600 ? String(Math.round(track.duration)) : '';
  return {
    keyword: '',
    trackName: track.title,
    artistName: track.artist,
    albumName: track.album,
    duration,
    id: ''
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function validationMessage(mode: SearchMode, draft: SearchDraft): string | null {
  if (mode === 'keyword') return draft.keyword.trim() ? null : 'Enter one or more keywords';
  if (mode === 'fields') return draft.trackName.trim() ? null : 'Track title is required';
  if (mode === 'signature') {
    if (!draft.trackName.trim()) return 'Track title is required';
    if (!draft.artistName.trim()) return 'Artist is required';
    if (draft.duration.trim()) {
      const duration = Number(draft.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > 3600) {
        return 'Duration must be between 1 and 3600 seconds';
      }
    }
    return null;
  }
  const id = Number(draft.id);
  return /^\d+$/.test(draft.id.trim()) && Number.isSafeInteger(id) && id > 0
    ? null
    : 'Enter a positive LRCLIB ID.';
}

function recordKind(record: LrclibRecord): string {
  if (record.instrumental) return 'Instrumental';
  if (record.syncedLyrics) return 'Synced';
  if (record.plainLyrics) return 'Unsynced';
  return 'LRC only';
}

export function LrclibSearchModal({ track, onSelect, onClose }: LrclibSearchModalProps) {
  const modeName = useId();
  const [mode, setMode] = useState<SearchMode>('fields');
  const [draft, setDraft] = useState<SearchDraft>(() => draftFromTrack(track));
  const [results, setResults] = useState<LrclibRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const set = (patch: Partial<SearchDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const validation = validationMessage(mode, draft);
  const cooldownSeconds = Math.max(0, Math.ceil((rateLimitUntil - clock) / 1000));
  const currentMode = MODES.find((item) => item.id === mode) ?? MODES[0];
  const displayedResults = useMemo(
    () => results.map((record) => ({ record, lyrics: lyricsFromLrclibRecord(record) })),
    [results]
  );

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

  const changeMode = (next: SearchMode) => {
    setMode(next);
    setResults([]);
    setSearched(false);
    if (cooldownSeconds === 0) setError(null);
  };

  const clearCurrentMode = () => {
    if (mode === 'keyword') set({ keyword: '' });
    else if (mode === 'id') set({ id: '' });
    else set({ trackName: '', artistName: '', albumName: '', duration: '' });
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
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setSearched(false);
    setResults([]);

    try {
      let found: LrclibRecord[];
      if (mode === 'keyword') {
        found = await searchLyricsRecords({ q: draft.keyword }, controller.signal);
      } else if (mode === 'fields') {
        found = await searchLyricsRecords(
          {
            trackName: draft.trackName,
            artistName: draft.artistName,
            albumName: draft.albumName
          },
          controller.signal
        );
      } else if (mode === 'signature') {
        const record = await getLyricsBySignature(
          {
            trackName: draft.trackName,
            artistName: draft.artistName,
            albumName: draft.albumName,
            duration: draft.duration.trim() ? Number(draft.duration) : undefined
          },
          controller.signal
        );
        found = record ? [record] : [];
      } else {
        const record = await getLyricsById(Number(draft.id), controller.signal);
        found = record ? [record] : [];
      }
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
        setError('Could not reach LRCLIB');
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
          <fieldset
            className="xe_lrclib-search__mode-fieldset"
            disabled={loading || cooldownSeconds > 0}
          >
            <legend className="xe_lrclib-search__legend">Method</legend>
            <div className="xe_lrclib-search__modes">
              {MODES.map((item) => (
                <label key={item.id} className="xe_lrclib-search__mode">
                  <input
                    type="radio"
                    name={modeName}
                    value={item.id}
                    checked={mode === item.id}
                    onChange={() => changeMode(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="xe_lrclib-search__hint">{currentMode.hint}</p>

          <div className="xe_lrclib-search__fields">
            {mode === 'keyword' && (
              <FloatingInput
                containerClassName="xe_lrclib-search__field xe_lrclib-search__field--wide"
                label="Query"
                autoFocus
                value={draft.keyword}
                placeholder="avicii wake me up"
                onChange={(event) => set({ keyword: event.target.value })}
              />
            )}

            {(mode === 'fields' || mode === 'signature') && (
              <>
                <FloatingInput
                  containerClassName="xe_lrclib-search__field"
                  label="Title"
                  autoFocus
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
                {mode === 'signature' && (
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
                )}
              </>
            )}

            {mode === 'id' && (
              <FloatingInput
                containerClassName="xe_lrclib-search__field xe_lrclib-search__field--wide"
                label="Entry ID"
                autoFocus
                inputMode="numeric"
                value={draft.id}
                placeholder="22317263"
                onChange={(event) => set({ id: event.target.value })}
              />
            )}
          </div>

          {validation && (
            <p className="xe_lrclib-search__validation" role="status">
              {validation}
            </p>
          )}

          <div className="xe_lrclib-search__actions">
            <div className="xe_lrclib-search__actions-start">
              <button type="button" className="xe_btn xe_btn--quiet" onClick={clearCurrentMode}>
                Clear
              </button>
              {(mode === 'fields' || mode === 'signature') && (
                <button type="button" className="xe_btn xe_btn--quiet" onClick={useCurrentTrack}>
                  Use current track
                </button>
              )}
            </div>
            <button
              type="submit"
              className="xe_btn xe_btn--accent"
              disabled={Boolean(validation) || loading || cooldownSeconds > 0}
              title={validation ?? undefined}
            >
              {loading ? <Spinner /> : <SearchIcon size={14} />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <section className="xe_lrclib-search__results" aria-busy={loading}>
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
          {!loading && results.length > 0 && (
            <>
              <div className="xe_lrclib-search__results-header" role="status">
                <strong>
                  {results.length} result{results.length === 1 ? '' : 's'}
                </strong>
              </div>
              <ul className="xe_lrclib-search__result-list">
                {displayedResults.map(({ record, lyrics }) => {
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
                          <span>#{record.id}</span>
                          <span>{formatTime(record.duration)}</span>
                          <span>{recordKind(record)}</span>
                          {track.duration > 0 && record.duration > 0 && (
                            <span>About {Math.round(Math.abs(record.duration - track.duration))}s from current</span>
                          )}
                        </div>
                        {preview.length > 0 && (
                          <details className="xe_lrclib-search__preview">
                            <summary>Preview</summary>
                            <div>
                              {preview.map((line, index) => (
                                <span key={`${line.time ?? 'plain'}-${index}`}>{line.text}</span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
