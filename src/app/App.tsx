import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import { T, useI18n } from '../i18n';
import { useQueue, isImage, type Job } from '../state/queue';
import { Grain, LangMenu, StatusBar, UpdateBar, Wordmark, useInstall, InstallChip } from '../ui/Chrome';
import { Empty } from '../ui/Empty';
import { Console } from '../ui/Console';
import { Compare, Result, Tile } from '../ui/Workspace';

const extFor = (format: string) => (format === 'jpeg' ? 'jpg' : format);
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
const outName = (job: Job) => `${baseName(job.file.name)}.${extFor(job.out!.format)}`;

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A short, quiet haptic where the platform has one. iOS PWAs don't — and a
 *  simulated one is worse than none, so nothing is faked. */
const tap = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

export default function App() {
  const q = useQueue();
  const { t, bytes } = useI18n();
  const [dragging, setDragging] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const install = useInstall();
  const dragDepth = useRef(0);

  /* -- global input: drop anywhere, paste anywhere ----------------------- */
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const move = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])].filter(isImage);
      if (files.length) { tap(); void q.add(files); }
    };
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) { e.preventDefault(); void q.add(files); }
    };
    window.addEventListener('dragenter', over);
    window.addEventListener('dragover', move);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', over);
      window.removeEventListener('dragover', move);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [q]);

  /* -- connection + service worker --------------------------------------- */
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    let reg: ServiceWorkerRegistration | undefined;
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((r) => {
      reg = r;
      // Never auto-activate: a batch in flight must not be killed by an update.
      r.addEventListener('updatefound', () => {
        r.installing?.addEventListener('statechange', function () {
          if (this.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
    }).catch(() => {});
    return () => { void reg; };
  }, []);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((r) => {
      r?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 120);
    });
  }, []);

  /* -- ceremony: announce the total once the queue settles ---------------- */
  const settledOnce = useRef(false);
  useEffect(() => {
    if (q.totals.settled && q.totals.done > 0 && !settledOnce.current) {
      settledOnce.current = true;
      tap(12);
    }
    if (!q.totals.settled) settledOnce.current = false;
  }, [q.totals.settled, q.totals.done]);

  /* -- output ------------------------------------------------------------ */
  const flashSaved = useCallback((amount: number) => {
    setSavedFlash(t('action.saved', { amount: bytes(Math.abs(amount)) }));
    window.setTimeout(() => setSavedFlash(null), 900);
  }, [t, bytes]);

  const saveOne = useCallback(() => {
    const job = q.selected;
    if (!job?.out) return;
    saveBlob(job.out.blob, outName(job));
    flashSaved(job.out.originalSize - job.out.compressedSize);
  }, [q.selected, flashSaved]);

  const saveAll = useCallback(async () => {
    const ready = q.jobs.filter((j) => j.out);
    if (!ready.length) return;
    if (ready.length === 1) { saveBlob(ready[0].out!.blob, outName(ready[0])); flashSaved(q.totals.saved); return; }

    const entries: Record<string, Uint8Array> = {};
    const seen = new Map<string, number>();
    for (const job of ready) {
      let name = outName(job);
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      if (n) name = `${baseName(name)}-${n + 1}.${extFor(job.out!.format)}`;
      entries[name] = new Uint8Array(await job.out!.blob.arrayBuffer());
    }
    // level 0: the payload is already-compressed image data — deflating it again
    // costs seconds and saves nothing.
    saveBlob(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), 'compresso.zip');
    flashSaved(q.totals.saved);
  }, [q.jobs, q.totals.saved, flashSaved]);

  const shareFiles = useMemo(() => {
    return q.jobs.filter((j) => j.out).map((j) => new File([j.out!.blob], outName(j), { type: j.out!.mimeType }));
  }, [q.jobs]);

  const canShare = useMemo(() => {
    return typeof navigator.canShare === 'function' && shareFiles.length > 0 &&
      navigator.canShare({ files: shareFiles.slice(0, 1) });
  }, [shareFiles]);

  const share = useCallback(async () => {
    try { await navigator.share({ files: shareFiles }); } catch { /* dismissed */ }
  }, [shareFiles]);

  const hasJobs = q.jobs.length > 0;

  return (
    <div className={`app ${hasJobs ? 'is-working' : 'is-empty'} ${dragging ? 'is-dragging' : ''}`}>
      <Grain />

      {/* head and the update notice share one grid row, so the notice appearing
          never re-proportions the workspace beneath it */}
      <div className="top">
        <header className="head">
          <div className="head__left">{hasJobs && <Wordmark />}</div>
          <div className="head__right">
            {install.canInstall && <InstallChip onInstall={install.install} />}
            <LangMenu />
          </div>
        </header>
        {updateReady && <UpdateBar onReload={applyUpdate} />}
      </div>

      <main className="main">
        {!hasJobs ? (
          <Empty onFiles={(f) => { tap(); void q.add(f); }} dragging={dragging} />
        ) : (
          /* One column, picture first. No inspector rail — a rail turns the
             photograph into a thumbnail beside a form. */
          <div className="bench">
            <section className="viewer">
              {/* keyed by job, so moving between images fades rather than cuts */}
              {q.selected && <Compare key={q.selected.id} job={q.selected} />}
            </section>

            {q.totals.done > 0 && (
              <Result
                saved={q.totals.saved}
                fraction={q.totals.fraction}
                from={q.totals.original}
                to={q.totals.output}
                settled={q.totals.settled}
              />
            )}

            <Console params={q.params} setParams={q.setParams} caps={q.caps} selected={q.selected} />

            <div className="strip" role="list">
              {q.jobs.map((job, i) => (
                <div className="strip__cell" role="listitem" key={job.id} style={{ ['--i' as string]: Math.min(i, 8) }}>
                  <Tile
                    job={job}
                    selected={job.id === q.selectedId}
                    onSelect={() => q.setSelectedId(job.id)}
                    onRemove={() => q.remove(job.id)}
                    onRetry={() => q.retry(job.id)}
                  />
                </div>
              ))}
              <label className="strip__add">
                <span className="strip__add-glyph" aria-hidden="true">+</span>
                <span className="sr">{t('action.add')}</span>
                <input
                  type="file" multiple accept="image/*,.heic,.heif" className="sr"
                  onChange={(e) => { void q.add([...(e.target.files ?? [])]); e.target.value = ''; }}
                />
              </label>
            </div>

            {/* ✕ · the one white pill · share — the whole action surface */}
            <div className="dock">
              <button type="button" className="dock__icon" onClick={q.clear} aria-label={t('action.clear')}>
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.3" fill="none" />
                </svg>
              </button>

              <button type="button" className="pill" onClick={q.jobs.length > 1 ? saveAll : saveOne}>
                <T k={q.jobs.length > 1 ? 'action.saveZip' : 'action.save'} />
              </button>

              <button
                type="button" className="dock__icon"
                onClick={share} disabled={!canShare} aria-label={t('action.share')}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M8 10.5V1.8M8 1.8L4.9 4.9M8 1.8l3.1 3.1" strokeLinecap="round" />
                  <path d="M2.5 9.5v3.7a1 1 0 001 1h9a1 1 0 001-1V9.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      <StatusBar
        done={q.totals.done}
        total={q.totals.total}
        running={q.totals.running}
        poolSize={q.poolSize}
        offline={offline}
      />

      <div className={`flash ${savedFlash ? 'is-on' : ''}`} role="status">{savedFlash}</div>
    </div>
  );
}
