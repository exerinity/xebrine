import { analyze_samples } from './dsp';

interface AnalyzeRequest {
  id: number;
  mono: Float32Array;
  sample_rate: number;
}

self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const { id, mono, sample_rate } = event.data;
  try {
    const { bpm, confidence, beats } = analyze_samples(mono, sample_rate);
    (self as unknown as Worker).postMessage({ id, ok: true, bpm, confidence, beats });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
