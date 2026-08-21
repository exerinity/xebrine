import type { Lyrics, TrackMeta } from '../types';
import { parseLrc } from '../utils/lyrics';

const BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = 'Xebrine v10.0 (https://xebrine.com)';
const REQUEST_GAP_MS = 300;
const DEFAULT_RETRY_AFTER_MS = 30_000;

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestCompletedAt: number | null = null;
let rateLimitedUntil = 0;

export type LrclibMode = 'strict' | 'lax';

export interface LrclibRecord {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  lyricsfile: string;
}

export interface LrclibSearchParams {
  q?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
}

export interface LrclibSignature {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
}

export class LrclibError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | undefined;
  readonly code: number | undefined;
  readonly apiName: string | undefined;

  constructor(
    status: number,
    message: string,
    retryAfterMs?: number,
    code?: number,
    apiName?: string
  ) {
    super(message);
    this.name = 'LrclibError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.code = code;
    this.apiName = apiName;
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function rejectOnAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function enqueueRequest<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const turn = requestQueue.then(async () => {
    const nextAfterGap = lastRequestCompletedAt === null ? 0 : lastRequestCompletedAt + REQUEST_GAP_MS;
    const earliestStart = Math.max(nextAfterGap, rateLimitedUntil);
    await wait(earliestStart - Date.now(), signal);
    if (signal?.aborted) throw abortReason(signal);

    try {
      return await request();
    } finally {
      lastRequestCompletedAt = Date.now();
    }
  });

  requestQueue = turn.then(
    () => undefined,
    () => undefined
  );
  return rejectOnAbort(turn, signal);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.ceil(Number(trimmed) * 1000);

  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function toLrclibError(response: Response): Promise<LrclibError> {
  let code: number | undefined;
  let apiName: string | undefined;
  let message = `LRCLIB responded with ${response.status}`;

  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const error = body as Record<string, unknown>;
      if (typeof error.code === 'number') code = error.code;
      if (typeof error.name === 'string') apiName = error.name;
      if (typeof error.message === 'string' && error.message.trim()) message = error.message;
    }
  } catch {
    // Some upstream failures do not include a JSON response body.
  }

  const retryAfterMs =
    response.status === 429
      ? (parseRetryAfter(response.headers.get('Retry-After')) ?? DEFAULT_RETRY_AFTER_MS)
      : undefined;
  if (retryAfterMs !== undefined) {
    rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + retryAfterMs);
  }
  return new LrclibError(response.status, message, retryAfterMs, code, apiName);
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return enqueueRequest(async () => {
    const response = await fetch(`${BASE}${path}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Lrclib-Client': CLIENT_HEADER
      }
    });
    if (!response.ok) throw await toLrclibError(response);
    return response.json() as Promise<T>;
  }, signal);
}

function addTrimmed(params: URLSearchParams, name: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) params.set(name, trimmed);
}

export async function searchLyricsRecords(
  search: LrclibSearchParams,
  signal?: AbortSignal
): Promise<LrclibRecord[]> {
  const params = new URLSearchParams();
  const keyword = search.q?.trim();
  if (keyword) {
    params.set('q', keyword);
  } else {
    const trackName = search.trackName?.trim();
    if (!trackName) throw new TypeError('LRCLIB search requires q or trackName');
    params.set('track_name', trackName);
    addTrimmed(params, 'artist_name', search.artistName);
    addTrimmed(params, 'album_name', search.albumName);
  }
  return requestJson<LrclibRecord[]>(`/search?${params}`, signal);
}

export async function getLyricsBySignature(
  signature: LrclibSignature,
  signal?: AbortSignal
): Promise<LrclibRecord | null> {
  const trackName = signature.trackName.trim();
  const artistName = signature.artistName.trim();
  if (!trackName || !artistName) {
    throw new TypeError('LRCLIB signature lookup requires trackName and artistName');
  }

  const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
  addTrimmed(params, 'album_name', signature.albumName);
  if (
    typeof signature.duration === 'number' &&
    Number.isFinite(signature.duration) &&
    signature.duration >= 1 &&
    signature.duration <= 3600
  ) {
    params.set('duration', String(signature.duration));
  }

  try {
    return await requestJson<LrclibRecord>(`/get?${params}`, signal);
  } catch (error) {
    if (error instanceof LrclibError && error.status === 404) return null;
    throw error;
  }
}

export async function getLyricsById(id: number, signal?: AbortSignal): Promise<LrclibRecord | null> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('LRCLIB ID must be a positive integer');
  try {
    return await requestJson<LrclibRecord>(`/get/${id}`, signal);
  } catch (error) {
    if (error instanceof LrclibError && error.status === 404) return null;
    throw error;
  }
}

export function lyricsFromLrclibRecord(record: LrclibRecord): Lyrics | null {
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    if (lines.length > 0) return { synced: true, source: 'lrclib', lines };
  }
  if (record.plainLyrics) {
    const lines = record.plainLyrics.split(/\r?\n/).map((text) => ({ time: null, text: text.trim() }));
    return { synced: false, source: 'lrclib', lines };
  }
  if (record.instrumental) {
    return {
      synced: false,
      source: 'lrclib',
      lines: [{ time: null, text: 'This song is an instrumental' }]
    };
  }
  return null;
}

export async function fetchLyrics(
  track: TrackMeta,
  mode: LrclibMode,
  signal?: AbortSignal
): Promise<Lyrics | null> {
  let record: LrclibRecord | null;
  if (mode === 'strict') {
    record = await getLyricsBySignature(
      {
        artistName: track.artist,
        trackName: track.title,
        albumName: track.album,
        duration: Math.round(track.duration)
      },
      signal
    );
  } else {
    const results = await searchLyricsRecords(
      { artistName: track.artist, trackName: track.title },
      signal
    );
    const score = (candidate: LrclibRecord): number => {
      let value = candidate.syncedLyrics ? 4 : candidate.plainLyrics ? 1 : 0;
      if (track.duration > 0 && candidate.duration > 0) {
        value += 2 / (1 + Math.abs(candidate.duration - track.duration));
      }
      return value;
    };
    record = results
      .filter((candidate) => candidate.syncedLyrics || candidate.plainLyrics || candidate.instrumental)
      .sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  return record ? lyricsFromLrclibRecord(record) : null;
}
