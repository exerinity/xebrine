import type { TrackAnalysis } from './bpm_types';

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_ANALYZE_SECONDS = 900;
const CACHE_MAX = 40;

interface AnalyzeResponse {
  id: number;
  ok: boolean;
  bpm?: number;
  confidence?: number;
  beats?: number[];
  error?: string;
}

interface PendingAnalysis {
  resolve: (result: TrackAnalysis) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let next_id = 1;
const pending = new Map<number, PendingAnalysis>();
const cache = new Map<string, TrackAnalysis>();

function get_worker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./bpm_worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
      const { id, ok, bpm, confidence, beats, error } = event.data;
      const analysis = pending.get(id);
      if (!analysis) return;
      pending.delete(id);
      if (ok && bpm !== undefined && confidence !== undefined) {
        analysis.resolve({ bpm, confidence, beats: beats ?? [] });
      } else {
        analysis.reject(new Error(error ?? 'unknown BPM analysis error'));
      }
    };
  }
  return worker;
}

async function decode_mono(file: File): Promise<Float32Array> {
  const array_buffer = await file.arrayBuffer();
  const context = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE);
  const audio_buffer = await context.decodeAudioData(array_buffer);
  const length = Math.min(
    audio_buffer.length,
    Math.floor(audio_buffer.sampleRate * MAX_ANALYZE_SECONDS)
  );
  if (audio_buffer.numberOfChannels === 1) {
    return audio_buffer.getChannelData(0).slice(0, length);
  }

  const mono = new Float32Array(length);
  for (let channel = 0; channel < audio_buffer.numberOfChannels; channel++) {
    const data = audio_buffer.getChannelData(channel);
    for (let index = 0; index < length; index++) {
      mono[index] += data[index] / audio_buffer.numberOfChannels;
    }
  }
  return mono;
}

function cache_put(key: string, value: TrackAnalysis) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function analyze_track(
  track_id: string,
  file: File
): Promise<TrackAnalysis> {
  const cached = cache.get(track_id);
  if (cached) return cached;

  const mono = await decode_mono(file);
  const id = next_id++;
  const result = await new Promise<TrackAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    get_worker().postMessage(
      { id, mono, sample_rate: ANALYSIS_SAMPLE_RATE },
      [mono.buffer]
    );
  });
  cache_put(track_id, result);
  return result;
}
