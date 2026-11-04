import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABEL } from '../constants';
import type { Employee, EmployeeStatus } from '../types';

interface EmployeeModalProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  defaultCompanyId?: string | null;
}

export function EmployeeModal({ open, onClose, employee, defaultCompanyId }: EmployeeModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(employee?.name ?? '');
    setRole(employee?.role ?? '');
    setEmail(employee?.email ?? '');
    setCompanyId(employee?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setStatus(employee?.status ?? 'active');
    setStartDate(employee?.startDate ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, employee, defaultCompanyId, data?.companies]);

  const canSave = name.trim().length > 0 && Boolean(companyId);

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      role: role.trim(),
      email: email.trim(),
      companyId,
      status,
      startDate: startDate || null,
    };
    const success = employee
      ? await actions.updateEmployee({ id: employee.id, ...payload })
      : await actions.createEmployee(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!employee) return;
    const sure = await confirm({
      title: t('Çalışan silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: employee.name }),
      confirmLabel: t('Çalışanı sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteEmployee(employee.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={employee ? t('Çalışanı düzenle') : t('Yeni çalışan')}
      subtitle={t('Ekip üyesini şirketine bağla; rol ve durum bilgisini güncel tut.')}
      onClose={onClose}
      size="sm"
      icon={<Users size={17} />}
      footer={
        <div className="footer-split">
          {employee ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Çalışanı sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="employee-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : employee ? t('Kaydet') : t('Çalışan ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="employee-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Ad soyad')}</span>
            <input
              ref={nameRef}
              className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('Örn. Ada Yılmaz')}
              maxLength={120}
            />
            {touched && !name.trim() ? <span className="form-error">{t('Ad soyad gerekli.')}</span> : null}
          </label>
          <label className="form-field">
            <span className="form-label">{t('Rol')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder={t('Örn. İçerik üreticisi')}
              maxLength={80}
            />
          </label>
        </div>

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
            <span className="form-label">{t('Başlangıç tarihi')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              max="2100-12-31"
            />
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('E-posta')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('ornek@sirket.com')}
            maxLength={160}
            dir="ltr"
          />
        </label>

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {EMPLOYEE_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => setStatus(item)}
              >
                {t(EMPLOYEE_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
