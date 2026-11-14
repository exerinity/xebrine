import { useMatch, useNavigate } from 'react-router-dom';
import { usePlayer } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import type { ContextMenuItem } from '../components/context_menu';
import type { ArtistGroup } from '../utils/groups';
import { search_menu_item } from '../utils/search_menu';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { slugify, toSlugParam } from '../utils/slug';
import { toast } from '../utils/toast';

export function useArtistMenu() {
  const { playNow, enqueueNext, enqueueEnd } = usePlayer();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const artist_route = useMatch('/artists/:artistName');

  const artist_page_open = (artist: ArtistGroup) => {
    if (!artist_route) return false;
    return slugify(artist.name) === artist_route.params.artistName?.toLowerCase();
  };

  const buildMenu = (artist: ArtistGroup): ContextMenuItem[] => {
    const on_artist_page = artist_page_open(artist);
    return [
      ...(!on_artist_page
        ? [
            {
              label: 'Open this artist',
              heading: 'Navigation...',
              onSelect: () => navigate(`/artists/${toSlugParam(artist.name)}`)
            } satisfies ContextMenuItem
          ]
        : []),
      {
        label: 'Shuffle all music',
        heading: 'Queue...',
        onSelect: () =>
          playNow(
            intelligentShuffle(artist.tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds()),
            0
          )
      },
      {
        label: 'Enqueue all music',
        onSelect: () => enqueueEnd(artist.tracks),
        submenu: [
          { label: 'Play all music next', onSelect: () => enqueueNext(artist.tracks) },
          { label: 'Play all music now', onSelect: () => playNow(artist.tracks, 0) }
        ]
      },
      {
        ...search_menu_item(artist.name, settings.searchEngine, settings.customSearchUrl),
        separatorBefore: true
      },
      {
        label: 'Copy name',
        onSelect: () => {
          navigator.clipboard
            .writeText(artist.name)
            .then(() => toast.success('Copied the artist name'))
            .catch(() => toast.error("Couldn't copy the artist name"));
        }
      }
    ];
  };

  return { buildMenu };
}