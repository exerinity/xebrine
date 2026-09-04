import mediaInfoFactory, {
  isTrackType,
  type AudioTrack,
  type GeneralTrack,
  type MediaInfo
} from 'mediainfo.js';
import mediaInfoWasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';
import { fallbackTags, type TrackTags } from './metadata';

interface ParseRequest {
  id: number;
  file: File;
  name: string;
}

interface ParseResponse {
  id: number;
  tags: TrackTags;
  warning?: 'unreadable';
}

const mediaInfoPromise: Promise<MediaInfo<'object'>> = mediaInfoFactory({
  format: 'object',
  coverData: false,
  full: false,
  locateFile: () => mediaInfoWasmUrl
});

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function parseYear(value?: string): number | undefined {
  const match = value?.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return match ? Number(match[1]) : undefined;
}

function tagsFromMediaInfo(
  name: string,
  general: GeneralTrack,
  audio: AudioTrack
): TrackTags {
  const fallback = fallbackTags(name);
  const title = firstNonEmpty(general.Title, general.Track);
  const artist = firstNonEmpty(general.Performer);
  const album = firstNonEmpty(general.Album);

  return {
    title: title ?? fallback.title,
    artist: artist ?? fallback.artist,
    album: album ?? fallback.album,
    albumArtist: firstNonEmpty(general.Album_Performer),
    duration: audio.Duration ?? general.Duration ?? 0,
    trackNo: general.Track_Position,
    year: parseYear(general.Recorded_Date),
    genre: firstNonEmpty(general.Genre),
    hasTitleTag: title !== undefined,
    hasArtistTag: artist !== undefined,
    hasAlbumTag: album !== undefined,
    hasCoverArt: general.Cover === 'Yes'
  };
}

async function readTrackTags(file: File): Promise<TrackTags> {
  const mediaInfo = await mediaInfoPromise;
  const result = await mediaInfo.analyzeData(file.size, async (size, offset) => {
    const chunk = await file.slice(offset, offset + size).arrayBuffer();
    return new Uint8Array(chunk);
  });
  const tracks = result.media?.track ?? [];
  const general = tracks.find((track) => isTrackType(track, 'General'));
  const audio = tracks.find((track) => isTrackType(track, 'Audio'));
  if (!general || !audio) throw new Error('No readable audio stream');
  return tagsFromMediaInfo(file.name, general, audio);
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const request = e.data;
  const post = (message: ParseResponse) => (self as unknown as Worker).postMessage(message);

  try {
    post({
      id: request.id,
      tags: await readTrackTags(request.file)
    });
  } catch {
    post({
      id: request.id,
      tags: fallbackTags(request.name),
      warning: 'unreadable'
    });
  }
};
