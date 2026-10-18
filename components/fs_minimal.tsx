import { useEffect, useState, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { LyricsPanel } from './lyrics';
import { LogoIcon } from './icons';

type CoverHandlers = Pick<
  ComponentPropsWithoutRef<'button'>,
  'onClick' | 'onMouseMove' | 'onMouseLeave' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>;

interface FullscreenMinimalPlayerProps {
  artworkUrl: string | null;
  radio: boolean;
  trackId: string | null;
  coverRef: RefObject<HTMLButtonElement | null>;
  coverHandlers: CoverHandlers;
}

export function FullscreenMinimalPlayer({
  artworkUrl,
  radio,
  trackId,
  coverRef,
  coverHandlers
}: FullscreenMinimalPlayerProps) {
  const [lyrics_hidden, set_lyrics_hidden] = useState(false);
  const hide_lyrics = lyrics_hidden || radio;

  useEffect(() => {
    set_lyrics_hidden(false);
  }, [trackId]);

  return (
    <div
      className={`xe_fullscreen-player__minimal-layout${
        hide_lyrics ? ' xe_fullscreen-player__minimal-layout--centered' : ''
      }`}
    >
      <section className="xe_fullscreen-player__minimal-artwork" aria-label="Current track artwork">
        <button
          ref={coverRef}
          type="button"
          className="xe_fullscreen-player__cover xe_fullscreen-player__minimal-cover"
          {...coverHandlers}
          title="Click to close fullscreen player, drag to deform cover art"
          aria-label="Click to close fullscreen player, drag to deform cover art"
        >
          {artworkUrl ? <img src={artworkUrl} alt="" draggable={false} /> : <LogoIcon size={96} />}
        </button>
      </section>
      <section
        className="xe_fullscreen-player__minimal-lyrics"
        aria-label="Lyrics"
        aria-hidden={hide_lyrics}
        inert={hide_lyrics}
      >
        {!radio && (
          <LyricsPanel showToolbar={false} variant="fullscreen" onHideLyricsChange={set_lyrics_hidden} />
        )}
      </section>
    </div>
  );
}
