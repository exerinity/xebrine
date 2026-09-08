import { RADIO_ADD_FIELDS, RADIO_RESOURCES, type radio_field } from '../utils/radio_catalog';

const SERVERS = ['https://de1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
const CLIENT = 'Xebrine/13.0 (https://xebrine.com)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let preferred_server = Math.floor(Math.random() * SERVERS.length);

export async function radio_directory_request(path: string, signal: AbortSignal, body?: URLSearchParams, retry = true): Promise<Response> {
  const start = preferred_server;
  for (let attempt = 0; attempt < (retry ? SERVERS.length : 1); attempt++) {
    const index = (start + attempt) % SERVERS.length;
    try {
      const response = await fetch(`${SERVERS[index]}${path}`, {
        method: body ? 'POST' : 'GET', body,
        headers: { 'User-Agent': CLIENT, Accept: '*/*' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
      });
      if (response.ok || response.status < 500) {
        preferred_server = index;
        return response;
      }
      await response.body?.cancel();
    } catch {
      if (signal.aborted) throw signal.reason;
    }
  }
  throw new Error(retry ? 'Could not reach radio browser, please try again' : 'The request did not confirm, refresh the station before trying again');
}

function read_fields(fields: radio_field[], input: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of fields) {
    const value = (input.get(field.key) ?? '').trim();
    if (!value) {
      if (field.required) throw new Error(`${field.label} is required`);
      continue;
    }
    if (value.length > (field.key === 'name' ? 400 : 4000)) throw new Error(`${field.label} is too long`);
    if (field.type === 'boolean' && !['true', 'false'].includes(value)) throw new Error(`Invalid ${field.label.toLowerCase()}`);
    if (field.type === 'select' && !field.choices?.includes(value)) throw new Error(`Invalid ${field.label.toLowerCase()}`);
    if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || number < (field.min ?? 0) || number > (field.max ?? 315360000) ||
          (!['geo_lat', 'geo_long', 'geo_distance'].includes(field.key) && !Number.isInteger(number))) {
        throw new Error(`Invalid ${field.label.toLowerCase()}`);
      }
    }
    if (['stationuuid', 'lastcheckuuid', 'lastclickuuid', 'lastchangeuuid'].includes(field.key) && !UUID.test(value)) {
      throw new Error(`Invalid ${field.label.toLowerCase()}`);
    }
    if (field.key === 'uuids' && (value.split(',').length > 50 || value.split(',').some(uuid => !UUID.test(uuid.trim())))) {
      throw new Error('Enter up to 50 valid station UUIDs separated by commas');
    }
    if (field.key === 'countrycode' && !/^[A-Za-z]{2}$/.test(value)) throw new Error('Use a two letter country code');
    if (field.type === 'url' && !['http:', 'https:'].includes(new URL(value).protocol)) throw new Error(`Invalid ${field.label.toLowerCase()}`);
    params.set(field.key, field.key === 'countrycode' ? value.toUpperCase() : value);
  }
  if (params.has('bitrateMin') && params.has('bitrateMax') && Number(params.get('bitrateMin')) > Number(params.get('bitrateMax'))) {
    throw new Error('Minimum bitrate must not exceed maximum bitrate');
  }
  if (params.has('geo_lat') !== params.has('geo_long')) throw new Error('Enter both latitude and longitude');
  if (params.has('geo_distance') && !params.has('geo_lat')) throw new Error('Enter a location to search by distance');
  return params;
}

const content_types: Record<string, string> = {
  json: 'application/json', xml: 'application/xml', csv: 'text/csv', text: 'text/plain',
  m3u: 'audio/x-mpegurl', pls: 'audio/x-scpls', xspf: 'application/xspf+xml', ttl: 'text/turtle'
};

export async function route_radio_directory(request: Request, url: URL): Promise<Response> {
  try {
    const resource_key = url.pathname.split('/').at(-1) ?? '';
    if (url.pathname.includes('/browse/')) {
      if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
      const resource = RADIO_RESOURCES.find(item => item.key === resource_key);
      if (!resource) return Response.json({ error: 'Unknown radio list' }, { status: 404 });
      const format = url.searchParams.get('format') ?? resource.formats[0];
      if (!resource.formats.includes(format)) throw new Error('Unsupported export format');
      const params = read_fields(resource.fields, url.searchParams);
      params.delete('hide_unplayable');
      if (resource.fields.some(field => field.key === 'limit') && !params.has('limit')) params.set('limit', '50');
      let path = resource.path;
      if (resource.station_path && params.has('stationuuid')) {
        path += `/${encodeURIComponent(params.get('stationuuid')!)}`;
        params.delete('stationuuid');
      }
      if (resource.filter_path && params.has('filter')) {
        const filter = params.get('filter')!;
        if (filter === '.' || filter === '..') throw new Error('Invalid name filter');
        path += `/${encodeURIComponent(filter)}`;
        params.delete('filter');
      }
      const upstream = await radio_directory_request(resource.key === 'metrics' ? '/metrics' : `/${format}/${path}?${params}`, request.signal);
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return Response.json({ error: `Radio browser could not load ${resource.label.toLowerCase()} (${upstream.status})` }, { status: 502 });
      }
      return new Response(upstream.body, { headers: {
        'content-type': `${content_types[format]}; charset=utf-8`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...(url.searchParams.get('download') === '1' ? { 'content-disposition': `attachment; filename="radio_${resource.key}.${format}"` } : {})
      } });
    }
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Expected JSON request');
    const text = await request.text();
    if (text.length > 16000) throw new Error('Station details are too long');
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid station details');
    let upstream: Response;
    if (resource_key === 'add') {
      const input = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) if (typeof value === 'string') input.set(key, value);
      const params = read_fields(RADIO_ADD_FIELDS, input);
      upstream = await radio_directory_request('/json/add', request.signal, params, false);
    } else if (url.pathname.includes('/vote/') && UUID.test(resource_key)) {
      upstream = await radio_directory_request(`/json/vote/${resource_key}`, request.signal, undefined, false);
    } else return Response.json({ error: 'Not found' }, { status: 404 });
    const data: unknown = await upstream.json();
    return Response.json(data, { status: upstream.ok ? 200 : 502, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not complete the radio request' }, { status: 400 });
  }
}
