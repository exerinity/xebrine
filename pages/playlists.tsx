import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { usePlayer } from '../src/context/player';
import { resolve_playlists, type ResolvedPlaylist } from '../utils/playlists';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { PlaylistCover } from '../components/playlist_cover';
import { PlayIcon, PlusIcon, SearchIcon, ShuffleIcon } from '../components/icons';
import { ContextMenu, type ContextMenuItem } from '../components/context_menu';
import { ScanStatusBanner } from '../components/scan_status_banner';
import { SortSelect, type SortDirection, type SortOption } from '../components/sort_select';
import { toast } from '../utils/toast';
import { useScrollRestoration } from '../hooks/scroll_restoration';
import { useInfiniteScroll } from '../hooks/infinite_scroll';
import { usePageTitle } from '../hooks/page_title';
import { toSlugParam } from '../utils/slug';

type PlaylistSort = 'title' | 'tracks';

const SORT_OPTIONS: SortOption<PlaylistSort>[] = [
  { value: 'title', label: 'Title' },
  { value: 'tracks', label: 'Tracks' }
];
const SORT_KEY = 'xebrine.playlistsSort';

function load_sort(): { sort: PlaylistSort; direction: SortDirection } {
  const raw = localStorage.getItem(SORT_KEY);
  return {
    sort: raw === 'tracks' ? 'tracks' : 'title',
    direction: localStorage.getItem(`${SORT_KEY}.direction`) === 'desc' ? 'desc' : 'asc'
  };
}

function PlaylistCard({ playlist, on_open }: { playlist: ResolvedPlaylist; on_open(): void }) {
  const { playNow, enqueueNext, enqueueEnd, remoteLocked } = usePlayer();
  const [menu, set_menu] = useState<{ x: number; y: number } | null>(null);
  const source = { type: 'playlist' as const, name: playlist.name };
  const shuffle = () =>
    playNow(
      intelligentShuffle(playlist.tracks, (track) => ({ id: track.id, artist: track.artist }), getRecentIds()),
      0,
      source
    );
  const menu_items: ContextMenuItem[] = [
    {
      label: 'Copy name',
      onSelect: () => {
        navigator.clipboard
          .writeText(playlist.name)
          .then(() => toast.success('Copied the playlist name'))
          .catch(() => toast.error("Couldn't copy the playlist name"));
      }
    },
    {
      label: 'Enqueue this playlist',
      heading: 'Queue...',
      onSelect: () => enqueueEnd(playlist.tracks, source),
      submenu: [
        { label: 'Play this playlist next', onSelect: () => enqueueNext(playlist.tracks, source) },
        { label: 'Play this playlist now', onSelect: () => playNow(playlist.tracks, 0, source) }
      ]
    },
    { label: 'Shuffle this playlist', onSelect: shuffle }
  ];

  return (
    <div
      className="xe_album-card"
      onClick={on_open}
      onContextMenu={(event) => {
        event.preventDefault();
        set_menu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="xe_album-card__art">
        <PlaylistCover playlist_id={playlist.id} tracks={playlist.tracks} />
        <div className="xe_album-card__actions">
          <button
            type="button"
            className="xe_album-card__action"
            disabled={remoteLocked || playlist.tracks.length === 0}
            title="Shuffle playlist"
            onClick={(event) => {
              event.stopPropagation();
              shuffle();
            }}
          >
            <ShuffleIcon size={14} />
          </button>
          <button
            type="button"
            className="xe_album-card__action"
            disabled={remoteLocked || playlist.tracks.length === 0}
            title="Enqueue"
            onClick={(event) => {
              event.stopPropagation();
              enqueueEnd(playlist.tracks, source);
            }}
          >
            <PlusIcon size={14} />
          </button>
          <button
            type="button"
            className="xe_album-card__play"
            disabled={remoteLocked || playlist.tracks.length === 0}
            title="Play playlist"
            onClick={(event) => {
              event.stopPropagation();
              playNow(playlist.tracks, 0, source);
            }}
          >
            <PlayIcon size={18} />
          </button>
        </div>
      </div>
      <span className="xe_album-card__title">{playlist.name}</span>
      <span className="xe_album-card__artist">
        {playlist.tracks.length} track{playlist.tracks.length === 1 ? '' : 's'}
      </span>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu_items} onClose={() => set_menu(null)} />}
    </div>
  );
}

export function PlaylistsPage() {
  const { playlists, tracks } = useLibrary();
  const navigate = useNavigate();
  const [query, set_query] = useState('');
  const [{ sort, direction }, set_sort_state] = useState(load_sort);
  const scroll_ref = useScrollRestoration();
  usePageTitle('Playlists');

  const resolved = useMemo(() => resolve_playlists(playlists, tracks), [playlists, tracks]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const copy = resolved.filter((playlist) => !q || playlist.name.toLowerCase().includes(q));
    const factor = direction === 'asc' ? 1 : -1;
    copy.sort((a, b) => factor * (
      sort === 'tracks'
        ? a.tracks.length - b.tracks.length || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    ));
    return copy;
  }, [resolved, query, sort, direction]);
  const { visible: paged, hasMore, sentinelRef } = useInfiniteScroll(visible);

  const change_sort = (value: PlaylistSort) => {
    set_sort_state((current) => ({ ...current, sort: value }));
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      null;
    }
  };
  const change_direction = (value: SortDirection) => {
    set_sort_state((current) => ({ ...current, direction: value }));
    try {
      localStorage.setItem(`${SORT_KEY}.direction`, value);
    } catch {
      null;
    }
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Playlists</h1>
        <div className="xe_search-field">
          <SearchIcon size={14} />
          <input
            className="xe_search-input"
            type="search"
            placeholder="Search playlists..."
            value={query}
            onChange={(event) => set_query(event.target.value)}
          />
        </div>
        <SortSelect
          value={sort}
          onChange={change_sort}
          options={SORT_OPTIONS}
          direction={direction}
          onDirectionChange={change_direction}
        />
        <span className="xe_page__meta">{resolved.length} playlists</span>
      </div>
      <ScanStatusBanner />
      {visible.length === 0 ? (
        <p className="xe_empty-note">
          {playlists.length === 0
            ? 'No playlists found. If you have any M3U, M3U8, or PLS files, rescan the library and they will show up here'
            : 'No playlists match...'}
        </p>
      ) : (
        <div className="xe_page__scroll" ref={scroll_ref}>
          <div className="xe_album-grid">
            {paged.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                on_open={() => navigate(`/playlists/${toSlugParam(playlist.name)}`)}
              />
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} className="xe_infinite-sentinel" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
