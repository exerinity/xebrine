import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '../src/context/player';
import { formatTime } from '../utils/format';
import type { SleepTimerMode } from '../src/context/player/sleep_timer';
import { MoonIcon } from './icons';

const MARGIN = 8;
const MODES: Array<{ id: Exclude<SleepTimerMode, 'off'>; label: string }> = [
  { id: 'duration', label: 'Set a duration...' },
  { id: 'until', label: 'Until a time...' },
  { id: 'song', label: 'When this song finishes' },
  { id: 'songs', label: 'When the next X songs finish...' },
  { id: 'queue', label: 'End of the queue' },
  { id: 'battery', label: 'When battery reaches X%...' }
];

export function SleepTimerControl() {
  const {
    sleepTimerMode,
    sleepTimerRemaining,
    sleepTimerBatteryLevel,
    setSleepTimer,
    cancelSleepTimer
  } = usePlayer();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [editing, setEditing] = useState<Exclude<SleepTimerMode, 'off'> | null>(null);
  const [minutes, setMinutes] = useState('50');
  const [time, setTime] = useState('03:40');
  const [songs, setSongs] = useState('2');
  const [batteryPercent, setBatteryPercent] = useState('20');

  const active = sleepTimerMode !== 'off';

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;
    const reposition = () => {
      const buttonRect = button.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      let x = buttonRect.left;
      let y = buttonRect.top - panelRect.height - 6;
      if (x + panelRect.width > window.innerWidth - MARGIN) x = window.innerWidth - panelRect.width - MARGIN;
      if (y < MARGIN) y = buttonRect.bottom + 6;
      setPos({ x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) });
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, editing, sleepTimerMode]);

  useEffect(() => {
    if (!open) return;
    const onMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current;
      if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8) drag.moved = true;
    };
    const onUp = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.moved) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-sleep-mode]') : null;
      if (target && panelRef.current?.contains(target)) {
        suppressClickRef.current = true;
        choose(target.dataset.sleepMode as Exclude<SleepTimerMode, 'off'>);
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      } else if (!target || !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onDown = (event: globalThis.MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const choose = (mode: Exclude<SleepTimerMode, 'off'>) => {
    if (mode === 'battery' && sleepTimerBatteryLevel === null) return;
    if (mode === 'song' || mode === 'queue') {
      setSleepTimer({ mode });
      setEditing(null);
      setOpen(false);
    } else {
      setEditing(mode);
    }
  };

  const submit = () => {
    if (editing === 'duration') {
      const value = Number(minutes);
      if (Number.isFinite(value) && value > 0) setSleepTimer({ mode: 'duration', value: Math.min(value, 720) });
    } else if (editing === 'until' && time) {
      setSleepTimer({ mode: 'until', value: time });
    } else if (editing === 'songs') {
      const value = Number(songs);
      if (Number.isInteger(value) && value > 0) setSleepTimer({ mode: 'songs', value: Math.min(value, 999) });
    } else if (editing === 'battery') {
      const value = Number(batteryPercent);
      if (Number.isInteger(value) && value >= 1 && value <= 100) setSleepTimer({ mode: 'battery', value });
    }
    setOpen(false);
    setEditing(null);
  };

  const currentLabel = sleepTimerMode === 'song'
    ? 'This song'
    : sleepTimerMode === 'songs'
      ? `Next ${songs} songs`
      : sleepTimerMode === 'queue'
        ? 'End queue'
        : sleepTimerMode === 'battery'
          ? `Battery ${batteryPercent}%`
          : sleepTimerMode === 'off' ? 'Off' : 'Sleep timer';
  const timerText = sleepTimerMode === 'duration' || sleepTimerMode === 'until'
    ? formatTime(sleepTimerRemaining)
    : currentLabel;

  return <>
    <button
      type="button"
      ref={buttonRef}
      className={`xe_sleep-pill${active ? ' xe_sleep-pill--on' : ''}`}
      onMouseDown={(event) => {
        if (event.button !== 0 && event.button !== 2) return;
        dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
        setEditing(null);
        setOpen(true);
      }}
      onClick={(event) => {
        if (suppressClickRef.current) { event.preventDefault(); return; }
        setOpen(true);
      }}
      onContextMenu={(event) => event.preventDefault()}
      title={active ? `Sleep timer: ${timerText}` : 'Set a sleep timer'}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <MoonIcon size={14} />
      <span className="xe_sleep-pill__label">{timerText}</span>
    </button>
    {open && createPortal(
      <div ref={panelRef} className="xe_sleep-panel" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label="Sleep timer">
        <div className="xe_sleep-panel__status">
          {active ? `Active: ${timerText}` : 'Choose when playback should stop'}
          {sleepTimerMode === 'battery' && ` (battery now ${sleepTimerBatteryLevel ?? '--'}%)`}
        </div>
        {!editing ? <div className="xe_sleep-panel__modes">
          {MODES.map(({ id, label }) => <button
            type="button"
            key={id}
            data-sleep-mode={id}
            disabled={id === 'battery' && sleepTimerBatteryLevel === null}
            className={`xe_sleep-panel__mode${sleepTimerMode === id ? ' xe_sleep-panel__mode--selected' : ''}`}
            onClick={() => {
              if (suppressClickRef.current) return;
              choose(id);
            }}
          >
            <span>{label}</span>
            {id === 'battery' && <small>{sleepTimerBatteryLevel === null ? 'Unavailable' : `${sleepTimerBatteryLevel}%`}</small>}
          </button>)}
        </div> : <form className="xe_sleep-panel__configure" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); submit(); }}>
          <label>
            {editing === 'duration' && <>Amount of minutes until Xebrine will stop<input required type="number" min="1" max="720" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></>}
            {editing === 'until' && <>Time that Xebrine will stop<input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></>}
            {editing === 'songs' && <>Songs should play before Xebrine stops<input required type="number" min="1" max="999" step="1" value={songs} onChange={(event) => setSongs(event.target.value)} /></>}
            {editing === 'battery' && <>Battery level to reach before Xebrine stops<input required type="number" min="1" max="100" step="1" value={batteryPercent} onChange={(event) => setBatteryPercent(event.target.value)} /></>}
          </label>
          <div className="xe_sleep-panel__actions">
            <button type="button" className="xe_btn xe_btn--small xe_btn--quiet" onClick={() => setEditing(null)}>Back</button>
            <button type="submit" className="xe_btn xe_btn--small">Set</button>
          </div>
        </form>}
        <div className="xe_sleep-panel__actions">
          {active && <button type="button" className="xe_btn xe_btn--small xe_btn--quiet" onClick={() => { cancelSleepTimer(); setOpen(false); }}>Cancel timer</button>}
          <button type="button" className="xe_btn xe_btn--small xe_btn--quiet" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>, document.body
    )}
  </>;
}
