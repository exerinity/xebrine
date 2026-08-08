import type { RemotePeer } from '../../utils/remote_protocol';

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\//, 'Opera'],
  [/\bVivaldi\//, 'Vivaldi'],
  [/\bBrave\//, 'Brave'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bCriOS\//, 'Chrome'],
  [/\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari']
];

const PLATFORMS: [RegExp, string][] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\biPod\b/, 'iPod'],
  [/\bAndroid\b/, 'Android device'],
  [/\bWindows NT\b/, 'Windows PC'],
  [/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
  [/\bCrOS\b/, 'Chromebook'],
  [/\bLinux\b/, 'Linux PC']
];

function match(table: [RegExp, string][], ua: string): string {
  for (const [pattern, label] of table) {
    if (pattern.test(ua)) return label;
  }
  return '';
}

export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  if (/\bElectron\//.test(ua)) return `Xebrine desktop app${match(PLATFORMS, ua) ? ` on ${match(PLATFORMS, ua)}` : ''}`;
  const platform = match(PLATFORMS, ua);
  const browser = match(BROWSERS, ua);
  if (platform && browser) return `${platform} (${browser})`;
  return platform || browser || 'Unknown device';
}

function countryName(code: string | undefined): string {
  if (!code || code.length !== 2) return 'an unknown country';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const PEER_HEADER = 'X-Xebrine-Peer';

export function peerFrom(request: Request, id: string): RemotePeer {
  const cf = request.cf as { country?: string } | undefined;
  return {
    id,
    device: deviceLabel(request.headers.get('User-Agent')),
    ip: request.headers.get('CF-Connecting-IP') ?? 'an unknown address',
    country: countryName(cf?.country)
  };
}

export function encodePeer(peer: RemotePeer): string {
  return encodeURIComponent(JSON.stringify(peer));
}

export function decodePeer(request: Request, id: string): RemotePeer {
  const raw = request.headers.get(PEER_HEADER);
  const fallback: RemotePeer = {
    id,
    device: 'Unknown device',
    ip: 'an unknown address',
    country: 'an unknown country'
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<RemotePeer>;
    return {
      id,
      device: typeof parsed.device === 'string' ? parsed.device : fallback.device,
      ip: typeof parsed.ip === 'string' ? parsed.ip : fallback.ip,
      country: typeof parsed.country === 'string' ? parsed.country : fallback.country
    };
  } catch {
    return fallback;
  }
}
