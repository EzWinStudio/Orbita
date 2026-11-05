import type { AppData } from '../types';
import type { Page } from '../nav';
import type { TFunction } from '../i18n/core';
import { BUG_STATUS_LABEL } from '../constants';
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
  | 'approval_rejected'
  | 'client'
  | 'contract'
  | 'document'
  | 'bug'
  | 'automation'
  | 'chat'
  | 'security';

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

  for (const client of data.clients) {
    const updated = client.updatedAt > client.createdAt + 1000;
    items.push({
      id: `client-${client.id}`,
      kind: 'client',
      tone: 'default',
      at: client.updatedAt,
      title: updated ? t('Müşteri güncellendi') : t('Müşteri eklendi'),
      meta: [client.name, companyName.get(client.companyId)].filter(Boolean).join(' · '),
      companyId: client.companyId,
      page: 'business',
    });
  }

  for (const contract of data.contracts) {
    const updated = contract.updatedAt > contract.createdAt + 1000;
    items.push({
      id: `contract-${contract.id}`,
      kind: 'contract',
      tone: contract.status === 'expired' || contract.status === 'terminated' ? 'danger' : 'default',
      at: contract.updatedAt,
      title: updated ? t('Sözleşme güncellendi') : t('Sözleşme eklendi'),
      meta: [contract.title, contract.counterparty, companyName.get(contract.companyId)]
        .filter(Boolean)
        .join(' · '),
      companyId: contract.companyId,
      page: 'business',
    });
  }

  for (const document of data.documents) {
    const updated = document.updatedAt > document.createdAt + 1000;
    items.push({
      id: `document-${document.id}`,
      kind: 'document',
      tone: 'default',
      at: document.updatedAt,
      title: updated ? t('Belge güncellendi') : t('Belge kaydedildi'),
      meta: [document.title, companyName.get(document.companyId)].filter(Boolean).join(' · '),
      companyId: document.companyId,
      page: 'business',
    });
  }

  for (const bug of data.bugs) {
    const updated = bug.updatedAt > bug.createdAt + 1000;
    items.push({
      id: `bug-${bug.id}`,
      kind: 'bug',
      tone:
        bug.status === 'resolved' || bug.status === 'closed'
          ? 'mint'
          : bug.severity === 'critical' || bug.severity === 'high'
            ? 'danger'
            : 'amber',
      at: bug.updatedAt,
      title: updated ? t('Hata kaydı güncellendi') : t('Hata kaydı açıldı'),
      meta: `${bug.title} · ${t(BUG_STATUS_LABEL[bug.status])} · ${companyName.get(bug.companyId) ?? t('Şirketsiz')}`,
      companyId: bug.companyId,
      page: 'business',
    });
  }

  for (const rule of data.automationRules) {
    const updated = rule.updatedAt > rule.createdAt + 1000;
    items.push({
      id: `automation-${rule.id}`,
      kind: 'automation',
      tone: 'amber',
      at: rule.updatedAt,
      title: updated ? t('Otomasyon kuralı güncellendi') : t('Otomasyon kuralı oluşturuldu'),
      meta: [rule.title, companyName.get(rule.companyId)].filter(Boolean).join(' · '),
      companyId: rule.companyId,
      page: 'business',
    });
    if (rule.lastRun) {
      items.push({
        id: `automation-run-${rule.id}`,
        kind: 'automation',
        tone: 'mint',
        at: rule.lastRun,
        title: t('Otomasyon çalıştırıldı; görev oluşturuldu'),
        meta: [rule.title, companyName.get(rule.companyId)].filter(Boolean).join(' · '),
        companyId: rule.companyId,
        page: 'business',
      });
    }
  }

  const threadCompany = new Map(
    data.chatThreads.map((thread) => [thread.id, thread.companyId]),
  );
  for (const thread of data.chatThreads) {
    items.push({
      id: `chat-thread-${thread.id}`,
      kind: 'chat',
      tone: 'default',
      at: thread.createdAt,
      title: t('Sohbet açıldı'),
      meta: companyName.get(thread.companyId) ?? t('Şirketsiz'),
      companyId: thread.companyId,
      page: 'communication',
    });
  }
  for (const message of data.chatMessages) {
    const companyId = threadCompany.get(message.threadId) ?? null;
    items.push({
      id: `chat-message-${message.id}`,
      kind: 'chat',
      tone: 'default',
      at: message.createdAt,
      title: t('Mesaj gönderildi'),
      meta: `${message.author}: ${message.body.length > 90 ? `${message.body.slice(0, 90)}…` : message.body}`,
      companyId,
      page: 'communication',
    });
  }

  for (const event of data.securityEvents) {
    items.push({
      id: `security-${event.id}`,
      kind: 'security',
      tone: event.kind === 'approval' ? 'amber' : 'default',
      at: event.at,
      title: t('Güvenlik olayı'),
      meta: `${event.actor} · ${event.detail}`,
      companyId: event.companyId,
      page: 'admin',
    });
  }

  return items.filter((item) => item.at > 0).sort((a, b) => b.at - a.at).slice(0, limit);
}
