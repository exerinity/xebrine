import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LrclibMode } from '../api/lrclib';
import { DEFAULT_IGNORE_RULES, normalizeIgnoreRules, type IgnoreRules } from '../utils/ignore_rules';
import { EQ_FLAT, normalizeBands } from '../audio/eq';
import type { ArtistPronunciation } from '../utils/pronunciation';
import { isThemeId, type ThemeId } from '../utils/themes';
import { isSearchEngineId, type SearchEngineId } from '../utils/search_engine';
import {
  DEFAULT_SCROBBLE_IGNORE_RULES,
  normalizeScrobbleIgnoreRules,
  type ScrobbleIgnoreRules,
  type ScrobbleMode
} from '../utils/scrobble_rules';

export type PlayerBarClickAction = 'copy' | 'open';

export interface Settings {
  lrclibMode: LrclibMode;
  notifications: boolean;
  ignoreRules: IgnoreRules;
  autoMixDuration: number;
  eqEnabled: boolean;
  eqBands: number[];
  playerBarClickAction: PlayerBarClickAction;
  fsBlur: number;
  fsSaturate: number;
  reducedMotion: boolean;
  announceTrackChanges: boolean;
  artistPronunciations: ArtistPronunciation[];
  tagExplicitSongs: boolean;
  theme: ThemeId;
  searchEngine: SearchEngineId;
  customSearchUrl: string;
  scrobbleEnabled: boolean;
  scrobbleNowPlaying: boolean;
  scrobbleMode: ScrobbleMode;
  scrobbleIgnoreRules: ScrobbleIgnoreRules;
}

interface SettingsContextValue {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

const KEY = 'xebrine.settings';

export const DEFAULT_SETTINGS: Settings = {
  lrclibMode: 'strict',
  notifications: true,
  ignoreRules: DEFAULT_IGNORE_RULES,
  autoMixDuration: 15,
  eqEnabled: false,
  eqBands: [...EQ_FLAT],
  playerBarClickAction: 'open',
  fsBlur: 56,
  fsSaturate: 1.35,
  reducedMotion: false,
  announceTrackChanges: false,
  artistPronunciations: [],
  tagExplicitSongs: false,
  theme: 'default',
  searchEngine: 'google',
  customSearchUrl: '',
  scrobbleEnabled: true,
  scrobbleNowPlaying: true,
  scrobbleMode: 'strict',
  scrobbleIgnoreRules: DEFAULT_SCROBBLE_IGNORE_RULES
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const merged = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    return {
      ...merged,
      eqBands: normalizeBands(merged.eqBands),
      ignoreRules: normalizeIgnoreRules(merged.ignoreRules),
      theme: isThemeId(merged.theme) ? merged.theme : 'default',
      searchEngine: isSearchEngineId(merged.searchEngine) ? merged.searchEngine : 'google',
      customSearchUrl: typeof merged.customSearchUrl === 'string' ? merged.customSearchUrl : '',
      scrobbleMode: merged.scrobbleMode === 'lax' ? 'lax' : 'strict',
      scrobbleIgnoreRules: normalizeScrobbleIgnoreRules(merged.scrobbleIgnoreRules)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      null;
    }
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
