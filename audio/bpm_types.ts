export interface TrackAnalysis {
  bpm: number;
  confidence: number;
  beats: number[];
}

export interface CrossfadePlan {
  incoming_offset: number;
  fade_seconds: number;
  playback_rate: number;
}
