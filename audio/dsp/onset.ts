import type { OnsetEnvelope } from './types';
import { RealFft } from './fft';

export const FFT_SIZE = 1024;
export const HOP_SIZE = 256;

const BAND_COUNT = 64;
const BAND_LOW_HZ = 30;
const BAND_HIGH_HZ = 10000;
const LOW_BAND_EMPHASIS_COUNT = 12;
const LOW_BAND_EMPHASIS = 1.5;
const FLUX_LOOKBACK = 2;
const LOG_COMPRESSION = 100;
const DETREND_SECONDS = 1;

interface Filterbank {
  bin_start: Int32Array;
  bin_count: Int32Array;
  weight_offset: Int32Array;
  weights: Float32Array;
}

function build_filterbank(sample_rate: number, fft_size: number): Filterbank {
  const bin_hz = sample_rate / fft_size;
  const nyquist_bins = fft_size / 2;
  const high = Math.min(BAND_HIGH_HZ, sample_rate * 0.475);
  const edges = new Float64Array(BAND_COUNT + 2);
  for (let index = 0; index < BAND_COUNT + 2; index++) {
    edges[index] =
      BAND_LOW_HZ * Math.pow(high / BAND_LOW_HZ, index / (BAND_COUNT + 1));
  }

  const bin_start = new Int32Array(BAND_COUNT);
  const bin_count = new Int32Array(BAND_COUNT);
  const weight_offset = new Int32Array(BAND_COUNT);
  const weight_chunks: number[] = [];
  for (let band = 0; band < BAND_COUNT; band++) {
    const left = edges[band];
    const center = edges[band + 1];
    const right = edges[band + 2];
    let start = Math.max(1, Math.ceil(left / bin_hz));
    const end = Math.min(nyquist_bins, Math.floor(right / bin_hz));
    const band_weights: number[] = [];
    for (let bin = start; bin <= end; bin++) {
      const frequency = bin * bin_hz;
      const weight =
        frequency <= center
          ? (frequency - left) / (center - left)
          : (right - frequency) / (right - center);
      band_weights.push(Math.max(0, weight));
    }

    let weight_sum = 0;
    for (const weight of band_weights) weight_sum += weight;
    if (band_weights.length === 0 || weight_sum <= 0) {
      start = Math.min(nyquist_bins, Math.max(1, Math.round(center / bin_hz)));
      band_weights.length = 0;
      band_weights.push(1);
      weight_sum = 1;
    }

    bin_start[band] = start;
    bin_count[band] = band_weights.length;
    weight_offset[band] = weight_chunks.length;
    for (const weight of band_weights) weight_chunks.push(weight / weight_sum);
  }

  return {
    bin_start,
    bin_count,
    weight_offset,
    weights: Float32Array.from(weight_chunks)
  };
}

export function onset_envelope(samples: Float32Array, sample_rate: number): OnsetEnvelope {
  const frame_count = Math.max(
    0,
    Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1
  );
  const fps = sample_rate / HOP_SIZE;
  const env = new Float32Array(frame_count);
  if (frame_count < 4) return { env, fps };

  const real_fft = new RealFft(FFT_SIZE);
  const filterbank = build_filterbank(sample_rate, FFT_SIZE);
  const window = new Float32Array(FFT_SIZE);
  for (let index = 0; index < FFT_SIZE; index++) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)));
  }

  const frame = new Float32Array(FFT_SIZE);
  const magnitudes = new Float32Array(FFT_SIZE / 2 + 1);
  const history_length = FLUX_LOOKBACK + 1;
  const history: Float32Array[] = [];
  for (let index = 0; index < history_length; index++) {
    history.push(new Float32Array(BAND_COUNT));
  }

  for (let frame_index = 0; frame_index < frame_count; frame_index++) {
    const sample_offset = frame_index * HOP_SIZE;
    for (let index = 0; index < FFT_SIZE; index++) {
      frame[index] = samples[sample_offset + index] * window[index];
    }
    real_fft.magnitudes(frame, magnitudes);

    const bands = history[frame_index % history_length];
    for (let band = 0; band < BAND_COUNT; band++) {
      let energy = 0;
      const start = filterbank.bin_start[band];
      const count = filterbank.bin_count[band];
      const weight_offset = filterbank.weight_offset[band];
      for (let index = 0; index < count; index++) {
        energy += filterbank.weights[weight_offset + index] * magnitudes[start + index];
      }
      bands[band] = Math.log1p(LOG_COMPRESSION * energy);
    }

    if (frame_index >= FLUX_LOOKBACK) {
      const previous = history[(frame_index - FLUX_LOOKBACK) % history_length];
      let flux = 0;
      for (let band = 0; band < BAND_COUNT; band++) {
        let previous_max = previous[band];
        if (band > 0 && previous[band - 1] > previous_max) {
          previous_max = previous[band - 1];
        }
        if (band < BAND_COUNT - 1 && previous[band + 1] > previous_max) {
          previous_max = previous[band + 1];
        }
        const difference = bands[band] - previous_max;
        if (difference > 0) {
          flux +=
            band < LOW_BAND_EMPHASIS_COUNT
              ? difference * LOW_BAND_EMPHASIS
              : difference;
        }
      }
      env[frame_index] = flux;
    }
  }

  const detrend_window = Math.max(1, Math.round(fps * DETREND_SECONDS));
  const half_window = Math.floor(detrend_window / 2);
  const prefix = new Float64Array(frame_count + 1);
  for (let frame_index = 0; frame_index < frame_count; frame_index++) {
    prefix[frame_index + 1] = prefix[frame_index] + env[frame_index];
  }

  let sum_squares = 0;
  for (let frame_index = 0; frame_index < frame_count; frame_index++) {
    const low = Math.max(0, frame_index - half_window);
    const high = Math.min(frame_count, frame_index + half_window + 1);
    const mean = (prefix[high] - prefix[low]) / (high - low);
    const value = env[frame_index] - mean;
    env[frame_index] = value > 0 ? value : 0;
    sum_squares += env[frame_index] * env[frame_index];
  }

  const standard_deviation = Math.sqrt(sum_squares / frame_count);
  if (standard_deviation > 1e-9) {
    for (let frame_index = 0; frame_index < frame_count; frame_index++) {
      env[frame_index] /= standard_deviation;
    }
  }
  return { env, fps };
}
