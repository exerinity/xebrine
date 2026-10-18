const OFFLINE_OVERRIDE_KEY = 'xebrine.force_offline';
const ONLINE_STATUS_EVENT = 'xebrine:online_status_change';

function load_force_offline(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFLINE_OVERRIDE_KEY) === '1';
  } catch {
    return false;
  }
}

let force_offline = load_force_offline();
let online_controller = new AbortController();

export function is_force_offline(): boolean {
  return force_offline;
}

export function is_online(): boolean {
  return !is_force_offline() && (typeof navigator === 'undefined' || navigator.onLine);
}

function sync_online_signal(): void {
  if (!is_online()) online_controller.abort();
  else if (online_controller.signal.aborted) online_controller = new AbortController();
}

export function online_signal(signal?: AbortSignal): AbortSignal {
  sync_online_signal();
  return signal ? AbortSignal.any([signal, online_controller.signal]) : online_controller.signal;
}

export function set_force_offline(value: boolean): void {
  if (force_offline === value) return;
  force_offline = value;
  try {
    if (value) window.localStorage.setItem(OFFLINE_OVERRIDE_KEY, '1');
    else window.localStorage.removeItem(OFFLINE_OVERRIDE_KEY);
  } catch {
    null;
  }
  sync_online_signal();
  window.dispatchEvent(new Event(ONLINE_STATUS_EVENT));
}

export function subscribe_online(listener: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key !== OFFLINE_OVERRIDE_KEY && event.key !== null) return;
    sync_online_signal();
    listener();
  };
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  window.addEventListener(ONLINE_STATUS_EVENT, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
    window.removeEventListener(ONLINE_STATUS_EVENT, listener);
    window.removeEventListener('storage', storage);
  };
}

if (typeof window !== 'undefined') {
  sync_online_signal();
  window.addEventListener('online', sync_online_signal);
  window.addEventListener('offline', sync_online_signal);
  window.addEventListener(ONLINE_STATUS_EVENT, sync_online_signal);
  window.addEventListener('storage', (event) => {
    if (event.key !== OFFLINE_OVERRIDE_KEY && event.key !== null) return;
    force_offline = event.key === OFFLINE_OVERRIDE_KEY && event.newValue === '1';
    sync_online_signal();
  });
}
