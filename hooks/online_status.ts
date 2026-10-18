import { useSyncExternalStore } from 'react';
import { is_force_offline, is_online, subscribe_online } from '../utils/online_status';

export { is_online } from '../utils/online_status';

export function use_online(): boolean {
  return useSyncExternalStore(subscribe_online, is_online, () => true);
}

export function use_force_offline(): boolean {
  return useSyncExternalStore(subscribe_online, is_force_offline, () => false);
}
