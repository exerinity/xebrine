import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LrclibMode } from '../api/lrclib';
import { DEFAULT_IGNORE_RULES, normalizeIgnoreRules, type IgnoreRules } from '../utils/ignore_rules';
import {
  EQ_FLAT,
  EQ_INTENSITY_DEFAULT,
  EQ_PREAMP_DEFAULT,
  normalize_bands,
  normalize_intensity,
  normalize_preamp
} from '../audio/eq';
import { KEN_BURNS_DEFAULT_INTENSITY } from '../hooks/ken_burns';
import type { ArtistPronunciation } from '../utils/pronunciation';
import { isThemeId, type ThemeId } from '../utils/themes';
import { isSearchEngineId, type SearchEngineId } from '../utils/search_engine';
import { isPageKeyMode, type PageKeyMode } from '../utils/page_keys';
import { isAutoPlayLevel, type AutoPlayLevel } from '../queue/auto_play';
import {
  DEFAULT_SCROBBLE_IGNORE_RULES,
  normalizeScrobbleIgnoreRules,
  type ScrobbleIgnoreRules,
  type ScrobbleMode
} from '../utils/scrobble_rules';

export type PlayerBarClickAction = 'copy' | 'open';
export type PlayerBarPosition = 'top' | 'bottom';
export type PlayerBarSliderPosition = 'above' | 'below';
export type PlayerBarLayout = 'compact' | 'comfortable';

export interface Settings {
  lrclibMode: LrclibMode;
  notifications: boolean;
  preventExit: boolean;
  ignoreRules: IgnoreRules;
  autoMixDuration: number;
  autoPlay: boolean;
  autoPlayLevel: AutoPlayLevel;
  eqEnabled: boolean;
  eqBands: number[];
  eqPreamp: number;
  eqIntensity: number;
  playerBarClickAction: PlayerBarClickAction;
  playerBarPosition: PlayerBarPosition;
  playerBarSliderPosition: PlayerBarSliderPosition;
  playerBarLayout: PlayerBarLayout;
  fsBlur: number;
  fsSaturate: number;
  fsKenBurns: boolean;
  fsKenBurnsIntensity: number;
  reducedMotion: boolean;
  announceTrackChanges: boolean;
  artistPronunciations: ArtistPronunciation[];
  tagExplicitSongs: boolean;
  theme: ThemeId;
  searchEngine: SearchEngineId;
  customSearchUrl: string;
  pageKeyMode: PageKeyMode;
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
  preventExit: true,
  ignoreRules: DEFAULT_IGNORE_RULES,
  autoMixDuration: 15,
  autoPlay: false,
  autoPlayLevel: 1,
  eqEnabled: false,
  eqBands: [...EQ_FLAT],
  eqPreamp: EQ_PREAMP_DEFAULT,
  eqIntensity: EQ_INTENSITY_DEFAULT,
  playerBarClickAction: 'open',
  playerBarPosition: 'bottom',
  playerBarSliderPosition: 'below',
  playerBarLayout: 'comfortable',
  fsBlur: 56,
  fsSaturate: 1.35,
  fsKenBurns: false,
  fsKenBurnsIntensity: KEN_BURNS_DEFAULT_INTENSITY,
  reducedMotion: false,
  announceTrackChanges: false,
  artistPronunciations: [],
  tagExplicitSongs: false,
  theme: 'adaptive',
  searchEngine: 'google',
  customSearchUrl: '',
  pageKeyMode: 'off',
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
      eqBands: normalize_bands(merged.eqBands),
      eqPreamp: normalize_preamp(merged.eqPreamp),
      eqIntensity: normalize_intensity(merged.eqIntensity),
      ignoreRules: normalizeIgnoreRules(merged.ignoreRules),
      theme: isThemeId(merged.theme) ? merged.theme : 'adaptive',
      searchEngine: isSearchEngineId(merged.searchEngine) ? merged.searchEngine : 'google',
      customSearchUrl: typeof merged.customSearchUrl === 'string' ? merged.customSearchUrl : '',
      pageKeyMode: isPageKeyMode(merged.pageKeyMode) ? merged.pageKeyMode : 'off',
      playerBarPosition: merged.playerBarPosition === 'top' ? 'top' : 'bottom',
      playerBarSliderPosition: merged.playerBarSliderPosition === 'above' ? 'above' : 'below',
      playerBarLayout: merged.playerBarLayout === 'compact' ? 'compact' : 'comfortable',
      autoPlayLevel: isAutoPlayLevel(merged.autoPlayLevel) ? merged.autoPlayLevel : 1,
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
