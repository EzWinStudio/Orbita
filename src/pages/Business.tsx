import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Bug,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  FolderOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Workflow,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { EmployeeProfileModal } from '../modals/EmployeeProfileModal';
import { ClientModal } from '../modals/ClientModal';
import { ContractModal } from '../modals/ContractModal';
import { DocumentModal } from '../modals/DocumentModal';
import { BugModal } from '../modals/BugModal';
import { AutomationRuleModal } from '../modals/AutomationRuleModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import {
  BUG_SEVERITIES,
  BUG_SEVERITY_LABEL,
  BUG_STATUSES,
  BUG_STATUS_LABEL,
  CLIENT_STATUS_LABEL,
  CONTRACT_KIND_LABEL,
  CONTRACT_STATUS_LABEL,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  PRIORITY_LABEL,
} from '../constants';
import {
  buildInsights,
  companyHealthRows,
  contractDaysLeft,
  contractEffectiveStatus,
  departmentMetrics,
  employeeRanking,
  expiringContracts,
  followUpClients,
  openBugs,
} from '../lib/enterprise';
import { deleteDocumentFile, formatFileSize, loadDocumentFile, openDocumentBlob, downloadDocumentBlob } from '../lib/docStore';
import { invoiceTotal } from '../lib/finance';
import { formatDate, formatMoney, relativeTime } from '../lib/format';
import type {
  AutomationRule,
  BugReport,
  BugStatus,
  Client,
  CompanyDocument,
  Contract,
  Employee,
} from '../types';
import type { TranslationKey } from '../i18n/core';
import type { Page } from '../nav';

interface BusinessProps {
  navigate: (page: Page, companyId?: string | null) => void;
}

type BusinessTab =
  | 'analysis'
  | 'ranking'
  | 'automation'
  | 'documents'
  | 'contracts'
  | 'clients'
  | 'bugs'
  | 'departments';

const TABS: BusinessTab[] = [
  'analysis',
  'ranking',
  'automation',
  'documents',
  'contracts',
  'clients',
  'bugs',
  'departments',
];

const TAB_LABEL: Record<BusinessTab, TranslationKey> = {
  analysis: 'Yapay zekâ analizi',
  ranking: 'Çalışan sıralaması',
  automation: 'Görev otomasyonu',
  documents: 'Belge merkezi',
  contracts: 'Sözleşmeler',
  clients: 'Müşteriler',
  bugs: 'Hata takibi',
  departments: 'Departman analizi',
};

function scoreTone(score: number | null): string {
  if (score === null) return 'none';
  if (score >= 85) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

export function Business({ navigate }: BusinessProps) {
  const data = useAppData();
  const { actions, confirm, toast } = useApp();
  const { t, language } = useI18n();
  const [tab, setTab] = useState<BusinessTab>('analysis');
  const [companyFilter, setCompanyFilter] = useState('');
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CompanyDocument | null>(null);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [documentFilter, setDocumentFilter] = useState('');
  const [bugStatusFilter, setBugStatusFilter] = useState<BugStatus | ''>('');
  const [bugSeverityFilter, setBugSeverityFilter] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('');

  const companyName = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company.name])),
    [data.companies],
  );
  const health = useMemo(() => companyHealthRows(data), [data]);
  const ranking = useMemo(() => employeeRanking(data), [data]);
  const departments = useMemo(() => departmentMetrics(data), [data]);
  const insights = useMemo(() => buildInsights(data, t), [data, t]);
  const expiring = useMemo(() => expiringContracts(data.contracts, 30), [data.contracts]);
  const pendingBugs = useMemo(() => openBugs(data.bugs), [data.bugs]);
  const followUps = useMemo(() => followUpClients(data.clients, 7), [data.clients]);

  const analysisCompany = useMemo(
    () => data.companies.find((company) => company.id === companyFilter) ?? data.companies[0] ?? null,
    [data.companies, companyFilter],
  );
  const analysisHealth = health.find((row) => row.companyId === analysisCompany?.id) ?? null;

  const filterByCompany = <T extends { companyId: string },>(items: T[]) =>
    companyFilter ? items.filter((item) => item.companyId === companyFilter) : items;

  const clientRevenue = useMemo(() => {
    const totals = new Map<string, { count: number; total: number }>();
    for (const invoice of data.invoices) {
      if (invoice.status === 'draft' || invoice.status === 'canceled') continue;
      const key = `${invoice.companyId}|${invoice.customerName.trim().toLocaleLowerCase(language)}`;
      const current = totals.get(key) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += invoiceTotal(invoice);
      totals.set(key, current);
    }
    return totals;
  }, [data.invoices, language]);

  const openDocument = async (document: CompanyDocument, download = false) => {
    if (!document.hasFile) {
      toast('info', t('Bu belge kaydında dosya yok.'));
      return;
    }
    try {
      const blob = await loadDocumentFile(document.id);
      if (!blob) {
        toast('error', t('Dosya bu cihazda bulunamadı; yalnızca belge kaydı var.'));
        return;
      }
      if (download) downloadDocumentBlob(blob, document.fileName || document.title);
      else openDocumentBlob(blob);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('Dosya açılamadı.'));
    }
  };

  const removeDocument = async (document: CompanyDocument) => {
    const sure = await confirm({
      title: t('Belge silinsin mi?'),
      message: t('“{title}” belgesi ve cihazdaki dosyası kaldırılacak.', { title: document.title }),
      confirmLabel: t('Belgeyi sil'),
    });
    if (!sure) return;
    await deleteDocumentFile(document.id).catch(() => undefined);
    await actions.deleteDocument(document.id);
  };

  const removeClient = async (client: Client) => {
    const sure = await confirm({
      title: t('Müşteri silinsin mi?'),
      message: t('“{name}” müşteri kaydı kaldırılacak.', { name: client.name }),
      confirmLabel: t('Müşteriyi sil'),
    });
    if (sure) await actions.deleteClient(client.id);
  };

  const removeContract = async (contract: Contract) => {
    const sure = await confirm({
      title: t('Sözleşme silinsin mi?'),
      message: t('“{title}” sözleşmesi kaldırılacak.', { title: contract.title }),
      confirmLabel: t('Sözleşmeyi sil'),
    });
    if (sure) await actions.deleteContract(contract.id);
  };

  const removeBug = async (bug: BugReport) => {
    const sure = await confirm({
      title: t('Hata kaydı silinsin mi?'),
      message: t('“{title}” hata kaydı kaldırılacak.', { title: bug.title }),
      confirmLabel: t('Hata kaydını sil'),
    });
    if (sure) await actions.deleteBug(bug.id);
  };

  const removeRule = async (rule: AutomationRule) => {
    const sure = await confirm({
      title: t('Otomasyon kuralı silinsin mi?'),
      message: t('“{title}” kuralı kaldırılacak. Oluşturulmuş görevler korunur.', {
        title: rule.title,
      }),
      confirmLabel: t('Kuralı sil'),
    });
    if (sure) await actions.deleteAutomationRule(rule.id);
  };

  const runRule = async (rule: AutomationRule) => {
    if (!rule.enabled) {
      toast('info', t('Kural pasif durumda.'));
      return;
    }
    await actions.runAutomationRule(rule.id);
  };

  const filteredDocuments = filterByCompany(data.documents).filter(
    (document) => !documentFilter || document.category === documentFilter,
  );
  const filteredContracts = filterByCompany(data.contracts).sort((a, b) => {
    const aLeft = contractDaysLeft(a) ?? 9999;
    const bLeft = contractDaysLeft(b) ?? 9999;
    return aLeft - bLeft;
  });
  const filteredClients = filterByCompany(data.clients).filter(
    (client) => !clientStatusFilter || client.status === clientStatusFilter,
  );
  const filteredBugs = filterByCompany(data.bugs).filter((bug) => {
    if (bugStatusFilter && bug.status !== bugStatusFilter) return false;
    if (bugSeverityFilter && bug.severity !== bugSeverityFilter) return false;
    return true;
  });
  const filteredRules = filterByCompany(data.automationRules);
  const filteredRanking = ranking.filter((employee) => {
    if (!companyFilter) return true;
    return employee.companyId === companyFilter;
  });
  const filteredDepartments = companyFilter
    ? departments.filter((department) => department.companyId === companyFilter)
    : departments;

  return (
    <>
      <PageHeader
        eyebrow={t('Kurumsal')}
        title={t('İş merkezi')}
        subtitle={t('Yapay zekâ analizi, ekip sıralaması, otomasyon, belge, sözleşme, müşteri ve hata yönetimi.')}
        actions={
          <div className="page-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate('admin')}>
              <BarChart3 size={15} /> {t('Yönetim')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('assistant')}>
              <Sparkles size={15} /> {t('Asistan')}
            </button>
          </div>
        }
      />

      <div className="biz-toolbar">
        <div className="segmented ops-tabs biz-tabs" role="tablist" aria-label={t('İş merkezi görünümü')}>
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item}
              aria-selected={tab === item}
              className={`segment ${tab === item ? 'active' : ''}`}
              onClick={() => setTab(item)}
            >
              {t(TAB_LABEL[item])}
            </button>
          ))}
        </div>
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
      </div>

      {tab === 'analysis' ? (
        <>
          <div className="kpi-grid adm-kpis">
            <KpiCard
              label={t('Gelir')}
              value={formatMoney(analysisHealth?.revenue ?? 0, data.settings.currency)}
              hint={analysisCompany?.name ?? t('Şirket yok')}
              icon={<BarChart3 size={16} />}
              tone="mint"
            />
            <KpiCard
              label={t('Gider')}
              value={formatMoney(analysisHealth?.expense ?? 0, data.settings.currency)}
              hint={t('Tüm kayıtlar')}
              icon={<FileText size={16} />}
            />
            <KpiCard
              label={t('Net sonuç')}
              value={formatMoney(analysisHealth?.net ?? 0, data.settings.currency)}
              hint={t('Gelir − gider')}
              icon={<Sparkles size={16} />}
              tone={(analysisHealth?.net ?? 0) < 0 ? 'danger' : 'default'}
            />
            <KpiCard
              label={t('Açık görev')}
              value={analysisHealth?.openTasks ?? 0}
              hint={t('{count} açık görev', { count: analysisHealth?.openTasks ?? 0 })}
              icon={<CheckCircle2 size={16} />}
            />
            <KpiCard
              label={t('Aktif sözleşme')}
              value={analysisHealth?.activeContracts ?? 0}
              hint={t('{count} yakında bitiyor', { count: expiring.length })}
              icon={<FileSignature size={16} />}
              tone={expiring.length > 0 ? 'amber' : 'default'}
            />
          </div>

          <div className="biz-analysis-grid">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Analiz sinyalleri')}</h2>
                  <p>{t('Yerel kayıtlardan hesaplanır; dış servise veri gönderilmez.')}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('assistant')}>
                  <Sparkles size={14} /> {t('Asistan’a sor')}
                </button>
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
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t('Öne çıkanlar')}</h2>
                  <p>{t('Ekip, departman ve müşteri özeti.')}</p>
                </div>
              </div>
              <div className="biz-highlight-list">
                <div>
                  <Trophy size={15} />
                  <span>
                    <strong>{t('En yüksek performans')}</strong>
                    <span>
                      {ranking.find((employee) => employee.score !== null)
                        ? `${ranking.find((employee) => employee.score !== null)?.name} · ${ranking.find((employee) => employee.score !== null)?.score}`
                        : t('Değerlendirme yok')}
                    </span>
                  </span>
                </div>
                <div>
                  <Users size={15} />
                  <span>
                    <strong>{t('En kalabalık departman')}</strong>
                    <span>
                      {departments.slice().sort((a, b) => b.headcount - a.headcount)[0]?.name ??
                        t('Departman yok')}
                    </span>
                  </span>
                </div>
                <div>
                  <BriefcaseBusiness size={15} />
                  <span>
                    <strong>{t('Takip bekleyen müşteri')}</strong>
                    <span>{t('{count} müşteri', { count: followUps.length })}</span>
                  </span>
                </div>
                <div>
                  <AlertTriangle size={15} />
                  <span>
                    <strong>{t('Kritik hata')}</strong>
                    <span>
                      {t('{count} kayıt', {
                        count: pendingBugs.filter((bug) => bug.severity === 'critical').length,
                      })}
                    </span>
                  </span>
                </div>
              </div>
              <p className="adm-muted">
                {t('Bu analiz yalnızca Orbita içindeki kayıtları kullanır; tahmin veya dış veri içermez.')}
              </p>
            </section>
          </div>
        </>
      ) : null}

      {tab === 'ranking' ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{t('Çalışan performans sıralaması')}</h2>
              <p>{t('En güncel değerlendirme puanına göre sıralanır. Puansız çalışanlar sonda listelenir.')}</p>
            </div>
            <span className="adm-count">{t('{count} çalışan', { count: filteredRanking.length })}</span>
          </div>
          {filteredRanking.length === 0 ? (
            <EmptyState
              compact
              icon={<Trophy size={18} />}
              title={t('Sıralama için çalışan yok')}
              description={t('Operasyon sayfasında çalışan ve performans değerlendirmesi ekleyebilirsin.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('operations')}>
                  {t('Operasyon')}
                </button>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table biz-ranking-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('Çalışan')}</th>
                    <th>{t('Şirket')}</th>
                    <th>{t('Puan')}</th>
                    <th>{t('Değerlendirme')}</th>
                    <th>{t('Açık görev')}</th>
                    <th>{t('Tamamlanan')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredRanking.map((employee, index) => {
                    const record = data.employees.find((item) => item.id === employee.id) ?? null;
                    return (
                      <tr key={employee.id}>
                        <td>
                          <span className={`biz-rank-index rank-${index < 3 ? index + 1 : 'rest'}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td>
                          <strong>{employee.name}</strong>
                          <span className="adm-cell-sub">
                            {data.departments.find((item) => item.id === employee.departmentId)?.name ??
                              t('Departmansız')}
                          </span>
                        </td>
                        <td>{companyName.get(employee.companyId) ?? ''}</td>
                        <td>
                          <span className={`biz-score score-${scoreTone(employee.score)}`}>
                            {employee.score ?? '—'}
                          </span>
                        </td>
                        <td>
                          {employee.reviewCount > 0
                            ? t('{count} kayıt · {period}', {
                                count: employee.reviewCount,
                                period: employee.lastPeriod ?? '',
                              })
                            : t('Yok')}
                        </td>
                        <td>{employee.openTasks}</td>
                        <td>{employee.doneTasks}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={!record}
                            onClick={() => setProfileEmployee(record)}
                          >
                            <Eye size={14} /> {t('Profil')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'automation' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Görev otomasyonu')}</h2>
              <p>{t('Kurallar çalıştırıldığında atanan kişiye görev oluşturulur ve sonraki tarih ilerler.')}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => { setEditingRule(null); setRuleModalOpen(true); }}>
              <Plus size={15} /> {t('Kural ekle')}
            </button>
          </div>
          {filteredRules.length === 0 ? (
            <EmptyState
              icon={<Workflow size={20} />}
              title={t('Otomasyon kuralı yok')}
              description={t('Haftalık kontrol veya aylık rapor görevi için ilk kuralı oluştur.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => { setEditingRule(null); setRuleModalOpen(true); }}>
                  {t('Kural ekle')}
                </button>
              }
            />
          ) : (
            <div className="biz-rule-grid">
              {filteredRules.map((rule) => {
                const assignee = data.employees.find((employee) => employee.id === rule.assigneeId);
                return (
                  <article key={rule.id} className={`card biz-rule ${rule.enabled ? '' : 'is-paused'}`}>
                    <div className="biz-rule-head">
                      <span className="biz-rule-icon">
                        <Workflow size={16} />
                      </span>
                      <span>
                        <strong>{rule.title}</strong>
                        <span>
                          {companyName.get(rule.companyId) ?? ''} · {t(PRIORITY_LABEL[rule.priority])}
                        </span>
                      </span>
                      <span className={`status-pill ${rule.enabled ? 'status-active' : 'status-paused'}`}>
                        {rule.enabled ? t('Aktif') : t('Pasif')}
                      </span>
                    </div>
                    <dl className="biz-rule-facts">
                      <div>
                        <dt>{t('Atanan')}</dt>
                        <dd>{assignee?.name ?? t('Atanmadı')}</dd>
                      </div>
                      <div>
                        <dt>{t('Sonraki çalışma')}</dt>
                        <dd>{formatDate(rule.nextRun)}</dd>
                      </div>
                      <div>
                        <dt>{t('Son çalışma')}</dt>
                        <dd>{rule.lastRun ? relativeTime(rule.lastRun) : t('Henüz çalışmadı')}</dd>
                      </div>
                    </dl>
                    <div className="biz-rule-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void actions.updateAutomationRule({ id: rule.id, enabled: !rule.enabled })}
                      >
                        {rule.enabled ? <Pause size={14} /> : <Play size={14} />}
                        {rule.enabled ? t('Duraklat') : t('Etkinleştir')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!rule.enabled}
                        onClick={() => void runRule(rule)}
                      >
                        <Play size={14} /> {t('Şimdi çalıştır')}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => { setEditingRule(rule); setRuleModalOpen(true); }}
                        aria-label={t('Düzenle')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => void removeRule(rule)}
                        aria-label={t('Sil')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === 'documents' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Belge merkezi')}</h2>
              <p>{t('Kayıtlar eşitlenir; dosya içeriği bu cihazda saklanır ve 8 MB ile sınırlıdır.')}</p>
            </div>
            <div className="biz-section-actions">
              <select
                className="input select adm-select"
                value={documentFilter}
                onChange={(event) => setDocumentFilter(event.target.value)}
                aria-label={t('Kategori')}
              >
                <option value="">{t('Tüm kategoriler')}</option>
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(DOCUMENT_CATEGORY_LABEL[category])}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={() => { setEditingDocument(null); setDocumentModalOpen(true); }}>
                <Plus size={15} /> {t('Belge ekle')}
              </button>
            </div>
          </div>
          {filteredDocuments.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={20} />}
              title={t('Belge yok')}
              description={t('Sözleşme, fatura veya proje belgesini kaydet; dosya bu cihazda kalır.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => { setEditingDocument(null); setDocumentModalOpen(true); }}>
                  {t('Belge ekle')}
                </button>
              }
            />
          ) : (
            <div className="biz-doc-list">
              {filteredDocuments.map((document) => (
                <article key={document.id} className="card biz-doc-row">
                  <span className="biz-doc-icon">
                    <FileText size={18} />
                  </span>
                  <span className="biz-doc-copy">
                    <strong>{document.title}</strong>
                    <span>
                      {t(DOCUMENT_CATEGORY_LABEL[document.category])} ·{' '}
                      {companyName.get(document.companyId) ?? ''} ·{' '}
                      {document.hasFile
                        ? `${document.fileName || t('Dosya')} · ${formatFileSize(document.size)}`
                        : t('Dosyasız kayıt')}
                    </span>
                    {document.note ? <span>{document.note}</span> : null}
                  </span>
                  <span className="biz-doc-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!document.hasFile}
                      onClick={() => void openDocument(document)}
                    >
                      <ExternalLink size={14} /> {t('Aç')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={!document.hasFile}
                      onClick={() => void openDocument(document, true)}
                      aria-label={t('İndir')}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => { setEditingDocument(document); setDocumentModalOpen(true); }}
                      aria-label={t('Düzenle')}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => void removeDocument(document)}
                      aria-label={t('Sil')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'contracts' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Sözleşme yönetimi')}</h2>
              <p>{t('Bitiş tarihi geçen sözleşmeler otomatik olarak “Süresi doldu” görünür.')}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => { setEditingContract(null); setContractModalOpen(true); }}>
              <Plus size={15} /> {t('Sözleşme ekle')}
            </button>
          </div>
          {filteredContracts.length === 0 ? (
            <EmptyState
              icon={<FileSignature size={20} />}
              title={t('Sözleşme yok')}
              description={t('Hizmet, tedarik veya gizlilik sözleşmesini kaydet.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => { setEditingContract(null); setContractModalOpen(true); }}>
                  {t('Sözleşme ekle')}
                </button>
              }
            />
          ) : (
            <div className="table-scroll card">
              <table className="data-table biz-contract-table">
                <thead>
                  <tr>
                    <th>{t('Sözleşme')}</th>
                    <th>{t('Şirket')}</th>
                    <th>{t('Tür')}</th>
                    <th>{t('Bitiş')}</th>
                    <th>{t('Değer')}</th>
                    <th>{t('Durum')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => {
                    const status = contractEffectiveStatus(contract);
                    const days = contractDaysLeft(contract);
                    return (
                      <tr key={contract.id}>
                        <td>
                          <strong>{contract.title}</strong>
                          <span className="adm-cell-sub">{contract.counterparty}</span>
                        </td>
                        <td>{companyName.get(contract.companyId) ?? ''}</td>
                        <td>{t(CONTRACT_KIND_LABEL[contract.kind])}</td>
                        <td>
                          {contract.endDate ? formatDate(contract.endDate) : '—'}
                          {days !== null && days >= 0 && days <= 30 ? (
                            <span className="biz-inline-warning">
                              <CalendarClock size={12} /> {t('{count} gün', { count: days })}
                            </span>
                          ) : null}
                        </td>
                        <td>{formatMoney(contract.value, data.settings.currency)}</td>
                        <td>
                          <span className={`status-pill status-${status}`}>
                            {t(CONTRACT_STATUS_LABEL[status])}
                          </span>
                        </td>
                        <td>
                          <div className="biz-row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => { setEditingContract(contract); setContractModalOpen(true); }}
                              aria-label={t('Düzenle')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              onClick={() => void removeContract(contract)}
                              aria-label={t('Sil')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {tab === 'clients' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Müşteri yönetimi')}</h2>
              <p>{t('Fatura eşleşmesi aynı şirketteki müşteri adına göre hesaplanır.')}</p>
            </div>
            <div className="biz-section-actions">
              <select
                className="input select adm-select"
                value={clientStatusFilter}
                onChange={(event) => setClientStatusFilter(event.target.value)}
                aria-label={t('Durum')}
              >
                <option value="">{t('Tüm durumlar')}</option>
                {(['lead', 'active', 'paused', 'lost'] as const).map((status) => (
                  <option key={status} value={status}>
                    {t(CLIENT_STATUS_LABEL[status])}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={() => { setEditingClient(null); setClientModalOpen(true); }}>
                <Plus size={15} /> {t('Müşteri ekle')}
              </button>
            </div>
          </div>
          {filteredClients.length === 0 ? (
            <EmptyState
              icon={<BriefcaseBusiness size={20} />}
              title={t('Müşteri yok')}
              description={t('Müşteri ve iş takibini buradan başlat.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => { setEditingClient(null); setClientModalOpen(true); }}>
                  {t('Müşteri ekle')}
                </button>
              }
            />
          ) : (
            <div className="biz-client-grid">
              {filteredClients.map((client) => {
                const match = clientRevenue.get(
                  `${client.companyId}|${client.name.trim().toLocaleLowerCase(language)}`,
                );
                return (
                  <article key={client.id} className="card biz-client">
                    <div className="biz-client-head">
                      <span className="biz-client-avatar">{client.name.slice(0, 2).toLocaleUpperCase(language)}</span>
                      <span>
                        <strong>{client.name}</strong>
                        <span>{companyName.get(client.companyId) ?? ''}</span>
                      </span>
                      <span className={`status-pill status-${client.status}`}>
                        {t(CLIENT_STATUS_LABEL[client.status])}
                      </span>
                    </div>
                    <dl className="biz-client-facts">
                      <div>
                        <dt>{t('İlgili kişi')}</dt>
                        <dd>{client.contactName || '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('İletişim')}</dt>
                        <dd>{client.email || client.phone || '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('Eşleşen fatura')}</dt>
                        <dd>
                          {match
                            ? `${match.count} · ${formatMoney(match.total, data.settings.currency)}`
                            : t('Eşleşme yok')}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('Sonraki takip')}</dt>
                        <dd>{client.nextFollowUp ? formatDate(client.nextFollowUp) : '—'}</dd>
                      </div>
                    </dl>
                    <div className="biz-client-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingClient(client); setClientModalOpen(true); }}
                      >
                        <Pencil size={14} /> {t('Düzenle')}
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => void removeClient(client)}
                        aria-label={t('Sil')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === 'bugs' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Hata takibi')}</h2>
              <p>{t('Yazılım projeleri için hata, önem ve çözüm durumu.')}</p>
            </div>
            <div className="biz-section-actions">
              <select
                className="input select adm-select"
                value={bugStatusFilter}
                onChange={(event) => setBugStatusFilter(event.target.value as BugStatus | '')}
                aria-label={t('Durum')}
              >
                <option value="">{t('Tüm durumlar')}</option>
                {BUG_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(BUG_STATUS_LABEL[status])}
                  </option>
                ))}
              </select>
              <select
                className="input select adm-select"
                value={bugSeverityFilter}
                onChange={(event) => setBugSeverityFilter(event.target.value)}
                aria-label={t('Önem')}
              >
                <option value="">{t('Tüm önemler')}</option>
                {BUG_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {t(BUG_SEVERITY_LABEL[severity])}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={() => { setEditingBug(null); setBugModalOpen(true); }}>
                <Plus size={15} /> {t('Hata kaydı aç')}
              </button>
            </div>
          </div>
          {filteredBugs.length === 0 ? (
            <EmptyState
              icon={<Bug size={20} />}
              title={t('Hata kaydı yok')}
              description={t('Projelerde karşılaşılan hataları buradan izle.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => { setEditingBug(null); setBugModalOpen(true); }}>
                  {t('Hata kaydı aç')}
                </button>
              }
            />
          ) : (
            <div className="biz-bug-list">
              {filteredBugs.map((bug) => {
                const project = data.projects.find((item) => item.id === bug.projectId);
                const assignee = data.employees.find((employee) => employee.id === bug.assigneeId);
                return (
                  <article key={bug.id} className={`card biz-bug severity-${bug.severity}`}>
                    <div className="biz-bug-head">
                      <span className={`bug-severity severity-${bug.severity}`}>
                        {t(BUG_SEVERITY_LABEL[bug.severity])}
                      </span>
                      <span className="biz-bug-copy">
                        <strong>{bug.title}</strong>
                        <span>
                          {companyName.get(bug.companyId) ?? ''}
                          {project ? ` · ${project.name}` : ''}
                          {bug.reportedBy ? ` · ${bug.reportedBy}` : ''}
                        </span>
                      </span>
                      <span className={`status-pill status-${bug.status}`}>
                        {t(BUG_STATUS_LABEL[bug.status])}
                      </span>
                    </div>
                    {bug.description ? <p className="biz-bug-desc">{bug.description}</p> : null}
                    <div className="biz-bug-foot">
                      <span>
                        {t('Atanan')}: {assignee?.name ?? t('Atanmadı')} ·{' '}
                        {relativeTime(bug.createdAt)}
                      </span>
                      <span className="biz-bug-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => { setEditingBug(bug); setBugModalOpen(true); }}
                          aria-label={t('Düzenle')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => void removeBug(bug)}
                          aria-label={t('Sil')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === 'departments' ? (
        <>
          <div className="biz-section-head">
            <div>
              <h2>{t('Departman analizi')}</h2>
              <p>{t('Ekip büyüklüğü, ortalama performans ve operasyon yoğunluğu.')}</p>
            </div>
            <span className="adm-count">{t('{count} departman', { count: filteredDepartments.length })}</span>
          </div>
          {filteredDepartments.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={20} />}
              title={t('Departman yok')}
              description={t('Operasyon sayfasında departman oluşturduğunda burada analiz edilir.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('operations')}>
                  {t('Operasyon')}
                </button>
              }
            />
          ) : (
            <div className="biz-department-grid">
              {filteredDepartments.map((department) => (
                <article key={department.id} className="card biz-department">
                  <div className="biz-department-head">
                    <span className="company-dot" style={{ background: department.color }} />
                    <span>
                      <strong>{department.name}</strong>
                      <span>{companyName.get(department.companyId) ?? ''}</span>
                    </span>
                    <span className={`biz-score score-${scoreTone(department.avgScore)}`}>
                      {department.avgScore ?? '—'}
                    </span>
                  </div>
                  <div className="biz-score-bar" aria-hidden="true">
                    <span style={{ width: `${department.avgScore ?? 0}%` }} />
                  </div>
                  <dl className="biz-department-facts">
                    <div>
                      <dt>{t('Ekip')}</dt>
                      <dd>{department.headcount}</dd>
                    </div>
                    <div>
                      <dt>{t('İzinde')}</dt>
                      <dd>{department.onLeave}</dd>
                    </div>
                    <div>
                      <dt>{t('Değerlendirme')}</dt>
                      <dd>{department.reviewCount}</dd>
                    </div>
                    <div>
                      <dt>{t('Açık görev')}</dt>
                      <dd>{department.openTasks}</dd>
                    </div>
                    <div>
                      <dt>{t('Duyuru')}</dt>
                      <dd>{department.announcements}</dd>
                    </div>
                    <div>
                      <dt>{t('Toplantı')}</dt>
                      <dd>{department.meetings}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      <ClientModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        client={editingClient}
        defaultCompanyId={companyFilter || null}
      />
      <ContractModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        contract={editingContract}
        defaultCompanyId={companyFilter || null}
      />
      <DocumentModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        document={editingDocument}
        defaultCompanyId={companyFilter || null}
      />
      <BugModal
        open={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
        bug={editingBug}
        defaultCompanyId={companyFilter || null}
      />
      <AutomationRuleModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        rule={editingRule}
        defaultCompanyId={companyFilter || null}
      />
      <EmployeeProfileModal
        open={Boolean(profileEmployee)}
        onClose={() => setProfileEmployee(null)}
        employee={profileEmployee}
        onEdit={() => navigate('operations')}
        onAddReview={() => navigate('operations')}
        onEditReview={() => navigate('operations')}
      />
    </>
  );
}
