import { tGlobal } from '../i18n/core';
import { PRODUCT_NAME } from '../lib/product';
import { normalizeLanguage } from '../i18n/languages';
import { scopedStorageKey } from './workspaceScope';
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementVisibility,
  AppData,
  Approval,
  ApprovalStatus,
  Asset,
  AssetType,
  AutomationCadence,
  AutomationRule,
  BillingCycle,
  BugReport,
  BugSeverity,
  BugStatus,
  ChatMessage,
  ChatScope,
  ChatThread,
  Client,
  ClientStatus,
  Company,
  CompanyCategory,
  CompanyDocument,
  CompanyStatus,
  Contract,
  ContractKind,
  ContractStatus,
  CustomerPayment,
  CustomerPaymentStatus,
  Department,
  DocumentCategory,
  Employee,
  EmployeeStatus,
  FinanceEntry,
  EzwinApi,
  HistoryPoint,
  Invoice,
  InvoiceStatus,
  LanguageCode,
  LinkItem,
  Meeting,
  MeetingStatus,
  Meta,
  Note,
  NotificationRead,
  PaymentMethod,
  PerformanceReview,
  PermissionKey,
  Project,
  ProjectStatus,
  RatesPayload,
  Role,
  SalaryPayment,
  SalaryStatus,
  SecurityEvent,
  SecurityEventKind,
  ServiceStatus,
  Settings,
  Subscription,
  SubscriptionKind,
  SubscriptionStatus,
  Task,
  TaskPriority,
} from '../types';

const STORAGE_KEY = 'ezwin.hub.web.v1';
const SAVED_AT_KEY = 'ezwin.hub.web.savedAt.v1';
const RATES_KEY = 'ezwin.hub.web.rates.v1';
const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR';
const RATES_MAX_AGE = 15 * 60 * 1000;
const WEB_VERSION = '2.6.2';

const COMPANY_STATUSES: CompanyStatus[] = ['active', 'maintenance', 'paused'];
const COMPANY_CATEGORIES: CompanyCategory[] = [
  'studio',
  'platform',
  'game',
  'agency',
  'store',
  'music',
  'other',
];
const ASSET_TYPES: AssetType[] = ['discord', 'pterodactyl', 'website'];
const SALARY_STATUSES: SalaryStatus[] = ['planned', 'paid'];
const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'canceled'];
const PAYMENT_METHODS: PaymentMethod[] = ['transfer', 'card', 'cash', 'other'];
const PAYMENT_STATUSES: CustomerPaymentStatus[] = ['pending', 'received'];
const SUBSCRIPTION_KINDS: SubscriptionKind[] = ['subscription', 'license'];
const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly'];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active', 'paused', 'canceled'];
const CHAT_SCOPES: ChatScope[] = ['company', 'department', 'direct'];
const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = ['company', 'department'];
const ANNOUNCEMENT_VISIBILITIES: AnnouncementVisibility[] = ['team', 'admin'];
const ANNOUNCEMENT_STATUSES: AnnouncementStatus[] = ['draft', 'published', 'archived'];
const ANNOUNCEMENT_PRIORITIES: AnnouncementPriority[] = ['normal', 'important', 'urgent'];
const MEETING_STATUSES: MeetingStatus[] = ['planned', 'done', 'canceled'];
const CLIENT_STATUSES: ClientStatus[] = ['lead', 'active', 'paused', 'lost'];
const CONTRACT_STATUSES: ContractStatus[] = ['active', 'pending', 'expired', 'terminated'];
const CONTRACT_KINDS: ContractKind[] = ['service', 'supplier', 'nda', 'employment', 'other'];
const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'contract',
  'finance',
  'hr',
  'legal',
  'project',
  'other',
];
const BUG_SEVERITIES: BugSeverity[] = ['low', 'medium', 'high', 'critical'];
const BUG_STATUSES: BugStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const AUTOMATION_CADENCES: AutomationCadence[] = ['daily', 'weekly', 'monthly'];
const SECURITY_EVENT_KINDS: SecurityEventKind[] = [
  'role',
  'approval',
  'backup',
  'import',
  'security',
  'account',
];
const TASK_PRIORITIES: TaskPriority[] = ['low', 'med', 'high'];
const START_PAGES = [
  'dashboard',
  'services',
  'companies',
  'operations',
  'finance',
  'tasks',
  'tools',
] as const;
const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'on_leave', 'inactive'];
const PROJECT_STATUSES: ProjectStatus[] = ['active', 'paused', 'completed'];
const PERMISSION_KEYS: PermissionKey[] = [
  'companies',
  'services',
  'finance',
  'projects',
  'team',
  'approvals',
  'tasks',
  'settings',
];
const DEPARTMENT_COLORS = [
  '#3ef2b5',
  '#5fc6ff',
  '#b98bff',
  '#ffc857',
  '#ff7b72',
  '#a8ff60',
  '#ff8fd8',
  '#9fe8d9',
];

type StatusListener = (statuses: Record<string, ServiceStatus>) => void;
const statusListeners = new Set<StatusListener>();

export interface BrowserSaveState {
  at: number;
  ok: boolean;
}

type SaveListener = (state: BrowserSaveState) => void;
const saveListeners = new Set<SaveListener>();

export function onBrowserSave(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

export function browserSavedAt(): number {
  try {
    const value = Number(localStorage.getItem(scopedStorageKey(SAVED_AT_KEY)));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function reportBrowserSave(ok: boolean): void {
  reportSave(ok);
}

function reportSave(ok: boolean): void {
  let at = 0;
  if (ok) {
    at = Date.now();
    try {
      localStorage.setItem(scopedStorageKey(SAVED_AT_KEY), String(at));
    } catch {
      /* the timestamp is cosmetic; the state write already succeeded */
    }
  }
  for (const listener of saveListeners) {
    try {
      listener({ at, ok });
    } catch {
      /* a broken indicator must not break persistence */
    }
  }
}

const DEFAULT_SETTINGS: Settings = {
  currency: 'TRY',
  pollIntervalSec: 60,
  openAtLogin: false,
  language: 'tr',
  clockFormat: '24h',
  showSeconds: false,
  startPage: 'dashboard',
  notifications: false,
  theme: 'night',
  maximized: false,
  reduceMotion: false,
  autoUpdate: false,
  updateFeedUrl: '',
  lastSeenVersion: null,
  translateSource: 'tr',
  translateTarget: 'en',
  musicVolume: 0.7,
};

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeColor(value: unknown): string {
  const color = asString(value);
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#3ef2b5';
}

function safeImage(value: unknown): string | null {
  const image = asString(value);
  if (!image) return null;
  if (image.startsWith('data:image/') || image.startsWith('https://') || image.startsWith('http://')) {
    return image;
  }
  if (!image.includes(':') && !image.startsWith('/') && !image.includes('\\')) {
    return image;
  }
  return null;
}

function safeUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLink(raw: unknown): LinkItem | null {
  if (!isRecord(raw)) return null;
  const label = asString(raw.label);
  const url = safeUrl(raw.url);
  if (!label || !url) return null;
  return { id: asString(raw.id) || uid(), label, url };
}

function normalizeCompany(raw: unknown, index: number): Company | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const status = COMPANY_STATUSES.includes(raw.status as CompanyStatus)
    ? (raw.status as CompanyStatus)
    : 'active';
  const category = COMPANY_CATEGORIES.includes(raw.category as CompanyCategory)
    ? (raw.category as CompanyCategory)
    : 'other';
  const target = asNumber(raw.monthlyTarget, 0);
  return {
    id: asString(raw.id) || `company-${index}-${uid()}`,
    name,
    color: safeColor(raw.color),
    logo: safeImage(raw.logo),
    description: asString(raw.description),
    status,
    category,
    monthlyTarget: target > 0 ? target : null,
    links: asArray(raw.links)
      .map(normalizeLink)
      .filter((link): link is LinkItem => Boolean(link)),
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeAsset(raw: unknown, index: number, companyIds: Set<string>): Asset | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const type = ASSET_TYPES.includes(raw.type as AssetType)
    ? (raw.type as AssetType)
    : 'website';
  const config = isRecord(raw.config) ? raw.config : {};
  const url = safeUrl(config.url);
  const baseUrl = safeUrl(config.baseUrl);
  return {
    id: asString(raw.id) || `asset-${index}-${uid()}`,
    companyId,
    type,
    name,
    config: {
      ...(url ? { url } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
    createdAt: asNumber(raw.createdAt, Date.now()),
    hasSecret: false,
    secretHint: null,
  };
}

function normalizeTask(raw: unknown, companyIds: Set<string>): Task | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const companyId = asString(raw.companyId);
  const priority = raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'med';
  const due = asString(raw.due);
  return {
    id: asString(raw.id) || uid(),
    title,
    companyId: companyIds.has(companyId) ? companyId : null,
    priority,
    due: due || null,
    done: Boolean(raw.done),
    assigneeId: asString(raw.assigneeId) || null,
    createdAt: asNumber(raw.createdAt, Date.now()),
    completedAt: Boolean(raw.done) ? asNumber(raw.completedAt, 0) || null : null,
  };
}

function normalizeNote(raw: unknown, companyIds: Set<string>): Note | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (!title && !body.trim()) return null;
  const companyId = asString(raw.companyId);
  const createdAt = asNumber(raw.createdAt, Date.now());
  return {
    id: asString(raw.id) || uid(),
    title: title || tGlobal('Adsız not'),
    body,
    companyId: companyIds.has(companyId) ? companyId : null,
    pinned: Boolean(raw.pinned),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeFinance(raw: unknown, companyIds: Set<string>): FinanceEntry | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const amount = asNumber(raw.amount, 0);
  if (!(amount > 0)) return null;
  const kind = raw.kind === 'expense' ? 'expense' : 'income';
  const date = asString(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    id: asString(raw.id) || uid(),
    companyId,
    kind,
    amount,
    category: asString(raw.category),
    note: asString(raw.note),
    date,
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeSalary(
  raw: unknown,
  companyIds: Set<string>,
  employeesById: Map<string, Employee>,
): SalaryPayment | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const amount = asNumber(raw.amount, 0);
  if (!(amount > 0)) return null;
  const period = asString(raw.period);
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const employeeIdRaw = asString(raw.employeeId);
  const employee = employeesById.get(employeeIdRaw);
  const employeeId = employee && employee.companyId === companyId ? employee.id : null;
  const employeeName = employee?.name ?? asString(raw.employeeName);
  if (!employeeName) return null;
  const status: SalaryStatus = SALARY_STATUSES.includes(raw.status as SalaryStatus)
    ? (raw.status as SalaryStatus)
    : 'planned';
  const createdAt = asNumber(raw.createdAt, Date.now());
  const paidAt = status === 'paid' ? asNumber(raw.paidAt, createdAt) : null;
  return {
    id: asString(raw.id) || uid(),
    companyId,
    employeeId,
    employeeName,
    period,
    amount,
    status,
    paidAt,
    note: asString(raw.note),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeInvoice(raw: unknown, companyIds: Set<string>): Invoice | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const customerName = asString(raw.customerName);
  if (!customerName) return null;
  const amount = asNumber(raw.amount, 0);
  if (!(amount > 0)) return null;
  const issueDate = asString(raw.issueDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return null;
  const dueRaw = asString(raw.dueDate);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : issueDate;
  const id = asString(raw.id) || uid();
  const status: InvoiceStatus = INVOICE_STATUSES.includes(raw.status as InvoiceStatus)
    ? (raw.status as InvoiceStatus)
    : 'sent';
  return {
    id,
    companyId,
    number: asString(raw.number) || `FTR-${issueDate.slice(0, 4)}-${id.slice(0, 4).toUpperCase()}`,
    customerName,
    customerEmail: asString(raw.customerEmail),
    amount,
    taxRate: Math.min(100, Math.max(0, asNumber(raw.taxRate, 0))),
    issueDate,
    dueDate,
    status,
    note: asString(raw.note),
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  };
}

function normalizeCustomerPayment(
  raw: unknown,
  companyIds: Set<string>,
  invoicesById: Map<string, Invoice>,
): CustomerPayment | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const amount = asNumber(raw.amount, 0);
  if (!(amount > 0)) return null;
  const date = asString(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const invoiceIdRaw = asString(raw.invoiceId);
  const invoice = invoicesById.get(invoiceIdRaw);
  const invoiceId = invoice && invoice.companyId === companyId ? invoice.id : null;
  const customerName = asString(raw.customerName) || invoice?.customerName || '';
  if (!customerName) return null;
  const status: CustomerPaymentStatus = PAYMENT_STATUSES.includes(
    raw.status as CustomerPaymentStatus,
  )
    ? (raw.status as CustomerPaymentStatus)
    : 'received';
  const method: PaymentMethod = PAYMENT_METHODS.includes(raw.method as PaymentMethod)
    ? (raw.method as PaymentMethod)
    : 'transfer';
  return {
    id: asString(raw.id) || uid(),
    companyId,
    customerName,
    invoiceId,
    amount,
    method,
    status,
    date,
    note: asString(raw.note),
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  };
}

function normalizeSubscription(raw: unknown, companyIds: Set<string>): Subscription | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const amount = Math.max(0, asNumber(raw.amount, 0));
  const nextRaw = asString(raw.nextRenewal);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRaw)) return null;
  const kind: SubscriptionKind = SUBSCRIPTION_KINDS.includes(raw.kind as SubscriptionKind)
    ? (raw.kind as SubscriptionKind)
    : 'subscription';
  const cycle: BillingCycle = BILLING_CYCLES.includes(raw.cycle as BillingCycle)
    ? (raw.cycle as BillingCycle)
    : 'monthly';
  const status: SubscriptionStatus = SUBSCRIPTION_STATUSES.includes(
    raw.status as SubscriptionStatus,
  )
    ? (raw.status as SubscriptionStatus)
    : 'active';
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name,
    vendor: asString(raw.vendor),
    kind,
    amount,
    cycle,
    nextRenewal: nextRaw,
    status,
    note: asString(raw.note),
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  };
}

function normalizeChatThread(
  raw: unknown,
  companyIds: Set<string>,
  departmentsById: Map<string, Department>,
  employeesById: Map<string, Employee>,
): ChatThread | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const scope: ChatScope = CHAT_SCOPES.includes(raw.scope as ChatScope)
    ? (raw.scope as ChatScope)
    : 'company';
  const departmentIdRaw = asString(raw.departmentId);
  const employeeIdRaw = asString(raw.employeeId);
  const department = departmentsById.get(departmentIdRaw);
  const employee = employeesById.get(employeeIdRaw);
  if (scope === 'department' && department?.companyId !== companyId) return null;
  if (scope === 'direct' && employee?.companyId !== companyId) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  return {
    id: asString(raw.id) || uid(),
    companyId,
    scope,
    departmentId: scope === 'department' ? departmentIdRaw : null,
    employeeId: scope === 'direct' ? employeeIdRaw : null,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeChatMessage(raw: unknown, threadIds: Set<string>): ChatMessage | null {
  if (!isRecord(raw)) return null;
  const threadId = asString(raw.threadId);
  if (!threadIds.has(threadId)) return null;
  const body = asString(raw.body).slice(0, 4000);
  if (!body) return null;
  return {
    id: asString(raw.id) || uid(),
    threadId,
    author: asString(raw.author).slice(0, 80),
    body,
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeAnnouncement(
  raw: unknown,
  companyIds: Set<string>,
  departmentsById: Map<string, Department>,
): Announcement | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title).slice(0, 160);
  const body = asString(raw.body).slice(0, 8000);
  if (!title || !body) return null;
  const audience: AnnouncementAudience = ANNOUNCEMENT_AUDIENCES.includes(
    raw.audience as AnnouncementAudience,
  )
    ? (raw.audience as AnnouncementAudience)
    : 'company';
  const departmentIdRaw = asString(raw.departmentId);
  const department = departmentsById.get(departmentIdRaw);
  const departmentId =
    audience === 'department' && department?.companyId === companyId ? departmentIdRaw : null;
  const visibility: AnnouncementVisibility = ANNOUNCEMENT_VISIBILITIES.includes(
    raw.visibility as AnnouncementVisibility,
  )
    ? (raw.visibility as AnnouncementVisibility)
    : 'team';
  const priority: AnnouncementPriority = ANNOUNCEMENT_PRIORITIES.includes(
    raw.priority as AnnouncementPriority,
  )
    ? (raw.priority as AnnouncementPriority)
    : 'normal';
  const status: AnnouncementStatus = ANNOUNCEMENT_STATUSES.includes(
    raw.status as AnnouncementStatus,
  )
    ? (raw.status as AnnouncementStatus)
    : 'draft';
  const createdAt = asNumber(raw.createdAt, Date.now());
  const updatedAt = asNumber(raw.updatedAt, createdAt);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    departmentId,
    title,
    body,
    audience,
    visibility,
    priority,
    pinned: raw.pinned === true,
    status,
    author: asString(raw.author).slice(0, 80),
    publishedAt:
      status === 'published' ? asNumber(raw.publishedAt, updatedAt || createdAt) : null,
    createdAt,
    updatedAt,
  };
}

function normalizeMeeting(
  raw: unknown,
  companyIds: Set<string>,
  departmentsById: Map<string, Department>,
  employeesById: Map<string, Employee>,
): Meeting | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title).slice(0, 160);
  if (!title) return null;
  const date = asString(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = asString(raw.time);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const departmentIdRaw = asString(raw.departmentId);
  const department = departmentsById.get(departmentIdRaw);
  const departmentId = department?.companyId === companyId ? departmentIdRaw : null;
  const attendeeIds = Array.from(
    new Set(
      asArray(raw.attendeeIds)
        .map(asString)
        .filter((id) => employeesById.get(id)?.companyId === companyId),
    ),
  );
  const status: MeetingStatus = MEETING_STATUSES.includes(raw.status as MeetingStatus)
    ? (raw.status as MeetingStatus)
    : 'planned';
  const createdAt = asNumber(raw.createdAt, Date.now());
  return {
    id: asString(raw.id) || uid(),
    companyId,
    departmentId,
    title,
    agenda: asString(raw.agenda).slice(0, 4000),
    date,
    time,
    durationMin: Math.min(480, Math.max(5, asNumber(raw.durationMin, 30))),
    location: asString(raw.location).slice(0, 200),
    attendeeIds,
    status,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeNotificationReads(raw: unknown): NotificationRead[] {
  const seen = new Set<string>();
  return asArray(raw)
    .filter(isRecord)
    .map((item) => ({
      id: asString(item.id).slice(0, 200),
      readAt: asNumber(item.readAt, 0),
    }))
    .filter((item) => {
      if (!item.id || !item.readAt || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.readAt - a.readAt)
    .slice(0, 500);
}

function normalizeClient(raw: unknown, companyIds: Set<string>): Client | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const nextFollowUp = asString(raw.nextFollowUp);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name: name.slice(0, 160),
    contactName: asString(raw.contactName).slice(0, 120),
    email: asString(raw.email).slice(0, 160),
    phone: asString(raw.phone).slice(0, 60),
    status: CLIENT_STATUSES.includes(raw.status as ClientStatus)
      ? (raw.status as ClientStatus)
      : 'lead',
    value: Math.max(0, asNumber(raw.value, 0)),
    nextFollowUp: /^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp) ? nextFollowUp : null,
    note: asString(raw.note).slice(0, 1000),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeContract(raw: unknown, companyIds: Set<string>): Contract | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const startDate = asString(raw.startDate);
  const endDate = asString(raw.endDate);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    title: title.slice(0, 200),
    counterparty: asString(raw.counterparty).slice(0, 160),
    kind: CONTRACT_KINDS.includes(raw.kind as ContractKind)
      ? (raw.kind as ContractKind)
      : 'service',
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null,
    value: Math.max(0, asNumber(raw.value, 0)),
    status: CONTRACT_STATUSES.includes(raw.status as ContractStatus)
      ? (raw.status as ContractStatus)
      : 'active',
    note: asString(raw.note).slice(0, 2000),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeDocument(raw: unknown, companyIds: Set<string>): CompanyDocument | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  return {
    id: asString(raw.id) || uid(),
    companyId,
    title: title.slice(0, 200),
    category: DOCUMENT_CATEGORIES.includes(raw.category as DocumentCategory)
      ? (raw.category as DocumentCategory)
      : 'other',
    fileName: asString(raw.fileName).slice(0, 240),
    mimeType: asString(raw.mimeType).slice(0, 120),
    size: Math.max(0, asNumber(raw.size, 0)),
    hasFile: Boolean(raw.hasFile),
    note: asString(raw.note).slice(0, 2000),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeBug(raw: unknown, companyIds: Set<string>): BugReport | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const status: BugStatus = BUG_STATUSES.includes(raw.status as BugStatus)
    ? (raw.status as BugStatus)
    : 'open';
  return {
    id: asString(raw.id) || uid(),
    companyId,
    projectId: asString(raw.projectId) || null,
    title: title.slice(0, 200),
    description: asString(raw.description).slice(0, 4000),
    severity: BUG_SEVERITIES.includes(raw.severity as BugSeverity)
      ? (raw.severity as BugSeverity)
      : 'medium',
    status,
    reportedBy: asString(raw.reportedBy).slice(0, 120),
    assigneeId: asString(raw.assigneeId) || null,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
    resolvedAt:
      status === 'resolved' || status === 'closed'
        ? asNumber(raw.resolvedAt, 0) || null
        : null,
  };
}

function normalizeAutomationRule(
  raw: unknown,
  companyIds: Set<string>,
): AutomationRule | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const nextRun = asString(raw.nextRun);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    title: title.slice(0, 200),
    priority: TASK_PRIORITIES.includes(raw.priority as TaskPriority)
      ? (raw.priority as TaskPriority)
      : 'med',
    assigneeId: asString(raw.assigneeId) || null,
    cadence: AUTOMATION_CADENCES.includes(raw.cadence as AutomationCadence)
      ? (raw.cadence as AutomationCadence)
      : 'weekly',
    nextRun: /^\d{4}-\d{2}-\d{2}$/.test(nextRun) ? nextRun : new Date().toISOString().slice(0, 10),
    enabled: raw.enabled !== false,
    lastRun: asNumber(raw.lastRun, 0) || null,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeSecurityEvents(raw: unknown, companyIds: Set<string>): SecurityEvent[] {
  return asArray(raw)
    .filter(isRecord)
    .map((item) => {
      const companyId = asString(item.companyId);
      return {
        id: asString(item.id).slice(0, 120),
        at: asNumber(item.at, 0),
        kind: SECURITY_EVENT_KINDS.includes(item.kind as SecurityEventKind)
          ? (item.kind as SecurityEventKind)
          : 'account',
        actor: asString(item.actor).slice(0, 120),
        detail: asString(item.detail).slice(0, 600),
        companyId: companyIds.has(companyId) ? companyId : null,
      };
    })
    .filter((item) => item.id && item.at && item.detail)
    .sort((a, b) => b.at - a.at)
    .slice(0, 500);
}

function nextInvoiceNumber(state: AppData, issueDate: string): string {
  const prefix = `FTR-${issueDate.slice(0, 4)}-`;
  let max = 0;
  for (const invoice of state.invoices) {
    if (!invoice.number.startsWith(prefix)) continue;
    const sequence = Number(invoice.number.slice(prefix.length));
    if (Number.isFinite(sequence)) max = Math.max(max, sequence);
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function normalizeEmployee(raw: unknown, companyIds: Set<string>): Employee | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const startDate = asString(raw.startDate);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name,
    role: asString(raw.role),
    email: asString(raw.email),
    status: EMPLOYEE_STATUSES.includes(raw.status as EmployeeStatus)
      ? (raw.status as EmployeeStatus)
      : 'active',
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
    departmentId: asString(raw.departmentId) || null,
    roleId: asString(raw.roleId) || null,
    notes: asString(raw.notes),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeDepartment(raw: unknown, companyIds: Set<string>): Department | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const color = asString(raw.color);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name,
    description: asString(raw.description),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : DEPARTMENT_COLORS[0],
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeRole(raw: unknown, companyIds: Set<string>): Role | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const permissions = Array.from(
    new Set(
      asArray(raw.permissions).filter((permission): permission is PermissionKey =>
        PERMISSION_KEYS.includes(permission as PermissionKey),
      ),
    ),
  );
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name,
    description: asString(raw.description),
    permissions,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizePerformanceReview(
  raw: unknown,
  employeesById: Map<string, Employee>,
): PerformanceReview | null {
  if (!isRecord(raw)) return null;
  const employee = employeesById.get(asString(raw.employeeId));
  if (!employee) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const score = Math.round(asNumber(raw.score, 0));
  if (score < 0 || score > 100) return null;
  const period = asString(raw.period);
  return {
    id: asString(raw.id) || uid(),
    employeeId: employee.id,
    companyId: employee.companyId,
    period: /^\d{4}-\d{2}$/.test(period) ? period : new Date(createdAt).toISOString().slice(0, 7),
    score,
    reviewer: asString(raw.reviewer),
    strengths: asString(raw.strengths),
    improvements: asString(raw.improvements),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeProject(raw: unknown, companyIds: Set<string>): Project | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const dueDate = asString(raw.dueDate);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    name,
    description: asString(raw.description),
    status: PROJECT_STATUSES.includes(raw.status as ProjectStatus)
      ? (raw.status as ProjectStatus)
      : 'active',
    progress: Math.min(100, Math.max(0, asNumber(raw.progress, 0))),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeApproval(raw: unknown, companyIds: Set<string>): Approval | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const createdAt = asNumber(raw.createdAt, Date.now());
  const status: ApprovalStatus =
    raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'pending';
  const amount = asNumber(raw.amount, 0);
  return {
    id: asString(raw.id) || uid(),
    companyId,
    title,
    requestedBy: asString(raw.requestedBy),
    amount: amount > 0 ? amount : null,
    note: asString(raw.note),
    status,
    decidedBy: asString(raw.decidedBy).slice(0, 120),
    decisionNote: asString(raw.decisionNote).slice(0, 1000),
    createdAt,
    decidedAt: status !== 'pending' ? asNumber(raw.decidedAt, createdAt) : null,
  };
}

function normalizeSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};
  const currency = ['TRY', 'USD', 'EUR'].includes(asString(source.currency))
    ? (asString(source.currency) as Settings['currency'])
    : DEFAULT_SETTINGS.currency;
  const theme = ['night', 'violet', 'ice', 'lime'].includes(asString(source.theme))
    ? (asString(source.theme) as Settings['theme'])
    : DEFAULT_SETTINGS.theme;
  const startPage = START_PAGES.includes(asString(source.startPage) as (typeof START_PAGES)[number])
    ? (asString(source.startPage) as Settings['startPage'])
    : 'dashboard';
  const pollIntervalSec = [30, 60, 120, 300, 600].includes(asNumber(source.pollIntervalSec))
    ? asNumber(source.pollIntervalSec)
    : DEFAULT_SETTINGS.pollIntervalSec;
  const translateSource = /^[a-z]{2}$/.test(asString(source.translateSource))
    ? asString(source.translateSource)
    : DEFAULT_SETTINGS.translateSource;
  const translateTarget = /^[a-z]{2}$/.test(asString(source.translateTarget))
    ? asString(source.translateTarget)
    : DEFAULT_SETTINGS.translateTarget;
  return {
    currency,
    pollIntervalSec,
    openAtLogin: false,
    language: normalizeLanguage(source.language),
    clockFormat: source.clockFormat === '12h' ? '12h' : '24h',
    showSeconds: Boolean(source.showSeconds),
    startPage,
    notifications: Boolean(source.notifications),
    theme,
    maximized: false,
    reduceMotion: Boolean(source.reduceMotion),
    autoUpdate: false,
    updateFeedUrl: '',
    lastSeenVersion: null,
    translateSource,
    translateTarget,
    musicVolume: 0.7,
  };
}

function emptyState(): AppData {
  return {
    version: 1,
    companies: [],
    assets: [],
    mailAccounts: [],
    youtubeChannels: [],
    youtubeEvents: [],
    youtubeKey: { hasKey: false, hint: null },
    youtubeKeys: [],
    tasks: [],
    notes: [],
    finance: [],
    salaries: [],
    invoices: [],
    customerPayments: [],
    subscriptions: [],
    chatThreads: [],
    chatMessages: [],
    announcements: [],
    meetings: [],
    notificationReads: [],
    clients: [],
    contracts: [],
    documents: [],
    bugs: [],
    automationRules: [],
    securityEvents: [],
    employees: [],
    projects: [],
    approvals: [],
    departments: [],
    roles: [],
    performanceReviews: [],
    connections: [],
    playlist: [],
    settings: { ...DEFAULT_SETTINGS },
    statuses: {},
  };
}

function unwrapState(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (isRecord(raw.data)) return raw.data;
  if (isRecord(raw.state)) return raw.state;
  return raw;
}

function normalizeHistory(raw: unknown): HistoryPoint | null {
  if (!isRecord(raw)) return null;
  const t = asNumber(raw.t, 0);
  if (!t) return null;
  return {
    t,
    ok: raw.ok === true,
    ms: typeof raw.ms === 'number' && Number.isFinite(raw.ms) ? raw.ms : null,
  };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStatuses(
  raw: unknown,
  assetIds: Set<string>,
): Record<string, ServiceStatus> {
  if (!isRecord(raw)) return {};
  const statuses: Record<string, ServiceStatus> = {};
  for (const assetId of Object.keys(raw)) {
    if (!assetIds.has(assetId)) continue;
    const status = raw[assetId];
    if (!isRecord(status)) continue;
    if (status.state !== 'online' && status.state !== 'degraded' && status.state !== 'offline') {
      continue;
    }
    const checkedAt = asNumber(status.checkedAt, 0);
    if (!checkedAt) continue;
    const entry: ServiceStatus = {
      assetId,
      checkedAt,
      state: status.state,
      latencyMs: finiteOrNull(status.latencyMs),
      summary: asString(status.summary),
      error: asString(status.error) || null,
    };
    if (isRecord(status.website)) {
      const website = status.website;
      entry.website = {
        statusCode: finiteOrNull(website.statusCode),
        sslExpiresAt: finiteOrNull(website.sslExpiresAt),
        history: asArray(website.history)
          .map(normalizeHistory)
          .filter((point): point is HistoryPoint => Boolean(point))
          .slice(-30),
      };
    }
    if (isRecord(status.discord)) {
      const discord = status.discord;
      entry.discord = {
        botId: asString(discord.botId),
        username: asString(discord.username) || 'Bot',
        guildCount: finiteOrNull(discord.guildCount) ?? undefined,
        guilds: asArray(discord.guilds)
          .filter(isRecord)
          .map((guild) => ({ id: asString(guild.id), name: asString(guild.name) }))
          .filter((guild) => Boolean(guild.id))
          .slice(0, 200),
      };
    }
    if (isRecord(status.pterodactyl)) {
      const panel = status.pterodactyl;
      entry.pterodactyl = {
        account: asString(panel.account) || null,
        total: asNumber(panel.total, 0),
        servers: asArray(panel.servers)
          .filter(isRecord)
          .map((server) => ({
            id: asString(server.id),
            name: asString(server.name),
            state: asString(server.state),
            cpuPercent: finiteOrNull(server.cpuPercent),
            memoryMb: finiteOrNull(server.memoryMb),
            memoryLimitMb: finiteOrNull(server.memoryLimitMb),
            diskMb: finiteOrNull(server.diskMb),
            diskLimitMb: finiteOrNull(server.diskLimitMb),
            uptimeMs: finiteOrNull(server.uptimeMs),
          }))
          .filter((server) => Boolean(server.id)),
      };
    }
    statuses[assetId] = entry;
  }
  return statuses;
}

export function normalizeState(raw: unknown): AppData {
  const source = unwrapState(raw);
  if (!isRecord(source)) return emptyState();

  const companies = asArray(source.companies)
    .map(normalizeCompany)
    .filter((company): company is Company => Boolean(company));
  const companyIds = new Set(companies.map((company) => company.id));
  const assets = asArray(source.assets)
    .map((asset, index) => normalizeAsset(asset, index, companyIds))
    .filter((asset): asset is Asset => Boolean(asset));
  const assetIds = new Set(assets.map((asset) => asset.id));
  const employees = asArray(source.employees)
    .map((employee) => normalizeEmployee(employee, companyIds))
    .filter((employee): employee is Employee => Boolean(employee));
  const departments = asArray(source.departments)
    .map((department) => normalizeDepartment(department, companyIds))
    .filter((department): department is Department => Boolean(department));
  const roles = asArray(source.roles)
    .map((role) => normalizeRole(role, companyIds))
    .filter((role): role is Role => Boolean(role));
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  for (const employee of employees) {
    if (
      employee.departmentId &&
      departmentById.get(employee.departmentId)?.companyId !== employee.companyId
    ) {
      employee.departmentId = null;
    }
    if (employee.roleId && roleById.get(employee.roleId)?.companyId !== employee.companyId) {
      employee.roleId = null;
    }
  }
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const projects = asArray(source.projects)
    .map((project) => normalizeProject(project, companyIds))
    .filter((project): project is Project => Boolean(project));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const tasks = asArray(source.tasks)
    .map((task) => normalizeTask(task, companyIds))
    .filter((task): task is Task => Boolean(task));
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    const assignee = employeesById.get(task.assigneeId);
    if (!assignee || (task.companyId && assignee.companyId !== task.companyId)) {
      task.assigneeId = null;
    }
  }
  const salaries = asArray(source.salaries)
    .map((salary) => normalizeSalary(salary, companyIds, employeesById))
    .filter((salary): salary is SalaryPayment => Boolean(salary));
  const invoices = asArray(source.invoices)
    .map((invoice) => normalizeInvoice(invoice, companyIds))
    .filter((invoice): invoice is Invoice => Boolean(invoice));
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const customerPayments = asArray(source.customerPayments)
    .map((payment) => normalizeCustomerPayment(payment, companyIds, invoicesById))
    .filter((payment): payment is CustomerPayment => Boolean(payment));
  const subscriptions = asArray(source.subscriptions)
    .map((subscription) => normalizeSubscription(subscription, companyIds))
    .filter((subscription): subscription is Subscription => Boolean(subscription));
  const chatThreads = asArray(source.chatThreads)
    .map((thread) => normalizeChatThread(thread, companyIds, departmentById, employeesById))
    .filter((thread): thread is ChatThread => Boolean(thread));
  const chatThreadIds = new Set(chatThreads.map((thread) => thread.id));
  const chatMessages = asArray(source.chatMessages)
    .map((message) => normalizeChatMessage(message, chatThreadIds))
    .filter((message): message is ChatMessage => Boolean(message));
  const announcements = asArray(source.announcements)
    .map((announcement) => normalizeAnnouncement(announcement, companyIds, departmentById))
    .filter((announcement): announcement is Announcement => Boolean(announcement));
  const meetings = asArray(source.meetings)
    .map((meeting) => normalizeMeeting(meeting, companyIds, departmentById, employeesById))
    .filter((meeting): meeting is Meeting => Boolean(meeting));
  const notificationReads = normalizeNotificationReads(source.notificationReads);
  const clients = asArray(source.clients)
    .map((client) => normalizeClient(client, companyIds))
    .filter((client): client is Client => Boolean(client));
  const contracts = asArray(source.contracts)
    .map((contract) => normalizeContract(contract, companyIds))
    .filter((contract): contract is Contract => Boolean(contract));
  const documents = asArray(source.documents)
    .map((document) => normalizeDocument(document, companyIds))
    .filter((document): document is CompanyDocument => Boolean(document));
  const bugs = asArray(source.bugs)
    .map((bug) => normalizeBug(bug, companyIds))
    .filter((bug): bug is BugReport => Boolean(bug));
  for (const bug of bugs) {
    if (bug.projectId) {
      const project = projectsById.get(bug.projectId);
      if (!project || project.companyId !== bug.companyId) bug.projectId = null;
    }
    if (bug.assigneeId) {
      const assignee = employeesById.get(bug.assigneeId);
      if (!assignee || assignee.companyId !== bug.companyId) bug.assigneeId = null;
    }
  }
  const automationRules = asArray(source.automationRules)
    .map((rule) => normalizeAutomationRule(rule, companyIds))
    .filter((rule): rule is AutomationRule => Boolean(rule));
  for (const rule of automationRules) {
    if (!rule.assigneeId) continue;
    const assignee = employeesById.get(rule.assigneeId);
    if (!assignee || assignee.companyId !== rule.companyId) rule.assigneeId = null;
  }
  const securityEvents = normalizeSecurityEvents(source.securityEvents, companyIds);

  return {
    version: 1,
    companies,
    assets,
    mailAccounts: [],
    youtubeChannels: [],
    youtubeEvents: [],
    youtubeKey: { hasKey: false, hint: null },
    youtubeKeys: [],
    tasks,
    notes: asArray(source.notes)
      .map((note) => normalizeNote(note, companyIds))
      .filter((note): note is Note => Boolean(note)),
    finance: asArray(source.finance)
      .map((entry) => normalizeFinance(entry, companyIds))
      .filter((entry): entry is FinanceEntry => Boolean(entry)),
    salaries,
    invoices,
    customerPayments,
    subscriptions,
    chatThreads,
    chatMessages,
    announcements,
    meetings,
    notificationReads,
    clients,
    contracts,
    documents,
    bugs,
    automationRules,
    securityEvents,
    employees,
    projects,
    approvals: asArray(source.approvals)
      .map((approval) => normalizeApproval(approval, companyIds))
      .filter((approval): approval is Approval => Boolean(approval)),
    departments,
    roles,
    performanceReviews: asArray(source.performanceReviews)
      .map((review) => normalizePerformanceReview(review, employeesById))
      .filter((review): review is PerformanceReview => Boolean(review)),
    connections: [],
    playlist: [],
    settings: normalizeSettings(source.settings),
    statuses: normalizeStatuses(source.statuses, assetIds),
  };
}

function readState(): AppData {
  let raw: string | null = null;
  const key = scopedStorageKey(STORAGE_KEY);
  try {
    raw = localStorage.getItem(key);
  } catch {
    throw new Error('Tarayıcı depolamasına erişilemiyor. Gizli mod veya site verisi engeli olabilir.');
  }
  if (!raw) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    try {
      localStorage.setItem(`${key}.bozuk.${Date.now()}`, raw);
      localStorage.removeItem(key);
    } catch {
      /* ignore recovery failure */
    }
    return emptyState();
  }
}

function writeState(state: AppData): AppData {
  try {
    localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(state));
  } catch {
    reportSave(false);
    throw new Error('Tarayıcı depolaması dolu. JSON yedeği alıp eski kayıtları sil.');
  }
  reportSave(true);
  return state;
}

export function checkpointBrowserSave(): void {
  try {
    if (!localStorage.getItem(scopedStorageKey(STORAGE_KEY))) return;
    writeState(readState());
  } catch {
    /* writeState already surfaced the failure */
  }
}

export function readBrowserState(): AppData {
  return readState();
}

export function applySyncedState(raw: unknown): AppData {
  const local = readState();
  const remote = normalizeState(raw);
  const next: AppData = {
    ...remote,
    statuses: local.statuses,
    settings: {
      ...remote.settings,
      theme: local.settings.theme,
      language: local.settings.language,
      clockFormat: local.settings.clockFormat,
      showSeconds: local.settings.showSeconds,
      startPage: local.settings.startPage,
      maximized: local.settings.maximized,
      reduceMotion: local.settings.reduceMotion,
      openAtLogin: local.settings.openAtLogin,
      autoUpdate: local.settings.autoUpdate,
      updateFeedUrl: local.settings.updateFeedUrl,
      lastSeenVersion: local.settings.lastSeenVersion,
    },
  };
  writeState(next);
  window.dispatchEvent(new CustomEvent<AppData>('ezwin:sync-applied', { detail: next }));
  return next;
}

export function applyServiceStatuses(next: Record<string, ServiceStatus>): void {
  if (!Object.keys(next).length) return;
  const state = readState();
  state.statuses = { ...state.statuses, ...next };
  writeState(state);
  for (const listener of statusListeners) listener(state.statuses);
}

export function clearServiceStatuses(ids: string[]): void {
  if (!ids.length) return;
  const state = readState();
  let changed = false;
  for (const id of ids) {
    if (!state.statuses[id]) continue;
    delete state.statuses[id];
    changed = true;
  }
  if (!changed) return;
  writeState(state);
  for (const listener of statusListeners) listener(state.statuses);
}

export function findAssetId(
  companyId: string,
  name: string,
  type: AssetType,
): string | null {
  const state = readState();
  for (let index = state.assets.length - 1; index >= 0; index -= 1) {
    const asset = state.assets[index];
    if (asset.companyId === companyId && asset.name === name && asset.type === type) {
      return asset.id;
    }
  }
  return null;
}

function meta(): Meta {
  return {
    appVersion: WEB_VERSION,
    secureStorage: false,
    dataPath: 'localStorage',
    platform: 'web',
  };
}

function unsupported(): never {
  throw new Error(tGlobal('Bu özellik web sürümünde kullanılamıyor.'));
}

function findCompany(state: AppData, id: string): Company {
  const company = state.companies.find((item) => item.id === id);
  if (!company) throw new Error('Şirket bulunamadı.');
  return company;
}

export function exportPayload(state = readState()): {
  exportedAt: string;
  note: string;
  data: AppData;
} {
  return {
    exportedAt: new Date().toISOString(),
    note: 'API anahtarları ve gizli değerler bu yedekte yer almaz.',
    data: state,
  };
}

function downloadJson(payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `orbita-web-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function importBackup(text: string): {
  companies: number;
  assets: number;
  tasks: number;
  notes: number;
  finance: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Yedek dosyası okunamadı.');
  }
  const source = unwrapState(parsed);
  if (!isRecord(source)) throw new Error('Yedek dosyası geçersiz.');
  const known = [
    'companies',
    'assets',
    'tasks',
    'notes',
    'finance',
    'salaries',
    'invoices',
    'customerPayments',
    'subscriptions',
    'chatThreads',
    'chatMessages',
    'announcements',
    'meetings',
    'notificationReads',
    'clients',
    'contracts',
    'documents',
    'bugs',
    'automationRules',
    'securityEvents',
    'employees',
    'projects',
    'approvals',
    'departments',
    'roles',
    'performanceReviews',
    'settings',
  ].some((key) => key in source);
  if (!known) throw new Error('Yedek dosyası geçersiz.');
  const next = normalizeState(source);
  writeState(next);
  return {
    companies: next.companies.length,
    assets: next.assets.length,
    tasks: next.tasks.length,
    notes: next.notes.length,
    finance: next.finance.length,
  };
}

export async function loadPortfolioSeed(): Promise<{ companies: number; assets: number }> {
  const response = await fetch('seed/ezwin-portfolio.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Portföy dosyası yüklenemedi.');
  const seed = normalizeState(await response.json());
  const current = readState();
  if (current.companies.length > 0) {
    throw new Error('Portföy yalnızca boş bir çalışma alanına yüklenebilir.');
  }
  const next: AppData = {
    ...current,
    companies: seed.companies,
    assets: seed.assets,
    statuses: {},
  };
  writeState(next);
  return { companies: seed.companies.length, assets: seed.assets.length };
}

export function setStoredLanguage(language: LanguageCode): void {
  try {
    const state = readState();
    state.settings = { ...state.settings, language: normalizeLanguage(language) };
    writeState(state);
  } catch {
    /* language preference is optional */
  }
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(scopedStorageKey(STORAGE_KEY));
    localStorage.removeItem('ezwin.hub.tray.v1');
    localStorage.removeItem(scopedStorageKey(SAVED_AT_KEY));
  } catch {
    throw new Error('Tarayıcı verisi temizlenemedi.');
  }
  for (const listener of saveListeners) {
    try {
      listener({ at: 0, ok: true });
    } catch {
      /* ignore listener errors */
    }
  }
}

export function storageBytes(): number {
  try {
    const raw = localStorage.getItem(scopedStorageKey(STORAGE_KEY)) ?? '';
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

function readRatesCache(): RatesPayload | null {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesPayload;
    if (
      !parsed ||
      typeof parsed.fetchedAt !== 'number' ||
      typeof parsed.rates?.TRY !== 'number' ||
      typeof parsed.rates?.EUR !== 'number'
    ) {
      return null;
    }
    return { ...parsed, stale: true };
  } catch {
    return null;
  }
}

async function fetchRates(): Promise<RatesPayload> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(RATES_URL, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Kur alınamadı');
    const body = (await response.json()) as {
      date?: string;
      rates?: { TRY?: number; EUR?: number };
    };
    const tryRate = Number(body.rates?.TRY);
    const eurRate = Number(body.rates?.EUR);
    if (!Number.isFinite(tryRate) || !Number.isFinite(eurRate)) {
      throw new Error('Kur alınamadı');
    }
    const payload: RatesPayload = {
      base: 'USD',
      rates: { TRY: tryRate, EUR: eurRate },
      fetchedAt: Date.now(),
      rateDate: typeof body.date === 'string' ? body.date : null,
      source: 'ECB referans kurları',
      stale: false,
      error: null,
    };
    try {
      localStorage.setItem(RATES_KEY, JSON.stringify(payload));
    } catch {
      /* rates still usable without cache */
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function rates(force: boolean): Promise<RatesPayload> {
  const cached = readRatesCache();
  if (!force && cached && Date.now() - cached.fetchedAt < RATES_MAX_AGE) {
    return { ...cached, stale: false };
  }
  try {
    return await fetchRates();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kur alınamadı';
    if (cached) return { ...cached, stale: true, error: message };
    throw new Error('Kur alınamadı');
  }
}

export function installBrowserApi(): void {
  if (window.ezwin) return;

  const api: EzwinApi = {
    getInitial: async () => ({ state: readState(), meta: meta() }),
    company: {
      create: async (input) => {
        const state = readState();
        const name = asString(input.name);
        if (!name) throw new Error('Şirket adı gerekli.');
        const company: Company = {
          id: uid(),
          name,
          color: safeColor(input.color),
          logo: safeImage(input.logo),
          description: asString(input.description),
          status: COMPANY_STATUSES.includes(input.status as CompanyStatus)
            ? (input.status as CompanyStatus)
            : 'active',
          category: COMPANY_CATEGORIES.includes(input.category as CompanyCategory)
            ? (input.category as CompanyCategory)
            : 'other',
          monthlyTarget:
            typeof input.monthlyTarget === 'number' && input.monthlyTarget > 0
              ? input.monthlyTarget
              : null,
          links: asArray(input.links)
            .map(normalizeLink)
            .filter((link): link is LinkItem => Boolean(link)),
          createdAt: Date.now(),
        };
        state.companies.push(company);
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const company = findCompany(state, input.id);
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Şirket adı gerekli.');
          company.name = name;
        }
        if (input.color !== undefined) company.color = safeColor(input.color);
        if (input.logo !== undefined) company.logo = safeImage(input.logo);
        if (input.description !== undefined) company.description = asString(input.description);
        if (input.status !== undefined && COMPANY_STATUSES.includes(input.status)) {
          company.status = input.status;
        }
        if (input.category !== undefined && COMPANY_CATEGORIES.includes(input.category)) {
          company.category = input.category;
        }
        if (input.monthlyTarget !== undefined) {
          company.monthlyTarget =
            typeof input.monthlyTarget === 'number' && input.monthlyTarget > 0
              ? input.monthlyTarget
              : null;
        }
        if (input.links !== undefined) {
          company.links = asArray(input.links)
            .map(normalizeLink)
            .filter((link): link is LinkItem => Boolean(link));
        }
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.companies.some((company) => company.id === id)) {
          throw new Error('Şirket bulunamadı.');
        }
        const assetIds = new Set(
          state.assets.filter((asset) => asset.companyId === id).map((asset) => asset.id),
        );
        state.companies = state.companies.filter((company) => company.id !== id);
        state.assets = state.assets.filter((asset) => asset.companyId !== id);
        state.tasks = state.tasks.filter((task) => task.companyId !== id);
        state.notes = state.notes.filter((note) => note.companyId !== id);
        state.finance = state.finance.filter((entry) => entry.companyId !== id);
        state.salaries = state.salaries.filter((salary) => salary.companyId !== id);
        state.invoices = state.invoices.filter((invoice) => invoice.companyId !== id);
        state.customerPayments = state.customerPayments.filter(
          (payment) => payment.companyId !== id,
        );
        state.subscriptions = state.subscriptions.filter(
          (subscription) => subscription.companyId !== id,
        );
        const threadIds = new Set(
          state.chatThreads.filter((thread) => thread.companyId === id).map((thread) => thread.id),
        );
        state.chatThreads = state.chatThreads.filter((thread) => thread.companyId !== id);
        state.chatMessages = state.chatMessages.filter((message) => !threadIds.has(message.threadId));
        state.announcements = state.announcements.filter(
          (announcement) => announcement.companyId !== id,
        );
        state.meetings = state.meetings.filter((meeting) => meeting.companyId !== id);
        state.clients = state.clients.filter((client) => client.companyId !== id);
        state.contracts = state.contracts.filter((contract) => contract.companyId !== id);
        state.documents = state.documents.filter((document) => document.companyId !== id);
        state.bugs = state.bugs.filter((bug) => bug.companyId !== id);
        state.automationRules = state.automationRules.filter((rule) => rule.companyId !== id);
        state.employees = state.employees.filter((employee) => employee.companyId !== id);
        state.projects = state.projects.filter((project) => project.companyId !== id);
        state.approvals = state.approvals.filter((approval) => approval.companyId !== id);
        state.departments = state.departments.filter((department) => department.companyId !== id);
        state.roles = state.roles.filter((role) => role.companyId !== id);
        state.performanceReviews = state.performanceReviews.filter(
          (review) => review.companyId !== id,
        );
        for (const assetId of assetIds) delete state.statuses[assetId];
        return writeState(state);
      },
    },
    asset: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Servis adı gerekli.');
        if (!ASSET_TYPES.includes(input.type)) throw new Error('Bilinmeyen servis türü');
        const asset: Asset = {
          id: uid(),
          companyId: input.companyId,
          type: input.type,
          name,
          config: {
            ...(safeUrl(input.config?.url) ? { url: safeUrl(input.config?.url) ?? undefined } : {}),
            ...(safeUrl(input.config?.baseUrl)
              ? { baseUrl: safeUrl(input.config?.baseUrl) ?? undefined }
              : {}),
          },
          createdAt: Date.now(),
          hasSecret: false,
          secretHint: null,
        };
        state.assets.push(asset);
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const asset = state.assets.find((item) => item.id === input.id);
        if (!asset) throw new Error('Servis bulunamadı.');
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Servis adı gerekli.');
          asset.name = name;
        }
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          asset.companyId = input.companyId;
        }
        if (input.config !== undefined) {
          asset.config = {
            ...(safeUrl(input.config.url) ? { url: safeUrl(input.config.url) ?? undefined } : {}),
            ...(safeUrl(input.config.baseUrl)
              ? { baseUrl: safeUrl(input.config.baseUrl) ?? undefined }
              : {}),
          };
        }
        asset.hasSecret = false;
        asset.secretHint = null;
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.assets.some((asset) => asset.id === id)) throw new Error('Servis bulunamadı.');
        state.assets = state.assets.filter((asset) => asset.id !== id);
        delete state.statuses[id];
        return writeState(state);
      },
      test: async () => ({
        ok: false,
        state: 'unchecked',
        message: tGlobal('Tarayıcı sürümünde canlı API testi yapılamaz.'),
      }),
    },
    task: {
      create: async (input) => {
        const state = readState();
        const title = asString(input.title);
        if (!title) throw new Error('Görev başlığı gerekli.');
        const companyId = input.companyId && state.companies.some((c) => c.id === input.companyId)
          ? input.companyId
          : null;
        const assigneeId =
          input.assigneeId &&
          state.employees.some(
            (employee) =>
              employee.id === input.assigneeId && (!companyId || employee.companyId === companyId),
          )
            ? input.assigneeId
            : null;
        state.tasks.push({
          id: uid(),
          title,
          companyId,
          priority: input.priority ?? 'med',
          due: asString(input.due) || null,
          done: false,
          assigneeId,
          createdAt: Date.now(),
          completedAt: null,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const task = state.tasks.find((item) => item.id === input.id);
        if (!task) throw new Error('Görev bulunamadı.');
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Görev başlığı gerekli.');
          task.title = title;
        }
        if (input.companyId !== undefined) {
          task.companyId =
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null;
        }
        if (input.priority !== undefined) task.priority = input.priority;
        if (input.due !== undefined) task.due = asString(input.due) || null;
        if (input.assigneeId !== undefined) {
          task.assigneeId =
            input.assigneeId &&
            state.employees.some(
              (employee) =>
                employee.id === input.assigneeId &&
                (!task.companyId || employee.companyId === task.companyId),
            )
              ? input.assigneeId
              : null;
        }
        if (input.done !== undefined) {
          const nextDone = Boolean(input.done);
          if (nextDone && !task.done) task.completedAt = Date.now();
          if (!nextDone) task.completedAt = null;
          task.done = nextDone;
        }
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.tasks.some((task) => task.id === id)) throw new Error('Görev bulunamadı.');
        state.tasks = state.tasks.filter((task) => task.id !== id);
        return writeState(state);
      },
    },
    note: {
      create: async (input) => {
        const state = readState();
        const title = asString(input.title);
        const body = typeof input.body === 'string' ? input.body : '';
        if (!title && !body.trim()) throw new Error('Not başlığı gerekli.');
        const now = Date.now();
        state.notes.push({
          id: uid(),
          title: title || tGlobal('Adsız not'),
          body,
          companyId:
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null,
          pinned: Boolean(input.pinned),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const note = state.notes.find((item) => item.id === input.id);
        if (!note) throw new Error('Not bulunamadı.');
        if (input.title !== undefined) note.title = asString(input.title) || tGlobal('Adsız not');
        if (input.body !== undefined) note.body = typeof input.body === 'string' ? input.body : '';
        if (input.companyId !== undefined) {
          note.companyId =
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null;
        }
        if (input.pinned !== undefined) note.pinned = Boolean(input.pinned);
        note.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.notes.some((note) => note.id === id)) throw new Error('Not bulunamadı.');
        state.notes = state.notes.filter((note) => note.id !== id);
        return writeState(state);
      },
    },
    finance: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Geçerli bir tarih gir.');
        state.finance.push({
          id: uid(),
          companyId: input.companyId,
          kind: input.kind === 'expense' ? 'expense' : 'income',
          amount: input.amount,
          category: asString(input.category),
          note: asString(input.note),
          date: input.date,
          createdAt: Date.now(),
        });
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.finance.some((entry) => entry.id === id)) throw new Error('Kayıt bulunamadı.');
        state.finance = state.finance.filter((entry) => entry.id !== id);
        return writeState(state);
      },
    },
    salary: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const employee = state.employees.find(
          (item) => item.id === input.employeeId && item.companyId === input.companyId,
        );
        if (!employee) throw new Error('Çalışan bulunamadı.');
        if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const period = asString(input.period);
        if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Geçerli bir dönem gir.');
        const status: SalaryStatus = SALARY_STATUSES.includes(input.status as SalaryStatus)
          ? (input.status as SalaryStatus)
          : 'planned';
        const now = Date.now();
        state.salaries.push({
          id: uid(),
          companyId: input.companyId,
          employeeId: employee.id,
          employeeName: employee.name,
          period,
          amount: input.amount,
          status,
          paidAt: status === 'paid' ? now : null,
          note: asString(input.note),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const salary = state.salaries.find((item) => item.id === input.id);
        if (!salary) throw new Error('Maaş kaydı bulunamadı.');
        if (input.employeeId !== undefined) {
          const employee = state.employees.find(
            (item) => item.id === input.employeeId && item.companyId === salary.companyId,
          );
          if (!employee) throw new Error('Çalışan bulunamadı.');
          salary.employeeId = employee.id;
          salary.employeeName = employee.name;
        }
        if (input.period !== undefined) {
          const period = asString(input.period);
          if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Geçerli bir dönem gir.');
          salary.period = period;
        }
        if (input.amount !== undefined) {
          if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          salary.amount = input.amount;
        }
        if (input.status !== undefined && SALARY_STATUSES.includes(input.status)) {
          salary.status = input.status;
          salary.paidAt = input.status === 'paid' ? salary.paidAt ?? Date.now() : null;
        }
        if (input.note !== undefined) salary.note = asString(input.note);
        salary.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.salaries.some((salary) => salary.id === id)) {
          throw new Error('Maaş kaydı bulunamadı.');
        }
        state.salaries = state.salaries.filter((salary) => salary.id !== id);
        return writeState(state);
      },
    },
    invoice: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const customerName = asString(input.customerName);
        if (!customerName) throw new Error('Müşteri adı gerekli.');
        if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const taxRate = asNumber(input.taxRate, 0);
        if (taxRate < 0 || taxRate > 100) {
          throw new Error('Vergi oranı 0 ile 100 arasında olmalı.');
        }
        const issueDate = asString(input.issueDate);
        const dueDate = asString(input.dueDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          throw new Error('Geçerli bir tarih gir.');
        }
        if (dueDate < issueDate) throw new Error('Vade tarihi düzenleme tarihinden önce olamaz.');
        const status: InvoiceStatus = INVOICE_STATUSES.includes(input.status as InvoiceStatus)
          ? (input.status as InvoiceStatus)
          : 'sent';
        const now = Date.now();
        state.invoices.push({
          id: uid(),
          companyId: input.companyId,
          number: nextInvoiceNumber(state, issueDate),
          customerName,
          customerEmail: asString(input.customerEmail),
          amount: input.amount,
          taxRate,
          issueDate,
          dueDate,
          status,
          note: asString(input.note),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const invoice = state.invoices.find((item) => item.id === input.id);
        if (!invoice) throw new Error('Fatura bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== invoice.companyId) {
          findCompany(state, input.companyId);
          invoice.companyId = input.companyId;
          for (const payment of state.customerPayments) {
            if (payment.invoiceId === invoice.id) payment.companyId = input.companyId;
          }
        }
        if (input.customerName !== undefined) {
          const customerName = asString(input.customerName);
          if (!customerName) throw new Error('Müşteri adı gerekli.');
          invoice.customerName = customerName;
        }
        if (input.customerEmail !== undefined) {
          invoice.customerEmail = asString(input.customerEmail);
        }
        if (input.amount !== undefined) {
          if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          invoice.amount = input.amount;
        }
        if (input.taxRate !== undefined) {
          const taxRate = asNumber(input.taxRate, invoice.taxRate);
          if (taxRate < 0 || taxRate > 100) {
            throw new Error('Vergi oranı 0 ile 100 arasında olmalı.');
          }
          invoice.taxRate = taxRate;
        }
        if (input.issueDate !== undefined) {
          const issueDate = asString(input.issueDate);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) throw new Error('Geçerli bir tarih gir.');
          invoice.issueDate = issueDate;
        }
        if (input.dueDate !== undefined) {
          const dueDate = asString(input.dueDate);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Geçerli bir tarih gir.');
          invoice.dueDate = dueDate;
        }
        if (invoice.dueDate < invoice.issueDate) {
          throw new Error('Vade tarihi düzenleme tarihinden önce olamaz.');
        }
        if (input.status !== undefined && INVOICE_STATUSES.includes(input.status)) {
          invoice.status = input.status;
        }
        if (input.note !== undefined) invoice.note = asString(input.note);
        invoice.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.invoices.some((invoice) => invoice.id === id)) {
          throw new Error('Fatura bulunamadı.');
        }
        state.invoices = state.invoices.filter((invoice) => invoice.id !== id);
        state.customerPayments = state.customerPayments.map((payment) =>
          payment.invoiceId === id ? { ...payment, invoiceId: null, updatedAt: Date.now() } : payment,
        );
        return writeState(state);
      },
    },
    customerPayment: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const date = asString(input.date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçerli bir tarih gir.');
        const invoiceIdRaw = asString(input.invoiceId);
        const invoice = invoiceIdRaw
          ? state.invoices.find(
              (item) => item.id === invoiceIdRaw && item.companyId === input.companyId,
            )
          : undefined;
        if (invoiceIdRaw && !invoice) throw new Error('Fatura bulunamadı.');
        const customerName = asString(input.customerName) || invoice?.customerName || '';
        if (!customerName) throw new Error('Müşteri adı gerekli.');
        const method: PaymentMethod = PAYMENT_METHODS.includes(input.method as PaymentMethod)
          ? (input.method as PaymentMethod)
          : 'transfer';
        const status: CustomerPaymentStatus = PAYMENT_STATUSES.includes(
          input.status as CustomerPaymentStatus,
        )
          ? (input.status as CustomerPaymentStatus)
          : 'received';
        const now = Date.now();
        state.customerPayments.push({
          id: uid(),
          companyId: input.companyId,
          customerName,
          invoiceId: invoice?.id ?? null,
          amount: input.amount,
          method,
          status,
          date,
          note: asString(input.note),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const payment = state.customerPayments.find((item) => item.id === input.id);
        if (!payment) throw new Error('Ödeme kaydı bulunamadı.');
        if (input.invoiceId !== undefined) {
          const invoiceIdRaw = asString(input.invoiceId);
          const invoice = invoiceIdRaw
            ? state.invoices.find(
                (item) => item.id === invoiceIdRaw && item.companyId === payment.companyId,
              )
            : undefined;
          if (invoiceIdRaw && !invoice) throw new Error('Fatura bulunamadı.');
          payment.invoiceId = invoice?.id ?? null;
          if (!payment.customerName && invoice) payment.customerName = invoice.customerName;
        }
        if (input.customerName !== undefined) {
          const customerName = asString(input.customerName);
          if (!customerName) throw new Error('Müşteri adı gerekli.');
          payment.customerName = customerName;
        }
        if (input.amount !== undefined) {
          if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          payment.amount = input.amount;
        }
        if (input.method !== undefined && PAYMENT_METHODS.includes(input.method)) {
          payment.method = input.method;
        }
        if (input.status !== undefined && PAYMENT_STATUSES.includes(input.status)) {
          payment.status = input.status;
        }
        if (input.date !== undefined) {
          const date = asString(input.date);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçerli bir tarih gir.');
          payment.date = date;
        }
        if (input.note !== undefined) payment.note = asString(input.note);
        payment.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.customerPayments.some((payment) => payment.id === id)) {
          throw new Error('Ödeme kaydı bulunamadı.');
        }
        state.customerPayments = state.customerPayments.filter((payment) => payment.id !== id);
        return writeState(state);
      },
    },
    subscription: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Abonelik adı gerekli.');
        if (!(asNumber(input.amount, 0) >= 0)) {
          throw new Error('Geçerli bir tutar gir.');
        }
        const nextRenewal = asString(input.nextRenewal);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRenewal)) {
          throw new Error('Geçerli bir yenileme tarihi gir.');
        }
        const kind: SubscriptionKind = SUBSCRIPTION_KINDS.includes(input.kind as SubscriptionKind)
          ? (input.kind as SubscriptionKind)
          : 'subscription';
        const cycle: BillingCycle = BILLING_CYCLES.includes(input.cycle as BillingCycle)
          ? (input.cycle as BillingCycle)
          : 'monthly';
        const status: SubscriptionStatus = SUBSCRIPTION_STATUSES.includes(
          input.status as SubscriptionStatus,
        )
          ? (input.status as SubscriptionStatus)
          : 'active';
        const now = Date.now();
        state.subscriptions.push({
          id: uid(),
          companyId: input.companyId,
          name,
          vendor: asString(input.vendor),
          kind,
          amount: asNumber(input.amount, 0),
          cycle,
          nextRenewal,
          status,
          note: asString(input.note),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const subscription = state.subscriptions.find((item) => item.id === input.id);
        if (!subscription) throw new Error('Abonelik bulunamadı.');
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          subscription.companyId = input.companyId;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Abonelik adı gerekli.');
          subscription.name = name;
        }
        if (input.vendor !== undefined) subscription.vendor = asString(input.vendor);
        if (input.kind !== undefined && SUBSCRIPTION_KINDS.includes(input.kind)) {
          subscription.kind = input.kind;
        }
        if (input.amount !== undefined) {
          if (!(input.amount >= 0)) throw new Error('Geçerli bir tutar gir.');
          subscription.amount = input.amount;
        }
        if (input.cycle !== undefined && BILLING_CYCLES.includes(input.cycle)) {
          subscription.cycle = input.cycle;
        }
        if (input.nextRenewal !== undefined) {
          const nextRenewal = asString(input.nextRenewal);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRenewal)) {
            throw new Error('Geçerli bir yenileme tarihi gir.');
          }
          subscription.nextRenewal = nextRenewal;
        }
        if (input.status !== undefined && SUBSCRIPTION_STATUSES.includes(input.status)) {
          subscription.status = input.status;
        }
        if (input.note !== undefined) subscription.note = asString(input.note);
        subscription.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.subscriptions.some((subscription) => subscription.id === id)) {
          throw new Error('Abonelik bulunamadı.');
        }
        state.subscriptions = state.subscriptions.filter(
          (subscription) => subscription.id !== id,
        );
        return writeState(state);
      },
    },
    chat: {
      createThread: async (input) => {
        const state = readState();
        const company = findCompany(state, input.companyId);
        if (!CHAT_SCOPES.includes(input.scope)) throw new Error('Bilinmeyen sohbet türü.');
        const departmentId =
          input.scope === 'department' ? asString(input.departmentId) : '';
        const employeeId = input.scope === 'direct' ? asString(input.employeeId) : '';
        if (input.scope === 'department') {
          const department = state.departments.find((item) => item.id === departmentId);
          if (!department || department.companyId !== company.id) {
            throw new Error('Departman bulunamadı.');
          }
        }
        if (input.scope === 'direct') {
          const employee = state.employees.find((item) => item.id === employeeId);
          if (!employee || employee.companyId !== company.id) {
            throw new Error('Çalışan bulunamadı.');
          }
        }
        const duplicate = state.chatThreads.some(
          (thread) =>
            thread.companyId === company.id &&
            thread.scope === input.scope &&
            (input.scope !== 'department' || thread.departmentId === departmentId) &&
            (input.scope !== 'direct' || thread.employeeId === employeeId),
        );
        if (duplicate) throw new Error('Bu sohbet zaten açık.');
        const now = Date.now();
        state.chatThreads.push({
          id: uid(),
          companyId: company.id,
          scope: input.scope,
          departmentId: input.scope === 'department' ? departmentId : null,
          employeeId: input.scope === 'direct' ? employeeId : null,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      removeThread: async (id) => {
        const state = readState();
        if (!state.chatThreads.some((thread) => thread.id === id)) {
          throw new Error('Sohbet bulunamadı.');
        }
        state.chatThreads = state.chatThreads.filter((thread) => thread.id !== id);
        state.chatMessages = state.chatMessages.filter((message) => message.threadId !== id);
        return writeState(state);
      },
      sendMessage: async (input) => {
        const state = readState();
        const thread = state.chatThreads.find((item) => item.id === input.threadId);
        if (!thread) throw new Error('Sohbet bulunamadı.');
        const body = asString(input.body).slice(0, 4000);
        if (!body) throw new Error('Mesaj boş olamaz.');
        const now = Date.now();
        state.chatMessages.push({
          id: uid(),
          threadId: thread.id,
          author: asString(input.author).slice(0, 80),
          body,
          createdAt: now,
        });
        thread.updatedAt = now;
        return writeState(state);
      },
      removeMessage: async (id) => {
        const state = readState();
        if (!state.chatMessages.some((message) => message.id === id)) {
          throw new Error('Mesaj bulunamadı.');
        }
        state.chatMessages = state.chatMessages.filter((message) => message.id !== id);
        return writeState(state);
      },
    },
    announcement: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title).slice(0, 160);
        const body = asString(input.body).slice(0, 8000);
        if (!title) throw new Error('Duyuru başlığı gerekli.');
        if (!body) throw new Error('Duyuru metni gerekli.');
        const audience: AnnouncementAudience = ANNOUNCEMENT_AUDIENCES.includes(
          input.audience as AnnouncementAudience,
        )
          ? (input.audience as AnnouncementAudience)
          : 'company';
        const departmentId = asString(input.departmentId);
        if (audience === 'department') {
          const department = state.departments.find((item) => item.id === departmentId);
          if (!department || department.companyId !== input.companyId) {
            throw new Error('Departman bulunamadı.');
          }
        }
        const visibility: AnnouncementVisibility = ANNOUNCEMENT_VISIBILITIES.includes(
          input.visibility as AnnouncementVisibility,
        )
          ? (input.visibility as AnnouncementVisibility)
          : 'team';
        const priority: AnnouncementPriority = ANNOUNCEMENT_PRIORITIES.includes(
          input.priority as AnnouncementPriority,
        )
          ? (input.priority as AnnouncementPriority)
          : 'normal';
        const status: AnnouncementStatus = ANNOUNCEMENT_STATUSES.includes(
          input.status as AnnouncementStatus,
        )
          ? (input.status as AnnouncementStatus)
          : 'draft';
        const now = Date.now();
        state.announcements.push({
          id: uid(),
          companyId: input.companyId,
          departmentId: audience === 'department' ? departmentId : null,
          title,
          body,
          audience,
          visibility,
          priority,
          pinned: input.pinned === true,
          status,
          author: asString(input.author).slice(0, 80),
          publishedAt: status === 'published' ? now : null,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const announcement = state.announcements.find((item) => item.id === input.id);
        if (!announcement) throw new Error('Duyuru bulunamadı.');
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          announcement.companyId = input.companyId;
        }
        if (input.title !== undefined) {
          const title = asString(input.title).slice(0, 160);
          if (!title) throw new Error('Duyuru başlığı gerekli.');
          announcement.title = title;
        }
        if (input.body !== undefined) {
          const body = asString(input.body).slice(0, 8000);
          if (!body) throw new Error('Duyuru metni gerekli.');
          announcement.body = body;
        }
        if (input.audience !== undefined && ANNOUNCEMENT_AUDIENCES.includes(input.audience)) {
          announcement.audience = input.audience;
        }
        if (input.departmentId !== undefined) {
          const departmentId = asString(input.departmentId);
          if (departmentId) {
            const department = state.departments.find((item) => item.id === departmentId);
            if (!department || department.companyId !== announcement.companyId) {
              throw new Error('Departman bulunamadı.');
            }
            announcement.departmentId = departmentId;
          } else {
            announcement.departmentId = null;
          }
        }
        if (
          announcement.audience === 'department' &&
          !state.departments.some(
            (item) =>
              item.id === announcement.departmentId &&
              item.companyId === announcement.companyId,
          )
        ) {
          throw new Error('Departman bulunamadı.');
        }
        if (
          input.visibility !== undefined &&
          ANNOUNCEMENT_VISIBILITIES.includes(input.visibility)
        ) {
          announcement.visibility = input.visibility;
        }
        if (input.priority !== undefined && ANNOUNCEMENT_PRIORITIES.includes(input.priority)) {
          announcement.priority = input.priority;
        }
        if (input.pinned !== undefined) announcement.pinned = input.pinned === true;
        if (input.status !== undefined && ANNOUNCEMENT_STATUSES.includes(input.status)) {
          if (input.status === 'published' && announcement.status !== 'published') {
            announcement.publishedAt = Date.now();
          }
          if (input.status !== 'published') announcement.publishedAt = null;
          announcement.status = input.status;
        }
        if (input.author !== undefined) announcement.author = asString(input.author).slice(0, 80);
        announcement.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.announcements.some((announcement) => announcement.id === id)) {
          throw new Error('Duyuru bulunamadı.');
        }
        state.announcements = state.announcements.filter(
          (announcement) => announcement.id !== id,
        );
        return writeState(state);
      },
    },
    meeting: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title).slice(0, 160);
        if (!title) throw new Error('Toplantı başlığı gerekli.');
        const date = asString(input.date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçerli bir tarih gir.');
        const time = asString(input.time);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new Error('Geçerli bir saat gir.');
        }
        const departmentId = asString(input.departmentId);
        if (departmentId) {
          const department = state.departments.find((item) => item.id === departmentId);
          if (!department || department.companyId !== input.companyId) {
            throw new Error('Departman bulunamadı.');
          }
        }
        const attendeeIds = Array.from(
          new Set(
            (input.attendeeIds ?? []).filter((employeeId) =>
              state.employees.some(
                (employee) =>
                  employee.id === employeeId && employee.companyId === input.companyId,
              ),
            ),
          ),
        );
        const status: MeetingStatus = MEETING_STATUSES.includes(input.status as MeetingStatus)
          ? (input.status as MeetingStatus)
          : 'planned';
        const now = Date.now();
        state.meetings.push({
          id: uid(),
          companyId: input.companyId,
          departmentId: departmentId || null,
          title,
          agenda: asString(input.agenda).slice(0, 4000),
          date,
          time,
          durationMin: Math.min(480, Math.max(5, asNumber(input.durationMin, 30))),
          location: asString(input.location).slice(0, 200),
          attendeeIds,
          status,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const meeting = state.meetings.find((item) => item.id === input.id);
        if (!meeting) throw new Error('Toplantı bulunamadı.');
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          meeting.companyId = input.companyId;
          meeting.attendeeIds = meeting.attendeeIds.filter((employeeId) =>
            state.employees.some(
              (employee) => employee.id === employeeId && employee.companyId === meeting.companyId,
            ),
          );
        }
        if (input.title !== undefined) {
          const title = asString(input.title).slice(0, 160);
          if (!title) throw new Error('Toplantı başlığı gerekli.');
          meeting.title = title;
        }
        if (input.agenda !== undefined) meeting.agenda = asString(input.agenda).slice(0, 4000);
        if (input.date !== undefined) {
          const date = asString(input.date);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçerli bir tarih gir.');
          meeting.date = date;
        }
        if (input.time !== undefined) {
          const time = asString(input.time);
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
            throw new Error('Geçerli bir saat gir.');
          }
          meeting.time = time;
        }
        if (input.durationMin !== undefined) {
          meeting.durationMin = Math.min(480, Math.max(5, asNumber(input.durationMin, 30)));
        }
        if (input.location !== undefined) meeting.location = asString(input.location).slice(0, 200);
        if (input.departmentId !== undefined) {
          const departmentId = asString(input.departmentId);
          if (departmentId) {
            const department = state.departments.find((item) => item.id === departmentId);
            if (!department || department.companyId !== meeting.companyId) {
              throw new Error('Departman bulunamadı.');
            }
            meeting.departmentId = departmentId;
          } else {
            meeting.departmentId = null;
          }
        }
        if (input.attendeeIds !== undefined) {
          const ids = new Set(input.attendeeIds);
          meeting.attendeeIds = Array.from(
            new Set(
              state.employees
                .filter((employee) => employee.companyId === meeting.companyId && ids.has(employee.id))
                .map((employee) => employee.id),
            ),
          );
        }
        if (input.status !== undefined && MEETING_STATUSES.includes(input.status)) {
          meeting.status = input.status;
        }
        meeting.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.meetings.some((meeting) => meeting.id === id)) {
          throw new Error('Toplantı bulunamadı.');
        }
        state.meetings = state.meetings.filter((meeting) => meeting.id !== id);
        return writeState(state);
      },
    },
    notification: {
      markRead: async (ids) => {
        const state = readState();
        const targets = new Set(asArray(ids).map(asString).filter(Boolean));
        if (!targets.size) return state;
        const read = new Map(state.notificationReads.map((item) => [item.id, item.readAt]));
        const now = Date.now();
        for (const id of targets) read.set(id, now);
        state.notificationReads = Array.from(read, ([id, readAt]) => ({ id, readAt }))
          .sort((a, b) => b.readAt - a.readAt)
          .slice(0, 500);
        return writeState(state);
      },
    },
    client: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Müşteri adı gerekli.');
        const now = Date.now();
        const nextFollowUp = asString(input.nextFollowUp);
        state.clients.push({
          id: uid(),
          companyId: input.companyId,
          name: name.slice(0, 160),
          contactName: asString(input.contactName).slice(0, 120),
          email: asString(input.email).slice(0, 160),
          phone: asString(input.phone).slice(0, 60),
          status: CLIENT_STATUSES.includes(input.status as ClientStatus)
            ? (input.status as ClientStatus)
            : 'lead',
          value: Math.max(0, asNumber(input.value, 0)),
          nextFollowUp: /^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp) ? nextFollowUp : null,
          note: asString(input.note).slice(0, 1000),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const client = state.clients.find((item) => item.id === input.id);
        if (!client) throw new Error('Müşteri bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== client.companyId) {
          findCompany(state, input.companyId);
          client.companyId = input.companyId;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Müşteri adı gerekli.');
          client.name = name.slice(0, 160);
        }
        if (input.contactName !== undefined) client.contactName = asString(input.contactName).slice(0, 120);
        if (input.email !== undefined) client.email = asString(input.email).slice(0, 160);
        if (input.phone !== undefined) client.phone = asString(input.phone).slice(0, 60);
        if (input.status !== undefined && CLIENT_STATUSES.includes(input.status)) {
          client.status = input.status;
        }
        if (input.value !== undefined) client.value = Math.max(0, asNumber(input.value, 0));
        if (input.nextFollowUp !== undefined) {
          const nextFollowUp = asString(input.nextFollowUp);
          client.nextFollowUp = /^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp) ? nextFollowUp : null;
        }
        if (input.note !== undefined) client.note = asString(input.note).slice(0, 1000);
        client.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.clients.some((client) => client.id === id)) {
          throw new Error('Müşteri bulunamadı.');
        }
        state.clients = state.clients.filter((client) => client.id !== id);
        return writeState(state);
      },
    },
    contract: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title);
        if (!title) throw new Error('Sözleşme başlığı gerekli.');
        const now = Date.now();
        const startDate = asString(input.startDate);
        const endDate = asString(input.endDate);
        state.contracts.push({
          id: uid(),
          companyId: input.companyId,
          title: title.slice(0, 200),
          counterparty: asString(input.counterparty).slice(0, 160),
          kind: CONTRACT_KINDS.includes(input.kind as ContractKind)
            ? (input.kind as ContractKind)
            : 'service',
          startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
          endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null,
          value: Math.max(0, asNumber(input.value, 0)),
          status: CONTRACT_STATUSES.includes(input.status as ContractStatus)
            ? (input.status as ContractStatus)
            : 'active',
          note: asString(input.note).slice(0, 2000),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const contract = state.contracts.find((item) => item.id === input.id);
        if (!contract) throw new Error('Sözleşme bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== contract.companyId) {
          findCompany(state, input.companyId);
          contract.companyId = input.companyId;
        }
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Sözleşme başlığı gerekli.');
          contract.title = title.slice(0, 200);
        }
        if (input.counterparty !== undefined) {
          contract.counterparty = asString(input.counterparty).slice(0, 160);
        }
        if (input.kind !== undefined && CONTRACT_KINDS.includes(input.kind)) {
          contract.kind = input.kind;
        }
        if (input.startDate !== undefined) {
          const date = asString(input.startDate);
          contract.startDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
        }
        if (input.endDate !== undefined) {
          const date = asString(input.endDate);
          contract.endDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
        }
        if (input.value !== undefined) contract.value = Math.max(0, asNumber(input.value, 0));
        if (input.status !== undefined && CONTRACT_STATUSES.includes(input.status)) {
          contract.status = input.status;
        }
        if (input.note !== undefined) contract.note = asString(input.note).slice(0, 2000);
        contract.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.contracts.some((contract) => contract.id === id)) {
          throw new Error('Sözleşme bulunamadı.');
        }
        state.contracts = state.contracts.filter((contract) => contract.id !== id);
        return writeState(state);
      },
    },
    document: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title);
        if (!title) throw new Error('Belge başlığı gerekli.');
        const now = Date.now();
        state.documents.push({
          id: asString(input.id) || uid(),
          companyId: input.companyId,
          title: title.slice(0, 200),
          category: DOCUMENT_CATEGORIES.includes(input.category as DocumentCategory)
            ? (input.category as DocumentCategory)
            : 'other',
          fileName: asString(input.fileName).slice(0, 240),
          mimeType: asString(input.mimeType).slice(0, 120),
          size: Math.max(0, asNumber(input.size, 0)),
          hasFile: Boolean(input.hasFile),
          note: asString(input.note).slice(0, 2000),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const document = state.documents.find((item) => item.id === input.id);
        if (!document) throw new Error('Belge bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== document.companyId) {
          findCompany(state, input.companyId);
          document.companyId = input.companyId;
        }
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Belge başlığı gerekli.');
          document.title = title.slice(0, 200);
        }
        if (input.category !== undefined && DOCUMENT_CATEGORIES.includes(input.category)) {
          document.category = input.category;
        }
        if (input.fileName !== undefined) document.fileName = asString(input.fileName).slice(0, 240);
        if (input.mimeType !== undefined) document.mimeType = asString(input.mimeType).slice(0, 120);
        if (input.size !== undefined) document.size = Math.max(0, asNumber(input.size, 0));
        if (input.hasFile !== undefined) document.hasFile = Boolean(input.hasFile);
        if (input.note !== undefined) document.note = asString(input.note).slice(0, 2000);
        document.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.documents.some((document) => document.id === id)) {
          throw new Error('Belge bulunamadı.');
        }
        state.documents = state.documents.filter((document) => document.id !== id);
        return writeState(state);
      },
    },
    bug: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title);
        if (!title) throw new Error('Hata başlığı gerekli.');
        const now = Date.now();
        const status: BugStatus = BUG_STATUSES.includes(input.status as BugStatus)
          ? (input.status as BugStatus)
          : 'open';
        state.bugs.push({
          id: uid(),
          companyId: input.companyId,
          projectId: asString(input.projectId) || null,
          title: title.slice(0, 200),
          description: asString(input.description).slice(0, 4000),
          severity: BUG_SEVERITIES.includes(input.severity as BugSeverity)
            ? (input.severity as BugSeverity)
            : 'medium',
          status,
          reportedBy: asString(input.reportedBy).slice(0, 120),
          assigneeId: asString(input.assigneeId) || null,
          createdAt: now,
          updatedAt: now,
          resolvedAt: status === 'resolved' || status === 'closed' ? now : null,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const bug = state.bugs.find((item) => item.id === input.id);
        if (!bug) throw new Error('Hata kaydı bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== bug.companyId) {
          findCompany(state, input.companyId);
          bug.companyId = input.companyId;
        }
        if (input.projectId !== undefined) bug.projectId = asString(input.projectId) || null;
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Hata başlığı gerekli.');
          bug.title = title.slice(0, 200);
        }
        if (input.description !== undefined) {
          bug.description = asString(input.description).slice(0, 4000);
        }
        if (input.severity !== undefined && BUG_SEVERITIES.includes(input.severity)) {
          bug.severity = input.severity;
        }
        if (input.status !== undefined && BUG_STATUSES.includes(input.status)) {
          bug.status = input.status;
          bug.resolvedAt =
            input.status === 'resolved' || input.status === 'closed'
              ? bug.resolvedAt ?? Date.now()
              : null;
        }
        if (input.reportedBy !== undefined) bug.reportedBy = asString(input.reportedBy).slice(0, 120);
        if (input.assigneeId !== undefined) bug.assigneeId = asString(input.assigneeId) || null;
        bug.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.bugs.some((bug) => bug.id === id)) throw new Error('Hata kaydı bulunamadı.');
        state.bugs = state.bugs.filter((bug) => bug.id !== id);
        return writeState(state);
      },
    },
    automation: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title);
        if (!title) throw new Error('Kural başlığı gerekli.');
        const now = Date.now();
        const nextRun = asString(input.nextRun);
        state.automationRules.push({
          id: uid(),
          companyId: input.companyId,
          title: title.slice(0, 200),
          priority: TASK_PRIORITIES.includes(input.priority as TaskPriority)
            ? (input.priority as TaskPriority)
            : 'med',
          assigneeId: asString(input.assigneeId) || null,
          cadence: AUTOMATION_CADENCES.includes(input.cadence as AutomationCadence)
            ? (input.cadence as AutomationCadence)
            : 'weekly',
          nextRun: /^\d{4}-\d{2}-\d{2}$/.test(nextRun)
            ? nextRun
            : new Date().toISOString().slice(0, 10),
          enabled: input.enabled !== false,
          lastRun: null,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const rule = state.automationRules.find((item) => item.id === input.id);
        if (!rule) throw new Error('Kural bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== rule.companyId) {
          findCompany(state, input.companyId);
          rule.companyId = input.companyId;
        }
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Kural başlığı gerekli.');
          rule.title = title.slice(0, 200);
        }
        if (input.priority !== undefined && TASK_PRIORITIES.includes(input.priority)) {
          rule.priority = input.priority;
        }
        if (input.assigneeId !== undefined) rule.assigneeId = asString(input.assigneeId) || null;
        if (input.cadence !== undefined && AUTOMATION_CADENCES.includes(input.cadence)) {
          rule.cadence = input.cadence;
        }
        if (input.nextRun !== undefined) {
          const nextRun = asString(input.nextRun);
          if (/^\d{4}-\d{2}-\d{2}$/.test(nextRun)) rule.nextRun = nextRun;
        }
        if (input.enabled !== undefined) rule.enabled = Boolean(input.enabled);
        rule.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.automationRules.some((rule) => rule.id === id)) {
          throw new Error('Kural bulunamadı.');
        }
        state.automationRules = state.automationRules.filter((rule) => rule.id !== id);
        return writeState(state);
      },
      run: async (id) => {
        const state = readState();
        const rule = state.automationRules.find((item) => item.id === id);
        if (!rule) throw new Error('Kural bulunamadı.');
        if (!rule.enabled) throw new Error('Kural pasif durumda.');
        const now = Date.now();
        const assignee = rule.assigneeId
          ? state.employees.find(
              (employee) =>
                employee.id === rule.assigneeId && employee.companyId === rule.companyId,
            )
          : null;
        state.tasks.push({
          id: uid(),
          title: rule.title,
          companyId: rule.companyId,
          priority: rule.priority,
          due: rule.nextRun,
          done: false,
          assigneeId: assignee ? assignee.id : null,
          createdAt: now,
          completedAt: null,
        });
        rule.lastRun = now;
        const next = new Date(`${rule.nextRun}T12:00:00`);
        if (rule.cadence === 'daily') next.setDate(next.getDate() + 1);
        else if (rule.cadence === 'monthly') next.setMonth(next.getMonth() + 1);
        else next.setDate(next.getDate() + 7);
        rule.nextRun = next.toISOString().slice(0, 10);
        rule.updatedAt = now;
        return writeState(state);
      },
    },
    security: {
      log: async (input) => {
        const state = readState();
        const detail = asString(input.detail).trim();
        if (!detail) throw new Error('Kayıt ayrıntısı gerekli.');
        state.securityEvents.unshift({
          id: uid(),
          at: Date.now(),
          kind: SECURITY_EVENT_KINDS.includes(input.kind) ? input.kind : 'account',
          actor: asString(input.actor).slice(0, 120) || tGlobal('Yerel yönetici'),
          detail: detail.slice(0, 600),
          companyId: asString(input.companyId) || null,
        });
        state.securityEvents = state.securityEvents.slice(0, 500);
        return writeState(state);
      },
      clear: async () => {
        const state = readState();
        state.securityEvents = [];
        return writeState(state);
      },
    },
    employee: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Çalışan adı gerekli.');
        const departmentId = asString(input.departmentId);
        if (
          departmentId &&
          !state.departments.some(
            (department) => department.id === departmentId && department.companyId === input.companyId,
          )
        ) {
          throw new Error('Departman bulunamadı.');
        }
        const roleId = asString(input.roleId);
        if (
          roleId &&
          !state.roles.some((role) => role.id === roleId && role.companyId === input.companyId)
        ) {
          throw new Error('Yetki rolü bulunamadı.');
        }
        const now = Date.now();
        const startDate = asString(input.startDate);
        state.employees.push({
          id: uid(),
          companyId: input.companyId,
          name,
          role: asString(input.role),
          email: asString(input.email),
          status: EMPLOYEE_STATUSES.includes(input.status as EmployeeStatus)
            ? (input.status as EmployeeStatus)
            : 'active',
          startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
          departmentId: departmentId || null,
          roleId: roleId || null,
          notes: asString(input.notes),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const employee = state.employees.find((item) => item.id === input.id);
        if (!employee) throw new Error('Çalışan bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== employee.companyId) {
          findCompany(state, input.companyId);
          employee.companyId = input.companyId;
          if (input.departmentId === undefined) employee.departmentId = null;
          if (input.roleId === undefined) employee.roleId = null;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Çalışan adı gerekli.');
          employee.name = name;
        }
        if (input.role !== undefined) employee.role = asString(input.role);
        if (input.email !== undefined) employee.email = asString(input.email);
        if (input.status !== undefined && EMPLOYEE_STATUSES.includes(input.status)) {
          employee.status = input.status;
        }
        if (input.startDate !== undefined) {
          const startDate = asString(input.startDate);
          employee.startDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
        }
        if (input.departmentId !== undefined) {
          const departmentId = asString(input.departmentId);
          if (
            departmentId &&
            !state.departments.some(
              (department) =>
                department.id === departmentId && department.companyId === employee.companyId,
            )
          ) {
            throw new Error('Departman bulunamadı.');
          }
          employee.departmentId = departmentId || null;
        }
        if (input.roleId !== undefined) {
          const roleId = asString(input.roleId);
          if (
            roleId &&
            !state.roles.some(
              (role) => role.id === roleId && role.companyId === employee.companyId,
            )
          ) {
            throw new Error('Yetki rolü bulunamadı.');
          }
          employee.roleId = roleId || null;
        }
        if (input.notes !== undefined) employee.notes = asString(input.notes);
        employee.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        const employee = state.employees.find((item) => item.id === id);
        if (!employee) throw new Error('Çalışan bulunamadı.');
        state.employees = state.employees.filter((item) => item.id !== id);
        state.performanceReviews = state.performanceReviews.filter(
          (review) => review.employeeId !== id,
        );
        const directThreadIds = new Set(
          state.chatThreads
            .filter((thread) => thread.employeeId === id)
            .map((thread) => thread.id),
        );
        if (directThreadIds.size) {
          state.chatThreads = state.chatThreads.filter((thread) => !directThreadIds.has(thread.id));
          state.chatMessages = state.chatMessages.filter(
            (message) => !directThreadIds.has(message.threadId),
          );
        }
        state.meetings = state.meetings.map((meeting) =>
          meeting.attendeeIds.includes(id)
            ? {
                ...meeting,
                attendeeIds: meeting.attendeeIds.filter((attendeeId) => attendeeId !== id),
                updatedAt: Date.now(),
              }
            : meeting,
        );
        state.salaries = state.salaries.map((salary) =>
          salary.employeeId === id
            ? {
                ...salary,
                employeeId: null,
                employeeName: salary.employeeName || employee.name,
                updatedAt: Date.now(),
              }
            : salary,
        );
        state.tasks = state.tasks.map((task) =>
          task.assigneeId === id ? { ...task, assigneeId: null } : task,
        );
        state.bugs = state.bugs.map((bug) =>
          bug.assigneeId === id ? { ...bug, assigneeId: null, updatedAt: Date.now() } : bug,
        );
        state.automationRules = state.automationRules.map((rule) =>
          rule.assigneeId === id ? { ...rule, assigneeId: null, updatedAt: Date.now() } : rule,
        );
        return writeState(state);
      },
    },
    department: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Departman adı gerekli.');
        const now = Date.now();
        const color = asString(input.color);
        state.departments.push({
          id: uid(),
          companyId: input.companyId,
          name,
          description: asString(input.description),
          color: /^#[0-9a-f]{6}$/i.test(color)
            ? color
            : DEPARTMENT_COLORS[state.departments.length % DEPARTMENT_COLORS.length],
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const department = state.departments.find((item) => item.id === input.id);
        if (!department) throw new Error('Departman bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== department.companyId) {
          findCompany(state, input.companyId);
          for (const employee of state.employees) {
            if (employee.departmentId === department.id) employee.departmentId = null;
          }
          department.companyId = input.companyId;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Departman adı gerekli.');
          department.name = name;
        }
        if (input.description !== undefined) department.description = asString(input.description);
        if (input.color !== undefined) {
          const color = asString(input.color);
          if (/^#[0-9a-f]{6}$/i.test(color)) department.color = color;
        }
        department.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.departments.some((department) => department.id === id)) {
          throw new Error('Departman bulunamadı.');
        }
        state.departments = state.departments.filter((department) => department.id !== id);
        for (const employee of state.employees) {
          if (employee.departmentId === id) employee.departmentId = null;
        }
        const departmentThreadIds = new Set(
          state.chatThreads
            .filter((thread) => thread.departmentId === id)
            .map((thread) => thread.id),
        );
        if (departmentThreadIds.size) {
          state.chatThreads = state.chatThreads.filter(
            (thread) => !departmentThreadIds.has(thread.id),
          );
          state.chatMessages = state.chatMessages.filter(
            (message) => !departmentThreadIds.has(message.threadId),
          );
        }
        state.announcements = state.announcements.map((announcement) =>
          announcement.departmentId === id
            ? { ...announcement, departmentId: null, updatedAt: Date.now() }
            : announcement,
        );
        state.meetings = state.meetings.map((meeting) =>
          meeting.departmentId === id
            ? { ...meeting, departmentId: null, updatedAt: Date.now() }
            : meeting,
        );
        return writeState(state);
      },
    },
    role: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Rol adı gerekli.');
        const now = Date.now();
        const permissions = Array.from(
          new Set(
            asArray(input.permissions).filter((permission): permission is PermissionKey =>
              PERMISSION_KEYS.includes(permission as PermissionKey),
            ),
          ),
        );
        state.roles.push({
          id: uid(),
          companyId: input.companyId,
          name,
          description: asString(input.description),
          permissions,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const role = state.roles.find((item) => item.id === input.id);
        if (!role) throw new Error('Rol bulunamadı.');
        if (input.companyId !== undefined && input.companyId !== role.companyId) {
          findCompany(state, input.companyId);
          for (const employee of state.employees) {
            if (employee.roleId === role.id) employee.roleId = null;
          }
          role.companyId = input.companyId;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Rol adı gerekli.');
          role.name = name;
        }
        if (input.description !== undefined) role.description = asString(input.description);
        if (input.permissions !== undefined) {
          role.permissions = Array.from(
            new Set(
              asArray(input.permissions).filter((permission): permission is PermissionKey =>
                PERMISSION_KEYS.includes(permission as PermissionKey),
              ),
            ),
          );
        }
        role.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.roles.some((role) => role.id === id)) {
          throw new Error('Rol bulunamadı.');
        }
        state.roles = state.roles.filter((role) => role.id !== id);
        for (const employee of state.employees) {
          if (employee.roleId === id) employee.roleId = null;
        }
        return writeState(state);
      },
    },
    performanceReview: {
      create: async (input) => {
        const state = readState();
        const employee = state.employees.find((item) => item.id === input.employeeId);
        if (!employee) throw new Error('Çalışan bulunamadı.');
        const period = asString(input.period);
        if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Dönem gerekli.');
        const score = Math.round(asNumber(input.score, -1));
        if (score < 0 || score > 100) throw new Error('Puan 0 ile 100 arasında olmalı.');
        const now = Date.now();
        state.performanceReviews.push({
          id: uid(),
          employeeId: employee.id,
          companyId: employee.companyId,
          period,
          score,
          reviewer: asString(input.reviewer),
          strengths: asString(input.strengths),
          improvements: asString(input.improvements),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const review = state.performanceReviews.find((item) => item.id === input.id);
        if (!review) throw new Error('Değerlendirme bulunamadı.');
        if (input.period !== undefined) {
          const period = asString(input.period);
          if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Dönem gerekli.');
          review.period = period;
        }
        if (input.score !== undefined) {
          const score = Math.round(asNumber(input.score, -1));
          if (score < 0 || score > 100) throw new Error('Puan 0 ile 100 arasında olmalı.');
          review.score = score;
        }
        if (input.reviewer !== undefined) review.reviewer = asString(input.reviewer);
        if (input.strengths !== undefined) review.strengths = asString(input.strengths);
        if (input.improvements !== undefined) review.improvements = asString(input.improvements);
        review.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.performanceReviews.some((review) => review.id === id)) {
          throw new Error('Değerlendirme bulunamadı.');
        }
        state.performanceReviews = state.performanceReviews.filter((review) => review.id !== id);
        return writeState(state);
      },
    },
    project: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Proje adı gerekli.');
        const now = Date.now();
        const dueDate = asString(input.dueDate);
        state.projects.push({
          id: uid(),
          companyId: input.companyId,
          name,
          description: asString(input.description),
          status: PROJECT_STATUSES.includes(input.status as ProjectStatus)
            ? (input.status as ProjectStatus)
            : 'active',
          progress: Math.min(100, Math.max(0, asNumber(input.progress, 0))),
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const project = state.projects.find((item) => item.id === input.id);
        if (!project) throw new Error('Proje bulunamadı.');
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          project.companyId = input.companyId;
        }
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Proje adı gerekli.');
          project.name = name;
        }
        if (input.description !== undefined) project.description = asString(input.description);
        if (input.status !== undefined && PROJECT_STATUSES.includes(input.status)) {
          project.status = input.status;
        }
        if (input.progress !== undefined) {
          project.progress = Math.min(100, Math.max(0, asNumber(input.progress, 0)));
        }
        if (input.dueDate !== undefined) {
          const dueDate = asString(input.dueDate);
          project.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;
        }
        project.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.projects.some((project) => project.id === id)) {
          throw new Error('Proje bulunamadı.');
        }
        state.projects = state.projects.filter((project) => project.id !== id);
        return writeState(state);
      },
    },
    approval: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const title = asString(input.title);
        if (!title) throw new Error('Onay başlığı gerekli.');
        const amount = asNumber(input.amount, 0);
        state.approvals.push({
          id: uid(),
          companyId: input.companyId,
          title,
          requestedBy: asString(input.requestedBy),
          amount: amount > 0 ? amount : null,
          note: asString(input.note),
          status: 'pending',
          decidedBy: '',
          decisionNote: '',
          createdAt: Date.now(),
          decidedAt: null,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const approval = state.approvals.find((item) => item.id === input.id);
        if (!approval) throw new Error('Onay bulunamadı.');
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          approval.companyId = input.companyId;
        }
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Onay başlığı gerekli.');
          approval.title = title;
        }
        if (input.requestedBy !== undefined) approval.requestedBy = asString(input.requestedBy);
        if (input.amount !== undefined) {
          const amount = asNumber(input.amount, 0);
          approval.amount = amount > 0 ? amount : null;
        }
        if (input.note !== undefined) approval.note = asString(input.note);
        if (input.status !== undefined && input.status !== 'pending') {
          approval.status = input.status;
          approval.decidedAt = approval.decidedAt ?? Date.now();
        }
        if (input.decidedBy !== undefined) approval.decidedBy = asString(input.decidedBy).slice(0, 120);
        if (input.decisionNote !== undefined) {
          approval.decisionNote = asString(input.decisionNote).slice(0, 1000);
        }
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.approvals.some((approval) => approval.id === id)) {
          throw new Error('Onay bulunamadı.');
        }
        state.approvals = state.approvals.filter((approval) => approval.id !== id);
        return writeState(state);
      },
      decide: async (id, status, decision) => {
        const state = readState();
        const approval = state.approvals.find((item) => item.id === id);
        if (!approval) throw new Error('Onay bulunamadı.');
        approval.status = status;
        approval.decidedAt = Date.now();
        if (decision?.decidedBy !== undefined) {
          approval.decidedBy = asString(decision.decidedBy).slice(0, 120);
        }
        if (decision?.decisionNote !== undefined) {
          approval.decisionNote = asString(decision.decisionNote).slice(0, 1000);
        }
        return writeState(state);
      },
    },
    settings: {
      update: async (input) => {
        const state = readState();
        const next: Settings = {
          ...state.settings,
          ...(input.language !== undefined ? { language: normalizeLanguage(input.language) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.clockFormat !== undefined ? { clockFormat: input.clockFormat } : {}),
          ...(input.showSeconds !== undefined ? { showSeconds: input.showSeconds } : {}),
          ...(input.startPage !== undefined ? { startPage: input.startPage } : {}),
          ...(input.notifications !== undefined ? { notifications: input.notifications } : {}),
          ...(input.theme !== undefined ? { theme: input.theme } : {}),
          ...(input.reduceMotion !== undefined ? { reduceMotion: input.reduceMotion } : {}),
          ...(input.translateSource !== undefined && /^[a-z]{2}$/.test(input.translateSource)
            ? { translateSource: input.translateSource }
            : {}),
          ...(input.translateTarget !== undefined && /^[a-z]{2}$/.test(input.translateTarget)
            ? { translateTarget: input.translateTarget }
            : {}),
          ...(input.pollIntervalSec !== undefined
            ? { pollIntervalSec: input.pollIntervalSec }
            : {}),
        };
        state.settings = normalizeSettings(next);
        return writeState(state);
      },
      testNotification: async () => {
        if (!('Notification' in window)) return false;
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') return false;
        new Notification(PRODUCT_NAME, { body: tGlobal('Test bildirimi gönderildi.') });
        return true;
      },
    },
    mail: {
      accounts: async () => [],
      test: async () => ({
        ok: false,
        message: tGlobal('Gmail hesapları tarayıcı sürümünde kullanılamıyor.'),
      }),
      add: async () => unsupported(),
      update: async () => unsupported(),
      remove: async () => unsupported(),
      list: async () => ({ messages: [], accounts: [], errors: [], unreadCounts: {} }),
      read: async () => unsupported(),
      star: async () => false,
    },
    youtube: {
      addKey: async () => unsupported(),
      updateKey: async () => unsupported(),
      removeKey: async () => unsupported(),
      setDefaultKey: async () => unsupported(),
      testKey: async () => ({
        ok: false,
        message: tGlobal('Bu özellik web sürümünde kullanılamıyor.'),
      }),
      addChannel: async () => unsupported(),
      setChannelKey: async () => unsupported(),
      removeChannel: async () => unsupported(),
      refresh: async () => unsupported(),
    },
    monitor: {
      refresh: async () => readState(),
    },
    session: {
      get: async () => ({ account: null, accounts: [], locked: false, meta: meta() }),
      register: async () => unsupported(),
      login: async () => unsupported(),
      verify2fa: async () => unsupported(),
      setup2fa: async () => unsupported(),
      enable2fa: async () => unsupported(),
      disable2fa: async () => unsupported(),
      backup2fa: async () => unsupported(),
      logout: async () => ({ locked: false, accounts: [] }),
      update: async () => unsupported(),
      changePassword: async () => unsupported(),
      security: async () => unsupported(),
    },
    assistant: {
      status: async () => ({
        provider: 'web',
        endpoint: '',
        model: '',
        modelLabel: '',
        hasKey: false,
        ready: false,
      }),
      ask: async () => unsupported(),
    },
    connections: {
      platforms: async () => [],
      add: async () => unsupported(),
      verify: async () => unsupported(),
      refresh: async () => unsupported(),
      primary: async () => unsupported(),
      remove: async () => unsupported(),
    },
    music: {
      import: async () => unsupported(),
      remove: async () => unsupported(),
      rename: async () => unsupported(),
    },
    translate: {
      languages: async () => [],
      run: async () => unsupported(),
    },
    updates: {
      notes: async () => ({
        currentVersion: WEB_VERSION,
        entries: [],
        lastSeenVersion: null,
        feedUrl: '',
        autoUpdate: false,
      }),
      check: async () => ({
        configured: false,
        available: false,
        currentVersion: WEB_VERSION,
        message: tGlobal('Web sürümünde otomatik güncelleme yok.'),
      }),
      markSeen: async () => readState(),
      saveSettings: async () => readState(),
      download: async () => unsupported(),
      install: async () => unsupported(),
    },
    rates: {
      get: () => rates(false),
      refresh: () => rates(true),
    },
    app: {
      openExternal: async (url) => {
        const target = safeUrl(url);
        if (!target) return false;
        window.open(target, '_blank', 'noopener,noreferrer');
        return true;
      },
      exportData: async () => {
        downloadJson(exportPayload());
        return { canceled: false, path: 'indirilenler' };
      },
      revealData: async () => false,
      copyText: (text) => {
        void navigator.clipboard?.writeText(text).catch(() => {
          const area = document.createElement('textarea');
          area.value = text;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        });
      },
    },
    onStatuses: (callback) => {
      statusListeners.add(callback);
      return () => {
        statusListeners.delete(callback);
      };
    },
    onYoutube: () => () => {},
    onFullscreen: () => () => {},
    onMaximized: () => () => {},
    onUpdateAvailable: () => () => {},
  };

  window.ezwin = api;
  (window as Window & { ezwinWeb?: boolean }).ezwinWeb = true;
}
