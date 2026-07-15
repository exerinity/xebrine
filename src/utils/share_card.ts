export type CardStyle = 'wide' | 'narrow' | 'square';
export type LogoMode = 'none' | 'wordmark' | 'corner';
export type CardBackground = 'solid' | 'cover';

export interface ShareCardOptions {
  style: CardStyle;
  bg: string;
  text: string;
  title: string;
  artist: string;
  lines: string[];
  artworkUrl: string | null;
  logo: LogoMode;
  background: CardBackground;
  coverBlur: number;
  coverSaturate: number;
}

const DIMENSIONS: Record<CardStyle, [number, number]> = {
  wide: [1920, 1080],
  narrow: [1080, 1920],
  square: [1080, 1080]
};

const FONT = '"Google Sans Flex", system-ui, sans-serif';
const LOGO_VIEWBOX = { x: 70, y: 260, w: 563, h: 545 };
const LOGO_PATH =
  'M86 413c26 -8 54 -12 84 -12s58 4 85 12v318h-169v-131h150v-56c-20 -4 -42 -6 -66 -6c-29 0 -57 4 -84 12v-137zM617 552c-27 -8 -56 -12 -85 -12c-30 0 -58 4 -84 12v-137c26 -8 54 -12 84 -12c29 0 58 4 85 12v137zM447 415c-27 -8 -55 -12 -84 -12c-23 0 -44 2 -66 6v384h-19v-515c27 -8 56 -12 85 -12c30 0 58 4 84 12v137z';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t
  ]);
}

export function pickTextColor(bg: string): string {
  return luminance(bg) > 0.6 ? '#12121c' : '#ffffff';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load cover art'));
    img.src = url;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function drawArtwork(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  text: string
) {
  ctx.save();
  roundedRect(ctx, x, y, size, size, 18);
  ctx.clip();
  if (art) {
    const side = Math.min(art.naturalWidth, art.naturalHeight);
    const sx = (art.naturalWidth - side) / 2;
    const sy = (art.naturalHeight - side) / 2;
    ctx.drawImage(art, sx, sy, side, side, x, y, size, size);
  } else {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = text;
    ctx.fillRect(x, y, size, size);
    ctx.globalAlpha = 0.6;
    ctx.font = `600 ${size * 0.42}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', x + size / 2, y + size / 2);
  }
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const scale = height / LOGO_VIEWBOX.h;
  ctx.save();
  ctx.translate(x - LOGO_VIEWBOX.x * scale, y - LOGO_VIEWBOX.y * scale);
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(LOGO_PATH));
  ctx.restore();
}

export async function renderShareCard(options: ShareCardOptions): Promise<HTMLCanvasElement> {
  const [width, height] = DIMENSIONS[options.style];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  await document.fonts.load(`700 54px ${FONT}`).catch(() => undefined);
  const art = options.artworkUrl ? await loadImage(options.artworkUrl).catch(() => null) : null;

  const cardWidth = options.style === 'wide' ? 1160 : 840;
  const pad = 64;
  const inner = cardWidth - pad * 2;
  const artSize = 124;
  const headerGap = 56;
  const footerGap = 68;
  const footerHeight = 44;
  const footerSpace = options.logo === 'wordmark' ? footerGap + footerHeight : 0;
  const maxCardHeight = height - 120;

  let lyricSize = 54;
  let wrapped: string[] = [];
  let lineBox = 0;
  let cardHeight = 0;
  for (;;) {
    ctx.font = `700 ${lyricSize}px ${FONT}`;
    wrapped = options.lines.flatMap((line) => wrapText(ctx, line, inner));
    lineBox = Math.round(lyricSize * 1.38);
    cardHeight = pad + artSize + headerGap + wrapped.length * lineBox + footerSpace + pad;
    if (cardHeight <= maxCardHeight || lyricSize <= 30) break;
    lyricSize -= 4;
  }

  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;
  const coverBg = options.background === 'cover' && art !== null;
  const cardColor = coverBg
    ? 'rgba(7, 0, 7, 0.58)'
    : luminance(options.bg) > 0.5
      ? mixHex(options.bg, '#000000', 0.08)
      : mixHex(options.bg, '#ffffff', 0.08);

  if (options.background === 'cover' && art) {
    ctx.fillStyle = '#030003';
    ctx.fillRect(0, 0, width, height);
    const margin = options.coverBlur * 2;
    const scale = Math.max(
      (width + margin * 2) / art.naturalWidth,
      (height + margin * 2) / art.naturalHeight
    );
    const dw = art.naturalWidth * scale;
    const dh = art.naturalHeight * scale;
    ctx.save();
    ctx.filter = `blur(${options.coverBlur}px) saturate(${options.coverSaturate})`;
    ctx.globalAlpha = 0.18;
    ctx.drawImage(art, (width - dw) / 2, (height - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = options.bg;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = cardColor;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 42);
  ctx.fill();

  drawArtwork(ctx, art, cardX + pad, cardY + pad, artSize, options.text);

  const cornerLogoSize = 48;
  const headX = cardX + pad + artSize + 34;
  const headWidth =
    cardX + cardWidth - pad - headX - (options.logo === 'corner' ? cornerLogoSize + 24 : 0);
  ctx.fillStyle = options.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(ellipsize(ctx, options.title, headWidth), headX, cardY + pad + 50);
  ctx.globalAlpha = 0.72;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(ellipsize(ctx, options.artist, headWidth), headX, cardY + pad + 100);
  ctx.globalAlpha = 1;

  ctx.font = `700 ${lyricSize}px ${FONT}`;
  ctx.textBaseline = 'top';
  const lyricsY = cardY + pad + artSize + headerGap;
  wrapped.forEach((line, i) => {
    ctx.fillText(line, cardX + pad, lyricsY + i * lineBox);
  });

  if (options.logo === 'wordmark') {
    const footerY = cardY + cardHeight - pad - footerHeight;
    ctx.globalAlpha = 0.9;
    drawLogo(ctx, cardX + pad, footerY + 2, footerHeight - 4);
    ctx.font = `600 33px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Xebrine', cardX + pad + footerHeight + 12, footerY + footerHeight / 2 + 2);
    ctx.globalAlpha = 1;
  } else if (options.logo === 'corner') {
    ctx.globalAlpha = 0.9;
    drawLogo(ctx, cardX + cardWidth - pad - cornerLogoSize, cardY + pad, cornerLogoSize);
    ctx.globalAlpha = 1;
  }

  return canvas;
}
