import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  browse_radio, get_radio_filters, get_station, modify_radio, normalize_station,
  radio_export_url, stream_issue, type radio_filters, type radio_station_record
} from '../api/radio_browser';
import { RADIO_ADD_FIELDS, RADIO_RESOURCES, radio_resource_defaults, type radio_field } from '../utils/radio_catalog';
import { usePlayer as use_player } from '../src/context/player';
import { useSettings } from '../context/settings_context';
import { usePageTitle as use_page_title } from '../hooks/page_title';
import { InfoIcon, PauseIcon, PlayIcon, SearchIcon } from '../components/icons';
import { ContextMenu, type ContextMenuItem } from '../components/context_menu';
import { FloatingInput } from '../components/floating_input';
import { Modal } from '../components/modal';
import { Radio_filter_modal } from '../components/radio_filter_modal';
import { Spinner } from '../components/spinner';
import { openSearch, searchLabel } from '../utils/search_engine';
import { radio_homepage, radio_location } from '../utils/radio_station';
import { toast } from '../utils/toast';

const EMPTY_FILTERS: radio_filters = { countries: [], languages: [], tags: [], codecs: [] };
const GROUPS = ['Stations', 'Directory', 'Activity', 'Server', 'Add station'];

function record_of(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function display_value(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function safe_link(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function Radio_field({ field, value, on_change }: { field: radio_field; value: string; on_change(value: string): void }) {
  const lists: Record<string, string> = { countrycode: 'radio_countries', language: 'radio_languages', tag: 'radio_tags', codec: 'radio_codecs' };
  if (field.type !== 'boolean' && field.type !== 'select') {
    return <FloatingInput label={`${field.label}${field.required ? ' *' : ''}`} type={field.type ?? 'text'} value={value}
      onChange={event => on_change(event.target.value)} list={lists[field.key]} required={field.required}
      min={field.min} max={field.max} step={field.key.startsWith('geo_') ? 'any' : 1}
      maxLength={field.key === 'name' ? 400 : 4000} />;
  }
  return (
    <label>
      <span className="xe_page__meta">{field.label}{field.required ? ' *' : ''}</span>
      <br />
      <select className="xe_sort-select" value={value} onChange={event => on_change(event.target.value)} required={field.required}>
        <option value="">{field.type === 'boolean' ? 'Any' : 'Default'}</option>
        {(field.type === 'boolean' ? ['true', 'false'] : field.choices ?? []).map(choice => (
          <option value={choice} key={choice}>{choice === 'true' ? 'Yes' : choice === 'false' ? 'No' : choice.replaceAll('_', ' ')}</option>
        ))}
      </select>
    </label>
  );
}

function Radio_record({ record }: { record: Record<string, unknown> }) {
  return (
    <dl>
      {Object.entries(record).map(([key, value]) => {
        const link = ['homepage', 'url', 'url_resolved', 'favicon', 'statusurl'].includes(key) ? safe_link(value) : null;
        return (
          <div key={key}>
            <dt className="xe_page__meta">{key.replaceAll('_', ' ')}</dt>
            <dd>{link ? <a href={link} target="_blank" rel="noreferrer">{link}</a> : <span>{display_value(value)}</span>}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Radio_station_info({ station }: { station: radio_station_record }) {
  const homepage = radio_homepage(station.homepage);
  const groups = [
    {
      title: 'Station',
      values: [
        ['Location', radio_location(station)],
        ['Language', station.language],
        ['Tags', station.tags],
        ['Station UUID', station.stationuuid]
      ]
    },
    {
      title: 'Stream',
      values: [
        ['Format', [station.codec, station.bitrate > 0 ? `${station.bitrate} kbps` : '', station.hls ? 'HLS' : ''].filter(Boolean).join(', ')],
        ['Homepage', homepage],
        ['Resolved stream', station.url_resolved]
      ]
    },
    {
      title: 'Community',
      values: [
        ['Votes', station.votes],
        ['Listens in the last day', station.clickcount],
        ['Listening trend', station.clicktrend]
      ]
    },
    {
      title: 'Availability',
      values: [
        ['Last check', station.lastchecktime_iso8601],
        ['Status', station.lastcheckok ? 'Online at the last check' : 'Unavailable at the last check'],
        ['Last changed', station.lastchangetime_iso8601]
      ]
    }
  ];
  return (
    <div className="xe_lrclib-search__result-list">
      {groups.map(group => <section className="xe_lrclib-search__result" key={group.title}>
        <div className="xe_lrclib-search__result-main">
          <div className="xe_lrclib-search__result-heading"><h3>{group.title}</h3></div>
          <dl>
            {group.values.filter(([, value]) => value !== '').map(([label, value]) => <div key={label}>
              <dt className="xe_page__meta">{label}</dt>
              <dd>{typeof value === 'string' && (label === 'Homepage' || label === 'Resolved stream') ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : display_value(value)}</dd>
            </div>)}
          </dl>
        </div>
      </section>)}
    </div>
  );
}

export function Radio_page() {
  use_page_title('Radio');
  const [url_params, set_url_params] = useSearchParams();
  const initial_resource = RADIO_RESOURCES.find(item => item.key === url_params.get('list')) ?? RADIO_RESOURCES.find(item => item.key === 'popular')!;
  const [resource_key, set_resource_key] = useState(initial_resource.key);
  const resource = RADIO_RESOURCES.find(item => item.key === resource_key) ?? initial_resource;
  const [draft, set_draft] = useState<Record<string, string>>(() => ({ ...radio_resource_defaults(initial_resource), ...Object.fromEntries(initial_resource.fields.filter(field => url_params.has(field.key)).map(field => [field.key, url_params.get(field.key)!])) }));
  const [applied, set_applied] = useState(draft);
  const [data, set_data] = useState<unknown>(null);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [refresh, set_refresh] = useState(0);
  const [display_page, set_display_page] = useState(0);
  const [filters, set_filters] = useState<radio_filters>(EMPTY_FILTERS);
  const [filter_error, set_filter_error] = useState(false);
  const [detail, set_detail] = useState<Record<string, unknown> | null>(null);
  const [detail_loading, set_detail_loading] = useState(false);
  const [detail_uuid, set_detail_uuid] = useState(url_params.get('station') ?? '');
  const [action_busy, set_action_busy] = useState(false);
  const [add_values, set_add_values] = useState<Record<string, string>>({});
  const [added_uuid, set_added_uuid] = useState('');
  const [export_format, set_export_format] = useState('json');
  const [filter_modal, set_filter_modal] = useState(false);
  const [station_menu, set_station_menu] = useState<{ x: number; y: number; station: radio_station_record } | null>(null);
  const { radio_station, radio_connecting, isPlaying: is_playing, play_radio, togglePlay: toggle_play, remoteLocked: remote_locked } = use_player();
  const { settings } = useSettings();
  const adding = resource_key === 'add';
  const group = adding ? 'Add station' : resource.group;
  const missing_required = resource.fields.some(field => field.required && !applied[field.key]?.trim());
  const station_rows = resource.kind === 'stations';
  const raw_rows = useMemo(() => Array.isArray(data) ? data.map(record_of).filter((item): item is Record<string, unknown> => item !== null) : [], [data]);
  const rows = useMemo(() => {
    if (!station_rows || applied.hide_unplayable !== 'true') return raw_rows;
    return raw_rows.filter(record => {
      const station = normalize_station(record);
      return !station || !stream_issue(station);
    });
  }, [applied.hide_unplayable, raw_rows, station_rows]);
  const detail_station = detail ? normalize_station(detail) : null;
  const primary_field = resource.fields.find(field => ['name', 'filter', 'url', 'uuids', 'stationuuid'].includes(field.key));
  const can_offset = resource.fields.some(field => field.key === 'offset');
  const page_size = Number(applied.limit) || 50;
  const offset = Number(applied.offset) || 0;
  const last_record = raw_rows.at(-1);
  const cursor_key = resource.cursor?.replace(/^last/, '');
  const next_cursor = cursor_key && last_record ? last_record[cursor_key] : null;
  const more_server = can_offset ? raw_rows.length >= page_size : !!next_cursor && next_cursor !== applied[resource.cursor!];
  const visible_rows = rows.slice(display_page * 50, (display_page + 1) * 50);

  useEffect(() => {
    const controller = new AbortController();
    void get_radio_filters(controller.signal).then(set_filters).catch(() => {
      if (!controller.signal.aborted) set_filter_error(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (adding || missing_required) {
      set_data(null);
      set_error(null);
      set_loading(false);
      return;
    }
    const controller = new AbortController();
    set_loading(true);
    set_error(null);
    set_data(null);
    set_display_page(0);
    void browse_radio(resource.key, applied, controller.signal).then(result => {
      if (!controller.signal.aborted) set_data(result);
    }).catch(cause => {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : 'Could not load radio stations';
        set_error(message);
        toast.error(message);
      }
    }).finally(() => {
      if (!controller.signal.aborted) set_loading(false);
    });
    return () => controller.abort();
  }, [resource.key, applied, refresh, adding, missing_required]);

  useEffect(() => {
    if (!detail_uuid) return;
    const controller = new AbortController();
    set_detail_loading(true);
    void get_station(detail_uuid, controller.signal).then(station => {
      if (!controller.signal.aborted) {
        set_detail({ ...station });
        const issue = stream_issue(station);
        if (issue) toast.warning(issue);
      }
    }).catch(cause => {
      if (!controller.signal.aborted) {
        toast.error(cause instanceof Error ? cause.message : 'Station not found');
        set_detail_uuid('');
      }
    }).finally(() => {
      if (!controller.signal.aborted) set_detail_loading(false);
    });
    return () => controller.abort();
  }, [detail_uuid]);

  function choose_resource(key: string, values?: Record<string, string>) {
    const next = RADIO_RESOURCES.find(item => item.key === key);
    set_resource_key(key);
    if (!next) return;
    const params = { ...radio_resource_defaults(next), ...values };
    set_draft(params);
    set_applied(params);
    set_export_format(next.formats[0]);
    set_url_params({ list: key, ...params }, { replace: true });
  }

  function submit_search(event: FormEvent) {
    event.preventDefault();
    if (station_rows && !primary_field && draft.name?.trim()) {
      choose_resource('search', { name: draft.name.trim() });
      return;
    }
    set_applied({ ...draft });
    set_url_params({ list: resource.key, ...draft }, { replace: true });
    set_refresh(value => value + 1);
  }

  function change_page(next: number) {
    const params = { ...applied, offset: String(Math.max(0, next)) };
    set_draft(params);
    set_applied(params);
    set_url_params({ list: resource.key, ...params }, { replace: true });
  }

  function continue_records() {
    if (!resource.cursor || typeof next_cursor !== 'string') return;
    const params = { ...applied, [resource.cursor]: next_cursor };
    set_draft(params);
    set_applied(params);
  }

  function show_detail(record: Record<string, unknown>) {
    const station = normalize_station(record);
    set_detail_uuid('');
    set_detail(record);
    set_detail_loading(false);
    const issue = station && stream_issue(station);
    if (issue) toast.warning(issue);
  }

  function close_detail() {
    set_detail_uuid('');
    set_detail(null);
    const params = new URLSearchParams(url_params);
    params.delete('station');
    set_url_params(params, { replace: true });
  }

  function open_station(uuid: string) {
    set_detail(null);
    set_detail_uuid(uuid);
  }

  function play_station(station: radio_station_record) {
    if (radio_station?.stationuuid === station.stationuuid && (is_playing || radio_connecting)) toggle_play();
    else play_radio(station);
  }

  function copy_station(value: string, label: string) {
    navigator.clipboard.writeText(value)
      .then(() => toast.success(`Copied the station ${label}`))
      .catch(() => toast.error(`Couldn't copy the station ${label}`));
  }

  function station_menu_items(station: radio_station_record): ContextMenuItem[] {
    const location = radio_location(station);
    return [
      { label: 'Open station info', heading: 'Station', onSelect: () => show_detail({ ...station }) },
      { label: 'Copy station name', heading: 'Copy', onSelect: () => copy_station(station.name, 'name') },
      { label: 'Copy station location', onSelect: () => copy_station(location, 'location') },
      {
        label: searchLabel(settings.searchEngine, settings.customSearchUrl),
        heading: 'Search',
        onSelect: () => openSearch(station.name, settings.searchEngine, settings.customSearchUrl)
      },
      {
        label: `Search location with ${searchLabel(settings.searchEngine, settings.customSearchUrl).replace(/^Search /, '')}`,
        onSelect: () => openSearch(location, settings.searchEngine, settings.customSearchUrl)
      }
    ];
  }

  function apply_filters(values: Record<string, string>) {
    set_filter_modal(false);
    set_draft(values);
    set_applied(values);
    set_url_params({ list: resource.key, ...values }, { replace: true });
    set_refresh(value => value + 1);
  }

  async function vote_station(station: radio_station_record) {
    set_action_busy(true);
    try {
      await modify_radio(`vote/${encodeURIComponent(station.stationuuid)}`, {});
      toast.success('Vote recorded');
      set_detail(value => value?.stationuuid === station.stationuuid ? { ...value, votes: station.votes + 1 } : value);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not vote for this station');
    } finally {
      set_action_busy(false);
    }
  }

  async function add_station(event: FormEvent) {
    event.preventDefault();
    set_action_busy(true);
    set_added_uuid('');
    try {
      const result = await modify_radio('add', add_values);
      toast.success('Station submitted to Radio Browser!');
      if (typeof result.uuid === 'string') set_added_uuid(result.uuid);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'could not submit this station');
    } finally {
      set_action_busy(false);
    }
  }

  async function copy_station_link(station: radio_station_record) {
    try {
      const url = new URL('/radio', window.location.origin);
      url.searchParams.set('station', station.stationuuid);
      await navigator.clipboard.writeText(url.href);
      toast.success('Station link copied');
    } catch {
      toast.error('could not copy the station link');
    }
  }

  return (
    <div className="xe_page">
      <div className="xe_page__toolbar">
        <h1 className="xe_page__title">Radio</h1>
        {radio_station && <button className="xe_btn" onClick={() => show_detail({ ...radio_station })}>Current station</button>}
        <a className="xe_page__meta" href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">Open Radio Browser</a>
      </div>
      <nav className="xe_page__toolbar" aria-label="Radio sections">
        {GROUPS.map(name => <button key={name} className={`xe_btn${group === name ? ' xe_btn--accent' : ''}`} aria-pressed={group === name}
          onClick={() => choose_resource(name === 'Add station' ? 'add' : name === 'Stations' ? 'popular' : RADIO_RESOURCES.find(item => item.group === name)!.key)}>{name}</button>)}
      </nav>
      <div className="xe_page__scroll">
        {adding ? (
          <form onSubmit={add_station}>
            <p className="xe_page__meta">Submit a station to the public Radio Browser directory</p>
            <div className="xe_page__toolbar">
              {RADIO_ADD_FIELDS.map(field => <Radio_field key={field.key} field={field} value={add_values[field.key] ?? ''}
                on_change={value => set_add_values(current => ({ ...current, [field.key]: value }))} />)}
            </div>
            <button className="xe_btn xe_btn--accent" disabled={action_busy} type="submit">{action_busy ? 'Submitting' : 'Submit station'}</button>
            {added_uuid && <button className="xe_btn" type="button" onClick={() => open_station(added_uuid)}>Open submitted station</button>}
          </form>
        ) : (
          <>
            <div className="xe_page__toolbar">
              <select className="xe_sort-select" aria-label="Radio list" value={resource.key} onChange={event => choose_resource(event.target.value)}>
                {RADIO_RESOURCES.filter(item => item.group === group).map(item => <option value={item.key} key={item.key}>{item.label}</option>)}
              </select>
              <select className="xe_sort-select" aria-label="Export format" value={export_format} onChange={event => set_export_format(event.target.value)}>
                {resource.formats.map(format => <option key={format} value={format}>{format.toUpperCase()}</option>)}
              </select>
              {!missing_required && <a className="xe_btn" href={radio_export_url(resource.key, applied, export_format)} download>Export</a>}
            </div>
            <form onSubmit={submit_search}>
              <div className="xe_page__toolbar">
                {!primary_field && station_rows && <div className="xe_search-field xe_search-field--big">
                  <SearchIcon size={16} />
                  <input className="xe_search-input xe_search-input--big" type="search" aria-label="Station name"
                    placeholder="Search stations" value={draft.name ?? ''} maxLength={400}
                    onChange={event => set_draft(current => ({ ...current, name: event.target.value }))} />
                </div>}
                {primary_field && (primary_field.key === 'name' || primary_field.key === 'filter' ? (
                  <div className="xe_search-field xe_search-field--big">
                    <SearchIcon size={16} />
                    <input className="xe_search-input xe_search-input--big" type="search" aria-label={primary_field.label}
                      placeholder={primary_field.label} value={draft[primary_field.key] ?? ''} maxLength={400}
                      onChange={event => set_draft(current => ({ ...current, [primary_field.key]: event.target.value, offset: '0' }))} />
                  </div>
                ) : <Radio_field field={primary_field} value={draft[primary_field.key] ?? ''} on_change={value => set_draft(current => ({ ...current, [primary_field.key]: value }))} />)}
                <button className="xe_btn" type="submit">{primary_field || draft.name?.trim() ? 'Search' : 'Refresh'}</button>
                {resource.fields.length > 0 && <button className="xe_btn" type="button" onClick={() => set_filter_modal(true)}>Filters and ordering</button>}
                {resource.fields.length > 0 && <button className="xe_btn xe_btn--quiet" type="button" onClick={() => choose_resource(resource.key)}>Reset</button>}
              </div>
            </form>
            <p className="xe_page__meta" role="status">
              {loading ? <><Spinner size={14} /> Loading {resource.label.toLowerCase()}...</> : missing_required ? 'Enter the required fields to search' :
                error ? '' : Array.isArray(data) ? `${rows.length} results${offset ? ` from offset ${offset}` : ''}` : data === null ? '' : resource.label}
            </p>
            {!loading && !error && Array.isArray(data) && rows.length === 0 && <p className="xe_empty-note">No results...</p>}
            {rows.length > 0 && <div className="xe_track-table" aria-busy={loading}>
              <div className="xe_track-table__row xe_track-table__row--head">
                <span />
                <span>{station_rows ? 'Station' : 'Name or identifier'}</span>
                <span>{station_rows ? 'Location' : resource.kind === 'directory' ? 'Country' : 'Time or address'}</span>
                <span>{station_rows ? 'Stream' : 'Status or count'}</span>
                <span>{station_rows ? 'Votes' : ''}</span><span>Details</span>
              </div>
              {visible_rows.map((record, index) => {
                const station = station_rows ? normalize_station(record) : null;
                const selected = !!station && radio_station?.stationuuid === station.stationuuid;
                const active = selected && (is_playing || radio_connecting);
                const issue = station ? stream_issue(station) : null;
                const name = station?.name ?? display_value(record.name ?? record.stationuuid ?? record.uuid ?? record.stepuuid ?? record.url);
                return <div className={`xe_track-table__row${selected ? ' xe_track-table__row--active' : ''}`} key={`${String(record.stationuuid ?? record.name ?? '')}:${index}`}
                  onDoubleClick={event => { if (!(event.target as HTMLElement).closest('button') && station && !issue && !remote_locked) play_radio(station); }}
                  onContextMenu={event => {
                    if (!station) return;
                    event.preventDefault();
                    set_station_menu({ x: event.clientX, y: event.clientY, station });
                  }}>
                  {station ? <button className="xe_mini-btn" disabled={remote_locked || !!issue} title={issue ?? (active ? 'Stop radio' : 'Play station')}
                    aria-label={`${active ? 'Stop' : 'Play'} ${station.name}`} onClick={() => play_station(station)}>{active ? <PauseIcon size={13} /> : <PlayIcon size={13} />}</button> : <span>{offset + display_page * 50 + index + 1}</span>}
                  <span className="xe_track-table__cell xe_track-table__cell--title" title={issue ?? name}>{name}</span>
                  <span className="xe_track-table__cell">{station ? [station.countrycode, station.state].filter(Boolean).join(', ') || '-' : display_value(record.country ?? record.ip ?? record.timestamp_iso8601 ?? record.clicktimestamp_iso8601 ?? record.url)}</span>
                  <span className="xe_track-table__cell">{station ? [station.codec, station.bitrate ? `${station.bitrate} kbps` : '', station.hls ? 'HLS' : ''].filter(Boolean).join(', ') : display_value(record.stationcount ?? record.ok ?? record.error ?? record.software)}</span>
                  <span className="xe_track-table__cell xe_track-table__cell--dur">{station ? station.votes : ''}</span>
                  <button className="xe_mini-btn" title={`Details for ${name}`} aria-label={`Details for ${name}`} onClick={() => show_detail(record)}><InfoIcon size={16} /></button>
                </div>;
              })}
            </div>}
            {data !== null && !Array.isArray(data) && (typeof data === 'string' ? <pre>{data}</pre> : record_of(data) ? <Radio_record record={record_of(data)!} /> : <p>{display_value(data)}</p>)}
            {rows.length > 0 && <div className="xe_page__toolbar">
              {rows.length > 50 && <>
                <button className="xe_btn" disabled={display_page === 0} onClick={() => set_display_page(value => value - 1)}>Previous rows</button>
                <span className="xe_page__meta">{display_page * 50 + 1} to {Math.min(rows.length, (display_page + 1) * 50)}</span>
                <button className="xe_btn" disabled={(display_page + 1) * 50 >= rows.length} onClick={() => set_display_page(value => value + 1)}>Next rows</button>
              </>}
              {can_offset && <>
                <button className="xe_btn" disabled={loading || offset === 0} onClick={() => change_page(offset - page_size)}>Previous page</button>
                <button className="xe_btn" disabled={loading || !more_server || offset + page_size > 100000} onClick={() => change_page(offset + page_size)}>Next page</button>
              </>}
              {!can_offset && resource.cursor && <button className="xe_btn" disabled={loading || !more_server} onClick={continue_records}>Continue after these records</button>}
            </div>}
            {!loading && !error && rows.length === 0 && can_offset && offset > 0 && <button className="xe_btn" onClick={() => change_page(offset - page_size)}>Previous page</button>}
          </>
        )}
      </div>
      {Object.entries(filters).map(([key, values]) => <datalist key={key} id={`radio_${key}`}>
        {values.map((item, index) => <option key={`${item.name}:${index}`} value={key === 'countries' ? item.iso_3166_1 || item.name : item.name}>{item.name} ({item.stationcount})</option>)}
      </datalist>)}
      {filter_modal && <Radio_filter_modal resource={resource} values={draft} suggestions_unavailable={filter_error}
        on_apply={apply_filters} on_close={() => set_filter_modal(false)} />}
      {station_menu && <ContextMenu x={station_menu.x} y={station_menu.y} items={station_menu_items(station_menu.station)} onClose={() => set_station_menu(null)} />}
      {(detail || detail_loading) && <Modal title={detail_station?.name ?? 'Radio details'} wide onClose={close_detail}>
        {detail_loading && <p role="status"><Spinner /> Loading station...</p>}
        {detail_station && <>
          <section className="xe_lrclib-search__result" style={{ marginBottom: 12 }}>
            <div className="xe_lrclib-search__result-main">
              <div className="xe_lrclib-search__result-heading">
                <div>
                  <h3>{detail_station.name}</h3>
                  <p>{[radio_location(detail_station), detail_station.language].filter(Boolean).join(', ') || 'Radio station'}</p>
                </div>
                <div className="xe_lrclib-search__metadata">
                  {detail_station.codec && <span>{detail_station.codec}</span>}
                  {detail_station.bitrate > 0 && <span>{detail_station.bitrate} kbps</span>}
                  <span>{detail_station.lastcheckok ? 'Online' : 'Last check failed'}</span>
                </div>
              </div>
            </div>
          </section>
          <div className="xe_page__toolbar">
            <button className="xe_btn xe_btn--accent" disabled={remote_locked || !!stream_issue(detail_station)} onClick={() => play_station(detail_station)}>
              {radio_station?.stationuuid === detail_station.stationuuid && (is_playing || radio_connecting) ? 'Stop radio' : 'Play station'}
            </button>
            <button className="xe_btn" disabled={action_busy} onClick={() => void vote_station(detail_station)}>{action_busy ? 'Sending vote...' : 'Vote for station'}</button>
            <button className="xe_btn" onClick={() => void copy_station_link(detail_station)}>Copy station link</button>
          </div>
          <div className="xe_page__toolbar">
            {['checks', 'clicks', 'check_steps', 'versions'].map(key => <button className="xe_btn" key={key} onClick={() => {
              choose_resource(key, { [key === 'check_steps' ? 'uuids' : 'stationuuid']: detail_station.stationuuid });
              set_detail(null); set_detail_uuid('');
            }}>{RADIO_RESOURCES.find(item => item.key === key)!.label}</button>)}
          </div>
        </>}
        {!detail_station && typeof detail?.stationuuid === 'string' && <button className="xe_btn" onClick={() => open_station(String(detail?.stationuuid))}>Open station</button>}
        {detail_station ? <Radio_station_info station={detail_station} /> : detail && <Radio_record record={detail} />}
      </Modal>}
    </div>
  );
}
