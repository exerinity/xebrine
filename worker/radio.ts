import { radio_directory_request, route_radio_directory } from './radio_directory';
const PREFIX = '/i/services/radio';
const filter_cache = new Map<string, { data: unknown[]; expires: number }>();
const CLIENT = 'Xebrine/13.0 (https://xebrine.com)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

async function directory(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await radio_directory_request(path, signal);
  if (!response.ok) throw new Error('Could not reach radio browser');
  return response.json();
}

export function public_stream_url(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !host.includes('.') || host.includes(':') ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid)$/.test(host)) {
    throw new Error('This station has an unsupported stream address');
  }
  if (/^[\d.]+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
        (a === 198 && (b === 18 || b === 19))) {
      throw new Error('This station has an unsupported stream address');
    }
  }
  return url;
}

async function stream(request: Request, uuid: string): Promise<Response> {
  const data = await directory(`/json/stations/byuuid/${uuid}`, request.signal);
  const station = Array.isArray(data) ? data.find(item => item?.stationuuid === uuid) : null;
  if (!station || typeof station.url_resolved !== 'string') return json({ error: 'Station not found' }, 404);
  if (station.hls) return json({ error: 'HLS stations are not supported yet' }, 415);
  let target = public_stream_url(station.url_resolved);
  for (let hop = 0; hop < 5; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let upstream: Response;
    try {
      upstream = await fetch(target.href, {
        redirect: 'manual',
        headers: { 'User-Agent': CLIENT, 'Icy-MetaData': '0', Accept: 'audio/*, application/ogg, application/octet-stream' },
        signal: AbortSignal.any([request.signal, controller.signal])
      });
    } finally { clearTimeout(timeout); }
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      await upstream.body?.cancel();
      const location = upstream.headers.get('location');
      if (!location) throw new Error('The station returned an invalid redirect');
      target = public_stream_url(new URL(location, target).href);
      continue;
    }
    const content_type = (upstream.headers.get('content-type') ?? '').split(';')[0].toLowerCase();
    if (!upstream.ok || !upstream.body ||
        (!content_type.startsWith('audio/') && !['application/ogg', 'application/octet-stream'].includes(content_type)) ||
        /mpegurl|scpls/.test(content_type)) {
      await upstream.body?.cancel();
      return json({ error: 'The station stream is offline or unsupported' }, 502);
    }
    return new Response(upstream.body, {
      headers: {
        'content-type': content_type,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
  throw new Error('The station redirected too many times');
}

async function artwork(request: Request, uuid: string): Promise<Response> {
  const data = await directory(`/json/stations/byuuid/${uuid}`, request.signal);
  const station = Array.isArray(data) ? data.find(item => item?.stationuuid === uuid) : null;
  if (!station || typeof station.favicon !== 'string' || !station.favicon) {
    return json({ error: 'No station artwork' }, 404);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const signal = AbortSignal.any([request.signal, controller.signal]);
  const max_bytes = 2 * 1024 * 1024;
  try {
    let target = public_stream_url(station.favicon);
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(target.href, {
        redirect: 'manual', headers: { 'User-Agent': CLIENT, Accept: 'image/*' }, signal
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) throw new Error('Invalid artwork redirect');
        target = public_stream_url(new URL(location, target).href);
        continue;
      }
      const content_type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const image_types = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
      if (!response.ok || !response.body || !image_types.includes(content_type) || Number(response.headers.get('content-length')) > max_bytes) {
        await response.body?.cancel();
        return json({ error: 'Station artwork is unavailable' }, 404);
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > max_bytes) {
            await reader.cancel();
            return json({ error: 'Station artwork is too large' }, 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new Response(bytes, { headers: {
        'content-type': content_type,
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox"
      } });
    }
    throw new Error('Too many artwork redirects');
  } finally {
    clearTimeout(timeout);
  }
}

export async function route_radio(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  if (path.startsWith(`${PREFIX}/browse/`) || path.startsWith(`${PREFIX}/vote/`) || path === `${PREFIX}/add`) {
    return route_radio_directory(request, url);
  }
  try {
    if (path === `${PREFIX}/filters` && request.method === 'GET') {
      const lists = await Promise.all(['countries', 'languages', 'tags', 'codecs'].map(async key => {
        const cached = filter_cache.get(key);
        if (cached && cached.expires > Date.now()) return [key, cached.data] as const;
        const params = new URLSearchParams({ hidebroken: 'true', limit: key === 'tags' ? '200' : '1000', order: key === 'tags' ? 'stationcount' : 'name', reverse: key === 'tags' ? 'true' : 'false' });
        const data = await directory(`/json/${key}?${params}`, request.signal);
        if (!Array.isArray(data)) throw new Error('Could not load filter suggestions');
        filter_cache.set(key, { data, expires: Date.now() + 3600000 });
        return [key, data] as const;
      }));
      return json(Object.fromEntries(lists));
    }
    const match = path.match(/^\/i\/services\/radio\/(stream|click|station|artwork)\/([^/]+)$/);
    if (!match) return json({ error: 'Not found' }, 404);
    const [, action, uuid] = match;
    if (!UUID.test(uuid)) return json({ error: 'Invalid station ID' }, 400);
    if (action === 'station' && request.method === 'GET') {
      const data = await directory(`/json/stations/byuuid/${uuid}`, request.signal);
      const station = Array.isArray(data) ? data.find(item => item?.stationuuid === uuid) : null;
      return station ? json(station) : json({ error: 'Station not found' }, 404);
    }
    if (action === 'artwork' && request.method === 'GET') return await artwork(request, uuid);
    if (action === 'stream' && request.method === 'GET') return await stream(request, uuid);
    if (action === 'click' && request.method === 'POST') {
      await directory(`/json/url/${uuid}`, request.signal);
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not connect to the station' }, 502);
  }
}
