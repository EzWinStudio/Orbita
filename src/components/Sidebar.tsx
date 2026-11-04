import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Building2,
  Calculator,
  FolderKanban,
  Languages,
  LayoutDashboard,
  Link2,
  ListChecks,
  LockKeyhole,
  Mail,
  Music4,
  Plus,
  Settings,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Wordmark } from './Logo';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/core';
import type { Page } from '../nav';
import { formatClock, formatLongDate } from '../lib/format';

interface SidebarProps {
  page: Page;
  companyId: string | null;
  navigate: (page: Page, companyId?: string | null) => void;
}

const NAV_ITEMS: { page: Page; label: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { page: 'services', label: 'Servisler', icon: Activity },
  { page: 'companies', label: 'Şirketler', icon: Building2 },
];

const WORK_ITEMS: { page: Page; label: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { page: 'mail', label: 'Posta', icon: Mail },
  { page: 'finance', label: 'Finans', icon: Wallet },
  { page: 'operations', label: 'Operasyon', icon: FolderKanban },
  { page: 'tasks', label: 'Görev & Notlar', icon: ListChecks },
  { page: 'tools', label: 'Hesap & Kur', icon: Calculator },
];

const STUDIO_ITEMS: { page: Page; label: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { page: 'assistant', label: 'Asistan', icon: Bot },
  { page: 'connections', label: 'Bağlantılar', icon: Link2 },
  { page: 'music', label: 'Müzik', icon: Music4 },
  { page: 'translate', label: 'Çeviri', icon: Languages },
  { page: 'updates', label: 'Güncellemeler', icon: Sparkles },
];

export function Sidebar({ page, companyId, navigate }: SidebarProps) {
  const { data, meta, actions } = useApp();
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  if (!data) return null;

  const openTaskCount = data.tasks.filter((task) => !task.done).length;
  const pendingApprovalCount = data.approvals.filter((approval) => approval.status === 'pending').length;
  const offlineCount = Object.values(data.statuses).filter(
    (status) => status.state === 'offline',
  ).length;

  const isCompaniesActive = page === 'companies' || page === 'company';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Wordmark />
      </div>

      <div className="sidebar-scroll">
        <nav className="nav-block" aria-label={t('Ana gezinme')}>
          <span className="nav-heading">{t('Kontrol')}</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.page === 'companies' ? isCompaniesActive : page === item.page;
            return (
              <button
                type="button"
                key={item.page}
                data-nav={item.page}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.page)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{t(item.label)}</span>
                {item.page === 'services' && offlineCount > 0 ? (
                  <span
                    className="nav-badge nav-badge-danger"
                    title={t('{count} servis kapalı', { count: offlineCount })}
                  >
                    {offlineCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <nav className="nav-block" aria-label={t('İşletme')}>
          <span className="nav-heading">{t('İşletme')}</span>
          {WORK_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.page;
            return (
              <button
                type="button"
                key={item.page}
                data-nav={item.page}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.page)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{t(item.label)}</span>
                {item.page === 'tasks' && openTaskCount > 0 ? (
                  <span className="nav-badge" title={t('{count} açık görev', { count: openTaskCount })}>
                    {openTaskCount}
                  </span>
                ) : null}
                {item.page === 'operations' && pendingApprovalCount > 0 ? (
                  <span
                    className="nav-badge nav-badge-warning"
                    title={t('{count} bekleyen onay', { count: pendingApprovalCount })}
                  >
                    {pendingApprovalCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <nav className="nav-block" aria-label={t('Stüdyo')}>
          <span className="nav-heading">{t('Stüdyo')}</span>
          {STUDIO_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = page === item.page;
            const showBadge = item.page === 'updates' && data.settings.lastSeenVersion !== meta?.appVersion;
            return (
              <button
                type="button"
                key={item.page}
                data-nav={item.page}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.page)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{t(item.label)}</span>
                {showBadge ? <span className="nav-badge">1</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="nav-block">
          <div className="nav-heading nav-heading-row">
            <span>{t('Şirketler')}</span>
            <button
              type="button"
              className="nav-add"
              onClick={() => navigate('companies')}
              aria-label={t('Şirket ekle')}
            >
              <Plus size={13} />
            </button>
          </div>
          {data.companies.length === 0 ? (
            <p className="nav-empty">{t('Henüz şirket eklenmedi.')}</p>
          ) : (
            <div className="nav-companies">
              {data.companies.slice(0, 8).map((company) => {
                const active = page === 'company' && companyId === company.id;
                const services = data.assets.filter((asset) => asset.companyId === company.id).length;
                return (
                  <button
                    type="button"
                    key={company.id}
                    className={`nav-company ${active ? 'active' : ''}`}
                    onClick={() => navigate('company', company.id)}
                    title={company.name}
                  >
                    <span className="company-dot" style={{ background: company.color }} />
                    <span className="nav-company-name">{company.name}</span>
                    <span className="nav-company-count">{services}</span>
                  </button>
                );
              })}
              {data.companies.length > 8 ? (
                <button type="button" className="nav-more" onClick={() => navigate('companies')}>
                  {t('+{count} şirket daha', { count: data.companies.length - 8 })}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-bottom">
        <button
          type="button"
          data-nav="account"
          className={`nav-item ${page === 'account' ? 'active' : ''}`}
          onClick={() => navigate('account')}
          title={t('Hesap')}
        >
          <UserRound size={17} strokeWidth={1.8} />
          <span>{t('Hesap')}</span>
        </button>
        <button
          type="button"
          className="nav-item"
          onClick={() => void actions.lockApp()}
          title={t('Hesabı kilitle')}
        >
          <LockKeyhole size={17} strokeWidth={1.8} />
          <span>{t('Kilitle')}</span>
        </button>
        <button
          type="button"
          data-nav="settings"
          className={`nav-item ${page === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <Settings size={17} strokeWidth={1.8} />
          <span>{t('Ayarlar')}</span>
          <span className="nav-version">v{meta?.appVersion ?? '1.0'}</span>
        </button>
        <div className="clock-card">
          <div className="clock-card-top">
            <span className="live-dot" />
            <span className="clock-time">
              {formatClock(
                now,
                data.settings.clockFormat ?? '24h',
                data.settings.showSeconds ?? false,
              )}
            </span>
          </div>
          <span className="clock-date">{formatLongDate(now)}</span>
          <span className="clock-meta">
            {t('İzleme döngüsü · {seconds} sn', { seconds: data.settings.pollIntervalSec })}
          </span>
        </div>
      </div>
    </aside>
  );
}
