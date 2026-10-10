import { useState } from 'react';
import { usePlayer } from '../src/context/player';
import { formatTime, parseSeekInput } from '../utils/format';
import { Slider } from './slider';
import { Modal } from './modal';
import { ContextMenu, type ContextMenuItem } from './context_menu';

const TIME_MODE_KEY = 'xebrine.timeMode';

type TimeMode = 'elapsed' | 'remaining';

function loadTimeMode(): TimeMode {
  return localStorage.getItem(TIME_MODE_KEY) === 'remaining' ? 'remaining' : 'elapsed';
}

export function Scrubber() {
  const { currentTime, duration, seek, current, radio_station } = usePlayer();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(loadTimeMode);
  const [seekModalOpen, setSeekModalOpen] = useState(false);
  const [seekInput, setSeekInput] = useState('');
  const [context_menu, set_context_menu] = useState<{ x: number; y: number } | null>(null);

  const shown = dragValue ?? currentTime;
  const parsedSeek = parseSeekInput(seekInput, duration);
  const submitSeek = () => {
    if (parsedSeek === null) return;
    seek(parsedSeek);
  };
  const open_seek_modal = () => {
    setSeekInput('');
    setSeekModalOpen(true);
  };
  const toggleTimeMode = () => {
    const mode: TimeMode = timeMode === 'elapsed' ? 'remaining' : 'elapsed';
    setTimeMode(mode);
    try {
      localStorage.setItem(TIME_MODE_KEY, mode);
    } catch {
      null;
    }
  };

  const durationLabel = radio_station ? 'LIVE' : !current
    ? '-:--'
    : timeMode === 'elapsed'
      ? formatTime(duration)
      : `-${formatTime(Math.max(0, duration - shown))}`;
  const context_menu_items: ContextMenuItem[] = [
    { heading: 'Scrubber...', label: 'Restart the track (0s)', onSelect: () => seek(0) },
    { label: 'Open seek modal', onSelect: open_seek_modal },
    { label: 'Toggle duration / remaining', onSelect: toggleTimeMode }
  ];

  return (
    <div className="xe_scrubber">
      <span className="xe_scrubber__time">{current ? formatTime(shown) : '-:--'}</span>
      <Slider
        value={shown}
        max={duration || 1}
        onChange={setDragValue}
        onCommit={(v) => {
          seek(v);
          setDragValue(null);
        }}
        wheelStep={5}
        disabled={!current}
        ariaLabel="Seek"
        className="xe_scrubber__slider"
        onContextMenu={
          current && !radio_station
            ? (e) => {
                e.preventDefault();
                set_context_menu({ x: e.clientX, y: e.clientY });
              }
            : undefined
        }
      />
      <button
        type="button"
        className="xe_scrubber__time xe_scrubber__time--total"
        onClick={toggleTimeMode}
        disabled={!!radio_station}
        title={radio_station ? 'Live radio cannot be seeked' : 'Toggle duration / remaining'}
      >
        {durationLabel}
      </button>
      {seekModalOpen && (
        <Modal title="Set playback time" onClose={() => setSeekModalOpen(false)}>
          <form
            className="xe_seek-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitSeek();
            }}
          >
            <input
              className="xe_search-input"
              type="text"
              autoFocus
              value={seekInput}
              onChange={(e) => setSeekInput(e.target.value)}
            />
            <p className="xe_seek-form__hint">
              {seekInput.trim() === ''
                ? `Enter a timestamp (1:23), seconds (93), or percentage (40%) to jump to`
                : parsedSeek === null
                  ? "Invalid or unparsable time..."
                  : `Go to ${formatTime(parsedSeek)}`}
            </p>
            <div className="xe_seek-form__actions">
              <button type="button" className="xe_btn xe_btn--quiet" onClick={() => setSeekModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="xe_btn xe_btn--accent" disabled={parsedSeek === null}>
                Go
              </button>
            </div>
          </form>
        </Modal>
      )}
      {context_menu && (
        <ContextMenu
          x={context_menu.x}
          y={context_menu.y}
          items={context_menu_items}
          onClose={() => set_context_menu(null)}
        />
      )}
    </div>
  );
}
