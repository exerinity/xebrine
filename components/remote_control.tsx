import { useEffect, useRef, useState } from 'react';
import { useRemoteControl, type RemoteControl } from '../hooks/remote_control';
import { isValidPin, normalizePin, PIN_LENGTH } from '../utils/remote_protocol';
import { formatTime } from '../utils/format';
import { Slider } from './slider';
import { Spinner } from './spinner';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  TrashIcon,
  VolumeIcon,
  WarningIcon
} from './icons';

function PinEntry({ onSubmit }: { onSubmit(pin: string): void }) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="xe_remote__pin-entry"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValidPin(pin)) onSubmit(pin);
      }}
    >
      <label className="xe_remote__pin-label" htmlFor="xe_remote-pin">
        Enter PIN
      </label>
      <input
        ref={inputRef}
        id="xe_remote-pin"
        className="xe_search-input xe_remote__pin-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000 000 000"
        value={pin.replace(/(\d{3})(?=\d)/g, '$1 ')}
        onChange={(event) => setPin(normalizePin(event.target.value))}
      />
      <p className="xe_remote__hint">
        {`The playing device shows a ${PIN_LENGTH} digit PIN. It has to approve this device before the remote works.`}
      </p>
      <button type="submit" className="xe_btn xe_btn--accent" disabled={!isValidPin(pin)}>
        Connect
      </button>
    </form>
  );
}

function Transport({ control }: { control: RemoteControl }) {
  const state = control.state;
  const [seekDrag, setSeekDrag] = useState<number | null>(null);
  const [volumeDrag, setVolumeDrag] = useState<number | null>(null);

  if (!state) {
    return (
      <div className="xe_remote__status">
        <Spinner size={24} />
        <p>Waiting for the host to report back...</p>
      </div>
    );
  }

  const elapsed = seekDrag ?? state.currentTime;
  const volume = volumeDrag ?? state.volume;
  const volumeLevel = volume <= 0 ? 0 : volume < 0.34 ? 1 : volume < 0.67 ? 2 : 3;
  const RepeatGlyph = state.repeatMode === 'one' ? RepeatOneIcon : RepeatIcon;

  return (
    <div className="xe_remote__transport">
      <div className="xe_remote__now">
        <p className="xe_remote__now-title">{state.hasTrack ? state.title : 'Nothing playing'}</p>
        <p className="xe_remote__now-artist">
          {state.hasTrack ? state.artist : 'The host has an empty queue'}
        </p>
        {state.hasTrack && state.album && <p className="xe_remote__now-album">{state.album}</p>}
      </div>

      <div className="xe_remote__scrubber">
        <span className="xe_remote__time">{state.hasTrack ? formatTime(elapsed) : '-:--'}</span>
        <Slider
          value={elapsed}
          max={state.duration || 1}
          onChange={setSeekDrag}
          onCommit={(value) => {
            control.send({ t: 'seek', time: value });
            setSeekDrag(null);
          }}
          wheelStep={5}
          disabled={!state.hasTrack}
          ariaLabel="Seek"
        />
        <span className="xe_remote__time">{state.hasTrack ? formatTime(state.duration) : '-:--'}</span>
      </div>

      <div className="xe_remote__buttons">
        <button
          type="button"
          className={`xe_icon-btn${state.shuffled ? ' xe_icon-btn--active' : ''}`}
          onClick={() => control.send({ t: 'shuffle' })}
          title="Toggle shuffle"
          aria-label="Toggle shuffle"
        >
          <ShuffleIcon size={20} />
        </button>
        <button
          type="button"
          className="xe_icon-btn"
          onClick={() => control.send({ t: 'prev' })}
          title="Previous track"
          aria-label="Previous track"
        >
          <PrevIcon size={26} />
        </button>
        <button
          type="button"
          className="xe_icon-btn xe_icon-btn--primary xe_remote__play"
          onClick={() => control.send({ t: 'toggle' })}
          disabled={!state.hasTrack}
          title={state.isPlaying ? 'Pause' : 'Play'}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>
        <button
          type="button"
          className="xe_icon-btn"
          onClick={() => control.send({ t: 'next' })}
          title="Next track"
          aria-label="Next track"
        >
          <NextIcon size={26} />
        </button>
        <button
          type="button"
          className={`xe_icon-btn${state.repeatMode !== 'off' ? ' xe_icon-btn--active' : ''}`}
          onClick={() => control.send({ t: 'repeat' })}
          title={`Repeat: ${state.repeatMode}`}
          aria-label={`Repeat: ${state.repeatMode}`}
        >
          <RepeatGlyph size={20} />
        </button>
      </div>

      <div className="xe_remote__volume">
        <VolumeIcon size={18} level={volumeLevel} />
        <Slider
          value={volume}
          max={state.maxVolume}
          markAt={1}
          resetTo={1}
          onChange={setVolumeDrag}
          onCommit={(value) => {
            control.send({ t: 'volume', volume: value });
            setVolumeDrag(null);
          }}
          wheelStep={0.05}
          ariaLabel="Volume"
        />
        <span className="xe_remote__time">{Math.round(volume * 100)}%</span>
      </div>

      <div className="xe_remote__queue">
        <div className="xe_remote__queue-head">
          <h2 className="xe_remote__section-title">Queue</h2>
          <button
            type="button"
            className="xe_btn xe_btn--small"
            onClick={() => control.send({ t: 'jumble' })}
            disabled={control.queue.length < 2}
          >
            Jumble
          </button>
        </div>
        {control.queue.length === 0 ? (
          <p className="xe_remote__hint">The queue is empty</p>
        ) : (
          <ol className="xe_remote__queue-list">
            {control.queue.map((entry, index) => (
              <li
                key={entry.key}
                className={`xe_remote__queue-item${index === state.position ? ' xe_remote__queue-item--current' : ''}`}
              >
                <button
                  type="button"
                  className="xe_remote__queue-jump"
                  onClick={() => control.send({ t: 'jump', index })}
                  title="Play this track on the host"
                >
                  <span className="xe_remote__queue-title">{entry.title}</span>
                  <span className="xe_remote__queue-artist">{entry.artist}</span>
                </button>
                <span className="xe_remote__time">{formatTime(entry.duration)}</span>
                <button
                  type="button"
                  className="xe_icon-btn"
                  onClick={() => control.send({ t: 'remove', index })}
                  title="Remove from the host queue"
                  aria-label="Remove from the host queue"
                >
                  <TrashIcon size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function RemoteControlPanel({ onExit, autoPin = '' }: { onExit(): void; autoPin?: string }) {
  const control = useRemoteControl();
  const invited = useRef(false);

  useEffect(() => {
    if (invited.current || !isValidPin(autoPin)) return;
    invited.current = true;
    control.connect(autoPin);
  }, [autoPin, control.connect]);

  if (control.phase === 'idle') {
    return (
      <div className="xe_remote__control">
        <PinEntry onSubmit={control.connect} />
        <button type="button" className="xe_btn xe_btn--quiet" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  if (control.phase === 'connecting' || control.phase === 'pending') {
    return (
      <div className="xe_remote__status">
        <Spinner size={24} />
        <p>
          {control.phase === 'connecting'
            ? 'Finding that session...'
            : 'Waiting for the playing device to approve this remote'}
        </p>
        <p className="xe_remote__hint">Playback on this device is stopped while it is a remote.</p>
        <button type="button" className="xe_btn" onClick={control.disconnect}>
          Cancel
        </button>
      </div>
    );
  }

  if (control.phase === 'approved') {
    return (
      <div className="xe_remote__control">
        <p className="xe_remote__banner">
          You're currently controlling <strong>{control.host?.device ?? 'the host'}</strong>. Playback on this device
          is disabled until you disconnect.
        </p>
        <Transport control={control} />
        <div className="xe_remote__footer">
          <button type="button" className="xe_btn xe_btn--armed" onClick={control.disconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  const message =
    control.phase === 'denied'
      ? 'The playing device denied this remote'
      : control.error || 'The remote session ended';

  return (
    <div className="xe_remote__status">
      <WarningIcon size={28} />
      <p>{message}</p>
      <div className="xe_remote__status-actions">
        <button type="button" className="xe_btn xe_btn--accent" onClick={control.disconnect}>
          Enter another PIN
        </button>
        <button type="button" className="xe_btn" onClick={onExit}>
          Back
        </button>
      </div>
    </div>
  );
}
