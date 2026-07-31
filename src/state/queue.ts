import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pool, PreviewWorker } from '../engine/pool';
import type { Caps, CompressOutput, Params } from '../engine/types';
import { DEFAULT_PARAMS } from '../engine/types';
import { isFormatSupported, isHeicSource, decodeHeic } from '../engine/core/index.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type Job = {
  id: string;
  file: File;
  previewUrl: string | null;
  status: JobStatus;
  progress: number;
  out: (CompressOutput & { url: string }) | null;
  errorKind: 'decode' | 'generic' | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i;
export const isImage = (f: File) => f.type.startsWith('image/') || IMAGE_RE.test(f.name);

/** Probed once, on the main thread, then handed to every worker. */
function probeCaps(): Caps {
  return { avif: isFormatSupported('avif'), webp: isFormatSupported('webp') };
}

/**
 * A displayable URL for the ORIGINAL. Most browsers can't paint HEIC, so those get
 * decoded for preview; Safari/iOS, which can, use the file directly.
 */
async function previewUrlFor(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  if (!isHeicSource(file)) return url;

  const ok = await new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (ok) return url;

  // This browser can't paint HEIC, so the preview has to be decoded. If that
  // fails we hand back the original URL rather than nothing: the compression
  // itself may still succeed, and a tile with no image at all reads as broken
  // when it isn't.
  try {
    const decoded = URL.createObjectURL(await decodeHeic(file));
    URL.revokeObjectURL(url);
    return decoded;
  } catch {
    return url;
  }
}

export function useQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const caps = useMemo(probeCaps, []);
  const poolSize = useMemo(() => Pool.defaultSize(), []);
  const poolRef = useRef<Pool | null>(null);
  const previewRef = useRef<PreviewWorker | null>(null);
  const jobsRef = useRef<Job[]>([]);
  const paramsRef = useRef(params);
  const selectedRef = useRef<string | null>(null);
  const runToken = useRef(0);

  jobsRef.current = jobs;
  paramsRef.current = params;
  selectedRef.current = selectedId;

  /**
   * Lazily (re)created rather than built once at first render. React can unmount
   * and remount the same component while keeping refs — StrictMode does exactly
   * that in development — and a pool that was torn down on the way out must not
   * be reused on the way back in, or every worker is already terminated.
   */
  const getPool = useCallback(() => (poolRef.current ??= new Pool(caps)), [caps]);
  const getPreview = useCallback(() => (previewRef.current ??= new PreviewWorker(caps)), [caps]);

  useEffect(() => () => {
    poolRef.current?.destroy();
    poolRef.current = null;
    previewRef.current?.destroy();
    previewRef.current = null;
    for (const j of jobsRef.current) {
      if (j.previewUrl) URL.revokeObjectURL(j.previewUrl);
      if (j.out) URL.revokeObjectURL(j.out.url);
    }
  }, []);

  const patch = useCallback((id: string, next: Partial<Job>) => {
    setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, ...next } : j)));
  }, []);

  /** Run one job. The selected image goes to the dedicated preview worker so its
   *  result lands immediately even while a large batch is grinding through the pool. */
  const runJob = useCallback(async (job: Job, token: number) => {
    const p = paramsRef.current;
    const isSelected = job.id === selectedRef.current;
    patch(job.id, { status: 'running', progress: isSelected ? 0.35 : 0 });

    try {
      const out = isSelected
        ? await getPreview().run(job.file, p)
        : await getPool().run(job.id, job.file, p, (progress) =>
            patch(job.id, { progress }));

      if (token !== runToken.current || !out) return;

      const url = URL.createObjectURL(out.blob);
      setJobs((cur) => cur.map((j) => {
        if (j.id !== job.id) return j;
        if (j.out) URL.revokeObjectURL(j.out.url);
        return { ...j, status: 'done', progress: 1, out: { ...out, url }, errorKind: null };
      }));
    } catch (err) {
      if (token !== runToken.current) return;
      const kind = (err as { kind?: string }).kind;
      if (kind === 'cancelled') return;
      patch(job.id, { status: 'failed', progress: 0, errorKind: kind === 'decode' ? 'decode' : 'generic' });
    }
  }, [patch, getPool, getPreview]);

  const add = useCallback(async (files: File[]) => {
    const accepted = files.filter(isImage);
    if (!accepted.length) return;

    const fresh: Job[] = accepted.map((file) => ({
      id: uid(), file, previewUrl: null, status: 'queued', progress: 0, out: null, errorKind: null,
    }));

    setJobs((cur) => [...cur, ...fresh]);
    setSelectedId((cur) => cur ?? fresh[0].id);
    selectedRef.current = selectedRef.current ?? fresh[0].id;

    const token = runToken.current;
    for (const job of fresh) {
      previewUrlFor(job.file)
        .then((url) => patch(job.id, { previewUrl: url }))
        .catch(() => patch(job.id, { previewUrl: URL.createObjectURL(job.file) }));
      void runJob(job, token);
    }
  }, [patch, runJob]);

  /** Params changed: everything is stale. Debounced so dragging a slider doesn't
   *  re-queue the batch on every frame. */
  const paramsKey = JSON.stringify(params);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!jobsRef.current.length) return;

    const timer = window.setTimeout(() => {
      getPool().cancelAll();
      const token = ++runToken.current;
      const current = jobsRef.current;
      setJobs((cur) => cur.map((j) => ({ ...j, status: 'queued', progress: 0, errorKind: null })));
      for (const job of current) void runJob(job, token);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [paramsKey, runJob, getPool]);

  const remove = useCallback((id: string) => {
    poolRef.current?.cancel(id);
    setJobs((cur) => {
      const target = cur.find((j) => j.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.out) URL.revokeObjectURL(target.out.url);
      const next = cur.filter((j) => j.id !== id);
      setSelectedId((sel) => (sel === id ? next[0]?.id ?? null : sel));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    poolRef.current?.cancelAll();
    runToken.current++;
    setJobs((cur) => {
      for (const j of cur) {
        if (j.previewUrl) URL.revokeObjectURL(j.previewUrl);
        if (j.out) URL.revokeObjectURL(j.out.url);
      }
      return [];
    });
    setSelectedId(null);
    setParams(DEFAULT_PARAMS);
  }, []);

  const retry = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (job) void runJob(job, runToken.current);
  }, [runJob]);

  const totals = useMemo(() => {
    let original = 0, output = 0, done = 0, running = 0;
    for (const j of jobs) {
      if (j.status === 'running') running++;
      if (!j.out) continue;
      original += j.out.originalSize;
      output += j.out.compressedSize;
      done++;
    }
    return {
      original, output, done, running,
      saved: original - output,
      fraction: original > 0 ? (original - output) / original : 0,
      total: jobs.length,
      settled: jobs.every((j) => j.status === 'done' || j.status === 'failed'),
    };
  }, [jobs]);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return {
    jobs, selected, selectedId, setSelectedId,
    params, setParams, totals, caps,
    add, remove, clear, retry,
    poolSize,
  };
}
