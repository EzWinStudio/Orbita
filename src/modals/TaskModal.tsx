import { useEffect, useRef, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { PRIORITY_LABEL } from '../constants';
import type { Task, TaskPriority } from '../types';

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultCompanyId?: string | null;
}

const PRIORITIES: TaskPriority[] = ['low', 'med', 'high'];

export function TaskModal({ open, onClose, task, defaultCompanyId }: TaskModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [due, setDue] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setCompanyId(task?.companyId ?? defaultCompanyId ?? '');
    setPriority(task?.priority ?? 'med');
    setDue(task?.due ?? '');
    setDone(task?.done ?? false);
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, task, defaultCompanyId]);

  const canSave = title.trim().length > 0;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      companyId: companyId || null,
      priority,
      due: due || null,
    };
    const success = task
      ? await actions.updateTask({ id: task.id, ...payload, done })
      : await actions.createTask(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!task) return;
    const sure = await confirm({
      title: t('Görev silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: task.title }),
      confirmLabel: t('Görevi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteTask(task.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={task ? t('Görevi düzenle') : t('Yeni görev')}
      subtitle={t('Yapılacak işi bir şirkete bağla, önceliğini belirle.')}
      onClose={onClose}
      size="sm"
      icon={<ListChecks size={17} />}
      footer={
        <div className="footer-split">
          {task ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Görevi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="task-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : task ? t('Kaydet') : t('Görevi ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Görev')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !canSave ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Bot v13 geçişini tamamla')}
            maxLength={200}
          />
          {touched && !canSave ? <span className="form-error">{t('Görev başlığı gerekli.')}</span> : null}
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">{t('Şirketsiz')}</option>
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Son tarih')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <div className="input-group">
              <input
                className="input"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
                max="2100-12-31"
              />
              {due ? (
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setDue('')}
                  aria-label={t('Tarihi temizle')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </label>
        </div>

        <div className="form-field">
          <span className="form-label">{t('Öncelik')}</span>
          <div className="segmented segmented-block">
            {PRIORITIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment priority-${item} ${priority === item ? 'active' : ''}`}
                onClick={() => setPriority(item)}
              >
                <span className={`priority-dot priority-dot-${item}`} />
                {t(PRIORITY_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        {task ? (
          <label className="switch-row">
            <span>
              <strong>{t('Tamamlandı')}</strong>
              <span>{t('Bu görev kapatılsın mı?')}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={done}
              className={`switch ${done ? 'on' : ''}`}
              onClick={() => setDone((prev) => !prev)}
            >
              <span className="switch-knob" />
            </button>
          </label>
        ) : null}
      </form>
    </Modal>
  );
}
