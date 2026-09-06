import { clamp } from '../../../utils/format';
import { MAX_VOLUME, type RepeatMode } from './types';

const VOLUME_KEY = 'xebrine.volume';
const REPEAT_KEY = 'xebrine.repeat';
const AUTOMIX_KEY = 'xebrine.automix';

export function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  const volume = raw === null ? Number.NaN : Number.parseFloat(raw);
  return Number.isFinite(volume) ? clamp(volume, 0, MAX_VOLUME) : 1;
}

export function saveVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    null;
  }
}

export function loadRepeat(): RepeatMode {
  const raw = localStorage.getItem(REPEAT_KEY);
  return raw === 'all' || raw === 'one' ? raw : 'off';
}

export function saveRepeat(repeatMode: RepeatMode) {
  try {
    localStorage.setItem(REPEAT_KEY, repeatMode);
  } catch {
    null;
  }
}

export function loadAutoMix(): boolean {
  return localStorage.getItem(AUTOMIX_KEY) === '1';
}

export function saveAutoMix(enabled: boolean) {
  try {
    localStorage.setItem(AUTOMIX_KEY, enabled ? '1' : '0');
  } catch {
    null;
  }
}
