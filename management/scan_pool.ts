import { fallbackTags, type TrackTags } from './metadata';

export interface ParsedMetadata {
  tags: TrackTags;
  warning?: 'unreadable';
}

interface WorkerResponse extends ParsedMetadata {
  id: number;
}

interface MetadataJob {
  id: number;
  file: File;
  name: string;
  signal?: AbortSignal;
  abortHandler?: () => void;
  resolve(result: ParsedMetadata): void;
  reject(reason: unknown): void;
}

interface WorkerSlot {
  worker: Worker;
  job: MetadataJob | null;
  timeout: number | null;
}

const hardwareThreads = navigator.hardwareConcurrency || 4;
export const SCAN_CONCURRENCY = Math.max(1, Math.min(hardwareThreads, 4));
const METADATA_TIMEOUT_MS = 30_000;

function abortError(): DOMException {
  return new DOMException('Scan aborted', 'AbortError');
}

class MetadataWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: MetadataJob[] = [];
  private nextId = 1;

  constructor(private readonly size: number) {}

  parse(file: File, signal?: AbortSignal): Promise<ParsedMetadata> {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const job: MetadataJob = {
        id: this.nextId++,
        file,
        name: file.name,
        signal,
        resolve,
        reject
      };
      job.abortHandler = () => this.abort(job);
      signal?.addEventListener('abort', job.abortHandler, { once: true });
      this.queue.push(job);
      this.pump();
    });
  }

  private createSlot(): WorkerSlot {
    const slot = { worker: null as unknown as Worker, job: null, timeout: null };
    slot.worker = this.createWorker(slot);
    return slot;
  }

  private createWorker(slot: WorkerSlot): Worker {
    const worker = new Worker(new URL('./scan_worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (slot.job?.id !== event.data.id) return;
      const job = this.releaseSlot(slot);
      job?.resolve({ tags: event.data.tags, warning: event.data.warning });
      this.pump();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      this.finishWithFallback(slot);
    };
    return worker;
  }

  private pump(): void {
    while (this.queue.length > 0) {
      let slot = this.slots.find((candidate) => candidate.job === null);
      if (!slot) {
        if (this.slots.length >= this.size) return;
        slot = this.createSlot();
        this.slots.push(slot);
      }

      const job = this.queue.shift();
      if (!job) return;
      if (job.signal?.aborted) {
        this.cleanupJob(job);
        job.reject(abortError());
        continue;
      }

      slot.job = job;
      slot.timeout = window.setTimeout(() => this.finishWithFallback(slot), METADATA_TIMEOUT_MS);
      try {
        slot.worker.postMessage({ id: job.id, file: job.file, name: job.name });
      } catch {
        this.finishWithFallback(slot);
      }
    }
  }

  private finishWithFallback(slot: WorkerSlot): void {
    const job = this.releaseSlot(slot);
    if (!job) return;
    this.replaceWorker(slot);
    job.resolve({ tags: fallbackTags(job.name), warning: 'unreadable' });
    this.pump();
  }

  private releaseSlot(slot: WorkerSlot): MetadataJob | null {
    const job = slot.job;
    if (!job) return null;
    if (slot.timeout !== null) window.clearTimeout(slot.timeout);
    slot.timeout = null;
    slot.job = null;
    this.cleanupJob(job);
    return job;
  }

  private abort(job: MetadataJob): void {
    const queuedIndex = this.queue.indexOf(job);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      this.cleanupJob(job);
      job.reject(abortError());
      return;
    }

    const slot = this.slots.find((candidate) => candidate.job === job);
    if (!slot) return;
    this.releaseSlot(slot);
    this.replaceWorker(slot);
    job.reject(abortError());
    this.pump();
  }

  private replaceWorker(slot: WorkerSlot): void {
    slot.worker.terminate();
    slot.worker = this.createWorker(slot);
  }

  private cleanupJob(job: MetadataJob): void {
    if (job.abortHandler) job.signal?.removeEventListener('abort', job.abortHandler);
  }
}

const metadataWorkers = new MetadataWorkerPool(SCAN_CONCURRENCY);

export function parseMetadata(file: File, signal?: AbortSignal): Promise<ParsedMetadata> {
  return metadataWorkers.parse(file, signal);
}
