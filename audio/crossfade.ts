import { fit_beat_grid, type BeatGridFit } from './dsp';
import type { CrossfadePlan, TrackAnalysis } from './bpm_types';

const MAX_STRETCH = 1.08;
const MIN_TEMPO_CONFIDENCE = 0.2;
const OUT_GRID_LOOKBACK_SECONDS = 45;
const OUT_GRID_LOOKAHEAD_SECONDS = 15;
const IN_GRID_SECONDS = 75;
const BAR_QUANTIZE_MIN_BEATS = 8;

export function classify_bpm_diff(
  first: number,
  second: number
): 'green' | 'orange' | 'red' {
  if (!(first > 0) || !(second > 0)) return 'red';
  let octaves = Math.abs(Math.log2(first / second)) % 1;
  octaves = Math.min(octaves, 1 - octaves);
  const stretch = Math.pow(2, octaves) - 1;
  if (stretch < 0.04) return 'green';
  if (stretch <= 0.08) return 'orange';
  return 'red';
}

export function equal_power_fade_curves(
  steps = 64
): { fade_out: Float32Array; fade_in: Float32Array } {
  const fade_out = new Float32Array(steps);
  const fade_in = new Float32Array(steps);
  for (let index = 0; index < steps; index++) {
    const position = steps === 1 ? 0 : index / (steps - 1);
    fade_out[index] = Math.cos(0.5 * Math.PI * position);
    fade_in[index] = Math.sin(0.5 * Math.PI * position);
  }
  return { fade_out, fade_in };
}

function median_beat_period(analysis: TrackAnalysis): number {
  if (analysis.beats.length >= 3) {
    const differences: number[] = [];
    for (let index = 1; index < analysis.beats.length; index++) {
      const difference = analysis.beats[index] - analysis.beats[index - 1];
      if (difference > 0.2 && difference < 2) differences.push(difference);
    }
    if (differences.length >= 2) {
      differences.sort((left, right) => left - right);
      const middle = differences.length >> 1;
      return differences.length % 2 === 1
        ? differences[middle]
        : (differences[middle - 1] + differences[middle]) / 2;
    }
  }
  return analysis.bpm > 0 ? 60 / analysis.bpm : 0.5;
}

function fold_period_towards(period: number, reference: number): number {
  let best = period;
  for (const factor of [0.5, 2]) {
    const candidate = period * factor;
    if (
      Math.abs(Math.log2(candidate / reference)) <
      Math.abs(Math.log2(best / reference))
    ) {
      best = candidate;
    }
  }
  return best;
}

export function plan_crossfade(
  outgoing: TrackAnalysis | null,
  incoming: TrackAnalysis | null,
  outgoing_time: number,
  requested_fade: number,
  match_tempo: boolean
): CrossfadePlan {
  if (!outgoing || !incoming || outgoing.bpm <= 0 || incoming.bpm <= 0 || !match_tempo) {
    return { incoming_offset: 0, fade_seconds: requested_fade, playback_rate: 1 };
  }
  if (
    outgoing.confidence < MIN_TEMPO_CONFIDENCE ||
    incoming.confidence < MIN_TEMPO_CONFIDENCE
  ) {
    return { incoming_offset: 0, fade_seconds: requested_fade, playback_rate: 1 };
  }

  const outgoing_grid: BeatGridFit | null = fit_beat_grid(
    outgoing.beats,
    outgoing_time - OUT_GRID_LOOKBACK_SECONDS,
    outgoing_time + requested_fade + OUT_GRID_LOOKAHEAD_SECONDS
  );
  const incoming_grid: BeatGridFit | null = fit_beat_grid(
    incoming.beats,
    0,
    IN_GRID_SECONDS
  );

  const outgoing_period = outgoing_grid?.period ?? median_beat_period(outgoing);
  const raw_incoming_period = incoming_grid?.period ?? median_beat_period(incoming);
  if (!(outgoing_period > 0) || !(raw_incoming_period > 0)) {
    return { incoming_offset: 0, fade_seconds: requested_fade, playback_rate: 1 };
  }

  const incoming_period = fold_period_towards(raw_incoming_period, outgoing_period);
  let playback_rate = incoming_period / outgoing_period;
  if (
    !Number.isFinite(playback_rate) ||
    playback_rate <= 0 ||
    Math.abs(Math.log2(playback_rate)) > Math.log2(MAX_STRETCH)
  ) {
    playback_rate = 1;
  }

  let fade_seconds = requested_fade;
  const fade_beat_count = Math.floor(requested_fade / outgoing_period + 1e-6);
  if (fade_beat_count >= 1) {
    const quantized =
      fade_beat_count >= BAR_QUANTIZE_MIN_BEATS
        ? fade_beat_count - (fade_beat_count % 4)
        : fade_beat_count;
    fade_seconds = Math.min(requested_fade, quantized * outgoing_period);
  }

  if (!outgoing_grid) {
    return { incoming_offset: 0, fade_seconds, playback_rate };
  }

  const next_beat_index = Math.ceil(
    (outgoing_time - outgoing_grid.phase) / outgoing_period - 1e-4
  );
  const outgoing_delay =
    outgoing_grid.phase + next_beat_index * outgoing_period - outgoing_time;

  const incoming_phase = incoming_grid?.phase ?? incoming.beats[0];
  if (incoming_phase === undefined) {
    return { incoming_offset: 0, fade_seconds, playback_rate };
  }

  const target = playback_rate * outgoing_delay;
  let incoming_offset =
    ((incoming_phase - target) % incoming_period + incoming_period) % incoming_period;
  if (!Number.isFinite(incoming_offset) || incoming_offset < 0) incoming_offset = 0;

  return { incoming_offset, fade_seconds, playback_rate };
}
