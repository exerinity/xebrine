import { useEffect, useState } from 'react';
import { isExplicitId, subscribeExplicit } from '../utils/explicit_tracks';

export function useIsExplicit(trackId) {
  const [explicit, setExplicit] = useState(() => isExplicitId(trackId));

  useEffect(() => {
    setExplicit(isExplicitId(trackId));
    return subscribeExplicit(() => setExplicit(isExplicitId(trackId)));
  }, [trackId]);

  return explicit;
}
