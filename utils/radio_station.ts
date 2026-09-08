import type { radio_station_record } from '../api/radio_browser';

export function radio_homepage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function radio_location(station: Pick<radio_station_record, 'state' | 'countrycode'>): string {
  let country = station.countrycode;
  try {
    if (country) country = new Intl.DisplayNames(undefined, { type: 'region' }).of(country) ?? country;
  } catch {
    country = station.countrycode;
  }
  return [station.state, country].filter(Boolean).join(', ');
}
