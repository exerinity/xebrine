import { useEffect, useState } from 'react';
import { useLibrary } from '../context/library_context';
import { getAlbumArt } from '../management/covers';

export function useAlbumArt(key, sample) {
  const { getFile } = useLibrary();
  const [url, setUrl] = useState(null);

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
