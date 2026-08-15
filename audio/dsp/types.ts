export interface DspAnalysis {
  bpm: number;
  confidence: number;
  beats: number[];
}

export interface BeatGridFit {
  period: number;
  phase: number;
  rms: number;
  count: number;
}

export interface OnsetEnvelope {
  env: Float32Array;
  fps: number;
}

export interface TempoEstimate {
  bpm: number;
  salience: number;
  agreement: number;
  raw_strength: number;
}
