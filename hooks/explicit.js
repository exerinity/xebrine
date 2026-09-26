import { useSyncExternalStore } from 'react';
import { isExplicitId, subscribeExplicit } from '../utils/explicit_tracks';

export function useIsExplicit(trackId) {
  return useSyncExternalStore(subscribeExplicit, () => isExplicitId(trackId));
}
