export const EQ_BANDS = [
  32, 45, 64, 95, 140, 200, 290, 415, 600, 860, 1200, 1800, 2600, 3700, 5300, 7700, 11000, 16000
];

export const EQ_BAND_COUNT = EQ_BANDS.length;
export const EQ_Q = 1.4;
export const EQ_MIN = -12;
export const EQ_MAX = 12;

export const EQ_PREAMP_MIN = -24;
export const EQ_PREAMP_MAX = 6;
export const EQ_PREAMP_DEFAULT = 0;

export const EQ_INTENSITY_MIN = 0;
export const EQ_INTENSITY_MAX = 1;
export const EQ_INTENSITY_DEFAULT = 1;

export const EQ_FLAT: number[] = EQ_BANDS.map(() => 0);

export const EQ_PRESETS: Record<string, number[]> = {
  'Bass boost': [7, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7],
  'Vocal boost': [-3, -3, -2, -1, 0, 1, 2, 4, 5, 5, 5, 4, 3, 2, 1, 0, -1, -2],
  House: [6, 6, 5, 3, 1, 0, -1, -2, -2, -1, 0, 1, 2, 3, 4, 4, 3, 2],
  Rock: [5, 5, 4, 2, 1, 0, -1, -1, 0, 1, 2, 2, 3, 3, 3, 2, 2, 1],
  'Spoken Word': [-5, -4, -3, -1, 1, 3, 4, 4, 4, 4, 3, 3, 2, 1, 0, -2, -3, -4],
  'Small Speakers': [-6, -5, -3, 0, 2, 3, 3, 2, 1, 1, 1, 2, 2, 2, 1, 0, -2, -4],
  TV: [3, 3, 2, 1, 2, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0, 0],
  Car: [7, 7, 6, 4, 2, 0, -1, -1, 0, 1, 2, 3, 4, 4, 5, 5, 5, 4],
  Quietness: [8, 7, 6, 4, 2, 1, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7],
  Loudness: [6, 6, 5, 4, 2, 1, 0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 6, 6]
};

export function normalizeBands(bands: unknown): number[] {
  if (!Array.isArray(bands) || bands.length !== EQ_BAND_COUNT) return [...EQ_FLAT];
  return bands.map((v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    return Math.max(EQ_MIN, Math.min(EQ_MAX, n));
  });
}

export function normalizePreamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EQ_PREAMP_DEFAULT;
  return Math.max(EQ_PREAMP_MIN, Math.min(EQ_PREAMP_MAX, value));
}

export function normalizeIntensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EQ_INTENSITY_DEFAULT;
  return Math.max(EQ_INTENSITY_MIN, Math.min(EQ_INTENSITY_MAX, value));
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

const RESPONSE_RATE = 48000;
const RESPONSE_POINTS = 241;

function peakingGainDb(freq: number, gainDb: number, q: number, at: number): number {
  if (gainDb === 0) return 0;
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * freq) / RESPONSE_RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const cw0 = Math.cos(w0);
  const b0 = 1 + alpha * a;
  const b1 = -2 * cw0;
  const b2 = 1 - alpha * a;
  const a0 = 1 + alpha / a;
  const a1 = -2 * cw0;
  const a2 = 1 - alpha / a;

  const w = (2 * Math.PI * at) / RESPONSE_RATE;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const numRe = b0 + b1 * c1 + b2 * c2;
  const numIm = -(b1 * s1 + b2 * s2);
  const denRe = a0 + a1 * c1 + a2 * c2;
  const denIm = -(a1 * s1 + a2 * s2);
  const den = Math.hypot(denRe, denIm);
  if (den === 0) return 0;
  return 20 * Math.log10(Math.hypot(numRe, numIm) / den);
}

export function eqPeakGainDb(bands: number[], intensity: number): number {
  const scaled = bands.map((v) => v * intensity);
  if (scaled.every((v) => v === 0)) return 0;
  let peak = 0;
  for (let i = 0; i < RESPONSE_POINTS; i++) {
    const at = 20 * 1000 ** (i / (RESPONSE_POINTS - 1));
    let sum = 0;
    for (let b = 0; b < EQ_BAND_COUNT; b++) {
      sum += peakingGainDb(EQ_BANDS[b], scaled[b], EQ_Q, at);
    }
    if (sum > peak) peak = sum;
  }
  return peak;
}

export function suggestedPreamp(bands: number[], intensity: number): number {
  const peak = eqPeakGainDb(bands, intensity);
  const value = Math.round(-peak * 2) / 2;
  return Math.max(EQ_PREAMP_MIN, Math.min(EQ_PREAMP_MAX, value));
}

export function formatDb(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}

export function matchPreset(bands: number[]): string | null {
  if (bands.every((v) => v === 0)) return 'Flat';
  for (const [name, vals] of Object.entries(EQ_PRESETS)) {
    if (bands.length === vals.length && vals.every((v, i) => v === bands[i])) return name;
  }
  return null;
}

export function formatBandFreq(freq: number): string {
  if (freq >= 1000) {
    const k = freq / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(freq);
}
