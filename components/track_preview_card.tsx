import { useAlbumArt } from '../hooks/album_art';
import type { QueueItem } from '../types';
import { LogoIcon } from './icons';
import { ScrollingText } from './scrolling_text';

interface TrackPreviewCardProps {
  item: QueueItem;
  onPlay(): void;
  title?: string;
}

export function TrackPreviewCard({ item, onPlay, title }: TrackPreviewCardProps) {
  const artUrl = useAlbumArt(item.track.id, item.track);

  return (
    <button
      type="button"
      className="xe_fullscreen-player__track-card"
      onClick={onPlay}
      title={title}
    >
      <span className="xe_fullscreen-player__track-art">
        {artUrl ? <img src={artUrl} alt="" /> : <LogoIcon size={18} />}
      </span>
      <span className="xe_fullscreen-player__track-copy">
        <ScrollingText text={item.track.title} className="xe_fullscreen-player__track-title" />
        <ScrollingText text={item.track.artist} className="xe_fullscreen-player__track-artist" />
      </span>
    </button>
  );
}
