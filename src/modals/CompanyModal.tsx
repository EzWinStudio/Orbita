import { useEffect, useRef, useState } from 'react';
import { Building2, Trash2, Upload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { fileToCompanyLogoDataUrl } from '../lib/imageFile';
import {
  COMPANY_CATEGORIES,
  COMPANY_CATEGORY_LABEL,
  COMPANY_COLORS,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABEL,
} from '../constants';
import type { Company, CompanyCategory, CompanyStatus } from '../types';

interface CompanyModalProps {
  open: boolean;
  onClose: () => void;
  company?: Company | null;
}

export function CompanyModal({ open, onClose, company }: CompanyModalProps) {
  const { actions, confirm, data } = useApp();
  const { t, locale, language } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [color, setColor] = useState(COMPANY_COLORS[0]);
  const [status, setStatus] = useState<CompanyStatus>('active');
  const [category, setCategory] = useState<CompanyCategory>('other');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const currency = data?.settings.currency ?? 'TRY';

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? '');
    setDescription(company?.description ?? '');
    setLogo(company?.logo ?? null);
    setColor(company?.color ?? COMPANY_COLORS[0]);
    setStatus(company?.status ?? 'active');
    setCategory(company?.category ?? 'other');
    setTarget(company?.monthlyTarget ? String(company.monthlyTarget) : '');
    setTouched(false);
    setBusy(false);
    setLogoBusy(false);
    setLogoError(null);
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, company]);

  const uploadLogo = async (file: File) => {
    if (logoBusy) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      setLogo(await fileToCompanyLogoDataUrl(file));
    } catch (err) {
      setLogoError(
        translateMessage(
          language,
          err instanceof Error ? err.message : t('Görsel yüklenemedi.'),
        ),
      );
    }
    setLogoBusy(false);
  };

  const parsedTarget = target.trim() ? Number(target.trim().replace(',', '.')) : null;
  const targetInvalid =
    parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget <= 0);
  const canSave = name.trim().length > 0 && !targetInvalid;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      logo,
      color,
      status,
      category,
      monthlyTarget: parsedTarget,
    };
    const success = company
      ? await actions.updateCompany({ id: company.id, ...payload })
      : await actions.createCompany(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!company) return;
    const sure = await confirm({
      title: t('Şirket silinsin mi?'),
      message: t('“{name}” ve bağlı tüm servisler, finans kayıtları, görevler ve notlar kalıcı olarak silinecek. Bu işlem geri alınamaz.', {
        name: company.name,
      }),
      confirmLabel: t('Şirketi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteCompany(company.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={company ? t('Şirketi düzenle') : t('Yeni şirket')}
      subtitle={
        company
          ? t('Şirket bilgilerini güncelle; bağlı veriler korunur.')
          : t('Komuta merkezine bağlayacağın ilk yapıyı tanımla.')
      }
      onClose={onClose}
      size="sm"
      icon={<Building2 size={17} />}
      footer={
        <div className="footer-split">
          {company ? (
            <button type="button" className="btn btn-danger-ghost" onClick={remove} disabled={busy}>
              {t('Şirketi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="company-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : company ? t('Değişiklikleri kaydet') : t('Şirketi oluştur')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="company-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-preview">
          <span
            className={`company-avatar company-avatar-lg${logo ? ' company-avatar-logo' : ''}`}
            style={{ background: color }}
          >
            {logo ? (
              <img src={logo} alt="" />
            ) : (
              (name.trim()[0] ?? '?').toLocaleUpperCase(locale)
            )}
          </span>
          <div>
            <strong>{name.trim() || t('Yeni şirket')}</strong>
            <span className="form-preview-sub">
              {t(COMPANY_STATUS_LABEL[status])} · {t(COMPANY_CATEGORY_LABEL[category])}
            </span>
          </div>
        </div>

        <div className="form-media">
          <div className="form-media-copy">
            <strong>{t('Logo / profil görseli')}</strong>
            <span>{t('PNG, JPG veya WebP · kare önerilir · en fazla 6 MB')}</span>
          </div>
          <div className="form-media-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => logoRef.current?.click()}
              disabled={busy || logoBusy}
            >
              <Upload size={14} />
              {logoBusy ? t('Hazırlanıyor…') : logo ? t('Değiştir') : t('Görsel yükle')}
            </button>
            {logo ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setLogo(null);
                  setLogoError(null);
                }}
                disabled={busy || logoBusy}
              >
                <Trash2 size={14} />
                {t('Kaldır')}
              </button>
            ) : null}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="web-file-input"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void uploadLogo(file);
            }}
          />
        </div>
        {logoError ? <p className="form-media-error">{logoError}</p> : null}

        <label className="form-field">
          <span className="form-label">{t('Şirket adı')}</span>
          <input
            ref={nameRef}
            className={`input ${touched && !canSave ? 'input-error' : ''}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Örn. AniMax')}
            maxLength={60}
          />
          {touched && !canSave ? <span className="form-error">{t('Şirket adı gerekli.')}</span> : null}
        </label>

        <label className="form-field">
          <span className="form-label">{t('Kısa açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('Ne iş yapıyor? Örn. Discord botları ve abonelik sistemi')}
            rows={3}
            maxLength={180}
          />
          <span className="form-hint">{description.length}/180</span>
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Durum')}</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => setStatus(event.target.value as CompanyStatus)}
            >
              {COMPANY_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(COMPANY_STATUS_LABEL[item])}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">{t('Kategori')}</span>
            <select
              className="input select"
              value={category}
              onChange={(event) => setCategory(event.target.value as CompanyCategory)}
            >
              {COMPANY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(COMPANY_CATEGORY_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">
            {t('Aylık net hedef')} <span className="form-optional">{t('isteğe bağlı')}</span>
          </span>
          <div className="input-suffix-wrap">
            <input
              className={`input ${touched && targetInvalid ? 'input-error' : ''}`}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              inputMode="decimal"
              placeholder={t('Örn. 25000')}
              maxLength={16}
            />
            <span className="input-suffix">{currency}</span>
          </div>
          {touched && targetInvalid ? (
            <span className="form-error">{t('Hedef 0’dan büyük bir sayı olmalı.')}</span>
          ) : (
            <span className="form-hint">
              {t('Bu ayın net gelirini hedefe göre izlemek için kullanılır. Boş bırakılırsa hedef yok.')}
            </span>
          )}
        </label>

        <div className="form-field">
          <span className="form-label">{t('Kimlik rengi')}</span>
          <div className="color-row">
            {COMPANY_COLORS.map((item) => (
              <button
                type="button"
                key={item}
                className={`color-swatch ${item === color ? 'active' : ''}`}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={t('Renk {color}', { color: item })}
                aria-pressed={item === color}
              />
            ))}
          </div>
          <span className="form-hint">{t('Renk; şirket kartları, noktalar ve grafiklerde kullanılır.')}</span>
        </div>
      </form>
    </Modal>
  );
}
