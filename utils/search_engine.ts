export type SearchEngineId =
  | 'google'
  | 'bing'
  | 'yahoo'
  | 'kagi'
  | 'startpage'
  | 'youtube'
  | 'ytmusic'
  | 'spotify'
  | 'tidal'
  | 'applemusic'
  | 'beatport'
  | 'chatgpt'
  | 'grok'
  | 'groktw'
  | 'claude'
  | 'twitter'
  | 'custom';

export const QUERY_TOKEN = '%s';

export const SEARCH_ENGINES: { id: SearchEngineId; label: string; template: string }[] = [
  { id: 'google', label: 'Google', template: `https://www.google.com/search?q=${QUERY_TOKEN}` },
  { id: 'bing', label: 'Bing', template: `https://www.bing.com/search?q=${QUERY_TOKEN}` },
  { id: 'yahoo', label: 'Yahoo', template: `https://search.yahoo.com/search?p=${QUERY_TOKEN}` },
  { id: 'kagi', label: 'Kagi', template: `https://kagi.com/search?q=${QUERY_TOKEN}` },
  {
    id: 'startpage',
    label: 'Startpage',
    template: `https://www.startpage.com/sp/search?query=${QUERY_TOKEN}`
  },
  { id: 'youtube', label: 'YouTube', template: `https://www.youtube.com/search?q=${QUERY_TOKEN}` },
  {
    id: 'ytmusic',
    label: 'YT Music',
    template: `https://music.youtube.com/search?q=${QUERY_TOKEN}`
  },
  { id: 'spotify', label: 'Spotify', template: `https://open.spotify.com/search/${QUERY_TOKEN}` },
  { id: 'tidal', label: 'TIDAL', template: `https://tidal.com/search?q=${QUERY_TOKEN}` },
  {
    id: 'applemusic',
    label: 'Apple Music',
    template: `https://music.apple.com/search?term=${QUERY_TOKEN}`
  },
  { id: 'beatport', label: 'Beatport', template: `https://www.beatport.com/search?q=${QUERY_TOKEN}` },
  { id: 'chatgpt', label: 'ChatGPT', template: `https://chatgpt.com/?prompt=${QUERY_TOKEN}` },
  { id: 'grok', label: 'Grok', template: `https://grok.com/?q=${QUERY_TOKEN}` },
  { id: 'groktw', label: 'Grok on Twitter', template: `https://twitter.com/i/grok?text=${QUERY_TOKEN}` },
  { id: 'claude', label: 'Claude', template: `https://claude.ai/new?q=${QUERY_TOKEN}`},
  
  { id: 'twitter', label: 'Twitter', template: `https://twitter.com/search?q=${QUERY_TOKEN}` },
  { id: 'custom', label: 'Custom', template: '' }
];

export type SearchEngineKind = 'search' | 'music' | 'ai' | 'more';

const AI_ENGINES = new Set<SearchEngineId>(['chatgpt', 'grok', 'groktw', 'claude']);

const MUSIC_ENGINES = new Set<SearchEngineId>([
  'youtube',
  'ytmusic',
  'spotify',
  'tidal',
  'applemusic',
  'beatport'
]);

export const ENGINE_GROUPS: { kind: SearchEngineKind; label: string }[] = [
  { kind: 'search', label: 'Traditional search engines' },
  { kind: 'music', label: 'Music sites' },
  { kind: 'ai', label: 'AI chatbots' },
  { kind: 'more', label: 'More' }
];

const MORE_ENGINES = new Set<SearchEngineId>(['twitter', 'custom']);

export function engineKind(engine: SearchEngineId): SearchEngineKind {
  if (MORE_ENGINES.has(engine)) return 'more';
  if (AI_ENGINES.has(engine)) return 'ai';
  return MUSIC_ENGINES.has(engine) ? 'music' : 'search';
}

export function isAiEngine(engine: SearchEngineId): boolean {
  return AI_ENGINES.has(engine);
}

export function isSearchEngineId(value: unknown): value is SearchEngineId {
  return SEARCH_ENGINES.some((e) => e.id === value);
}

export function searchEngineName(engine: SearchEngineId, customUrl: string): string {
  if (engine !== 'custom') {
    return SEARCH_ENGINES.find((e) => e.id === engine)?.label ?? 'Google';
  }
  const trimmed = customUrl.trim();
  if (!trimmed) return 'Google';
  try {
    return new URL(trimmed.replace(QUERY_TOKEN, 'q')).hostname.replace(/^www\./, '');
  } catch {
    return 'Custom';
  }
}

export function searchVerb(engine: SearchEngineId): 'Search' | 'Ask' {
  return isAiEngine(engine) ? 'Ask' : 'Search';
}

export function searchLabel(engine: SearchEngineId, customUrl: string): string {
  return `${searchVerb(engine)} ${searchEngineName(engine, customUrl)}`;
}

export function buildSearchUrl(query: string, engine: SearchEngineId, customUrl: string): string {
  const encoded = encodeURIComponent(query);
  const fallback = SEARCH_ENGINES[0].template;
  const template =
    engine === 'custom'
      ? customUrl.trim() || fallback
      : SEARCH_ENGINES.find((e) => e.id === engine)?.template || fallback;

  return template.includes(QUERY_TOKEN)
    ? template.replaceAll(QUERY_TOKEN, encoded)
    : `${template}${encoded}`;
}

export function openSearch(query: string, engine: SearchEngineId, customUrl: string): void {
  window.open(buildSearchUrl(query, engine, customUrl), '_blank', 'noopener,noreferrer');
}
