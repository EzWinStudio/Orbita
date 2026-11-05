import { useEffect, useMemo, useRef, useState } from 'react';
import { Workflow } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { AUTOMATION_CADENCES, AUTOMATION_CADENCE_LABEL, PRIORITY_LABEL } from '../constants';
import { todayISO } from '../lib/format';
import type { AutomationCadence, AutomationRule, TaskPriority } from '../types';

const PRIORITIES: TaskPriority[] = ['low', 'med', 'high'];

interface AutomationRuleModalProps {
  open: boolean;
  onClose: () => void;
  rule?: AutomationRule | null;
  defaultCompanyId?: string | null;
}

export function AutomationRuleModal({
  open,
  onClose,
  rule,
  defaultCompanyId,
}: AutomationRuleModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [assigneeId, setAssigneeId] = useState('');
  const [cadence, setCadence] = useState<AutomationCadence>('weekly');
  const [nextRun, setNextRun] = useState(todayISO());
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(rule?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setTitle(rule?.title ?? '');
    setPriority(rule?.priority ?? 'med');
    setAssigneeId(rule?.assigneeId ?? '');
    setCadence(rule?.cadence ?? 'weekly');
    setNextRun(rule?.nextRun ?? todayISO());
    setEnabled(rule?.enabled ?? true);
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, rule, defaultCompanyId, data?.companies]);

  const employees = useMemo(
    () =>
      (data?.employees ?? []).filter(
        (employee) => employee.companyId === companyId && employee.status !== 'inactive',
      ),
    [data?.employees, companyId],
  );

  const canSave = Boolean(companyId) && title.trim().length > 0 && Boolean(nextRun);

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      title: title.trim(),
      priority,
      assigneeId: assigneeId || null,
      cadence,
      nextRun,
      enabled,
    };
    const ok = rule
      ? await actions.updateAutomationRule({ id: rule.id, ...payload })
      : await actions.createAutomationRule(payload);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!rule) return;
    const sure = await confirm({
      title: t('Otomasyon kuralı silinsin mi?'),
      message: t('“{title}” kuralı kaldırılacak. Oluşturulmuş görevler korunur.', {
        title: rule.title,
      }),
      confirmLabel: t('Kuralı sil'),
    });
    if (!sure) return;
    setBusy(true);
    const ok = await actions.deleteAutomationRule(rule.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={rule ? t('Otomasyon kuralını düzenle') : t('Yeni otomasyon kuralı')}
      subtitle={t('Kural çalıştırıldığında görev oluşturulur ve sonraki tarih otomatik ilerler.')}
      onClose={onClose}
      size="sm"
      icon={<Workflow size={17} />}
      footer={
        <div className="footer-split">
          {rule ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Kuralı sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="automation-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : rule ? t('Kaydet') : t('Kural ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="automation-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Şirket')}</span>
          <select
            className="input select"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
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
          <span className="form-label">{t('Görev başlığı')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Haftalık yayın kontrolü')}
            maxLength={200}
          />
          {touched && !title.trim() ? <span className="form-error">{t('Görev başlığı gerekli.')}</span> : null}
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Sıklık')}</span>
            <select className="input select" value={cadence} onChange={(event) => setCadence(event.target.value as AutomationCadence)}>
              {AUTOMATION_CADENCES.map((item) => (
                <option key={item} value={item}>
                  {t(AUTOMATION_CADENCE_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Sonraki çalışma')}</span>
            <input className="input" type="date" value={nextRun} onChange={(event) => setNextRun(event.target.value)} max="2100-12-31" />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Öncelik')}</span>
            <select className="input select" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {t(PRIORITY_LABEL[item])}
                </option>
              ))}
            </select>
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

        <label className="toggle-row">
          <span>
            <strong>{t('Kural aktif')}</strong>
            <span>{t('Pasif kurallar çalıştırılamaz.')}</span>
          </span>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        </label>
      </form>
    </Modal>
  );
}
