export type SearchEngineId =
  | 'google'
  | 'google_ai'
  | 'bing'
  | 'copilot'
  | 'ddg'
  | 'yahoo'
  | 'kagi'
  | 'startpage'
  | 'youtube'
  | 'ytmusic'
  | 'spotify'
  | 'tidal'
  | 'lastfm'
  | 'applemusic'
  | 'beatport'
  | 'chatgpt'
  | 'grok'
  | 'groktw'
  | 'claude'
  | 'twitter'
  | 'tunebat'
  | 'facebook'
  | 'instagram'
  | 'bluesky'
  | 'tumblr'
  | 'tiktok'
  | 'reddit'
  | 'custom';

export const QUERY_TOKEN = '%s';

export const SEARCH_ENGINES: {
  id: SearchEngineId;
  label: string;
  template: string;
  noBy?: boolean; // removes "by" from the query. this is because putting "by" in the query upsets a lot of less-intelligent search algorithms. i have carefully chosen which sites to assign this to, and im probably very wrong.
}[] = [
  { id: 'google', label: 'Google', template: `https://www.google.com/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'google_ai', label: 'Google AI Mode', template: `https://www.google.com/search?udm=50&q=${QUERY_TOKEN}` },
  { id: 'bing', label: 'Bing', template: `https://www.bing.com/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'copilot', label: 'Bing Copilot', template: `https://www.bing.com/copilotsearch?q=${QUERY_TOKEN}` },
  { id: 'ddg', label: 'DuckDuckGo', template: `https://duckduckgo.com/?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'yahoo', label: 'Yahoo', template: `https://search.yahoo.com/search?p=${QUERY_TOKEN}`, noBy: true }, // anyone actually still use yahoo?
  { id: 'kagi', label: 'Kagi', template: `https://kagi.com/search?q=${QUERY_TOKEN}`, noBy: true },
  {
    id: 'startpage',
    label: 'Startpage',
    template: `https://www.startpage.com/sp/search?query=${QUERY_TOKEN}`,
    noBy: true
  },
  { id: 'youtube', label: 'YouTube', template: `https://www.youtube.com/search?q=${QUERY_TOKEN}` },
  {
    id: 'ytmusic',
    label: 'YT Music',
    template: `https://music.youtube.com/search?q=${QUERY_TOKEN}`,
    noBy: true
  },
  { id: 'spotify', label: 'Spotify', template: `https://open.spotify.com/search/${QUERY_TOKEN}`, noBy: true },
  { id: 'tidal', label: 'TIDAL', template: `https://tidal.com/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'lastfm', label: 'Last.fm', template: `https://www.last.fm/search?q=${QUERY_TOKEN}`, noBy: true },
  {
    id: 'applemusic',
    label: 'Apple Music',
    template: `https://music.apple.com/search?term=${QUERY_TOKEN}`,
    noBy: true
  },
  { id: 'beatport', label: 'Beatport', template: `https://www.beatport.com/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'chatgpt', label: 'ChatGPT', template: `https://chatgpt.com/?prompt=${QUERY_TOKEN}` },
  { id: 'grok', label: 'Grok', template: `https://grok.com/?q=${QUERY_TOKEN}` },
  { id: 'groktw', label: 'Grok on Twitter', template: `https://x.com/i/grok?text=${QUERY_TOKEN}` },
  { id: 'claude', label: 'Claude', template: `https://claude.ai/new?q=${QUERY_TOKEN}`},
  // gemini isn't present in this list because im not aware of any parameter google offers for it. not that gemini is good anyway (despite google ai mode has one ???? holy inconsistency)
  { id: 'twitter', label: 'Twitter', template: `https://x.com/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'tunebat', label: 'Tunebat', template: `https://tunebat.com/Search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'facebook', label: 'Facebook', template: `https://www.facebook.com/search/top/?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'instagram', label: 'Instagram', template: `https://www.instagram.com/explore/search/keyword/?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'bluesky', label: 'Bluesky', template: `https://bsky.app/search?q=${QUERY_TOKEN}`, noBy: true },
  { id: 'tumblr', label: 'Tumblr', template: `https://www.tumblr.com/search/${QUERY_TOKEN}`, noBy: true },
  { id: 'tiktok', label: 'TikTok', template: `https://www.tiktok.com/search?q=${QUERY_TOKEN}` },
  { id: 'reddit', label: 'Reddit', template: `https://www.reddit.com/search/?q=${QUERY_TOKEN}` },
  { id: 'custom', label: 'Custom', template: '' }
];

export type SearchEngineKind = 'search' | 'music' | 'ai' | 'social' | 'custom';

const AI_ENGINES = new Set<SearchEngineId>(['google_ai', 'copilot', 'chatgpt', 'grok', 'groktw', 'claude']);

const MUSIC_ENGINES = new Set<SearchEngineId>([
  'youtube',
  'ytmusic',
  'spotify',
  'tidal',
  'lastfm',
  'applemusic',
  'beatport',
  'tunebat'
]);

const SOCIAL_ENGINES = new Set<SearchEngineId>([
  'twitter',
  'facebook',
  'instagram',
  'bluesky',
  'tumblr',
  'tiktok',
  'reddit'
]);

export const ENGINE_GROUPS: { kind: SearchEngineKind; label: string }[] = [
  { kind: 'search', label: 'Traditional search engines' },
  { kind: 'music', label: 'Music sites' },
  { kind: 'ai', label: 'AI search and chatbots' },
  { kind: 'social', label: 'Social media' }
];

export function engineKind(engine: SearchEngineId): SearchEngineKind {
  if (engine === 'custom') return 'custom';
  if (AI_ENGINES.has(engine)) return 'ai';
  if (SOCIAL_ENGINES.has(engine)) return 'social';
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
  const engineEntry = SEARCH_ENGINES.find((entry) => entry.id === engine);
  const normalizedQuery = engineEntry?.noBy ? query.replaceAll(' by ', ' ') : query;
  const encoded = encodeURIComponent(normalizedQuery);
  const fallback = SEARCH_ENGINES[0].template;
  const template =
    engine === 'custom'
      ? customUrl.trim() || fallback
      : engineEntry?.template || fallback;

  return template.includes(QUERY_TOKEN)
    ? template.replaceAll(QUERY_TOKEN, encoded)
    : `${template}${encoded}`;
}

export function openSearch(query: string, engine: SearchEngineId, customUrl: string): void {
  window.open(buildSearchUrl(query, engine, customUrl), '_blank', 'noopener,noreferrer');
}
