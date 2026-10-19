import { useEffect, useMemo, useState } from 'react';
import type { TrackMeta } from '../types';
import { useLibrary } from '../context/library_context';
import { getAlbumArt } from '../management/covers';
import { albumKey } from '../utils/groups';

export function use_playlist_covers(playlist_id: string, tracks: readonly TrackMeta[]): string[] {
  const { getFile } = useLibrary();
  const samples = useMemo(() => {
    const seen = new Set<string>();
    const result: TrackMeta[] = [];
    for (const track of tracks) {
      const key = albumKey(track);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(track);
      if (result.length === 12) break;
    }
    return result;
  }, [playlist_id, tracks]);
  const sample_key = samples.map((track) => track.id).join('|');
  const [covers, set_covers] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    set_covers([]);
    Promise.all(samples.map((track) => getAlbumArt(albumKey(track), track, getFile))).then(
      (resolved) => {
        if (!alive) return;
        set_covers([...new Set(resolved.filter((cover): cover is string => cover !== null))].slice(0, 4));
      }
    );
    return () => {
      alive = false;
    };
  }, [getFile, playlist_id, sample_key]);

  return covers;
}
