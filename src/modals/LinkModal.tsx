import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { newId } from '../constants';
import type { Company, LinkItem } from '../types';

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  company: Company;
  link?: LinkItem | null;
}

export function LinkModal({ open, onClose, company, link }: LinkModalProps) {
  const { actions, confirm } = useApp();
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => labelRef.current?.focus(), 30);
  }, [open, link]);

  const canSave = label.trim().length > 0 && url.trim().length > 0;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    const cleanUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    const nextLink: LinkItem = {
      id: link?.id ?? newId(),
      label: label.trim(),
      url: cleanUrl,
    };
    const links = link
      ? company.links.map((item) => (item.id === link.id ? nextLink : item))
      : [...company.links, nextLink];
    setBusy(true);
    const success = await actions.updateCompany({ id: company.id, links });
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!link) return;
    const sure = await confirm({
      title: t('Bağlantı kaldırılsın mı?'),
      message: t('“{label}” hızlı erişimden kaldırılacak.', { label: link.label }),
      confirmLabel: t('Kaldır'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.updateCompany({
      id: company.id,
      links: company.links.filter((item) => item.id !== link.id),
    });
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={link ? t('Bağlantıyı düzenle') : t('Hızlı erişim bağlantısı')}
      subtitle={t('{company} için panel, site veya yönetim ekranı ekle.', { company: company.name })}
      onClose={onClose}
      size="sm"
      icon={<Link2 size={17} />}
      footer={
        <div className="footer-split">
          {link ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Kaldır')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="link-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : link ? t('Kaydet') : t('Bağlantı ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="link-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Bağlantı adı')}</span>
          <input
            ref={labelRef}
            className={`input ${touched && !label.trim() ? 'input-error' : ''}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('Örn. Discord yönetim paneli')}
            maxLength={60}
          />
          {touched && !label.trim() ? <span className="form-error">{t('Bağlantı adı gerekli.')}</span> : null}
        </label>
        <label className="form-field">
          <span className="form-label">URL</span>
          <input
            className={`input ${touched && !url.trim() ? 'input-error' : ''}`}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t('panel.animax.com veya https://…')}
            spellCheck={false}
          />
          {touched && !url.trim() ? <span className="form-error">{t('URL gerekli.')}</span> : null}
          <span className="form-hint">{t('Bağlantılar varsayılan tarayıcıda güvenli şekilde açılır.')}</span>
        </label>
      </form>
    </Modal>
  );
}
