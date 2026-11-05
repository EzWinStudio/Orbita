import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, FileSignature } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  CURRENCY_SHORT,
} from '../constants';
import { formatDate, todayISO } from '../lib/format';
import type { Contract, ContractKind, ContractStatus } from '../types';

interface ContractModalProps {
  open: boolean;
  onClose: () => void;
  contract?: Contract | null;
  defaultCompanyId?: string | null;
}

export function ContractModal({ open, onClose, contract, defaultCompanyId }: ContractModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [kind, setKind] = useState<ContractKind>('service');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<ContractStatus>('active');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const currency = data?.settings.currency ?? 'TRY';

  useEffect(() => {
    if (!open) return;
    setCompanyId(contract?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setTitle(contract?.title ?? '');
    setCounterparty(contract?.counterparty ?? '');
    setKind(contract?.kind ?? 'service');
    setStartDate(contract?.startDate ?? todayISO());
    setEndDate(contract?.endDate ?? '');
    setValue(contract ? String(contract.value) : '');
    setStatus(contract?.status ?? 'active');
    setNote(contract?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, contract, defaultCompanyId, data?.companies]);

  const numericValue = Number(value.replace(',', '.'));
  const canSave = Boolean(companyId) && title.trim().length > 0;
  const daysLeft = useMemo(() => {
    if (!endDate) return null;
    const end = new Date(`${endDate}T00:00:00`).getTime();
    const today = new Date(`${todayISO()}T00:00:00`).getTime();
    return Math.round((end - today) / 86_400_000);
  }, [endDate]);

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    if (startDate && endDate && endDate < startDate) return;
    setBusy(true);
    const payload = {
      companyId,
      title: title.trim(),
      counterparty: counterparty.trim(),
      kind,
      startDate: startDate || null,
      endDate: endDate || null,
      value: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0,
      status,
      note: note.trim(),
    };
    const ok = contract
      ? await actions.updateContract({ id: contract.id, ...payload })
      : await actions.createContract(payload);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!contract) return;
    const sure = await confirm({
      title: t('Sözleşme silinsin mi?'),
      message: t('“{title}” sözleşmesi kaldırılacak.', { title: contract.title }),
      confirmLabel: t('Sözleşmeyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const ok = await actions.deleteContract(contract.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={contract ? t('Sözleşmeyi düzenle') : t('Yeni sözleşme')}
      subtitle={t('Bitiş tarihi yaklaşan sözleşmeler panelde ve bildirimlerde görünür.')}
      onClose={onClose}
      size="md"
      icon={<FileSignature size={17} />}
      footer={
        <div className="footer-split">
          {contract ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Sözleşmeyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button
              type="submit"
              form="contract-form"
              className="btn btn-primary"
              disabled={busy || Boolean(startDate && endDate && endDate < startDate)}
            >
              {busy ? t('Kaydediliyor…') : contract ? t('Kaydet') : t('Sözleşme ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="contract-form"
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
            <span className="form-label">{t('Sözleşme başlığı')}</span>
            <input
              ref={titleRef}
              className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('Örn. Yıllık bakım sözleşmesi')}
              maxLength={200}
            />
            {touched && !title.trim() ? (
              <span className="form-error">{t('Sözleşme başlığı gerekli.')}</span>
            ) : null}
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Karşı taraf')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input className="input" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} maxLength={160} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Tür')}</span>
            <select className="input select" value={kind} onChange={(event) => setKind(event.target.value as ContractKind)}>
              {CONTRACT_KINDS.map((item) => (
                <option key={item} value={item}>
                  {t(CONTRACT_KIND_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Başlangıç')}</span>
            <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} max="2100-12-31" />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Bitiş')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} max="2100-12-31" />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Sözleşme değeri')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
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
            <span className="form-label">{t('Durum')}</span>
            <select className="input select" value={status} onChange={(event) => setStatus(event.target.value as ContractStatus)}>
              {CONTRACT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(CONTRACT_STATUS_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        {daysLeft !== null ? (
          <div className={`form-callout ${daysLeft < 0 ? 'callout-danger' : daysLeft <= 30 ? 'callout-warning' : ''}`}>
            <CalendarClock size={15} />
            <span>
              {endDate ? formatDate(endDate) : ''} ·{' '}
              {daysLeft < 0
                ? t('{count} gün önce doldu', { count: Math.abs(daysLeft) })
                : daysLeft === 0
                  ? t('Bugün sona eriyor')
                  : t('{count} gün kaldı', { count: daysLeft })}
            </span>
          </div>
        ) : null}

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea className="input textarea" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} />
        </label>
      </form>
    </Modal>
  );
}
