import { useEffect, useRef, useState } from 'react';
import { LOCALES, LOCALE_LIST, T, useI18n, type Locale } from '../i18n';
import { GRAIN_URL } from '../design/grain';

/** The paper the interface is printed on. Fixed to the viewport, never scrolls. */
export function Grain() {
  return <div className="grain" aria-hidden="true" style={{ backgroundImage: GRAIN_URL }} />;
}

export function Wordmark() {
  return (
    <span className="mark">
      <svg className="mark__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4"  width="18" height="2.6" rx="0.6" fill="currentColor" />
        <rect x="3" y="17.4" width="18" height="2.6" rx="0.6" fill="currentColor" />
        <rect className="mark__slug" x="6.5" y="10.4" width="11" height="3.2" rx="0.6" />
      </svg>
      <span className="mark__word">Compresso</span>
    </span>
  );
}

/* ------------------------------------------------------------- language menu */

/** Native name first, English name beneath, a check on the active row. Never
 *  flags — a flag is a country, and es/pt-BR/zh don't map to one. */
export function LangMenu() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        className="lang__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('lang.label')}
      >
        {LOCALES[locale].native}
        <svg className="lang__caret" width="9" height="6" viewBox="0 0 9 6" aria-hidden="true">
          <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      <div className={`lang__sheet ${open ? 'is-open' : ''}`} role="listbox" aria-label={t('lang.label')}>
        {LOCALE_LIST.map((l, i) => (
          <button
            key={l}
            role="option"
            aria-selected={l === locale}
            className="lang__row"
            style={{ ['--i' as string]: i }}
            onClick={() => { setLocale(l as Locale); setOpen(false); }}
          >
            <span className="lang__native">{LOCALES[l].native}</span>
            <span className="lang__english">{LOCALES[l].english}</span>
            <span className="lang__check" aria-hidden="true">
              <svg width="12" height="9" viewBox="0 0 12 9">
                <path d="M1 4.6L4.3 8 11 1" stroke="currentColor" strokeWidth="1.4" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- status bar */

export function StatusBar({
  done, total, running, poolSize, offline,
}: { done: number; total: number; running: number; poolSize: number; offline: boolean }) {
  const { t, count } = useI18n();
  return (
    <footer className="status">
      <span className="status__cell"><T k="status.engine" /></span>
      <span className="status__dot" aria-hidden="true" />
      <span className="status__cell mono">
        {total > 0 ? t('status.files', { done: count(done), total: count(total) }) : '—'}
      </span>
      <span className="status__dot" aria-hidden="true" />
      <span className="status__cell mono">{count(poolSize)}×</span>

      <span className="status__spacer" />

      {running > 0 && <span className="status__pulse" aria-hidden="true" />}
      <span className="status__cell status__sent mono" title="Nothing is uploaded, ever">
        <T k="status.sent" />
      </span>
      {offline && (
        <span className="status__offline">
          <span className="status__blip" aria-hidden="true" />
          <T k="status.offline" />
        </span>
      )}
    </footer>
  );
}

/* -------------------------------------------------------------------- install */

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

export function useInstall() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BIPEvent); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  };

  return { canInstall: !!prompt && !dismissed, install, dismiss: () => setDismissed(true) };
}

export function InstallChip({ onInstall }: { onInstall: () => void }) {
  return (
    <button type="button" className="chip" onClick={onInstall}>
      <T k="install.action" />
    </button>
  );
}

export function UpdateBar({ onReload }: { onReload: () => void }) {
  return (
    <div className="update" role="status">
      <T k="update.body" />
      <button type="button" className="update__act" onClick={onReload}><T k="update.action" /></button>
    </div>
  );
}
