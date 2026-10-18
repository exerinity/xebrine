import { useSyncExternalStore } from 'react';
import { is_online } from '../utils/online_status';

export { is_online } from '../utils/online_status';

function subscribe_online(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function use_online(): boolean {
  return useSyncExternalStore(subscribe_online, is_online, () => true);
}
