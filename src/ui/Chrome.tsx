import { useEffect, useRef, useState } from 'react';
import { LOCALES, LOCALE_LIST, T, useI18n, type Locale } from '../i18n';
import { GRAIN_URL } from '../design/grain';

/** A whisper of film grain over everything. On a true-black ground it stops the
 *  screen reading as a flat void without ever announcing itself. */
export function Grain() {
  return <div className="grain" aria-hidden="true" style={{ backgroundImage: GRAIN_URL }} />;
}

/** The app mark: a disc held between two plates. It arrives round and settles
 *  flat while the plates hold still — once, on load, and never again. */
export function Wordmark() {
  return (
    <span className="mark">
      <svg className="mark__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1.8" y="4.9" width="20.4" height="1.5" rx="0.75" fill="currentColor" />
        <ellipse className="mark__dot" cx="12" cy="12" rx="9.4" ry="4.3" fill="currentColor" />
        <rect x="1.8" y="17.6" width="20.4" height="1.5" rx="0.75" fill="currentColor" />
      </svg>
      <span className="mark__word">compresso</span>
    </span>
  );
}

/* ------------------------------------------------------------- language menu */

/** Native name first, English name beneath, a rule under the active one. Never
 *  flags — a flag is a country, and es / pt-BR / zh don't map to one. */
export function LangMenu() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
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
        type="button" className="lang__trigger label"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-haspopup="listbox" aria-label={t('lang.label')}
      >
        {LOCALES[locale].native}
      </button>

      <div className={`lang__sheet ${open ? 'is-open' : ''}`} role="listbox" aria-label={t('lang.label')}>
        {LOCALE_LIST.map((l, i) => (
          <button
            key={l} role="option" aria-selected={l === locale}
            className="lang__row" style={{ ['--i' as string]: i }}
            onClick={() => { setLocale(l as Locale); setOpen(false); }}
          >
            <span className="lang__native">{LOCALES[l].native}</span>
            <span className="lang__english label">{LOCALES[l].english}</span>
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
    <footer className="status label">
      <span><T k="status.engine" /></span>
      <span className="status__sep" aria-hidden="true">/</span>
      <span className="mono">{count(poolSize)}×</span>
      {total > 0 && (
        <>
          <span className="status__sep" aria-hidden="true">/</span>
          <span className="mono">{t('status.files', { done: count(done), total: count(total) })}</span>
        </>
      )}
      {running > 0 && <span className="status__pulse" aria-hidden="true" />}

      <span className="status__spacer" />

      {offline && (
        <>
          <span><T k="status.offline" /></span>
          <span className="status__sep" aria-hidden="true">/</span>
        </>
      )}
      <span className="status__sent"><T k="status.sent" /></span>
    </footer>
  );
}

/* -------------------------------------------------------------------- install */

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

export function useInstall() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);

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

  return { canInstall: !!prompt, install };
}

export function InstallChip({ onInstall }: { onInstall: () => void }) {
  return (
    <button type="button" className="ghost label" onClick={onInstall}>
      <T k="install.action" />
    </button>
  );
}

export function UpdateBar({ onReload }: { onReload: () => void }) {
  return (
    <div className="update label" role="status">
      <T k="update.body" />
      <button type="button" className="update__act" onClick={onReload}><T k="update.action" /></button>
    </div>
  );
}
