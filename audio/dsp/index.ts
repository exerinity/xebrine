import { fit_beat_grid } from './beat_grid';
import { track_beats } from './beat_tracking';
import type { DspAnalysis } from './types';
import { FFT_SIZE, HOP_SIZE, onset_envelope } from './onset';
import { estimate_tempo } from './tempo';

const MIN_ANALYSIS_SECONDS = 8;
const MIN_GRID_BEATS = 4;

function clamp_01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function analyze_samples(
  samples: Float32Array,
  sample_rate: number
): DspAnalysis {
  if (!(sample_rate > 0)) throw new Error('invalid sample rate');
  if (samples.length < sample_rate * MIN_ANALYSIS_SECONDS) {
    throw new Error('audio too short for tempo analysis');
  }

  const { env, fps } = onset_envelope(samples, sample_rate);
  let energy = 0;
  for (let index = 0; index < env.length; index++) energy += env[index];
  if (energy <= 0) return { bpm: 0, confidence: 0, beats: [] };

  const tempo = estimate_tempo(env, fps);
  if (!tempo) return { bpm: 0, confidence: 0, beats: [] };

  const beat_frames = track_beats(env, fps, tempo.bpm);
  const beats = beat_frames.map(
    (frame) => (frame * HOP_SIZE + FFT_SIZE / 2) / sample_rate
  );
  const fit =
    beats.length >= MIN_GRID_BEATS
      ? fit_beat_grid(beats, -Infinity, Infinity)
      : null;

  const bpm = fit ? 60 / fit.period : tempo.bpm;
  const tempo_confidence = clamp_01((tempo.salience - 1.5) / 5);
  const agreement_confidence = tempo.agreement;
  const regularity_confidence = fit
    ? clamp_01(1 - fit.rms / (0.08 * fit.period))
    : 0.3;
  const strength_confidence = clamp_01(tempo.raw_strength / 0.25);
  let confidence = clamp_01(
    Math.cbrt(tempo_confidence * agreement_confidence * regularity_confidence) *
      strength_confidence
  );

  let octave_error = Math.abs(Math.log2(bpm / tempo.bpm)) % 1;
  octave_error = Math.min(octave_error, 1 - octave_error);
  if (octave_error > Math.log2(1.06)) confidence *= 0.5;

  return {
    bpm: Math.round(bpm * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    beats
  };
}

export type { BeatGridFit, DspAnalysis, OnsetEnvelope, TempoEstimate } from './types';
export { fit_beat_grid } from './beat_grid';
export { RealFft } from './fft';
export { onset_envelope } from './onset';
export { estimate_tempo } from './tempo';
export { track_beats } from './beat_tracking';
