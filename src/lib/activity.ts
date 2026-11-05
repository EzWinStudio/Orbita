import type { AppData } from '../types';
import type { Page } from '../nav';
import type { TFunction } from '../i18n/core';
import { formatDate, formatMoney, monthLabel } from './format';

export type ActivityKind =
  | 'company'
  | 'service'
  | 'income'
  | 'expense'
  | 'task'
  | 'task_done'
  | 'note'
  | 'project'
  | 'project_done'
  | 'employee'
  | 'department'
  | 'role'
  | 'review'
  | 'salary'
  | 'invoice'
  | 'payment'
  | 'subscription'
  | 'announcement'
  | 'meeting'
  | 'approval'
  | 'approval_approved'
  | 'approval_rejected';

export type ActivityTone = 'default' | 'mint' | 'amber' | 'danger';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  tone: ActivityTone;
  at: number;
  title: string;
  meta: string;
  companyId: string | null;
  page: Page;
}

export function buildActivity(data: AppData, t: TFunction, limit = 8): ActivityItem[] {
  const companyName = new Map(data.companies.map((company) => [company.id, company.name]));
  const currency = data.settings.currency;
  const items: ActivityItem[] = [];

  for (const company of data.companies) {
    items.push({
      id: `company-${company.id}`,
      kind: 'company',
      tone: 'default',
      at: company.createdAt,
      title: t('Şirket eklendi'),
      meta: company.name,
      companyId: company.id,
      page: 'company',
    });
  }

  for (const asset of data.assets) {
    items.push({
      id: `asset-${asset.id}`,
      kind: 'service',
      tone: 'default',
      at: asset.createdAt,
      title: t('Servis bağlandı'),
      meta: `${asset.name} · ${companyName.get(asset.companyId) ?? t('Şirketsiz')}`,
      companyId: asset.companyId,
      page: 'services',
    });
  }

  for (const entry of data.finance) {
    items.push({
      id: `finance-${entry.id}`,
      kind: entry.kind,
      tone: entry.kind === 'income' ? 'mint' : 'danger',
      at: entry.createdAt,
      title:
        entry.kind === 'income'
          ? t('Gelir kaydı · {amount}', { amount: formatMoney(entry.amount, currency) })
          : t('Gider kaydı · {amount}', { amount: formatMoney(entry.amount, currency) }),
      meta: [companyName.get(entry.companyId), entry.category].filter(Boolean).join(' · '),
      companyId: entry.companyId,
      page: 'finance',
    });
  }

  for (const salary of data.salaries) {
    items.push({
      id: `salary-${salary.id}`,
      kind: 'salary',
      tone: salary.status === 'paid' ? 'danger' : 'amber',
      at: salary.updatedAt,
      title:
        salary.status === 'paid'
          ? t('Maaş ödendi · {amount}', { amount: formatMoney(salary.amount, currency) })
          : t('Maaş planlandı · {amount}', { amount: formatMoney(salary.amount, currency) }),
      meta: [salary.employeeName, monthLabel(salary.period)]
        .filter(Boolean)
        .join(' · '),
      companyId: salary.companyId,
      page: 'finance',
    });
  }

  for (const invoice of data.invoices) {
    items.push({
      id: `invoice-${invoice.id}`,
      kind: 'invoice',
      tone: invoice.status === 'paid' ? 'mint' : 'default',
      at: invoice.updatedAt,
      title:
        invoice.updatedAt > invoice.createdAt + 1000
          ? t('Fatura güncellendi · {number}', { number: invoice.number })
          : t('Fatura oluşturuldu · {number}', { number: invoice.number }),
      meta: [invoice.customerName, companyName.get(invoice.companyId)]
        .filter(Boolean)
        .join(' · '),
      companyId: invoice.companyId,
      page: 'finance',
    });
  }

  for (const payment of data.customerPayments) {
    items.push({
      id: `payment-${payment.id}`,
      kind: 'payment',
      tone: payment.status === 'received' ? 'mint' : 'amber',
      at: payment.updatedAt,
      title:
        payment.status === 'received'
          ? t('Ödeme alındı · {amount}', { amount: formatMoney(payment.amount, currency) })
          : t('Ödeme bekliyor · {amount}', { amount: formatMoney(payment.amount, currency) }),
      meta: [payment.customerName, companyName.get(payment.companyId)]
        .filter(Boolean)
        .join(' · '),
      companyId: payment.companyId,
      page: 'finance',
    });
  }

  for (const subscription of data.subscriptions) {
    items.push({
      id: `subscription-${subscription.id}`,
      kind: 'subscription',
      tone: subscription.status === 'active' ? 'default' : 'amber',
      at: subscription.updatedAt,
      title:
        subscription.updatedAt > subscription.createdAt + 1000
          ? t('Abonelik güncellendi')
          : t('Abonelik eklendi'),
      meta: [subscription.name, subscription.vendor].filter(Boolean).join(' · '),
      companyId: subscription.companyId,
      page: 'finance',
    });
  }

  for (const announcement of data.announcements) {
    if (announcement.status !== 'published' || !announcement.publishedAt) continue;
    items.push({
      id: `announcement-${announcement.id}`,
      kind: 'announcement',
      tone: announcement.priority === 'urgent' ? 'danger' : announcement.priority === 'important' ? 'amber' : 'default',
      at: announcement.publishedAt,
      title: t('Duyuru yayınlandı'),
      meta: `${announcement.title} · ${companyName.get(announcement.companyId) ?? t('Şirketsiz')}`,
      companyId: announcement.companyId,
      page: 'communication',
    });
  }

  for (const meeting of data.meetings) {
    items.push({
      id: `meeting-${meeting.id}`,
      kind: 'meeting',
      tone: meeting.status === 'canceled' ? 'danger' : meeting.status === 'done' ? 'mint' : 'amber',
      at: meeting.updatedAt,
      title:
        meeting.status === 'done'
          ? t('Toplantı tamamlandı')
          : meeting.status === 'canceled'
            ? t('Toplantı iptal edildi')
            : t('Toplantı planlandı'),
      meta: `${meeting.title} · ${formatDate(meeting.date)}`,
      companyId: meeting.companyId,
      page: 'communication',
    });
  }

  for (const task of data.tasks) {
    if (task.done && task.completedAt) {
      items.push({
        id: `task-done-${task.id}`,
        kind: 'task_done',
        tone: 'mint',
        at: task.completedAt,
        title: t('Görev tamamlandı'),
        meta: task.title,
        companyId: task.companyId,
        page: 'tasks',
      });
    } else {
      items.push({
        id: `task-${task.id}`,
        kind: 'task',
        tone: 'default',
        at: task.createdAt,
        title: t('Görev oluşturuldu'),
        meta: task.title,
        companyId: task.companyId,
        page: 'tasks',
      });
    }
  }

  for (const note of data.notes) {
    items.push({
      id: `note-${note.id}`,
      kind: 'note',
      tone: 'default',
      at: note.updatedAt,
      title: t('Not güncellendi'),
      meta: note.title,
      companyId: note.companyId,
      page: 'tasks',
    });
  }

  for (const project of data.projects) {
    const completed = project.status === 'completed';
    items.push({
      id: `project-${project.id}`,
      kind: completed ? 'project_done' : 'project',
      tone: completed ? 'mint' : 'amber',
      at: project.updatedAt,
      title: completed
        ? t('Proje tamamlandı')
        : project.updatedAt > project.createdAt + 1000
          ? t('Proje güncellendi')
          : t('Proje oluşturuldu'),
      meta: `${project.name} · ${companyName.get(project.companyId) ?? t('Şirketsiz')}`,
      companyId: project.companyId,
      page: 'operations',
    });
  }

  for (const employee of data.employees) {
    items.push({
      id: `employee-${employee.id}`,
      kind: 'employee',
      tone: 'default',
      at: employee.updatedAt,
      title:
        employee.updatedAt > employee.createdAt + 1000
          ? t('Çalışan güncellendi')
          : t('Çalışan eklendi'),
      meta: [employee.name, employee.role].filter(Boolean).join(' · '),
      companyId: employee.companyId,
      page: 'operations',
    });
  }

  for (const department of data.departments) {
    items.push({
      id: `department-${department.id}`,
      kind: 'department',
      tone: 'default',
      at: department.updatedAt,
      title:
        department.updatedAt > department.createdAt + 1000
          ? t('Departman güncellendi')
          : t('Departman oluşturuldu'),
      meta: `${department.name} · ${companyName.get(department.companyId) ?? t('Şirketsiz')}`,
      companyId: department.companyId,
      page: 'operations',
    });
  }

  for (const role of data.roles) {
    items.push({
      id: `role-${role.id}`,
      kind: 'role',
      tone: 'default',
      at: role.updatedAt,
      title:
        role.updatedAt > role.createdAt + 1000
          ? t('Rol güncellendi')
          : t('Rol oluşturuldu'),
      meta: `${role.name} · ${companyName.get(role.companyId) ?? t('Şirketsiz')}`,
      companyId: role.companyId,
      page: 'operations',
    });
  }

  const employeeName = new Map(data.employees.map((employee) => [employee.id, employee.name]));
  for (const review of data.performanceReviews) {
    items.push({
      id: `review-${review.id}`,
      kind: 'review',
      tone: 'mint',
      at: review.updatedAt,
      title:
        review.updatedAt > review.createdAt + 1000
          ? t('Değerlendirme güncellendi')
          : t('Değerlendirme eklendi'),
      meta: [employeeName.get(review.employeeId), monthLabel(review.period)]
        .filter(Boolean)
        .join(' · '),
      companyId: review.companyId,
      page: 'operations',
    });
  }

  for (const approval of data.approvals) {
    items.push({
      id: `approval-${approval.id}`,
      kind: 'approval',
      tone: 'amber',
      at: approval.createdAt,
      title: t('Onay talebi oluşturuldu'),
      meta: `${approval.title} · ${companyName.get(approval.companyId) ?? t('Şirketsiz')}`,
      companyId: approval.companyId,
      page: 'operations',
    });
    if (approval.decidedAt) {
      const approved = approval.status === 'approved';
      items.push({
        id: `approval-decision-${approval.id}`,
        kind: approved ? 'approval_approved' : 'approval_rejected',
        tone: approved ? 'mint' : 'danger',
        at: approval.decidedAt,
        title: approved ? t('Talep onaylandı') : t('Talep reddedildi'),
        meta: approval.title,
        companyId: approval.companyId,
        page: 'operations',
      });
    }
  }

  return items.filter((item) => item.at > 0).sort((a, b) => b.at - a.at).slice(0, limit);
}
