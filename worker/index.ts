import { LastfmError, type Env, type ScrobbleItem } from './types';
import {
  authUrl,
  getRecentTracks,
  getSession,
  getUserInfo,
  scrobble,
  updateNowPlaying
} from './lastfm';

const PREFIX = '/i/services/lastfm';
const MAX_BATCH = 50;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function fail(error: unknown): Response {
  if (error instanceof LastfmError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json({ error: 'Unexpected error talking to Last.fm' }, 502);
}

function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function callbackPage(origin: string, payload: unknown): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>Connecting...</title>
<body style="font:14px system-ui;background:#0f1115;color:#e6e8ee;padding:24px">
<p>Finishing sign-in, you can close this window.</p>
<script>
  var payload = ${embed(payload)};
  if (window.opener) window.opener.postMessage(payload, ${embed(origin)});
  setTimeout(function () { window.close(); }, 200);
</script>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function asItem(raw: unknown, requireTimestamp: boolean): ScrobbleItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const artist = typeof o.artist === 'string' ? o.artist.trim() : '';
  const track = typeof o.track === 'string' ? o.track.trim() : '';
  if (!artist || !track) return null;
  const timestamp = typeof o.timestamp === 'number' ? Math.floor(o.timestamp) : 0;
  if (requireTimestamp && timestamp <= 0) return null;
  return {
    artist,
    track,
    album: typeof o.album === 'string' && o.album.trim() ? o.album.trim() : undefined,
    albumArtist:
      typeof o.albumArtist === 'string' && o.albumArtist.trim() ? o.albumArtist.trim() : undefined,
    duration: typeof o.duration === 'number' ? o.duration : undefined,
    trackNumber: typeof o.trackNumber === 'number' ? o.trackNumber : undefined,
    timestamp
  };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function sessionKeyOf(body: Record<string, unknown>): string | null {
  const sk = body.sessionKey;
  return typeof sk === 'string' && sk.length > 0 ? sk : null;
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');

  if (path === `${PREFIX}/auth/start`) {
    return Response.redirect(authUrl(env, `${url.origin}${PREFIX}/auth/callback`), 302);
  }

  if (path === `${PREFIX}/auth/callback`) {
    const token = url.searchParams.get('token');
    if (!token) {
      return callbackPage(url.origin, { source: 'xebrine-lastfm', error: 'No token was returned' });
    }
    try {
      const session = await getSession(env, token);
      return callbackPage(url.origin, { source: 'xebrine-lastfm', ...session });
    } catch (error) {
      const message =
        error instanceof LastfmError ? error.message : 'Could not complete the Last.fm sign-in';
      return callbackPage(url.origin, { source: 'xebrine-lastfm', error: message });
    }
  }

  if (path === `${PREFIX}/nowplaying` && request.method === 'POST') {
    const body = await readBody(request);
    const sessionKey = sessionKeyOf(body);
    const item = asItem(body.track, false);
    if (!sessionKey || !item) return json({ error: 'Missing session or track' }, 400);
    await updateNowPlaying(env, sessionKey, item);
    return json({ ok: true });
  }

  if (path === `${PREFIX}/scrobble` && request.method === 'POST') {
    const body = await readBody(request);
    const sessionKey = sessionKeyOf(body);
    if (!sessionKey) return json({ error: 'Missing session' }, 400);
    const raw = Array.isArray(body.scrobbles) ? body.scrobbles : [];
    const items = raw.map((r) => asItem(r, true)).filter((i): i is ScrobbleItem => i !== null);
    if (items.length === 0) return json({ error: 'No valid scrobbles' }, 400);
    if (items.length > MAX_BATCH) return json({ error: `At most ${MAX_BATCH} per batch` }, 400);
    const result = await scrobble(env, sessionKey, items);
    return json({ ok: true, ...result });
  }

  if (path === `${PREFIX}/user` && request.method === 'GET') {
    const username = url.searchParams.get('username');
    if (!username) return json({ error: 'Missing username' }, 400);
    return json(await getUserInfo(env, username));
  }

  if (path === `${PREFIX}/recent` && request.method === 'GET') {
    const username = url.searchParams.get('username');
    if (!username) return json({ error: 'Missing username' }, 400);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 200);
    return json(await getRecentTracks(env, username, limit));
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/i/services')) return env.ASSETS.fetch(request);

    const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
    const { success } = await env.LIMITER.limit({ key: ip });
    if (!success) return json({ error: 'Too many requests, slow down a moment' }, 429);

    try {
      return await route(request, env, url);
    } catch (error) {
      return fail(error);
    }
  }
};
