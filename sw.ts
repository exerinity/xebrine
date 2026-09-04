/// <reference lib="webworker" />

interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

interface XebrineServiceWorkerScope extends ServiceWorkerGlobalScope {
  __WB_MANIFEST: PrecacheEntry[];
}

declare const self: XebrineServiceWorkerScope;
declare const __XEBRINE_BUILD_ID__: string;

const PRECACHE_ENTRIES = self.__WB_MANIFEST;
const PRECACHE_PREFIX = 'xebrine-precache-';
const LEGACY_PRECACHE_PREFIX = 'workbox-precache';
const LRCLIB_CACHE = 'lrclib';
const LRCLIB_MAX_ENTRIES = 200;
const LRCLIB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function buildId(entries: PrecacheEntry[]): string {
  const manifestSignature = entries
    .map((entry) => `${entry.url}:${entry.revision ?? ''}`)
    .sort()
    .join('|');
  const signature = `${__XEBRINE_BUILD_ID__}|${manifestSignature}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < signature.length; index++) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

const PRECACHE_NAME = `${PRECACHE_PREFIX}${buildId(PRECACHE_ENTRIES)}`;
const PRECACHE_URLS = Array.from(
  new Set(PRECACHE_ENTRIES.map((entry) => new URL(entry.url, self.registration.scope).href))
);
const INDEX_URL = new URL('/', self.registration.scope).href;

let downloadPromise: Promise<void> | null = null;

function downloadUpdate(): Promise<void> {
  if (downloadPromise) return downloadPromise;
  downloadPromise = caches
    .open(PRECACHE_NAME)
    .then((cache) =>
      cache.addAll(
        PRECACHE_URLS.map(
          (url) => new Request(url, { cache: 'reload', credentials: 'same-origin' })
        )
      )
    )
    .catch((error) => {
      downloadPromise = null;
      throw error;
    });
  return downloadPromise;
}

function postToSource(source: ExtendableMessageEvent['source'], message: object): void {
  source?.postMessage(message);
}

self.addEventListener('install', (event) => {
  if (!self.registration.active) event.waitUntil(downloadUpdate());
});

self.addEventListener('message', (event) => {
  const message = event.data as { type?: string } | null;
  if (message?.type === 'XEBRINE_DOWNLOAD_UPDATE') {
    event.waitUntil(
      downloadUpdate().then(
        () => postToSource(event.source, { type: 'XEBRINE_UPDATE_DOWNLOADED' }),
        (error: unknown) =>
          postToSource(event.source, {
            type: 'XEBRINE_UPDATE_FAILED',
            message: error instanceof Error ? error.message : 'Download failed'
          })
      )
    );
  } else if (message?.type === 'SKIP_WAITING') {
    event.waitUntil(downloadUpdate().then(() => self.skipWaiting()));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              (name.startsWith(PRECACHE_PREFIX) && name !== PRECACHE_NAME) ||
              name.startsWith(LEGACY_PRECACHE_PREFIX)
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })
  );
});

async function appResponse(request: Request): Promise<Response> {
  const cache = await caches.open(PRECACHE_NAME);
  if (request.mode === 'navigate') {
    const cached = await cache.match(INDEX_URL);
    if (!cached) return fetch(request);
    if (!cached.redirected) return cached;
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers
    });
  }
  return (await cache.match(request)) ?? fetch(request);
}

async function trimCache(cache: Cache, maximum: number): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximum)).map((key) => cache.delete(key)));
}

async function lrclibResponse(request: Request): Promise<Response> {
  const cache = await caches.open(LRCLIB_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await trimCache(cache, LRCLIB_MAX_ENTRIES);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (!cached) throw error;
    const responseDate = Date.parse(cached.headers.get('date') ?? '');
    if (Number.isFinite(responseDate) && Date.now() - responseDate > LRCLIB_MAX_AGE_MS) {
      await cache.delete(request);
      throw error;
    }
    return cached;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://lrclib.net' && url.pathname.startsWith('/api/')) {
    event.respondWith(lrclibResponse(request));
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith('/i/services/')) return;
  event.respondWith(appResponse(request));
});

export {};
