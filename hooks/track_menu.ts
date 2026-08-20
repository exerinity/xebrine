import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/player_context';
import { useSettings } from '../context/settings_context';
import type { ContextMenuItem } from '../components/context_menu';
import { displayArtist } from '../utils/groups';
import { openSearch, searchLabel } from '../utils/search_engine';
import { toSlugParam } from '../utils/slug';
import { toast } from '../utils/toast';
import type { TrackMeta } from '../types';

function copy(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`Copied the ${label}`))
    .catch(() => toast.error(`Couldn't copy the ${label}`));
}

export function useTrackMenu() {
  const { playNow, enqueueNext, enqueueEnd } = usePlayer();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const goToArtist = (track: TrackMeta) => navigate(`/artists/${toSlugParam(displayArtist(track))}`);

  const goToAlbum = (track: TrackMeta) => {
    const albumArtist = displayArtist(track);
    navigate(`/albums/${toSlugParam(track.album)}`, {
      state: { from: `/artists/${toSlugParam(albumArtist)}` }
    });
  };

  const buildMenu = (track: TrackMeta, onPlayNow?: () => void): ContextMenuItem[] => [
    {
      label: 'Play now',
      heading: 'Enqueue track...',
      onSelect: onPlayNow ?? (() => playNow([track], 0))
    },
    { label: 'Play next', onSelect: () => enqueueNext([track]) },
    { label: 'Enqueue', onSelect: () => enqueueEnd([track]) },
    { label: 'Copy title', heading: 'Copy metadata...', onSelect: () => copy(track.title, 'title') },
    { label: 'Copy info', onSelect: () => copy(`${track.title} by ${track.artist}`, 'info') },
    { label: 'Go to album', heading: 'Navigation...', onSelect: () => goToAlbum(track) },
    { label: 'Go to artist', onSelect: () => goToArtist(track) },
    {
      label: searchLabel(settings.searchEngine, settings.customSearchUrl),
      separatorBefore: true,
      onSelect: () =>
        openSearch(
          `${track.title} by ${track.artist}`,
          settings.searchEngine,
          settings.customSearchUrl
        )
    }
  ];

  return { buildMenu, goToArtist, goToAlbum };
}
