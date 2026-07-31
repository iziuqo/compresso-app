import { T, useI18n } from '../i18n';
import { Group, NumberField, Segmented, Slider, type Option } from './primitives';
import type { Caps, Format, Params } from '../engine/types';
import type { Job } from '../state/queue';

/**
 * The inspector.
 *
 * Rows are separated by hairlines rather than boxed into cards — the structure is
 * carried by rules and spacing, the way a well-set page is. The Auto row explains
 * what Auto actually chose, because a black box that is usually right is still a
 * black box.
 */
export function Rail({
  params, setParams, caps, selected, onSave, onSaveAll, onShare, onClear, canShare, total,
}: {
  params: Params;
  setParams: (p: Params) => void;
  caps: Caps;
  selected: Job | null;
  onSave: () => void;
  onSaveAll: () => void;
  onShare: () => void;
  onClear: () => void;
  canShare: boolean;
  total: number;
}) {
  const { t, percent, bytes } = useI18n();

  const formats: Option<Format>[] = [
    { value: 'auto', label: t('rail.auto') },
    ...(caps.avif ? [{ value: 'avif' as Format, label: 'AVIF' }] : []),
    { value: 'webp', label: 'WebP' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
  ];

  const out = selected?.out ?? null;
  const grew = out ? out.savings < 0 : false;
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setParams({ ...params, [k]: v });

  return (
    <aside className="rail">
      <div className="rail__scroll">
        <Group label={t('rail.output')}>
          <div className="row">
            <div className="row__head">
              <span className="row__label"><T k="rail.format" /></span>
              {params.format === 'auto' && out && (
                <span className="row__value row__value--quiet mono">{out.format.toUpperCase()}</span>
              )}
            </div>
            <Segmented options={formats} value={params.format} onChange={(v) => set('format', v)} label={t('rail.format')} />
            {params.format === 'auto' && (
              <p className="row__note"><T k="rail.autoNote" /></p>
            )}
          </div>

          <div className="row">
            <Slider
              label={t('rail.quality')}
              value={params.quality}
              min={0.3} max={1} step={0.01}
              display={percent(params.quality)}
              onChange={(v) => set('quality', v)}
            />
          </div>
        </Group>

        <Group label={t('rail.dimensions')}>
          <div className="row row--pair">
            <NumberField
              label={t('rail.maxWidth')} value={params.maxWidth}
              placeholder={t('rail.unset')} suffix="px"
              onChange={(v) => set('maxWidth', v)}
            />
            <NumberField
              label={t('rail.maxHeight')} value={params.maxHeight}
              placeholder={t('rail.unset')} suffix="px"
              onChange={(v) => set('maxHeight', v)}
            />
          </div>
          <div className="row">
            <NumberField
              label={t('rail.maxSize')} value={params.maxSizeMB}
              placeholder={t('rail.unset')} suffix="MB"
              onChange={(v) => set('maxSizeMB', v)}
            />
          </div>
        </Group>

        {out && (
          <div className="readout">
            <span className="readout__k mono">{out.format.toUpperCase()}</span>
            <span className="readout__sep" aria-hidden="true">·</span>
            <span className="readout__k mono">{t('result.dims', { w: out.width, h: out.height })}</span>
            <span className="readout__sep" aria-hidden="true">·</span>
            <span className="readout__k mono">{bytes(out.compressedSize)}</span>
          </div>
        )}

        {/* The only place --signal appears outside the seam and the primary action.
            A margin mark, not a chip: a rule on the leading edge, nothing filled. */}
        {grew && params.format === 'png' && (
          <div className="warn" role="alert">
            <p className="warn__text"><T k="warn.inflated" /></p>
            <button type="button" className="warn__act" onClick={() => set('format', 'webp')}>
              <T k="warn.switchWebp" />
            </button>
          </div>
        )}
      </div>

      <div className="rail__foot">
        <button type="button" className="btn btn--primary" onClick={total > 1 ? onSaveAll : onSave}>
          <T k={total > 1 ? 'action.saveZip' : 'action.save'} />
        </button>
        <div className="rail__foot-row">
          {canShare && (
            <button type="button" className="btn btn--ghost" onClick={onShare}><T k="action.share" /></button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClear}><T k="action.clear" /></button>
        </div>
      </div>
    </aside>
  );
}
