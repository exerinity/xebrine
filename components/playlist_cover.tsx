import type { TrackMeta } from '../types';
import { use_playlist_covers } from '../hooks/playlist_covers';
import { ListIcon } from './icons';

interface PlaylistCoverProps {
  playlist_id: string;
  tracks: readonly TrackMeta[];
  icon_size?: number;
}

export function PlaylistCover({ playlist_id, tracks, icon_size = 36 }: PlaylistCoverProps) {
  const covers = use_playlist_covers(playlist_id, tracks);
  return (
    <div className={`xe_playlist-cover xe_playlist-cover--${covers.length}`} aria-hidden="true">
      {covers.length > 0
        ? covers.map((cover) => <img key={cover} src={cover} alt="" loading="lazy" />)
        : <ListIcon size={icon_size} />}
    </div>
  );
}
