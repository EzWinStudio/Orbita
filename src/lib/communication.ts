import type {
  Announcement,
  AppData,
  ChatThread,
  Department,
  Employee,
  Meeting,
} from '../types';
import type { Page } from '../nav';
import type { TFunction } from '../i18n/core';
import { invoiceEffectiveStatus } from './finance';
import { currentMonthKey, todayISO } from './format';

export type InboxKind =
  | 'announcement'
  | 'meeting'
  | 'invoice'
  | 'task'
  | 'approval'
  | 'subscription'
  | 'salary';

export type InboxTone = 'info' | 'warning' | 'danger' | 'success';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  tone: InboxTone;
  at: number;
  companyId: string | null;
  title: string;
  meta: string;
  target: Page;
  adminOnly?: boolean;
}

const DAY = 86_400_000;

export function meetingTimestamp(meeting: Pick<Meeting, 'date' | 'time'>): number {
  const value = new Date(`${meeting.date}T${meeting.time}:00`).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function announcementAudienceLabel(
  announcement: Announcement,
  departments: Map<string, Department>,
  t: TFunction,
): string {
  if (announcement.audience === 'company') return t('Tüm şirket');
  return departments.get(announcement.departmentId ?? '')?.name ?? t('Departman');
}

export function threadLabel(
  thread: ChatThread,
  companyName: Map<string, string>,
  departments: Map<string, Department>,
  employees: Map<string, Employee>,
  t: TFunction,
): string {
  if (thread.scope === 'department') {
    return departments.get(thread.departmentId ?? '')?.name ?? t('Departman');
  }
  if (thread.scope === 'direct') {
    return employees.get(thread.employeeId ?? '')?.name ?? t('Çalışan');
  }
  const company = companyName.get(thread.companyId);
  return company ? t('{company} · genel', { company }) : t('Şirket geneli');
}

export function buildInbox(data: AppData, now = Date.now()): InboxItem[] {
  const today = todayISO();
  const weekAhead = new Date(`${today}T00:00:00`);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadISO = `${weekAhead.getFullYear()}-${String(weekAhead.getMonth() + 1).padStart(2, '0')}-${String(weekAhead.getDate()).padStart(2, '0')}`;
  const month = currentMonthKey();
  const items: InboxItem[] = [];

  for (const announcement of data.announcements) {
    if (announcement.status !== 'published' || !announcement.publishedAt) continue;
    const recent = now - announcement.publishedAt <= 60 * DAY;
    if (!recent && !announcement.pinned) continue;
    items.push({
      id: `announcement:${announcement.id}`,
      kind: 'announcement',
      tone: announcement.priority === 'urgent' ? 'danger' : announcement.priority === 'important' ? 'warning' : 'info',
      at: announcement.publishedAt,
      companyId: announcement.companyId,
      title: announcement.title,
      meta: announcement.author,
      target: 'communication',
      adminOnly: announcement.visibility === 'admin',
    });
  }

  for (const meeting of data.meetings) {
    if (meeting.status !== 'planned') continue;
    if (meeting.date < today || meeting.date > weekAheadISO) continue;
    items.push({
      id: `meeting:${meeting.id}`,
      kind: 'meeting',
      tone: 'info',
      at: meetingTimestamp(meeting),
      companyId: meeting.companyId,
      title: meeting.title,
      meta: `${meeting.time}${meeting.location ? ` · ${meeting.location}` : ''}`,
      target: 'communication',
    });
  }

  const paymentsByInvoice = new Map<string, typeof data.customerPayments>();
  for (const payment of data.customerPayments) {
    if (!payment.invoiceId) continue;
    const list = paymentsByInvoice.get(payment.invoiceId) ?? [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoiceId, list);
  }

  for (const invoice of data.invoices) {
    const effective = invoiceEffectiveStatus(
      invoice,
      paymentsByInvoice.get(invoice.id) ?? [],
      today,
    );
    if (effective !== 'overdue') continue;
    items.push({
      id: `invoice:${invoice.id}`,
      kind: 'invoice',
      tone: 'danger',
      at: new Date(`${invoice.dueDate}T23:59:59`).getTime(),
      companyId: invoice.companyId,
      title: invoice.number,
      meta: invoice.customerName,
      target: 'finance',
    });
  }

  for (const task of data.tasks) {
    if (task.done || !task.due || task.due > today) continue;
    items.push({
      id: `task:${task.id}`,
      kind: 'task',
      tone: task.due < today ? 'danger' : 'warning',
      at: new Date(`${task.due}T23:59:59`).getTime(),
      companyId: task.companyId,
      title: task.title,
      meta: task.due,
      target: 'tasks',
    });
  }

  for (const approval of data.approvals) {
    if (approval.status !== 'pending') continue;
    items.push({
      id: `approval:${approval.id}`,
      kind: 'approval',
      tone: 'warning',
      at: approval.createdAt,
      companyId: approval.companyId,
      title: approval.title,
      meta: approval.requestedBy,
      target: 'operations',
    });
  }

  const subscriptionHorizon = new Date(`${today}T00:00:00`);
  subscriptionHorizon.setDate(subscriptionHorizon.getDate() + 30);
  const subscriptionHorizonISO = `${subscriptionHorizon.getFullYear()}-${String(subscriptionHorizon.getMonth() + 1).padStart(2, '0')}-${String(subscriptionHorizon.getDate()).padStart(2, '0')}`;
  for (const subscription of data.subscriptions) {
    if (subscription.status !== 'active') continue;
    if (subscription.nextRenewal > subscriptionHorizonISO) continue;
    items.push({
      id: `subscription:${subscription.id}`,
      kind: 'subscription',
      tone: subscription.nextRenewal < today ? 'warning' : 'info',
      at: new Date(`${subscription.nextRenewal}T23:59:59`).getTime(),
      companyId: subscription.companyId,
      title: subscription.name,
      meta: subscription.vendor,
      target: 'finance',
    });
  }

  for (const salary of data.salaries) {
    if (salary.status !== 'planned' || salary.period > month) continue;
    items.push({
      id: `salary:${salary.id}`,
      kind: 'salary',
      tone: 'warning',
      at: new Date(`${salary.period}-01T00:00:00`).getTime(),
      companyId: salary.companyId,
      title: salary.employeeName,
      meta: salary.period,
      target: 'finance',
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, 60);
}

export function unreadInbox(items: InboxItem[], reads: AppData['notificationReads']): InboxItem[] {
  const read = new Set(reads.map((item) => item.id));
  return items.filter((item) => !read.has(item.id));
}

export function inboxTotals(data: AppData, items: InboxItem[]) {
  const today = todayISO();
  const read = new Set(data.notificationReads.map((item) => item.id));
  return {
    unread: items.filter((item) => !read.has(item.id)).length,
    meetingsToday: items.filter((item) => item.kind === 'meeting' && item.at >= new Date(`${today}T00:00:00`).getTime() && item.at <= new Date(`${today}T23:59:59`).getTime()).length,
    overdueInvoices: items.filter((item) => item.kind === 'invoice').length,
    pendingApprovals: items.filter((item) => item.kind === 'approval').length,
  };
}
