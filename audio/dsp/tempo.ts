import type { TempoEstimate } from './types';

const ACF_WINDOW_SECONDS = 18;
const ACF_HOP_SECONDS = 4;
const BPM_MIN = 50;
const BPM_MAX = 210;
const BPM_GRID_SIZE = 480;
const COMB_WEIGHTS = [1, 0.65, 0.4, 0.25];
const TEMPO_PRIOR_CENTER = 122;
const TEMPO_PRIOR_SIGMA_OCTAVES = 0.8;
const OCTAVE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [
  [0.5, 1.05],
  [2, 1.05],
  [2 / 3, 1.25],
  [1.5, 1.25],
  [0.75, 1.35],
  [4 / 3, 1.35]
];

function normalized_autocorrelation(
  env: Float32Array,
  start: number,
  length: number,
  max_lag: number
): Float32Array {
  const centered = new Float64Array(length);
  let mean = 0;
  for (let index = 0; index < length; index++) mean += env[start + index];
  mean /= length;
  for (let index = 0; index < length; index++) {
    centered[index] = env[start + index] - mean;
  }

  const autocorrelation = new Float32Array(max_lag + 1);
  let zero_lag = 0;
  for (let index = 0; index < length; index++) {
    zero_lag += centered[index] * centered[index];
  }
  zero_lag /= length;
  if (zero_lag < 1e-12) return autocorrelation;

  for (let lag = 1; lag <= max_lag; lag++) {
    let sum = 0;
    const end = length - lag;
    for (let index = 0; index < end; index++) {
      sum += centered[index] * centered[index + lag];
    }
    const value = sum / end / zero_lag;
    autocorrelation[lag] = value > 0 ? value : 0;
  }
  autocorrelation[0] = 1;
  return autocorrelation;
}

function tempo_prior(bpm: number): number {
  const distance = Math.log2(bpm / TEMPO_PRIOR_CENTER) / TEMPO_PRIOR_SIGMA_OCTAVES;
  return Math.exp(-0.5 * distance * distance);
}

function comb_score(autocorrelation: Float32Array, fps: number, bpm: number): number {
  const base_lag = (fps * 60) / bpm;
  let score = 0;
  let weight_sum = 0;
  for (let harmonic = 1; harmonic <= COMB_WEIGHTS.length; harmonic++) {
    const lag = base_lag * harmonic;
    const lag_index = Math.floor(lag);
    if (lag_index + 1 > autocorrelation.length - 1) break;
    const fraction = lag - lag_index;
    const value =
      autocorrelation[lag_index] * (1 - fraction) +
      autocorrelation[lag_index + 1] * fraction;
    const weight = COMB_WEIGHTS[harmonic - 1];
    score += weight * value;
    weight_sum += weight;
  }
  return weight_sum > 0 ? score / weight_sum : 0;
}

function bpm_at_grid_index(index: number): number {
  return BPM_MIN * Math.pow(BPM_MAX / BPM_MIN, index / (BPM_GRID_SIZE - 1));
}

interface GridBpm {
  bpm: number;
  score: number;
  mean_score: number;
}

function best_grid_bpm(autocorrelation: Float32Array, fps: number): GridBpm {
  let best_index = 0;
  let best_score = -1;
  let total = 0;
  const scores = new Float64Array(BPM_GRID_SIZE);
  for (let index = 0; index < BPM_GRID_SIZE; index++) {
    const bpm = bpm_at_grid_index(index);
    const score = comb_score(autocorrelation, fps, bpm) * tempo_prior(bpm);
    scores[index] = score;
    total += score;
    if (score > best_score) {
      best_score = score;
      best_index = index;
    }
  }

  let refined_index = best_index;
  if (best_index > 0 && best_index < BPM_GRID_SIZE - 1) {
    const before = scores[best_index - 1];
    const at = scores[best_index];
    const after = scores[best_index + 1];
    const denominator = before - 2 * at + after;
    if (Math.abs(denominator) > 1e-12) {
      const delta = (0.5 * (before - after)) / denominator;
      if (Math.abs(delta) <= 0.5) refined_index = best_index + delta;
    }
  }

  return {
    bpm: bpm_at_grid_index(refined_index),
    score: best_score,
    mean_score: total / BPM_GRID_SIZE
  };
}

export function estimate_tempo(env: Float32Array, fps: number): TempoEstimate | null {
  const max_lag = Math.ceil(((fps * 60) / BPM_MIN) * COMB_WEIGHTS.length) + 2;
  let window_length = Math.round(fps * ACF_WINDOW_SECONDS);
  const hop = Math.max(1, Math.round(fps * ACF_HOP_SECONDS));
  if (window_length > env.length) window_length = env.length;
  if (window_length < Math.round(fps * 6)) return null;
  const lag_cap = Math.min(max_lag, window_length - 2);

  const windows: Float32Array[] = [];
  for (let start = 0; start + window_length <= env.length; start += hop) {
    windows.push(normalized_autocorrelation(env, start, window_length, lag_cap));
    if (start + hop + window_length > env.length && start + window_length < env.length) {
      windows.push(
        normalized_autocorrelation(env, env.length - window_length, window_length, lag_cap)
      );
      break;
    }
  }
  if (windows.length === 0) {
    windows.push(normalized_autocorrelation(env, 0, window_length, lag_cap));
  }

  const global_autocorrelation = new Float32Array(lag_cap + 1);
  const column: number[] = new Array(windows.length);
  for (let lag = 0; lag <= lag_cap; lag++) {
    for (let window_index = 0; window_index < windows.length; window_index++) {
      column[window_index] = windows[window_index][lag];
    }
    column.sort((left, right) => left - right);
    const middle = windows.length >> 1;
    global_autocorrelation[lag] =
      windows.length % 2 === 1
        ? column[middle]
        : (column[middle - 1] + column[middle]) / 2;
  }

  const global = best_grid_bpm(global_autocorrelation, fps);
  if (global.score <= 0) return null;

  const score_at = (bpm: number) =>
    comb_score(global_autocorrelation, fps, bpm) * tempo_prior(bpm);
  let chosen = global.bpm;
  let chosen_score = global.score;
  for (const [factor, threshold] of OCTAVE_CANDIDATES) {
    const candidate = global.bpm * factor;
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    const score = score_at(candidate);
    if (score > global.score * threshold && score > chosen_score) {
      chosen = candidate;
      chosen_score = score;
    }
  }

  let refined = chosen;
  let refined_score = chosen_score;
  for (let offset = -30; offset <= 30; offset++) {
    const candidate = chosen * (1 + offset * 0.001);
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    const score = score_at(candidate);
    if (score > refined_score) {
      refined_score = score;
      refined = candidate;
    }
  }

  let agreement = 0.85;
  if (windows.length >= 3) {
    let agreeing = 0;
    for (const autocorrelation of windows) {
      const local = best_grid_bpm(autocorrelation, fps);
      let error = Math.abs(Math.log2(local.bpm / refined)) % 1;
      error = Math.min(error, 1 - error);
      if (error < Math.log2(1.04)) agreeing++;
    }
    agreement = agreeing / windows.length;
  }

  const salience =
    global.mean_score > 1e-12 ? refined_score / global.mean_score : 0;
  const raw_strength = comb_score(global_autocorrelation, fps, refined);
  return { bpm: refined, salience, agreement, raw_strength };
}
