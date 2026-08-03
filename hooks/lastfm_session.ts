import { useSyncExternalStore } from 'react';
import {
  getLastfmSession,
  subscribeLastfmSession,
  type LastfmSession
} from '../utils/lastfm_session';

export function useLastfmSession(): LastfmSession | null {
  return useSyncExternalStore(subscribeLastfmSession, getLastfmSession, () => null);
}
