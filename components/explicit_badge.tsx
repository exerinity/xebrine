import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useIsExplicit } from '../hooks/explicit';
import { dbGet } from '../management/db';
import type { StoredLyrics } from '../types';
import { PROFANITY_WORDS } from '../utils/profanity';
import { Modal } from './modal';
import { Spinner } from './spinner';

interface ExplicitIconProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  expanded?: boolean;
}

const FLAGGED_WORD_SOURCE = `\\b(?:${PROFANITY_WORDS.join('|')})\\w*`;

function HighlightedLine({ text }: { text: string }) {
  const content: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(new RegExp(FLAGGED_WORD_SOURCE, 'gi'))) {
    const index = match.index;
    if (index > cursor) content.push(text.slice(cursor, index));
    content.push(
      <mark key={index} className="xe_explicit-lyrics__flagged">
        {match[0]}
      </mark>
    );
    cursor = index + match[0].length;
  }

  if (cursor < text.length) content.push(text.slice(cursor));
  return <>{content.length > 0 ? content : text}</>;
}

function ExplicitLyricsModal({ trackId, onClose }: { trackId: string; onClose(): void }) {
  const [stored, setStored] = useState<StoredLyrics | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setStored(null);
    setStatus('loading');

    void dbGet<StoredLyrics>('lyrics', trackId)
      .then((result) => {
        if (!active) return;
        if (!result?.lyrics.lines.length) {
          setStatus('empty');
          return;
        }
        setStored(result);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [trackId]);

  return (
    <Modal title="Explicit lyrics" onClose={onClose}>
      {status === 'loading' && (
        <p>
          <Spinner />
          Loading lyrics...
        </p>
      )}
      {status === 'empty' && <p>Lyrics are not available for this track</p>}
      {status === 'error' && <p>Could not load the lyrics</p>}
      {status === 'ready' && stored && (
        <div>
          <div>
            {stored.lyrics.lines.map((line, index) => (
              <p key={index}>
                {line.text ? <HighlightedLine text={line.text} /> : '\u00a0'}
              </p>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ExplicitIcon({ onClick, expanded = false }: ExplicitIconProps = {}) {
  if (onClick) {
    return (
      <button
        type="button"
        className="xe_explicit-badge"
        title="Show explicit lyrics"
        aria-label="Show explicit lyrics"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={(event) => {
          event.stopPropagation();
          onClick(event);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        E
      </button>
    );
  }

  return (
    <span className="xe_explicit-badge" title="Explicit lyrics">
      E
    </span>
  );
}

export function ExplicitBadge({ trackId }: { trackId: string }) {
  const explicit = useIsExplicit(trackId);
  const [open, setOpen] = useState(false);

  if (!explicit) return null;
  return (
    <>
      <ExplicitIcon expanded={open} onClick={() => setOpen(true)} />
      {open && <ExplicitLyricsModal trackId={trackId} onClose={() => setOpen(false)} />}
    </>
  );
}
