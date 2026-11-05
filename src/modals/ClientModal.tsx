import { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, Mail, Phone, UserRound } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { CLIENT_STATUSES, CLIENT_STATUS_LABEL, CURRENCY_SHORT } from '../constants';
import { todayISO } from '../lib/format';
import type { Client, ClientStatus } from '../types';

interface ClientModalProps {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  defaultCompanyId?: string | null;
}

export function ClientModal({ open, onClose, client, defaultCompanyId }: ClientModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ClientStatus>('lead');
  const [value, setValue] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const currency = data?.settings.currency ?? 'TRY';

  useEffect(() => {
    if (!open) return;
    setCompanyId(client?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setName(client?.name ?? '');
    setContactName(client?.contactName ?? '');
    setEmail(client?.email ?? '');
    setPhone(client?.phone ?? '');
    setStatus(client?.status ?? 'lead');
    setValue(client ? String(client.value) : '');
    setNextFollowUp(client?.nextFollowUp ?? todayISO());
    setNote(client?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, client, defaultCompanyId, data?.companies]);

  const numericValue = Number(value.replace(',', '.'));
  const canSave = Boolean(companyId) && name.trim().length > 0;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      name: name.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      status,
      value: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0,
      nextFollowUp: nextFollowUp || null,
      note: note.trim(),
    };
    const ok = client
      ? await actions.updateClient({ id: client.id, ...payload })
      : await actions.createClient(payload);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!client) return;
    const sure = await confirm({
      title: t('Müşteri silinsin mi?'),
      message: t('“{name}” müşteri kaydı kaldırılacak.', { name: client.name }),
      confirmLabel: t('Müşteriyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const ok = await actions.deleteClient(client.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={client ? t('Müşteriyi düzenle') : t('Yeni müşteri')}
      subtitle={t('Müşteri kayıtları yereldir; fatura eşleşmesi müşteri adına göre yapılır.')}
      onClose={onClose}
      size="md"
      icon={<BriefcaseBusiness size={17} />}
      footer={
        <div className="footer-split">
          {client ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Müşteriyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="client-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : client ? t('Kaydet') : t('Müşteri ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="client-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select className="input select" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Müşteri adı')}</span>
            <input
              ref={nameRef}
              className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('Örn. Atlas Yapı')}
              maxLength={160}
            />
            {touched && !name.trim() ? <span className="form-error">{t('Müşteri adı gerekli.')}</span> : null}
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">
              <UserRound size={13} /> {t('İlgili kişi')} <span className="form-optional">{t('isteğe bağlı')}</span>
            </span>
            <input className="input" value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} />
          </label>
          <label className="form-field">
            <span className="form-label">
              <Mail size={13} /> {t('E-posta')} <span className="form-optional">{t('isteğe bağlı')}</span>
            </span>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={160} />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">
              <Phone size={13} /> {t('Telefon')} <span className="form-optional">{t('isteğe bağlı')}</span>
            </span>
            <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={60} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Durum')}</span>
            <select className="input select" value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
              {CLIENT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(CLIENT_STATUS_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Tahmini değer')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <div className="amount-input">
              <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
              <input
                className="input"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
              />
            </div>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Sonraki takip')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input className="input" type="date" value={nextFollowUp} onChange={(event) => setNextFollowUp(event.target.value)} max="2100-12-31" />
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea className="input textarea" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} />
        </label>
      </form>
    </Modal>
  );
}
