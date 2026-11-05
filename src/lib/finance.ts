import type {
  AppData,
  CustomerPayment,
  FinanceKind,
  Invoice,
  InvoiceStatus,
  SalaryPayment,
  Subscription,
} from '../types';
import { monthKeyOf, todayISO } from './format';

export type FinanceSource = 'manual' | 'salary' | 'invoice' | 'payment';

export interface FinanceRow {
  id: string;
  kind: FinanceKind;
  amount: number;
  companyId: string;
  category: string;
  note: string;
  date: string;
  source: FinanceSource;
  at: number;
}

export interface FinanceTotals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function dateFromTimestamp(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function invoiceTotal(invoice: Pick<Invoice, 'amount' | 'taxRate'>): number {
  const tax = Math.max(0, invoice.taxRate) / 100;
  return Math.round(invoice.amount * (1 + tax) * 100) / 100;
}

export function invoiceTax(invoice: Pick<Invoice, 'amount' | 'taxRate'>): number {
  return Math.round((invoiceTotal(invoice) - invoice.amount) * 100) / 100;
}

export function invoiceReceived(
  invoiceId: string,
  payments: CustomerPayment[],
): number {
  const total = payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === 'received')
    .reduce((sum, payment) => sum + payment.amount, 0);
  return Math.round(total * 100) / 100;
}

export type InvoiceDisplayStatus = InvoiceStatus | 'overdue';

export function invoiceEffectiveStatus(
  invoice: Invoice,
  payments: CustomerPayment[],
  today = todayISO(),
): InvoiceDisplayStatus {
  if (invoice.status === 'canceled') return 'canceled';
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'draft') return 'draft';
  const received = invoiceReceived(invoice.id, payments);
  if (invoiceTotal(invoice) > 0 && received >= invoiceTotal(invoice) - 0.005) return 'paid';
  if (invoice.dueDate && invoice.dueDate < today) return 'overdue';
  return 'sent';
}

export function invoiceBalance(invoice: Invoice, payments: CustomerPayment[]): number {
  const balance = invoiceTotal(invoice) - invoiceReceived(invoice.id, payments);
  return Math.max(0, Math.round(balance * 100) / 100);
}

export function openInvoiceSummary(
  invoices: Invoice[],
  payments: CustomerPayment[],
): { open: number; overdue: number; openCount: number; overdueCount: number } {
  const today = todayISO();
  let open = 0;
  let overdue = 0;
  let openCount = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    const status = invoiceEffectiveStatus(invoice, payments, today);
    if (status === 'paid' || status === 'canceled' || status === 'draft') continue;
    const balance = invoiceBalance(invoice, payments);
    open += balance;
    openCount += 1;
    if (status === 'overdue') {
      overdue += balance;
      overdueCount += 1;
    }
  }
  return { open, overdue, openCount, overdueCount };
}

export function buildFinanceRows(
  data: Pick<AppData, 'finance' | 'salaries' | 'invoices' | 'customerPayments'>,
): FinanceRow[] {
  const rows: FinanceRow[] = [];

  for (const entry of data.finance) {
    rows.push({
      id: `finance-${entry.id}`,
      kind: entry.kind,
      amount: entry.amount,
      companyId: entry.companyId,
      category: entry.category,
      note: entry.note,
      date: entry.date,
      source: 'manual',
      at: entry.createdAt,
    });
  }

  for (const salary of data.salaries) {
    if (salary.status !== 'paid' || !salary.paidAt) continue;
    rows.push({
      id: `salary-${salary.id}`,
      kind: 'expense',
      amount: salary.amount,
      companyId: salary.companyId,
      category: '',
      note: salary.employeeName,
      date: dateFromTimestamp(salary.paidAt),
      source: 'salary',
      at: salary.paidAt,
    });
  }

  const paymentsByInvoice = new Map<string, CustomerPayment[]>();
  for (const payment of data.customerPayments) {
    if (payment.status !== 'received' || !payment.invoiceId) continue;
    const list = paymentsByInvoice.get(payment.invoiceId) ?? [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoiceId, list);
  }

  const coveredPayments = new Set<string>();
  for (const invoice of data.invoices) {
    if (invoice.status !== 'paid') continue;
    const linked = paymentsByInvoice.get(invoice.id) ?? [];
    const latest = linked.reduce((max, payment) => Math.max(max, Date.parse(payment.date) || 0), 0);
    rows.push({
      id: `invoice-${invoice.id}`,
      kind: 'income',
      amount: invoiceTotal(invoice),
      companyId: invoice.companyId,
      category: '',
      note: invoice.customerName,
      date: latest ? dateFromTimestamp(latest) : dateFromTimestamp(invoice.updatedAt),
      source: 'invoice',
      at: latest || invoice.updatedAt,
    });
    for (const payment of linked) coveredPayments.add(payment.id);
  }

  const invoiceById = new Map(data.invoices.map((invoice) => [invoice.id, invoice]));
  for (const payment of data.customerPayments) {
    if (payment.status !== 'received') continue;
    if (coveredPayments.has(payment.id)) continue;
    const invoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : null;
    if (invoice && invoice.status === 'canceled') continue;
    rows.push({
      id: `payment-${payment.id}`,
      kind: 'income',
      amount: payment.amount,
      companyId: payment.companyId,
      category: '',
      note: payment.customerName,
      date: payment.date,
      source: 'payment',
      at: Date.parse(payment.date) || payment.updatedAt,
    });
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.at - a.at;
  });
}

export function totalsOf(rows: FinanceRow[]): FinanceTotals {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.kind === 'income') income += row.amount;
    else expense += row.amount;
  }
  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
    count: rows.length,
  };
}

export function rowsInMonth(rows: FinanceRow[], month: string): FinanceRow[] {
  return rows.filter((row) => monthKeyOf(row.date) === month);
}

export function rowsInYear(rows: FinanceRow[], year: number): FinanceRow[] {
  return rows.filter((row) => row.date.slice(0, 4) === String(year));
}

export function filterRowsByRange(rows: FinanceRow[], from: string, to: string): FinanceRow[] {
  return rows.filter((row) => row.date >= from && row.date <= to);
}

export function categoryTotals(
  rows: FinanceRow[],
  kind: FinanceKind,
): { key: string; source: FinanceSource; amount: number; count: number }[] {
  const map = new Map<string, { key: string; source: FinanceSource; amount: number; count: number }>();
  for (const row of rows) {
    if (row.kind !== kind) continue;
    const key = row.category.trim() || row.source;
    const entry = map.get(key) ?? { key, source: row.source, amount: 0, count: 0 };
    entry.amount += row.amount;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function companyTotals(
  rows: FinanceRow[],
): Map<string, { income: number; expense: number; net: number; count: number }> {
  const map = new Map<string, { income: number; expense: number; net: number; count: number }>();
  for (const row of rows) {
    const entry = map.get(row.companyId) ?? { income: 0, expense: 0, net: 0, count: 0 };
    if (row.kind === 'income') entry.income += row.amount;
    else entry.expense += row.amount;
    entry.net = entry.income - entry.expense;
    entry.count += 1;
    map.set(row.companyId, entry);
  }
  return map;
}

export interface ProfitLoss extends FinanceTotals {
  margin: number;
  manualIncome: number;
  invoiceIncome: number;
  paymentIncome: number;
  manualExpense: number;
  salaryCost: number;
}

export function profitLoss(rows: FinanceRow[]): ProfitLoss {
  const totals = totalsOf(rows);
  let manualIncome = 0;
  let invoiceIncome = 0;
  let paymentIncome = 0;
  let manualExpense = 0;
  let salaryCost = 0;
  for (const row of rows) {
    if (row.kind === 'income') {
      if (row.source === 'invoice') invoiceIncome += row.amount;
      else if (row.source === 'payment') paymentIncome += row.amount;
      else manualIncome += row.amount;
    } else if (row.source === 'salary') {
      salaryCost += row.amount;
    } else {
      manualExpense += row.amount;
    }
  }
  return {
    ...totals,
    margin: totals.income > 0 ? Math.round((totals.net / totals.income) * 1000) / 10 : 0,
    manualIncome: Math.round(manualIncome * 100) / 100,
    invoiceIncome: Math.round(invoiceIncome * 100) / 100,
    paymentIncome: Math.round(paymentIncome * 100) / 100,
    manualExpense: Math.round(manualExpense * 100) / 100,
    salaryCost: Math.round(salaryCost * 100) / 100,
  };
}

export function monthlyEquivalent(subscription: Pick<Subscription, 'amount' | 'cycle'>): number {
  return subscription.cycle === 'yearly' ? subscription.amount / 12 : subscription.amount;
}

export function yearlyEquivalent(subscription: Pick<Subscription, 'amount' | 'cycle'>): number {
  return subscription.cycle === 'yearly' ? subscription.amount : subscription.amount * 12;
}

export function subscriptionSummary(subscriptions: Subscription[]): {
  monthly: number;
  yearly: number;
  activeCount: number;
  upcomingCount: number;
  pausedCount: number;
} {
  const today = todayISO();
  const limit = dateFromTimestamp(Date.now() + 30 * 86400000);
  let monthly = 0;
  let activeCount = 0;
  let upcomingCount = 0;
  let pausedCount = 0;
  for (const subscription of subscriptions) {
    if (subscription.status === 'paused') pausedCount += 1;
    if (subscription.status !== 'active') continue;
    activeCount += 1;
    monthly += monthlyEquivalent(subscription);
    if (subscription.nextRenewal >= today && subscription.nextRenewal <= limit) {
      upcomingCount += 1;
    }
  }
  monthly = Math.round(monthly * 100) / 100;
  return {
    monthly,
    yearly: Math.round(monthly * 12 * 100) / 100,
    activeCount,
    upcomingCount,
    pausedCount,
  };
}

export function salarySummary(
  salaries: SalaryPayment[],
  period: string,
): { planned: number; paid: number; pending: number; plannedCount: number; paidCount: number } {
  let planned = 0;
  let paid = 0;
  let plannedCount = 0;
  let paidCount = 0;
  for (const salary of salaries) {
    if (salary.period !== period) continue;
    if (salary.status === 'paid') {
      paid += salary.amount;
      paidCount += 1;
    } else {
      planned += salary.amount;
      plannedCount += 1;
    }
  }
  return {
    planned: Math.round(planned * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    pending: Math.round(planned * 100) / 100,
    plannedCount,
    paidCount,
  };
}
