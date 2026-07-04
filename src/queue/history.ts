const KEY = 'xebrine.recent';
const MAX_ENTRIES = 50;

export function getRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  const recent = getRecentIds().filter((x) => x !== id);
  recent.unshift(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(recent.slice(0, MAX_ENTRIES)));
  } catch {
    null;
  }
}
