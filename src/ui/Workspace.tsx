import { useCallback, useEffect, useRef, useState } from 'react';
import { T, useI18n } from '../i18n';
import { Odometer } from './primitives';
import type { Job } from '../state/queue';

/* -------------------------------------------------------------------- compare */

/**
 * The comparison seam.
 *
 * There is no snap at the midpoint — a snap is a decision the interface makes for
 * you. Instead the handle *decelerates* as it nears 50%: within the last few
 * percent, movement is compressed so it takes more travel to cross the middle.
 * You can still go anywhere; the centre just has a little weight to it, the way a
 * detent does on a well-made dial.
 */
export function Compare({ job }: { job: Job }) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(50);
  const [dragging, setDragging] = useState(false);

  const position = useCallback((clientX: number) => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const raw = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const d = raw - 50;
    const pull = 7;
    const eased = Math.abs(d) < pull
      ? 50 + Math.sign(d) * pull * Math.pow(Math.abs(d) / pull, 1.55)
      : raw;
    setX(eased);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => position(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, position]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') { setX((v) => Math.max(0, v - step)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setX((v) => Math.min(100, v + step)); e.preventDefault(); }
    if (e.key === 'Home') { setX(0); e.preventDefault(); }
    if (e.key === 'End') { setX(100); e.preventDefault(); }
  };

  const ready = job.out && job.previewUrl;

  return (
    <div
      className={`cmp ${dragging ? 'is-dragging' : ''} ${ready ? 'is-ready' : ''}`}
      ref={wrap}
      style={{ ['--x' as string]: `${x}%` }}
      onPointerDown={(e) => { setDragging(true); position(e.clientX); }}
    >
      <div className="cmp__stage">
        {job.previewUrl && (
          <img className="cmp__img cmp__img--before" src={job.previewUrl} alt={t('view.before')} draggable={false} />
        )}
        {job.out && job.previewUrl && (
          <div className="cmp__after">
            <img className="cmp__img" src={job.out.url} alt={t('view.after')} draggable={false} />
          </div>
        )}
      </div>

      <div className="cmp__seam" aria-hidden="true" />
      <button
        type="button"
        className="cmp__handle"
        onKeyDown={onKey}
        role="slider"
        aria-label={t('view.compare')}
        aria-valuenow={Math.round(x)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="cmp__grip" aria-hidden="true" />
      </button>

      <span className="cmp__tag cmp__tag--l"><T k="view.before" /></span>
      <span className="cmp__tag cmp__tag--r"><T k="view.after" /></span>
    </div>
  );
}

/* ---------------------------------------------------------------------- tile */

/**
 * Status without colour.
 *
 * Queued is a sheet that hasn't been pressed: dim, with the grain turned up.
 * Running *develops* — the blur resolving as progress climbs is the progress
 * indicator; there is no bar. Done settles two pixels upward, because it is
 * lighter now. Failed is struck through with a single diagonal hairline.
 *
 * Not one of those states is a coloured chip.
 */
export function Tile({
  job, selected, onSelect, onRemove, onRetry,
}: {
  job: Job; selected: boolean;
  onSelect: () => void; onRemove: () => void; onRetry: () => void;
}) {
  const { t, bytes, percent } = useI18n();
  const grew = job.out ? job.out.savings < 0 : false;
  const label = t(`status.${job.status}` as 'status.done');

  return (
    <div
      className={`tile tile--${job.status} ${selected ? 'is-selected' : ''} ${grew ? 'is-grew' : ''}`}
      style={{ ['--p' as string]: job.status === 'done' ? 1 : job.progress }}
    >
      <button type="button" className="tile__hit" onClick={onSelect} aria-pressed={selected}>
        <span className="tile__frame">
          {job.previewUrl && <img className="tile__img" src={job.previewUrl} alt="" draggable={false} />}
          <span className="tile__grain" aria-hidden="true" />
          {job.status === 'failed' && <span className="tile__strike" aria-hidden="true" />}
        </span>
        <span className="tile__meta">
          <span className="tile__name mono">{job.file.name}</span>
          <span className="tile__line">
            <span className="tile__figure">
              {job.out ? (
                <Odometer
                  className={grew ? 'is-grew' : ''}
                  value={(grew ? '+' : '−') + percent(Math.abs(job.out.savings) / 100)}
                />
              ) : (
                <span className="tile__status">{label}</span>
              )}
            </span>
            <span className="tile__aside mono">
              {job.out ? bytes(job.out.compressedSize) : bytes(job.file.size)}
            </span>
          </span>
        </span>
      </button>

      {job.status === 'failed' ? (
        <button type="button" className="tile__act" onClick={onRetry}><T k="action.retry" /></button>
      ) : (
        <button type="button" className="tile__act tile__act--quiet" onClick={onRemove}>
          <span className="sr">{t('action.remove')}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </button>
      )}
      <span className="sr" aria-live="polite">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- result */

/**
 * The one loud moment. Everything else on screen is set at metadata scale so this
 * figure can carry the whole hierarchy on its own — no badge, no colour, no
 * celebration graphic. The hairline drawing itself underneath is the full extent
 * of the ceremony, and it only happens once the queue has settled.
 */
export function Result({
  saved, fraction, from, to, settled,
}: { saved: number; fraction: number; from: number; to: number; settled: boolean }) {
  const { bytes, percent } = useI18n();
  const grew = saved < 0;
  void saved;

  return (
    <div className={`result ${settled ? 'is-settled' : ''}`}>
      <p className="result__eyebrow"><T k={grew ? 'result.grew' : 'result.saved'} /></p>
      <p className="result__figure" aria-live="polite">
        <Odometer value={percent(Math.abs(fraction))} />
      </p>
      <span className="result__rule" aria-hidden="true" />
      <p className="result__detail mono">
        {bytes(from)} <span className="result__arrow" aria-hidden="true">→</span> {bytes(to)}
      </p>
    </div>
  );
}
