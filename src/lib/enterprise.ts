import type {
  AppData,
  BugReport,
  Client,
  Contract,
  ContractStatus,
  PerformanceReview,
  Task,
} from '../types';
import type { Page } from '../nav';
import type { TFunction } from '../i18n/core';
import { buildFinanceRows, totalsOf, type FinanceRow } from './finance';
import { formatMoney, todayISO } from './format';

export interface CompanyHealth {
  companyId: string;
  name: string;
  color: string;
  revenue: number;
  expense: number;
  net: number;
  headcount: number;
  activeProjects: number;
  openTasks: number;
  pendingApprovals: number;
  openBugs: number;
  activeContracts: number;
  clients: number;
}

export function companyHealthRows(data: AppData): CompanyHealth[] {
  const rows = buildFinanceRows(data);
  const byCompany = new Map<string, FinanceRow[]>();
  for (const row of rows) {
    const list = byCompany.get(row.companyId) ?? [];
    list.push(row);
    byCompany.set(row.companyId, list);
  }
  return data.companies.map((company) => {
    const totals = totalsOf(byCompany.get(company.id) ?? []);
    return {
      companyId: company.id,
      name: company.name,
      color: company.color,
      revenue: totals.income,
      expense: totals.expense,
      net: totals.net,
      headcount: data.employees.filter(
        (employee) => employee.companyId === company.id && employee.status !== 'inactive',
      ).length,
      activeProjects: data.projects.filter(
        (project) => project.companyId === company.id && project.status === 'active',
      ).length,
      openTasks: data.tasks.filter(
        (task) => task.companyId === company.id && !task.done,
      ).length,
      pendingApprovals: data.approvals.filter(
        (approval) => approval.companyId === company.id && approval.status === 'pending',
      ).length,
      openBugs: data.bugs.filter(
        (bug) =>
          bug.companyId === company.id && (bug.status === 'open' || bug.status === 'in_progress'),
      ).length,
      activeContracts: data.contracts.filter(
        (contract) =>
          contract.companyId === company.id && contractEffectiveStatus(contract) === 'active',
      ).length,
      clients: data.clients.filter(
        (client) => client.companyId === company.id && client.status === 'active',
      ).length,
    };
  });
}

export function contractEffectiveStatus(contract: Contract): ContractStatus {
  if (contract.status === 'terminated') return 'terminated';
  if (contract.endDate && contract.endDate < todayISO()) return 'expired';
  if (contract.startDate && contract.startDate > todayISO()) return 'pending';
  return contract.status;
}

export function contractDaysLeft(contract: Contract): number | null {
  if (!contract.endDate) return null;
  const end = new Date(`${contract.endDate}T00:00:00`).getTime();
  const today = new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.round((end - today) / 86_400_000);
}

export function expiringContracts(contracts: Contract[], days = 30): Contract[] {
  return contracts.filter((contract) => {
    const left = contractDaysLeft(contract);
    return left !== null && left >= 0 && left <= days && contractEffectiveStatus(contract) !== 'terminated';
  });
}

export interface RankedEmployee {
  id: string;
  name: string;
  companyId: string;
  departmentId: string | null;
  score: number | null;
  reviewCount: number;
  lastPeriod: string | null;
  openTasks: number;
  doneTasks: number;
}

export function employeeRanking(data: AppData): RankedEmployee[] {
  const reviewsByEmployee = new Map<string, PerformanceReview[]>();
  for (const review of data.performanceReviews) {
    const list = reviewsByEmployee.get(review.employeeId) ?? [];
    list.push(review);
    reviewsByEmployee.set(review.employeeId, list);
  }
  return data.employees
    .filter((employee) => employee.status !== 'inactive')
    .map((employee) => {
      const reviews = (reviewsByEmployee.get(employee.id) ?? [])
        .slice()
        .sort((a, b) => b.period.localeCompare(a.period));
      const latest = reviews[0];
      return {
        id: employee.id,
        name: employee.name,
        companyId: employee.companyId,
        departmentId: employee.departmentId,
        score: latest ? latest.score : null,
        reviewCount: reviews.length,
        lastPeriod: latest ? latest.period : null,
        openTasks: data.tasks.filter(
          (task) => task.assigneeId === employee.id && !task.done,
        ).length,
        doneTasks: data.tasks.filter(
          (task) => task.assigneeId === employee.id && task.done,
        ).length,
      };
    })
    .sort((a, b) => {
      if (a.score === null && b.score === null) return a.name.localeCompare(b.name);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
}

export interface DepartmentMetric {
  id: string;
  name: string;
  color: string;
  companyId: string;
  headcount: number;
  onLeave: number;
  avgScore: number | null;
  reviewCount: number;
  openTasks: number;
  announcements: number;
  meetings: number;
}

export function departmentMetrics(data: AppData): DepartmentMetric[] {
  return data.departments.map((department) => {
    const people = data.employees.filter(
      (employee) =>
        employee.departmentId === department.id && employee.status !== 'inactive',
    );
    const ids = new Set(people.map((person) => person.id));
    const reviews = data.performanceReviews.filter(
      (review) => ids.has(review.employeeId),
    );
    const avgScore =
      reviews.length === 0
        ? null
        : Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length);
    return {
      id: department.id,
      name: department.name,
      color: department.color,
      companyId: department.companyId,
      headcount: people.length,
      onLeave: people.filter((person) => person.status === 'on_leave').length,
      avgScore,
      reviewCount: reviews.length,
      openTasks: data.tasks.filter(
        (task) => task.assigneeId && ids.has(task.assigneeId) && !task.done,
      ).length,
      announcements: data.announcements.filter(
        (announcement) =>
          announcement.departmentId === department.id &&
          announcement.status === 'published',
      ).length,
      meetings: data.meetings.filter((meeting) => meeting.departmentId === department.id)
        .length,
    };
  });
}

export function openBugs(bugs: BugReport[]): BugReport[] {
  return bugs.filter((bug) => bug.status === 'open' || bug.status === 'in_progress');
}

export function followUpClients(clients: Client[], days = 7): Client[] {
  const today = todayISO();
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const end = limit.toISOString().slice(0, 10);
  return clients.filter(
    (client) =>
      client.nextFollowUp !== null &&
      client.nextFollowUp >= today &&
      client.nextFollowUp <= end &&
      client.status !== 'lost',
  );
}

export function overdueTasks(tasks: Task[]): Task[] {
  const today = todayISO();
  return tasks.filter((task) => !task.done && task.due !== null && task.due < today);
}

export interface EnterpriseInsight {
  id: string;
  tone: 'default' | 'mint' | 'amber' | 'danger';
  title: string;
  detail: string;
  page: Page;
  companyId: string | null;
}

export function buildInsights(data: AppData, t: TFunction): EnterpriseInsight[] {
  const currency = data.settings.currency;
  const insights: EnterpriseInsight[] = [];
  const health = companyHealthRows(data);
  for (const row of health) {
    if (row.revenue > 0 && row.net < 0) {
      insights.push({
        id: `net-${row.companyId}`,
        tone: 'danger',
        title: t('{company} zararda', { company: row.name }),
        detail: t('Gelir {income}, gider {expense}; net {net}.', {
          income: formatMoney(row.revenue, currency),
          expense: formatMoney(row.expense, currency),
          net: formatMoney(row.net, currency),
        }),
        page: 'finance',
        companyId: row.companyId,
      });
    }
    if (row.openBugs > 0) {
      insights.push({
        id: `bugs-${row.companyId}`,
        tone: row.openBugs >= 3 ? 'amber' : 'default',
        title: t('{count} açık hata', { count: row.openBugs }),
        detail: t('{company} için çözülmemiş hata kayıtları var.', { company: row.name }),
        page: 'business',
        companyId: row.companyId,
      });
    }
  }
  const overdue = data.invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'canceled' &&
      invoice.dueDate < todayISO(),
  );
  if (overdue.length > 0) {
    insights.push({
      id: 'overdue-invoices',
      tone: 'danger',
      title: t('{count} gecikmiş fatura', { count: overdue.length }),
      detail: t('Vadesi geçen faturalar tahsilat bekliyor.'),
      page: 'finance',
      companyId: null,
    });
  }
  const expiring = expiringContracts(data.contracts, 30);
  if (expiring.length > 0) {
    insights.push({
      id: 'contracts-expiring',
      tone: 'amber',
      title: t('{count} sözleşme yakında bitiyor', { count: expiring.length }),
      detail: t('30 gün içinde sona eren sözleşmeleri gözden geçir.'),
      page: 'business',
      companyId: null,
    });
  }
  const staleReviews = data.employees.filter(
    (employee) =>
      employee.status !== 'inactive' &&
      !data.performanceReviews.some((review) => review.employeeId === employee.id),
  );
  if (staleReviews.length > 0) {
    insights.push({
      id: 'reviews-missing',
      tone: 'amber',
      title: t('{count} çalışanın değerlendirmesi yok', { count: staleReviews.length }),
      detail: t('Performans sıralaması için eksik değerlendirmeleri tamamla.'),
      page: 'operations',
      companyId: null,
    });
  }
  const pending = data.approvals.filter((approval) => approval.status === 'pending');
  if (pending.length > 0) {
    insights.push({
      id: 'approvals-pending',
      tone: 'amber',
      title: t('{count} onay bekliyor', { count: pending.length }),
      detail: t('Yönetici onay kuyruğunda karar bekleyen talepler var.'),
      page: 'admin',
      companyId: null,
    });
  }
  const followUps = followUpClients(data.clients, 7);
  if (followUps.length > 0) {
    insights.push({
      id: 'clients-followup',
      tone: 'amber',
      title: t('{count} müşteri takibi yaklaşıyor', { count: followUps.length }),
      detail: t('Önümüzdeki 7 gün içinde iletişime geçilecek müşteriler var.'),
      page: 'business',
      companyId: null,
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: 'calm',
      tone: 'mint',
      title: t('Acil sinyal yok'),
      detail: t('Mevcut kayıtlarda dikkat gerektiren bir finans, sözleşme veya hata sinyali yok.'),
      page: 'admin',
      companyId: null,
    });
  }
  return insights.slice(0, 12);
}
