import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LrclibMode } from '../api/lrclib';
import { DEFAULT_IGNORE_RULES, type IgnoreRules } from '../utils/ignore_rules';

export interface Settings {
  lrclibMode: LrclibMode;
  notifications: boolean;
  ignoreRules: IgnoreRules;
}

interface SettingsContextValue {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

const KEY = 'xebrine.settings';

const DEFAULTS: Settings = {
  lrclibMode: 'strict',
  notifications: true,
  ignoreRules: DEFAULT_IGNORE_RULES
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
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
