import { useEffect, useMemo, useRef, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { CURRENCY_SHORT, INVOICE_STATUSES, INVOICE_STATUS_LABEL } from '../constants';
import { formatMoney, todayISO } from '../lib/format';
import { invoiceBalance, invoiceReceived, invoiceTax, invoiceTotal } from '../lib/finance';
import type { Invoice, InvoiceStatus } from '../types';

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
  defaultCompanyId?: string | null;
}

export function InvoiceModal({ open, onClose, invoice, defaultCompanyId }: InvoiceModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState('20');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const customerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(invoice?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setCustomerName(invoice?.customerName ?? '');
    setCustomerEmail(invoice?.customerEmail ?? '');
    setAmount(invoice ? String(invoice.amount) : '');
    setTaxRate(String(invoice?.taxRate ?? 20));
    setIssueDate(invoice?.issueDate ?? todayISO());
    setDueDate(invoice?.dueDate ?? todayISO());
    setStatus(invoice?.status ?? 'draft');
    setNote(invoice?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => customerRef.current?.focus(), 30);
  }, [open, invoice, defaultCompanyId, data?.companies]);

  const numericAmount = Number(amount.replace(',', '.'));
  const numericTax = Number(taxRate.replace(',', '.'));
  const currency = data?.settings.currency ?? 'TRY';
  const preview = useMemo(
    () => ({ amount: numericAmount > 0 ? numericAmount : 0, taxRate: Number.isFinite(numericTax) ? numericTax : 0 }),
    [numericAmount, numericTax],
  );
  const received = invoice ? invoiceReceived(invoice.id, data?.customerPayments ?? []) : 0;
  const balance = invoice
    ? invoiceBalance(invoice, data?.customerPayments ?? [])
    : 0;

  const dateInvalid = Boolean(issueDate && dueDate && dueDate < issueDate);
  const canSave =
    Boolean(companyId) && customerName.trim().length > 0 &&
    Number.isFinite(numericAmount) && numericAmount > 0 &&
    Number.isFinite(numericTax) && numericTax >= 0 && numericTax <= 100 &&
    Boolean(issueDate) && Boolean(dueDate) && !dateInvalid;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      amount: numericAmount,
      taxRate: numericTax,
      issueDate,
      dueDate,
      status,
      note: note.trim(),
    };
    const success = invoice
      ? await actions.updateInvoice({ id: invoice.id, ...payload })
      : await actions.createInvoice(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!invoice) return;
    const sure = await confirm({
      title: t('Fatura silinsin mi?'),
      message: t('“{number}” faturası silinecek. Bağlı ödemelerin bağlantısı kaldırılır.', {
        number: invoice.number,
      }),
      confirmLabel: t('Faturayı sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteInvoice(invoice.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={invoice ? t('Faturayı düzenle') : t('Yeni fatura')}
      subtitle={
        invoice
          ? t('{number} · {customer}', { number: invoice.number, customer: invoice.customerName })
          : t('Fatura numarası otomatik oluşturulur. KDV toplamı raporlara işlenir.')
      }
      onClose={onClose}
      size="md"
      icon={<ReceiptText size={17} />}
      footer={
        <div className="footer-split">
          {invoice ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Faturayı sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="invoice-form" className="btn btn-primary" disabled={busy || !canSave}>
              {busy ? t('Kaydediliyor…') : invoice ? t('Kaydet') : t('Fatura oluştur')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="invoice-form"
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
            <span className="form-label">{t('Müşteri')}</span>
            <input
              ref={customerRef}
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
          <span className="form-label">{t('Müşteri e-postası')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="musteri@ornek.com"
            maxLength={160}
          />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Tutar (KDV hariç)')}</span>
            <div className="amount-input">
              <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
              <input
                className={`input ${touched && !(numericAmount > 0) ? 'input-error' : ''}`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
              />
            </div>
          </label>
          <label className="form-field">
            <span className="form-label">{t('KDV oranı')}</span>
            <div className="amount-input">
              <input
                className="input"
                inputMode="decimal"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="20"
              />
              <span className="amount-currency amount-currency-suffix">%</span>
            </div>
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Düzenleme tarihi')}</span>
            <input
              className="input"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              max="2100-12-31"
            />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Vade tarihi')}</span>
            <input
              className={`input ${touched && dateInvalid ? 'input-error' : ''}`}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              min={issueDate || undefined}
              max="2100-12-31"
            />
            {touched && dateInvalid ? (
              <span className="form-error">{t('Vade tarihi düzenleme tarihinden önce olamaz.')}</span>
            ) : null}
          </label>
        </div>

        <div className="invoice-preview">
          <div>
            <span>{t('Ara toplam')}</span>
            <strong>{formatMoney(preview.amount, currency)}</strong>
          </div>
          <div>
            <span>{t('KDV')} (%{numericTax || 0})</span>
            <strong>{formatMoney(invoiceTax(preview), currency)}</strong>
          </div>
          <div className="invoice-preview-total">
            <span>{t('Genel toplam')}</span>
            <strong>{formatMoney(invoiceTotal(preview), currency)}</strong>
          </div>
        </div>

        {invoice ? (
          <div className="invoice-preview invoice-preview-payments">
            <div>
              <span>{t('Alınan ödeme')}</span>
              <strong className="text-income">{formatMoney(received, currency)}</strong>
            </div>
            <div>
              <span>{t('Kalan bakiye')}</span>
              <strong className={balance > 0 ? 'text-danger' : ''}>{formatMoney(balance, currency)}</strong>
            </div>
          </div>
        ) : null}

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {INVOICE_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => setStatus(item)}
              >
                {t(INVOICE_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
          <span className="form-hint">
            {t('Ödendi durumu faturayı gelire işler; kısmi ödemeler ödemeler sekmesinden izlenir.')}
          </span>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Fatura açıklaması')}
            rows={2}
            maxLength={400}
          />
        </label>
      </form>
    </Modal>
  );
}
