import { useTranslation } from 'react-i18next';
import { KCC_DISPLAY, KCC_TEL } from '../services/kcc';

export default function KccButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const { t } = useTranslation();
  return (
    <a href={KCC_TEL} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}>
      <span aria-hidden>📞</span>
      <span>
        {t('result.call_kcc')} <span className="whitespace-nowrap font-normal">{KCC_DISPLAY}</span>
      </span>
    </a>
  );
}
