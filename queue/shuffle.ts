interface ShuffleInfo {
  id: string;
  artist: string;
}

export function jumble<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function intelligentShuffle<T>(
  items: T[],
  info: (item: T) => ShuffleInfo,
  recentIds: string[] = []
): T[] {
  if (items.length <= 1) return [...items];

  const recentRank = new Map(recentIds.map((id, i) => [id, i]));
  const pool = items.map((item) => ({
    item,
    weight: weightFor(recentRank.get(info(item).id), recentIds.length)
  }));

  const out: T[] = [];
  while (pool.length > 0) {
    let total = 0;
    for (const entry of pool) total += entry.weight;
    let r = Math.random() * total;
    let picked = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        picked = i;
        break;
      }
    }
    out.push(pool[picked].item);
    pool.splice(picked, 1);
  }

  return spreadArtists(out, (item) => info(item).artist);
}

function weightFor(rank: number | undefined, historySize: number): number {
  if (rank === undefined || historySize === 0) return 1;
  return 0.1 + 0.9 * ((rank + 1) / (historySize + 1));
}

function spreadArtists<T>(list: T[], artistOf: (item: T) => string): T[] {
  const out = [...list];
  const same = (a: T, b: T) => artistOf(a).toLowerCase() === artistOf(b).toLowerCase();
  for (let i = 1; i < out.length; i++) {
    if (!same(out[i], out[i - 1])) continue;
    for (let j = i + 1; j < out.length; j++) {
      if (!same(out[j], out[i - 1])) {
        [out[i], out[j]] = [out[j], out[i]];
        break;
      }
    }
  }
  return out;
}
