import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  browse_radio,
  get_radio_filters,
  get_station,
  modify_radio,
  normalize_station,
  station_artwork_url,
  stream_issue,
  type radio_list_item,
  type radio_station_record
} from '../api/radio_browser';
import { usePlayer as use_player } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import { usePageTitle as use_page_title } from '../hooks/page_title';
import { PauseIcon, PlayIcon, RadioIcon, SearchIcon } from '../components/icons';
import { ContextMenu, type ContextMenuItem } from '../components/context_menu';
import { Modal } from '../components/modal';
import { Spinner } from '../components/spinner';
import { searchLabel } from '../utils/search_engine';
import { search_menu_item } from '../utils/search_menu';
import { radio_homepage, radio_location } from '../utils/radio_station';
import { toast } from '../utils/toast';
import { is_online, use_online } from '../hooks/online_status';

type radio_tab = 'popular' | 'search' | 'genres' | 'countries';

const TABS: { id: radio_tab; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'search', label: 'Search' },
  { id: 'genres', label: 'Browse genres' },
  { id: 'countries', label: 'Browse countries' }
];

const BITRATES = [
  { value: '', label: 'Any bitrate' },
  { value: '64', label: '64+ kbps' },
  { value: '128', label: '128+ kbps' },
  { value: '192', label: '192+ kbps' },
  { value: '256', label: '256+ kbps' }
];

const EMPTY_FILTERS = { countries: [] as radio_list_item[], languages: [] as radio_list_item[], tags: [] as radio_list_item[], codecs: [] as radio_list_item[] };

function tab_from_url(value: string | null | undefined): radio_tab | null {
  return TABS.some(tab => tab.id === value) ? value as radio_tab : null;
}

function flag_url(code: string): string | null {
  const iso = code.trim().toLowerCase();
  return /^[a-z]{2}$/.test(iso) ? `https://espresso.exerinity.com/flags/${iso}.svg` : null;
}

function Country_flag({ code }: { code: string }) {
  const [failed, set_failed] = useState(false);
  const src = flag_url(code);
  if (!src || failed) return null;
  return <img className="xe_radio-flag" src={src} alt="" loading="lazy" onError={() => set_failed(true)} />;
}

function country_name(code: string): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function stations_from(data: unknown): radio_station_record[] {
  if (!Array.isArray(data)) return [];
  return data
    .map(normalize_station)
    .filter((station): station is radio_station_record => !!station && !stream_issue(station));
}

function station_tags(station: radio_station_record): string[] {
  return station.tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 8);
}

const LIST_DEFAULTS = { hidebroken: 'true', hide_unplayable: 'true', limit: '36' };
const PAGE_SIZE = 48;

async function load_stations(resource: string, params: Record<string, string>, signal: AbortSignal): Promise<radio_station_record[]> {
  return stations_from(await browse_radio(resource, { ...LIST_DEFAULTS, ...params }, signal));
}

async function load_station_page(params: Record<string, string>, offset: number, signal: AbortSignal): Promise<{ stations: radio_station_record[]; full: boolean }> {
  const data = await browse_radio('search', {
    ...LIST_DEFAULTS,
    order: 'clickcount',
    reverse: 'true',
    ...params,
    limit: String(PAGE_SIZE),
    offset: String(offset)
  }, signal);
  return {
    stations: stations_from(data),
    full: Array.isArray(data) && data.length >= PAGE_SIZE
  };
}

function merge_stations(current: radio_station_record[], next: radio_station_record[]): radio_station_record[] {
  const seen = new Set(current.map(station => station.stationuuid));
  return [...current, ...next.filter(station => !seen.has(station.stationuuid))];
}

function Station_art({ station, size }: { station: radio_station_record; size: number }) {
  const [failed, set_failed] = useState(false);
  const src = station.favicon && !failed ? station_artwork_url(station) : '';
  if (!src) return <RadioIcon size={size} />;
  return <img src={src} alt="" loading="lazy" onError={() => set_failed(true)} />;
}

function Station_dial({
  station,
  live,
  remote_locked,
  on_open,
  on_play,
  on_menu
}: {
  station: radio_station_record;
  live: boolean;
  remote_locked: boolean;
  on_open(): void;
  on_play(): void;
  on_menu(x: number, y: number): void;
}) {
  const issue = stream_issue(station);
  return (
    <div
      className={`xe_radio-dial${live ? ' xe_radio-dial--live' : ''}`}
      onClick={on_open}
      onContextMenu={event => {
        event.preventDefault();
        on_menu(event.clientX, event.clientY);
      }}
    >
      <div className="xe_radio-dial__art">
        <Station_art station={station} size={44} />
        <button
          type="button"
          className="xe_radio-dial__play"
          disabled={remote_locked || !!issue}
          title={issue ?? (live ? 'Stop radio' : `Play ${station.name}`)}
          onClick={event => {
            event.stopPropagation();
            on_play();
          }}
        >
          {live ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      </div>
      <span className="xe_radio-dial__name" title={station.name}>{station.name}</span>
      <span className="xe_radio-dial__meta">{radio_location(station) || station.language || 'Radio'}</span>
    </div>
  );
}

type dial_list_props = {
  radio_station: radio_station_record | null;
  radio_connecting: boolean;
  is_playing: boolean;
  remote_locked: boolean;
  on_open(station: radio_station_record): void;
  on_play(station: radio_station_record): void;
  on_menu(station: radio_station_record, x: number, y: number): void;
};

function Station_row({
  stations,
  radio_station,
  radio_connecting,
  is_playing,
  remote_locked,
  on_open,
  on_play,
  on_menu
}: { stations: radio_station_record[] } & dial_list_props) {
  return (
    <div className="xe_home-carousel">
      {stations.map(station => {
        const selected = radio_station?.stationuuid === station.stationuuid;
        return (
          <div className="xe_home-carousel__item" key={station.stationuuid}>
            <Station_dial
              station={station}
              live={selected && (is_playing || radio_connecting)}
              remote_locked={remote_locked}
              on_open={() => on_open(station)}
              on_play={() => on_play(station)}
              on_menu={(x, y) => on_menu(station, x, y)}
            />
          </div>
        );
      })}
    </div>
  );
}

function Station_grid({
  stations,
  radio_station,
  radio_connecting,
  is_playing,
  remote_locked,
  on_open,
  on_play,
  on_menu,
  has_more,
  loading_more,
  sentinel_ref
}: { stations: radio_station_record[]; has_more: boolean; loading_more: boolean; sentinel_ref: RefObject<HTMLDivElement | null> } & dial_list_props) {
  return (
    <>
      <div className="xe_radio-grid">
        {stations.map(station => {
          const selected = radio_station?.stationuuid === station.stationuuid;
          return (
            <Station_dial
              key={station.stationuuid}
              station={station}
              live={selected && (is_playing || radio_connecting)}
              remote_locked={remote_locked}
              on_open={() => on_open(station)}
              on_play={() => on_play(station)}
              on_menu={(x, y) => on_menu(station, x, y)}
            />
          );
        })}
      </div>
      {has_more && <div ref={sentinel_ref} className="xe_infinite-sentinel" aria-hidden="true" />}
      {loading_more && (
        <p className="xe_page__meta" role="status"><Spinner size={14} /> Loading more...</p>
      )}
    </>
  );
}

export function Radio_page() {
  use_page_title('Radio');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { tab: tab_param } = useParams<{ tab: string }>();
  const [url_params] = useSearchParams();
  const tab = tab_from_url(tab_param) ?? tab_from_url(url_params.get('tab')) ?? 'popular';
  const [query, set_query] = useState(url_params.get('q') ?? '');
  const [tag, set_tag] = useState(url_params.get('tag') ?? '');
  const [country, set_country] = useState(url_params.get('country') ?? '');
  const [codec, set_codec] = useState(url_params.get('codec') ?? '');
  const [bitrate, set_bitrate] = useState(url_params.get('bitrate') ?? '');
  const [https_only, set_https_only] = useState(url_params.get('https') === 'true');
  const [filters, set_filters] = useState(EMPTY_FILTERS);
  const [popular, set_popular] = useState<radio_station_record[]>([]);
  const [top_voted, set_top_voted] = useState<radio_station_record[]>([]);
  const [recent, set_recent] = useState<radio_station_record[]>([]);
  const [genre_shelves, set_genre_shelves] = useState<{ tag: string; stations: radio_station_record[] }[]>([]);
  const [search_results, set_search_results] = useState<radio_station_record[]>([]);
  const [browse_results, set_browse_results] = useState<radio_station_record[]>([]);
  const [search_has_more, set_search_has_more] = useState(false);
  const [browse_has_more, set_browse_has_more] = useState(false);
  const [chip_filter, set_chip_filter] = useState('');
  const [loading, set_loading] = useState(false);
  const [loading_more, set_loading_more] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [detail, set_detail] = useState<radio_station_record | null>(null);
  const [detail_loading, set_detail_loading] = useState(false);
  const [action_busy, set_action_busy] = useState(false);
  const [station_menu, set_station_menu] = useState<{ x: number; y: number; station: radio_station_record } | null>(null);
  const { radio_station, radio_connecting, isPlaying: is_playing, play_radio, togglePlay: toggle_play, remoteLocked: remote_locked } = use_player();
  const { settings } = useSettings();
  const online = use_online();
  const station_param = url_params.get('station');
  const scroll_ref = useRef<HTMLDivElement>(null);
  const sentinel_ref = useRef<HTMLDivElement>(null);
  const search_offset = useRef(0);
  const browse_offset = useRef(0);
  const page_controller = useRef<AbortController | null>(null);
  const fetching_more = useRef(false);
  const page_failed = useRef(false);
  const load_more_ref = useRef<() => void>(() => {});
  const search_query = useRef<Record<string, string>>({});
  const browse_query = useRef<Record<string, string>>({});

  const genre_chips = useMemo(() => {
    const needle = chip_filter.trim().toLowerCase();
    return filters.tags
      .slice()
      .sort((a, b) => b.stationcount - a.stationcount)
      .filter(item => !needle || item.name.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [chip_filter, filters.tags]);

  const country_chips = useMemo(() => {
    const needle = chip_filter.trim().toLowerCase();
    return filters.countries
      .slice()
      .sort((a, b) => b.stationcount - a.stationcount)
      .filter(item => {
        const label = `${item.name} ${item.iso_3166_1} ${country_name(item.iso_3166_1)}`.toLowerCase();
        return !needle || label.includes(needle);
      })
      .slice(0, 80);
  }, [chip_filter, filters.countries]);

  useEffect(() => {
    const params = new URLSearchParams(url_params);
    const had_tab = params.has('tab');
    if (had_tab) params.delete('tab');
    const next_path = `/radio/${tab}`;
    const next_search = params.toString();
    if (pathname === next_path && !had_tab) return;
    navigate({ pathname: next_path, search: next_search }, { replace: true });
  }, [navigate, pathname, tab, url_params]);

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    void get_radio_filters(controller.signal).then(set_filters).catch(() => {});
    return () => controller.abort();
  }, [online]);

  useEffect(() => {
    if (tab !== 'popular' || !online) return;
    const controller = new AbortController();
    set_loading(true);
    set_error(null);
    void Promise.all([
      load_stations('popular', { limit: '18' }, controller.signal),
      load_stations('top_voted', { limit: '18' }, controller.signal),
      load_stations('recent_clicks', { limit: '18' }, controller.signal)
    ]).then(([next_popular, next_voted, next_recent]) => {
      if (controller.signal.aborted) return;
      set_popular(next_popular);
      set_top_voted(next_voted);
      set_recent(next_recent);
    }).catch(cause => {
      if (!controller.signal.aborted) set_error(cause instanceof Error ? cause.message : 'Could not load radio stations');
    }).finally(() => {
      if (!controller.signal.aborted) set_loading(false);
    });
    return () => controller.abort();
  }, [online, tab]);

  useEffect(() => {
    if (tab !== 'popular' || !online || filters.tags.length === 0) return;
    const controller = new AbortController();
    const featured = filters.tags.slice().sort((a, b) => b.stationcount - a.stationcount).slice(0, 3);
    void Promise.all(featured.map(async item => ({
      tag: item.name,
      stations: await load_stations('search', { tag: item.name, order: 'clickcount', reverse: 'true', limit: '14' }, controller.signal)
    }))).then(rows => {
      if (!controller.signal.aborted) set_genre_shelves(rows.filter(row => row.stations.length > 0));
    }).catch(() => {});
    return () => controller.abort();
  }, [filters.tags, online, tab]);

  useEffect(() => {
    if (!station_param || !online) return;
    const controller = new AbortController();
    set_detail_loading(true);
    void get_station(station_param, controller.signal).then(station => {
      if (!controller.signal.aborted) set_detail(station);
    }).catch(cause => {
      if (!controller.signal.aborted) toast.error(cause instanceof Error ? cause.message : 'Station not found');
    }).finally(() => {
      if (!controller.signal.aborted) set_detail_loading(false);
    });
    return () => controller.abort();
  }, [online, station_param]);

  function write_params(next: { tab?: radio_tab; q?: string; tag?: string; country?: string; codec?: string; bitrate?: string; https?: boolean; station?: string | null }) {
    const params = new URLSearchParams();
    const next_tab = next.tab ?? tab;
    const next_q = next.q ?? query;
    const next_tag = next.tag ?? tag;
    const next_country = next.country ?? country;
    const next_codec = next.codec ?? codec;
    const next_bitrate = next.bitrate ?? bitrate;
    const next_https = next.https ?? https_only;
    if (next_q.trim()) params.set('q', next_q.trim());
    if (next_tag) params.set('tag', next_tag);
    if (next_country) params.set('country', next_country);
    if (next_codec) params.set('codec', next_codec);
    if (next_bitrate) params.set('bitrate', next_bitrate);
    if (next_https) params.set('https', 'true');
    const station = next.station === undefined ? url_params.get('station') : next.station;
    if (station) params.set('station', station);
    navigate({ pathname: `/radio/${next_tab}`, search: params.toString() }, { replace: true });
  }

  function choose_tab(next: radio_tab) {
    set_chip_filter('');
    set_error(null);
    if (next !== 'search') {
      set_search_results([]);
      set_search_has_more(false);
    }
    if (next !== 'genres' && next !== 'countries') {
      set_browse_results([]);
      set_browse_has_more(false);
    }
    write_params({ tab: next });
  }

  function search_params(): Record<string, string> {
    return {
      ...(query.trim() ? { name: query.trim() } : {}),
      ...(tag ? { tag } : {}),
      ...(country ? { countrycode: country } : {}),
      ...(codec ? { codec } : {}),
      ...(bitrate ? { bitrateMin: bitrate } : {}),
      ...(https_only ? { is_https: 'true' } : {})
    };
  }

  function begin_page_request(): AbortSignal {
    page_controller.current?.abort();
    const controller = new AbortController();
    page_controller.current = controller;
    return controller.signal;
  }

  async function fill_search(reset: boolean, signal: AbortSignal) {
    if (reset) search_query.current = search_params();
    let offset = reset ? 0 : search_offset.current;
    let collected: radio_station_record[] = [];
    let full = true;
    for (let attempt = 0; attempt < 5 && collected.length === 0 && full; attempt++) {
      const page = await load_station_page(search_query.current, offset, signal);
      offset += PAGE_SIZE;
      collected = page.stations;
      full = page.full;
    }
    if (signal.aborted) return;
    search_offset.current = offset;
    set_search_has_more(full);
    set_search_results(current => reset ? collected : merge_stations(current, collected));
  }

  async function fill_browse(reset: boolean, params: Record<string, string>, signal: AbortSignal) {
    if (reset) browse_query.current = params;
    let offset = reset ? 0 : browse_offset.current;
    let collected: radio_station_record[] = [];
    let full = true;
    for (let attempt = 0; attempt < 5 && collected.length === 0 && full; attempt++) {
      const page = await load_station_page(browse_query.current, offset, signal);
      offset += PAGE_SIZE;
      collected = page.stations;
      full = page.full;
    }
    if (signal.aborted) return;
    browse_offset.current = offset;
    set_browse_has_more(full);
    set_browse_results(current => reset ? collected : merge_stations(current, collected));
  }

  async function run_search(event?: FormEvent) {
    event?.preventDefault();
    if (!query.trim() && !tag && !country && !codec && !bitrate && !https_only) {
      set_error('Enter a name or pick a filter');
      return;
    }
    if (!is_online()) {
      set_error('You are offline. The radio directory will reload when you connect to the internet');
      return;
    }
    write_params({ tab: 'search' });
    const signal = begin_page_request();
    set_loading(true);
    set_loading_more(false);
    page_failed.current = false;
    set_error(null);
    set_search_results([]);
    set_search_has_more(false);
    try {
      await fill_search(true, signal);
    } catch (cause) {
      if (!signal.aborted) set_error(cause instanceof Error ? cause.message : 'Could not load radio stations');
    } finally {
      if (!signal.aborted) set_loading(false);
    }
  }

  async function browse_by(kind: 'tag' | 'country', value: string) {
    if (!is_online()) {
      set_error('You are offline. The radio directory will reload when you connect to the internet');
      return;
    }
    const signal = begin_page_request();
    set_loading(true);
    set_loading_more(false);
    page_failed.current = false;
    set_error(null);
    set_browse_results([]);
    set_browse_has_more(false);
    try {
      if (kind === 'tag') {
        set_tag(value);
        write_params({ tab: 'genres', tag: value });
        await fill_browse(true, { tag: value }, signal);
      } else {
        set_country(value);
        write_params({ tab: 'countries', country: value });
        await fill_browse(true, { countrycode: value }, signal);
      }
    } catch (cause) {
      if (!signal.aborted) set_error(cause instanceof Error ? cause.message : 'Could not load radio stations');
    } finally {
      if (!signal.aborted) set_loading(false);
    }
  }

  const load_more = useCallback(() => {
    if (fetching_more.current || page_failed.current || loading || loading_more || !is_online()) return;
    const more_search = tab === 'search' && search_has_more;
    const more_browse = (tab === 'genres' || tab === 'countries') && browse_has_more;
    if (!more_search && !more_browse) return;
    const signal = page_controller.current?.signal ?? begin_page_request();
    fetching_more.current = true;
    set_loading_more(true);
    const request = more_search ? fill_search(false, signal) : fill_browse(false, browse_query.current, signal);
    void request.then(() => {
      if (!signal.aborted) page_failed.current = false;
    }).catch(cause => {
      if (signal.aborted) return;
      page_failed.current = true;
      set_error(cause instanceof Error ? cause.message : 'Could not load radio stations');
    }).finally(() => {
      fetching_more.current = false;
      if (!signal.aborted) set_loading_more(false);
    });
  }, [browse_has_more, loading, loading_more, search_has_more, tab]);
  load_more_ref.current = load_more;

  useEffect(() => {
    return () => page_controller.current?.abort();
  }, []);

  useEffect(() => {
    const sentinel = sentinel_ref.current;
    const has_more = tab === 'search' ? search_has_more : (tab === 'genres' || tab === 'countries') && browse_has_more;
    if (!sentinel || !has_more) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (!visible) {
        page_failed.current = false;
        return;
      }
      load_more_ref.current();
    }, { root: scroll_ref.current, rootMargin: '600px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [browse_has_more, browse_results.length, search_has_more, search_results.length, tab]);

  function play_station(station: radio_station_record) {
    if (radio_station?.stationuuid === station.stationuuid && (is_playing || radio_connecting)) toggle_play();
    else play_radio(station);
  }

  function open_station(station: radio_station_record) {
    set_detail(station);
    write_params({ station: station.stationuuid });
  }

  function close_detail() {
    set_detail(null);
    write_params({ station: null });
  }

  async function vote_station(station: radio_station_record) {
    if (!is_online()) {
      toast.info('Connect to the internet to vote for this station');
      return;
    }
    set_action_busy(true);
    try {
      await modify_radio(`vote/${encodeURIComponent(station.stationuuid)}`, {});
      toast.success('Vote recorded!');
      set_detail(current => current?.stationuuid === station.stationuuid ? { ...current, votes: station.votes + 1 } : current);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not vote for this station');
    } finally {
      set_action_busy(false);
    }
  }

  function station_menu_items(station: radio_station_record): ContextMenuItem[] {
    const location = radio_location(station);
    return [
      { label: 'Open station', heading: 'Station', onSelect: () => open_station(station) },
      { label: radio_station?.stationuuid === station.stationuuid && (is_playing || radio_connecting) ? 'Stop radio' : 'Play station', onSelect: () => play_station(station) },
      { label: 'Copy station name', heading: 'Copy', onSelect: () => {
        navigator.clipboard.writeText(station.name)
          .then(() => toast.success('Copied the station name'))
          .catch(() => toast.error("Couldn't copy the station name"));
      } },
      {
        ...search_menu_item(station.name, settings.searchEngine, settings.customSearchUrl),
        heading: 'Search'
      },
      search_menu_item(
        location,
        settings.searchEngine,
        settings.customSearchUrl,
        `Search location with ${searchLabel(settings.searchEngine, settings.customSearchUrl).replace(/^Search /, '')}`
      )
    ];
  }

  const homepage = detail ? radio_homepage(detail.homepage) : null;
  const dial_props = {
    radio_station,
    radio_connecting,
    is_playing,
    remote_locked,
    on_open: open_station,
    on_play: play_station,
    on_menu: (station: radio_station_record, x: number, y: number) => set_station_menu({ x, y, station })
  };

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Radio</h1>
      </div>
      <nav className="xe_page__toolbar xe_radio-tabs" aria-label="Radio sections">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            className={`xe_btn${tab === item.id ? ' xe_btn--accent' : ''}`}
            aria-pressed={tab === item.id}
            onClick={() => choose_tab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="xe_page__scroll" ref={scroll_ref}>
        {(tab === 'search' || tab === 'popular') && (
          <form className="xe_radio-hero" onSubmit={event => void run_search(event)}>
            <div className="xe_search-field xe_search-field--big">
              <SearchIcon size={16} />
              <input
                className="xe_search-input xe_search-input--big"
                type="search"
                aria-label="Station name"
                placeholder="Search stations..."
                value={query}
                maxLength={400}
                onChange={event => {
                  set_query(event.target.value);
                  write_params({ q: event.target.value });
                }}
              />
            </div>
            {tab === 'popular' && (
              <div className="xe_radio-filters">
                <button className="xe_btn xe_btn--accent" type="submit">Search</button>
              </div>
            )}
            {tab === 'search' && (
              <div className="xe_radio-filters">
                <select className="xe_sort-select" aria-label="Genre" value={tag} onChange={event => { set_tag(event.target.value); write_params({ tag: event.target.value }); }}>
                  <option value="">Any genre</option>
                  {genre_chips.map(item => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>
                <select className="xe_sort-select" aria-label="Country" value={country} onChange={event => { set_country(event.target.value); write_params({ country: event.target.value }); }}>
                  <option value="">Any country</option>
                  {country_chips.map(item => (
                    <option key={item.iso_3166_1 || item.name} value={item.iso_3166_1 || item.name}>
                      {country_name(item.iso_3166_1) || item.name}
                    </option>
                  ))}
                </select>
                <select className="xe_sort-select" aria-label="Codec" value={codec} onChange={event => { set_codec(event.target.value); write_params({ codec: event.target.value }); }}>
                  <option value="">Any codec</option>
                  {filters.codecs.slice().sort((a, b) => b.stationcount - a.stationcount).slice(0, 40).map(item => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>
                <select className="xe_sort-select" aria-label="Bitrate" value={bitrate} onChange={event => { set_bitrate(event.target.value); write_params({ bitrate: event.target.value }); }}>
                  {BITRATES.map(item => (
                    <option key={item.value || 'any'} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <label className="xe_radio-check">
                  <input type="checkbox" checked={https_only} onChange={event => { set_https_only(event.target.checked); write_params({ https: event.target.checked }); }} />
                  <span>HTTPS only</span>
                </label>
                <button className="xe_btn xe_btn--accent" type="submit">Search</button>
              </div>
            )}
          </form>
        )}

        {!online && (
          <p className="xe_empty-note" role="status">You are offline. The radio directory will reload when you connect to the internet</p>
        )}
        {loading && (
          <p className="xe_page__meta" role="status"><Spinner size={14} /> Loading stations...</p>
        )}
        {error && <p className="xe_empty-note" role="status">{error}</p>}

        {tab === 'popular' && !loading && online && (
          <>
            {popular.length > 0 && (
              <section className="xe_home-section xe_radio-shelf">
                <h2 className="xe_home-section__title">Most played</h2>
                <Station_row stations={popular} {...dial_props} />
              </section>
            )}
            {top_voted.length > 0 && (
              <section className="xe_home-section xe_radio-shelf">
                <h2 className="xe_home-section__title">Top voted</h2>
                <Station_row stations={top_voted} {...dial_props} />
              </section>
            )}
            {recent.length > 0 && (
              <section className="xe_home-section xe_radio-shelf">
                <h2 className="xe_home-section__title">Recently played</h2>
                <Station_row stations={recent} {...dial_props} />
              </section>
            )}
            {genre_shelves.map(shelf => (
              <section className="xe_home-section xe_radio-shelf" key={shelf.tag}>
                <h2 className="xe_home-section__title">{shelf.tag}</h2>
                <Station_row stations={shelf.stations} {...dial_props} />
              </section>
            ))}
          </>
        )}

        {tab === 'search' && !loading && search_results.length === 0 && !error && (
          <p className="xe_empty-note">Search by name, or narrow with genre, country, codec, and quality</p>
        )}
        {tab === 'search' && search_results.length > 0 && (
          <Station_grid
            stations={search_results}
            has_more={search_has_more}
            loading_more={loading_more}
            sentinel_ref={sentinel_ref}
            {...dial_props}
          />
        )}

        {(tab === 'genres' || tab === 'countries') && (
          <>
            <div className="xe_search-field xe_search-field--big">
              <SearchIcon size={16} />
              <input
                className="xe_search-input xe_search-input--big"
                type="search"
                aria-label={tab === 'genres' ? 'Filter genres' : 'Filter countries'}
                placeholder={tab === 'genres' ? 'Filter genres...' : 'Filter countries...'}
                value={chip_filter}
                onChange={event => set_chip_filter(event.target.value)}
              />
            </div>
            <div className="xe_radio-chips">
              {(tab === 'genres' ? genre_chips : country_chips).map(item => {
                const value = tab === 'genres' ? item.name : (item.iso_3166_1 || item.name);
                const selected = tab === 'genres' ? tag === item.name : country === value;
                return (
                  <button
                    key={`${item.name}:${item.iso_3166_1}`}
                    type="button"
                    className={`xe_radio-chip${selected ? ' xe_radio-chip--on' : ''}`}
                    onClick={() => void browse_by(tab === 'genres' ? 'tag' : 'country', value)}
                  >
                    {tab === 'countries' && <Country_flag code={item.iso_3166_1} />}
                    {tab === 'genres' ? item.name : (country_name(item.iso_3166_1) || item.name)}
                    <span>{item.stationcount}</span>
                  </button>
                );
              })}
            </div>
            {browse_results.length > 0 && (
              <Station_grid
                stations={browse_results}
                has_more={browse_has_more}
                loading_more={loading_more}
                sentinel_ref={sentinel_ref}
                {...dial_props}
              />
            )}
          </>
        )}
      </div>

      {station_menu && (
        <ContextMenu
          x={station_menu.x}
          y={station_menu.y}
          items={station_menu_items(station_menu.station)}
          onClose={() => set_station_menu(null)}
        />
      )}

      {(detail || detail_loading) && (
        <Modal title={detail?.name ?? 'Radio station'} wide onClose={close_detail}>
          {detail_loading && <p role="status"><Spinner /> Loading station...</p>}
          {detail && (
            <div className="xe_radio-sheet">
              <div className="xe_radio-sheet__top">
                <div className="xe_radio-sheet__art">
                  <Station_art station={detail} size={36} />
                </div>
                <div className="xe_radio-sheet__copy">
                  <h3>{detail.name}</h3>
                  <p>
                    <Country_flag code={detail.countrycode} />
                    {[radio_location(detail), detail.language].filter(Boolean).join(', ') || 'Radio station'}
                  </p>
                </div>
              </div>
              <div className="xe_radio-sheet__quality">
                {detail.codec && <span>{detail.codec}</span>}
                {detail.bitrate > 0 && <span>{detail.bitrate} kbps</span>}
                {detail.hls ? <span>HLS</span> : null}
                <span>{detail.votes} votes</span>
              </div>
              {station_tags(detail).length > 0 && (
                <div className="xe_radio-sheet__tags">
                  {station_tags(detail).map(item => <span key={item}>{item}</span>)}
                </div>
              )}
              <div className="xe_page__toolbar">
                <button
                  className="xe_btn xe_btn--accent"
                  disabled={remote_locked || !!stream_issue(detail)}
                  onClick={() => play_station(detail)}
                >
                  {radio_station?.stationuuid === detail.stationuuid && (is_playing || radio_connecting) ? 'Stop radio' : 'Play station'}
                </button>
                <button className="xe_btn" disabled={action_busy} onClick={() => void vote_station(detail)}>
                  {action_busy ? 'Sending vote...' : 'Vote'}
                </button>
                {homepage && (
                  <a className="xe_btn" href={homepage} target="_blank" rel="noreferrer">Homepage</a>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
