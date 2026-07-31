import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ odometer */

/**
 * Digits roll; everything else stays put. The trick is restraint: only the digits
 * that actually changed move, because only their transform changed. The rightmost
 * digit leads and each one to its left follows a beat later, which is how a
 * mechanical counter settles.
 *
 * Tabular figures are non-negotiable here — without them the whole readout
 * reflows on every tick and the effect reads as a glitch instead of a mechanism.
 */
export function Odometer({ value, className = '' }: { value: string; className?: string }) {
  const chars = [...value];
  const n = chars.length;
  return (
    <span className={`odo ${className}`} aria-label={value}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="odo__win" key={i} aria-hidden="true">
            <span
              className="odo__reel"
              style={{
                transform: `translateY(${-Number(ch) * 10}%)`,
                transitionDelay: `${(n - 1 - i) * 16}ms`,
              }}
            >
              {'0123456789'.split('').map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        ) : (
          <span className="odo__fixed" key={i} aria-hidden="true">{ch}</span>
        )
      )}
    </span>
  );
}

/* -------------------------------------------------------------------- slider */

export function Slider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  const [live, setLive] = useState(false);
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`sl ${live ? 'is-live' : ''}`} style={{ ['--p' as string]: `${pct}%` }}>
      <div className="row__head">
        <label className="row__label" htmlFor={id}>{label}</label>
        <span className="row__value mono">{display}</span>
      </div>
      <div className="sl__lane">
        {/* the value lifts out of the thumb while you drag, then settles back */}
        <span className="sl__bubble mono" aria-hidden="true">{display}</span>
        <span className="sl__track" />
        <span className="sl__fill" />
        <span className="sl__thumb" />
        <input
          id={id}
          className="sl__input"
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setLive(true)}
          onPointerUp={() => setLive(false)}
          onFocus={() => setLive(true)}
          onBlur={() => setLive(false)}
          aria-label={label}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- segmented */

export type Option<T extends string> = { value: T; label: string };

/**
 * The selection is an ink block that travels. The labels are drawn twice: once in
 * ink, once in paper — and the paper layer is clipped to exactly the block. As the
 * block slides, each label wipes from ink to paper in place, which is a very
 * different feeling from a label that simply changes colour when the animation
 * ends. Nothing scales, nothing fades.
 */
export function Segmented<T extends string>({
  options, value, onChange, label,
}: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, width: 0, host: 0 });

  /**
   * Measured against the segment's own box rather than via offsetLeft — the
   * label layers are positioned, so offsetParent isn't the segment and the
   * numbers come back in the wrong coordinate space, shaving letters off the
   * ends of the clip.
   */
  const measure = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('.seg__hit[data-active="true"]');
    if (!active) return;
    const host = el.getBoundingClientRect();
    const hit = active.getBoundingClientRect();
    setBox({ left: hit.left - host.left, width: hit.width, host: host.width });
  }, []);

  useLayoutEffect(measure, [measure, value, options.length]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [measure]);

  const clip = `inset(0 ${Math.max(0, box.host - (box.left + box.width))}px 0 ${box.left}px)`;

  const labels = () =>
    options.map((o) => (
      <span className="seg__label" key={o.value} data-active={o.value === value}>
        {o.label}
      </span>
    ));

  return (
    <div className="seg" ref={wrap} role="radiogroup" aria-label={label}>
      <span
        className="seg__ink"
        style={{ transform: `translateX(${box.left}px)`, width: box.width }}
        aria-hidden="true"
      />
      <span className="seg__layer" aria-hidden="true">{labels()}</span>
      <span className="seg__layer seg__layer--inv" style={{ clipPath: clip }} aria-hidden="true">
        {labels()}
      </span>
      <span className="seg__hits">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            data-active={o.value === value}
            className="seg__hit"
            onClick={() => onChange(o.value)}
          >
            <span className="sr">{o.label}</span>
          </button>
        ))}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- number field */

export function NumberField({
  label, value, placeholder, suffix, onChange,
}: {
  label: string; value: number | null; placeholder: string; suffix?: string;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  return (
    <div className="nf">
      <label className="nf__label" htmlFor={id}>{label}</label>
      <span className="nf__box">
        <input
          id={id}
          className="nf__input mono"
          inputMode="numeric"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, '');
            onChange(raw === '' ? null : Number(raw));
          }}
        />
        {suffix && <span className="nf__suffix mono">{suffix}</span>}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------- misc */

export function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="group">
      {label && <h2 className="group__label">{label}</h2>}
      <div className="group__body">{children}</div>
    </section>
  );
}

/** Pointer-follow warm light. Lerped, so it trails the cursor instead of tracking
 *  it — the lag is what makes it feel like a lamp rather than a cursor effect. */
export function useTrailingLight<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const target = useRef({ x: 50, y: 50 });
  const current = useRef({ x: 50, y: 50 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.current = {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
    };
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.12;
      current.current.y += (target.current.y - current.current.y) * 0.12;
      el.style.setProperty('--lx', `${current.current.x.toFixed(2)}%`);
      el.style.setProperty('--ly', `${current.current.y.toFixed(2)}%`);
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => { el.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, [active]);

  return ref;
}
