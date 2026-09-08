export interface radio_field {
  key: string;
  label: string;
  type?: 'number' | 'url' | 'boolean' | 'select';
  choices?: readonly string[];
  required?: boolean;
  min?: number;
  max?: number;
}

export interface radio_resource {
  key: string;
  label: string;
  group: string;
  path: string;
  kind: 'stations' | 'directory' | 'records' | 'server';
  fields: radio_field[];
  formats: readonly string[];
  defaults?: Record<string, string>;
  station_path?: boolean;
  filter_path?: boolean;
  cursor?: string;
}

const station_formats = ['json', 'xml', 'csv', 'm3u', 'pls', 'xspf', 'ttl'];
const record_formats = ['json', 'xml', 'csv'];
const paging: radio_field[] = [
  { key: 'limit', label: 'Results per request', type: 'number', min: 1, max: 200 },
  { key: 'offset', label: 'Offset', type: 'number', min: 0, max: 100000 }
];
const hide_broken: radio_field = { key: 'hidebroken', label: 'Hide broken stations', type: 'boolean' };
const hide_unplayable: radio_field = { key: 'hide_unplayable', label: 'Hide unplayable streams', type: 'boolean' };
const reverse: radio_field = { key: 'reverse', label: 'Descending order', type: 'boolean' };
const station_uuid: radio_field = { key: 'stationuuid', label: 'Station UUID' };
const uuids: radio_field = { key: 'uuids', label: 'Station UUIDs separated by commas', required: true };
const station_order: radio_field = {
  key: 'order', label: 'Sort by', type: 'select', choices: [
    'name', 'url', 'homepage', 'favicon', 'tags', 'country', 'state', 'language', 'votes',
    'codec', 'bitrate', 'lastcheckok', 'lastchecktime', 'clicktimestamp', 'clickcount',
    'clicktrend', 'changetimestamp', 'random'
  ]
};
const search_fields: radio_field[] = [
  { key: 'name', label: 'Station name' },
  { key: 'countrycode', label: 'Country code' },
  { key: 'country', label: 'Country name' },
  { key: 'state', label: 'State or region' },
  { key: 'language', label: 'Language' },
  { key: 'tag', label: 'Tag or genre' },
  { key: 'tagList', label: 'All of these tags separated by commas' },
  { key: 'codec', label: 'Codec' },
  { key: 'bitrateMin', label: 'Minimum bitrate in kbps', type: 'number', min: 0, max: 1000000 },
  { key: 'bitrateMax', label: 'Maximum bitrate in kbps', type: 'number', min: 0, max: 1000000 },
  ...['name', 'country', 'state', 'language', 'tag'].map(key => ({ key: `${key}Exact`, label: `Exact ${key}`, type: 'boolean' as const })),
  { key: 'is_https', label: 'HTTPS stream', type: 'boolean' },
  { key: 'has_geo_info', label: 'Has location', type: 'boolean' },
  { key: 'has_extended_info', label: 'Has extended information', type: 'boolean' },
  { key: 'geo_lat', label: 'Latitude', type: 'number', min: -90, max: 90 },
  { key: 'geo_long', label: 'Longitude', type: 'number', min: -180, max: 180 },
  { key: 'geo_distance', label: 'Distance in metres', type: 'number', min: 0, max: 40075000 },
  station_order, reverse, hide_broken, hide_unplayable, ...paging
];
const directory_fields: radio_field[] = [
  { key: 'filter', label: 'Filter names' },
  { key: 'order', label: 'Sort by', type: 'select', choices: ['name', 'stationcount'] },
  reverse, hide_broken, ...paging
];

export const RADIO_RESOURCES: radio_resource[] = [
  { key: 'search', label: 'Advanced search', group: 'Stations', path: 'stations/search', kind: 'stations', fields: search_fields, formats: station_formats, defaults: { order: 'clickcount', reverse: 'true', hidebroken: 'true' } },
  { key: 'all', label: 'All stations', group: 'Stations', path: 'stations', kind: 'stations', fields: [station_order, reverse, hide_broken, hide_unplayable, ...paging], formats: station_formats },
  ...[
    ['popular', 'Most played', 'topclick'], ['top_voted', 'Top voted', 'topvote'],
    ['recent_clicks', 'Recently played', 'lastclick'], ['recent_changes', 'Recently added or changed', 'lastchange'],
    ['broken', 'Broken stations', 'broken']
  ].map(([key, label, path]): radio_resource => ({ key, label, group: 'Stations', path: `stations/${path}`, kind: 'stations', fields: [...(key === 'broken' ? [] : [hide_broken]), hide_unplayable, ...paging], formats: station_formats })),
  { key: 'by_uuid', label: 'Find by UUID', group: 'Stations', path: 'stations/byuuid', kind: 'stations', fields: [uuids, hide_unplayable], formats: station_formats },
  { key: 'by_url', label: 'Find by stream URL', group: 'Stations', path: 'stations/byurl', kind: 'stations', fields: [{ key: 'url', label: 'Stream URL', type: 'url', required: true }, hide_unplayable], formats: station_formats },
  ...[
    ['countries', 'Countries'], ['countrycodes', 'Country codes (legacy)'], ['states', 'States and regions'],
    ['languages', 'Languages'], ['tags', 'Tags and genres'], ['codecs', 'Codecs']
  ].map(([key, label]): radio_resource => ({ key, label, group: 'Directory', path: key, kind: 'directory', fields: [...directory_fields, ...(key === 'states' ? [{ key: 'country', label: 'Country name' }] : [])], formats: record_formats, filter_path: true })),
  { key: 'checks', label: 'Station checks', group: 'Activity', path: 'checks', kind: 'records', station_path: true, cursor: 'lastcheckuuid', fields: [station_uuid, { key: 'lastcheckuuid', label: 'Continue after check UUID' }, { key: 'seconds', label: 'Within the last seconds', type: 'number', min: 0 }, paging[0]], formats: record_formats },
  { key: 'clicks', label: 'Station clicks', group: 'Activity', path: 'clicks', kind: 'records', station_path: true, cursor: 'lastclickuuid', fields: [station_uuid, { key: 'lastclickuuid', label: 'Continue after click UUID' }, { key: 'seconds', label: 'Within the last seconds', type: 'number', min: 0 }, paging[0]], formats: record_formats },
  { key: 'check_steps', label: 'Stream check steps', group: 'Activity', path: 'checksteps', kind: 'records', fields: [uuids], formats: record_formats },
  { key: 'versions', label: 'Station change history', group: 'Activity', path: 'stations/changed', kind: 'records', station_path: true, cursor: 'lastchangeuuid', fields: [station_uuid, { key: 'lastchangeuuid', label: 'Continue after change UUID' }, paging[0]], formats: record_formats },
  { key: 'streaming_servers', label: 'Streaming servers', group: 'Activity', path: 'streamingservers', kind: 'records', fields: [hide_broken], formats: ['json', 'xml'] },
  ...[
    ['stats', 'Statistics', ['json', 'xml']], ['servers', 'Mirrors', ['json']],
    ['config', 'Configuration', ['json', 'xml']], ['metrics', 'Prometheus metrics', ['text']]
  ].map(([key, label, formats]): radio_resource => ({ key: key as string, label: label as string, group: 'Server', path: key as string, kind: 'server', fields: [], formats: formats as string[] }))
];

export const RADIO_ADD_FIELDS: radio_field[] = [
  { key: 'name', label: 'Station name', required: true },
  { key: 'url', label: 'Stream URL', type: 'url', required: true },
  { key: 'homepage', label: 'Homepage', type: 'url' },
  { key: 'favicon', label: 'Logo URL', type: 'url' },
  { key: 'countrycode', label: 'Country code' },
  { key: 'iso_3166_2', label: 'Region ISO code' },
  { key: 'state', label: 'State name (legacy)' },
  { key: 'languagecodes', label: 'Language codes separated by commas' },
  { key: 'language', label: 'Language names (legacy)' },
  { key: 'tags', label: 'Tags separated by commas' },
  { key: 'geo_lat', label: 'Latitude', type: 'number', min: -90, max: 90 },
  { key: 'geo_long', label: 'Longitude', type: 'number', min: -180, max: 180 }
];

export function radio_resource_defaults(resource: radio_resource): Record<string, string> {
  return {
    ...(resource.fields.some(field => field.key === 'limit') ? { limit: '50' } : {}),
    ...(resource.fields.some(field => field.key === 'offset') ? { offset: '0' } : {}),
    ...(resource.fields.some(field => field.key === 'hide_unplayable') ? { hide_unplayable: 'true' } : {}),
    ...resource.defaults
  };
}
