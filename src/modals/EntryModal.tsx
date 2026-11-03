import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { CURRENCY_SHORT } from '../constants';
import { formatMoney, todayISO } from '../lib/format';
import type { FinanceKind } from '../types';

interface EntryModalProps {
  open: boolean;
  onClose: () => void;
  defaultCompanyId?: string | null;
}

export function EntryModal({ open, onClose, defaultCompanyId }: EntryModalProps) {
  const { data, actions } = useApp();
  const { t } = useI18n();
  const [kind, setKind] = useState<FinanceKind>('income');
  const [amount, setAmount] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKind('income');
    setAmount('');
    setCompanyId(defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setCategory('');
    setNote('');
    setDate(todayISO());
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => amountRef.current?.focus(), 30);
  }, [open, defaultCompanyId, data?.companies]);

  const categories = useMemo(
    () =>
      Array.from(new Set((data?.finance ?? []).map((entry) => entry.category).filter(Boolean))).slice(0, 12),
    [data?.finance],
  );

  const numericAmount = Number(amount.replace(',', '.'));
  const canSave = Boolean(companyId) && Number.isFinite(numericAmount) && numericAmount > 0;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const success = await actions.createFinance({
      companyId,
      kind,
      amount: numericAmount,
      category: category.trim(),
      note: note.trim(),
      date,
    });
    setBusy(false);
    if (success) onClose();
  };

  const currency = data?.settings.currency ?? 'TRY';

  return (
    <Modal
      open={open}
      title={t('Finans kaydı')}
      subtitle={t('Gelir veya gideri şirketine işle. Raporlar anında güncellenir.')}
      onClose={onClose}
      size="sm"
      icon={<Wallet size={17} />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('Vazgeç')}
          </button>
          <button type="submit" form="entry-form" className="btn btn-primary" disabled={busy}>
            {busy ? t('Kaydediliyor…') : t('Kaydı ekle')}
          </button>
        </>
      }
    >
      <form
        id="entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="segmented segmented-block">
          <button
            type="button"
            className={`segment ${kind === 'income' ? 'active income' : ''}`}
            onClick={() => setKind('income')}
          >
            <ArrowDownLeft size={15} /> {t('Gelir')}
          </button>
          <button
            type="button"
            className={`segment ${kind === 'expense' ? 'active expense' : ''}`}
            onClick={() => setKind('expense')}
          >
            <ArrowUpRight size={15} /> {t('Gider')}
          </button>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Tutar')}</span>
          <div className="amount-input">
            <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
            <input
              ref={amountRef}
              className={`input ${touched && !canSave ? 'input-error' : ''}`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0"
            />
          </div>
          {touched && (numericAmount <= 0 || !Number.isFinite(numericAmount)) ? (
            <span className="form-error">{t('Sıfırdan büyük bir tutar gir.')}</span>
          ) : null}
          {Number.isFinite(numericAmount) && numericAmount > 0 ? (
            <span className="form-hint">{t('{amount} olarak kaydedilecek.', { amount: formatMoney(numericAmount, currency) })}</span>
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
            <span className="form-label">{t('Tarih')}</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              max="2100-12-31"
            />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Kategori')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder={t('Örn. Abonelik')}
              list="finance-category-list"
              maxLength={40}
            />
            <datalist id="finance-category-list">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('Kısa not')}
              maxLength={240}
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}
