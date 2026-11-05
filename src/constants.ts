import type {
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementVisibility,
  ApprovalStatus,
  AssetType,
  AutomationCadence,
  BillingCycle,
  BugSeverity,
  BugStatus,
  ChatScope,
  ClientStatus,
  CompanyCategory,
  CompanyHealthState,
  CompanyStatus,
  ContractKind,
  ContractStatus,
  Currency,
  CustomerPaymentStatus,
  DocumentCategory,
  EmployeeStatus,
  InvoiceStatus,
  MeetingStatus,
  PaymentMethod,
  PermissionKey,
  ProjectStatus,
  SalaryStatus,
  SecurityEventKind,
  ServiceState,
  SubscriptionKind,
  SubscriptionStatus,
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

export const PERMISSION_KEYS: PermissionKey[] = [
  'companies',
  'services',
  'finance',
  'projects',
  'team',
  'approvals',
  'tasks',
  'settings',
];

export const PERMISSION_LABEL: Record<PermissionKey, TranslationKey> = {
  companies: 'Şirketler',
  services: 'Servisler',
  finance: 'Finans',
  projects: 'Projeler',
  team: 'Ekip',
  approvals: 'Onaylar',
  tasks: 'Görev & Notlar',
  settings: 'Ayarlar',
};

export const DEPARTMENT_COLORS = COMPANY_COLORS;

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

export const CLIENT_STATUSES: ClientStatus[] = ['lead', 'active', 'paused', 'lost'];
export const CLIENT_STATUS_LABEL: Record<ClientStatus, TranslationKey> = {
  lead: 'Aday',
  active: 'Aktif',
  paused: 'Duraklatıldı',
  lost: 'Kaybedildi',
};

export const CONTRACT_STATUSES: ContractStatus[] = ['active', 'pending', 'expired', 'terminated'];
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, TranslationKey> = {
  active: 'Aktif',
  pending: 'Başlamadı',
  expired: 'Süresi doldu',
  terminated: 'Feshedildi',
};

export const CONTRACT_KINDS: ContractKind[] = [
  'service',
  'supplier',
  'nda',
  'employment',
  'other',
];
export const CONTRACT_KIND_LABEL: Record<ContractKind, TranslationKey> = {
  service: 'Hizmet',
  supplier: 'Tedarik',
  nda: 'Gizlilik',
  employment: 'İstihdam',
  other: 'Diğer',
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'contract',
  'finance',
  'hr',
  'legal',
  'project',
  'other',
];
export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, TranslationKey> = {
  contract: 'Sözleşme',
  finance: 'Finans',
  hr: 'İnsan kaynakları',
  legal: 'Hukuk',
  project: 'Proje',
  other: 'Diğer',
};

export const BUG_SEVERITIES: BugSeverity[] = ['low', 'medium', 'high', 'critical'];
export const BUG_SEVERITY_LABEL: Record<BugSeverity, TranslationKey> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};

export const BUG_STATUSES: BugStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
export const BUG_STATUS_LABEL: Record<BugStatus, TranslationKey> = {
  open: 'Açık',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
};

export const AUTOMATION_CADENCES: AutomationCadence[] = ['daily', 'weekly', 'monthly'];
export const AUTOMATION_CADENCE_LABEL: Record<AutomationCadence, TranslationKey> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
};

export const SECURITY_EVENT_KINDS: SecurityEventKind[] = [
  'role',
  'approval',
  'backup',
  'import',
  'security',
  'account',
];
export const SECURITY_EVENT_LABEL: Record<SecurityEventKind, TranslationKey> = {
  role: 'Yetki',
  approval: 'Onay',
  backup: 'Yedek',
  import: 'İçe aktarma',
  security: 'Güvenlik',
  account: 'Hesap',
};

export const SALARY_STATUSES: SalaryStatus[] = ['planned', 'paid'];
export const SALARY_STATUS_LABEL: Record<SalaryStatus, TranslationKey> = {
  planned: 'Planlandı',
  paid: 'Ödendi',
};

export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'canceled'];
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus | 'overdue', TranslationKey> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  canceled: 'İptal',
  overdue: 'Gecikti',
};

export const PAYMENT_METHODS: PaymentMethod[] = ['transfer', 'card', 'cash', 'other'];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  transfer: 'Havale',
  card: 'Kart',
  cash: 'Nakit',
  other: 'Diğer',
};

export const PAYMENT_STATUS_LABEL: Record<CustomerPaymentStatus, TranslationKey> = {
  pending: 'Bekliyor',
  received: 'Alındı',
};

export const SUBSCRIPTION_KINDS: SubscriptionKind[] = ['subscription', 'license'];
export const SUBSCRIPTION_KIND_LABEL: Record<SubscriptionKind, TranslationKey> = {
  subscription: 'Abonelik',
  license: 'Lisans',
};

export const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly'];
export const BILLING_CYCLE_LABEL: Record<BillingCycle, TranslationKey> = {
  monthly: 'Aylık',
  yearly: 'Yıllık',
};

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active', 'paused', 'canceled'];
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, TranslationKey> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  canceled: 'İptal',
};

export const CHAT_SCOPES: ChatScope[] = ['company', 'department', 'direct'];
export const CHAT_SCOPE_LABEL: Record<ChatScope, TranslationKey> = {
  company: 'Şirket geneli',
  department: 'Departman',
  direct: 'Birebir',
};

export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = ['company', 'department'];
export const ANNOUNCEMENT_AUDIENCE_LABEL: Record<AnnouncementAudience, TranslationKey> = {
  company: 'Tüm şirket',
  department: 'Departman',
};

export const ANNOUNCEMENT_VISIBILITIES: AnnouncementVisibility[] = ['team', 'admin'];
export const ANNOUNCEMENT_VISIBILITY_LABEL: Record<AnnouncementVisibility, TranslationKey> = {
  team: 'Ekip akışı',
  admin: 'Yöneticiye özel',
};

export const ANNOUNCEMENT_STATUSES: AnnouncementStatus[] = ['draft', 'published', 'archived'];
export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, TranslationKey> = {
  draft: 'Taslak',
  published: 'Yayında',
  archived: 'Arşiv',
};

export const ANNOUNCEMENT_PRIORITIES: AnnouncementPriority[] = ['normal', 'important', 'urgent'];
export const ANNOUNCEMENT_PRIORITY_LABEL: Record<AnnouncementPriority, TranslationKey> = {
  normal: 'Normal',
  important: 'Önemli',
  urgent: 'Acil',
};

export const MEETING_STATUSES: MeetingStatus[] = ['planned', 'done', 'canceled'];
export const MEETING_STATUS_LABEL: Record<MeetingStatus, TranslationKey> = {
  planned: 'Planlandı',
  done: 'Tamamlandı',
  canceled: 'İptal',
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
