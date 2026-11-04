import type { TranslationKey } from './i18n/core';

export type Page =
  | 'dashboard'
  | 'services'
  | 'companies'
  | 'company'
  | 'mail'
  | 'finance'
  | 'operations'
  | 'tasks'
  | 'tools'
  | 'connections'
  | 'music'
  | 'translate'
  | 'updates'
  | 'assistant'
  | 'account'
  | 'settings';

export type IntentKind = 'company' | 'asset' | 'finance' | 'task' | 'note';

export interface NavIntent {
  kind: IntentKind;
  at: number;
}

export const PAGE_LABEL: Record<Page, TranslationKey> = {
  dashboard: 'Genel Bakış',
  services: 'Servisler',
  companies: 'Şirketler',
  company: 'Şirket',
  mail: 'Posta',
  finance: 'Finans',
  operations: 'Operasyon',
  tasks: 'Görev & Notlar',
  tools: 'Hesap & Kur',
  connections: 'Bağlantılar',
  music: 'Müzik',
  translate: 'Çeviri',
  updates: 'Güncellemeler',
  assistant: 'Asistan',
  account: 'Hesap',
  settings: 'Ayarlar',
};
