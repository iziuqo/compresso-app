import { useI18n, T } from '../i18n';
import { useTrailingLight } from './primitives';
import { Wordmark } from './Chrome';

/**
 * The press bed, waiting.
 *
 * Two things are happening that shouldn't be noticed individually: the hairline
 * border drifts in luminance on a six-second cycle (it breathes — it does not
 * pulse, and it never scales), and a warm light trails the pointer across the
 * sheet at a lag, like a lamp above a workbench rather than a cursor effect.
 * Drag a file over it and the whole sheet takes an impression: it sinks.
 */
export function Empty({
  onFiles, dragging,
}: { onFiles: (files: File[]) => void; dragging: boolean }) {
  const { t } = useI18n();
  const sheet = useTrailingLight<HTMLDivElement>(true);
  const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

  return (
    <div className="empty">
      <div className={`sheet ${dragging ? 'is-over' : ''}`} ref={sheet}>
        <span className="sheet__light" aria-hidden="true" />
        <span className="sheet__edge" aria-hidden="true" />

        <div className="sheet__body">
          <Wordmark />
          <h1 className="sheet__title"><T k="empty.title" /></h1>
          <p className="sheet__lede"><T k="empty.lede" /></p>

          <label className="btn btn--primary">
            <T k="empty.cta" />
            <input
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              className="sr"
              onChange={(e) => {
                onFiles([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>

          <p className="sheet__hint">
            <T k="empty.hint" vars={{ key: isMac ? '⌘V' : 'Ctrl+V' }} />
          </p>
        </div>

        <p className="sheet__formats mono" aria-label={t('empty.formats')}>
          <T k="empty.formats" />
        </p>
      </div>
    </div>
  );
}
