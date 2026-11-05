import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  FileClock,
  Gauge,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import {
  APPROVAL_STATUS_LABEL,
  PERMISSION_KEYS,
  PERMISSION_LABEL,
  SECURITY_EVENT_LABEL,
} from '../constants';
import { buildActivity } from '../lib/activity';
import {
  departmentMetrics,
  employeeRanking,
  expiringContracts,
  openBugs,
  companyHealthRows,
  buildInsights,
} from '../lib/enterprise';
import { formatClock, formatDate, formatDateTime, formatMoney, relativeTime, todayISO } from '../lib/format';
import type { AccountInfo, ApprovalStatus } from '../types';
import type { TranslationKey } from '../i18n/core';
import type { Page } from '../nav';

interface AdminProps {
  navigate: (page: Page, companyId?: string | null) => void;
}

type AdminTab = 'ceo' | 'access' | 'audit' | 'security' | 'system' | 'approvals';
type DecisionStatus = Exclude<ApprovalStatus, 'pending'>;

const TABS: AdminTab[] = ['ceo', 'access', 'audit', 'security', 'system', 'approvals'];

function tabLabel(tab: AdminTab): TranslationKey {
  if (tab === 'ceo') return 'CEO paneli';
  if (tab === 'access') return 'Yetkilendirme';
  if (tab === 'audit') return 'İşlem geçmişi';
  if (tab === 'security') return 'Güvenlik';
  if (tab === 'system') return 'Sistem';
  return 'Onaylar';
}

export function Admin({ navigate }: AdminProps) {
  const data = useAppData();
  const { actions, confirm, meta, toast } = useApp();
  const { t, language, languages, setLanguage } = useI18n();
  const [tab, setTab] = useState<AdminTab>('ceo');
  const [companyFilter, setCompanyFilter] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [securityFilter, setSecurityFilter] = useState('');
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [session, setSession] = useState<AccountInfo | null | undefined>(undefined);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const payload = await window.ezwin?.session.get();
        if (alive) setSession(payload?.account ?? null);
      } catch {
        if (alive) setSession(null);
      }
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (alive && estimate) {
          setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
        }
      } catch {
        /* storage estimate is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const health = useMemo(() => companyHealthRows(data), [data]);
  const ranking = useMemo(() => employeeRanking(data), [data]);
  const departments = useMemo(() => departmentMetrics(data), [data]);
  const insights = useMemo(() => buildInsights(data, t), [data, t]);
  const allActivity = useMemo(() => buildActivity(data, t, 200), [data, t]);
  const pendingApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.status === 'pending'),
    [data.approvals],
  );
  const decidedApprovals = useMemo(
    () =>
      data.approvals
        .filter((approval) => approval.status !== 'pending')
        .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))
        .slice(0, 20),
    [data.approvals],
  );
  const expiring = useMemo(() => expiringContracts(data.contracts, 30), [data.contracts]);
  const bugs = useMemo(() => openBugs(data.bugs), [data.bugs]);

  const totals = useMemo(
    () =>
      health.reduce(
        (acc, row) => ({
          revenue: acc.revenue + row.revenue,
          expense: acc.expense + row.expense,
          net: acc.net + row.net,
          headcount: acc.headcount + row.headcount,
        }),
        { revenue: 0, expense: 0, net: 0, headcount: 0 },
      ),
    [health],
  );

  const upcomingMeetings = useMemo(
    () =>
      data.meetings
        .filter((meeting) => meeting.status === 'planned' && meeting.date >= todayISO())
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 4),
    [data.meetings],
  );

  const latestAnnouncements = useMemo(
    () =>
      data.announcements
        .filter((announcement) => announcement.status === 'published')
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt);
        })
        .slice(0, 3),
    [data.announcements],
  );

  const companyName = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company.name])),
    [data.companies],
  );

  const filteredActivity = useMemo(() => {
    const query = auditQuery.trim().toLocaleLowerCase(language);
    return allActivity.filter((item) => {
      if (companyFilter && item.companyId !== companyFilter) return false;
      if (!query) return true;
      return `${item.title} ${item.meta}`.toLocaleLowerCase(language).includes(query);
    });
  }, [allActivity, auditQuery, companyFilter, language]);

  const groupedActivity = useMemo(() => {
    const groups = new Map<string, typeof filteredActivity>();
    for (const item of filteredActivity) {
      const key = new Date(item.at).toISOString().slice(0, 10);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [filteredActivity]);

  const filteredSecurity = useMemo(() => {
    if (!securityFilter) return data.securityEvents;
    return data.securityEvents.filter((event) => event.kind === securityFilter);
  }, [data.securityEvents, securityFilter]);

  const togglePermission = async (
    roleId: string,
    companyId: string,
    roleName: string,
    permission: (typeof PERMISSION_KEYS)[number],
    enabled: boolean,
  ) => {
    const role = data.roles.find((item) => item.id === roleId);
    if (!role) return;
    const next = enabled
      ? [...new Set([...role.permissions, permission])]
      : role.permissions.filter((item) => item !== permission);
    const ok = await actions.updateRole({ id: roleId, permissions: next });
    if (ok) {
      await actions.logSecurityEvent({
        kind: 'role',
        detail: `${roleName} · ${t(PERMISSION_LABEL[permission])}: ${enabled ? t('izin verildi') : t('izin kaldırıldı')}`,
        companyId,
      });
    }
  };

  const assignRole = async (employeeId: string, roleId: string) => {
    const employee = data.employees.find((item) => item.id === employeeId);
    const ok = await actions.updateEmployee({ id: employeeId, roleId: roleId || null });
    if (ok && employee) {
      const roleName = data.roles.find((role) => role.id === roleId)?.name ?? t('Rol atanmadı');
      await actions.logSecurityEvent({
        kind: 'role',
        detail: `${employee.name} · ${roleName}`,
        companyId: employee.companyId,
      });
    }
  };

  const decide = async (id: string, status: DecisionStatus) => {
    const approval = data.approvals.find((item) => item.id === id);
    if (!approval || busyId) return;
    const note = decisionNotes[id]?.trim() ?? '';
    setBusyId(id);
    const ok = await actions.decideApproval(id, status, {
      decidedBy: t('Yerel yönetici'),
      decisionNote: note,
    });
    if (ok) {
      await actions.logSecurityEvent({
        kind: 'approval',
        detail: `${approval.title}: ${t(APPROVAL_STATUS_LABEL[status])}${note ? ` · ${note}` : ''}`,
        companyId: approval.companyId,
      });
      setDecisionNotes((current) => ({ ...current, [id]: '' }));
    }
    setBusyId('');
  };

  const clearSecurity = async () => {
    const sure = await confirm({
      title: t('Güvenlik kayıtları temizlensin mi?'),
      message: t('Tüm yerel güvenlik olay kayıtları silinecek. Hesap ve iş verileri etkilenmez.'),
      confirmLabel: t('Kayıtları temizle'),
    });
    if (!sure) return;
    const ok = await actions.clearSecurityEvents();
    if (ok) toast('success', t('Güvenlik kayıtları temizlendi.'));
  };

  const exportSecurity = () => {
    if (data.securityEvents.length === 0) return;
    const lines = data.securityEvents.map((event) => {
      const company = event.companyId ? companyName.get(event.companyId) ?? '' : '';
      return [new Date(event.at).toISOString(), event.actor, event.kind, company, event.detail]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = ['tarih,aktor,tur,sirket,ayrinti', ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbita-guvenlik-${todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const pendingTotal = pendingApprovals.reduce(
    (sum, approval) => sum + (approval.amount ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={t('Kurumsal')}
        title={t('Yönetim')}
        subtitle={t('CEO görünümü, yetkilendirme, denetim, güvenlik ve onay kuyruğu tek panelde. Veriler cihazda tutulur.')}
        actions={
          <div className="page-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate('business')}>
              <Sparkles size={15} /> {t('İş merkezi')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('settings')}>
              <SlidersHorizontal size={15} /> {t('Ayarlar')}
            </button>
          </div>
        }
      />

      <div className="segmented ops-tabs adm-tabs" role="tablist" aria-label={t('Yönetim görünümü')}>
        {TABS.map((item) => (
          <button
            type="button"
            role="tab"
            key={item}
            aria-selected={tab === item}
            className={`segment ${tab === item ? 'active' : ''}`}
            onClick={() => setTab(item)}
          >
            {t(tabLabel(item))}
            {item === 'approvals' && pendingApprovals.length > 0 ? (
              <span className="ops-tab-count">{pendingApprovals.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'ceo' ? (
        <>
          <div className="kpi-grid adm-kpis">
            <KpiCard
              label={t('Toplam gelir')}
              value={formatMoney(totals.revenue, data.settings.currency)}
              hint={t('{count} şirket · tüm zamanlar', { count: data.companies.length })}
              icon={<Gauge size={16} />}
              tone="mint"
            />
            <KpiCard
              label={t('Net sonuç')}
              value={formatMoney(totals.net, data.settings.currency)}
              hint={t('Gider {expense}', { expense: formatMoney(totals.expense, data.settings.currency) })}
              icon={<Activity size={16} />}
              tone={totals.net < 0 ? 'danger' : 'default'}
            />
            <KpiCard
              label={t('Aktif ekip')}
              value={totals.headcount}
              hint={t('{count} departman', { count: departments.length })}
              icon={<Users size={16} />}
            />
            <KpiCard
              label={t('Bekleyen onay')}
              value={pendingApprovals.length}
              hint={formatMoney(pendingTotal, data.settings.currency)}
              icon={<ClipboardList size={16} />}
              tone={pendingApprovals.length > 0 ? 'amber' : 'default'}
            />
            <KpiCard
              label={t('Açık hata')}
              value={bugs.length}
              hint={t('{count} sözleşme yakında bitiyor', { count: expiring.length })}
              icon={<ShieldAlert size={16} />}
              tone={bugs.some((bug) => bug.severity === 'critical') ? 'danger' : 'default'}
            />
          </div>

          <div className="adm-ceo-grid">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Şirket performansı')}</h2>
                  <p>{t('Gelir, gider ve operasyon sinyalleri şirket bazında.')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('companies')}>
                  {t('Şirketler')}
                </button>
              </div>
              {health.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Building2 size={18} />}
                  title={t('Henüz şirket yok')}
                  description={t('Şirket oluşturduğunda CEO paneli burada dolacak.')}
                  action={
                    <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
                      {t('Şirket ekle')}
                    </button>
                  }
                />
              ) : (
                <div className="table-scroll">
                  <table className="data-table adm-company-table">
                    <thead>
                      <tr>
                        <th>{t('Şirket')}</th>
                        <th>{t('Ekip')}</th>
                        <th>{t('Gelir')}</th>
                        <th>{t('Net')}</th>
                        <th>{t('Açık görev')}</th>
                        <th>{t('Hata')}</th>
                        <th>{t('Onay')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.map((row) => (
                        <tr key={row.companyId}>
                          <td>
                            <button
                              type="button"
                              className="adm-company-link"
                              onClick={() => navigate('company', row.companyId)}
                            >
                              <span className="company-dot" style={{ background: row.color }} />
                              {row.name}
                            </button>
                          </td>
                          <td>{row.headcount}</td>
                          <td>{formatMoney(row.revenue, data.settings.currency)}</td>
                          <td className={row.net < 0 ? 'adm-negative' : 'adm-positive'}>
                            {formatMoney(row.net, data.settings.currency)}
                          </td>
                          <td>{row.openTasks}</td>
                          <td>{row.openBugs}</td>
                          <td>{row.pendingApprovals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card adm-signal-card">
              <div className="card-head">
                <div>
                  <h2>{t('Öncelikli sinyaller')}</h2>
                  <p>{t('Kayıtlardan türetilen uyarılar; yapay zekâ dış servise gönderilmez.')}</p>
                </div>
              </div>
              <div className="adm-signals">
                {insights.map((insight) => (
                  <button
                    type="button"
                    key={insight.id}
                    className={`adm-signal tone-${insight.tone}`}
                    onClick={() => navigate(insight.page, insight.companyId)}
                  >
                    <span className="adm-signal-dot" />
                    <span className="adm-signal-copy">
                      <strong>{insight.title}</strong>
                      <span>{insight.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="adm-ceo-grid adm-ceo-grid-lower">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Yaklaşan toplantılar')}</h2>
                  <p>{t('İletişim modülündeki planlanmış toplantılar.')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('communication')}>
                  {t('Toplantı odası')}
                </button>
              </div>
              {upcomingMeetings.length === 0 ? (
                <p className="adm-muted">{t('Planlanmış toplantı yok.')}</p>
              ) : (
                <ul className="adm-meeting-list">
                  {upcomingMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <span className="adm-date-block">
                        <strong>{meeting.date.slice(8, 10)}</strong>
                        <span>{meeting.date.slice(5, 7)}</span>
                      </span>
                      <span className="adm-meeting-copy">
                        <strong>{meeting.title}</strong>
                        <span>
                          {meeting.time} · {companyName.get(meeting.companyId) ?? ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Son duyurular')}</h2>
                  <p>{t('Yayınlanan şirket duyuruları.')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('communication')}>
                  {t('Duyurular')}
                </button>
              </div>
              {latestAnnouncements.length === 0 ? (
                <p className="adm-muted">{t('Yayınlanmış duyuru yok.')}</p>
              ) : (
                <ul className="adm-announcement-list">
                  {latestAnnouncements.map((announcement) => (
                    <li key={announcement.id}>
                      <span className={`adm-priority priority-${announcement.priority}`} />
                      <span>
                        <strong>{announcement.title}</strong>
                        <span>
                          {companyName.get(announcement.companyId) ?? ''} ·{' '}
                          {announcement.publishedAt ? formatDateTime(announcement.publishedAt) : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Ekip sıralaması')}</h2>
                  <p>{t('En güncel performans puanına göre ilk beş.')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('business')}>
                  {t('Tüm sıralama')}
                </button>
              </div>
              {ranking.filter((employee) => employee.score !== null).length === 0 ? (
                <p className="adm-muted">{t('Henüz performans değerlendirmesi yok.')}</p>
              ) : (
                <ol className="adm-ranking">
                  {ranking
                    .filter((employee) => employee.score !== null)
                    .slice(0, 5)
                    .map((employee) => (
                      <li key={employee.id}>
                        <span className="adm-rank-score">{employee.score}</span>
                        <span className="adm-rank-copy">
                          <strong>{employee.name}</strong>
                          <span>{companyName.get(employee.companyId) ?? ''}</span>
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          </div>
        </>
      ) : null}

      {tab === 'access' ? (
        <>
          <div className="notice-card">
            <KeyRound size={16} />
            <span>
              {t('Bu sürümde tek yerel hesap kullanılır. Yetkilendirme, rollerin modül izinlerini ve çalışanların rol atamalarını yönetir; oturum açma erişimini kısıtlamaz.')}
            </span>
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>{t('İzin matrisi')}</h2>
                <p>{t('Rol bazlı modül izinleri. Değişiklikler anında kaydedilir.')}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('operations')}>
                {t('Rol yönetimi')}
              </button>
            </div>
            {data.roles.length === 0 ? (
              <EmptyState
                compact
                icon={<ShieldCheck size={18} />}
                title={t('Yetki rolü yok')}
                description={t('Operasyon sayfasında rol oluşturarak izin matrisini doldurabilirsin.')}
                action={
                  <button type="button" className="btn btn-primary" onClick={() => navigate('operations')}>
                    {t('Rol oluştur')}
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table adm-permission-table">
                  <thead>
                    <tr>
                      <th>{t('Rol')}</th>
                      <th>{t('Şirket')}</th>
                      {PERMISSION_KEYS.map((permission) => (
                        <th key={permission}>{t(PERMISSION_LABEL[permission])}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.roles.map((role) => (
                      <tr key={role.id}>
                        <td>
                          <strong>{role.name}</strong>
                          <span className="adm-cell-sub">{role.description}</span>
                        </td>
                        <td>{companyName.get(role.companyId) ?? ''}</td>
                        {PERMISSION_KEYS.map((permission) => {
                          const enabled = role.permissions.includes(permission);
                          return (
                            <td key={permission} className="adm-permission-cell">
                              <button
                                type="button"
                                className={`adm-permission-toggle ${enabled ? 'is-on' : ''}`}
                                aria-pressed={enabled}
                                aria-label={`${role.name} · ${t(PERMISSION_LABEL[permission])}`}
                                onClick={() =>
                                  void togglePermission(
                                    role.id,
                                    role.companyId,
                                    role.name,
                                    permission,
                                    !enabled,
                                  )
                                }
                              >
                                {enabled ? <CheckCircle2 size={15} /> : <X size={15} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>{t('Çalışan rol atamaları')}</h2>
                <p>{t('Her çalışanın modül izinleri rolü üzerinden belirlenir.')}</p>
              </div>
            </div>
            {data.employees.length === 0 ? (
              <p className="adm-muted">{t('Henüz çalışan eklenmedi.')}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Çalışan')}</th>
                      <th>{t('Şirket')}</th>
                      <th>{t('Departman')}</th>
                      <th>{t('Rol')}</th>
                      <th>{t('Durum')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employees.map((employee) => {
                      const roleOptions = data.roles.filter(
                        (role) => role.companyId === employee.companyId,
                      );
                      const department = data.departments.find(
                        (item) => item.id === employee.departmentId,
                      );
                      return (
                        <tr key={employee.id}>
                          <td>
                            <strong>{employee.name}</strong>
                            <span className="adm-cell-sub">{employee.email}</span>
                          </td>
                          <td>{companyName.get(employee.companyId) ?? ''}</td>
                          <td>{department?.name ?? t('Atanmadı')}</td>
                          <td>
                            <select
                              className="input select input-compact"
                              value={employee.roleId ?? ''}
                              onChange={(event) => void assignRole(employee.id, event.target.value)}
                            >
                              <option value="">{t('Rol atanmadı')}</option>
                              {roleOptions.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className={`status-pill status-${employee.status}`}>
                              {t(employee.status === 'active' ? 'Aktif' : employee.status === 'on_leave' ? 'İzinde' : 'Pasif')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {tab === 'audit' ? (
        <>
          <div className="adm-toolbar">
            <label className="adm-search">
              <ScrollText size={15} />
              <input
                className="input"
                value={auditQuery}
                onChange={(event) => setAuditQuery(event.target.value)}
                placeholder={t('Kayıtlarda ara…')}
                maxLength={120}
              />
            </label>
            <select
              className="input select adm-select"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              aria-label={t('Şirket')}
            >
              <option value="">{t('Tüm şirketler')}</option>
              {data.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <span className="adm-count">
              {t('{count} kayıt', { count: filteredActivity.length })}
            </span>
          </div>

          <div className="notice-card">
            <FileClock size={16} />
            <span>
              {t('İşlem geçmişi mevcut kayıtlardan türetilir. Silinen kayıtlar geçmişte de görünmez.')}
            </span>
          </div>

          {groupedActivity.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={20} />}
              title={t('Kayıt bulunamadı')}
              description={t('Filtreyi değiştir veya yeni işlemler yaptığında burada görünecek.')}
            />
          ) : (
            <div className="adm-timeline">
              {groupedActivity.map(([date, items]) => (
                <section key={date} className="card adm-timeline-day">
                  <h3>{formatDate(date)}</h3>
                  <ul>
                    {items.map((item) => (
                      <li key={item.id} className={`tone-${item.tone}`}>
                        <span className="adm-timeline-time">
                          {formatClock(item.at, data.settings.clockFormat, false)}
                        </span>
                        <span className="adm-timeline-dot" />
                        <span className="adm-timeline-copy">
                          <strong>{item.title}</strong>
                          <span>{item.meta}</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(item.page, item.companyId)}
                        >
                          {t('Aç')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'security' ? (
        <>
          <div className="kpi-grid adm-kpis">
            <KpiCard
              label={t('Hesap güvenliği')}
              value={
                session
                  ? session.twoFactorEnabled
                    ? t('İki adımlı doğrulama açık')
                    : t('İki adımlı doğrulama kapalı')
                  : t('Bilgi yok')
              }
              hint={
                session?.lastLoginAt
                  ? t('Son giriş {time}', { time: relativeTime(session.lastLoginAt) })
                  : t('Yerel oturum')
              }
              icon={<ShieldCheck size={16} />}
              tone={session?.twoFactorEnabled ? 'mint' : 'amber'}
            />
            <KpiCard
              label={t('Güvenlik olayı')}
              value={data.securityEvents.length}
              hint={t('Son 500 kayıt saklanır')}
              icon={<LockKeyhole size={16} />}
            />
            <KpiCard
              label={t('Kayıtlı çalışan')}
              value={data.employees.length}
              hint={t('{count} yetki rolü', { count: data.roles.length })}
              icon={<UserCog size={16} />}
            />
            <KpiCard
              label={t('Veri koruması')}
              value={
                meta?.secureStorage ? t('DPAPI etkin') : t('Tarayıcı depolaması')
              }
              hint={meta?.dataPath ?? t('Yerel çalışma alanı')}
              icon={<BadgeCheck size={16} />}
            />
          </div>

          <div className="adm-toolbar">
            <select
              className="input select adm-select"
              value={securityFilter}
              onChange={(event) => setSecurityFilter(event.target.value)}
              aria-label={t('Olay türü')}
            >
              <option value="">{t('Tüm olaylar')}</option>
              {(['role', 'approval', 'backup', 'import', 'security', 'account'] as const).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {t(SECURITY_EVENT_LABEL[kind])}
                  </option>
                ),
              )}
            </select>
            <span className="adm-count">{t('{count} olay', { count: filteredSecurity.length })}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportSecurity}
              disabled={data.securityEvents.length === 0}
            >
              <Download size={14} /> {t('CSV indir')}
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => void clearSecurity()}
              disabled={data.securityEvents.length === 0}
            >
              <Trash2 size={14} /> {t('Temizle')}
            </button>
          </div>

          {filteredSecurity.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title={t('Güvenlik olayı yok')}
              description={t('Rol değişiklikleri, onay kararları ve yedeklemeler burada kaydedilir.')}
            />
          ) : (
            <section className="card adm-security-list">
              <ul>
                {filteredSecurity.map((event) => (
                  <li key={event.id}>
                    <span className={`adm-security-kind kind-${event.kind}`}>
                      {t(SECURITY_EVENT_LABEL[event.kind])}
                    </span>
                    <span className="adm-security-copy">
                      <strong>{event.detail}</strong>
                      <span>
                        {event.actor || t('Yerel yönetici')} ·{' '}
                        {event.companyId ? companyName.get(event.companyId) ?? '' : t('Genel')} ·{' '}
                        {formatDateTime(event.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}

      {tab === 'system' ? (
        <>
          <div className="adm-system-grid">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Hızlı sistem ayarları')}</h2>
                  <p>{t('Sık kullanılan ayarlar; ayrıntılar Ayarlar sayfasında.')}</p>
                </div>
              </div>
              <div className="adm-setting-list">
                <label className="toggle-row">
                  <span>
                    <strong>{t('Bildirimler')}</strong>
                    <span>{t('Masaüstü bildirimleri')}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={data.settings.notifications}
                    onChange={(event) =>
                      void actions.updateSettings({ notifications: event.target.checked })
                    }
                  />
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>{t('Hareketi azalt')}</strong>
                    <span>{t('Arayüz animasyonlarını sınırla')}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={data.settings.reduceMotion}
                    onChange={(event) =>
                      void actions.updateSettings({ reduceMotion: event.target.checked })
                    }
                  />
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>{t('Otomatik güncelleme')}</strong>
                    <span>{t('Yeni sürümü arka planda indir')}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={data.settings.autoUpdate}
                    onChange={(event) =>
                      void actions.updateSettings({ autoUpdate: event.target.checked })
                    }
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">{t('Dil')}</span>
                  <select
                    className="input select"
                    value={language}
                    onChange={(event) => void setLanguage(event.target.value as typeof language)}
                  >
                    {languages.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.nativeName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">{t('Para birimi')}</span>
                  <select
                    className="input select"
                    value={data.settings.currency}
                    onChange={(event) =>
                      void actions.updateSettings({
                        currency: event.target.value as typeof data.settings.currency,
                      })
                    }
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-label">{t('Saat biçimi')}</span>
                  <select
                    className="input select"
                    value={data.settings.clockFormat}
                    onChange={(event) =>
                      void actions.updateSettings({
                        clockFormat: event.target.value as typeof data.settings.clockFormat,
                      })
                    }
                  >
                    <option value="24h">24 {t('saat')}</option>
                    <option value="12h">12 {t('saat')}</option>
                  </select>
                </label>
              </div>
              <div className="adm-inline-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('settings')}>
                  <SlidersHorizontal size={14} /> {t('Tüm ayarlar')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('updates')}>
                  <RefreshCw size={14} /> {t('Güncellemeler')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('account')}>
                  <LockKeyhole size={14} /> {t('Hesap güvenliği')}
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Sistem bilgisi')}</h2>
                  <p>{t('Çalışma ortamı ve yerel depolama durumu.')}</p>
                </div>
              </div>
              <dl className="adm-facts">
                <div>
                  <dt>{t('Sürüm')}</dt>
                  <dd>v{meta?.appVersion ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('Platform')}</dt>
                  <dd>{meta?.platform ?? 'web'}</dd>
                </div>
                <div>
                  <dt>{t('Güvenli depolama')}</dt>
                  <dd>{meta?.secureStorage ? t('Etkin') : t('Tarayıcı depolaması')}</dd>
                </div>
                <div>
                  <dt>{t('Veri yolu')}</dt>
                  <dd className="adm-fact-path">{meta?.dataPath ?? t('Tarayıcı çalışma alanı')}</dd>
                </div>
                {storage ? (
                  <div>
                    <dt>{t('Depolama kullanımı')}</dt>
                    <dd>
                      {(storage.usage / 1024 / 1024).toFixed(1)} MB
                      {storage.quota > 0
                        ? ` / ${(storage.quota / 1024 / 1024).toFixed(0)} MB`
                        : ''}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="adm-data-stats">
                <span>{t('{count} şirket', { count: data.companies.length })}</span>
                <span>{t('{count} çalışan', { count: data.employees.length })}</span>
                <span>{t('{count} müşteri', { count: data.clients.length })}</span>
                <span>{t('{count} sözleşme', { count: data.contracts.length })}</span>
                <span>{t('{count} belge', { count: data.documents.length })}</span>
                <span>{t('{count} hata', { count: data.bugs.length })}</span>
              </div>
            </section>
          </div>
        </>
      ) : null}

      {tab === 'approvals' ? (
        <>
          <div className="kpi-grid adm-kpis">
            <KpiCard
              label={t('Bekleyen onay')}
              value={pendingApprovals.length}
              hint={formatMoney(pendingTotal, data.settings.currency)}
              icon={<ClipboardList size={16} />}
              tone="amber"
            />
            <KpiCard
              label={t('Onaylanan')}
              value={data.approvals.filter((approval) => approval.status === 'approved').length}
              hint={t('Son 20 karar listelenir')}
              icon={<CheckCircle2 size={16} />}
              tone="mint"
            />
            <KpiCard
              label={t('Reddedilen')}
              value={data.approvals.filter((approval) => approval.status === 'rejected').length}
              hint={t('Karar notu kaydedilir')}
              icon={<X size={16} />}
            />
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>{t('Yönetici onay kuyruğu')}</h2>
                <p>{t('Tüm şirketlerden bekleyen talepler. Karar notu güvenlik kaydına işlenir.')}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('operations')}>
                {t('Operasyon')}
              </button>
            </div>
            {pendingApprovals.length === 0 ? (
              <EmptyState
                compact
                icon={<CheckCircle2 size={18} />}
                title={t('Bekleyen onay yok')}
                description={t('Yeni talepler Operasyon sayfasındaki onaylar bölümünden eklenir.')}
              />
            ) : (
              <div className="adm-approval-list">
                {pendingApprovals.map((approval) => (
                  <article key={approval.id} className="adm-approval-card">
                    <div className="adm-approval-head">
                      <div>
                        <span className="adm-approval-company">
                          {companyName.get(approval.companyId) ?? ''}
                        </span>
                        <h3>{approval.title}</h3>
                        <p>
                          {approval.requestedBy || t('Belirtilmedi')} · {relativeTime(approval.createdAt)}
                          {approval.amount !== null
                            ? ` · ${formatMoney(approval.amount, data.settings.currency)}`
                            : ''}
                        </p>
                      </div>
                      <span className="status-pill status-pending">{t(APPROVAL_STATUS_LABEL.pending)}</span>
                    </div>
                    {approval.note ? <p className="adm-approval-note">{approval.note}</p> : null}
                    <input
                      className="input"
                      value={decisionNotes[approval.id] ?? ''}
                      onChange={(event) =>
                        setDecisionNotes((current) => ({
                          ...current,
                          [approval.id]: event.target.value,
                        }))
                      }
                      placeholder={t('Karar notu (isteğe bağlı)')}
                      maxLength={500}
                    />
                    <div className="adm-approval-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === approval.id}
                        onClick={() => void decide(approval.id, 'rejected')}
                      >
                        <X size={14} /> {t('Reddet')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === approval.id}
                        onClick={() => void decide(approval.id, 'approved')}
                      >
                        <CheckCircle2 size={14} /> {t('Onayla')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>{t('Son kararlar')}</h2>
                <p>{t('Onay ve ret geçmişi.')}</p>
              </div>
            </div>
            {decidedApprovals.length === 0 ? (
              <p className="adm-muted">{t('Henüz karar verilmedi.')}</p>
            ) : (
              <ul className="adm-decision-list">
                {decidedApprovals.map((approval) => (
                  <li key={approval.id}>
                    <span
                      className={`status-pill status-${approval.status === 'approved' ? 'approved' : 'rejected'}`}
                    >
                      {t(APPROVAL_STATUS_LABEL[approval.status])}
                    </span>
                    <span className="adm-decision-copy">
                      <strong>{approval.title}</strong>
                      <span>
                        {companyName.get(approval.companyId) ?? ''}
                        {approval.decidedBy ? ` · ${approval.decidedBy}` : ''}
                        {approval.decidedAt ? ` · ${formatDateTime(approval.decidedAt)}` : ''}
                      </span>
                      {approval.decisionNote ? (
                        <span className="adm-decision-note">{approval.decisionNote}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

export type { AdminTab };
