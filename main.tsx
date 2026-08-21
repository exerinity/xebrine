import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import { handleDomainMigration } from './utils/domain_migration';
import './stylesheet/index.css';

const redirectingToNewDomain = handleDomainMigration();

if (!redirectingToNewDomain) {
  createRoot(document.getElementById('xebrine')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

function revealApp() {
  document.documentElement.classList.add('xebrine_initialized');
  const splash = document.getElementById('xebrine_splash');
  if (splash) {
    const remove = () => splash.remove();
    splash.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 900);
  }
}

if (!redirectingToNewDomain) {
  requestAnimationFrame(() => requestAnimationFrame(revealApp));
}
