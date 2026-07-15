import { analyzeSamples } from './bpm_dsp';

interface AnalyzeRequest {
  id: number;
  mono: Float32Array;
  sampleRate: number;
}

self.onmessage = (e: MessageEvent<AnalyzeRequest>) => {
  const { id, mono, sampleRate } = e.data;
  try {
    const { bpm, confidence, beats } = analyzeSamples(mono, sampleRate);
    (self as unknown as Worker).postMessage({ id, ok: true, bpm, confidence, beats });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
