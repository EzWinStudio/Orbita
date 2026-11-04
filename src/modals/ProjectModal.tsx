import { useEffect, useRef, useState } from 'react';
import { FolderKanban, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '../constants';
import type { Project, ProjectStatus } from '../types';

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  defaultCompanyId?: string | null;
}

export function ProjectModal({ open, onClose, project, defaultCompanyId }: ProjectModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [progress, setProgress] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? '');
    setCompanyId(project?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setDescription(project?.description ?? '');
    setStatus(project?.status ?? 'active');
    setProgress(String(project?.progress ?? 0));
    setDueDate(project?.dueDate ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, project, defaultCompanyId, data?.companies]);

  const numericProgress = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)));
  const canSave = name.trim().length > 0 && Boolean(companyId);

  const chooseStatus = (next: ProjectStatus) => {
    setStatus(next);
    if (next === 'completed') setProgress('100');
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      companyId,
      description: description.trim(),
      status,
      progress: numericProgress,
      dueDate: dueDate || null,
    };
    const success = project
      ? await actions.updateProject({ id: project.id, ...payload })
      : await actions.createProject(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!project) return;
    const sure = await confirm({
      title: t('Proje silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: project.name }),
      confirmLabel: t('Projeyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteProject(project.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={project ? t('Projeyi düzenle') : t('Yeni proje')}
      subtitle={t('Projeyi bir şirkete bağla, durumunu ve ilerlemesini takip et.')}
      onClose={onClose}
      size="sm"
      icon={<FolderKanban size={17} />}
      footer={
        <div className="footer-split">
          {project ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Projeyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="project-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : project ? t('Kaydet') : t('Proje ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Proje adı')}</span>
          <input
            ref={nameRef}
            className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Örn. Yeni site lansmanı')}
            maxLength={160}
          />
          {touched && !name.trim() ? <span className="form-error">{t('Proje adı gerekli.')}</span> : null}
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Hedef tarih')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <div className="input-group">
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                max="2100-12-31"
              />
              {dueDate ? (
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setDueDate('')}
                  aria-label={t('Tarihi temizle')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('Projenin kapsamını kısa bir notla özetle.')}
            rows={3}
            maxLength={600}
          />
        </label>

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {PROJECT_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => chooseStatus(item)}
              >
                {t(PROJECT_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">{t('İlerleme')} <span className="form-optional">{numericProgress}%</span></span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
