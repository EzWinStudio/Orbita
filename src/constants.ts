import type {
  ApprovalStatus,
  AssetType,
  CompanyCategory,
  CompanyHealthState,
  CompanyStatus,
  Currency,
  EmployeeStatus,
  ProjectStatus,
  ServiceState,
} from './types';
import type { TranslationKey } from './i18n/core';

export const COMPANY_COLORS = [
  '#3ef2b5',
  '#5fc6ff',
  '#b98bff',
  '#ffc857',
  '#ff7b72',
  '#a8ff60',
  '#ff8fd8',
  '#9fe8d9',
];

export const COMPANY_STATUSES: CompanyStatus[] = ['active', 'maintenance', 'paused'];
export const COMPANY_CATEGORIES: CompanyCategory[] = [
  'studio',
  'platform',
  'game',
  'agency',
  'store',
  'music',
  'other',
];

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, TranslationKey> = {
  active: 'Aktif',
  maintenance: 'Bakımda',
  paused: 'Duraklatıldı',
};

export const COMPANY_CATEGORY_LABEL: Record<CompanyCategory, TranslationKey> = {
  studio: 'Stüdyo',
  platform: 'Platform',
  game: 'Oyun sunucusu',
  agency: 'Ajans',
  store: 'Mağaza',
  music: 'Müzik',
  other: 'Diğer',
};

export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'on_leave', 'inactive'];
export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, TranslationKey> = {
  active: 'Aktif',
  on_leave: 'İzinde',
  inactive: 'Pasif',
};

export const PROJECT_STATUSES: ProjectStatus[] = ['active', 'paused', 'completed'];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, TranslationKey> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, TranslationKey> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR'];

export const ASSET_TYPE_LABEL: Record<AssetType, TranslationKey> = {
  discord: 'Discord Bot',
  pterodactyl: 'Pterodactyl',
  website: 'Web Sitesi',
};

export const STATE_LABEL: Record<ServiceState, TranslationKey> = {
  online: 'Çalışıyor',
  degraded: 'Kısmen çalışıyor',
  offline: 'Çalışmıyor',
  unchecked: 'Kontrol edilmedi',
};

export const COMPANY_HEALTH_LABEL: Record<CompanyHealthState, TranslationKey> = {
  working: 'Çalışıyor',
  partial: 'Kısmen çalışıyor',
  broken: 'Çalışmıyor',
  none: 'Servis yok',
  unchecked: 'Kontrol edilmedi',
};

export const COMPANY_HEALTH_STATE: Record<CompanyHealthState, ServiceState> = {
  working: 'online',
  partial: 'degraded',
  broken: 'offline',
  none: 'unchecked',
  unchecked: 'unchecked',
};

export const PRIORITY_LABEL: Record<'low' | 'med' | 'high', TranslationKey> = {
  low: 'Düşük',
  med: 'Orta',
  high: 'Yüksek',
};

export const CURRENCY_LABEL: Record<Currency, TranslationKey> = {
  TRY: 'Türk Lirası (₺)',
  USD: 'Dolar ($)',
  EUR: 'Euro (€)',
};

export const CURRENCY_SHORT: Record<Currency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
