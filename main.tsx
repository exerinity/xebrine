import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import { installButtonRipples } from './utils/button_ripple';
import './stylesheet/index.css';

const removeButtonRipples = installButtonRipples();
if (import.meta.hot) import.meta.hot.dispose(removeButtonRipples);

createRoot(document.getElementById('xebrine')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

function revealApp() {
  document.documentElement.classList.add('xebrine_initialized');
  const splash = document.getElementById('xebrine_splash');
  if (splash) {
    const remove = () => splash.remove();
    splash.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 900);
  }
}

requestAnimationFrame(() => requestAnimationFrame(revealApp));
