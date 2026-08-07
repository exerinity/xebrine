const BASE = '/i/services/lastfm';

/**
 * @typedef {import('../utils/scrobble_rules').ScrobblePayload & { timestamp: number }} ScrobbleEntry
 */

/**
 * @typedef {Object} LastfmProfile
 * @property {string} name
 * @property {string} realname
 * @property {string} url
 * @property {string | null} image
 * @property {number} playcount
 * @property {number | null} registered
 * @property {string} country
 */

/**
 * @typedef {Object} RecentTrack
 * @property {string} artist
 * @property {string} track
 * @property {string} album
 * @property {string} url
 * @property {string | null} image
 * @property {boolean} nowPlaying
 * @property {number | null} playedAt
 */

async function request(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Last.fm request failed (${res.status})`);
  return data;
}

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function connectLastfm() {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${BASE}/auth/start`, 'xebrine-lastfm', 'width=520,height=760');
    if (!popup) {
      reject(new Error('Your browser blocked the Last.fm sign-in window'));
      return;
    }

    let settled = false;
    const finish = () => {
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(poll);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'xebrine-lastfm') return;
      finish();
      if (data.error || !data.username || !data.sessionKey) {
        reject(new Error(data.error || 'Last.fm did not return a session'));
        return;
      }
      resolve({ username: data.username, sessionKey: data.sessionKey });
    };

    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        finish();
        reject(new Error('The Last.fm sign-in was cancelled'));
      }
    }, 500);
  });
}

export function sendNowPlaying(sessionKey, track) {
  return post('/nowplaying', { sessionKey, track: { ...track, timestamp: 0 } });
}

export function sendScrobbles(sessionKey, scrobbles) {
  return post('/scrobble', { sessionKey, scrobbles });
}

function firstImage(images) {
  if (!Array.isArray(images)) return null;
  const preferred =
    images.find((i) => i.size === 'extralarge') ?? images.find((i) => i.size === 'large') ?? images[0];
  const url = preferred?.['#text'];
  return url ? url : null;
}

export async function fetchProfile(username) {
  const data = await request(`/user?username=${encodeURIComponent(username)}`);
  const user = data.user ?? {};
  const registered = user.registered;
  return {
    name: String(user.name ?? username),
    realname: String(user.realname ?? ''),
    url: String(user.url ?? ''),
    image: firstImage(user.image),
    playcount: Number(user.playcount ?? 0),
    registered: registered?.unixtime ? Number(registered.unixtime) : null,
    country: String(user.country ?? '')
  };
}

export async function fetchRecentTracks(username, limit = 25) {
  const data = await request(`/recent?username=${encodeURIComponent(username)}&limit=${limit}`);
  const raw = data.recenttracks?.track;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((t) => {
    const attr = t['@attr'];
    const date = t.date;
    const artist = t.artist;
    const album = t.album;
    return {
      artist: String(artist?.['#text'] ?? artist?.name ?? ''),
      track: String(t.name ?? ''),
      album: String(album?.['#text'] ?? ''),
      url: String(t.url ?? ''),
      image: firstImage(t.image),
      nowPlaying: attr?.nowplaying === 'true',
      playedAt: date?.uts ? Number(date.uts) : null
    };
  });
}
