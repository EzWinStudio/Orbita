import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { PERMISSION_KEYS, PERMISSION_LABEL } from '../constants';
import type { PermissionKey, Role } from '../types';

interface RoleModalProps {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
  defaultCompanyId?: string | null;
}

export function RoleModal({ open, onClose, role, defaultCompanyId }: RoleModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setCompanyId(role?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setPermissions(role?.permissions ?? []);
    setBusy(false);
    setTouched(false);
  }, [open, role, defaultCompanyId, data?.companies]);

  const canSave = name.trim().length > 0 && Boolean(companyId);

  const togglePermission = (permission: PermissionKey) => {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      companyId,
      permissions,
    };
    const success = role
      ? await actions.updateRole({ id: role.id, ...payload })
      : await actions.createRole(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!role) return;
    const sure = await confirm({
      title: t('Rol silinsin mi?'),
      message: t('“{name}” rolü silinecek. Çalışanların yetki rolü ataması temizlenir.', {
        name: role.name,
      }),
      confirmLabel: t('Rolü sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteRole(role.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={role ? t('Rolü düzenle') : t('Yeni rol')}
      subtitle={t('Ekip için izin kapsamını tanımla; rolü çalışan profillerine ata.')}
      onClose={onClose}
      size="md"
      icon={<ShieldCheck size={17} />}
      footer={
        <div className="footer-split">
          {role ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Rolü sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="role-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : role ? t('Kaydet') : t('Rol ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="role-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Rol adı')}</span>
            <input
              className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('Örn. Yönetici')}
              maxLength={80}
              autoFocus
            />
            {touched && !name.trim() ? (
              <span className="form-error">{t('Rol adı gerekli.')}</span>
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
        </div>

        <label className="form-field">
          <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('Rolün sorumluluğunu kısa bir notla özetle.')}
            maxLength={240}
            rows={2}
          />
        </label>

        <div className="form-field">
          <span className="form-label">
            {t('Yetkiler')}{' '}
            <span className="form-optional">{t('{count} yetki', { count: permissions.length })}</span>
          </span>
          <div className="permission-grid">
            {PERMISSION_KEYS.map((permission) => (
              <label key={permission} className="permission-item">
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />
                <span>{t(PERMISSION_LABEL[permission])}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="form-hint role-permission-hint">
          {t('Yetki rolleri ekip organizasyonu içindir; bu cihazdaki oturum erişimini kısıtlamaz.')}
        </p>
      </form>
    </Modal>
  );
}
