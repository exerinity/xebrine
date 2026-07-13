import { DEFAULT_SETTINGS, type Settings } from '../context/settings_context';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

function serialize(value: unknown): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function deserialize<K extends keyof Settings>(key: K, raw: string): Settings[K] | undefined {
  const def = DEFAULT_SETTINGS[key];
  try {
    if (typeof def === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? (n as Settings[K]) : undefined;
    }
    if (typeof def === 'boolean') return (raw === 'true') as Settings[K];
    if (typeof def === 'object' && def !== null) return JSON.parse(raw) as Settings[K];
    return raw as Settings[K];
  } catch {
    return undefined;
  }
}

export function settingsToParams(settings: Settings): string {
  const params = new URLSearchParams();
  for (const key of SETTING_KEYS) {
    params.set(key, serialize(settings[key]));
  }
  return params.toString();
}

export function paramsToSettings(params: URLSearchParams): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;
    const value = deserialize(key, raw);
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<Settings>;
}

export function parseSettingsJson(text: string): Partial<Settings> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    if (key in parsed) out[key] = parsed[key];
  }
  return out as Partial<Settings>;
}
