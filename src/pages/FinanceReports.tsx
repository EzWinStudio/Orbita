import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ReceiptText, Repeat, TrendingUp, Users, Wallet } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { MonthlyBars, type MonthFinances } from '../components/MonthlyBars';
import { useAppData } from '../store';
import { useI18n } from '../i18n';
import type { Currency, CustomerPayment, Invoice, SalaryPayment, Subscription } from '../types';
import {
  currentMonthKey,
  formatMoney,
  lastMonths,
  monthLabel,
  shiftMonthKey,
} from '../lib/format';
import {
  companyTotals,
  openInvoiceSummary,
  profitLoss,
  rowsInMonth,
  rowsInYear,
  salarySummary,
  subscriptionSummary,
  totalsOf,
  type FinanceRow,
} from '../lib/finance';

interface FinanceReportsProps {
  rows: FinanceRow[];
  invoices: Invoice[];
  payments: CustomerPayment[];
  subscriptions: Subscription[];
  salaries: SalaryPayment[];
  currency: Currency;
}

type ReportMode = 'monthly' | 'yearly';

export function FinanceReports({
  rows,
  invoices,
  payments,
  subscriptions,
  salaries,
  currency,
}: FinanceReportsProps) {
  const data = useAppData();
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<ReportMode>('yearly');
  const [month, setMonth] = useState(currentMonthKey());
  const [year, setYear] = useState(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const row of rows) {
      const value = Number(row.date.slice(0, 4));
      if (Number.isFinite(value) && value > 1970) years.add(value);
    }
    return [...years].sort((a, b) => b - a);
  }, [rows]);

  const periodRows = useMemo(
    () => (mode === 'monthly' ? rowsInMonth(rows, month) : rowsInYear(rows, year)),
    [rows, mode, month, year],
  );
  const pl = profitLoss(periodRows);
  const totals = totalsOf(periodRows);

  const series = useMemo<MonthFinances[]>(() => {
    const keys =
      mode === 'yearly'
        ? Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
        : lastMonths(6, month);
    return keys.map((key) => {
      const monthRows = rowsInMonth(rows, key);
      const monthTotals = totalsOf(monthRows);
      return {
        key,
        label: monthLabel(key, 'short').toLocaleUpperCase(locale),
        income: monthTotals.income,
        expense: monthTotals.expense,
      };
    });
  }, [rows, mode, year, month, locale]);

  const companyRows = useMemo(() => {
    const totalsMap = companyTotals(periodRows);
    return data.companies
      .map((company) => ({
        company,
        ...(totalsMap.get(company.id) ?? { income: 0, expense: 0, net: 0, count: 0 }),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.net - a.net);
  }, [data.companies, periodRows]);

  const invoiceSummary = useMemo(
    () => openInvoiceSummary(invoices, payments),
    [invoices, payments],
  );
  const subs = useMemo(() => subscriptionSummary(subscriptions), [subscriptions]);
  const salary = useMemo(() => salarySummary(salaries, currentMonthKey()), [salaries]);

  const periodLabel = mode === 'monthly' ? monthLabel(month) : String(year);
  const maxCompanyNet = Math.max(1, ...companyRows.map((row) => Math.abs(row.net)));

  return (
    <>
      <div className="report-toolbar">
        <div className="segmented" role="tablist" aria-label={t('Rapor dönemi')}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'monthly'}
            className={`segment ${mode === 'monthly' ? 'active' : ''}`}
            onClick={() => setMode('monthly')}
          >
            {t('Aylık rapor')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'yearly'}
            className={`segment ${mode === 'yearly' ? 'active' : ''}`}
            onClick={() => setMode('yearly')}
          >
            {t('Yıllık rapor')}
          </button>
        </div>
        {mode === 'monthly' ? (
          <div className="month-nav">
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
              disabled={month >= currentMonthKey()}
              aria-label={t('Sonraki ay')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <select
            className="input select select-compact"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label={t('Rapor yılı')}
          >
            {availableYears.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="kpi-grid report-kpi-grid">
        <KpiCard
          label={t('Gelir')}
          value={formatMoney(pl.income, currency)}
          hint={t('{count} hareket', { count: totals.count })}
          icon={<TrendingUp size={16} />}
          tone={pl.income > 0 ? 'mint' : 'default'}
        />
        <KpiCard
          label={t('Gider')}
          value={formatMoney(pl.expense, currency)}
          hint={t('{count} gider kalemi', {
            count: periodRows.filter((row) => row.kind === 'expense').length,
          })}
          icon={<Wallet size={16} />}
          tone={pl.expense > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label={t('Net kâr')}
          value={formatMoney(pl.net, currency)}
          hint={pl.net >= 0 ? t('Dönem pozitif kapanıyor') : t('Dönem zararla kapanıyor')}
          icon={<Wallet size={16} />}
          tone={pl.net >= 0 ? 'mint' : 'danger'}
        />
        <KpiCard
          label={t('Kâr marjı')}
          value={`${pl.margin}%`}
          hint={t('{period} · net / gelir', { period: periodLabel })}
          icon={<TrendingUp size={16} />}
          tone={pl.margin >= 0 ? 'default' : 'danger'}
        />
      </div>

      <div className="dash-grid">
        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{mode === 'yearly' ? t('Aylık dağılım') : t('Son altı ay')}</h2>
              <p>
                {mode === 'yearly'
                  ? t('{year} yılı gelir ve giderleri.', { year })
                  : t('{month} sonuna kadar gelir ve gider.', { month: monthLabel(month) })}
              </p>
            </div>
          </div>
          <MonthlyBars months={series} currency={currency} />
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Kâr ve zarar')}</h2>
              <p>{t('{period} · nakit akışı', { period: periodLabel })}</p>
            </div>
          </div>
          <div className="pl-list">
            <div className="pl-row">
              <span>{t('Gelir')}</span>
              <strong className="text-income">{formatMoney(pl.income, currency)}</strong>
            </div>
            <div className="pl-sub">
              <span>{t('Manuel gelir')}</span>
              <span>{formatMoney(pl.manualIncome, currency)}</span>
            </div>
            <div className="pl-sub">
              <span>{t('Fatura geliri')}</span>
              <span>{formatMoney(pl.invoiceIncome, currency)}</span>
            </div>
            <div className="pl-sub">
              <span>{t('Ödeme geliri')}</span>
              <span>{formatMoney(pl.paymentIncome, currency)}</span>
            </div>
            <div className="pl-row">
              <span>{t('Gider')}</span>
              <strong className="text-danger">{formatMoney(pl.expense, currency)}</strong>
            </div>
            <div className="pl-sub">
              <span>{t('İşletme gideri')}</span>
              <span>{formatMoney(pl.manualExpense, currency)}</span>
            </div>
            <div className="pl-sub">
              <span>{t('Maaş gideri')}</span>
              <span>{formatMoney(pl.salaryCost, currency)}</span>
            </div>
            <div className={`pl-total ${pl.net < 0 ? 'is-negative' : ''}`}>
              <span>{t('Net sonuç')}</span>
              <strong>{formatMoney(pl.net, currency)}</strong>
            </div>
          </div>
        </section>

        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Dönem tablosu')}</h2>
              <p>{t('{period} · aylık gelir, gider ve net.', { period: periodLabel })}</p>
            </div>
          </div>
          <div className="report-table">
            <div className="report-table-head">
              <span>{t('Ay')}</span>
              <span className="align-right">{t('Gelir')}</span>
              <span className="align-right">{t('Gider')}</span>
              <span className="align-right">{t('Net')}</span>
              <span className="align-right">{t('Marj')}</span>
              <span className="align-right">{t('Kayıt')}</span>
            </div>
            {series.map((item) => {
              const monthRows = rowsInMonth(rows, item.key);
              const monthTotals = totalsOf(monthRows);
              const margin =
                monthTotals.income > 0
                  ? Math.round((monthTotals.net / monthTotals.income) * 1000) / 10
                  : 0;
              return (
                <div className="report-table-row" key={item.key}>
                  <span>{monthLabel(item.key)}</span>
                  <span className="align-right text-income">{formatMoney(monthTotals.income, currency)}</span>
                  <span className="align-right text-danger">{formatMoney(monthTotals.expense, currency)}</span>
                  <span className={`align-right ${monthTotals.net < 0 ? 'text-danger' : ''}`}>
                    {formatMoney(monthTotals.net, currency)}
                  </span>
                  <span className="align-right cell-muted">{monthTotals.count ? `${margin}%` : '—'}</span>
                  <span className="align-right cell-muted">{monthTotals.count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Şirket kârlılığı')}</h2>
              <p>{t('{period} · net sıralı.', { period: periodLabel })}</p>
            </div>
          </div>
          {companyRows.length === 0 ? (
            <p className="report-empty">{t('Bu dönemde finans hareketi yok.')}</p>
          ) : (
            <div className="company-report">
              {companyRows.map((row) => (
                <div className="company-report-row" key={row.company.id}>
                  <div className="company-report-main">
                    <span className="company-report-name">{row.company.name}</span>
                    <span className="company-report-bar">
                      <span
                        style={{
                          width: `${Math.max(3, (Math.abs(row.net) / maxCompanyNet) * 100)}%`,
                          background: row.net >= 0 ? 'var(--mint)' : 'var(--danger)',
                        }}
                      />
                    </span>
                  </div>
                  <strong className={row.net < 0 ? 'text-danger' : ''}>
                    {formatMoney(row.net, currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card span-12">
          <div className="card-header">
            <div>
              <h2>{t('Taahhütler ve alacaklar')}</h2>
              <p>{t('Nakit akışı dışında izlenen kalemler.')}</p>
            </div>
          </div>
          <div className="commit-grid">
            <div className="commit-card">
              <span className="commit-icon"><ReceiptText size={15} /></span>
              <div>
                <span className="commit-label">{t('Açık alacak')}</span>
                <strong>{formatMoney(invoiceSummary.open, currency)}</strong>
                <small>
                  {t('{count} fatura · {overdue} gecikmiş', {
                    count: invoiceSummary.openCount,
                    overdue: invoiceSummary.overdueCount,
                  })}
                </small>
              </div>
            </div>
            <div className="commit-card">
              <span className="commit-icon"><Repeat size={15} /></span>
              <div>
                <span className="commit-label">{t('Aylık abonelik taahhüdü')}</span>
                <strong>{formatMoney(subs.monthly, currency)}</strong>
                <small>
                  {t('{count} aktif · yıllık {amount}', {
                    count: subs.activeCount,
                    amount: formatMoney(subs.yearly, currency),
                  })}
                </small>
              </div>
            </div>
            <div className="commit-card">
              <span className="commit-icon"><Users size={15} /></span>
              <div>
                <span className="commit-label">{t('Planlanan maaş')}</span>
                <strong>{formatMoney(salary.pending, currency)}</strong>
                <small>
                  {t('{count} kayıt · bu ay ödenen {amount}', {
                    count: salary.plannedCount,
                    amount: formatMoney(salary.paid, currency),
                  })}
                </small>
              </div>
            </div>
            <div className="commit-card">
              <span className="commit-icon"><Wallet size={15} /></span>
              <div>
                <span className="commit-label">{t('Gecikmiş alacak')}</span>
                <strong className={invoiceSummary.overdue > 0 ? 'text-danger' : ''}>
                  {formatMoney(invoiceSummary.overdue, currency)}
                </strong>
                <small>
                  {t('{count} fatura vadesi geçti', { count: invoiceSummary.overdueCount })}
                </small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
