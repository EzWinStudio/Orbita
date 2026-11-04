import { useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  FolderKanban,
  Info,
  Plus,
  ShieldCheck,
  Star,
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
import { EmployeeProfileModal } from '../modals/EmployeeProfileModal';
import { ApprovalModal } from '../modals/ApprovalModal';
import { DepartmentModal } from '../modals/DepartmentModal';
import { RoleModal } from '../modals/RoleModal';
import { PerformanceReviewModal } from '../modals/PerformanceReviewModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import {
  APPROVAL_STATUS_LABEL,
  EMPLOYEE_STATUS_LABEL,
  PERMISSION_KEYS,
  PERMISSION_LABEL,
  PROJECT_STATUS_LABEL,
} from '../constants';
import { formatDate, formatMoney, relativeTime, todayISO } from '../lib/format';
import type {
  Approval,
  Department,
  Employee,
  PerformanceReview,
  Project,
  Role,
} from '../types';
import type { Page } from '../nav';

type OpsTab = 'projects' | 'team' | 'departments' | 'roles' | 'approvals';

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

function scoreTone(score: number | null): 'high' | 'mid' | 'low' | 'none' {
  if (score == null) return 'none';
  if (score >= 85) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

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
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewEmployee, setReviewEmployee] = useState<Employee | null>(null);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);

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

  const departments = useMemo(
    () =>
      data.departments
        .filter((department) => companyFilter === 'all' || department.companyId === companyFilter)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.departments, companyFilter, locale],
  );

  const roles = useMemo(
    () =>
      data.roles
        .filter((role) => companyFilter === 'all' || role.companyId === companyFilter)
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.roles, companyFilter, locale],
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

  const departmentById = useMemo(
    () => new Map(data.departments.map((department) => [department.id, department])),
    [data.departments],
  );

  const roleById = useMemo(() => new Map(data.roles.map((role) => [role.id, role])), [data.roles]);

  const scoresByEmployee = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const review of data.performanceReviews) {
      const entry = totals.get(review.employeeId) ?? { sum: 0, count: 0 };
      entry.sum += review.score;
      entry.count += 1;
      totals.set(review.employeeId, entry);
    }
    const scores = new Map<string, number>();
    for (const [employeeId, entry] of totals) {
      scores.set(employeeId, Math.round(entry.sum / entry.count));
    }
    return scores;
  }, [data.performanceReviews]);

  const scopedReviews = useMemo(
    () =>
      data.performanceReviews.filter(
        (review) => companyFilter === 'all' || review.companyId === companyFilter,
      ),
    [data.performanceReviews, companyFilter],
  );

  const departmentMembers = useMemo(() => {
    const members = new Map<string, Employee[]>();
    for (const employee of data.employees) {
      if (!employee.departmentId) continue;
      const list = members.get(employee.departmentId) ?? [];
      list.push(employee);
      members.set(employee.departmentId, list);
    }
    return members;
  }, [data.employees]);

  const roleMembers = useMemo(() => {
    const members = new Map<string, Employee[]>();
    for (const employee of data.employees) {
      if (!employee.roleId) continue;
      const list = members.get(employee.roleId) ?? [];
      list.push(employee);
      members.set(employee.roleId, list);
    }
    return members;
  }, [data.employees]);

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

  const reviewedEmployees = employees.filter((employee) => scoresByEmployee.has(employee.id));
  const teamAverage = reviewedEmployees.length
    ? Math.round(
        reviewedEmployees.reduce(
          (sum, employee) => sum + (scoresByEmployee.get(employee.id) ?? 0),
          0,
        ) / reviewedEmployees.length,
      )
    : null;

  const assignedDepartmentCount = departments.filter(
    (department) => (departmentMembers.get(department.id)?.length ?? 0) > 0,
  ).length;
  const emptyDepartmentCount = departments.length - assignedDepartmentCount;
  const assignedDepartmentEmployees = employees.filter(
    (employee) => employee.departmentId && departmentById.has(employee.departmentId),
  ).length;
  const unassignedEmployees = employees.filter(
    (employee) => !employee.departmentId || !departmentById.has(employee.departmentId),
  ).length;

  const assignedRoleCount = roles.filter(
    (role) => (roleMembers.get(role.id)?.length ?? 0) > 0,
  ).length;
  const assignedRoleEmployees = employees.filter(
    (employee) => employee.roleId && roleById.has(employee.roleId),
  ).length;
  const usedPermissionCount = new Set(roles.flatMap((role) => role.permissions)).size;

  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const approvedApprovals = approvals.filter((approval) => approval.status === 'approved');
  const rejectedApprovals = approvals.filter((approval) => approval.status === 'rejected');

  const canAdd = data.companies.length > 0;

  const profileEmployee = profileEmployeeId
    ? data.employees.find((employee) => employee.id === profileEmployeeId) ?? null
    : null;

  const openNew = () => {
    if (tab === 'projects') {
      setEditingProject(null);
      setProjectModalOpen(true);
    } else if (tab === 'team') {
      setEditingEmployee(null);
      setEmployeeModalOpen(true);
    } else if (tab === 'departments') {
      setEditingDepartment(null);
      setDepartmentModalOpen(true);
    } else if (tab === 'roles') {
      setEditingRole(null);
      setRoleModalOpen(true);
    } else {
      setEditingApproval(null);
      setApprovalModalOpen(true);
    }
  };

  const openProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const openProfile = (employee: Employee) => {
    setProfileEmployeeId(employee.id);
  };

  const editProfile = (employee: Employee) => {
    setProfileEmployeeId(null);
    setEditingEmployee(employee);
    setEmployeeModalOpen(true);
  };

  const addReview = (employee: Employee) => {
    setReviewEmployee(employee);
    setEditingReview(null);
    setReviewModalOpen(true);
  };

  const editReview = (review: PerformanceReview, employee: Employee) => {
    setReviewEmployee(employee);
    setEditingReview(review);
    setReviewModalOpen(true);
  };

  const openDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentModalOpen(true);
  };

  const openRole = (role: Role) => {
    setEditingRole(role);
    setRoleModalOpen(true);
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
    tab === 'projects'
      ? t('Proje ekle')
      : tab === 'team'
        ? t('Çalışan ekle')
        : tab === 'departments'
          ? t('Departman ekle')
          : tab === 'roles'
            ? t('Rol ekle')
            : t('Talep oluştur');

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
        subtitle={t('Projeleri, ekibi, departmanları ve onay taleplerini tek yerden yönet. Her kayıt bir şirkete bağlanır.')}
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
                aria-selected={tab === 'departments'}
                className={`segment ${tab === 'departments' ? 'active' : ''}`}
                onClick={() => setTab('departments')}
              >
                {t('Departmanlar')} <span className="ops-tab-count">{departments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'roles'}
                className={`segment ${tab === 'roles' ? 'active' : ''}`}
                onClick={() => setTab('roles')}
              >
                {t('Roller')} <span className="ops-tab-count">{roles.length}</span>
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
                <KpiCard
                  label={t('Ortalama performans')}
                  value={teamAverage == null ? '—' : `${teamAverage}`}
                  hint={t('{count} çalışan değerlendirildi', { count: reviewedEmployees.length })}
                  icon={<Star size={16} />}
                  tone={teamAverage == null ? 'default' : scoreTone(teamAverage) === 'low' ? 'danger' : 'mint'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Ekip')}</h2>
                    <p>{t('{count} çalışan · {departments} departman · {reviews} değerlendirme', {
                      count: employees.length,
                      departments: departments.length,
                      reviews: scopedReviews.length,
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
                      <span>{t('Departman')}</span>
                      <span>{t('Şirket')}</span>
                      <span>{t('Performans')}</span>
                      <span>{t('Durum')}</span>
                    </div>
                    {employees.map((employee) => {
                      const company = companyById.get(employee.companyId);
                      const department = employee.departmentId
                        ? departmentById.get(employee.departmentId)
                        : undefined;
                      const score = scoresByEmployee.get(employee.id) ?? null;
                      return (
                        <button
                          type="button"
                          className="employee-row"
                          key={employee.id}
                          onClick={() => openProfile(employee)}
                        >
                          <span className="employee-identity">
                            <span className="employee-avatar">{initialsOf(employee.name)}</span>
                            <span className="employee-main">
                              <strong>{employee.name}</strong>
                              <span>{employee.role || t('Rol belirtilmedi')}</span>
                            </span>
                          </span>
                          <span className="employee-department">
                            {department ? (
                              <>
                                <span
                                  className="department-dot"
                                  style={{ background: department.color }}
                                  aria-hidden="true"
                                />
                                {department.name}
                              </>
                            ) : (
                              <span className="employee-muted">{t('Departmansız')}</span>
                            )}
                          </span>
                          <span className="employee-company">
                            <CompanyChip company={company} />
                          </span>
                          <span className={`employee-score score-${scoreTone(score)}`}>
                            <Star size={12} />
                            {score == null ? '—' : score}
                          </span>
                          <span className={`ops-status ops-status-${employee.status}`}>
                            {t(EMPLOYEE_STATUS_LABEL[employee.status])}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'departments' ? (
            <>
              <div className="kpi-grid ops-kpi-grid">
                <KpiCard
                  label={t('Toplam departman')}
                  value={departments.length}
                  hint={t('{count} çalışan atandı', { count: assignedDepartmentEmployees })}
                  icon={<Building2 size={16} />}
                />
                <KpiCard
                  label={t('Boş departman')}
                  value={emptyDepartmentCount}
                  hint={t('Çalışan atanmamış departman')}
                  icon={<FolderKanban size={16} />}
                  tone={emptyDepartmentCount ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Departmansız çalışan')}
                  value={unassignedEmployees}
                  hint={t('Departman ataması bekliyor')}
                  icon={<Users size={16} />}
                  tone={unassignedEmployees ? 'amber' : 'default'}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Departmanlar')}</h2>
                    <p>{t('{count} departman · {assigned} çalışan atandı', {
                      count: departments.length,
                      assigned: assignedDepartmentEmployees,
                    })}</p>
                  </div>
                </div>
                {departments.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Building2 size={18} />}
                    title={t('Departman yok')}
                    description={t('İlk departmanı oluştur; ekibi yapıya göre ayır.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingDepartment(null);
                          setDepartmentModalOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Departman ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="department-grid">
                    {departments.map((department) => {
                      const members = (departmentMembers.get(department.id) ?? [])
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, locale));
                      const company = companyById.get(department.companyId);
                      return (
                        <button
                          type="button"
                          className="department-card"
                          key={department.id}
                          onClick={() => openDepartment(department)}
                        >
                          <div className="department-card-top">
                            <span
                              className="department-dot"
                              style={{ background: department.color }}
                              aria-hidden="true"
                            />
                            <strong>{department.name}</strong>
                            <span className="department-count">
                              {t('{count} çalışan', { count: members.length })}
                            </span>
                          </div>
                          <p>{department.description || t('Açıklama yok')}</p>
                          <div className="department-card-footer">
                            {members.length ? (
                              <span className="department-avatars">
                                {members.slice(0, 3).map((member) => (
                                  <span className="department-avatar" key={member.id}>
                                    {initialsOf(member.name)}
                                  </span>
                                ))}
                                {members.length > 3 ? (
                                  <span className="department-avatar department-avatar-more">
                                    +{members.length - 3}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="employee-muted">{t('Çalışan atanmamış departman')}</span>
                            )}
                            <CompanyChip company={company} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {tab === 'roles' ? (
            <>
              <div className="kpi-grid ops-kpi-grid">
                <KpiCard
                  label={t('Toplam rol')}
                  value={roles.length}
                  hint={t('{count} rol tanımlı', { count: assignedRoleCount })}
                  icon={<ShieldCheck size={16} />}
                />
                <KpiCard
                  label={t('Atanmış çalışan')}
                  value={assignedRoleEmployees}
                  hint={t('Yetki rolü olan çalışan')}
                  icon={<Users size={16} />}
                  tone={assignedRoleEmployees ? 'mint' : 'default'}
                />
                <KpiCard
                  label={t('Tanımlı izin alanı')}
                  value={`${usedPermissionCount}/${PERMISSION_KEYS.length}`}
                  hint={t('8 alanın {count} tanesi tanımlı', { count: usedPermissionCount })}
                  icon={<ShieldCheck size={16} />}
                />
              </div>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>{t('Roller')}</h2>
                    <p>{t('{count} rol · {assigned} çalışan atandı', {
                      count: roles.length,
                      assigned: assignedRoleEmployees,
                    })}</p>
                  </div>
                </div>
                <p className="role-note">
                  <Info size={14} />
                  {t('Yetki rolleri ekip organizasyonu içindir; bu cihazdaki oturum erişimini kısıtlamaz.')}
                </p>
                {roles.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ShieldCheck size={18} />}
                    title={t('Rol yok')}
                    description={t('İlk yetki rolünü oluştur; ekip için izin kapsamını tanımla.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingRole(null);
                          setRoleModalOpen(true);
                        }}
                      >
                        <Plus size={14} /> {t('Rol ekle')}
                      </button>
                    }
                  />
                ) : (
                  <div className="role-grid">
                    {roles.map((role) => {
                      const members = roleMembers.get(role.id) ?? [];
                      const company = companyById.get(role.companyId);
                      return (
                        <button
                          type="button"
                          className="role-card"
                          key={role.id}
                          onClick={() => openRole(role)}
                        >
                          <div className="role-card-top">
                            <span className="role-icon">
                              <ShieldCheck size={15} />
                            </span>
                            <strong>{role.name}</strong>
                            <span className="department-count">
                              {t('{count} yetki', { count: role.permissions.length })}
                            </span>
                          </div>
                          <p>{role.description || t('Açıklama yok')}</p>
                          {role.permissions.length ? (
                            <div className="role-permissions">
                              {role.permissions.map((permission) => (
                                <span className="permission-chip" key={permission}>
                                  {t(PERMISSION_LABEL[permission])}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="employee-muted">{t('Yetki seçilmedi')}</span>
                          )}
                          <div className="department-card-footer">
                            <span className="department-count">
                              {t('{count} çalışan', { count: members.length })}
                            </span>
                            <CompanyChip company={company} />
                          </div>
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
      <EmployeeProfileModal
        open={profileEmployee != null}
        onClose={() => setProfileEmployeeId(null)}
        employee={profileEmployee}
        onEdit={editProfile}
        onAddReview={addReview}
        onEditReview={editReview}
      />
      <DepartmentModal
        open={departmentModalOpen}
        onClose={() => setDepartmentModalOpen(false)}
        department={editingDepartment}
        defaultCompanyId={defaultCompanyId}
      />
      <RoleModal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        role={editingRole}
        defaultCompanyId={defaultCompanyId}
      />
      <PerformanceReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        employee={reviewEmployee}
        review={editingReview}
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
