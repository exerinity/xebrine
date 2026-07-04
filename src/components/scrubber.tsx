import { useState } from 'react';
import { usePlayer } from '../context/player_context';
import { formatTime } from '../utils/format';
import { Slider } from './slider';

const TIME_MODE_KEY = 'xebrine.timeMode';

type TimeMode = 'elapsed' | 'remaining';

function loadTimeMode(): TimeMode {
  return localStorage.getItem(TIME_MODE_KEY) === 'remaining' ? 'remaining' : 'elapsed';
}

export function Scrubber() {
  const { currentTime, duration, seek, current } = usePlayer();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(loadTimeMode);

  const shown = dragValue ?? currentTime;
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
      />
      <button
        type="button"
        className="xe_scrubber__time xe_scrubber__time--total"
        onClick={toggleTimeMode}
        title="Toggle duration / remaining"
      >
        {durationLabel}
      </button>
    </div>
  );
}
