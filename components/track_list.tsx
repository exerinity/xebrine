import { useMemo, useState, type MouseEvent } from 'react';
import { REMOTE_LOCK_MESSAGE, usePlayer } from '../src/context/player';
import { useLibrary } from '../context/library_context';
import { useTrackMenu } from '../hooks/track_menu';
import { useArtistMenu } from '../hooks/artist_menu';
import { useAlbumMenu } from '../hooks/album_menu';
import { albumKey, displayArtist, groupAlbums, groupArtists, type AlbumGroup, type ArtistGroup } from '../utils/groups';
import { formatTime } from '../utils/format';
import type { PlaybackSource, TrackMeta } from '../types';
import { ContextMenu, type ContextMenuItem } from './context_menu';
import { NowPlayingIcon, PauseIcon, PlayIcon, PlayNextIcon, PlusIcon } from './icons';
import { ExplicitBadge } from './explicit_badge';

interface TrackListProps {
  tracks: TrackMeta[];
  playOnlySelected?: boolean;
  source?: PlaybackSource;
}

type MenuState =
  | { kind: 'track'; x: number; y: number; track: TrackMeta; index: number }
  | { kind: 'artist'; x: number; y: number; artist: ArtistGroup }
  | { kind: 'album'; x: number; y: number; album: AlbumGroup };

export function TrackList({ tracks, playOnlySelected = false, source }: TrackListProps) {
  const { tracks: library_tracks } = useLibrary();
  const { current, isPlaying, playNow, enqueueNext, enqueueEnd, remoteLocked } = usePlayer();
  const { buildMenu: buildTrackMenu, goToArtist, goToAlbum } = useTrackMenu();
  const { buildMenu: buildArtistMenu } = useArtistMenu();
  const { buildMenu: buildAlbumMenu } = useAlbumMenu();
  const currentTrackId = current?.track.id;
  const [menu, setMenu] = useState<MenuState | null>(null);

  const artists_by_name = useMemo(() => {
    const map = new Map<string, ArtistGroup>();
    for (const artist of groupArtists(library_tracks)) {
      map.set(artist.name.toLowerCase(), artist);
    }
    return map;
  }, [library_tracks]);

  const albums_by_key = useMemo(() => {
    const map = new Map<string, AlbumGroup>();
    for (const album of groupAlbums(library_tracks)) {
      map.set(album.key, album);
    }
    return map;
  }, [library_tracks]);

  const startTrack = (track: TrackMeta, index: number) =>
    playNow(playOnlySelected ? [track] : tracks, playOnlySelected ? 0 : index, source);

  const openTrackMenu = (e: MouseEvent, track: TrackMeta, index: number) => {
    e.preventDefault();
    setMenu({ kind: 'track', x: e.clientX, y: e.clientY, track, index });
  };

  const openArtistMenu = (e: MouseEvent, track: TrackMeta, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const artist = artists_by_name.get(displayArtist(track).toLowerCase());
    if (artist) setMenu({ kind: 'artist', x: e.clientX, y: e.clientY, artist });
    else openTrackMenu(e, track, index);
  };

  const openAlbumMenu = (e: MouseEvent, track: TrackMeta, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const album = albums_by_key.get(albumKey(track));
    if (album) setMenu({ kind: 'album', x: e.clientX, y: e.clientY, album });
    else openTrackMenu(e, track, index);
  };

  const menu_items = (): ContextMenuItem[] => {
    if (!menu) return [];
    switch (menu.kind) {
      case 'artist':
        return buildArtistMenu(menu.artist);
      case 'album':
        return buildAlbumMenu(menu.album);
      default:
        return buildTrackMenu(menu.track, () => startTrack(menu.track, menu.index), source);
    }
  };

  return (
    <div className="xe_track-table">
      <div className="xe_track-table__row xe_track-table__row--head">
        <span className="xe_track-table__cell xe_track-table__cell--num">#</span>
        <span className="xe_track-table__cell">Title</span>
        <span className="xe_track-table__cell">Artist</span>
        <span className="xe_track-table__cell">Album</span>
        <span className="xe_track-table__cell xe_track-table__cell--dur">Time</span>
        <span className="xe_track-table__cell xe_track-table__cell--actions" />
      </div>
      {tracks.map((track, i) => {
        const active = track.id === currentTrackId;
        return (
          <div
            key={track.id}
            className={`xe_track-table__row${active ? ' xe_track-table__row--active' : ''}`}
            onDoubleClick={() => startTrack(track, i)}
            onContextMenu={(e) => openTrackMenu(e, track, i)}
          >
            <span className="xe_track-table__cell xe_track-table__cell--num">
              {active ? (isPlaying ? <NowPlayingIcon /> : <PauseIcon size={13} />) : i + 1}
            </span>
            <span className="xe_track-table__cell xe_track-table__cell--title">
              {track.title}
              <ExplicitBadge trackId={track.id} />
            </span>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              title={`Go to ${displayArtist(track)} (right-click for options)`}
              onClick={(e) => {
                e.stopPropagation();
                goToArtist(track);
              }}
              onContextMenu={(e) => openArtistMenu(e, track, i)}
            >
              {track.artist}
            </button>
            <button
              type="button"
              className="xe_track-table__cell xe_track-table__cell--link"
              title={`Go to ${track.album} (right-click for options)`}
              onClick={(e) => {
                e.stopPropagation();
                goToAlbum(track);
              }}
              onContextMenu={(e) => openAlbumMenu(e, track, i)}
            >
              {track.album}
            </button>
            <span className="xe_track-table__cell xe_track-table__cell--dur">
              {formatTime(track.duration)}
            </span>
            <span className="xe_track-table__cell xe_track-table__cell--actions">
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : playOnlySelected ? 'Play track' : 'Play from here'}
                disabled={remoteLocked}
                onClick={() => startTrack(track, i)}
              >
                <PlayIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : 'Play next'}
                disabled={remoteLocked}
                onClick={() => enqueueNext([track], source)}
              >
                <PlayNextIcon size={13} />
              </button>
              <button
                type="button"
                className="xe_mini-btn"
                title={remoteLocked ? REMOTE_LOCK_MESSAGE : 'Add to end of queue'}
                disabled={remoteLocked}
                onClick={() => enqueueEnd([track], source)}
              >
                <PlusIcon size={13} />
              </button>
            </span>
          </div>
        );
      })}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu_items()} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}