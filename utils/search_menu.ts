import type { ContextMenuItem } from '../components/context_menu';
import {
  ENGINE_GROUPS,
  engineKind,
  openSearch,
  SEARCH_ENGINES,
  searchLabel,
  type SearchEngineId
} from './search_engine';

export function search_menu_item(
  query: string,
  search_engine: SearchEngineId,
  custom_search_url: string,
  label = searchLabel(search_engine, custom_search_url)
): ContextMenuItem {
  return {
    label,
    onSelect: () => openSearch(query, search_engine, custom_search_url),
    submenu: ENGINE_GROUPS.map((group, group_index) => ({
      label: group.label,
      heading: group_index === 0 ? 'Other sites...' : undefined,
      submenu: SEARCH_ENGINES.filter(engine => engineKind(engine.id) === group.kind).map(
        (engine, engine_index) => ({
          label: engine.label,
          heading: engine_index === 0 ? `${group.label}...` : undefined,
          onSelect: () => openSearch(query, engine.id, custom_search_url)
        })
      )
    }))
  };
}
