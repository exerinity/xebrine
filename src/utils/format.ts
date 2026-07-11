export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseSeekInput(raw: string, duration: number): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const pct = Number(s.slice(0, -1).trim());
    if (!Number.isFinite(pct)) return null;
    return clamp((pct / 100) * duration, 0, duration);
  }
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p.trim()))) return null;
    const secs = parts.reduce((acc, p) => acc * 60 + Number(p.trim()), 0);
    return clamp(secs, 0, duration);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return clamp(n, 0, duration);
}
