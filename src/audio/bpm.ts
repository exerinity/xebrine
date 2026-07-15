import { fitBeatGrid, type BeatGridFit } from './bpm_dsp';

export interface TrackAnalysis {
  bpm: number;
  confidence: number;
  beats: number[];
}

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_ANALYZE_SECONDS = 900;

interface AnalyzeResponse {
  id: number;
  ok: boolean;
  bpm?: number;
  confidence?: number;
  beats?: number[];
  error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: TrackAnalysis) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./bpm_worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AnalyzeResponse>) => {
      const { id, ok, bpm, confidence, beats, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok && bpm !== undefined && confidence !== undefined) {
        p.resolve({ bpm, confidence, beats: beats ?? [] });
      } else {
        p.reject(new Error(error ?? 'unknown BPM analysis error'));
      }
    };
  }
  return worker;
}

async function decodeMono(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const length = Math.min(
    audioBuffer.length,
    Math.floor(audioBuffer.sampleRate * MAX_ANALYZE_SECONDS)
  );
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice(0, length);
  }
  const mono = new Float32Array(length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / audioBuffer.numberOfChannels;
  }
  return mono;
}

const CACHE_MAX = 40;
const cache = new Map<string, TrackAnalysis>();

function cachePut(key: string, value: TrackAnalysis) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function analyzeTrack(trackId: string, file: File): Promise<TrackAnalysis> {
  const cached = cache.get(trackId);
  if (cached) return cached;

  const mono = await decodeMono(file);
  const id = nextId++;
  const result = await new Promise<TrackAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, mono, sampleRate: ANALYSIS_SAMPLE_RATE }, [mono.buffer]);
  });
  cachePut(trackId, result);
  return result;
}

export function classifyBpmDiff(a: number, b: number): 'green' | 'orange' | 'red' {
  if (!(a > 0) || !(b > 0)) return 'red';
  let octaves = Math.abs(Math.log2(a / b)) % 1;
  octaves = Math.min(octaves, 1 - octaves);
  const stretch = Math.pow(2, octaves) - 1;
  if (stretch < 0.04) return 'green';
  if (stretch <= 0.08) return 'orange';
  return 'red';
}

export interface CrossfadePlan {
  incomingOffset: number;
  fadeSeconds: number;
  playbackRate: number;
}

export function equalPowerFadeCurves(steps = 64): { fadeOut: Float32Array; fadeIn: Float32Array } {
  const fadeOut = new Float32Array(steps);
  const fadeIn = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = steps === 1 ? 0 : i / (steps - 1);
    fadeOut[i] = Math.cos(0.5 * Math.PI * x);
    fadeIn[i] = Math.sin(0.5 * Math.PI * x);
  }
  return { fadeOut, fadeIn };
}

const MAX_STRETCH = 1.08;
const MIN_TEMPO_CONFIDENCE = 0.2;
const OUT_GRID_LOOKBACK_SECONDS = 45;
const OUT_GRID_LOOKAHEAD_SECONDS = 15;
const IN_GRID_SECONDS = 75;
const BAR_QUANTIZE_MIN_BEATS = 8;

function medianBeatPeriod(a: TrackAnalysis): number {
  if (a.beats.length >= 3) {
    const diffs: number[] = [];
    for (let i = 1; i < a.beats.length; i++) {
      const d = a.beats[i] - a.beats[i - 1];
      if (d > 0.2 && d < 2) diffs.push(d);
    }
    if (diffs.length >= 2) {
      diffs.sort((x, y) => x - y);
      const mid = diffs.length >> 1;
      return diffs.length % 2 === 1 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
    }
  }
  return a.bpm > 0 ? 60 / a.bpm : 0.5;
}

function foldPeriodTowards(period: number, reference: number): number {
  let best = period;
  for (const factor of [0.5, 2]) {
    const candidate = period * factor;
    if (Math.abs(Math.log2(candidate / reference)) < Math.abs(Math.log2(best / reference))) {
      best = candidate;
    }
  }
  return best;
}

export function planCrossfade(
  outgoing: TrackAnalysis | null,
  incoming: TrackAnalysis | null,
  outgoingTime: number,
  requestedFade: number,
  matchTempo: boolean
): CrossfadePlan {
  if (!outgoing || !incoming || outgoing.bpm <= 0 || incoming.bpm <= 0 || !matchTempo) {
    return { incomingOffset: 0, fadeSeconds: requestedFade, playbackRate: 1 };
  }
  if (outgoing.confidence < MIN_TEMPO_CONFIDENCE || incoming.confidence < MIN_TEMPO_CONFIDENCE) {
    return { incomingOffset: 0, fadeSeconds: requestedFade, playbackRate: 1 };
  }

  const outGrid: BeatGridFit | null = fitBeatGrid(
    outgoing.beats,
    outgoingTime - OUT_GRID_LOOKBACK_SECONDS,
    outgoingTime + requestedFade + OUT_GRID_LOOKAHEAD_SECONDS
  );
  const inGrid: BeatGridFit | null = fitBeatGrid(incoming.beats, 0, IN_GRID_SECONDS);

  const periodOut = outGrid?.period ?? medianBeatPeriod(outgoing);
  const periodInRaw = inGrid?.period ?? medianBeatPeriod(incoming);
  if (!(periodOut > 0) || !(periodInRaw > 0)) {
    return { incomingOffset: 0, fadeSeconds: requestedFade, playbackRate: 1 };
  }

  const periodIn = foldPeriodTowards(periodInRaw, periodOut);
  let rate = periodIn / periodOut;
  if (!Number.isFinite(rate) || rate <= 0 || Math.abs(Math.log2(rate)) > Math.log2(MAX_STRETCH)) {
    rate = 1;
  }

  let fadeSeconds = requestedFade;
  const beatsInFade = Math.floor(requestedFade / periodOut + 1e-6);
  if (beatsInFade >= 1) {
    const quantized =
      beatsInFade >= BAR_QUANTIZE_MIN_BEATS ? beatsInFade - (beatsInFade % 4) : beatsInFade;
    fadeSeconds = Math.min(requestedFade, quantized * periodOut);
  }

  if (!outGrid) {
    return { incomingOffset: 0, fadeSeconds, playbackRate: rate };
  }

  const kNext = Math.ceil((outgoingTime - outGrid.phase) / periodOut - 1e-4);
  const dA = outGrid.phase + kNext * periodOut - outgoingTime;

  const phaseIn = inGrid?.phase ?? incoming.beats[0];
  if (phaseIn === undefined) {
    return { incomingOffset: 0, fadeSeconds, playbackRate: rate };
  }

  const target = rate * dA;
  let incomingOffset = (((phaseIn - target) % periodIn) + periodIn) % periodIn;
  if (!Number.isFinite(incomingOffset) || incomingOffset < 0) incomingOffset = 0;

  return { incomingOffset, fadeSeconds, playbackRate: rate };
}
