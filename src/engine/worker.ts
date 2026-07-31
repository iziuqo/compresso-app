/// <reference lib="webworker" />
import { compress, __setCapabilities } from './core/index.js';
import type { WorkerRequest, WorkerResponse, Params } from './types';

/**
 * One compression worker. It holds no state beyond in-flight aborts — the pool
 * owns scheduling. Capabilities are injected rather than probed: the main thread
 * already knows what this browser can encode, and re-probing in every worker
 * would cost an encode round-trip per worker for an answer we have.
 */

const aborts = new Map<string, AbortController>();
const post = (msg: WorkerResponse, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

function toOptions(p: Params, signal: AbortSignal, onProgress: (n: number) => void) {
  return {
    quality: p.quality,
    format: p.format,
    ...(p.maxWidth ? { maxWidth: p.maxWidth } : {}),
    ...(p.maxHeight ? { maxHeight: p.maxHeight } : {}),
    ...(p.maxSizeMB ? { maxSizeMB: p.maxSizeMB } : {}),
    signal,
    onProgress: (e: { progress: number }) => onProgress(e.progress),
  };
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'abort') {
    aborts.get(msg.id)?.abort();
    aborts.delete(msg.id);
    return;
  }

  const { id, file, params, caps } = msg;
  __setCapabilities(caps);

  const ctrl = new AbortController();
  aborts.set(id, ctrl);

  try {
    const r = await compress(file, toOptions(params, ctrl.signal, (progress) => {
      post({ type: 'progress', id, progress });
    }));
    // `url` from the library is a main-thread object URL we don't want here, and
    // `file`/`blob` are the same bytes — send the blob once, let the host wrap it.
    post({
      type: 'done',
      id,
      result: {
        blob: r.blob,
        width: r.width,
        height: r.height,
        originalWidth: r.originalWidth,
        originalHeight: r.originalHeight,
        originalSize: r.originalSize,
        compressedSize: r.compressedSize,
        savings: r.savings,
        format: r.format,
        mimeType: r.mimeType,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if ((err as Error)?.name === 'AbortError') return;
    const kind = /load|decode|image/i.test(message) ? 'decode' : 'generic';
    post({ type: 'error', id, message, kind });
  } finally {
    aborts.delete(id);
  }
};
