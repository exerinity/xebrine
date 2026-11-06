import { useEffect, useState } from 'react';

type before_install_prompt_event = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const listeners = new Set<() => void>();
let deferred: before_install_prompt_event | null = null;

function notify(): void {
  listeners.forEach(listener => listener());
}

function pwa_installed(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event as before_install_prompt_event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function use_pwa_install() {
  const [, set_tick] = useState(0);
  useEffect(() => {
    const refresh = () => set_tick(tick => tick + 1);
    listeners.add(refresh);
    return () => { listeners.delete(refresh); };
  }, []);
  return {
    installed: pwa_installed(),
    available: deferred !== null && !pwa_installed(),
    async prompt() {
      if (!deferred) return;
      const event = deferred;
      deferred = null;
      notify();
      await event.prompt();
      await event.userChoice;
    }
  };
}
