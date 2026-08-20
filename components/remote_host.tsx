import { useEffect, useState } from 'react';
import { useRemote } from '../context/remote_context';
import { formatPin } from '../utils/remote_protocol';
import { formatDurationShort } from '../utils/format';
import { Spinner } from './spinner';
import { toast } from '../utils/toast';
import { CheckIcon, CloseIcon, CopyIcon, LinkIcon, RefreshIcon, WarningIcon } from './icons';

export function connectUrl(pin: string): string {
  return `${window.location.origin}/remote?connect=${pin}`;
}

function copy(text: string, label: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`Copied the ${label}`))
    .catch(() => toast.error(`Couldn't copy the ${label}`));
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.round((expiresAt - now) / 1000));
  if (remaining <= 0) {
    return <span className="xe_remote__expiry xe_remote__expiry--done">This PIN has expired</span>;
  }
  return (
    <span className="xe_remote__expiry">
      accepts new remotes for {formatDurationShort(remaining)}
    </span>
  );
}

export function RemoteHostPanel({ onExit }: { onExit(): void }) {
  const host = useRemote();

  useEffect(() => {
    if (host.phase === 'idle') host.start();
  }, [host.phase, host.start]);

  if (host.phase === 'connecting') {
    return (
      <div className="xe_remote__status">
        <Spinner size={24} />
        <p>Connecting...</p>
      </div>
    );
  }

  if (host.phase === 'error' || host.phase === 'idle') {
    return (
      <div className="xe_remote__status">
        <WarningIcon size={28} />
        <p>{host.error || 'The remote session is not running'}</p>
        <div className="xe_remote__status-actions">
          <button type="button" className="xe_btn xe_btn--accent" onClick={host.start}>
            Try again
          </button>
          <button
            type="button"
            className="xe_btn"
            onClick={() => {
              host.stop();
              onExit();
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="xe_remote__host">
      <section className="xe_remote__pin-card">
        <p className="xe_remote__pin-label">Enter this PIN on the controller</p>
        <p className="xe_remote__pin">{formatPin(host.pin)}</p>
        <div className="xe_remote__pin-meta">
          <Countdown expiresAt={host.expiresAt} />
        </div>
        <div className="xe_remote__pin-actions">
          <button
            type="button"
            className="xe_btn xe_btn--small"
            onClick={() => copy(host.pin, 'PIN')}
          >
            <CopyIcon size={14} />
            Copy PIN
          </button>
          <button
            type="button"
            className="xe_btn xe_btn--small"
            onClick={() => copy(connectUrl(host.pin), 'link')}
          >
            <LinkIcon size={14} />
            Copy link
          </button>
          <button type="button" className="xe_btn xe_btn--small" onClick={host.regenerate}>
            <RefreshIcon size={14} />
            Regenerate PIN
          </button>
        </div>
      </section>

      {host.pending.length > 0 && (
        <section className="xe_remote__section">
          <h2 className="xe_remote__section-title">Pending</h2>
          {host.pending.map((peer) => (
            <div key={peer.id} className="xe_remote__request">
              <p className="xe_remote__request-text">
                Incoming request from a <strong>{peer.device}</strong> ({peer.ip} - from{' '}
                {peer.country})
              </p>
              <div className="xe_remote__request-actions">
                <button
                  type="button"
                  className="xe_btn xe_btn--accent"
                  onClick={() => host.approve(peer.id)}
                >
                  <CheckIcon size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  className="xe_btn xe_btn--armed"
                  onClick={() => host.deny(peer.id)}
                >
                  <CloseIcon size={14} />
                  Deny
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="xe_remote__section">
        <h2 className="xe_remote__section-title">
          Connected controllers
          {host.controllers.length > 0 && (
            <span className="xe_remote__count">{host.controllers.length}</span>
          )}
        </h2>
        {host.controllers.length === 0 ? (
          <p className="xe_remote__hint">
            None yet
          </p>
        ) : (
          host.controllers.map((peer) => (
            <div key={peer.id} className="xe_remote__peer">
              <span className="xe_remote__peer-name">
                <strong>{peer.device}</strong>
                <span className="xe_remote__peer-meta">
                  {peer.ip} - from {peer.country}
                </span>
              </span>
              <button
                type="button"
                className="xe_btn xe_btn--small xe_btn--armed"
                onClick={() => host.kick(peer.id)}
              >
                Kick off
              </button>
            </div>
          ))
        )}
      </section>

      <p className="xe_remote__hint">
        If either no controllers connect for 5 minutes or any connected controllers do not send any commands for 5 minutes, the session will end
      </p>

      <div className="xe_remote__footer">
        <button
          type="button"
          className="xe_btn"
          onClick={() => {
            host.stop();
            onExit();
          }}
        >
          End
        </button>
      </div>
    </div>
  );
}
