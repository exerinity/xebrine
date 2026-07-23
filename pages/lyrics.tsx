import { usePlayer } from '../context/player_context';
import { LyricsPanel } from '../components/lyrics';
import { ScrollingText } from '../components/scrolling_text';
import { usePageTitle } from '../hooks/page_title';
import { NoteIcon } from '../components/icons';

export function LyricsPage() {
  const { current, artworkUrl } = usePlayer();
  const track = current?.track ?? null;
  usePageTitle('Lyrics');

  return (
    <div className="xe_page">
      {track && (
        <div className="xe_lyrics-header">
          <div className="xe_lyrics-header__art">
            {artworkUrl ? <img src={artworkUrl} alt="" /> : <NoteIcon size={32} />}
          </div>
          <div className="xe_lyrics-header__titles">
            <ScrollingText text={track.title} className="xe_lyrics-header__title" />
            <ScrollingText text={`${track.artist} / ${track.album}`} className="xe_lyrics-header__subtitle" />
          </div>
        </div>
      )}
      <LyricsPanel />
    </div>
  );
}
