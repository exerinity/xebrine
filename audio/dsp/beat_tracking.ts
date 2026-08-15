const DP_TIGHTNESS = 100;
const BEAT_TRIM_RATIO = 0.02;

function gaussian_smooth(values: Float32Array, sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 4));
  const kernel = new Float32Array(2 * radius + 1);
  let kernel_sum = 0;
  for (let offset = -radius; offset <= radius; offset++) {
    const value = Math.exp((-0.5 * offset * offset) / (sigma * sigma));
    kernel[offset + radius] = value;
    kernel_sum += value;
  }
  for (let index = 0; index < kernel.length; index++) kernel[index] /= kernel_sum;

  const output = new Float32Array(values.length);
  for (let position = 0; position < values.length; position++) {
    let sum = 0;
    let weight_sum = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const index = position + offset;
      if (index < 0 || index >= values.length) continue;
      sum += values[index] * kernel[offset + radius];
      weight_sum += kernel[offset + radius];
    }
    output[position] = weight_sum > 0 ? sum / weight_sum : 0;
  }
  return output;
}

export function track_beats(env: Float32Array, fps: number, bpm: number): number[] {
  const frame_count = env.length;
  if (frame_count === 0 || !(bpm > 0)) return [];
  const period = (fps * 60) / bpm;
  const local = gaussian_smooth(env, Math.max(1, period / 32));

  const minimum_delay = Math.max(1, Math.round(period * 0.5));
  const maximum_delay = Math.min(Math.round(period * 2), frame_count - 1);
  if (maximum_delay <= minimum_delay) return [];

  const penalty = new Float64Array(maximum_delay - minimum_delay + 1);
  for (let delay = minimum_delay; delay <= maximum_delay; delay++) {
    const distance = Math.log(delay / period);
    penalty[delay - minimum_delay] = DP_TIGHTNESS * distance * distance;
  }

  const cumulative_score = new Float64Array(frame_count);
  const backlink = new Int32Array(frame_count).fill(-1);
  for (let position = 0; position < frame_count; position++) {
    let best = -Infinity;
    let best_index = -1;
    const low = Math.max(0, position - maximum_delay);
    const high = position - minimum_delay;
    for (let previous = low; previous <= high; previous++) {
      const value =
        cumulative_score[previous] - penalty[position - previous - minimum_delay];
      if (value > best) {
        best = value;
        best_index = previous;
      }
    }
    if (best_index >= 0 && best > 0) {
      cumulative_score[position] = local[position] + best;
      backlink[position] = best_index;
    } else {
      cumulative_score[position] = local[position];
    }
  }

  let start = frame_count - 1;
  let start_score = -Infinity;
  const tail_start = Math.max(0, frame_count - Math.round(period * 2));
  for (let position = tail_start; position < frame_count; position++) {
    if (cumulative_score[position] > start_score) {
      start_score = cumulative_score[position];
      start = position;
    }
  }

  const frames: number[] = [];
  for (let position = start; position >= 0; position = backlink[position]) {
    frames.push(position);
    if (backlink[position] < 0) break;
  }
  frames.reverse();

  let peak = 0;
  for (let position = 0; position < frame_count; position++) {
    if (local[position] > peak) peak = local[position];
  }
  const floor = peak * BEAT_TRIM_RATIO;
  let first = 0;
  let last = frames.length - 1;
  while (first < last && local[frames[first]] < floor) first++;
  while (last > first && local[frames[last]] < floor) last--;

  const beats: number[] = [];
  for (let index = first; index <= last; index++) {
    const position = frames[index];
    let refined = position;
    if (position > 0 && position < frame_count - 1) {
      const before = local[position - 1];
      const at = local[position];
      const after = local[position + 1];
      const denominator = before - 2 * at + after;
      if (Math.abs(denominator) > 1e-12) {
        const delta = (0.5 * (before - after)) / denominator;
        if (Math.abs(delta) <= 0.5) refined = position + delta;
      }
    }
    beats.push(refined);
  }
  return beats;
}
