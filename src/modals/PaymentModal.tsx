import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import {
  CURRENCY_SHORT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from '../constants';
import { formatMoney, todayISO } from '../lib/format';
import { invoiceBalance, invoiceTotal } from '../lib/finance';
import type {
  CustomerPayment,
  CustomerPaymentStatus,
  PaymentMethod,
} from '../types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  payment?: CustomerPayment | null;
  defaultCompanyId?: string | null;
  defaultInvoiceId?: string | null;
}

export function PaymentModal({
  open,
  onClose,
  payment,
  defaultCompanyId,
  defaultInvoiceId,
}: PaymentModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [status, setStatus] = useState<CustomerPaymentStatus>('received');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initialInvoice = defaultInvoiceId
      ? (data?.invoices ?? []).find((invoice) => invoice.id === defaultInvoiceId) ?? null
      : null;
    setCompanyId(
      payment?.companyId ?? initialInvoice?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '',
    );
    setCustomerName(payment?.customerName ?? initialInvoice?.customerName ?? '');
    setInvoiceId(payment?.invoiceId ?? defaultInvoiceId ?? '');
    const initialBalance = initialInvoice
      ? invoiceBalance(initialInvoice, data?.customerPayments ?? [])
      : 0;
    setAmount(
      payment
        ? String(payment.amount)
        : initialInvoice
          ? String(initialBalance > 0 ? initialBalance : invoiceTotal(initialInvoice))
          : '',
    );
    setMethod(payment?.method ?? 'transfer');
    setStatus(payment?.status ?? 'received');
    setDate(payment?.date ?? todayISO());
    setNote(payment?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => amountRef.current?.focus(), 30);
  }, [open, payment, defaultCompanyId, defaultInvoiceId, data?.companies, data?.invoices, data?.customerPayments]);

  const invoices = useMemo(
    () =>
      (data?.invoices ?? [])
        .filter(
          (invoice) =>
            invoice.companyId === companyId &&
            (invoice.id === invoiceId || invoice.status !== 'canceled'),
        )
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [data?.invoices, companyId, invoiceId],
  );

  const invoice = invoices.find((item) => item.id === invoiceId) ?? null;
  const currency = data?.settings.currency ?? 'TRY';
  const numericAmount = Number(amount.replace(',', '.'));
  const canSave =
    Boolean(companyId) && customerName.trim().length > 0 &&
    Number.isFinite(numericAmount) && numericAmount > 0 && Boolean(date);

  const chooseInvoice = (nextId: string) => {
    setInvoiceId(nextId);
    const next = (data?.invoices ?? []).find((item) => item.id === nextId);
    if (!next) return;
    setCustomerName(next.customerName);
    const remaining = invoiceBalance(next, data?.customerPayments ?? []);
    setAmount(String(remaining > 0 ? remaining : invoiceTotal(next)));
  };

  const changeCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setInvoiceId('');
    if (!payment) setCustomerName('');
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      customerName: customerName.trim(),
      invoiceId: invoiceId || null,
      amount: numericAmount,
      method,
      status,
      date,
      note: note.trim(),
    };
    const success = payment
      ? await actions.updateCustomerPayment({ id: payment.id, ...payload })
      : await actions.createCustomerPayment(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!payment) return;
    const sure = await confirm({
      title: t('Ödeme kaydı silinsin mi?'),
      message: t('“{name}” için {amount} tutarındaki ödeme silinecek.', {
        name: payment.customerName,
        amount: formatMoney(payment.amount, data?.settings.currency ?? 'TRY'),
      }),
      confirmLabel: t('Ödemeyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteCustomerPayment(payment.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={payment ? t('Ödemeyi düzenle') : t('Yeni ödeme')}
      subtitle={t('Alınan ödemeler gelir olarak işlenir; bekleyen ödemeler raporlara yansımaz.')}
      onClose={onClose}
      size="sm"
      icon={<CreditCard size={17} />}
      footer={
        <div className="footer-split">
          {payment ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Ödemeyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="payment-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : payment ? t('Kaydet') : t('Ödemeyi kaydet')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="payment-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => changeCompany(event.target.value)}
            >
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Müşteri')}</span>
            <input
              className={`input ${touched && !customerName.trim() ? 'input-error' : ''}`}
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder={t('Örn. Acme Ltd.')}
              maxLength={120}
            />
            {touched && !customerName.trim() ? (
              <span className="form-error">{t('Müşteri adı gerekli.')}</span>
            ) : null}
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Fatura')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <select
            className="input select"
            value={invoiceId}
            onChange={(event) => chooseInvoice(event.target.value)}
          >
            <option value="">{t('Faturasız ödeme')}</option>
            {invoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number} · {item.customerName} · {formatMoney(invoiceTotal(item), currency)}
              </option>
            ))}
          </select>
          {invoice ? (
            <span className="form-hint">
              {t('Kalan bakiye: {amount}', {
                amount: formatMoney(invoiceBalance(invoice, data?.customerPayments ?? []), currency),
              })}
            </span>
          ) : null}
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Tutar')}</span>
            <div className="amount-input">
              <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
              <input
                ref={amountRef}
                className={`input ${touched && !(numericAmount > 0) ? 'input-error' : ''}`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
              />
            </div>
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

        <div className="form-field">
          <span className="form-label">{t('Yöntem')}</span>
          <div className="segmented segmented-block">
            {PAYMENT_METHODS.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${method === item ? 'active' : ''}`}
                onClick={() => setMethod(item)}
              >
                {t(PAYMENT_METHOD_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            <button
              type="button"
              className={`segment ${status === 'pending' ? 'active' : ''}`}
              onClick={() => setStatus('pending')}
            >
              {t('Bekliyor')}
            </button>
            <button
              type="button"
              className={`segment ${status === 'received' ? 'active' : ''}`}
              onClick={() => setStatus('received')}
            >
              {t('Alındı')}
            </button>
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Ödeme referansı veya not')}
            maxLength={240}
          />
        </label>
      </form>
    </Modal>
  );
}
