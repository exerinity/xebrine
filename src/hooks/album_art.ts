import { useEffect, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { getAlbumArt } from '../management/covers';
import type { TrackMeta } from '../types';

export function useAlbumArt(key: string, sample: TrackMeta | undefined): string | null {
  const { getFile } = useLibrary();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!sample) return;
    let alive = true;
    getAlbumArt(key, sample, getFile).then((resolved) => {
      if (alive) setUrl(resolved);
    });
    return () => {
      alive = false;
    };
  }, [key, sample?.id]);

  return url;
}
