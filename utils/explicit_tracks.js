const KEY = 'xebrine.explicit';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

const ids = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    null;
  }
}

export function isExplicitId(id) {
  return ids.has(id);
}

export function markExplicit(id) {
  if (ids.has(id)) return;
  ids.add(id);
  save();
  for (const listener of listeners) listener();
}

export function subscribeExplicit(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
