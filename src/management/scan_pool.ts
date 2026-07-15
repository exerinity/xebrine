import { fallbackTags, type TrackTags } from './metadata';

const POOL_SIZE = Math.min(navigator.hardwareConcurrency || 4, 8);
const TASK_TIMEOUT_MS = 8000;

export interface ParsedTags {
  tags: TrackTags;
  warning?: 'oversized' | 'unreadable';
  sizeMB?: number;
}

interface WorkerResponse extends ParsedTags {
  id: number;
}

class ParseWorker {
  private worker!: Worker;
  private pending: { id: number; resolve: (r: ParsedTags) => void } | null = null;
  private nextId = 1;

  constructor() {
    this.spawn();
  }

  private spawn() {
    this.worker = new Worker(new URL('./scan_worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (this.pending && e.data.id === this.pending.id) {
        const p = this.pending;
        this.pending = null;
        p.resolve(e.data);
      }
    };
  }

  parse(handle: FileSystemFileHandle): Promise<ParsedTags> {
    const id = this.nextId++;
    return new Promise<ParsedTags>((resolve) => {
      let settled = false;
      const done = (r: ParsedTags) => {
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
        done({ tags: fallbackTags(handle.name), warning: 'unreadable' });
      }, TASK_TIMEOUT_MS);
      this.worker.postMessage({ id, handle });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

export async function parseTagsBatch(
  handles: FileSystemFileHandle[],
  onResult: (index: number, parsed: ParsedTags) => void,
  signal?: AbortSignal
): Promise<void> {
  if (handles.length === 0) return;
  const workers = Array.from(
    { length: Math.min(POOL_SIZE, handles.length) },
    () => new ParseWorker()
  );
  let cursor = 0;
  const lane = async (w: ParseWorker) => {
    while (!signal?.aborted) {
      const index = cursor++;
      if (index >= handles.length) break;
      onResult(index, await w.parse(handles[index]));
    }
  };
  try {
    await Promise.all(workers.map(lane));
  } finally {
    for (const w of workers) w.terminate();
  }
}
