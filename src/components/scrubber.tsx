import { useState } from 'react';
import { usePlayer } from '../context/player_context';
import { formatTime, parseSeekInput } from '../utils/format';
import { Slider } from './slider';
import { Modal } from './modal';

const TIME_MODE_KEY = 'xebrine.timeMode';

type TimeMode = 'elapsed' | 'remaining';

function loadTimeMode(): TimeMode {
  return localStorage.getItem(TIME_MODE_KEY) === 'remaining' ? 'remaining' : 'elapsed';
}

export function Scrubber() {
  const { currentTime, duration, seek, current } = usePlayer();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(loadTimeMode);
  const [seekModalOpen, setSeekModalOpen] = useState(false);
  const [seekInput, setSeekInput] = useState('');

  const shown = dragValue ?? currentTime;
  const parsedSeek = parseSeekInput(seekInput, duration);
  const submitSeek = () => {
    if (parsedSeek === null) return;
    seek(parsedSeek);
    setSeekModalOpen(false);
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

  const durationLabel = !current
    ? '-:--'
    : timeMode === 'elapsed'
      ? formatTime(duration)
      : `-${formatTime(Math.max(0, duration - shown))}`;

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
          current
            ? (e) => {
                e.preventDefault();
                setSeekInput('');
                setSeekModalOpen(true);
              }
            : undefined
        }
      />
      <button
        type="button"
        className="xe_scrubber__time xe_scrubber__time--total"
        onClick={toggleTimeMode}
        title="Toggle duration / remaining"
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
    </div>
  );
}
