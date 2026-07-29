import { useState } from 'react';
import type { TrackMeta } from '../types';
import { Modal } from './modal';

export interface DeepSearchCriteria {
  artist: string;
  title: string;
  duration: string;
  ballpark: boolean;
  year: string;
  album: string;
}

export const EMPTY_DEEP_SEARCH: DeepSearchCriteria = {
  artist: '',
  title: '',
  duration: '',
  ballpark: false,
  year: '',
  album: ''
};

const BALLPARK_SECONDS = 30;

export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(':');
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p.trim()))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p.trim()), 0);
}

export function isDeepSearchActive(c: DeepSearchCriteria): boolean {
  return (
    c.artist.trim() !== '' ||
    c.title.trim() !== '' ||
    c.album.trim() !== '' ||
    c.year.trim() !== '' ||
    parseDuration(c.duration) !== null
  );
}

export function matchesDeepSearch(track: TrackMeta, c: DeepSearchCriteria): boolean {
  const has = (field: string, needle: string) =>
    needle.trim() === '' || field.toLowerCase().includes(needle.trim().toLowerCase());

  if (!has(track.artist, c.artist)) return false;
  if (!has(track.title, c.title)) return false;
  if (!has(track.album, c.album)) return false;

  const year = c.year.trim();
  if (year !== '' && String(track.year ?? '') !== year) return false;

  const duration = parseDuration(c.duration);
  if (duration !== null) {
    if (c.ballpark) {
      if (Math.abs(track.duration - duration) > BALLPARK_SECONDS) return false;
    } else if (Math.round(track.duration) !== Math.round(duration)) {
      return false;
    }
  }

  return true;
}

interface DeepSearchModalProps {
  initial: DeepSearchCriteria;
  onApply(criteria: DeepSearchCriteria): void;
  onClose(): void;
}

export function DeepSearchModal({ initial, onApply, onClose }: DeepSearchModalProps) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<DeepSearchCriteria>) => setDraft((d) => ({ ...d, ...patch }));
  const badDuration = draft.duration.trim() !== '' && parseDuration(draft.duration) === null;

  return (
    <Modal title="Deep Search" onClose={onClose}>
      <form
        className="xe_deep-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (badDuration) return;
          onApply(draft);
        }}
      >
        <label className="xe_deep-search__field">
          <span className="xe_deep-search__label">Artist</span>
          <input
            className="xe_deep-search__input"
            autoFocus
            value={draft.artist}
            onChange={(e) => set({ artist: e.target.value })}
          />
        </label>

        <label className="xe_deep-search__field">
          <span className="xe_deep-search__label">Title</span>
          <input
            className="xe_deep-search__input"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>

        <div className="xe_deep-search__field">
          <span className="xe_deep-search__label">Duration</span>
          <div className="xe_deep-search__duration">
            <input
              className="xe_deep-search__input"
              placeholder="3:45"
              inputMode="numeric"
              value={draft.duration}
              onChange={(e) => set({ duration: e.target.value })}
            />
            <label className="xe_deep-search__toggle">
              <input
                type="checkbox"
                checked={draft.ballpark}
                onChange={(e) => set({ ballpark: e.target.checked })}
              />
              <span>Ballpark it (within {BALLPARK_SECONDS} seconds)</span>
            </label>
          </div>
          {badDuration && (
            <span className="xe_deep-search__hint">
              Use m:ss (like 3:45) or a plain number of seconds
            </span>
          )}
        </div>

        <label className="xe_deep-search__field">
          <span className="xe_deep-search__label">Year</span>
          <input
            className="xe_deep-search__input"
            inputMode="numeric"
            placeholder="2011"
            value={draft.year}
            onChange={(e) => set({ year: e.target.value })}
          />
        </label>

        <label className="xe_deep-search__field">
          <span className="xe_deep-search__label">Album</span>
          <input
            className="xe_deep-search__input"
            value={draft.album}
            onChange={(e) => set({ album: e.target.value })}
          />
        </label>

        <div className="xe_deep-search__actions">
          <button
            type="button"
            className="xe_btn xe_btn--quiet"
            onClick={() => onApply(EMPTY_DEEP_SEARCH)}
            disabled={!isDeepSearchActive(draft)}
          >
            Clear
          </button>
          <button type="submit" className="xe_btn xe_btn--accent" disabled={badDuration}>
            Search
          </button>
        </div>
      </form>
    </Modal>
  );
}
