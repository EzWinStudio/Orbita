import type { Company } from '../types';

interface CompanyAvatarProps {
  company: Company;
  size?: 'lg' | 'xl';
}

export function CompanyAvatar({ company, size = 'lg' }: CompanyAvatarProps) {
  const initial = company.name.trim()[0]?.toLocaleUpperCase('tr') ?? '?';
  return (
    <span
      className={`company-avatar company-avatar-${size}${company.logo ? ' company-avatar-logo' : ''}`}
      style={{ background: company.color }}
    >
      {company.logo ? (
        <img src={company.logo} alt="" loading="lazy" decoding="async" />
      ) : (
        initial
      )}
    </span>
  );
}
