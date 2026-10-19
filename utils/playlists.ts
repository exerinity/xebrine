import type { PlaylistRecord, TrackMeta } from '../types';

export interface ResolvedPlaylist extends PlaylistRecord {
  tracks: TrackMeta[];
}

export function resolve_playlists(
  playlists: readonly PlaylistRecord[],
  tracks: readonly TrackMeta[]
): ResolvedPlaylist[] {
  const tracks_by_id = new Map(tracks.map((track) => [track.id, track]));
  return playlists.map((playlist) => ({
    ...playlist,
    tracks: playlist.trackIds
      .map((track_id) => tracks_by_id.get(track_id))
      .filter((track): track is TrackMeta => track !== undefined)
  }));
}