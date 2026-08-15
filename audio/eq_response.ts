import {
  EQ_BANDS,
  EQ_BAND_COUNT,
  EQ_PREAMP_MAX,
  EQ_PREAMP_MIN,
  EQ_Q
} from './eq_constants';

const RESPONSE_RATE = 48000;
const RESPONSE_POINTS = 241;

function peaking_gain_db(
  frequency: number,
  gain_db: number,
  quality: number,
  target_frequency: number
): number {
  if (gain_db === 0) return 0;
  const amplitude = 10 ** (gain_db / 40);
  const angular_frequency = (2 * Math.PI * frequency) / RESPONSE_RATE;
  const alpha = Math.sin(angular_frequency) / (2 * quality);
  const cosine = Math.cos(angular_frequency);
  const numerator_0 = 1 + alpha * amplitude;
  const numerator_1 = -2 * cosine;
  const numerator_2 = 1 - alpha * amplitude;
  const denominator_0 = 1 + alpha / amplitude;
  const denominator_1 = -2 * cosine;
  const denominator_2 = 1 - alpha / amplitude;

  const target_angular_frequency =
    (2 * Math.PI * target_frequency) / RESPONSE_RATE;
  const cosine_1 = Math.cos(target_angular_frequency);
  const sine_1 = Math.sin(target_angular_frequency);
  const cosine_2 = Math.cos(2 * target_angular_frequency);
  const sine_2 = Math.sin(2 * target_angular_frequency);
  const numerator_real =
    numerator_0 + numerator_1 * cosine_1 + numerator_2 * cosine_2;
  const numerator_imaginary = -(numerator_1 * sine_1 + numerator_2 * sine_2);
  const denominator_real =
    denominator_0 + denominator_1 * cosine_1 + denominator_2 * cosine_2;
  const denominator_imaginary =
    -(denominator_1 * sine_1 + denominator_2 * sine_2);
  const denominator = Math.hypot(denominator_real, denominator_imaginary);
  if (denominator === 0) return 0;
  return (
    20 *
    Math.log10(Math.hypot(numerator_real, numerator_imaginary) / denominator)
  );
}

export function eq_peak_gain_db(bands: number[], intensity: number): number {
  const scaled = bands.map((value) => value * intensity);
  if (scaled.every((value) => value === 0)) return 0;
  let peak = 0;
  for (let point = 0; point < RESPONSE_POINTS; point++) {
    const target_frequency = 20 * 1000 ** (point / (RESPONSE_POINTS - 1));
    let sum = 0;
    for (let band = 0; band < EQ_BAND_COUNT; band++) {
      sum += peaking_gain_db(
        EQ_BANDS[band],
        scaled[band],
        EQ_Q,
        target_frequency
      );
    }
    if (sum > peak) peak = sum;
  }
  return peak;
}

export function suggested_preamp(bands: number[], intensity: number): number {
  const peak = eq_peak_gain_db(bands, intensity);
  const value = Math.round(-peak * 2) / 2;
  return Math.max(EQ_PREAMP_MIN, Math.min(EQ_PREAMP_MAX, value));
}
