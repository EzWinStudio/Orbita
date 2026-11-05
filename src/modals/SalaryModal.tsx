import { useEffect, useRef, useState } from 'react';
import { Users, Wallet } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { CURRENCY_SHORT, SALARY_STATUSES, SALARY_STATUS_LABEL } from '../constants';
import { currentMonthKey, formatMoney, monthLabel } from '../lib/format';
import type { SalaryPayment, SalaryStatus } from '../types';

interface SalaryModalProps {
  open: boolean;
  onClose: () => void;
  salary?: SalaryPayment | null;
  defaultCompanyId?: string | null;
  defaultPeriod?: string;
}

export function SalaryModal({
  open,
  onClose,
  salary,
  defaultCompanyId,
  defaultPeriod,
}: SalaryModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(currentMonthKey());
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<SalaryStatus>('planned');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const company = salary?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '';
    setCompanyId(company);
    setEmployeeId(salary?.employeeId ?? '');
    setPeriod(salary?.period ?? defaultPeriod ?? currentMonthKey());
    setAmount(salary ? String(salary.amount) : '');
    setStatus(salary?.status ?? 'planned');
    setNote(salary?.note ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => amountRef.current?.focus(), 30);
  }, [open, salary, defaultCompanyId, defaultPeriod, data?.companies]);

  const employees = (data?.employees ?? []).filter(
    (employee) => employee.companyId === companyId,
  );
  const employee = employees.find((item) => item.id === employeeId) ?? null;

  useEffect(() => {
    if (!open) return;
    if (employeeId && employees.some((item) => item.id === employeeId)) return;
    setEmployeeId(employees[0]?.id ?? '');
  }, [open, employees, employeeId]);

  const numericAmount = Number(amount.replace(',', '.'));
  const canSave =
    Boolean(companyId) && Boolean(employeeId) && Boolean(period) &&
    Number.isFinite(numericAmount) && numericAmount > 0;
  const currency = data?.settings.currency ?? 'TRY';

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      employeeId,
      period,
      amount: numericAmount,
      status,
      note: note.trim(),
    };
    const success = salary
      ? await actions.updateSalary({ id: salary.id, ...payload })
      : await actions.createSalary({ companyId, ...payload });
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!salary) return;
    const sure = await confirm({
      title: t('Maaş kaydı silinsin mi?'),
      message: t('“{name}” için {period} dönemine ait kayıt silinecek.', {
        name: salary.employeeName,
        period: monthLabel(salary.period),
      }),
      confirmLabel: t('Maaş kaydını sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteSalary(salary.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={salary ? t('Maaş kaydını düzenle') : t('Yeni maaş kaydı')}
      subtitle={t('Maaş ödendiğinde gider olarak nakit akışına eklenir.')}
      onClose={onClose}
      size="sm"
      icon={<Wallet size={17} />}
      footer={
        <div className="footer-split">
          {salary ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Maaş kaydını sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="salary-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : salary ? t('Kaydet') : t('Maaş kaydı ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="salary-form"
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
              disabled={Boolean(salary)}
            >
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Çalışan')}</span>
            <select
              className="input select"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={employees.length === 0}
            >
              {employees.length === 0 ? (
                <option value="">{t('Bu şirkette çalışan yok')}</option>
              ) : (
                employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {employees.length === 0 ? (
          <div className="form-callout">
            <Users size={15} />
            <span>{t('Maaş kaydı için önce Operasyon → Ekip bölümünden bu şirkete çalışan ekle.')}</span>
          </div>
        ) : null}

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Dönem')}</span>
            <input
              className={`input ${touched && !period ? 'input-error' : ''}`}
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              min="2000-01"
              max="2100-12"
            />
          </label>
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
        </div>

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {SALARY_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => setStatus(item)}
              >
                {t(SALARY_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
          <span className="form-hint">
            {status === 'paid'
              ? t('Ödendi olarak işaretlendiğinde tutar gider olarak raporlara yansır.')
              : t('Planlanan maaşlar nakit akışına dahil edilmez.')}
          </span>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Açıklama')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Örn. Ek mesai dahil')}
            maxLength={240}
          />
        </label>

        {employee && numericAmount > 0 ? (
          <div className="form-callout">
            <Wallet size={15} />
            <span>
              {t('{name} · {period} · {amount}', {
                name: employee.name,
                period: monthLabel(period || currentMonthKey()),
                amount: formatMoney(numericAmount, currency),
              })}
            </span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
