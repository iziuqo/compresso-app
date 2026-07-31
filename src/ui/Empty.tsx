import { useI18n, T } from '../i18n';
import { useTrailingLight } from './primitives';

/**
 * Nothing loaded yet.
 *
 * No dashed rectangle, no cloud-with-an-arrow. The whole ground is the target,
 * so the screen says what the app does and gives you one thing to press. A soft
 * light trails the pointer across the void at a lag; drag a file anywhere and
 * the light comes up and a hairline draws itself around the edge of the screen.
 */
export function Empty({
  onFiles, dragging,
}: { onFiles: (files: File[]) => void; dragging: boolean }) {
  const { t } = useI18n();
  const stage = useTrailingLight<HTMLDivElement>(true);
  const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

  return (
    <div className={`empty ${dragging ? 'is-over' : ''}`} ref={stage}>
      <span className="empty__light" aria-hidden="true" />
      <span className="empty__edge" aria-hidden="true" />

      <div className="empty__body">
        <h1 className="empty__title"><T k="empty.title" /></h1>
        <p className="empty__lede"><T k="empty.lede" /></p>

        <label className="pill pill--lg">
          <T k="empty.cta" />
          <input
            type="file" multiple accept="image/*,.heic,.heif" className="sr"
            onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
          />
        </label>

        <p className="empty__hint label">
          <T k="empty.hint" vars={{ key: isMac ? '⌘V' : 'Ctrl+V' }} />
        </p>
      </div>

      <p className="empty__formats mono" aria-label={t('empty.formats')}>
        <T k="empty.formats" />
      </p>
    </div>
  );
}
