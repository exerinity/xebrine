import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { LyricsPanel } from './lyrics';
import { CloseIcon, LogoIcon } from './icons';

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
  onClose(): void;
}

const CLOSE_BUTTON_IDLE_MS = 4500;

export function FullscreenMinimalPlayer({
  artworkUrl,
  radio,
  trackId,
  coverRef,
  coverHandlers,
  onClose
}: FullscreenMinimalPlayerProps) {
  const [lyrics_hidden, set_lyrics_hidden] = useState(false);
  const [close_hidden, set_close_hidden] = useState(false);
  const close_timer = useRef(0);
  const hide_lyrics = lyrics_hidden || radio;

  const show_close_button = useCallback(() => {
    set_close_hidden(false);
    window.clearTimeout(close_timer.current);
    close_timer.current = window.setTimeout(() => set_close_hidden(true), CLOSE_BUTTON_IDLE_MS);
  }, []);

  useEffect(() => {
    set_lyrics_hidden(false);
  }, [trackId]);

  useEffect(() => {
    show_close_button();
    window.addEventListener('mousemove', show_close_button);
    return () => {
      window.clearTimeout(close_timer.current);
      window.removeEventListener('mousemove', show_close_button);
    };
  }, [show_close_button]);

  return (
    <>
      <div className={`xe_fullscreen-player__top${close_hidden ? ' xe_fullscreen-player__top--hidden' : ''}`}>
        <button type="button" className="xe_icon-btn" onClick={onClose} title="Close the player">
          <CloseIcon size={20} />
        </button>
      </div>
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
    </>
  );
}
