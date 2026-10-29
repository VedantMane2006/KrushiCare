import { useTranslation } from 'react-i18next';
import { KCC_DISPLAY, KCC_TEL } from '../services/kcc';
import Icon from './Icon';

export default function KccButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const { t } = useTranslation();
  return (
    <a href={KCC_TEL} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}>
      <Icon name="phone" />
      <span>
        {t('result.call_kcc')} <span className="whitespace-nowrap font-normal">{KCC_DISPLAY}</span>
      </span>
    </a>
  );
}
