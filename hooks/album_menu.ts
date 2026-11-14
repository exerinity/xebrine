import { useMatch, useNavigate } from 'react-router-dom';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import type { ContextMenuItem } from '../components/context_menu';
import type { AlbumGroup } from '../utils/groups';
import { search_menu_item } from '../utils/search_menu';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { slugify, toSlugParam } from '../utils/slug';
import { toast } from '../utils/toast';

export function useAlbumMenu() {
  const { playNow, enqueueNext, enqueueEnd } = usePlayer();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const album_route = useMatch('/albums/:artistName/:albumName');

  const album_page_open = (album: AlbumGroup) => {
    if (!album_route) return false;
    const artist_slug = album_route.params.artistName?.toLowerCase().replace(/^by:/, '') ?? '';
    const album_slug = album_route.params.albumName?.toLowerCase() ?? '';
    return slugify(album.artist) === artist_slug && slugify(album.album) === album_slug;
  };

  const buildMenu = (album: AlbumGroup): ContextMenuItem[] => {
    const on_album_page = album_page_open(album);
    const navigation: ContextMenuItem[] = [
      ...(!on_album_page
        ? [
            {
              label: 'Open album',
              heading: 'Navigation...',
              onSelect: () =>
                navigate(`/albums/by:${toSlugParam(album.artist)}/${toSlugParam(album.album)}`)
            } satisfies ContextMenuItem
          ]
        : []),
      {
        label: 'Open album artist',
        heading: on_album_page ? 'Navigation...' : undefined,
        onSelect: () => navigate(`/artists/${toSlugParam(album.artist)}`)
      }
    ];

    return [
      ...navigation,
      search_menu_item(`${album.album} by ${album.artist}`, settings.searchEngine, settings.customSearchUrl),
      {
        label: 'Copy name',
        onSelect: () => {
          navigator.clipboard
            .writeText(`${album.album} by ${album.artist}`)
            .then(() => toast.success('Copied the album name'))
            .catch(() => toast.error("Couldn't copy the album name"));
        }
      },
      {
        label: 'Enqueue this album',
        heading: 'Queue...',
        onSelect: () => enqueueEnd(album.tracks),
        submenu: [
          { label: 'Play this album next', onSelect: () => enqueueNext(album.tracks) },
          { label: 'Play this album now', onSelect: () => playNow(album.tracks, 0) }
        ]
      },
      {
        label: 'Shuffle this album',
        onSelect: () =>
          playNow(
            intelligentShuffle(album.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
            0
          )
      }
    ];
  };

  return { buildMenu };
}