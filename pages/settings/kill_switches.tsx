import { use_force_offline, use_online } from '../../hooks/online_status';
import { set_force_offline } from '../../utils/online_status';

export function KillSwitchesSettings({ show_heading }: { show_heading: boolean }) {
  const force_offline = use_force_offline();
  const online = use_online();

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Kill switches</h2>}
      <section className="xe_settings__section">
        <h2>Go offline</h2>
        <div className="xe_settings__actions">
          <button
            type="button"
            className="xe_btn xe_btn--accent"
            aria-pressed={force_offline}
            onClick={() => set_force_offline(!force_offline)}
          >
            {force_offline ? 'Allow online' : 'Go offline'}
          </button>
        </div>
        <p className="xe_settings__hint" role="status">
          currently {force_offline ? 'offline (overridden)' : online ? 'online' : 'offline'}
        </p>
      </section>
    </>
  );
}
