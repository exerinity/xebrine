import { useEffect, useState } from 'react';
import { Modal } from './modal';
import { Link } from 'react-router-dom';

const KEY = 'hai';
const SHOW_DELAY_MS = 2000;

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(KEY, '1');
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return null;

  return (
    <Modal title="Welcome to Xebrine" onClose={() => setOpen(false)}>
      <p className="xe_welcome-modal__text">
        Xebrine is a web-based music player that lets you play local files directly in your browser. <Link to="/settings/library">Navigate here and add some folders to play to get started!</Link> To learn more, visit Xebrine's page on my website: <a href="https://exerinity.com/projects/xebrine" target="_blank" rel="noopener">https://exerinity.com/projects/xebrine</a>
      </p><br></br>
      <p className="xe_welcome-modal__text">
        Please keep in mind that Xebrine is <i>super super</i> early and will probably not work as intended. Furthermore, it is the <i>heavier</i> counterpart of Voxity, so please don't expect a featherweight in resources. Nevertheless, almost everything has a purpose... so far
      </p>
      <p>Anyway, thank you, and happy listening!</p>
      <div className="xe_modal__actions">
        <button type="button" className="xe_btn xe_btn--accent" onClick={() => setOpen(false)}>
          OK
        </button>
      </div>
    </Modal>
  );
}
