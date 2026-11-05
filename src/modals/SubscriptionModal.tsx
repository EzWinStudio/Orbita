import { useEffect, useRef, useState } from 'react';
import { Repeat } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABEL,
  CURRENCY_SHORT,
  SUBSCRIPTION_KINDS,
  SUBSCRIPTION_KIND_LABEL,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABEL,
} from '../constants';
import { formatMoney, todayISO } from '../lib/format';
import { monthlyEquivalent, yearlyEquivalent } from '../lib/finance';
import type { BillingCycle, Subscription, SubscriptionKind, SubscriptionStatus } from '../types';

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  subscription?: Subscription | null;
  defaultCompanyId?: string | null;
}

export function SubscriptionModal({
  open,
  onClose,
  subscription,
  defaultCompanyId,
}: SubscriptionModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [kind, setKind] = useState<SubscriptionKind>('subscription');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [nextRenewal, setNextRenewal] = useState(todayISO());
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(subscription?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setName(subscription?.name ?? '');
    setVendor(subscription?.vendor ?? '');
    setKind(subscription?.kind ?? 'subscription');
    setAmount(subscription ? String(subscription.amount) : '');
    setCycle(subscription?.cycle ?? 'monthly');
    setNextRenewal(subscription?.nextRenewal ?? todayISO());
    setStatus(subscription?.status ?? 'active');
    setNote(subscription?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, subscription, defaultCompanyId, data?.companies]);

  const numericAmount = Number(amount.replace(',', '.'));
  const currency = data?.settings.currency ?? 'TRY';
  const canSave =
    Boolean(companyId) && name.trim().length > 0 &&
    Number.isFinite(numericAmount) && numericAmount >= 0 && Boolean(nextRenewal);

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      companyId,
      name: name.trim(),
      vendor: vendor.trim(),
      kind,
      amount: numericAmount,
      cycle,
      nextRenewal,
      status,
      note: note.trim(),
    };
    const success = subscription
      ? await actions.updateSubscription({ id: subscription.id, ...payload })
      : await actions.createSubscription(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!subscription) return;
    const sure = await confirm({
      title: t('Abonelik silinsin mi?'),
      message: t('“{name}” aboneliği kaldırılacak.', { name: subscription.name }),
      confirmLabel: t('Aboneliği sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteSubscription(subscription.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={subscription ? t('Aboneliği düzenle') : t('Yeni abonelik')}
      subtitle={t('Abonelikler taahhüt olarak izlenir; nakit akışına dahil edilmez.')}
      onClose={onClose}
      size="sm"
      icon={<Repeat size={17} />}
      footer={
        <div className="footer-split">
          {subscription ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Aboneliği sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="subscription-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : subscription ? t('Kaydet') : t('Abonelik ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="subscription-form"
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
            <span className="form-label">{t('Abonelik adı')}</span>
            <input
              ref={nameRef}
              className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('Örn. Adobe Creative Cloud')}
              maxLength={120}
            />
            {touched && !name.trim() ? (
              <span className="form-error">{t('Abonelik adı gerekli.')}</span>
            ) : null}
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Sağlayıcı')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              placeholder={t('Örn. Adobe')}
              maxLength={120}
            />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Tür')}</span>
            <select
              className="input select"
              value={kind}
              onChange={(event) => setKind(event.target.value as SubscriptionKind)}
            >
              {SUBSCRIPTION_KINDS.map((item) => (
                <option key={item} value={item}>
                  {t(SUBSCRIPTION_KIND_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Tutar')}</span>
            <div className="amount-input">
              <span className="amount-currency">{CURRENCY_SHORT[currency]}</span>
              <input
                className={`input ${touched && !(numericAmount >= 0) ? 'input-error' : ''}`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
              />
            </div>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Faturalama')}</span>
            <select
              className="input select"
              value={cycle}
              onChange={(event) => setCycle(event.target.value as BillingCycle)}
            >
              {BILLING_CYCLES.map((item) => (
                <option key={item} value={item}>
                  {t(BILLING_CYCLE_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Sonraki yenileme')}</span>
          <input
            className="input"
            type="date"
            value={nextRenewal}
            onChange={(event) => setNextRenewal(event.target.value)}
            max="2100-12-31"
          />
        </label>

        {numericAmount > 0 ? (
          <div className="form-callout">
            <Repeat size={15} />
            <span>
              {t('Aylık eşdeğer: {monthly} · Yıllık: {yearly}', {
                monthly: formatMoney(monthlyEquivalent({ amount: numericAmount, cycle }), currency),
                yearly: formatMoney(yearlyEquivalent({ amount: numericAmount, cycle }), currency),
              })}
            </span>
          </div>
        ) : null}

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {SUBSCRIPTION_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => setStatus(item)}
              >
                {t(SUBSCRIPTION_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Lisans anahtarı veya not')}
            maxLength={240}
          />
        </label>
      </form>
    </Modal>
  );
}
