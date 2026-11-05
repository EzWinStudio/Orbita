import { useEffect, useMemo, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { CHAT_SCOPES, CHAT_SCOPE_LABEL } from '../constants';
import type { ChatScope } from '../types';

interface ChatThreadModalProps {
  open: boolean;
  onClose: () => void;
  defaultCompanyId?: string | null;
}

export function ChatThreadModal({ open, onClose, defaultCompanyId }: ChatThreadModalProps) {
  const { data, actions } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [scope, setScope] = useState<ChatScope>('company');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const company = useMemo(
    () => data?.companies.find((item) => item.id === companyId) ?? null,
    [data?.companies, companyId],
  );
  const departments = useMemo(
    () => (data?.departments ?? []).filter((item) => item.companyId === companyId),
    [data?.departments, companyId],
  );
  const employees = useMemo(
    () =>
      (data?.employees ?? []).filter(
        (item) => item.companyId === companyId && item.status !== 'inactive',
      ),
    [data?.employees, companyId],
  );

  useEffect(() => {
    if (!open) return;
    const initialCompany = defaultCompanyId ?? data?.companies[0]?.id ?? '';
    setCompanyId(initialCompany);
    setScope('company');
    setDepartmentId('');
    setEmployeeId('');
    setBusy(false);
    setTouched(false);
  }, [open, defaultCompanyId, data?.companies]);

  useEffect(() => {
    if (!open) return;
    if (scope === 'department') {
      setDepartmentId((current) =>
        departments.some((item) => item.id === current) ? current : departments[0]?.id ?? '',
      );
    }
    if (scope === 'direct') {
      setEmployeeId((current) =>
        employees.some((item) => item.id === current) ? current : employees[0]?.id ?? '',
      );
    }
  }, [open, scope, departments, employees]);

  const duplicate = (data?.chatThreads ?? []).some(
    (thread) =>
      thread.companyId === companyId &&
      thread.scope === scope &&
      (scope !== 'department' || thread.departmentId === departmentId) &&
      (scope !== 'direct' || thread.employeeId === employeeId),
  );
  const missingTarget =
    (scope === 'department' && !departmentId) || (scope === 'direct' && !employeeId);
  const canSave = Boolean(companyId) && !duplicate && !missingTarget;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const success = await actions.createChatThread({
      companyId,
      scope,
      ...(scope === 'department' ? { departmentId } : {}),
      ...(scope === 'direct' ? { employeeId } : {}),
    });
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={t('Sohbet başlat')}
      subtitle={t('Mesajlar bu çalışma alanında saklanır; eşitlenen cihazlarda görünür.')}
      onClose={onClose}
      size="sm"
      icon={<MessagesSquare size={17} />}
      footer={
        <div className="footer-split">
          <span />
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="chat-thread-form" className="btn btn-primary" disabled={busy || (touched && !canSave)}>
              {busy ? t('Oluşturuluyor…') : t('Sohbeti aç')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="chat-thread-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Şirket')}</span>
          <select
            className="input select"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setDepartmentId('');
              setEmployeeId('');
            }}
          >
            {data?.companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-field">
          <span className="form-label">{t('Sohbet türü')}</span>
          <div className="segmented segmented-block">
            {CHAT_SCOPES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${scope === item ? 'active' : ''}`}
                onClick={() => setScope(item)}
              >
                {t(CHAT_SCOPE_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        {scope === 'department' ? (
          <label className="form-field">
            <span className="form-label">{t('Departman')}</span>
            <select
              className="input select"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              {departments.length === 0 ? <option value="">{t('Departman yok')}</option> : null}
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {departments.length === 0 ? (
              <span className="form-error">{t('Önce Operasyon sayfasından bir departman ekle.')}</span>
            ) : null}
          </label>
        ) : null}

        {scope === 'direct' ? (
          <label className="form-field">
            <span className="form-label">{t('Çalışan')}</span>
            <select
              className="input select"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              {employees.length === 0 ? <option value="">{t('Çalışan yok')}</option> : null}
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {employees.length === 0 ? (
              <span className="form-error">{t('Önce Operasyon sayfasından bir çalışan ekle.')}</span>
            ) : null}
          </label>
        ) : null}

        {company ? (
          <div className="form-callout">
            <MessagesSquare size={15} />
            <span>
              {t('{company} · {scope}', {
                company: company.name,
                scope: t(CHAT_SCOPE_LABEL[scope]),
              })}
            </span>
          </div>
        ) : null}

        {duplicate ? (
          <span className="form-error">{t('Bu sohbet zaten açık.')}</span>
        ) : null}
      </form>
    </Modal>
  );
}
