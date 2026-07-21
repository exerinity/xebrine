import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { MoonIcon, PauseIcon, PlayIcon } from './icons';

const QUICK_ADD_MIN = [5, 15, 30, 60];
const MAX_CUSTOM_MIN = 720;
const MARGIN = 8;

export function SleepTimerControl() {
  const {
    sleepTimerRemaining,
    sleepTimerPaused,
    addSleepTimer,
    setSleepTimerMinutes,
    togglePauseSleepTimer,
    cancelSleepTimer
  } = usePlayer();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [customInput, setCustomInput] = useState('');

  const active = sleepTimerRemaining > 0;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const handlePanelAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (!open && e.animationName === 'xe_sleep-panel-out') setMounted(false);
  };

  useLayoutEffect(() => {
    if (!mounted) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;

    const reposition = () => {
      const buttonRect = button.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      let x = buttonRect.left;
      let y = buttonRect.bottom + 6;
      if (x + panelRect.width > window.innerWidth - MARGIN) x = window.innerWidth - panelRect.width - MARGIN;
      if (y + panelRect.height > window.innerHeight - MARGIN) y = buttonRect.top - panelRect.height - 6;
      setPos({ x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) });
    };

    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  const customMinutes = Number(customInput);
  const customValid = customInput.trim() !== '' && Number.isFinite(customMinutes) && customMinutes > 0;

  const submitCustom = () => {
    if (!customValid) return;
    setSleepTimerMinutes(Math.min(customMinutes, MAX_CUSTOM_MIN));
    setCustomInput('');
  };

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className={`xe_sleep-pill${active ? ' xe_sleep-pill--on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={
          active
            ? `Sleep timer: ${formatTime(sleepTimerRemaining)} remaining${sleepTimerPaused ? ' (paused)' : ''}`
            : 'Set a sleep timer'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MoonIcon size={14} />
        <span className="xe_sleep-pill__label">
          {active ? `${sleepTimerPaused ? 'Paused ' : ''}${formatTime(sleepTimerRemaining)}` : 'Sleep'}
        </span>
      </button>
      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            className={`xe_sleep-panel${open ? '' : ' xe_sleep-panel--closing'}`}
            style={{ left: pos.x, top: pos.y }}
            role="dialog"
            aria-label="Sleep timer"
            onAnimationEnd={handlePanelAnimationEnd}
          >
            <div className={`xe_sleep-collapse${active ? ' xe_sleep-collapse--open' : ''}`}>
              <div className="xe_sleep-collapse__inner xe_sleep-panel__status">
                {sleepTimerPaused ? 'Paused with ' : 'Stops playback in '}
                <strong>{formatTime(sleepTimerRemaining)}</strong>
                {!sleepTimerPaused && ' left'}
              </div>
            </div>
            <div className="xe_sleep-panel__quick">
              {QUICK_ADD_MIN.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="xe_btn xe_btn--small"
                  onClick={() => addSleepTimer(minutes)}
                >
                  +{minutes}m
                </button>
              ))}
            </div>
            <form
              className="xe_sleep-panel__custom"
              onSubmit={(e) => {
                e.preventDefault();
                submitCustom();
              }}
            >
              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_MIN}
                step={1}
                className="xe_search-input xe_sleep-panel__input"
                placeholder="Minutes"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
              />
              <button type="submit" className="xe_btn xe_btn--small" disabled={!customValid}>
                Set
              </button>
            </form>
            <div className={`xe_sleep-collapse${active ? ' xe_sleep-collapse--open' : ''}`}>
              <div className="xe_sleep-collapse__inner xe_sleep-panel__row">
                <button type="button" className="xe_btn xe_btn--small" onClick={togglePauseSleepTimer}>
                  {sleepTimerPaused ? (
                    <>
                      <PlayIcon size={12} />
                      Resume
                    </>
                  ) : (
                    <>
                      <PauseIcon size={12} />
                      Pause
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="xe_btn xe_btn--small xe_btn--quiet"
                  onClick={() => {
                    cancelSleepTimer();
                    setOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
