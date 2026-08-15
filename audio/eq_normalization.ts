import {
  EQ_BAND_COUNT,
  EQ_FLAT,
  EQ_INTENSITY_DEFAULT,
  EQ_INTENSITY_MAX,
  EQ_INTENSITY_MIN,
  EQ_MAX,
  EQ_MIN,
  EQ_PREAMP_DEFAULT,
  EQ_PREAMP_MAX,
  EQ_PREAMP_MIN
} from './eq_constants';

export function normalize_bands(bands: unknown): number[] {
  if (!Array.isArray(bands) || bands.length !== EQ_BAND_COUNT) return [...EQ_FLAT];
  return bands.map((value) => {
    const number =
      typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.max(EQ_MIN, Math.min(EQ_MAX, number));
  });
}

export function normalize_preamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return EQ_PREAMP_DEFAULT;
  }
  return Math.max(EQ_PREAMP_MIN, Math.min(EQ_PREAMP_MAX, value));
}

export function normalize_intensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return EQ_INTENSITY_DEFAULT;
  }
  return Math.max(EQ_INTENSITY_MIN, Math.min(EQ_INTENSITY_MAX, value));
}

export function db_to_gain(db: number): number {
  return 10 ** (db / 20);
}
