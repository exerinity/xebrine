import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RemoteControlPanel } from '../components/remote_control';
import { RemoteHostPanel } from '../components/remote_host';
import { useRemote } from '../context/remote_context';
import { usePageTitle } from '../hooks/page_title';
import { isValidPin, normalizePin } from '../utils/remote_protocol';
import { NoteIcon, QueueIcon } from '../components/icons';

type Role = 'none' | 'playing' | 'controlling';

export function RemotePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const remote = useRemote();
  const invited = normalizePin(searchParams.get('connect') ?? '');
  const autoPin = isValidPin(invited) ? invited : '';
  const [role, setRole] = useState<Role>(autoPin ? 'controlling' : 'none');
  const hosting = remote.phase === 'live' || remote.phase === 'connecting';
  const active: Role = hosting ? 'playing' : role;
  usePageTitle('Remote');

  const leaveRole = () => {
    setRole('none');
    if (searchParams.has('connect')) setSearchParams({}, { replace: true });
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Remote</h1>
      </div>

      <div className="xe_page__scroll">
        <div className="xe_remote">
          {active === 'none' && (
            <div className="xe_remote__roles">
              <p className="xe_remote__question">What are you doing on this device?</p>
              <div className="xe_remote__role-grid">
                <button
                  type="button"
                  className="xe_remote__role"
                  onClick={() => setRole('playing')}
                >
                  <NoteIcon size={26} />
                  <strong>Playing</strong>
                  <span>
                    Get a PIN for other devices to connect
                  </span>
                </button>
                <button
                  type="button"
                  className="xe_remote__role"
                  onClick={() => setRole('controlling')}
                >
                  <QueueIcon size={26} />
                  <strong>Controlling</strong>
                  <span>
                    Enter a PIN from another device to control it
                  </span>
                </button>
              </div>
            </div>
          )}

          {active === 'playing' && <RemoteHostPanel onExit={leaveRole} />}
          {active === 'controlling' && <RemoteControlPanel onExit={leaveRole} autoPin={autoPin} />}
        </div>
      </div>
    </div>
  );
}
