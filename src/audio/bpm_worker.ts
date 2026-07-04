import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';

function waitForModuleReady(mod: any): Promise<any> {
  if (mod.calledRun) return Promise.resolve(mod);
  return new Promise((resolve) => {
    const prev = mod.onRuntimeInitialized;
    mod.onRuntimeInitialized = () => {
      prev?.();
      resolve(mod);
    };
  });
}

let essentiaPromise: Promise<any> | null = null;

function getEssentia(): Promise<any> {
  if (!essentiaPromise) {
    essentiaPromise = waitForModuleReady(EssentiaWASM).then((mod) => new Essentia(mod));
  }
  return essentiaPromise;
}

const MAX_CONFIDENCE = 5.32;

interface AnalyzeRequest {
  id: number;
  mono: Float32Array;
}

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { id, mono } = e.data;
  try {
    const essentia = await getEssentia();
    const vector = essentia.arrayToVector(mono);
    const result = essentia.RhythmExtractor2013(vector, 208, 'multifeature', 40);
    vector.delete?.();
    const bpm = Math.round(result.bpm * 10) / 10;
    const confidence = Math.max(0, Math.min(1, result.confidence / MAX_CONFIDENCE));

    let beats: number[] = [];
    const beatsVec = result.ticks ?? result.beats_position;
    if (beatsVec) {
      try {
        beats = Array.from(essentia.vectorToArray(beatsVec) as Float32Array);
      } catch {
        beats = [];
      }
      beatsVec.delete?.();
    }

    (self as unknown as Worker).postMessage({ id, ok: true, bpm, confidence, beats });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
