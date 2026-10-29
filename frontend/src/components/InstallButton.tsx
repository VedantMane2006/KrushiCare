import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstall } from '../hooks/useInstall';

/** "Install AgriSense": the browser's install prompt, or Add to Home Screen steps on iPhone. Hidden once installed. */
export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { state, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  if (state === 'installed' || state === 'unavailable') return null;

  if (compact) {
    return (
      <button
        onClick={() => (state === 'prompt' ? void install() : setIosHelp(!iosHelp))}
        className="rounded-xl border-2 border-leaf-800 px-3 py-1.5 font-semibold text-leaf-900 hover:bg-leaf-50"
      >
        ⬇️ {t('install.button')}
      </button>
    );
  }

  return (
    <section className="card space-y-2">
      <p className="font-semibold">📲 {t('install.title')}</p>
      <p className="text-sm text-gray-700">{t('install.help')}</p>
      <button className="btn-secondary" onClick={() => (state === 'prompt' ? void install() : setIosHelp(!iosHelp))}>
        ⬇️ {t('install.button')}
      </button>
      {state === 'ios' && iosHelp && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950" role="status">{t('install.ios_steps')}</p>
      )}
    </section>
  );
}
