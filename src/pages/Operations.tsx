import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  FolderKanban,
  Plus,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { CompanyChip } from '../components/CompanyChip';
import { ProjectModal } from '../modals/ProjectModal';
import { EmployeeModal } from '../modals/EmployeeModal';
import { ApprovalModal } from '../modals/ApprovalModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import {
  APPROVAL_STATUS_LABEL,
  EMPLOYEE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
} from '../constants';
import { formatDate, formatMoney, relativeTime, todayISO } from '../lib/format';
import type { Approval, Employee, Project } from '../types';
import type { Page } from '../nav';

type OpsTab = 'projects' | 'team' | 'approvals';

const PROJECT_ORDER: Record<Project['status'], number> = {
  active: 0,
  paused: 1,
  completed: 2,
};

const EMPLOYEE_ORDER: Record<Employee['status'], number> = {
  active: 0,
  on_leave: 1,
  inactive: 2,
};

interface OperationsProps {
  navigate: (page: Page, companyId?: string | null) => void;
}

export function Operations({ navigate }: OperationsProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<OpsTab>('projects');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [editingApproval, setEditingApproval] = useState<Approval | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const currency = data.settings.currency;
  const today = todayISO();
  const defaultCompanyId = companyFilter === 'all' ? null : companyFilter;

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const projects = useMemo(
    () =>
      data.projects
        .filter((project) => companyFilter === 'all' || project.companyId === companyFilter)
        .sort((a, b) => {
          const order = PROJECT_ORDER[a.status] - PROJECT_ORDER[b.status];
          if (order !== 0) return order;
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
          if (a.dueDate && !b.dueDate) return -1;
          if (!a.dueDate && b.dueDate) return 1;
          return b.updatedAt - a.updatedAt;
        }),
    [data.projects, companyFilter],
  );

  const employees = useMemo(
    () =>
      data.employees
        .filter((employee) => companyFilter === 'all' || employee.companyId === companyFilter)
        .sort((a, b) => {
          const order = EMPLOYEE_ORDER[a.status] - EMPLOYEE_ORDER[b.status];
          if (order !== 0) return order;
          return a.name.localeCompare(b.name, locale);
        }),
    [data.employees, companyFilter, locale],
  );

  const approvals = useMemo(
    () =>
      data.approvals
        .filter((approval) => companyFilter === 'all' || approval.companyId === companyFilter)
        .sort((a, b) => {
          const rank = (item: Approval) => (item.status === 'pending' ? 0 : 1);
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
          return b.createdAt - a.createdAt;
        }),
    [data.approvals, companyFilter],
  );

  const activeProjects = projects.filter((project) => project.status === 'active');
  const completedProjects = projects.filter((project) => project.status === 'completed');
  const pausedProjects = projects.filter((project) => project.status === 'paused');
  const averageProgress = activeProjects.length
    ? Math.round(
        activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length,
      )
    : 0;

  const activeEmployees = employees.filter((employee) => employee.status === 'active');
  const onLeaveEmployees = employees.filter((employee) => employee.status === 'on_leave');
  const inactiveEmployees = employees.filter((employee) => employee.status === 'inactive');

  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const approvedApprovals = approvals.filter((approval) => approval.status === 'approved');
  const rejectedApprovals = approvals.filter((approval) => approval.status === 'rejected');

  const canAdd = data.companies.length > 0;

  const openNew = () => {
    if (tab === 'projects') {
      setEditingProject(null);
      setProjectModalOpen(true);
    } else if (tab === 'team') {
      setEditingEmployee(null);
      setEmployeeModalOpen(true);
    } else {
      setEditingApproval(null);
      setApprovalModalOpen(true);
    }
  };

  const openProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const openEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeModalOpen(true);
  };

  const openApproval = (approval: Approval) => {
    setEditingApproval(approval);
    setApprovalModalOpen(true);
  };

  const decide = async (approval: Approval, status: 'approved' | 'rejected') => {
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

  const addLabel =
    tab === 'projects' ? t('Proje ekle') : tab === 'team' ? t('Çalışan ekle') : t('Talep oluştur');

  const initialsOf = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toLocaleUpperCase(locale) || '?';

  return (
    <>
      <PageHeader
        eyebrow={t('İşletme')}
        title={t('Operasyon')}
        subtitle={t('Projeleri, ekibi ve onay taleplerini tek yerden yönet. Her kayıt bir şirkete bağlanır.')}
        actions={
          <button type="button" className="btn btn-primary" onClick={openNew} disabled={!canAdd}>
            <Plus size={15} /> {addLabel}
          </button>
        }
      />

      {!canAdd ? (
        <div className="card">
          <EmptyState
            icon={<FolderKanban size={20} />}
            title={t('Önce bir şirket oluştur')}
            description={t('Projeler, çalışanlar ve onay talepleri bir şirkete bağlanır. Şirket oluşturduktan sonra operasyon kayıtlarını buradan yönetebilirsin.')}
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
                {t('Şirketler’e git')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="ops-toolbar">
            <div className="segmented ops-tabs" role="tablist" aria-label={t('Operasyon görünümü')}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'projects'}
                className={`segment ${tab === 'projects' ? 'active' : ''}`}
                onClick={() => setTab('projects')}
              >
                {t('Projeler')} <span className="ops-tab-count">{projects.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'team'}
                className={`segment ${tab === 'team' ? 'active' : ''}`}
                onClick={() => setTab('team')}
              >
                {t('Ekip')} <span className="ops-tab-count">{employees.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'approvals'}
                className={`segment ${tab === 'approvals' ? 'active' : ''}`}
                onClick={() => setTab('approvals')}
              >
                {t('Onaylar')} <span className="ops-tab-count">{pendingApprovals.length}</span>
              </button>
            </div>
            <select
              className="input select select-compact"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              aria-label={t('Şirkete göre filtrele')}
            >
              <option value="all">{t('Tüm şirketler')}</option>
              {data.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {tab === 'projects' ? (
            <>
              <div className="kpi-grid ops-kpi-grid">
                <KpiCard
                  label={t('Aktif projeler')}
                  value={activeProjects.length}
                  hint={t('{count} proje yürütülüyor', { count: activeProjects.length })}
                  icon={<FolderKanban size={16} />}
                  tone={activeProjects.length ? 'mint' : 'default'}
                />
                <KpiCard
                  label={t('Tamamlanan projeler')}
                  value={completedProjects.length}
                  hint={t('{count} proje tamamlandı', { count: completedProjects.length })}
                  icon={<CheckCircle2 size={16} />}
                />
                <KpiCard
                  label={t('Ortalama ilerleme')}
                  value={`${averageProgress}%`}
                  hint={t('Aktif projelerin ortalaması')}
                  icon={<CalendarDays size={16} />}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Projeler')}</h2>
                    <p>
                      {t('{count} aktif · {paused} duraklatıldı · {completed} tamamlandı', {
                        count: activeProjects.length,
                        paused: pausedProjects.length,
                        completed: completedProjects.length,
                      })}
                    </p>
                  </div>
                </div>
                {projects.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<FolderKanban size={18} />}
                    title={t('Proje yok')}
                    description={t('İlk projeni ekle; durum ve ilerleme takibi burada başlasın.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingProject(null);
                          setProjectModalOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Proje ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="project-grid">
                    {projects.map((project) => {
                      const company = companyById.get(project.companyId);
                      const overdue =
                        project.status !== 'completed' && project.dueDate && project.dueDate < today;
                      return (
                        <button
                          type="button"
                          className={`project-card project-${project.status}`}
                          key={project.id}
                          onClick={() => openProject(project)}
                        >
                          <div className="project-card-top">
                            <span className={`ops-status ops-status-${project.status}`}>
                              {t(PROJECT_STATUS_LABEL[project.status])}
                            </span>
                            <span className="project-progress-value">{project.progress}%</span>
                          </div>
                          <h3>{project.name}</h3>
                          <p>{project.description || t('Açıklama yok')}</p>
                          <div className="project-progress" aria-hidden="true">
                            <span style={{ width: `${project.progress}%` }} />
                          </div>
                          <div className="project-meta">
                            <CompanyChip company={company} />
                            <span className={`project-due ${overdue ? 'is-overdue' : ''}`}>
                              <CalendarDays size={12} />
                              {project.dueDate ? formatDate(project.dueDate) : t('Tarih yok')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'team' ? (
            <>
              <div className="kpi-grid ops-kpi-grid">
                <KpiCard
                  label={t('Toplam çalışan')}
                  value={employees.length}
                  hint={t('{count} aktif çalışan', { count: activeEmployees.length })}
                  icon={<Users size={16} />}
                />
                <KpiCard
                  label={t('Aktif çalışan')}
                  value={activeEmployees.length}
                  hint={t('{count} pasif çalışan', { count: inactiveEmployees.length })}
                  icon={<Users size={16} />}
                  tone={activeEmployees.length ? 'mint' : 'default'}
                />
                <KpiCard
                  label={t('İzinde')}
                  value={onLeaveEmployees.length}
                  hint={t('Geri dönüş bekleyen çalışan')}
                  icon={<CalendarDays size={16} />}
                  tone={onLeaveEmployees.length ? 'amber' : 'default'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Ekip')}</h2>
                    <p>{t('{count} çalışan · {companies} şirket', {
                      count: employees.length,
                      companies: new Set(employees.map((employee) => employee.companyId)).size,
                    })}</p>
                  </div>
                </div>
                {employees.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Users size={18} />}
                    title={t('Çalışan yok')}
                    description={t('İlk ekip üyesini ekle; rol, durum ve başlangıç tarihini takip et.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingEmployee(null);
                          setEmployeeModalOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Çalışan ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="employee-table">
                    <div className="employee-table-head">
                      <span>{t('Çalışan')}</span>
                      <span>{t('Şirket')}</span>
                      <span>{t('Durum')}</span>
                      <span>{t('Başlangıç tarihi')}</span>
                    </div>
                    {employees.map((employee) => {
                      const company = companyById.get(employee.companyId);
                      return (
                        <button
                          type="button"
                          className="employee-row"
                          key={employee.id}
                          onClick={() => openEmployee(employee)}
                        >
                          <span className="employee-identity">
                            <span className="employee-avatar">{initialsOf(employee.name)}</span>
                            <span className="employee-main">
                              <strong>{employee.name}</strong>
                              <span>{employee.role || t('Rol belirtilmedi')}</span>
                            </span>
                          </span>
                          <span className="employee-company">
                            <CompanyChip company={company} />
                          </span>
                          <span className={`ops-status ops-status-${employee.status}`}>
                            {t(EMPLOYEE_STATUS_LABEL[employee.status])}
                          </span>
                          <span className="employee-start">
                            {employee.startDate ? formatDate(employee.startDate) : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'approvals' ? (
            <>
              <div className="kpi-grid ops-kpi-grid">
                <KpiCard
                  label={t('Bekleyen onaylar')}
                  value={pendingApprovals.length}
                  hint={t('{count} talep karar bekliyor', { count: pendingApprovals.length })}
                  icon={<ShieldCheck size={16} />}
                  tone={pendingApprovals.length ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Onaylanan talepler')}
                  value={approvedApprovals.length}
                  hint={t('{count} talep onaylandı', { count: approvedApprovals.length })}
                  icon={<CheckCircle2 size={16} />}
                  tone={approvedApprovals.length ? 'mint' : 'default'}
                />
                <KpiCard
                  label={t('Reddedilen talepler')}
                  value={rejectedApprovals.length}
                  hint={t('{count} talep reddedildi', { count: rejectedApprovals.length })}
                  icon={<XCircle size={16} />}
                  tone={rejectedApprovals.length ? 'danger' : 'default'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Onaylar')}</h2>
                    <p>{t('{pending} bekleyen · {total} toplam talep', {
                      pending: pendingApprovals.length,
                      total: approvals.length,
                    })}</p>
                  </div>
                </div>
                {approvals.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ShieldCheck size={18} />}
                    title={t('Onay talebi yok')}
                    description={t('Bir harcama veya karar talebi oluştur; onay sürecini burada yürüt.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingApproval(null);
                          setApprovalModalOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Talep oluştur')}
                      </button>
                    }
                  />
                ) : (
                  <div className="approval-list">
                    {approvals.map((approval) => {
                      const company = companyById.get(approval.companyId);
                      return (
                        <article className={`approval-card status-${approval.status}`} key={approval.id}>
                          <button
                            type="button"
                            className="approval-main"
                            onClick={() => openApproval(approval)}
                          >
                            <span className="approval-title-row">
                              <span className={`ops-status ops-status-${approval.status}`}>
                                {t(APPROVAL_STATUS_LABEL[approval.status])}
                              </span>
                              <strong>{approval.title}</strong>
                              {approval.amount != null ? (
                                <span className="approval-amount">
                                  {formatMoney(approval.amount, currency)}
                                </span>
                              ) : null}
                            </span>
                            <span className="approval-note">{approval.note || t('Not yok')}</span>
                            <span className="approval-meta">
                              <CompanyChip company={company} />
                              {approval.requestedBy ? <span>{approval.requestedBy}</span> : null}
                              <span>{relativeTime(approval.createdAt)}</span>
                              {approval.decidedAt ? (
                                <span className="approval-decision-time">
                                  {t('Karar: {time}', { time: relativeTime(approval.decidedAt) })}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {approval.status === 'pending' ? (
                            <div className="approval-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void decide(approval, 'approved')}
                                disabled={decidingId === approval.id}
                              >
                                <Check size={13} /> {t('Talebi onayla')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-sm"
                                onClick={() => void decide(approval, 'rejected')}
                                disabled={decidingId === approval.id}
                              >
                                <X size={13} /> {t('Talebi reddet')}
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      )}

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        project={editingProject}
        defaultCompanyId={defaultCompanyId}
      />
      <EmployeeModal
        open={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        employee={editingEmployee}
        defaultCompanyId={defaultCompanyId}
      />
      <ApprovalModal
        open={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        approval={editingApproval}
        defaultCompanyId={defaultCompanyId}
      />
    </>
  );
}
