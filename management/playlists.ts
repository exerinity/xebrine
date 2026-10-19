import type { PlaylistRecord, TrackMeta } from '../types';

export const PLAYLIST_EXTENSIONS = new Set(['m3u', 'm3u8', 'pls']);

export function is_playlist_file(name: string): boolean {
  return PLAYLIST_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

function playlist_name(file_name: string): string {
  const dot = file_name.lastIndexOf('.');
  return (dot > 0 ? file_name.slice(0, dot) : file_name).trim() || 'Untitled playlist';
}

function decode_path(value: string): string {
  const trimmed = value.trim().replace(/^file:\/\//i, '');
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function normalize_segments(segments: string[]): string[] {
  const result: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') result.pop();
    else result.push(segment);
  }
  return result;
}

function playlist_entries(file_name: string, content: string): string[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (file_name.toLowerCase().endsWith('.pls')) {
    return lines
      .map((line) => {
        const match = /^File(\d+)\s*=\s*(.*)$/i.exec(line);
        return match ? { index: Number(match[1]), value: match[2].trim() } : null;
      })
      .filter((entry): entry is { index: number; value: string } => Boolean(entry?.value))
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.value);
  }
  return lines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

function resolve_track_id(
  entry: string,
  playlist_path: string[],
  tracks_by_path: Map<string, TrackMeta>,
  tracks_by_name: Map<string, TrackMeta | null>
): string | null {
  if (/^(?:https?|rtsp):\/\//i.test(entry)) return null;
  let path = decode_path(entry).replace(/\\/g, '/');
  path = path.replace(/^\/[a-z]:\//i, '').replace(/^[a-z]:\//i, '').replace(/^\/+/, '');
  const raw_segments = path.split('/');
  const relative = normalize_segments([...playlist_path.slice(0, -1), ...raw_segments]);
  const direct = tracks_by_path.get(relative.join('/').toLowerCase());
  if (direct) return direct.id;

  const normalized = normalize_segments(raw_segments).join('/').toLowerCase();
  const exact = tracks_by_path.get(normalized);
  if (exact) return exact.id;

  const normalized_segments = normalized.split('/');
  for (let index = 1; index < normalized_segments.length - 1; index++) {
    const suffix = tracks_by_path.get(normalized_segments.slice(index).join('/'));
    if (suffix) return suffix.id;
  }

  const file_name = raw_segments.at(-1)?.toLowerCase();
  return file_name ? tracks_by_name.get(file_name)?.id ?? null : null;
}

export function parse_playlist(
  folder_id: string,
  rel_path: string[],
  file_name: string,
  content: string,
  tracks: readonly TrackMeta[]
): PlaylistRecord {
  const tracks_by_path = new Map(tracks.map((track) => [track.relPath.join('/').toLowerCase(), track]));
  const tracks_by_name = new Map<string, TrackMeta | null>();
  for (const track of tracks) {
    const key = track.fileName.toLowerCase();
    tracks_by_name.set(key, tracks_by_name.has(key) ? null : track);
  }

  const track_ids: string[] = [];
  for (const entry of playlist_entries(file_name, content)) {
    const id = resolve_track_id(entry, rel_path, tracks_by_path, tracks_by_name);
    if (id) track_ids.push(id);
  }

  return {
    id: `${folder_id}:${rel_path.join('/')}`,
    folderId: folder_id,
    relPath: rel_path,
    fileName: file_name,
    name: playlist_name(file_name),
    trackIds: track_ids
  };
}
