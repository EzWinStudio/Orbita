import type { Company } from '../types';

const PLATFORM_ICONS = {
  discord: 'brand-icons/discord.svg',
  github: 'brand-icons/github.svg',
  youtube: 'brand-icons/youtube.svg',
  instagram: 'brand-icons/instagram.svg',
  wasmer: 'brand-icons/wasmer.svg',
} as const;

const PLATFORM_HOSTS: [string, keyof typeof PLATFORM_ICONS][] = [
  ['discord.gg', 'discord'],
  ['discord.com', 'discord'],
  ['discordapp.com', 'discord'],
  ['github.com', 'github'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['instagram.com', 'instagram'],
  ['wasmer.io', 'wasmer'],
];

const SERVICE_LOGOS: Record<string, string> = {
  aegis: 'service-logos/aegis.png',
  nexora: 'service-logos/nexora.png',
  vertex: 'service-logos/vertex.png',
};

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function companyLogo(company?: Company | null): string | null {
  const logo = company?.logo?.trim();
  return logo ? logo : null;
}

export function platformLogo(url: string, label = ''): string | null {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    /* fall through to the label match */
  }
  const match = PLATFORM_HOSTS.find(
    ([domain]) => host === domain || host.endsWith(`.${domain}`),
  );
  if (match) return PLATFORM_ICONS[match[1]];

  const text = label.toLowerCase();
  if (text.includes('discord')) return PLATFORM_ICONS.discord;
  if (text.includes('youtube')) return PLATFORM_ICONS.youtube;
  if (text.includes('github')) return PLATFORM_ICONS.github;
  if (text.includes('instagram')) return PLATFORM_ICONS.instagram;
  if (text.includes('wasmer')) return PLATFORM_ICONS.wasmer;
  return null;
}

export function serviceLogo(name: string, company?: Company | null): string | null {
  return SERVICE_LOGOS[normalizeName(name)] ?? companyLogo(company);
}
