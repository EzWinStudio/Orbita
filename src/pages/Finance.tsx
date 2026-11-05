import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  Repeat,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { MonthlyBars } from '../components/MonthlyBars';
import { EmptyState } from '../components/EmptyState';
import { CompanyChip } from '../components/CompanyChip';
import { RateStrip } from '../components/RateStrip';
import { EntryModal } from '../modals/EntryModal';
import { SalaryModal } from '../modals/SalaryModal';
import { InvoiceModal } from '../modals/InvoiceModal';
import { PaymentModal } from '../modals/PaymentModal';
import { SubscriptionModal } from '../modals/SubscriptionModal';
import { FinanceReports } from './FinanceReports';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import type { NavIntent, Page } from '../nav';
import {
  INVOICE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  SUBSCRIPTION_KIND_LABEL,
  BILLING_CYCLE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
} from '../constants';
import {
  currentMonthKey,
  formatDate,
  formatMoney,
  lastMonths,
  monthLabel,
  shiftMonthKey,
} from '../lib/format';
import {
  buildFinanceRows,
  dateFromTimestamp,
  invoiceBalance,
  invoiceEffectiveStatus,
  invoiceTotal,
  openInvoiceSummary,
  rowsInMonth,
  salarySummary,
  subscriptionSummary,
  totalsOf,
  type FinanceRow,
  type FinanceSource,
} from '../lib/finance';
import type {
  CustomerPayment,
  Invoice,
  SalaryPayment,
  Subscription,
} from '../types';

interface FinanceProps {
  navigate: (page: Page, companyId?: string | null) => void;
  intent: NavIntent | null;
  onIntentHandled: () => void;
}

type FinanceTab = 'ledger' | 'salaries' | 'invoices' | 'payments' | 'subscriptions' | 'reports';
type InvoiceFilter = 'all' | 'open' | 'paid' | 'overdue';

const TABS: FinanceTab[] = [
  'ledger',
  'salaries',
  'invoices',
  'payments',
  'subscriptions',
  'reports',
];

export function Finance({ navigate, intent, onIntentHandled }: FinanceProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<FinanceTab>('ledger');
  const [month, setMonth] = useState(currentMonthKey());
  const [entryOpen, setEntryOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryPayment | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (intent?.kind === 'finance') {
      setTab('ledger');
      setEntryOpen(true);
      onIntentHandled();
    }
  }, [intent, onIntentHandled]);

  const currency = data.settings.currency;
  const current = currentMonthKey();

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const rows = useMemo(
    () =>
      buildFinanceRows({
        finance: data.finance,
        salaries: data.salaries,
        invoices: data.invoices,
        customerPayments: data.customerPayments,
      }),
    [data.finance, data.salaries, data.invoices, data.customerPayments],
  );

  const monthRows = useMemo(() => rowsInMonth(rows, month), [rows, month]);
  const monthTotals = totalsOf(monthRows);

  const chartMonths = useMemo(
    () =>
      lastMonths(6, month).map((key) => {
        const items = rowsInMonth(rows, key);
        const totals = totalsOf(items);
        return {
          key,
          label: monthLabel(key, 'short').toLocaleUpperCase(locale),
          income: totals.income,
          expense: totals.expense,
        };
      }),
    [rows, month, locale],
  );

  const breakdown = useMemo(
    () =>
      data.companies
        .map((company) => {
          const companyRows = monthRows.filter((row) => row.companyId === company.id);
          const companyIncome = companyRows
            .filter((row) => row.kind === 'income')
            .reduce((sum, row) => sum + row.amount, 0);
          const companyExpense = companyRows
            .filter((row) => row.kind === 'expense')
            .reduce((sum, row) => sum + row.amount, 0);
          return {
            company,
            income: companyIncome,
            expense: companyExpense,
            net: companyIncome - companyExpense,
            count: companyRows.length,
          };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.net - a.net),
    [data.companies, monthRows],
  );

  const monthSalaries = useMemo(
    () =>
      data.salaries
        .filter((salary) => salary.period === month)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'planned' ? -1 : 1;
          return a.employeeName.localeCompare(b.employeeName, locale);
        }),
    [data.salaries, month, locale],
  );
  const salaryTotals = salarySummary(data.salaries, month);
  const payrollTotal = salaryTotals.planned + salaryTotals.paid;
  const payrollEmployees = new Set(monthSalaries.map((salary) => salary.employeeId ?? salary.employeeName)).size;

  const invoiceSummary = useMemo(
    () => openInvoiceSummary(data.invoices, data.customerPayments),
    [data.invoices, data.customerPayments],
  );
  const invoices = useMemo(() => {
    const sorted = [...data.invoices].sort((a, b) => {
      if (a.issueDate !== b.issueDate) return b.issueDate.localeCompare(a.issueDate);
      return b.createdAt - a.createdAt;
    });
    if (invoiceFilter === 'all') return sorted;
    return sorted.filter((invoice) => {
      const status = invoiceEffectiveStatus(invoice, data.customerPayments);
      if (invoiceFilter === 'open') return status === 'sent' || status === 'overdue';
      if (invoiceFilter === 'paid') return status === 'paid';
      return status === 'overdue';
    });
  }, [data.invoices, data.customerPayments, invoiceFilter]);
  const invoicePaidCount = data.invoices.filter(
    (invoice) => invoiceEffectiveStatus(invoice, data.customerPayments) === 'paid',
  ).length;

  const monthPayments = useMemo(
    () =>
      data.customerPayments
        .filter((payment) => payment.date.startsWith(month))
        .sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.createdAt - a.createdAt;
        }),
    [data.customerPayments, month],
  );
  const receivedThisMonth = monthPayments
    .filter((payment) => payment.status === 'received')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingThisMonth = monthPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const unlinkedPayments = monthPayments.filter(
    (payment) => !payment.invoiceId && payment.status === 'received',
  ).length;

  const subscriptions = useMemo(
    () =>
      [...data.subscriptions].sort((a, b) => {
        if (a.status !== b.status) {
          const rank = (item: Subscription) =>
            item.status === 'active' ? 0 : item.status === 'paused' ? 1 : 2;
          return rank(a) - rank(b);
        }
        return a.nextRenewal.localeCompare(b.nextRenewal);
      }),
    [data.subscriptions],
  );
  const subs = subscriptionSummary(data.subscriptions);

  const sourceLabel: Record<FinanceSource, string> = {
    manual: t('Manuel'),
    salary: t('Maaş'),
    invoice: t('Fatura'),
    payment: t('Ödeme'),
  };

  const canAdd = data.companies.length > 0;

  const removeEntry = async (entryId: string) => {
    const entry = data.finance.find((item) => item.id === entryId);
    if (!entry) return;
    const sure = await confirm({
      title: t('Kayıt silinsin mi?'),
      message: t('{date} tarihli {amount} tutarındaki kayıt silinecek.', {
        date: formatDate(entry.date),
        amount: formatMoney(entry.amount, currency),
      }),
      confirmLabel: t('Kaydı sil'),
    });
    if (!sure) return;
    setDeletingId(entryId);
    await actions.deleteFinance(entryId);
    setDeletingId(null);
  };

  const editLedgerRow = (row: FinanceRow) => {
    if (row.source === 'manual') return;
    const id = row.id.slice(row.source.length + 1);
    if (row.source === 'salary') {
      const salary = data.salaries.find((item) => item.id === id);
      if (salary) {
        setEditingSalary(salary);
        setSalaryOpen(true);
      }
    } else if (row.source === 'invoice') {
      const invoice = data.invoices.find((item) => item.id === id);
      if (invoice) {
        setEditingInvoice(invoice);
        setInvoiceOpen(true);
      }
    } else if (row.source === 'payment') {
      const payment = data.customerPayments.find((item) => item.id === id);
      if (payment) {
        setEditingPayment(payment);
        setPaymentOpen(true);
      }
    }
  };

  const openAdd = () => {
    if (tab === 'ledger') setEntryOpen(true);
    else if (tab === 'salaries') {
      setEditingSalary(null);
      setSalaryOpen(true);
    } else if (tab === 'invoices') {
      setEditingInvoice(null);
      setInvoiceOpen(true);
    } else if (tab === 'payments') {
      setEditingPayment(null);
      setPaymentInvoiceId(null);
      setPaymentOpen(true);
    } else if (tab === 'subscriptions') {
      setEditingSubscription(null);
      setSubscriptionOpen(true);
    }
  };

  const addLabel =
    tab === 'salaries'
      ? t('Maaş ekle')
      : tab === 'invoices'
        ? t('Fatura oluştur')
        : tab === 'payments'
          ? t('Ödeme ekle')
          : tab === 'subscriptions'
            ? t('Abonelik ekle')
            : t('Kayıt ekle');

  const tabCount = (item: FinanceTab): number | null => {
    if (item === 'ledger') return monthTotals.count;
    if (item === 'salaries') return monthSalaries.length;
    if (item === 'invoices') return invoiceSummary.openCount;
    if (item === 'payments') return monthPayments.length;
    if (item === 'subscriptions') return subs.activeCount;
    return null;
  };

  const markSalaryPaid = async (salary: SalaryPayment) => {
    await actions.updateSalary({ id: salary.id, status: 'paid' });
  };

  const invoiceStatusClass = (invoice: Invoice) => {
    const status = invoiceEffectiveStatus(invoice, data.customerPayments);
    return `invoice-status invoice-status-${status}`;
  };

  const invoiceLabel = (invoice: Invoice) =>
    t(INVOICE_STATUS_LABEL[invoiceEffectiveStatus(invoice, data.customerPayments)]);

  return (
    <>
      <PageHeader
        eyebrow={t('İşletme')}
        title={t('Finans')}
        subtitle={t('Gelir, gider, maaş, fatura, ödeme ve abonelikleri tek yerden yönet. Para birimi ayarlardan yönetilir.')}
        actions={
          tab === 'reports' ? undefined : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openAdd}
              disabled={!canAdd}
            >
              <Plus size={15} /> {addLabel}
            </button>
          )
        }
      />

      <RateStrip />

      {!canAdd ? (
        <div className="card">
          <EmptyState
            icon={<Wallet size={20} />}
            title={t('Önce bir şirket oluştur')}
            description={t('Finans kayıtları bir şirkete bağlanır. Şirket oluşturduktan sonra gelir ve giderleri buradan işleyebilirsin.')}
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
                {t('Şirketler’e git')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="ops-toolbar finance-toolbar">
            <div className="segmented ops-tabs" role="tablist" aria-label={t('Finans görünümü')}>
              {TABS.map((item) => {
                const count = tabCount(item);
                return (
                  <button
                    type="button"
                    role="tab"
                    key={item}
                    aria-selected={tab === item}
                    className={`segment ${tab === item ? 'active' : ''}`}
                    onClick={() => setTab(item)}
                  >
                    {item === 'ledger'
                      ? t('Hareketler')
                      : item === 'salaries'
                        ? t('Maaşlar')
                        : item === 'invoices'
                          ? t('Faturalar')
                          : item === 'payments'
                            ? t('Ödemeler')
                            : item === 'subscriptions'
                              ? t('Abonelikler')
                              : t('Raporlar')}
                    {count !== null ? <span className="ops-tab-count">{count}</span> : null}
                  </button>
                );
              })}
            </div>

            {tab === 'ledger' || tab === 'salaries' || tab === 'payments' ? (
              <div className="month-nav finance-month-nav">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setMonth(shiftMonthKey(month, -1))}
                  aria-label={t('Önceki ay')}
                >
                  <ChevronLeft size={16} />
                </button>
                <h2>{monthLabel(month)}</h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setMonth(shiftMonthKey(month, 1))}
                  disabled={month >= current}
                  aria-label={t('Sonraki ay')}
                >
                  <ChevronRight size={16} />
                </button>
                {month !== current ? (
                  <button type="button" className="text-link" onClick={() => setMonth(current)}>
                    {t('Bu aya dön')}
                  </button>
                ) : (
                  <span className="month-badge">{t('içinde bulunulan ay')}</span>
                )}
              </div>
            ) : tab === 'invoices' ? (
              <select
                className="input select select-compact"
                value={invoiceFilter}
                onChange={(event) => setInvoiceFilter(event.target.value as InvoiceFilter)}
                aria-label={t('Fatura durumuna göre filtrele')}
              >
                <option value="all">{t('Tüm faturalar')}</option>
                <option value="open">{t('Açık faturalar')}</option>
                <option value="overdue">{t('Gecikenler')}</option>
                <option value="paid">{t('Ödenenler')}</option>
              </select>
            ) : null}
          </div>

          {tab === 'ledger' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Gelir')}
                  value={formatMoney(monthTotals.income, currency)}
                  hint={t('{count} gelir kaydı', {
                    count: monthRows.filter((row) => row.kind === 'income').length,
                  })}
                  icon={<ArrowDownLeft size={16} />}
                  tone="mint"
                />
                <KpiCard
                  label={t('Gider')}
                  value={formatMoney(monthTotals.expense, currency)}
                  hint={t('{count} gider kaydı', {
                    count: monthRows.filter((row) => row.kind === 'expense').length,
                  })}
                  icon={<ArrowUpRight size={16} />}
                  tone={monthTotals.expense > monthTotals.income ? 'danger' : 'default'}
                />
                <KpiCard
                  label={t('Net')}
                  value={monthRows.length ? formatMoney(monthTotals.net, currency) : '—'}
                  hint={
                    monthRows.length
                      ? monthTotals.net >= 0
                        ? t('Ay pozitif kapanıyor')
                        : t('Gider gelirden yüksek')
                      : t('Bu ay kayıt yok')
                  }
                  icon={<Wallet size={16} />}
                  tone={monthRows.length ? (monthTotals.net >= 0 ? 'mint' : 'danger') : 'default'}
                />
                <KpiCard
                  label={t('Kayıt sayısı')}
                  value={monthRows.length}
                  hint={monthLabel(month)}
                  icon={<Wallet size={16} />}
                />
              </div>

              <div className="dash-grid">
                <section className="card span-7">
                  <div className="card-header">
                    <div>
                      <h2>{t('Altı aylık görünüm')}</h2>
                      <p>{t('{month} sonuna kadar gelir ve gider.', { month: monthLabel(month) })}</p>
                    </div>
                  </div>
                  <MonthlyBars months={chartMonths} currency={currency} />
                </section>

                <section className="card span-5">
                  <div className="card-header">
                    <div>
                      <h2>{t('Şirket kırılımı')}</h2>
                      <p>{t('{month} · net sıralı.', { month: monthLabel(month) })}</p>
                    </div>
                  </div>
                  {breakdown.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Wallet size={18} />}
                      title={t('Kayıt yok')}
                      description={t('Bu ay için bir gelir veya gider eklediğinde şirket kırılımı burada görünür.')}
                      action={
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEntryOpen(true)}>
                          {t('Kayıt ekle')}
                        </button>
                      }
                    />
                  ) : (
                    <div className="breakdown-list">
                      {breakdown.map((row) => (
                        <div className="breakdown-row" key={row.company.id}>
                          <div className="breakdown-main">
                            <CompanyChip company={row.company} />
                            <span className="breakdown-count">{t('{count} kayıt', { count: row.count })}</span>
                          </div>
                          <div className="breakdown-values">
                            <span className="text-income">+{formatMoney(row.income, currency)}</span>
                            <span className="text-danger">−{formatMoney(row.expense, currency)}</span>
                            <strong className={row.net < 0 ? 'text-danger' : ''}>{formatMoney(row.net, currency)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="card span-12">
                  <div className="card-header">
                    <div>
                      <h2>{t('Hareketler')}</h2>
                      <p>{t('{month} · {count} hareket.', { month: monthLabel(month), count: monthRows.length })}</p>
                    </div>
                    <button type="button" className="text-link" onClick={() => setEntryOpen(true)}>
                      <Plus size={13} /> {t('Kayıt ekle')}
                    </button>
                  </div>
                  {monthRows.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Wallet size={18} />}
                      title={t('Bu ay kayıt yok')}
                      description={t('İlk kaydı ekle; özetler ve grafik anında oluşsun.')}
                      action={
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEntryOpen(true)}>
                          {t('Kayıt ekle')}
                        </button>
                      }
                    />
                  ) : (
                    <div className="finance-table">
                      <div className="finance-table-head">
                        <span>{t('Tarih')}</span>
                        <span>{t('Şirket')}</span>
                        <span>{t('Kaynak türü')}</span>
                        <span>{t('Açıklama')}</span>
                        <span>{t('Tür')}</span>
                        <span className="align-right">{t('Tutar')}</span>
                        <span />
                      </div>
                      {monthRows.map((row) => {
                        const company = companyById.get(row.companyId);
                        return (
                          <div className="finance-table-row" key={row.id}>
                            <span className="mono-cell">{formatDate(row.date)}</span>
                            <span><CompanyChip company={company} /></span>
                            <span>
                              <span className={`source-badge source-${row.source}`}>
                                {sourceLabel[row.source]}
                              </span>
                            </span>
                            <span className="cell-muted">{row.note || row.category || '—'}</span>
                            <span>
                              <span className={`kind-badge ${row.kind}`}>
                                {row.kind === 'income' ? t('Gelir') : t('Gider')}
                              </span>
                            </span>
                            <span className={`align-right amount-cell ${row.kind}`}>
                              {row.kind === 'income' ? '+' : '−'}
                              {formatMoney(row.amount, currency)}
                            </span>
                            <span className="row-action">
                              {row.source === 'manual' ? (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => {
                                    const id = row.id.replace('finance-', '');
                                    void removeEntry(id);
                                  }}
                                  disabled={deletingId === row.id.replace('finance-', '')}
                                  aria-label={t('Kaydı sil')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => editLedgerRow(row)}
                                  aria-label={t('Düzenle')}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}

          {tab === 'salaries' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Toplam bordro')}
                  value={formatMoney(payrollTotal, currency)}
                  hint={t('{month} · {count} kayıt', { month: monthLabel(month), count: monthSalaries.length })}
                  icon={<Users size={16} />}
                />
                <KpiCard
                  label={t('Ödenen maaş')}
                  value={formatMoney(salaryTotals.paid, currency)}
                  hint={t('{count} ödeme tamamlandı', { count: salaryTotals.paidCount })}
                  icon={<Wallet size={16} />}
                  tone={salaryTotals.paid > 0 ? 'danger' : 'default'}
                />
                <KpiCard
                  label={t('Planlanan maaş')}
                  value={formatMoney(salaryTotals.planned, currency)}
                  hint={t('{count} kayıt ödeme bekliyor', { count: salaryTotals.plannedCount })}
                  icon={<Wallet size={16} />}
                  tone={salaryTotals.planned > 0 ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Çalışan')}
                  value={payrollEmployees}
                  hint={t('{month} bordrosunda', { month: monthLabel(month) })}
                  icon={<Users size={16} />}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Maaşlar')}</h2>
                    <p>{t('{month} · ödenen maaşlar gider olarak raporlara yansır.', { month: monthLabel(month) })}</p>
                  </div>
                </div>
                {monthSalaries.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Users size={18} />}
                    title={t('Bu ay maaş kaydı yok')}
                    description={t('Çalışanın dönem maaşını ekle; ödendi olarak işaretlediğinde gider oluşur.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingSalary(null);
                          setSalaryOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Maaş ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="salary-table">
                    <div className="salary-table-head">
                      <span>{t('Çalışan')}</span>
                      <span>{t('Şirket')}</span>
                      <span>{t('Durum')}</span>
                      <span className="align-right">{t('Tutar')}</span>
                      <span>{t('Ödeme tarihi')}</span>
                      <span />
                    </div>
                    {monthSalaries.map((salary) => {
                      const company = companyById.get(salary.companyId);
                      return (
                        <div className="salary-row" key={salary.id}>
                          <span className="salary-employee">{salary.employeeName}</span>
                          <span><CompanyChip company={company} /></span>
                          <span>
                            <span className={`kind-badge salary-${salary.status}`}>
                              {salary.status === 'paid' ? t('Ödendi') : t('Planlandı')}
                            </span>
                          </span>
                          <span className="align-right amount-cell expense">−{formatMoney(salary.amount, currency)}</span>
                          <span className="mono-cell cell-muted">
                            {salary.paidAt ? formatDate(dateFromTimestamp(salary.paidAt)) : '—'}
                          </span>
                          <span className="row-action">
                            {salary.status === 'planned' ? (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => void markSalaryPaid(salary)}
                                aria-label={t('Ödendi olarak işaretle')}
                                title={t('Ödendi olarak işaretle')}
                              >
                                <Check size={14} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingSalary(salary);
                                setSalaryOpen(true);
                              }}
                              aria-label={t('Düzenle')}
                            >
                              <Pencil size={14} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'invoices' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Açık alacak')}
                  value={formatMoney(invoiceSummary.open, currency)}
                  hint={t('{count} fatura ödeme bekliyor', { count: invoiceSummary.openCount })}
                  icon={<ReceiptText size={16} />}
                  tone={invoiceSummary.openCount ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Gecikmiş alacak')}
                  value={formatMoney(invoiceSummary.overdue, currency)}
                  hint={t('{count} fatura vadesi geçti', { count: invoiceSummary.overdueCount })}
                  icon={<ReceiptText size={16} />}
                  tone={invoiceSummary.overdueCount ? 'danger' : 'default'}
                />
                <KpiCard
                  label={t('Toplam fatura')}
                  value={data.invoices.length}
                  hint={t('{count} fatura ödendi', { count: invoicePaidCount })}
                  icon={<ReceiptText size={16} />}
                />
                <KpiCard
                  label={t('Alınan ödeme')}
                  value={formatMoney(receivedThisMonth, currency)}
                  hint={monthLabel(month)}
                  icon={<CreditCard size={16} />}
                  tone={receivedThisMonth > 0 ? 'mint' : 'default'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Faturalar')}</h2>
                    <p>{t('{count} fatura · açık {open}', {
                      count: data.invoices.length,
                      open: formatMoney(invoiceSummary.open, currency),
                    })}</p>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setEditingInvoice(null);
                      setInvoiceOpen(true);
                    }}
                  >
                    <Plus size={13} /> {t('Fatura oluştur')}
                  </button>
                </div>
                {invoices.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ReceiptText size={18} />}
                    title={data.invoices.length ? t('Bu filtrede fatura yok') : t('Fatura yok')}
                    description={t('Müşteriye fatura kes; vade ve ödeme durumunu buradan izle.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingInvoice(null);
                          setInvoiceOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Fatura oluştur')}
                      </button>
                    }
                  />
                ) : (
                  <div className="invoice-table">
                    <div className="invoice-table-head">
                      <span>{t('Fatura')}</span>
                      <span>{t('Müşteri')}</span>
                      <span>{t('Vade')}</span>
                      <span className="align-right">{t('Toplam')}</span>
                      <span className="align-right">{t('Kalan')}</span>
                      <span>{t('Durum')}</span>
                      <span />
                    </div>
                    {invoices.map((invoice) => {
                      const company = companyById.get(invoice.companyId);
                      return (
                        <div className="invoice-row" key={invoice.id}>
                          <span className="invoice-number">{invoice.number}</span>
                          <span className="invoice-customer">
                            <strong>{invoice.customerName}</strong>
                            <CompanyChip company={company} />
                          </span>
                          <span className="mono-cell">{formatDate(invoice.dueDate)}</span>
                          <span className="align-right amount-cell">
                            {formatMoney(invoiceTotal(invoice), currency)}
                          </span>
                          <span className={`align-right amount-cell ${invoiceBalance(invoice, data.customerPayments) > 0 ? 'cell-muted' : 'income'}`}>
                            {formatMoney(invoiceBalance(invoice, data.customerPayments), currency)}
                          </span>
                          <span>
                            <span className={invoiceStatusClass(invoice)}>{invoiceLabel(invoice)}</span>
                          </span>
                          <span className="row-action">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingPayment(null);
                                setPaymentInvoiceId(invoice.id);
                                setPaymentOpen(true);
                              }}
                              aria-label={t('Ödeme kaydet')}
                              title={t('Ödeme kaydet')}
                            >
                              <CreditCard size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingInvoice(invoice);
                                setInvoiceOpen(true);
                              }}
                              aria-label={t('Düzenle')}
                            >
                              <Pencil size={14} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'payments' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Alınan ödeme')}
                  value={formatMoney(receivedThisMonth, currency)}
                  hint={monthLabel(month)}
                  icon={<ArrowDownLeft size={16} />}
                  tone="mint"
                />
                <KpiCard
                  label={t('Bekleyen ödeme')}
                  value={formatMoney(pendingThisMonth, currency)}
                  hint={t('{count} ödeme bekliyor', {
                    count: monthPayments.filter((payment) => payment.status === 'pending').length,
                  })}
                  icon={<CreditCard size={16} />}
                  tone={pendingThisMonth > 0 ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Ödeme kaydı')}
                  value={monthPayments.length}
                  hint={monthLabel(month)}
                  icon={<CreditCard size={16} />}
                />
                <KpiCard
                  label={t('Faturasız ödeme')}
                  value={unlinkedPayments}
                  hint={t('Fatura bağlantısı olmayan gelir')}
                  icon={<ReceiptText size={16} />}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Müşteri ödemeleri')}</h2>
                    <p>{t('{month} · alınan ödemeler gelir olarak işlenir.', { month: monthLabel(month) })}</p>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setEditingPayment(null);
                      setPaymentInvoiceId(null);
                      setPaymentOpen(true);
                    }}
                  >
                    <Plus size={13} /> {t('Ödeme ekle')}
                  </button>
                </div>
                {monthPayments.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<CreditCard size={18} />}
                    title={t('Bu ay ödeme yok')}
                    description={t('Müşteriden gelen ödemeyi kaydet; faturaya bağlayarak bakiyeyi kapat.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingPayment(null);
                          setPaymentInvoiceId(null);
                          setPaymentOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Ödeme ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="payment-table">
                    <div className="payment-table-head">
                      <span>{t('Tarih')}</span>
                      <span>{t('Müşteri')}</span>
                      <span>{t('Fatura')}</span>
                      <span>{t('Yöntem')}</span>
                      <span>{t('Durum')}</span>
                      <span className="align-right">{t('Tutar')}</span>
                      <span />
                    </div>
                    {monthPayments.map((payment) => {
                      const invoice = payment.invoiceId
                        ? data.invoices.find((item) => item.id === payment.invoiceId)
                        : null;
                      return (
                        <div className="payment-row" key={payment.id}>
                          <span className="mono-cell">{formatDate(payment.date)}</span>
                          <span>{payment.customerName}</span>
                          <span className="mono-cell cell-muted">{invoice?.number ?? '—'}</span>
                          <span>{t(PAYMENT_METHOD_LABEL[payment.method])}</span>
                          <span>
                            <span className={`kind-badge payment-${payment.status}`}>
                              {t(PAYMENT_STATUS_LABEL[payment.status])}
                            </span>
                          </span>
                          <span className={`align-right amount-cell ${payment.status === 'received' ? 'income' : ''}`}>
                            {payment.status === 'received' ? '+' : ''}
                            {formatMoney(payment.amount, currency)}
                          </span>
                          <span className="row-action">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingPayment(payment);
                                setPaymentInvoiceId(null);
                                setPaymentOpen(true);
                              }}
                              aria-label={t('Düzenle')}
                            >
                              <Pencil size={14} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'subscriptions' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Aktif abonelik')}
                  value={subs.activeCount}
                  hint={t('{count} duraklatıldı', { count: subs.pausedCount })}
                  icon={<Repeat size={16} />}
                  tone={subs.activeCount ? 'mint' : 'default'}
                />
                <KpiCard
                  label={t('Aylık taahhüt')}
                  value={formatMoney(subs.monthly, currency)}
                  hint={t('Aktif aboneliklerin aylık eşdeğeri')}
                  icon={<Repeat size={16} />}
                />
                <KpiCard
                  label={t('Yıllık taahhüt')}
                  value={formatMoney(subs.yearly, currency)}
                  hint={t('Aylık taahhüdün 12 katı')}
                  icon={<Repeat size={16} />}
                />
                <KpiCard
                  label={t('Yaklaşan yenileme')}
                  value={subs.upcomingCount}
                  hint={t('Önümüzdeki 30 gün')}
                  icon={<Repeat size={16} />}
                  tone={subs.upcomingCount ? 'amber' : 'default'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Abonelikler ve lisanslar')}</h2>
                    <p>{t('{count} kayıt · taahhütler nakit akışına dahil edilmez.', { count: data.subscriptions.length })}</p>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setEditingSubscription(null);
                      setSubscriptionOpen(true);
                    }}
                  >
                    <Plus size={13} /> {t('Abonelik ekle')}
                  </button>
                </div>
                {subscriptions.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Repeat size={18} />}
                    title={t('Abonelik yok')}
                    description={t('Yazılım aboneliklerini ve lisansları ekle; yenileme takvimini izle.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingSubscription(null);
                          setSubscriptionOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Abonelik ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="subscription-table">
                    <div className="subscription-table-head">
                      <span>{t('Ad')}</span>
                      <span>{t('Şirket')}</span>
                      <span>{t('Tür')}</span>
                      <span className="align-right">{t('Aylık eşdeğer')}</span>
                      <span>{t('Yenileme')}</span>
                      <span>{t('Durum')}</span>
                      <span />
                    </div>
                    {subscriptions.map((subscription) => {
                      const company = companyById.get(subscription.companyId);
                      return (
                        <div className="subscription-row" key={subscription.id}>
                          <span className="subscription-name">
                            <strong>{subscription.name}</strong>
                            {subscription.vendor ? <small>{subscription.vendor}</small> : null}
                          </span>
                          <span><CompanyChip company={company} /></span>
                          <span className="cell-muted">
                            {t(SUBSCRIPTION_KIND_LABEL[subscription.kind])} · {t(BILLING_CYCLE_LABEL[subscription.cycle])}
                          </span>
                          <span className="align-right amount-cell">
                            {formatMoney(
                              subscription.cycle === 'yearly' ? subscription.amount / 12 : subscription.amount,
                              currency,
                            )}
                          </span>
                          <span className="mono-cell">{formatDate(subscription.nextRenewal)}</span>
                          <span>
                            <span className={`kind-badge subscription-${subscription.status}`}>
                              {t(SUBSCRIPTION_STATUS_LABEL[subscription.status])}
                            </span>
                          </span>
                          <span className="row-action">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingSubscription(subscription);
                                setSubscriptionOpen(true);
                              }}
                              aria-label={t('Düzenle')}
                            >
                              <Pencil size={14} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'reports' ? (
            <FinanceReports
              rows={rows}
              invoices={data.invoices}
              payments={data.customerPayments}
              subscriptions={data.subscriptions}
              salaries={data.salaries}
              currency={currency}
            />
          ) : null}
        </>
      )}

      <EntryModal open={entryOpen} onClose={() => setEntryOpen(false)} />
      <SalaryModal
        open={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        salary={editingSalary}
        defaultPeriod={month}
      />
      <InvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        invoice={editingInvoice}
      />
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        payment={editingPayment}
        defaultInvoiceId={paymentInvoiceId}
      />
      <SubscriptionModal
        open={subscriptionOpen}
        onClose={() => setSubscriptionOpen(false)}
        subscription={editingSubscription}
      />
    </>
  );
}
