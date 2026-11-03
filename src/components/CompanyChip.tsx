import type { Company } from '../types';
import { useI18n } from '../i18n';

export function CompanyChip({ company, withName = true }: { company?: Company | null; withName?: boolean }) {
  const { t } = useI18n();
  if (!company) {
    return (
      <span className="company-chip">
        <span className="company-dot" style={{ background: 'var(--text-3)' }} />
        {withName ? t('Şirketsiz') : null}
      </span>
    );
  }
  return (
    <span className="company-chip" title={company.name}>
      <span className="company-dot" style={{ background: company.color }} />
      {withName ? company.name : null}
    </span>
  );
}
