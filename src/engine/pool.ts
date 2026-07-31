import type { Caps, CompressOutput, Params, WorkerResponse } from './types';

type Task = {
  id: string;
  file: File;
  params: Params;
  onProgress: (n: number) => void;
  resolve: (r: CompressOutput) => void;
  reject: (e: Error & { kind?: string }) => void;
};

type Slot = { worker: Worker; task: Task | null };

/**
 * A fixed pool of compression workers.
 *
 * Size is bounded by memory, not cores: every busy worker can be holding a
 * decoded 12 MP bitmap. The live-preview worker is counted *inside* this cap
 * rather than added on top of it, so a 200-file batch on a modest phone can't
 * quietly open nine simultaneous decodes.
 */
export class Pool {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private caps: Caps;

  constructor(caps: Caps, size = Pool.defaultSize()) {
    this.caps = caps;
    for (let i = 0; i < size; i++) this.slots.push({ worker: this.spawn(), task: null });
  }

  static defaultSize() {
    const cores = navigator.hardwareConcurrency || 4;
    // −1 leaves room for the preview worker within the same ceiling.
    return Math.max(1, Math.min(cores, 8) - 1);
  }

  get size() { return this.slots.length; }
  get busy() { return this.slots.filter((s) => s.task).length; }

  private spawn(): Worker {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => this.receive(w, e.data);
    return w;
  }

  private slotFor(w: Worker) { return this.slots.find((s) => s.worker === w); }

  private receive(w: Worker, msg: WorkerResponse) {
    const slot = this.slotFor(w);
    if (!slot?.task || slot.task.id !== msg.id) return;

    if (msg.type === 'progress') { slot.task.onProgress(msg.progress); return; }

    const task = slot.task;
    slot.task = null;
    if (msg.type === 'done') task.resolve(msg.result);
    else {
      const err = Object.assign(new Error(msg.message), { kind: msg.kind });
      task.reject(err);
    }
    this.pump();
  }

  private pump() {
    for (const slot of this.slots) {
      if (slot.task || this.queue.length === 0) continue;
      const task = this.queue.shift()!;
      slot.task = task;
      slot.worker.postMessage({
        type: 'run', id: task.id, file: task.file, params: task.params, caps: this.caps,
      });
    }
  }

  run(id: string, file: File, params: Params, onProgress: (n: number) => void) {
    return new Promise<CompressOutput>((resolve, reject) => {
      this.queue.push({ id, file, params, onProgress, resolve, reject });
      this.pump();
    });
  }

  /** Drop a queued task, or signal an in-flight one to stop. */
  cancel(id: string) {
    const i = this.queue.findIndex((t) => t.id === id);
    if (i >= 0) {
      const [task] = this.queue.splice(i, 1);
      task.reject(Object.assign(new Error('cancelled'), { kind: 'cancelled' }));
      return;
    }
    const slot = this.slots.find((s) => s.task?.id === id);
    slot?.worker.postMessage({ type: 'abort', id });
  }

  cancelAll() {
    for (const t of this.queue.splice(0)) {
      t.reject(Object.assign(new Error('cancelled'), { kind: 'cancelled' }));
    }
    for (const s of this.slots) if (s.task) s.worker.postMessage({ type: 'abort', id: s.task.id });
  }

  destroy() {
    this.cancelAll();
    for (const s of this.slots) s.worker.terminate();
    this.slots = [];
  }
}

/**
 * A single worker kept aside for the live preview, so dragging the quality slider
 * during a 200-file batch answers immediately instead of queueing behind it. It
 * is counted inside the pool's ceiling (see `Pool.defaultSize`).
 */
export class PreviewWorker {
  private pool: Pool;
  private seq = 0;
  constructor(caps: Caps) { this.pool = new Pool(caps, 1); }

  /** Only the most recent request matters; earlier ones are abandoned. */
  async run(file: File, params: Params): Promise<CompressOutput | null> {
    const id = `preview-${++this.seq}`;
    const mine = this.seq;
    this.pool.cancelAll();
    try {
      const out = await this.pool.run(id, file, params, () => {});
      return mine === this.seq ? out : null;
    } catch {
      return null;
    }
  }

  destroy() { this.pool.destroy(); }
}
