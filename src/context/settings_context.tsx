import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LrclibMode } from '../api/lrclib';
import { DEFAULT_IGNORE_RULES, type IgnoreRules } from '../utils/ignore_rules';
import { EQ_FLAT, normalizeBands } from '../audio/eq';

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
  tagExplicitSongs: boolean;
}

interface SettingsContextValue {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

const KEY = 'xebrine.settings';

const DEFAULTS: Settings = {
  lrclibMode: 'strict',
  notifications: true,
  ignoreRules: DEFAULT_IGNORE_RULES,
  autoMixDuration: 15,
  eqEnabled: false,
  eqBands: [...EQ_FLAT],
  playerBarClickAction: 'copy',
  fsBlur: 56,
  fsSaturate: 1.35,
  reducedMotion: false,
  announceTrackChanges: false,
  tagExplicitSongs: false
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const merged = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    return { ...merged, eqBands: normalizeBands(merged.eqBands) };
  } catch {
    return DEFAULTS;
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
