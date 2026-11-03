import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { MonthlyBars } from '../components/MonthlyBars';
import { EmptyState } from '../components/EmptyState';
import { CompanyChip } from '../components/CompanyChip';
import { RateStrip } from '../components/RateStrip';
import { EntryModal } from '../modals/EntryModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import type { NavIntent, Page } from '../nav';
import {
  currentMonthKey,
  formatDate,
  formatMoney,
  lastMonths,
  monthLabel,
  shiftMonthKey,
} from '../lib/format';

interface FinanceProps {
  navigate: (page: Page, companyId?: string | null) => void;
  intent: NavIntent | null;
  onIntentHandled: () => void;
}

export function Finance({ navigate, intent, onIntentHandled }: FinanceProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(currentMonthKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (intent?.kind === 'finance') {
      setModalOpen(true);
      onIntentHandled();
    }
  }, [intent, onIntentHandled]);

  const currency = data.settings.currency;
  const current = currentMonthKey();

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const entries = useMemo(
    () =>
      data.finance
        .filter((entry) => entry.date.startsWith(month))
        .sort((a, b) => {
          const diff = Date.parse(b.date) - Date.parse(a.date);
          return diff !== 0 ? diff : b.createdAt - a.createdAt;
        }),
    [data.finance, month],
  );

  const income = entries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const net = income - expense;

  const chartMonths = useMemo(
    () =>
      lastMonths(6, month).map((key) => ({
        key,
        label: monthLabel(key, 'short').toLocaleUpperCase(locale),
        income: data.finance
          .filter((entry) => entry.kind === 'income' && entry.date.startsWith(key))
          .reduce((sum, entry) => sum + entry.amount, 0),
        expense: data.finance
          .filter((entry) => entry.kind === 'expense' && entry.date.startsWith(key))
          .reduce((sum, entry) => sum + entry.amount, 0),
      })),
    [data.finance, month, locale],
  );

  const breakdown = useMemo(
    () =>
      data.companies
        .map((company) => {
          const companyEntries = entries.filter((entry) => entry.companyId === company.id);
          const companyIncome = companyEntries
            .filter((entry) => entry.kind === 'income')
            .reduce((sum, entry) => sum + entry.amount, 0);
          const companyExpense = companyEntries
            .filter((entry) => entry.kind === 'expense')
            .reduce((sum, entry) => sum + entry.amount, 0);
          return {
            company,
            income: companyIncome,
            expense: companyExpense,
            net: companyIncome - companyExpense,
            count: companyEntries.length,
          };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.net - a.net),
    [data.companies, entries],
  );

  const remove = async (entryId: string) => {
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

  const canAdd = data.companies.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={t('İşletme')}
        title={t('Finans')}
        subtitle={t('Gelir ve giderlerini şirket bazında takip et. Para birimi ayarlardan yönetilir.')}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            disabled={!canAdd}
          >
            <Plus size={15} /> {t('Kayıt ekle')}
          </button>
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
          <div className="month-bar">
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
                disabled={month >= current}
                aria-label={t('Sonraki ay')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {month !== current ? (
              <button type="button" className="text-link" onClick={() => setMonth(current)}>
                {t('Bu aya dön')}
              </button>
            ) : (
              <span className="month-badge">{t('içinde bulunulan ay')}</span>
            )}
          </div>

          <div className="kpi-grid">
            <KpiCard
              label={t('Gelir')}
              value={formatMoney(income, currency)}
              hint={t('{count} gelir kaydı', {
                count: entries.filter((entry) => entry.kind === 'income').length,
              })}
              icon={<ArrowDownLeft size={16} />}
              tone="mint"
            />
            <KpiCard
              label={t('Gider')}
              value={formatMoney(expense, currency)}
              hint={t('{count} gider kaydı', {
                count: entries.filter((entry) => entry.kind === 'expense').length,
              })}
              icon={<ArrowUpRight size={16} />}
              tone={expense > income ? 'danger' : 'default'}
            />
            <KpiCard
              label={t('Net')}
              value={entries.length ? formatMoney(net, currency) : '—'}
              hint={
                entries.length
                  ? net >= 0
                    ? t('Ay pozitif kapanıyor')
                    : t('Gider gelirden yüksek')
                  : t('Bu ay kayıt yok')
              }
              icon={<Wallet size={16} />}
              tone={entries.length ? (net >= 0 ? 'mint' : 'danger') : 'default'}
            />
            <KpiCard
              label={t('Kayıt sayısı')}
              value={entries.length}
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
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(true)}>
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
                  <h2>{t('Kayıtlar')}</h2>
                  <p>{t('{month} · {count} hareket.', { month: monthLabel(month), count: entries.length })}</p>
                </div>
                <button type="button" className="text-link" onClick={() => setModalOpen(true)}>
                  <Plus size={13} /> {t('Kayıt ekle')}
                </button>
              </div>
              {entries.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Wallet size={18} />}
                  title={t('Bu ay kayıt yok')}
                  description={t('İlk kaydı ekle; özetler ve grafik anında oluşsun.')}
                  action={
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(true)}>
                      {t('Kayıt ekle')}
                    </button>
                  }
                />
              ) : (
                <div className="finance-table">
                  <div className="finance-table-head">
                    <span>{t('Tarih')}</span>
                    <span>{t('Şirket')}</span>
                    <span>{t('Kategori')}</span>
                    <span>{t('Açıklama')}</span>
                    <span>{t('Tür')}</span>
                    <span className="align-right">{t('Tutar')}</span>
                    <span />
                  </div>
                  {entries.map((entry) => {
                    const company = companyById.get(entry.companyId);
                    return (
                      <div className="finance-table-row" key={entry.id}>
                        <span className="mono-cell">{formatDate(entry.date)}</span>
                        <span><CompanyChip company={company} /></span>
                        <span>{entry.category || t('Genel')}</span>
                        <span className="cell-muted">{entry.note || '—'}</span>
                        <span>
                          <span className={`kind-badge ${entry.kind}`}>
                            {entry.kind === 'income' ? t('Gelir') : t('Gider')}
                          </span>
                        </span>
                        <span className={`align-right amount-cell ${entry.kind}`}>
                          {entry.kind === 'income' ? '+' : '−'}
                          {formatMoney(entry.amount, currency)}
                        </span>
                        <span className="row-action">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => void remove(entry.id)}
                            disabled={deletingId === entry.id}
                            aria-label={t('Kaydı sil')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <EntryModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
