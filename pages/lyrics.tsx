import { useRef, useState, type DragEvent } from 'react';
import { usePlayer } from '../context/player_context';
import { LyricsPanel } from '../components/lyrics';
import { ScrollingText } from '../components/scrolling_text';
import { usePageTitle } from '../hooks/page_title';
import { LogoIcon } from '../components/icons';

export function LyricsPage() {
  const { current, artworkUrl } = usePlayer();
  const track = current?.track ?? null;
  const [draggingLyrics, setDraggingLyrics] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dragDepth = useRef(0);
  usePageTitle('Lyrics');

  const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  const handleDragEnter = (event: DragEvent) => {
    if (!track || !isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDraggingLyrics(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!track || !isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!track || !isFileDrag(event)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDraggingLyrics(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    if (!track || !isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDraggingLyrics(false);
    const file = event.dataTransfer.files[0];
    if (file) setDroppedFile(file);
  };

  return (
    <div
      className="xe_page xe_page--lyrics"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {track && (
        <div className="xe_lyrics-header">
          <div className="xe_lyrics-header__art">
            {artworkUrl ? <img src={artworkUrl} alt="" /> : <LogoIcon size={32} />}
          </div>
          <div className="xe_lyrics-header__titles">
            <ScrollingText text={track.title} className="xe_lyrics-header__title" />
            <ScrollingText text={`${track.artist} / ${track.album}`} className="xe_lyrics-header__subtitle" />
          </div>
        </div>
      )}
      <LyricsPanel droppedFile={droppedFile} onDroppedFileHandled={() => setDroppedFile(null)} />
      {draggingLyrics && (
        <div className="xe_lyrics-drop-overlay" role="status" aria-live="polite">
          drop lyric files here to apply them to this song
        </div>
      )}
    </div>
  );
}
