import type { TrackMeta } from '../types';

export interface ArtistGroup {
  name: string;
  tracks: TrackMeta[];
  albumCount: number;
}

export interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  year?: number;
  tracks: TrackMeta[];
}

export function displayArtist(track: TrackMeta): string {
  return track.albumArtist?.trim() || track.artist;
}

export function albumKey(track: TrackMeta): string {
  return `${displayArtist(track).toLowerCase()}::${track.album.toLowerCase()}`;
}

export function groupArtists(tracks: TrackMeta[]): ArtistGroup[] {
  const map = new Map<string, { name: string; tracks: TrackMeta[]; albums: Set<string> }>();
  for (const track of tracks) {
    const name = displayArtist(track);
    const lower = name.toLowerCase();
    let group = map.get(lower);
    if (!group) {
      group = { name, tracks: [], albums: new Set() };
      map.set(lower, group);
    }
    group.tracks.push(track);
    group.albums.add(track.album.toLowerCase());
  }
  return [...map.values()]
    .map((g) => ({
      name: g.name,
      tracks: sortAlbumOrder(g.tracks),
      albumCount: g.albums.size
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupAlbums(tracks: TrackMeta[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const track of tracks) {
    const key = albumKey(track);
    let group = map.get(key);
    if (!group) {
      group = { key, album: track.album, artist: displayArtist(track), year: track.year, tracks: [] };
      map.set(key, group);
    }
    group.tracks.push(track);
    if (!group.year && track.year) group.year = track.year;
  }
  for (const group of map.values()) {
    group.tracks.sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0) || a.title.localeCompare(b.title));
  }
  return [...map.values()].sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0) || a.album.localeCompare(b.album)
  );
}

function sortAlbumOrder(tracks: TrackMeta[]): TrackMeta[] {
  return [...tracks].sort(
    (a, b) =>
      a.album.localeCompare(b.album) ||
      (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
      a.title.localeCompare(b.title)
  );
}
