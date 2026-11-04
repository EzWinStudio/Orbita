import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { DEPARTMENT_COLORS } from '../constants';
import type { Department } from '../types';

interface DepartmentModalProps {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
  defaultCompanyId?: string | null;
}

export function DepartmentModal({
  open,
  onClose,
  department,
  defaultCompanyId,
}: DepartmentModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [color, setColor] = useState(DEPARTMENT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(department?.name ?? '');
    setDescription(department?.description ?? '');
    setCompanyId(department?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setColor(
      department?.color ??
        DEPARTMENT_COLORS[(data?.departments.length ?? 0) % DEPARTMENT_COLORS.length],
    );
    setBusy(false);
    setTouched(false);
  }, [open, department, defaultCompanyId, data?.companies, data?.departments.length]);

  const canSave = name.trim().length > 0 && Boolean(companyId);

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      companyId,
      color,
    };
    const success = department
      ? await actions.updateDepartment({ id: department.id, ...payload })
      : await actions.createDepartment(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!department) return;
    const sure = await confirm({
      title: t('Departman silinsin mi?'),
      message: t('“{name}” departmanı silinecek. Çalışanların departman ataması temizlenir.', {
        name: department.name,
      }),
      confirmLabel: t('Departmanı sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteDepartment(department.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={department ? t('Departmanı düzenle') : t('Yeni departman')}
      subtitle={t('Ekipleri departmanlara ayır; çalışan atamalarını tek yerden yönet.')}
      onClose={onClose}
      size="sm"
      icon={<Building2 size={17} />}
      footer={
        <div className="footer-split">
          {department ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Departmanı sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="department-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : department ? t('Kaydet') : t('Departman ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="department-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Departman adı')}</span>
          <input
            className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Örn. İçerik')}
            maxLength={80}
            autoFocus
          />
          {touched && !name.trim() ? (
            <span className="form-error">{t('Departman adı gerekli.')}</span>
          ) : null}
        </label>

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

        <div className="form-field">
          <span className="form-label">{t('Departman rengi')}</span>
          <div className="color-swatches" role="group" aria-label={t('Departman rengi')}>
            {DEPARTMENT_COLORS.map((item) => (
              <button
                type="button"
                key={item}
                className={`color-swatch ${color === item ? 'active' : ''}`}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={item}
                aria-pressed={color === item}
              />
            ))}
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('Departmanın kapsamını kısa bir notla özetle.')}
            maxLength={240}
            rows={3}
          />
        </label>
      </form>
    </Modal>
  );
}
