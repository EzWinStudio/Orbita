import { useEffect, useRef, useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { APPROVAL_STATUS_LABEL, CURRENCY_SHORT } from '../constants';
import { formatMoney } from '../lib/format';
import type { Approval } from '../types';

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  approval?: Approval | null;
  defaultCompanyId?: string | null;
}

export function ApprovalModal({ open, onClose, approval, defaultCompanyId }: ApprovalModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(approval?.title ?? '');
    setCompanyId(approval?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setRequestedBy(approval?.requestedBy ?? '');
    setAmount(approval?.amount != null ? String(approval.amount) : '');
    setNote(approval?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, approval, defaultCompanyId, data?.companies]);

  const currency = data?.settings.currency ?? 'TRY';
  const numericAmount = amount.trim() ? Number(amount.replace(',', '.')) : null;
  const amountValid = numericAmount === null || (Number.isFinite(numericAmount) && numericAmount > 0);
  const canSave = title.trim().length > 0 && Boolean(companyId) && amountValid;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      companyId,
      requestedBy: requestedBy.trim(),
      amount: numericAmount && Number.isFinite(numericAmount) ? numericAmount : null,
      note: note.trim(),
    };
    const success = approval
      ? await actions.updateApproval({ id: approval.id, ...payload })
      : await actions.createApproval(payload);
    setBusy(false);
    if (success) onClose();
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!approval || busy) return;
    if (status === 'rejected') {
      const sure = await confirm({
        title: t('Talep reddedilsin mi?'),
        message: t('“{title}” talebi reddedilecek.', { title: approval.title }),
        confirmLabel: t('Talebi reddet'),
      });
      if (!sure) return;
    }
    setBusy(true);
    const success = await actions.decideApproval(approval.id, status);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!approval) return;
    const sure = await confirm({
      title: t('Onay talebi silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: approval.title }),
      confirmLabel: t('Talebi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteApproval(approval.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={approval ? t('Onay talebini düzenle') : t('Yeni onay talebi')}
      subtitle={t('Talebi şirketine bağla; onaylandığında veya reddedildiğinde kayıt güncellenir.')}
      onClose={onClose}
      size="sm"
      icon={<ShieldCheck size={17} />}
      footer={
        <div className="footer-split">
          {approval ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Talebi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="approval-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : approval ? t('Kaydet') : t('Talep oluştur')}
            </button>
          </div>
        </div>
      }
    >
      {approval ? (
        <div className={`approval-status-bar status-${approval.status}`}>
          <span>{t(APPROVAL_STATUS_LABEL[approval.status])}</span>
          {approval.status === 'pending' ? (
            <div className="approval-status-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void decide('approved')}
                disabled={busy}
              >
                <Check size={13} /> {t('Talebi onayla')}
              </button>
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm"
                onClick={() => void decide('rejected')}
                disabled={busy}
              >
                <X size={13} /> {t('Talebi reddet')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <form
        id="approval-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Talep başlığı')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Yeni ekipman bütçesi')}
            maxLength={160}
          />
          {touched && !title.trim() ? (
            <span className="form-error">{t('Talep başlığı gerekli.')}</span>
          ) : null}
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
            <span className="form-label">{t('Talep eden')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={requestedBy}
              onChange={(event) => setRequestedBy(event.target.value)}
              placeholder={t('Örn. Ada Yılmaz')}
              maxLength={120}
            />
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Tutar')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <div className="amount-input">
            <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
            <input
              className={`input ${touched && !amountValid ? 'input-error' : ''}`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0"
            />
          </div>
          {touched && !amountValid ? (
            <span className="form-error">{t('Sıfırdan büyük bir tutar gir.')}</span>
          ) : null}
          {numericAmount && amountValid ? (
            <span className="form-hint">
              {t('{amount} olarak kaydedilecek.', { amount: formatMoney(numericAmount, currency) })}
            </span>
          ) : null}
        </label>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Talebin gerekçesini kısaca yaz.')}
            rows={3}
            maxLength={600}
          />
        </label>
      </form>
    </Modal>
  );
}
