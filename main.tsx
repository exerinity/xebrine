import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import './stylesheet/index.css';

createRoot(document.getElementById('xebrine')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

function revealApp() {
  document.documentElement.classList.add('xe-ready');
  const splash = document.getElementById('xebrine-splash');
  if (splash) {
    const remove = () => splash.remove();
    splash.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 900);
  }
}

requestAnimationFrame(() => requestAnimationFrame(revealApp));
