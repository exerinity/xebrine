export interface AccentColors {
  accent: string;
  accentBright: string;
  accentText: string;
  accentSoft: string;
  accentGlow: string;
  accentWash: string;
  rgb: [number, number, number];
}

export const DEFAULT_ACCENT_COLORS: AccentColors = {
  accent: '#4a29c2',
  accentBright: '#6d4aef',
  accentText: '#9b82f3',
  accentSoft: 'rgba(74, 41, 194, 0.22)',
  accentGlow: 'rgba(109, 74, 239, 0.52)',
  accentWash: 'rgba(74, 41, 194, 0.14)',
  rgb: [74, 41, 194]
};

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

const cache = new Map<string, AccentColors>();

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}

function toRgba([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${alpha})`;
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, l];

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return [h * 60 < 0 ? h * 60 + 360 : h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return [clampByte((rn + m) * 255), clampByte((gn + m) * 255), clampByte((bn + m) * 255)];
}

function deriveAccent(rgb: [number, number, number]): AccentColors {
  const [h, s, l] = rgbToHsl(rgb);
  const chroma = Math.max(s, 0.34);
  const base = hslToRgb(h, chroma, Math.max(0.34, Math.min(0.48, l)));
  const bright = hslToRgb(h, Math.max(chroma, 0.46), 0.58);
  const text = hslToRgb(h, Math.max(chroma, 0.42), 0.74);

  return {
    accent: toHex(base),
    accentBright: toHex(bright),
    accentText: toHex(text),
    accentSoft: toRgba(base, 0.24),
    accentGlow: toRgba(bright, 0.54),
    accentWash: toRgba(base, 0.16),
    rgb: base
  };
}

function chooseDominantColor(imageData: ImageData): [number, number, number] | null {
  const allBuckets = new Map<string, Bucket>();
  const vividBuckets = new Map<string, Bucket>();
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 180) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const key = `${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`;

    const add = (target: Map<string, Bucket>) => {
      const bucket = target.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      target.set(key, bucket);
    };

    add(allBuckets);
    if (saturation > 0.18 && luminance > 24 && luminance < 236) add(vividBuckets);
  }

  const source = vividBuckets.size > 0 ? vividBuckets : allBuckets;
  let best: Bucket | null = null;
  for (const bucket of source.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }

  if (!best) return null;
  return [
    best.r / best.count,
    best.g / best.count,
    best.b / best.count
  ].map(clampByte) as [number, number, number];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load cover art for accent color.'));
    img.src = url;
  });
}

export async function extractAccentColors(url: string): Promise<AccentColors> {
  const cached = cache.get(url);
  if (cached) return cached;

  const img = await loadImage(url);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_ACCENT_COLORS;

  ctx.drawImage(img, 0, 0, size, size);
  const dominant = chooseDominantColor(ctx.getImageData(0, 0, size, size));
  const colors = dominant ? deriveAccent(dominant) : DEFAULT_ACCENT_COLORS;
  cache.set(url, colors);
  return colors;
}
