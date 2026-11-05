import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Bug,
  Building2,
  Cable,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  Globe2,
  ListChecks,
  Megaphone,
  MessageCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat,
  Server,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { WebNotice } from '../web/WebNotice';
import { IS_TRAY, IS_WEB } from '../lib/runtime';
import { MonthlyBars } from '../components/MonthlyBars';
import { WeeklyBars, type DayPerformance } from '../components/WeeklyBars';
import { StatusPill } from '../components/StatusPill';
import { LinkAvatar, ServiceAvatar } from '../components/BrandAvatar';
import { CompanyChip } from '../components/CompanyChip';
import { EmptyState } from '../components/EmptyState';
import { YoutubeIcon } from '../components/YoutubeIcon';
import { CompanyModal } from '../modals/CompanyModal';
import { TaskModal } from '../modals/TaskModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { serviceStateLabel, serviceSummary } from '../lib/status';
import { useBotHints } from '../web/botSecrets';
import { compactNumber } from '../lib/youtube';
import type { Page } from '../nav';
import type { Approval, Asset, ServiceState, Task } from '../types';
import { buildActivity, type ActivityKind } from '../lib/activity';
import { buildFinanceRows, rowsInMonth, totalsOf } from '../lib/finance';
import {
  currentMonthKey,
  formatMoney,
  formatLongDate,
  dueLabel,
  monthLabel,
  relativeTime,
  todayISO,
} from '../lib/format';

interface DashboardProps {
  navigate: (page: Page, companyId?: string | null) => void;
  onOpenPalette: () => void;
}

const SEVERITY: Record<ServiceState, number> = {
  offline: 0,
  degraded: 1,
  unchecked: 2,
  online: 3,
};

const PRIORITY_WEIGHT = { high: 3, med: 2, low: 1 } as const;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function activityIcon(kind: ActivityKind) {
  switch (kind) {
    case 'income':
      return ArrowDownLeft;
    case 'expense':
      return ArrowUpRight;
    case 'salary':
      return Wallet;
    case 'invoice':
      return ReceiptText;
    case 'payment':
      return ArrowDownLeft;
    case 'subscription':
      return Repeat;
    case 'announcement':
      return Megaphone;
    case 'meeting':
      return CalendarClock;
    case 'company':
      return Building2;
    case 'service':
      return Activity;
    case 'task':
      return ListChecks;
    case 'task_done':
      return CheckCircle2;
    case 'note':
      return FileText;
    case 'project':
    case 'project_done':
      return FolderKanban;
    case 'employee':
      return Users;
    case 'department':
      return Building2;
    case 'role':
      return ShieldCheck;
    case 'review':
      return Star;
    case 'approval':
      return ShieldCheck;
    case 'approval_approved':
      return CheckCircle2;
    case 'approval_rejected':
      return X;
    case 'client':
      return Users;
    case 'contract':
    case 'document':
      return FileText;
    case 'bug':
      return Bug;
    case 'automation':
      return Zap;
    case 'chat':
      return MessageCircle;
    case 'security':
      return ShieldCheck;
    default:
      return Activity;
  }
}

export function Dashboard({ navigate, onOpenPalette }: DashboardProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale } = useI18n();
  const botHints = useBotHints();
  const [refreshing, setRefreshing] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const currency = data.settings.currency;
  const monthKey = currentMonthKey();
  const today = todayISO();

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const statusOf = (asset: Asset): ServiceState => data.statuses[asset.id]?.state ?? 'unchecked';
  const lastCheckAt = Object.values(data.statuses).reduce(
    (latest, status) => Math.max(latest, status.checkedAt),
    0,
  );

  const monitoredAssets = data.assets.filter(
    (asset) =>
      asset.type === 'website' ||
      (asset.type === 'discord' && IS_TRAY ? Boolean(botHints[asset.id]) : asset.hasSecret),
  );
  const onlineCount = monitoredAssets.filter((asset) => statusOf(asset) === 'online').length;
  const degradedCount = monitoredAssets.filter((asset) => statusOf(asset) === 'degraded').length;
  const offlineCount = monitoredAssets.filter((asset) => statusOf(asset) === 'offline').length;
  const waitingCount = data.assets.filter(
    (asset) =>
      asset.type !== 'website' &&
      !(asset.type === 'discord' && IS_TRAY ? Boolean(botHints[asset.id]) : asset.hasSecret),
  ).length;
  const youtubeEvents = data.youtubeEvents.slice(0, 6);

  const financeRows = useMemo(
    () =>
      buildFinanceRows({
        finance: data.finance,
        salaries: data.salaries,
        invoices: data.invoices,
        customerPayments: data.customerPayments,
      }),
    [data.finance, data.salaries, data.invoices, data.customerPayments],
  );
  const monthRows = useMemo(() => rowsInMonth(financeRows, monthKey), [financeRows, monthKey]);
  const monthTotals = totalsOf(monthRows);
  const income = monthTotals.income;
  const expense = monthTotals.expense;
  const net = monthTotals.net;
  const allTotals = totalsOf(financeRows);

  const monthByCompany = useMemo(
    () =>
      data.companies
        .map((company) => {
          const rows = monthRows.filter((row) => row.companyId === company.id);
          const companyIncome = rows
            .filter((row) => row.kind === 'income')
            .reduce((sum, row) => sum + row.amount, 0);
          const companyExpense = rows
            .filter((row) => row.kind === 'expense')
            .reduce((sum, row) => sum + row.amount, 0);
          return { company, net: companyIncome - companyExpense, count: rows.length };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.net - a.net),
    [data.companies, monthRows],
  );

  const months = useMemo(() => {
    const keys: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const [year, month] = monthKey.split('-').map(Number);
      const date = new Date(year, month - 1 - i, 1);
      keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys.map((key) => {
      const rows = financeRows.filter((row) => row.date.startsWith(key));
      return {
        key,
        label: monthLabel(key, 'short').toLocaleUpperCase(locale),
        income: rows
          .filter((row) => row.kind === 'income')
          .reduce((sum, row) => sum + row.amount, 0),
        expense: rows
          .filter((row) => row.kind === 'expense')
          .reduce((sum, row) => sum + row.amount, 0),
      };
    });
  }, [financeRows, monthKey, locale]);

  const openTasks = useMemo(
    () =>
      [...data.tasks]
        .filter((task) => !task.done)
        .sort((a, b) => {
          const aDue = a.due ? Date.parse(a.due) : Number.MAX_SAFE_INTEGER;
          const bDue = b.due ? Date.parse(b.due) : Number.MAX_SAFE_INTEGER;
          if (aDue !== bDue) return aDue - bDue;
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }),
    [data.tasks],
  );
  const overdueCount = openTasks.filter((task) => task.due && task.due < today).length;

  const activeProjectCount = data.projects.filter((project) => project.status === 'active').length;
  const completedProjectCount = data.projects.filter(
    (project) => project.status === 'completed',
  ).length;
  const completedTaskCount = data.tasks.filter((task) => task.done).length;
  const totalIncome = allTotals.income;
  const totalExpense = allTotals.expense;
  const totalFinanceCount = allTotals.count;
  const activeEmployeeCount = data.employees.filter(
    (employee) => employee.status === 'active',
  ).length;

  const pendingApprovals = useMemo(
    () =>
      data.approvals
        .filter((approval) => approval.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt),
    [data.approvals],
  );

  const activities = useMemo(() => buildActivity(data, t, 8), [data, t]);

  const weekDays = useMemo<DayPerformance[]>(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const days: DayPerformance[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = dayKey(date);
      const rows = financeRows.filter((row) => row.date === key);
      days.push({
        key,
        label: formatter.format(date).toLocaleUpperCase(locale),
        income: rows
          .filter((row) => row.kind === 'income')
          .reduce((sum, row) => sum + row.amount, 0),
        expense: rows
          .filter((row) => row.kind === 'expense')
          .reduce((sum, row) => sum + row.amount, 0),
        tasks: data.tasks.filter(
          (task) => task.done && task.completedAt && dayKey(new Date(task.completedAt)) === key,
        ).length,
      });
    }
    return days;
  }, [financeRows, data.tasks, locale]);

  const weekIncome = weekDays.reduce((sum, day) => sum + day.income, 0);
  const weekExpense = weekDays.reduce((sum, day) => sum + day.expense, 0);
  const weekTaskCount = weekDays.reduce((sum, day) => sum + day.tasks, 0);

  const decideApproval = async (approval: Approval, status: 'approved' | 'rejected') => {
    if (decidingId) return;
    if (status === 'rejected') {
      const sure = await confirm({
        title: t('Talep reddedilsin mi?'),
        message: t('“{title}” talebi reddedilecek.', { title: approval.title }),
        confirmLabel: t('Talebi reddet'),
      });
      if (!sure) return;
    }
    setDecidingId(approval.id);
    await actions.decideApproval(approval.id, status);
    setDecidingId(null);
  };

  const listedAssets = IS_WEB ? data.assets : monitoredAssets;

  const sortedAssets = useMemo(
    () =>
      [...listedAssets].sort((a, b) => {
        const diff = SEVERITY[statusOf(a)] - SEVERITY[statusOf(b)];
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, locale);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listedAssets, data.statuses, locale],
  );

  const links = useMemo(
    () =>
      data.companies.flatMap((company) =>
        company.links.map((link) => ({ ...link, company })),
      ),
    [data.companies],
  );

  const lastChecked = Math.max(0, ...Object.values(data.statuses).map((status) => status.checkedAt));

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await actions.refreshMonitor();
    setRefreshing(false);
  };

  const toggleTask = async (task: Task) => {
    if (togglingId) return;
    setTogglingId(task.id);
    await actions.updateTask({ id: task.id, done: !task.done });
    setTogglingId(null);
  };

  if (data.companies.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow={t('Komuta merkezi')}
          title={t('Şirketlerini tek ekrandan yönet')}
          subtitle={`${formatLongDate(Date.now())} · ${t('Kurulum üç adımda tamamlanır.')}`}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setCompanyModalOpen(true)}>
              <Plus size={15} /> {t('İlk şirketini ekle')}
            </button>
          }
        />
        <WebNotice />
        <div className="onboarding">
          <section className="card onboarding-steps">
            <div className="card-header">
              <div>
                <h2>{t('Başlangıç planı')}</h2>
                <p>
                  {IS_TRAY
                    ? t('Şirketlerini, görevlerini ve finansını bu uygulamada yönet.')
                    : IS_WEB
                      ? t('Şirketlerini, görevlerini ve finansını bu tarayıcıda yönet.')
                      : t('Gerçek veriler, bağladığın anda akmaya başlar.')}
                </p>
              </div>
              <span className="step-counter">0 / 3</span>
            </div>
            <ol className="step-list">
              <li className="step">
                <span className="step-index">01</span>
                <div className="step-text">
                  <strong>{t('Şirketini tanımla')}</strong>
                  <span>{t('Renk ve açıklamayla komuta merkezine ekle.')}</span>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setCompanyModalOpen(true)}>
                  {t('Şirket ekle')}
                </button>
              </li>
              <li className="step">
                <span className="step-index">02</span>
                <div className="step-text">
                  <strong>{t('Servis bağla')}</strong>
                  <span>{t('Discord botu, Pterodactyl paneli veya web sitesi.')}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('services')}>
                  {t('Servislere git')}
                </button>
              </li>
              <li className="step">
                <span className="step-index">03</span>
                <div className="step-text">
                  <strong>{t('Finansı başlat')}</strong>
                  <span>{t('İlk gelir veya gider kaydını işle.')}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('finance')}>
                  {t('Finans')}
                </button>
              </li>
            </ol>
            <div className="onboarding-note">
              <ShieldCheck size={15} />
              <span>
                {IS_TRAY
                  ? t('Veriler bu cihazda saklanır; API anahtarları Windows DPAPI ile şifrelenir.')
                  : IS_WEB
                    ? t('Veriler bu cihazda saklanır; eşitleme açıksa yalnızca şifreli kopya gönderilir.')
                    : t('API anahtarları Windows DPAPI ile şifrelenir; yalnızca bağladığın servislerin API’lerine gönderilir. Uygulama tek kişiliktir, veriler bu bilgisayarda kalır.')}
              </span>
            </div>
          </section>

          <section className="card connect-panel">
            <div className="card-header">
              <div>
                <h2>{t('Neler bağlanabilir?')}</h2>
                <p>
                  {IS_TRAY
                    ? t('Site ve bot sağlığı arka planda izlenir.')
                    : IS_WEB
                      ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
                      : t('Üç gerçek entegrasyon, tek kontrol ekranı.')}
                </p>
              </div>
            </div>
            <div className="connect-item">
              <span className="connect-icon"><Bot size={17} /></span>
              <div>
                <strong>{t('Discord Bot API')}</strong>
                <span>
                  {IS_TRAY
                    ? t('Bot API’si token ile doğrulanır; sunucu listesi ve gecikme görünür.')
                    : IS_WEB
                      ? t('Envanter kaydı; canlı bot kontrolü yapılmaz.')
                      : t('Bot kimliği, sunucu listesi ve API gecikmesi.')}
                </span>
              </div>
            </div>
            <div className="connect-item">
              <span className="connect-icon"><Server size={17} /></span>
              <div>
                <strong>{t('Pterodactyl Paneli')}</strong>
                <span>
                  {IS_TRAY
                    ? t('Panel envanteri; canlı kontrol bu sürümde yok.')
                    : IS_WEB
                      ? t('Envanter kaydı; panel anahtarı saklanmaz.')
                      : t('Sunucu durumu, CPU, RAM, disk ve çalışma süresi.')}
                </span>
              </div>
            </div>
            <div className="connect-item">
              <span className="connect-icon"><Globe2 size={17} /></span>
              <div>
                <strong>{t('Web Sitesi İzleme')}</strong>
                <span>
                  {IS_TRAY
                    ? t('Site erişimi arka planda kontrol edilir; SSL ve yanıt süresi izlenir.')
                    : IS_WEB
                      ? t('Site kısayolu; canlı erişim kontrolü yapılmaz.')
                      : t('Erişim, yanıt süresi, hata kodu ve SSL bitişi.')}
                </span>
              </div>
            </div>
            <div className="connect-footer">
              <Cable size={15} />
              {IS_TRAY
                ? t('Site ve bot sağlığı arka planda izlenir.')
                : IS_WEB
                  ? t('Canlı izleme tarayıcı sürümünde kapalı.')
                  : t('Servisleri bağladıktan sonra otomatik kontrol döngüsü başlar.')}
            </div>
          </section>
        </div>
        <CompanyModal open={companyModalOpen} onClose={() => setCompanyModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          IS_WEB
            ? t('{date} · yerel çalışma alanı', { date: formatLongDate(Date.now()) })
            : t('{date} · canlı kontrol', { date: formatLongDate(Date.now()) })
        }
        title={t('Komuta merkezi')}
        subtitle={t('{companies} şirket · {services} servis · {tasks} açık görev', {
          companies: data.companies.length,
          services: data.assets.length,
          tasks: openTasks.length,
        })}
        actions={
          <>
            {!IS_WEB || IS_TRAY ? (
              <button type="button" className="btn btn-ghost" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
                {refreshing ? t('Kontrol ediliyor…') : t('Yenile')}
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={onOpenPalette}>
              <Zap size={15} /> {t('Hızlı işlem')}
            </button>
          </>
        }
      />

      {IS_WEB ? <WebNotice /> : null}

      <div className="kpi-grid">
        <KpiCard
          label={t('Şirketler')}
          value={data.companies.length}
          hint={t('{services} servis · {links} hızlı bağlantı', {
            services: data.assets.length,
            links: links.length,
          })}
          icon={<Building2 size={16} />}
          footer={<span className="mini-mono">{t('{count} açık görev', { count: openTasks.length })}</span>}
        />
        {IS_WEB && !IS_TRAY ? (
          <KpiCard
            label={t('Servisler')}
            value={data.assets.length}
            hint={
              IS_TRAY
                ? t('Site ve bot sağlığı arka planda izlenir.')
                : t('Canlı izleme tarayıcı sürümünde kapalı.')
            }
            icon={<Activity size={16} />}
            footer={
              <span className="mini-mono">
                {IS_TRAY && lastCheckAt
                  ? t('Son kontrol: {time}', { time: relativeTime(lastCheckAt) })
                  : IS_TRAY
                    ? t('İlk kontrol bekleniyor')
                    : t('Yerel envanter')}
              </span>
            }
          />
        ) : (
          <KpiCard
            label={t('Servis erişilebilirliği')}
            value={
              <span className="kpi-inline">
                {onlineCount}
                <span className="kpi-sub-value">/{monitoredAssets.length}</span>
              </span>
            }
            hint={
              monitoredAssets.length
                ? `${t('{count} dikkat', { count: degradedCount })} · ${t('{count} çalışmıyor', { count: offlineCount })}${
                    waitingCount ? ` · ${t('{count} anahtar bekliyor', { count: waitingCount })}` : ''
                  }`
                : t('Henüz izlenen servis yok')
            }
            icon={<Activity size={16} />}
            tone={offlineCount > 0 ? 'danger' : degradedCount > 0 ? 'amber' : monitoredAssets.length ? 'mint' : 'default'}
            footer={
              <span className="mini-mono">
                {lastChecked
                  ? t('Son kontrol {time}', { time: relativeTime(lastChecked) })
                  : t('İlk kontrol bekleniyor')}
              </span>
            }
          />
        )}
        <KpiCard
          label={t('Bu ay net')}
          value={monthRows.length ? formatMoney(net, currency) : '—'}
          hint={
            monthRows.length
              ? t('{income} gelir · {expense} gider', {
                  income: formatMoney(income, currency),
                  expense: formatMoney(expense, currency),
                })
              : t('Bu ay için kayıt yok')
          }
          icon={<Wallet size={16} />}
          tone={monthRows.length ? (net >= 0 ? 'mint' : 'danger') : 'default'}
          footer={<span className="mini-mono">{monthLabel(monthKey)}</span>}
        />
        <KpiCard
          label={t('Açık görev')}
          value={openTasks.length}
          hint={
            overdueCount > 0
              ? t('{count} görev gecikti', { count: overdueCount })
              : t('Geciken görev yok')
          }
          icon={<ListChecks size={16} />}
          tone={overdueCount > 0 ? 'amber' : 'default'}
          footer={
            <button type="button" className="text-link" onClick={() => navigate('tasks')}>
              {t('Görevlere git')} <ChevronRight size={12} />
            </button>
          }
        />
      </div>

      <div className="ops-metrics">
        <button type="button" className="ops-metric" onClick={() => navigate('operations')}>
          <span className="ops-metric-top">
            <span>{t('Toplam çalışan')}</span>
            <Users size={15} />
          </span>
          <strong>{data.employees.length}</strong>
          <small>{t('{count} aktif çalışan', { count: activeEmployeeCount })}</small>
        </button>
        <button type="button" className="ops-metric" onClick={() => navigate('operations')}>
          <span className="ops-metric-top">
            <span>{t('Aktif projeler')}</span>
            <FolderKanban size={15} />
          </span>
          <strong>{activeProjectCount}</strong>
          <small>{t('{count} tamamlanan proje', { count: completedProjectCount })}</small>
        </button>
        <button type="button" className="ops-metric" onClick={() => navigate('tasks')}>
          <span className="ops-metric-top">
            <span>{t('Tamamlanan görevler')}</span>
            <CheckCircle2 size={15} />
          </span>
          <strong>{completedTaskCount}</strong>
          <small>{t('{count} açık görev', { count: openTasks.length })}</small>
        </button>
        <button
          type="button"
          className="ops-metric ops-metric-income"
          onClick={() => navigate('finance')}
        >
          <span className="ops-metric-top">
            <span>{t('Toplam gelir')}</span>
            <ArrowDownLeft size={15} />
          </span>
          <strong>{totalFinanceCount ? formatMoney(totalIncome, currency) : '—'}</strong>
          <small>
            {t('{count} gelir kaydı', {
              count: financeRows.filter((row) => row.kind === 'income').length,
            })}
          </small>
        </button>
        <button
          type="button"
          className="ops-metric ops-metric-expense"
          onClick={() => navigate('finance')}
        >
          <span className="ops-metric-top">
            <span>{t('Toplam gider')}</span>
            <ArrowUpRight size={15} />
          </span>
          <strong>{totalFinanceCount ? formatMoney(totalExpense, currency) : '—'}</strong>
          <small>
            {t('{count} gider kaydı', {
              count: financeRows.filter((row) => row.kind === 'expense').length,
            })}
          </small>
        </button>
        <button
          type="button"
          className={`ops-metric ${pendingApprovals.length ? 'ops-metric-amber' : ''}`}
          onClick={() => navigate('operations')}
        >
          <span className="ops-metric-top">
            <span>{t('Bekleyen onaylar')}</span>
            <ShieldCheck size={15} />
          </span>
          <strong>{pendingApprovals.length}</strong>
          <small>{t('{count} talep karar bekliyor', { count: pendingApprovals.length })}</small>
        </button>
      </div>

      <div className="dash-grid">
        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Haftalık performans')}</h2>
              <p>
                {t('Son 7 gün')} · {t('{income} gelir · {expense} gider', {
                  income: formatMoney(weekIncome, currency),
                  expense: formatMoney(weekExpense, currency),
                })}
              </p>
            </div>
            <span className="mini-mono">
              {t('{count} tamamlanan görev', { count: weekTaskCount })}
            </span>
          </div>
          <div className="week-summary">
            <div>
              <span>{t('Gelir')}</span>
              <strong className="text-income">{formatMoney(weekIncome, currency)}</strong>
            </div>
            <div>
              <span>{t('Gider')}</span>
              <strong className="text-danger">{formatMoney(weekExpense, currency)}</strong>
            </div>
            <div>
              <span>{t('Net')}</span>
              <strong className={weekIncome - weekExpense < 0 ? 'text-danger' : ''}>
                {formatMoney(weekIncome - weekExpense, currency)}
              </strong>
            </div>
            <div>
              <span>{t('Tamamlanan görev')}</span>
              <strong>{weekTaskCount}</strong>
            </div>
          </div>
          <WeeklyBars days={weekDays} currency={currency} />
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Bekleyen onaylar')}</h2>
              <p>
                {pendingApprovals.length
                  ? t('{count} talep karar bekliyor', { count: pendingApprovals.length })
                  : t('Karar bekleyen talep yok')}
              </p>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('operations')}>
              {t('Tüm onaylar')} <ChevronRight size={12} />
            </button>
          </div>
          {pendingApprovals.length === 0 ? (
            <EmptyState
              compact
              icon={<ShieldCheck size={18} />}
              title={t('Bekleyen onay yok')}
              description={t('Yeni bir talep oluşturduğunda onay kuyruğu burada görünür.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('operations')}
                >
                  <Plus size={14} /> {t('Talep oluştur')}
                </button>
              }
            />
          ) : (
            <div className="approval-mini-list">
              {pendingApprovals.slice(0, 4).map((approval) => {
                const company = companyById.get(approval.companyId);
                return (
                  <div className="approval-mini" key={approval.id}>
                    <div className="approval-mini-main">
                      <strong>{approval.title}</strong>
                      <span>
                        <CompanyChip company={company} />
                        {approval.amount != null
                          ? ` · ${formatMoney(approval.amount, currency)}`
                          : ''}
                        {approval.requestedBy ? ` · ${approval.requestedBy}` : ''}
                      </span>
                    </div>
                    <div className="approval-mini-actions">
                      <button
                        type="button"
                        className="icon-btn approval-approve"
                        onClick={() => void decideApproval(approval, 'approved')}
                        disabled={decidingId === approval.id}
                        aria-label={t('Talebi onayla')}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn approval-reject"
                        onClick={() => void decideApproval(approval, 'rejected')}
                        disabled={decidingId === approval.id}
                        aria-label={t('Talebi reddet')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-12">
          <div className="card-header">
            <div>
              <h2>{t('Son aktiviteler')}</h2>
              <p>{t('Finans, görev, proje, ekip ve onay kayıtlarından otomatik oluşturulur.')}</p>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('operations')}>
              {t('Operasyonu aç')} <ChevronRight size={12} />
            </button>
          </div>
          {activities.length === 0 ? (
            <EmptyState
              compact
              icon={<Activity size={18} />}
              title={t('Henüz aktivite yok')}
              description={t('İlk kaydı eklediğinde son hareketler burada kronolojik olarak listelenir.')}
            />
          ) : (
            <div className="activity-list">
              {activities.map((item) => {
                const Icon = activityIcon(item.kind);
                return (
                  <button
                    type="button"
                    className="activity-row"
                    key={item.id}
                    onClick={() => navigate(item.page, item.companyId)}
                  >
                    <span className={`activity-icon tone-${item.tone}`}>
                      <Icon size={14} />
                    </span>
                    <span className="activity-main">
                      <span className="activity-title">{item.title}</span>
                      <span className="activity-meta">{item.meta}</span>
                    </span>
                    <span className="activity-time">{relativeTime(item.at)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!IS_WEB && data.youtubeChannels.length > 0 ? (
          <section className="card span-12 youtube-overview">
            <div className="card-header">
              <div>
                <h2 className="yt-heading">
                  <span className="yt-heading-icon">
                    <YoutubeIcon size={16} />
                  </span>
                  {t('YouTube hareketleri')}
                </h2>
                <p>
                  {t('{count} kanal bağlı · yeni yorumlar ve abone artışları', {
                    count: data.youtubeChannels.length,
                  })}
                  {data.youtubeKeys.length === 0 ? ` · ${t('YouTube API anahtarı yok')}` : ''}
                </p>
              </div>
              <button type="button" className="text-link" onClick={() => navigate('companies')}>
                {t('Şirketleri aç')} <ChevronRight size={12} />
              </button>
            </div>
            <div className="yt-overview-body">
              <div className="yt-overview-channels">
                {data.youtubeChannels.map((channel) => {
                  const company = companyById.get(channel.companyId);
                  return (
                    <button
                      type="button"
                      className="yt-overview-channel"
                      key={channel.id}
                      onClick={() => navigate('companies', channel.companyId)}
                    >
                      <span
                        className="yt-overview-avatar"
                        style={{ background: `${company?.color ?? '#3ef2b5'}22`, color: company?.color ?? '#3ef2b5' }}
                      >
                        {channel.avatar ? (
                          <img src={channel.avatar} alt="" />
                        ) : (
                          channel.title.trim()[0]?.toLocaleUpperCase(locale) ?? '▶'
                        )}
                      </span>
                      <span className="yt-overview-channel-main">
                        <strong>{channel.title}</strong>
                        <span>
                          {company?.name ?? '—'} ·{' '}
                          {channel.hiddenSubscribers
                            ? t('Abone gizli')
                            : t('{count} abone', {
                                count: compactNumber(channel.subscribers, locale),
                              })}
                        </span>
                      </span>
                      <span
                        className={`yt-overview-dot ${
                          channel.lastError ? 'danger' : channel.lastCheckedAt ? 'ok' : 'idle'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="yt-overview-feed">
                <div className="yt-panel-head">
                  <strong>{t('Son hareketler')}</strong>
                  <span>{t('Tüm kanallar')}</span>
                </div>
                {youtubeEvents.length === 0 ? (
                  <div className="yt-empty">
                    <YoutubeIcon size={16} />
                    <span>{t('Yeni yorumlar ve abone artışları burada görünecek.')}</span>
                  </div>
                ) : (
                  <div className="yt-event-list">
                    {youtubeEvents.map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        className="yt-event"
                        onClick={() => navigate('companies', event.companyId)}
                      >
                        <span
                          className={`yt-event-icon ${event.kind === 'subscriber' ? 'subscriber' : ''}`}
                        >
                          {event.kind === 'subscriber' ? (
                            <UserPlus size={14} />
                          ) : (
                            <MessageCircle size={14} />
                          )}
                        </span>
                        <span className="yt-event-main">
                          <span className="yt-event-title" dir="auto">
                            {event.kind === 'subscriber'
                              ? t('{count} yeni abone', { count: event.count ?? 0 })
                              : event.author ?? t('Yeni yorum')}
                            <span className="yt-event-time">{relativeTime(event.at)}</span>
                          </span>
                          <span className="yt-event-text" dir="auto">
                            {event.text ?? event.videoTitle ?? event.channelTitle}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Servis sağlığı')}</h2>
              <p>
                {IS_TRAY
                  ? t('Site ve bot sağlığı arka planda izlenir.')
                  : IS_WEB
                    ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
                    : t('Discord, panel ve site kontrolleri gerçek zamanlı.')}
              </p>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('services')}>
              {t('Tümünü gör')} <ChevronRight size={12} />
            </button>
          </div>

          {listedAssets.length === 0 ? (
            <EmptyState
              compact
              icon={<Activity size={18} />}
              title={t('Henüz izlenen servis yok')}
              description={
                IS_TRAY
                  ? t('Site ve Discord botları arka planda kontrol edilir; Pterodactyl ve Gmail canlı izlenmez.')
                  : IS_WEB
                    ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
                    : t('Bir Discord botu, Pterodactyl paneli veya web sitesi bağla; sağlık verisi burada başlasın.')
              }
              action={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('services')}>
                  <Plus size={14} /> {t('Servis bağla')}
                </button>
              }
            />
          ) : (
            <div className="service-list">
              {sortedAssets.slice(0, 6).map((asset) => {
                const status = data.statuses[asset.id];
                const state = statusOf(asset);
                const company = companyById.get(asset.companyId);
                const hasSecret =
                  asset.type === 'discord' && IS_WEB
                    ? Boolean(botHints[asset.id])
                    : asset.hasSecret;
                return (
                  <button
                    type="button"
                    key={asset.id}
                    className="service-row"
                    onClick={() => navigate('services')}
                  >
                    <span className={`service-state-dot state-${state}`} />
                    <ServiceAvatar asset={asset} company={company} />
                    <span className="service-main">
                      <span className="service-name">{asset.name}</span>
                      <span className="service-meta">
                        <CompanyChip company={company} />
                        <span className="meta-sep">·</span>
                        {serviceSummary(asset, status, t, hasSecret)}
                      </span>
                    </span>
                    <span className="service-side">
                      <StatusPill
                        state={state}
                        label={t(serviceStateLabel(asset, state, hasSecret))}
                        subtle
                      />
                      <span className="service-time">
                        {status ? relativeTime(status.checkedAt) : '—'}
                        {status?.latencyMs != null ? ` · ${status.latencyMs} ms` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-5 finance-card">
          <div className="card-header">
            <div>
              <h2>{t('Finans')}</h2>
              <p>{monthLabel(monthKey)} · {currency}</p>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('finance')}>
              {t('Finans')} <ChevronRight size={12} />
            </button>
          </div>
          <div className="finance-summary">
            <div>
              <span className="finance-label">{t('Net')}</span>
              <strong className={`finance-net ${net < 0 ? 'negative' : ''}`}>
                {monthRows.length ? formatMoney(net, currency) : '—'}
              </strong>
            </div>
            <div className="finance-split">
              <span><i className="dot-income" /> {t('Gelir')} <b>{formatMoney(income, currency)}</b></span>
              <span><i className="dot-expense" /> {t('Gider')} <b>{formatMoney(expense, currency)}</b></span>
            </div>
          </div>
          <MonthlyBars months={months} currency={currency} compact />
          {monthByCompany.length > 0 ? (
            <div className="mini-breakdown">
              <div className="mini-breakdown-head">
                <span>{t('Şirket dağılımı')}</span>
                <span>{t('Net')}</span>
              </div>
              {monthByCompany.slice(0, 3).map((row) => (
                <div className="mini-breakdown-row" key={row.company.id}>
                  <CompanyChip company={row.company} />
                  <strong className={row.net < 0 ? 'text-danger' : ''}>
                    {formatMoney(row.net, currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Açık görevler')}</h2>
              <p>
                {overdueCount > 0
                  ? t('{count} geciken görev öncelikli.', { count: overdueCount })
                  : t('Tarihe göre sıralı.')}
              </p>
            </div>
            <div className="card-header-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                aria-label={t('Görev ekle')}
              >
                <Plus size={15} />
              </button>
              <button type="button" className="text-link" onClick={() => navigate('tasks')}>
                {t('Tümü')} <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {openTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<ListChecks size={18} />}
              title={t('Açık görev yok')}
              description={t('Operasyon adımlarını görevlere böl; gecikenler burada öne çıksın.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                >
                  <Plus size={14} /> {t('Görev ekle')}
                </button>
              }
            />
          ) : (
            <div className="task-list">
              {openTasks.slice(0, 5).map((task) => {
                const due = dueLabel(task.due);
                const company = task.companyId ? companyById.get(task.companyId) : null;
                return (
                  <div className="task-row" key={task.id}>
                    <button
                      type="button"
                      className={`task-check ${togglingId === task.id ? 'pending' : ''}`}
                      onClick={() => void toggleTask(task)}
                      aria-label={t('Görevi tamamla')}
                    />
                    <button
                      type="button"
                      className="task-main"
                      onClick={() => {
                        setEditingTask(task);
                        setTaskModalOpen(true);
                      }}
                    >
                      <span className="task-title">{task.title}</span>
                      <span className="task-meta">
                        <span className={`priority-dot priority-dot-${task.priority}`} />
                        <CompanyChip company={company} />
                        {due ? (
                          <span className={`due due-${due.tone}`}>{due.text}</span>
                        ) : (
                          <span className="due due-none">{t('Tarihsiz')}</span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Hızlı erişim')}</h2>
              <p>{t('Şirketlerinin panelleri, tek tıkla.')}</p>
            </div>
            <button type="button" className="text-link" onClick={() => navigate('companies')}>
              {t('Yönet')} <ChevronRight size={12} />
            </button>
          </div>
          {links.length === 0 ? (
            <EmptyState
              compact
              icon={<ArrowUpRight size={18} />}
              title={t('Bağlantı yok')}
              description={t('Şirket detayından panel, site veya yönetim ekranı ekle.')}
              action={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('companies')}>
                  {t('Şirketleri aç')}
                </button>
              }
            />
          ) : (
            <div className="link-list">
              {links.slice(0, 7).map((link) => (
                <button
                  type="button"
                  key={link.id}
                  className="link-row"
                  onClick={() => void actions.openExternal(link.url)}
                >
                  <LinkAvatar link={link} company={link.company} locale={locale} />
                  <span className="link-main">
                    <span className="link-label">{link.label}</span>
                    <span className="link-company">{link.company.name}</span>
                  </span>
                  <ArrowUpRight size={14} className="link-arrow" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <CompanyModal open={companyModalOpen} onClose={() => setCompanyModalOpen(false)} />
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
      />
    </>
  );
}
