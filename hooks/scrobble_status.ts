import { useSyncExternalStore } from 'react';
import {
  getScrobbleStatus,
  subscribeScrobbleStatus,
  type ScrobbleStatus
} from '../utils/scrobble_status';

export function useScrobbleStatus(): ScrobbleStatus {
  return useSyncExternalStore(subscribeScrobbleStatus, getScrobbleStatus, () => 'ready' as const);
}
