import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Building2, Link2, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { WebNotice } from '../web/WebNotice';
import { IS_TRAY, IS_WEB } from '../lib/runtime';
import { StatusPill } from '../components/StatusPill';
import { CompanyAvatar } from '../components/CompanyAvatar';
import { EmptyState } from '../components/EmptyState';
import { CompanyModal } from '../modals/CompanyModal';
import { useAppData } from '../store';
import { useI18n } from '../i18n';
import {
  COMPANY_CATEGORIES,
  COMPANY_CATEGORY_LABEL,
  COMPANY_HEALTH_LABEL,
  COMPANY_HEALTH_STATE,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABEL,
} from '../constants';
import type { Company, CompanyCategory, CompanyStatus } from '../types';
import type { NavIntent, Page } from '../nav';
import { currentMonthKey, formatMoney, formatNumber, todayISO } from '../lib/format';
import { companyHealth } from '../lib/status';

interface CompaniesProps {
  navigate: (page: Page, companyId?: string | null) => void;
  intent: NavIntent | null;
  onIntentHandled: () => void;
}

export function Companies({ navigate, intent, onIntentHandled }: CompaniesProps) {
  const data = useAppData();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CompanyStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CompanyCategory>('all');

  useEffect(() => {
    if (intent?.kind === 'company') {
      setEditing(null);
      setModalOpen(true);
      onIntentHandled();
    }
  }, [intent, onIntentHandled]);

  const monthKey = currentMonthKey();
  const today = todayISO();
  const currency = data.settings.currency;

  const statsByCompany = useMemo(() => {
    const map = new Map<
      string,
      {
        services: number;
        monitored: number;
        online: number;
        openTasks: number;
        overdue: number;
        net: number;
        entries: number;
        targetPct: number | null;
      }
    >();
    for (const company of data.companies) {
      const assets = data.assets.filter((asset) => asset.companyId === company.id);
      const monitored = assets.filter((asset) => asset.type === 'website' || asset.hasSecret);
      const tasks = data.tasks.filter((task) => task.companyId === company.id && !task.done);
      const monthEntries = data.finance.filter(
        (entry) => entry.companyId === company.id && entry.date.startsWith(monthKey),
      );
      const income = monthEntries
        .filter((entry) => entry.kind === 'income')
        .reduce((sum, entry) => sum + entry.amount, 0);
      const expense = monthEntries
        .filter((entry) => entry.kind === 'expense')
        .reduce((sum, entry) => sum + entry.amount, 0);
      const net = income - expense;
      map.set(company.id, {
        services: assets.length,
        monitored: monitored.length,
        online: monitored.filter((asset) => data.statuses[asset.id]?.state === 'online').length,
        openTasks: tasks.length,
        overdue: tasks.filter((task) => task.due && task.due < today).length,
        net,
        entries: monthEntries.length,
        targetPct: company.monthlyTarget
          ? Math.max(0, Math.round((net / company.monthlyTarget) * 100))
          : null,
      });
    }
    return map;
  }, [data, monthKey, today]);

  const statusCounts = useMemo(() => {
    const counts: Record<CompanyStatus, number> = { active: 0, maintenance: 0, paused: 0 };
    for (const company of data.companies) counts[company.status] += 1;
    return counts;
  }, [data.companies]);

  const filteredCompanies = useMemo(
    () =>
      data.companies.filter(
        (company) =>
          (statusFilter === 'all' || company.status === statusFilter) &&
          (categoryFilter === 'all' || company.category === categoryFilter),
      ),
    [data.companies, statusFilter, categoryFilter],
  );

  const totalOpenTasks = data.tasks.filter((task) => !task.done).length;

  return (
    <>
      <PageHeader
        eyebrow={t('Portföy')}
        title={t('Şirketler')}
        subtitle={t('{companies} şirket · {services} servis · {tasks} açık görev', {
          companies: data.companies.length,
          services: data.assets.length,
          tasks: totalOpenTasks,
        })}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={15} /> {t('Şirket ekle')}
          </button>
        }
      />

      {IS_WEB && data.assets.length > 0 ? <WebNotice /> : null}

      {data.companies.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 size={20} />}
            title={t('Portföyünü oluştur')}
            description={t('Her şirket kendi servisleri, finans kayıtları, görevleri ve hızlı erişim bağlantılarıyla ayrı bir kontrol alanına sahip olur.')}
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus size={15} /> {t('İlk şirketini ekle')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="filter-bar company-filter-bar">
            <div className="filter-chips" role="group" aria-label={t('Şirket durumu')}>
              <button
                type="button"
                className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
              >
                {t('Tümü')} <span className="chip-count">{data.companies.length}</span>
              </button>
              {COMPANY_STATUSES.map((status) => (
                <button
                  type="button"
                  key={status}
                  className={`chip ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={statusFilter === status}
                >
                  {t(COMPANY_STATUS_LABEL[status])}{' '}
                  <span className="chip-count">{statusCounts[status]}</span>
                </button>
              ))}
            </div>

            <select
              className="input select select-compact"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'all' | CompanyCategory)}
              aria-label={t('Kategoriye göre filtrele')}
            >
              <option value="all">{t('Tüm kategoriler')}</option>
              {COMPANY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(COMPANY_CATEGORY_LABEL[category])}
                </option>
              ))}
            </select>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Building2 size={20} />}
                title={t('Eşleşen şirket yok')}
                description={t('Durum veya kategori filtresini değiştirerek portföyünün tamamını görebilirsin.')}
                action={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                  >
                    {t('Filtreyi temizle')}
                  </button>
                }
              />
            </div>
          ) : (
            <div className="company-grid">
              {filteredCompanies.map((company) => {
                const stats = statsByCompany.get(company.id);
                const health = companyHealth(
                  data.assets.filter((asset) => asset.companyId === company.id),
                  data.statuses,
                );
                return (
                  <article
                    key={company.id}
                    className="company-card"
                    style={{ ['--company' as string]: company.color }}
                    role="button"
                    tabIndex={0}
                    data-company-open
                    onClick={() => navigate('company', company.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate('company', company.id);
                      }
                    }}
                  >
                    <div className="company-card-glow" />
                    <div className="company-card-top">
                      <CompanyAvatar company={company} size="lg" />
                      <div className="company-card-top-right">
                        <StatusPill
                          state={COMPANY_HEALTH_STATE[health.state]}
                          label={t(COMPANY_HEALTH_LABEL[health.state])}
                        />
                        {company.status !== 'active' ? (
                          <span className={`company-status status-${company.status}`}>
                            {t(COMPANY_STATUS_LABEL[company.status])}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="icon-btn company-edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(company);
                            setModalOpen(true);
                          }}
                          aria-label={t('{name} şirketini düzenle', { name: company.name })}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="company-card-title">
                      <span className="company-category">{t(COMPANY_CATEGORY_LABEL[company.category])}</span>
                      <h2>{company.name}</h2>
                      <p>{company.description || t('Açıklama eklenmedi.')}</p>
                    </div>

                    <div className="company-metrics">
                      <div>
                        <strong>{stats?.services ?? 0}</strong>
                        <span>{t('servis')}</span>
                      </div>
                      <div>
                        <strong className={stats?.overdue ? 'text-warning' : ''}>{stats?.openTasks ?? 0}</strong>
                        <span>{t('açık görev')}</span>
                      </div>
                      <div>
                        <strong className={(stats?.net ?? 0) < 0 ? 'text-danger' : ''}>
                          {stats?.entries ? formatMoney(stats.net, currency) : '—'}
                        </strong>
                        <span>{t('bu ay net')}</span>
                      </div>
                    </div>

                    {stats?.targetPct !== null && stats?.targetPct !== undefined ? (
                      <div className="company-target">
                        <div className="company-target-head">
                          <span>{t('Aylık hedef')}</span>
                          <span>%{stats.targetPct}</span>
                        </div>
                        <div className="company-target-track">
                          <span style={{ width: `${Math.min(100, Math.max(0, stats.targetPct))}%` }} />
                        </div>
                      </div>
                    ) : null}

                    <div className="company-card-footer">
                      <span className="company-footer-meta">
                        <Link2 size={13} /> {t('{count} bağlantı', { count: company.links.length })}
                        <span className="meta-sep">·</span>
                        <span className={`company-health ${stats && stats.monitored > 0 && stats.online === 0 ? 'is-dim' : ''}`}>
                          {IS_WEB && !IS_TRAY
                            ? stats?.services
                              ? t('Yerel envanter')
                              : t('Servis yok')
                            : health.monitored > 0
                              ? t('{online}/{monitored} doğrulandı', {
                                  online: formatNumber(health.online),
                                  monitored: health.monitored,
                                })
                              : IS_TRAY && stats?.services
                                ? t('Yerel envanter')
                                : t('Servis yok')}
                        </span>
                      </span>
                      <span className="company-open">
                        <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <CompanyModal open={modalOpen} onClose={() => setModalOpen(false)} company={editing} />
    </>
  );
}
