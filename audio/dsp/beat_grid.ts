import type { BeatGridFit } from './types';

const MIN_GRID_BEATS = 4;
const GRID_PERIOD_MIN = 0.2;
const GRID_PERIOD_MAX = 2;
const GRID_OUTLIER_FLOOR_SECONDS = 0.02;

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function assign_sequential_indices(beats: number[], period: number): number[] {
  const indices = new Array<number>(beats.length);
  indices[0] = 0;
  for (let index = 1; index < beats.length; index++) {
    indices[index] =
      indices[index - 1] +
      Math.max(1, Math.round((beats[index] - beats[index - 1]) / period));
  }
  return indices;
}

interface LeastSquaresGrid {
  period: number;
  phase: number;
}

function least_squares_grid(
  beats: number[],
  indices: number[]
): LeastSquaresGrid | null {
  const count = beats.length;
  let index_sum = 0;
  let beat_sum = 0;
  let squared_index_sum = 0;
  let index_beat_sum = 0;
  for (let index = 0; index < count; index++) {
    index_sum += indices[index];
    beat_sum += beats[index];
    squared_index_sum += indices[index] * indices[index];
    index_beat_sum += indices[index] * beats[index];
  }
  const denominator = count * squared_index_sum - index_sum * index_sum;
  if (Math.abs(denominator) < 1e-12) return null;
  const period =
    (count * index_beat_sum - index_sum * beat_sum) / denominator;
  const phase = (beat_sum - period * index_sum) / count;
  if (!(period > GRID_PERIOD_MIN && period < GRID_PERIOD_MAX)) return null;
  return { period, phase };
}

export function fit_beat_grid(
  beats: readonly number[],
  window_start: number,
  window_end: number
): BeatGridFit | null {
  let selected: number[] = [];
  for (const beat of beats) {
    if (beat >= window_start && beat <= window_end) selected.push(beat);
  }
  if (selected.length < 6) selected = [...beats];
  if (selected.length < MIN_GRID_BEATS) return null;

  const intervals: number[] = [];
  for (let index = 1; index < selected.length; index++) {
    const difference = selected[index] - selected[index - 1];
    if (difference >= GRID_PERIOD_MIN && difference <= GRID_PERIOD_MAX) {
      intervals.push(difference);
    }
  }
  if (intervals.length < 2) return null;

  let period = median(intervals);
  let points = selected;
  let indices = assign_sequential_indices(points, period);
  let fit: LeastSquaresGrid | null = null;

  for (let pass = 0; pass < 4; pass++) {
    fit = least_squares_grid(points, indices);
    if (!fit) return null;
    period = fit.period;
    const threshold = Math.max(0.08 * period, GRID_OUTLIER_FLOOR_SECONDS);
    const kept: number[] = [];
    for (let index = 0; index < points.length; index++) {
      const residual = points[index] - (fit.phase + fit.period * indices[index]);
      if (Math.abs(residual) <= threshold) kept.push(points[index]);
    }
    if (kept.length === points.length || kept.length < MIN_GRID_BEATS) break;
    points = kept;
    indices = assign_sequential_indices(points, period);
  }
  if (!fit) return null;

  let sum_squares = 0;
  for (let index = 0; index < points.length; index++) {
    const residual = points[index] - (fit.phase + fit.period * indices[index]);
    sum_squares += residual * residual;
  }
  return {
    period: fit.period,
    phase: fit.phase,
    rms: Math.sqrt(sum_squares / points.length),
    count: points.length
  };
}
