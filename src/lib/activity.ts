import type { AppData } from '../types';
import type { Page } from '../nav';
import type { TFunction } from '../i18n/core';
import { formatMoney } from './format';

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
