import { useEffect, useMemo, useRef, useState } from 'react';
import { Bug } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { BUG_SEVERITIES, BUG_SEVERITY_LABEL, BUG_STATUSES, BUG_STATUS_LABEL } from '../constants';
import type { BugReport, BugSeverity, BugStatus } from '../types';

interface BugModalProps {
  open: boolean;
  onClose: () => void;
  bug?: BugReport | null;
  defaultCompanyId?: string | null;
}

export function BugModal({ open, onClose, bug, defaultCompanyId }: BugModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('medium');
  const [status, setStatus] = useState<BugStatus>('open');
  const [reportedBy, setReportedBy] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(bug?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setProjectId(bug?.projectId ?? '');
    setTitle(bug?.title ?? '');
    setDescription(bug?.description ?? '');
    setSeverity(bug?.severity ?? 'medium');
    setStatus(bug?.status ?? 'open');
    setReportedBy(bug?.reportedBy ?? '');
    setAssigneeId(bug?.assigneeId ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, bug, defaultCompanyId, data?.companies]);

  const projects = useMemo(
    () => (data?.projects ?? []).filter((project) => project.companyId === companyId),
    [data?.projects, companyId],
  );
  const employees = useMemo(
    () =>
      (data?.employees ?? []).filter(
        (employee) => employee.companyId === companyId && employee.status !== 'inactive',
      ),
    [data?.employees, companyId],
  );

  const canSave = Boolean(companyId) && title.trim().length > 0;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      projectId: projectId || null,
      title: title.trim(),
      description: description.trim(),
      severity,
      status,
      reportedBy: reportedBy.trim(),
      assigneeId: assigneeId || null,
    };
    const ok = bug
      ? await actions.updateBug({ id: bug.id, ...payload })
      : await actions.createBug(payload);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!bug) return;
    const sure = await confirm({
      title: t('Hata kaydı silinsin mi?'),
      message: t('“{title}” hata kaydı kaldırılacak.', { title: bug.title }),
      confirmLabel: t('Hata kaydını sil'),
    });
    if (!sure) return;
    setBusy(true);
    const ok = await actions.deleteBug(bug.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={bug ? t('Hata kaydını düzenle') : t('Yeni hata kaydı')}
      subtitle={t('Yazılım projeleri için hata, önem ve çözüm durumu takibi.')}
      onClose={onClose}
      size="md"
      icon={<Bug size={17} />}
      footer={
        <div className="footer-split">
          {bug ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Hata kaydını sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="bug-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : bug ? t('Kaydet') : t('Hata kaydı aç')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="bug-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setProjectId('');
                setAssigneeId('');
              }}
            >
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Proje')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <select className="input select" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">{t('Projesiz')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Hata başlığı')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Ödeme adımında boş ekran')}
            maxLength={200}
          />
          {touched && !title.trim() ? <span className="form-error">{t('Hata başlığı gerekli.')}</span> : null}
        </label>

        <label className="form-field">
          <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('Yeniden üretme adımları, beklenen ve gerçek sonuç…')}
            rows={4}
            maxLength={4000}
          />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Önem')}</span>
            <select className="input select" value={severity} onChange={(event) => setSeverity(event.target.value as BugSeverity)}>
              {BUG_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {t(BUG_SEVERITY_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Durum')}</span>
            <select className="input select" value={status} onChange={(event) => setStatus(event.target.value as BugStatus)}>
              {BUG_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(BUG_STATUS_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Bildiren')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input className="input" value={reportedBy} onChange={(event) => setReportedBy(event.target.value)} maxLength={120} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Atanan')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <select className="input select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">{t('Atanmadı')}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>
    </Modal>
  );
}
