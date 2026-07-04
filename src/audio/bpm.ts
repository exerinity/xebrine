export interface TrackAnalysis {
  bpm: number;
  confidence: number;
  beats: number[];
}

const ANALYZE_SECONDS = 60;

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
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const length = Math.min(audioBuffer.length, Math.floor(audioBuffer.sampleRate * ANALYZE_SECONDS));
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
    getWorker().postMessage({ id, mono }, [mono.buffer]);
  });
  cachePut(trackId, result);
  return result;
}

export function classifyBpmDiff(a: number, b: number): 'green' | 'orange' | 'red' {
  const diff = Math.abs(a - b);
  if (diff < 5) return 'green';
  if (diff <= 20) return 'orange';
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

function beatPeriod(a: TrackAnalysis): number {
  if (a.beats.length >= 3) {
    const diffs: number[] = [];
    for (let i = 1; i < a.beats.length; i++) diffs.push(a.beats[i] - a.beats[i - 1]);
    diffs.sort((x, y) => x - y);
    const mid = diffs[Math.floor(diffs.length / 2)];
    if (mid > 0.2 && mid < 2) return mid;
  }
  return a.bpm > 0 ? 60 / a.bpm : 0.5;
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

  const PA = beatPeriod(outgoing);
  const PB = beatPeriod(incoming);
  const rate = PB / PA; 

  const beatsInFade = Math.max(1, Math.floor(requestedFade / PA));
  const fadeSeconds = Math.min(requestedFade, beatsInFade * PA);

  if (!outgoing.beats.length || !incoming.beats.length) {
    return { incomingOffset: 0, fadeSeconds, playbackRate: rate };
  }

  const aRef = outgoing.beats[outgoing.beats.length - 1];
  const kNear = Math.round((outgoingTime - aRef) / PA);
  const aNear = aRef + kNear * PA;
  const aNext = aNear >= outgoingTime ? aNear : aNear + PA;
  const dA = aNext - outgoingTime;
  
  const b0 = incoming.beats[0];
  const target = rate * dA;
  const m = Math.max(0, Math.ceil((target - b0) / PB));
  const bEntry = b0 + m * PB;
  let incomingOffset = bEntry - target;
  if (!Number.isFinite(incomingOffset) || incomingOffset < 0) incomingOffset = 0;

  return { incomingOffset, fadeSeconds, playbackRate: rate };
}
