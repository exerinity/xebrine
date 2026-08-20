import { fallbackTags } from './metadata';

const POOL_SIZE = Math.min(navigator.hardwareConcurrency || 4, 8);
const TASK_TIMEOUT_MS = 8000;

/**
 * @typedef {Object} ParsedTags
 * @property {import('./metadata').TrackTags} tags
 * @property {'unreadable'} [warning]
 */

class ParseWorker {
  pending = null;
  nextId = 1;

  constructor() {
    this.spawn();
  }

  spawn() {
    this.worker = new Worker(new URL('./scan_worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      if (this.pending && e.data.id === this.pending.id) {
        const p = this.pending;
        this.pending = null;
        p.resolve(e.data);
      }
    };
  }

  async parse(source) {
    const id = this.nextId++;
    let file;
    try {
      file = await source.getFile();
    } catch {
      return { tags: fallbackTags(source.name), warning: 'unreadable' };
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      this.pending = { id, resolve: done };
      const timer = setTimeout(() => {
        this.pending = null;
        this.worker.terminate();
        this.spawn();
        done({ tags: fallbackTags(source.name), warning: 'unreadable' });
      }, TASK_TIMEOUT_MS);
      this.worker.postMessage({ id, file, name: source.name });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

/**
 * @param {{ name: string, getFile: () => Promise<File> }[]} sources
 * @param {(index: number, parsed: ParsedTags) => void} onResult
 * @param {AbortSignal} [signal]
 */
export async function parseTagsBatch(sources, onResult, signal) {
  if (sources.length === 0) return;
  const workers = Array.from(
    { length: Math.min(POOL_SIZE, sources.length) },
    () => new ParseWorker()
  );
  let cursor = 0;
  const lane = async (w) => {
    while (!signal?.aborted) {
      const index = cursor++;
      if (index >= sources.length) break;
      onResult(index, await w.parse(sources[index]));
    }
  };
  try {
    await Promise.all(workers.map(lane));
  } finally {
    for (const w of workers) w.terminate();
  }
}
