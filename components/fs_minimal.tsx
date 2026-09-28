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
  const [instrumental, setInstrumental] = useState(false);
  const hideLyrics = instrumental && !radio;

  useEffect(() => {
    setInstrumental(false);
  }, [trackId]);

  return (
    <div
      className={`xe_fullscreen-player__minimal-layout${
        hideLyrics ? ' xe_fullscreen-player__minimal-layout--instrumental' : ''
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
        aria-hidden={hideLyrics}
        inert={hideLyrics}
      >
        {radio ? (
          <p className="xe_empty-note">Live radio</p>
        ) : (
          <LyricsPanel showToolbar={false} variant="fullscreen" onInstrumentalChange={setInstrumental} />
        )}
      </section>
    </div>
  );
}
