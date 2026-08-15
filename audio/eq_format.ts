import { EQ_PRESETS } from './eq_constants';

export function format_db(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}

export function match_preset(bands: number[]): string | null {
  if (bands.every((value) => value === 0)) return 'Flat';
  for (const [name, values] of Object.entries(EQ_PRESETS)) {
    if (
      bands.length === values.length &&
      values.every((value, index) => value === bands[index])
    ) {
      return name;
    }
  }
  return null;
}

export function format_band_frequency(frequency: number): string {
  if (frequency >= 1000) {
    const kilohertz = frequency / 1000;
    return `${Number.isInteger(kilohertz) ? kilohertz : kilohertz.toFixed(1)}k`;
  }
  return String(frequency);
}
