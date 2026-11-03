import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Building2,
  Calculator,
  Languages,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  Wallet,
} from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { IS_TRAY } from '../lib/runtime';
import type { TranslationKey } from '../i18n/core';
import type { Page } from '../nav';
import { formatClock, formatLongDate } from '../lib/format';
import { useWebAuth } from './WebAuthGate';
import { AccountAvatar } from './AccountAvatar';
import {
  browserSavedAt,
  checkpointBrowserSave,
  onBrowserSave,
} from './browserApi';

interface WebSidebarProps {
  page: Page;
  companyId: string | null;
  navigate: (page: Page, companyId?: string | null) => void;
  open: boolean;
}

const NAV_ITEMS: { page: Page; label: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { page: 'services', label: 'Servisler', icon: Activity },
  { page: 'companies', label: 'Şirketler', icon: Building2 },
];

const WORK_ITEMS: { page: Page; label: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { page: 'finance', label: 'Finans', icon: Wallet },
  { page: 'tasks', label: 'Görev & Notlar', icon: ListChecks },
  { page: 'tools', label: 'Hesap & Kur', icon: Calculator },
  { page: 'translate', label: 'Çeviri', icon: Languages },
];

export function WebSidebar({ page, companyId, navigate, open }: WebSidebarProps) {
  const { data, meta } = useApp();
  const { t } = useI18n();
  const { account, isGuest, signOut } = useWebAuth();
  const [now, setNow] = useState(Date.now());
  const [savedAt, setSavedAt] = useState(() => browserSavedAt());
  const [savePulse, setSavePulse] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savePulseTimer = useRef(0);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const off = onBrowserSave((event) => {
      if (event.ok) setSavedAt(event.at);
      setSaveError(!event.ok);
      if (!event.ok) return;
      setSavePulse(true);
      window.clearTimeout(savePulseTimer.current);
      savePulseTimer.current = window.setTimeout(() => setSavePulse(false), 1100);
    });
    const first = window.setTimeout(checkpointBrowserSave, 700);
    const timer = window.setInterval(checkpointBrowserSave, 5 * 60 * 1000);
    return () => {
      off();
      window.clearTimeout(first);
      window.clearTimeout(savePulseTimer.current);
      window.clearInterval(timer);
    };
  }, []);

  if (!data) return null;

  const openTaskCount = data.tasks.filter((task) => !task.done).length;
  const offlineCount = Object.values(data.statuses).filter(
    (status) => status.state === 'offline',
  ).length;
  const isCompaniesActive = page === 'companies' || page === 'company';

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
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
        <div
          className={`sidebar-autosave ${savePulse ? 'is-pulse' : ''} ${saveError ? 'is-error' : ''}`}
          role="status"
          aria-live="polite"
          title={t('Değişiklikler bu cihaza otomatik kaydedilir.')}
        >
          <span className="sidebar-autosave-dot" aria-hidden="true" />
          <span className="sidebar-autosave-label">
            {saveError ? t('Kaydedilemedi') : t('Otomatik kayıt')}
          </span>
          {!saveError && savedAt > 0 ? (
            <span className="sidebar-autosave-time">
              {formatClock(
                savedAt,
                data.settings.clockFormat ?? '24h',
                data.settings.showSeconds ?? false,
              )}
            </span>
          ) : null}
        </div>
        <div className="sidebar-account">
          <AccountAvatar account={account} className="sidebar-account-avatar" />
          <span className="sidebar-account-text">
            <strong>{account.name}</strong>
            <small dir="ltr">{isGuest ? t('Hesap oluşturulmadı') : account.email}</small>
          </span>
          <button
            type="button"
            className="sidebar-account-logout"
            onClick={signOut}
            title={t('Çıkış yap')}
            aria-label={t('Çıkış yap')}
          >
            <LogOut size={15} />
          </button>
        </div>
        <button
          type="button"
          data-nav="settings"
          className={`nav-item ${page === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <Settings size={17} strokeWidth={1.8} />
          <span>{t('Ayarlar')}</span>
          <span className="nav-version">v{meta?.appVersion ?? '1.4.1'}</span>
        </button>
        <div className="clock-card">
          <div className="clock-card-top">
            <span className="live-dot is-static" />
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
            {IS_TRAY ? t('Yerel cihaz verisi') : t('Yerel tarayıcı verisi')}
          </span>
        </div>
      </div>
    </aside>
  );
}
