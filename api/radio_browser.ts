export interface radio_station_record {
  stationuuid: string;
  name: string;
  url_resolved: string;
  countrycode: string;
  state: string;
  language: string;
  codec: string;
  bitrate: number;
  hls: number;
  homepage: string;
  favicon: string;
  tags: string;
  votes: number;
  clickcount: number;
  clicktrend: number;
  lastcheckok: number;
  lastchecktime_iso8601: string;
  lastchangetime_iso8601: string;
}

export interface radio_list_item {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export type radio_filters = Record<'countries' | 'languages' | 'tags' | 'codecs', radio_list_item[]>;

const BASE = '/i/services/radio';

export function normalize_station(value: unknown): radio_station_record | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.stationuuid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.stationuuid) ||
      typeof raw.name !== 'string') return null;
  const string_value = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : '';
  const number_value = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] as number : 0;
  return {
    ...raw,
    stationuuid: raw.stationuuid, name: raw.name,
    url_resolved: string_value('url_resolved'), countrycode: string_value('countrycode'),
    state: string_value('state'), language: string_value('language'), codec: string_value('codec'),
    bitrate: number_value('bitrate'), hls: number_value('hls'), homepage: string_value('homepage'), favicon: string_value('favicon'),
    tags: string_value('tags'), votes: number_value('votes'), clickcount: number_value('clickcount'),
    clicktrend: number_value('clicktrend'), lastcheckok: number_value('lastcheckok'),
    lastchecktime_iso8601: string_value('lastchecktime_iso8601'),
    lastchangetime_iso8601: string_value('lastchangetime_iso8601')
  };
}

async function request_json(path: string, signal?: AbortSignal, body?: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, { signal, ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Could not load the radio directory, please try again');
  }
  if (!response.ok) {
    throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : 'Could not load the radio directory, please try again');
  }
  return data;
}

export async function get_station(uuid: string, signal: AbortSignal): Promise<radio_station_record> {
  const station = normalize_station(await request_json(`/station/${encodeURIComponent(uuid)}`, signal));
  if (!station) throw new Error('Station not found');
  return station;
}

export async function get_radio_filters(signal: AbortSignal): Promise<radio_filters> {
  const data = await request_json('/filters', signal);
  if (!data || typeof data !== 'object') throw new Error('Could not load filter suggestions');
  const read_list = (key: string): radio_list_item[] => {
    const list = (data as Record<string, unknown>)[key];
    if (!Array.isArray(list)) return [];
    return list.filter(item => item && typeof item.name === 'string').map(item => ({
      name: item.name, iso_3166_1: typeof item.iso_3166_1 === 'string' ? item.iso_3166_1 : '',
      stationcount: typeof item.stationcount === 'number' ? item.stationcount : 0
    }));
  };
  return { countries: read_list('countries'), languages: read_list('languages'), tags: read_list('tags'), codecs: read_list('codecs') };
}

export function stream_issue(station: radio_station_record): string | null {
  if (station.hls) return 'HLS stations are not supported yet';
  try {
    if (!['http:', 'https:'].includes(new URL(station.url_resolved).protocol)) throw new Error();
  } catch { return 'This station has no valid stream URL'; }
  return null;
}

export function station_stream_url(station: radio_station_record): string {
  return `${BASE}/stream/${encodeURIComponent(station.stationuuid)}`;
}

export function report_station_play(uuid: string): void {
  void fetch(`${BASE}/click/${encodeURIComponent(uuid)}`, { method: 'POST' }).catch(() => {});
}

export async function browse_radio(resource: string, params: Record<string, string>, signal: AbortSignal): Promise<unknown> {
  const query = new URLSearchParams(params);
  const path = `/browse/${encodeURIComponent(resource)}?${query}`;
  if (resource !== 'metrics') return request_json(path, signal);
  const response = await fetch(`${BASE}${path}`, { signal });
  if (!response.ok) throw new Error('Could not load server metrics');
  return response.text();
}

export function radio_export_url(resource: string, params: Record<string, string>, format: string): string {
  return `${BASE}/browse/${encodeURIComponent(resource)}?${new URLSearchParams({ ...params, format, download: '1' })}`;
}

export async function modify_radio(action: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const data = await request_json(`/${action}`, undefined, body);
  if (!data || typeof data !== 'object' || !('ok' in data) || (data.ok !== true && data.ok !== 'true')) {
    throw new Error(data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message.replace(/[.\u2026]+$/, '') : 'radio browser did not accept the request');
  }
  return data as Record<string, unknown>;
}

export function station_artwork_url(station: radio_station_record): string {
  return `${BASE}/artwork/${encodeURIComponent(station.stationuuid)}`;
}
