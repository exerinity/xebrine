import { DEFAULT_SETTINGS } from '../context/settings_context';
import { normalizeIgnoreRules } from './ignore_rules';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

function normalize(out) {
  if ('ignoreRules' in out) {
    out.ignoreRules = normalizeIgnoreRules(out.ignoreRules);
  }
  return out;
}

function serialize(value) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function deserialize(key, raw) {
  const def = DEFAULT_SETTINGS[key];
  try {
    if (typeof def === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    if (typeof def === 'boolean') return raw === 'true';
    if (typeof def === 'object' && def !== null) return JSON.parse(raw);
    return raw;
  } catch {
    return undefined;
  }
}

export function settingsToParams(settings) {
  const params = new URLSearchParams();
  for (const key of SETTING_KEYS) {
    params.set(key, serialize(settings[key]));
  }
  return params.toString();
}

export function paramsToSettings(params) {
  const out = {};
  for (const key of SETTING_KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;
    const value = deserialize(key, raw);
    if (value !== undefined) out[key] = value;
  }
  return normalize(out);
}

export function parseSettingsJson(text) {
  const parsed = JSON.parse(text);
  const out = {};
  for (const key of SETTING_KEYS) {
    if (key in parsed) out[key] = parsed[key];
  }
  return normalize(out);
}
