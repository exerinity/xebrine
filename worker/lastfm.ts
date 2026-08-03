import { md5 } from './md5';
import { LastfmError, type ScrobbleItem } from './types';

const API = 'https://ws.audioscrobbler.com/2.0/';
const AUTH = 'https://www.last.fm/api/auth/';

export type Params = Record<string, string>;

export function sign(params: Params, secret: string): string {
  const base = Object.keys(params)
    .filter((k) => k !== 'format' && k !== 'callback')
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
  return md5(base + secret);
}

async function call(env: Env, params: Params, signed: boolean, method: 'GET' | 'POST') {
  const full: Params = { ...params, api_key: env.LASTFM_API_KEY };
  if (signed) full.api_sig = sign(full, env.LASTFM_SHARED_SECRET);
  full.format = 'json';

  const body = new URLSearchParams(full);
  const res =
    method === 'GET'
      ? await fetch(`${API}?${body}`)
      : await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body
        });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new LastfmError('Last.fm returned an unreadable response', 502);
  }

  const err = data as { error?: number; message?: string };
  if (err && typeof err.error === 'number') {
    throw new LastfmError(err.message || 'Last.fm rejected the request', 400, err.error);
  }
  if (!res.ok) throw new LastfmError(`Last.fm responded with ${res.status}`, 502);
  return data;
}

export function authUrl(env: Env, callback: string): string {
  const params = new URLSearchParams({ api_key: env.LASTFM_API_KEY, cb: callback });
  return `${AUTH}?${params}`;
}

export async function getSession(env: Env, token: string) {
  const data = (await call(env, { method: 'auth.getSession', token }, true, 'GET')) as {
    session?: { name?: string; key?: string };
  };
  const name = data.session?.name;
  const key = data.session?.key;
  if (!name || !key) throw new LastfmError('Last.fm did not return a session', 502);
  return { username: name, sessionKey: key };
}

function itemParams(item: ScrobbleItem, index?: number): Params {
  const suffix = index === undefined ? '' : `[${index}]`;
  const params: Params = {
    [`artist${suffix}`]: item.artist,
    [`track${suffix}`]: item.track
  };
  if (item.album) params[`album${suffix}`] = item.album;
  if (item.albumArtist) params[`albumArtist${suffix}`] = item.albumArtist;
  if (item.duration && item.duration > 0) {
    params[`duration${suffix}`] = String(Math.round(item.duration));
  }
  if (item.trackNumber && item.trackNumber > 0) {
    params[`trackNumber${suffix}`] = String(item.trackNumber);
  }
  if (index !== undefined) params[`timestamp${suffix}`] = String(item.timestamp);
  return params;
}

export async function updateNowPlaying(env: Env, sessionKey: string, item: ScrobbleItem) {
  await call(
    env,
    { method: 'track.updateNowPlaying', sk: sessionKey, ...itemParams(item) },
    true,
    'POST'
  );
}

export async function scrobble(env: Env, sessionKey: string, items: ScrobbleItem[]) {
  const params: Params = { method: 'track.scrobble', sk: sessionKey };
  items.forEach((item, i) => Object.assign(params, itemParams(item, i)));
  const data = (await call(env, params, true, 'POST')) as {
    scrobbles?: { '@attr'?: { accepted?: number; ignored?: number } };
  };
  const attr = data.scrobbles?.['@attr'];
  return { accepted: attr?.accepted ?? items.length, ignored: attr?.ignored ?? 0 };
}

export function getUserInfo(env: Env, username: string) {
  return call(env, { method: 'user.getInfo', user: username }, false, 'GET');
}

export function getRecentTracks(env: Env, username: string, limit: number) {
  return call(
    env,
    { method: 'user.getRecentTracks', user: username, limit: String(limit) },
    false,
    'GET'
  );
}
