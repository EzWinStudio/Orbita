import type { Asset, Company, LinkItem } from '../types';
import { companyLogo, platformLogo, serviceLogo } from '../lib/brand';
import { AssetIcon } from './AssetIcon';

function initialOf(value: string, locale: string): string {
  return value.trim()[0]?.toLocaleUpperCase(locale) ?? '↗';
}

export function LinkAvatar({
  link,
  company,
  locale = 'tr',
}: {
  link: LinkItem;
  company?: Company | null;
  locale?: string;
}) {
  const platform = platformLogo(link.url, link.label);
  if (platform) {
    return (
      <span className="link-avatar link-avatar-platform">
        <img src={platform} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  const brand = companyLogo(company);
  if (brand) {
    return (
      <span className="link-avatar link-avatar-logo">
        <img src={brand} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  const color = company?.color ?? '#8b95a5';
  return (
    <span className="link-avatar" style={{ background: `${color}22`, color }}>
      {initialOf(link.label, locale)}
    </span>
  );
}

export function ServiceAvatar({
  asset,
  company,
}: {
  asset: Asset;
  company?: Company | null;
}) {
  const logo = serviceLogo(asset.name, company);
  if (!logo) {
    return (
      <span className="service-type-icon">
        <AssetIcon type={asset.type} size={15} />
      </span>
    );
  }

  return (
    <span className="service-type-icon service-type-logo">
      <img src={logo} alt="" loading="lazy" decoding="async" />
    </span>
  );
}
