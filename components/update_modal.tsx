import { useRegisterSW } from 'virtual:pwa-register/react';
import { Modal } from './modal';
import { RefreshIcon } from './icons';

export function UpdateModal() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;

  return (
    <Modal title="Update available" onClose={() => setNeedRefresh(false)}>
      <p className="xe_update-modal__text">There is a new version of Xebrine available! Would you like to reload the app to apply it?</p>
      <div className="xe_modal__actions">
        <button type="button" className="xe_btn xe_btn--quiet" onClick={() => setNeedRefresh(false)}>
          No sod off
        </button>
        <button
          type="button"
          className="xe_btn xe_btn--accent"
          onClick={() => void updateServiceWorker(true)}
        >
          <RefreshIcon size={14} />
          Yeah okay gimme
        </button>
      </div>
    </Modal>
  );
}
