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

const FFT_SIZE = 1024;
const HOP_SIZE = 256;
const BAND_COUNT = 64;
const BAND_LOW_HZ = 30;
const BAND_HIGH_HZ = 10000;
const LOW_BAND_EMPHASIS_COUNT = 12;
const LOW_BAND_EMPHASIS = 1.5;
const FLUX_LOOKBACK = 2;
const LOG_COMPRESSION = 100;
const DETREND_SECONDS = 1;
const ACF_WINDOW_SECONDS = 18;
const ACF_HOP_SECONDS = 4;
const BPM_MIN = 50;
const BPM_MAX = 210;
const BPM_GRID_SIZE = 480;
const COMB_WEIGHTS = [1, 0.65, 0.4, 0.25];
const TEMPO_PRIOR_CENTER = 122;
const TEMPO_PRIOR_SIGMA_OCTAVES = 0.8;
const OCTAVE_CANDIDATES: ReadonlyArray<readonly [number, number]> = [
  [0.5, 1.05],
  [2, 1.05],
  [2 / 3, 1.25],
  [1.5, 1.25],
  [0.75, 1.35],
  [4 / 3, 1.35]
];
const DP_TIGHTNESS = 100;
const MIN_ANALYSIS_SECONDS = 8;
const MIN_GRID_BEATS = 4;
const GRID_PERIOD_MIN = 0.2;
const GRID_PERIOD_MAX = 2;
const GRID_OUTLIER_FLOOR_SECONDS = 0.02;
const BEAT_TRIM_RATIO = 0.02;

class Fft {
  private readonly rev: Uint32Array;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;

  constructor(private readonly size: number) {
    const bits = Math.round(Math.log2(size));
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
      this.rev[i] = r;
    }
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((-2 * Math.PI * i) / size);
    }
  }

  transform(re: Float32Array, im: Float32Array) {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      const r = this.rev[i];
      if (r > i) {
        let t = re[i];
        re[i] = re[r];
        re[r] = t;
        t = im[i];
        im[i] = im[r];
        im[r] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = this.cosTable[k];
          const wi = this.sinTable[k];
          const a = i + j;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}

export class RealFft {
  private readonly half: Fft;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;

  constructor(private readonly size: number) {
    this.half = new Fft(size / 2);
    this.re = new Float32Array(size / 2);
    this.im = new Float32Array(size / 2);
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);
    for (let k = 0; k < size / 2; k++) {
      this.cosTable[k] = Math.cos((-2 * Math.PI * k) / size);
      this.sinTable[k] = Math.sin((-2 * Math.PI * k) / size);
    }
  }

  magnitudes(input: Float32Array, out: Float32Array) {
    const h = this.size / 2;
    const re = this.re;
    const im = this.im;
    for (let i = 0; i < h; i++) {
      re[i] = input[2 * i];
      im[i] = input[2 * i + 1];
    }
    this.half.transform(re, im);
    out[0] = Math.abs(re[0] + im[0]);
    out[h] = Math.abs(re[0] - im[0]);
    for (let k = 1; k < h; k++) {
      const m = h - k;
      const xeR = (re[k] + re[m]) / 2;
      const xeI = (im[k] - im[m]) / 2;
      const xoR = (im[k] + im[m]) / 2;
      const xoI = (re[m] - re[k]) / 2;
      const wr = this.cosTable[k];
      const wi = this.sinTable[k];
      const xr = xeR + wr * xoR - wi * xoI;
      const xi = xeI + wr * xoI + wi * xoR;
      out[k] = Math.sqrt(xr * xr + xi * xi);
    }
  }
}

interface Filterbank {
  binStart: Int32Array;
  binCount: Int32Array;
  weightOffset: Int32Array;
  weights: Float32Array;
}

function buildFilterbank(sampleRate: number, fftSize: number): Filterbank {
  const binHz = sampleRate / fftSize;
  const nyquistBins = fftSize / 2;
  const high = Math.min(BAND_HIGH_HZ, sampleRate * 0.475);
  const edges = new Float64Array(BAND_COUNT + 2);
  for (let i = 0; i < BAND_COUNT + 2; i++) {
    edges[i] = BAND_LOW_HZ * Math.pow(high / BAND_LOW_HZ, i / (BAND_COUNT + 1));
  }
  const binStart = new Int32Array(BAND_COUNT);
  const binCount = new Int32Array(BAND_COUNT);
  const weightOffset = new Int32Array(BAND_COUNT);
  const weightChunks: number[] = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    const left = edges[b];
    const center = edges[b + 1];
    const right = edges[b + 2];
    let start = Math.max(1, Math.ceil(left / binHz));
    let end = Math.min(nyquistBins, Math.floor(right / binHz));
    const bandWeights: number[] = [];
    for (let k = start; k <= end; k++) {
      const f = k * binHz;
      const w = f <= center ? (f - left) / (center - left) : (right - f) / (right - center);
      bandWeights.push(Math.max(0, w));
    }
    let sum = 0;
    for (const w of bandWeights) sum += w;
    if (bandWeights.length === 0 || sum <= 0) {
      start = Math.min(nyquistBins, Math.max(1, Math.round(center / binHz)));
      bandWeights.length = 0;
      bandWeights.push(1);
      sum = 1;
    }
    binStart[b] = start;
    binCount[b] = bandWeights.length;
    weightOffset[b] = weightChunks.length;
    for (const w of bandWeights) weightChunks.push(w / sum);
  }
  return { binStart, binCount, weightOffset, weights: Float32Array.from(weightChunks) };
}

export interface OnsetEnvelope {
  env: Float32Array;
  fps: number;
}

export function onsetEnvelope(samples: Float32Array, sampleRate: number): OnsetEnvelope {
  const nFrames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1);
  const fps = sampleRate / HOP_SIZE;
  const env = new Float32Array(nFrames);
  if (nFrames < 4) return { env, fps };

  const rfft = new RealFft(FFT_SIZE);
  const fb = buildFilterbank(sampleRate, FFT_SIZE);
  const window = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  const frame = new Float32Array(FFT_SIZE);
  const mags = new Float32Array(FFT_SIZE / 2 + 1);
  const historyLen = FLUX_LOOKBACK + 1;
  const history: Float32Array[] = [];
  for (let i = 0; i < historyLen; i++) history.push(new Float32Array(BAND_COUNT));

  for (let f = 0; f < nFrames; f++) {
    const off = f * HOP_SIZE;
    for (let i = 0; i < FFT_SIZE; i++) frame[i] = samples[off + i] * window[i];
    rfft.magnitudes(frame, mags);

    const bands = history[f % historyLen];
    for (let b = 0; b < BAND_COUNT; b++) {
      let e = 0;
      const start = fb.binStart[b];
      const count = fb.binCount[b];
      const wOff = fb.weightOffset[b];
      for (let j = 0; j < count; j++) e += fb.weights[wOff + j] * mags[start + j];
      bands[b] = Math.log1p(LOG_COMPRESSION * e);
    }

    if (f >= FLUX_LOOKBACK) {
      const prev = history[(f - FLUX_LOOKBACK) % historyLen];
      let flux = 0;
      for (let b = 0; b < BAND_COUNT; b++) {
        let m = prev[b];
        if (b > 0 && prev[b - 1] > m) m = prev[b - 1];
        if (b < BAND_COUNT - 1 && prev[b + 1] > m) m = prev[b + 1];
        const d = bands[b] - m;
        if (d > 0) flux += b < LOW_BAND_EMPHASIS_COUNT ? d * LOW_BAND_EMPHASIS : d;
      }
      env[f] = flux;
    }
  }

  const detrendWindow = Math.max(1, Math.round(fps * DETREND_SECONDS));
  const halfW = Math.floor(detrendWindow / 2);
  const prefix = new Float64Array(nFrames + 1);
  for (let f = 0; f < nFrames; f++) prefix[f + 1] = prefix[f] + env[f];
  let sumSq = 0;
  for (let f = 0; f < nFrames; f++) {
    const lo = Math.max(0, f - halfW);
    const hi = Math.min(nFrames, f + halfW + 1);
    const mean = (prefix[hi] - prefix[lo]) / (hi - lo);
    const v = env[f] - mean;
    env[f] = v > 0 ? v : 0;
    sumSq += env[f] * env[f];
  }
  const std = Math.sqrt(sumSq / nFrames);
  if (std > 1e-9) {
    for (let f = 0; f < nFrames; f++) env[f] /= std;
  }
  return { env, fps };
}

function normalizedAutocorr(env: Float32Array, start: number, len: number, maxLag: number): Float32Array {
  const y = new Float64Array(len);
  let mean = 0;
  for (let i = 0; i < len; i++) mean += env[start + i];
  mean /= len;
  for (let i = 0; i < len; i++) y[i] = env[start + i] - mean;
  const nacf = new Float32Array(maxLag + 1);
  let r0 = 0;
  for (let i = 0; i < len; i++) r0 += y[i] * y[i];
  r0 /= len;
  if (r0 < 1e-12) return nacf;
  for (let l = 1; l <= maxLag; l++) {
    let s = 0;
    const end = len - l;
    for (let i = 0; i < end; i++) s += y[i] * y[i + l];
    const v = s / end / r0;
    nacf[l] = v > 0 ? v : 0;
  }
  nacf[0] = 1;
  return nacf;
}

function tempoPrior(bpm: number): number {
  const d = Math.log2(bpm / TEMPO_PRIOR_CENTER) / TEMPO_PRIOR_SIGMA_OCTAVES;
  return Math.exp(-0.5 * d * d);
}

function combScore(nacf: Float32Array, fps: number, bpm: number): number {
  const baseLag = (fps * 60) / bpm;
  let s = 0;
  let wSum = 0;
  for (let h = 1; h <= COMB_WEIGHTS.length; h++) {
    const lag = baseLag * h;
    const li = Math.floor(lag);
    if (li + 1 > nacf.length - 1) break;
    const frac = lag - li;
    const v = nacf[li] * (1 - frac) + nacf[li + 1] * frac;
    const w = COMB_WEIGHTS[h - 1];
    s += w * v;
    wSum += w;
  }
  return wSum > 0 ? s / wSum : 0;
}

function bpmAtGridIndex(i: number): number {
  return BPM_MIN * Math.pow(BPM_MAX / BPM_MIN, i / (BPM_GRID_SIZE - 1));
}

function bestGridBpm(nacf: Float32Array, fps: number): { bpm: number; score: number; meanScore: number } {
  let bestIdx = 0;
  let bestScore = -1;
  let total = 0;
  const scores = new Float64Array(BPM_GRID_SIZE);
  for (let i = 0; i < BPM_GRID_SIZE; i++) {
    const bpm = bpmAtGridIndex(i);
    const s = combScore(nacf, fps, bpm) * tempoPrior(bpm);
    scores[i] = s;
    total += s;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  let refinedIdx = bestIdx;
  if (bestIdx > 0 && bestIdx < BPM_GRID_SIZE - 1) {
    const y0 = scores[bestIdx - 1];
    const y1 = scores[bestIdx];
    const y2 = scores[bestIdx + 1];
    const den = y0 - 2 * y1 + y2;
    if (Math.abs(den) > 1e-12) {
      const delta = (0.5 * (y0 - y2)) / den;
      if (Math.abs(delta) <= 0.5) refinedIdx = bestIdx + delta;
    }
  }
  return { bpm: bpmAtGridIndex(refinedIdx), score: bestScore, meanScore: total / BPM_GRID_SIZE };
}

export interface TempoEstimate {
  bpm: number;
  salience: number;
  agreement: number;
  rawStrength: number;
}

export function estimateTempo(env: Float32Array, fps: number): TempoEstimate | null {
  const maxLag = Math.ceil(((fps * 60) / BPM_MIN) * COMB_WEIGHTS.length) + 2;
  let win = Math.round(fps * ACF_WINDOW_SECONDS);
  const hop = Math.max(1, Math.round(fps * ACF_HOP_SECONDS));
  if (win > env.length) win = env.length;
  if (win < Math.round(fps * 6)) return null;
  const lagCap = Math.min(maxLag, win - 2);

  const windows: Float32Array[] = [];
  for (let s = 0; s + win <= env.length; s += hop) {
    windows.push(normalizedAutocorr(env, s, win, lagCap));
    if (s + hop + win > env.length && s + win < env.length) {
      windows.push(normalizedAutocorr(env, env.length - win, win, lagCap));
      break;
    }
  }
  if (windows.length === 0) windows.push(normalizedAutocorr(env, 0, win, lagCap));

  const gacf = new Float32Array(lagCap + 1);
  const column: number[] = new Array(windows.length);
  for (let l = 0; l <= lagCap; l++) {
    for (let w = 0; w < windows.length; w++) column[w] = windows[w][l];
    column.sort((a, b) => a - b);
    const mid = windows.length >> 1;
    gacf[l] =
      windows.length % 2 === 1 ? column[mid] : (column[mid - 1] + column[mid]) / 2;
  }

  const global = bestGridBpm(gacf, fps);
  if (global.score <= 0) return null;

  const scoreAt = (bpm: number) => combScore(gacf, fps, bpm) * tempoPrior(bpm);
  let chosen = global.bpm;
  let chosenScore = global.score;
  for (const [factor, threshold] of OCTAVE_CANDIDATES) {
    const candidate = global.bpm * factor;
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    const s = scoreAt(candidate);
    if (s > global.score * threshold && s > chosenScore) {
      chosen = candidate;
      chosenScore = s;
    }
  }

  let refined = chosen;
  let refinedScore = chosenScore;
  for (let i = -30; i <= 30; i++) {
    const candidate = chosen * (1 + i * 0.001);
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    const s = scoreAt(candidate);
    if (s > refinedScore) {
      refinedScore = s;
      refined = candidate;
    }
  }

  let agreement = 0.85;
  if (windows.length >= 3) {
    let agreeing = 0;
    for (const nacf of windows) {
      const local = bestGridBpm(nacf, fps);
      let e = Math.abs(Math.log2(local.bpm / refined)) % 1;
      e = Math.min(e, 1 - e);
      if (e < Math.log2(1.04)) agreeing++;
    }
    agreement = agreeing / windows.length;
  }

  const salience = global.meanScore > 1e-12 ? refinedScore / global.meanScore : 0;
  const rawStrength = combScore(gacf, fps, refined);
  return { bpm: refined, salience, agreement, rawStrength };
}

function gaussianSmooth(x: Float32Array, sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 4));
  const kernel = new Float32Array(2 * radius + 1);
  let kSum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp((-0.5 * i * i) / (sigma * sigma));
    kernel[i + radius] = v;
    kSum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;
  const out = new Float32Array(x.length);
  for (let t = 0; t < x.length; t++) {
    let s = 0;
    let wSum = 0;
    for (let i = -radius; i <= radius; i++) {
      const j = t + i;
      if (j < 0 || j >= x.length) continue;
      s += x[j] * kernel[i + radius];
      wSum += kernel[i + radius];
    }
    out[t] = wSum > 0 ? s / wSum : 0;
  }
  return out;
}

export function trackBeats(env: Float32Array, fps: number, bpm: number): number[] {
  const n = env.length;
  if (n === 0 || !(bpm > 0)) return [];
  const period = (fps * 60) / bpm;
  const local = gaussianSmooth(env, Math.max(1, period / 32));

  const tauMin = Math.max(1, Math.round(period * 0.5));
  const tauMax = Math.min(Math.round(period * 2), n - 1);
  if (tauMax <= tauMin) return [];

  const penalty = new Float64Array(tauMax - tauMin + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    const d = Math.log(tau / period);
    penalty[tau - tauMin] = DP_TIGHTNESS * d * d;
  }

  const cumScore = new Float64Array(n);
  const backlink = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let best = -Infinity;
    let bestIdx = -1;
    const lo = Math.max(0, t - tauMax);
    const hi = t - tauMin;
    for (let p = lo; p <= hi; p++) {
      const v = cumScore[p] - penalty[t - p - tauMin];
      if (v > best) {
        best = v;
        bestIdx = p;
      }
    }
    if (bestIdx >= 0 && best > 0) {
      cumScore[t] = local[t] + best;
      backlink[t] = bestIdx;
    } else {
      cumScore[t] = local[t];
    }
  }

  let start = n - 1;
  let startBest = -Infinity;
  const tailLo = Math.max(0, n - Math.round(period * 2));
  for (let t = tailLo; t < n; t++) {
    if (cumScore[t] > startBest) {
      startBest = cumScore[t];
      start = t;
    }
  }

  const frames: number[] = [];
  for (let t = start; t >= 0; t = backlink[t]) {
    frames.push(t);
    if (backlink[t] < 0) break;
  }
  frames.reverse();

  let peak = 0;
  for (let t = 0; t < n; t++) if (local[t] > peak) peak = local[t];
  const floor = peak * BEAT_TRIM_RATIO;
  let first = 0;
  let last = frames.length - 1;
  while (first < last && local[frames[first]] < floor) first++;
  while (last > first && local[frames[last]] < floor) last--;

  const beats: number[] = [];
  for (let i = first; i <= last; i++) {
    const t = frames[i];
    let refined = t;
    if (t > 0 && t < n - 1) {
      const y0 = local[t - 1];
      const y1 = local[t];
      const y2 = local[t + 1];
      const den = y0 - 2 * y1 + y2;
      if (Math.abs(den) > 1e-12) {
        const delta = (0.5 * (y0 - y2)) / den;
        if (Math.abs(delta) <= 0.5) refined = t + delta;
      }
    }
    beats.push(refined);
  }
  return beats;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function assignSequentialIndices(beats: number[], period: number): number[] {
  const ks = new Array<number>(beats.length);
  ks[0] = 0;
  for (let i = 1; i < beats.length; i++) {
    ks[i] = ks[i - 1] + Math.max(1, Math.round((beats[i] - beats[i - 1]) / period));
  }
  return ks;
}

function leastSquaresGrid(beats: number[], ks: number[]): { period: number; phase: number } | null {
  const n = beats.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += ks[i];
    sy += beats[i];
    sxx += ks[i] * ks[i];
    sxy += ks[i] * beats[i];
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const period = (n * sxy - sx * sy) / den;
  const phase = (sy - period * sx) / n;
  if (!(period > GRID_PERIOD_MIN && period < GRID_PERIOD_MAX)) return null;
  return { period, phase };
}

export function fitBeatGrid(
  beats: readonly number[],
  windowStart: number,
  windowEnd: number
): BeatGridFit | null {
  let sel: number[] = [];
  for (const b of beats) {
    if (b >= windowStart && b <= windowEnd) sel.push(b);
  }
  if (sel.length < 6) sel = [...beats];
  if (sel.length < MIN_GRID_BEATS) return null;

  const ibis: number[] = [];
  for (let i = 1; i < sel.length; i++) {
    const d = sel[i] - sel[i - 1];
    if (d >= GRID_PERIOD_MIN && d <= GRID_PERIOD_MAX) ibis.push(d);
  }
  if (ibis.length < 2) return null;

  let period = median(ibis);
  let points = sel;
  let ks = assignSequentialIndices(points, period);
  let fit: { period: number; phase: number } | null = null;

  for (let pass = 0; pass < 4; pass++) {
    fit = leastSquaresGrid(points, ks);
    if (!fit) return null;
    period = fit.period;
    const threshold = Math.max(0.08 * period, GRID_OUTLIER_FLOOR_SECONDS);
    const kept: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const residual = points[i] - (fit.phase + fit.period * ks[i]);
      if (Math.abs(residual) <= threshold) kept.push(points[i]);
    }
    if (kept.length === points.length || kept.length < MIN_GRID_BEATS) break;
    points = kept;
    ks = assignSequentialIndices(points, period);
  }
  if (!fit) return null;

  let sumSq = 0;
  for (let i = 0; i < points.length; i++) {
    const residual = points[i] - (fit.phase + fit.period * ks[i]);
    sumSq += residual * residual;
  }
  return {
    period: fit.period,
    phase: fit.phase,
    rms: Math.sqrt(sumSq / points.length),
    count: points.length
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function analyzeSamples(samples: Float32Array, sampleRate: number): DspAnalysis {
  if (!(sampleRate > 0)) throw new Error('invalid sample rate');
  if (samples.length < sampleRate * MIN_ANALYSIS_SECONDS) {
    throw new Error('audio too short for tempo analysis');
  }

  const { env, fps } = onsetEnvelope(samples, sampleRate);
  let energy = 0;
  for (let i = 0; i < env.length; i++) energy += env[i];
  if (energy <= 0) return { bpm: 0, confidence: 0, beats: [] };

  const tempo = estimateTempo(env, fps);
  if (!tempo) return { bpm: 0, confidence: 0, beats: [] };

  const beatFrames = trackBeats(env, fps, tempo.bpm);
  const beats = beatFrames.map((f) => (f * HOP_SIZE + FFT_SIZE / 2) / sampleRate);
  const fit = beats.length >= MIN_GRID_BEATS ? fitBeatGrid(beats, -Infinity, Infinity) : null;

  const bpm = fit ? 60 / fit.period : tempo.bpm;
  const cTempo = clamp01((tempo.salience - 1.5) / 5);
  const cAgreement = tempo.agreement;
  const cRegularity = fit ? clamp01(1 - fit.rms / (0.08 * fit.period)) : 0.3;
  const cStrength = clamp01(tempo.rawStrength / 0.25);
  let confidence = clamp01(Math.cbrt(cTempo * cAgreement * cRegularity) * cStrength);

  let octaveError = Math.abs(Math.log2(bpm / tempo.bpm)) % 1;
  octaveError = Math.min(octaveError, 1 - octaveError);
  if (octaveError > Math.log2(1.06)) confidence *= 0.5;

  return {
    bpm: Math.round(bpm * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    beats
  };
}