import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import type { MailAccount, MailTestResult } from '../types';

interface MailAccountModalProps {
  open: boolean;
  onClose: () => void;
  account?: MailAccount | null;
  onSaved: (accounts: MailAccount[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MailAccountModal({ open, onClose, account, onSaved }: MailAccountModalProps) {
  const { confirm, toast } = useApp();
  const { t, language } = useI18n();
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'test' | 'save' | 'remove' | null>(null);
  const [testResult, setTestResult] = useState<MailTestResult | null>(null);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(account?.label ?? '');
    setEmail(account?.email ?? '');
    setPassword('');
    setShowPassword(false);
    setBusy(null);
    setTestResult(null);
    setTouched(false);
    window.setTimeout(() => emailRef.current?.focus(), 40);
  }, [open, account]);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.replace(/\s+/g, '');
  const emailValid = EMAIL_RE.test(normalizedEmail);
  const passwordValid = Boolean(account) || normalizedPassword.length >= 8;
  const canSave = emailValid && passwordValid && !busy;

  const test = async () => {
    setTouched(true);
    if (!emailValid || normalizedPassword.length < 8 || busy) return;
    setBusy('test');
    setTestResult(null);
    try {
      const result = await window.ezwin?.mail.test({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      setTestResult(
        result
          ? { ...result, message: translateMessage(language, result.message) }
          : { ok: false, message: t('Uygulama bağlantısı kurulamadı.') },
      );
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error && err.message
            ? translateMessage(language, err.message)
            : t('Bağlantı test edilemedi.'),
      });
    }
    setBusy(null);
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave) return;
    setBusy('save');
    try {
      const accounts = account
        ? await window.ezwin?.mail.update({
            id: account.id,
            label: label.trim(),
            ...(normalizedPassword ? { password: normalizedPassword } : {}),
          })
        : await window.ezwin?.mail.add({
            label: label.trim(),
            email: normalizedEmail,
            password: normalizedPassword,
          });
      if (accounts) {
        onSaved(accounts);
        toast('success', account ? t('Gmail hesabı güncellendi.') : t('Gmail hesabı bağlandı.'));
        onClose();
      }
    } catch (err) {
      toast(
        'error',
        err instanceof Error && err.message
          ? translateMessage(language, err.message)
          : t('Gmail hesabı kaydedilemedi.'),
      );
    }
    setBusy(null);
  };

  const remove = async () => {
    if (!account || busy) return;
    const sure = await confirm({
      title: t('Gmail hesabı kaldırılsın mı?'),
      message: t('{email} hesabı ve bu cihazda saklanan uygulama şifresi kaldırılacak. Maillerin Gmail’de kalır.', {
        email: account.email,
      }),
      confirmLabel: t('Hesabı kaldır'),
    });
    if (!sure) return;
    setBusy('remove');
    try {
      const accounts = await window.ezwin?.mail.remove(account.id);
      if (accounts) {
        onSaved(accounts);
        toast('success', t('Gmail hesabı kaldırıldı.'));
        onClose();
      }
    } catch (err) {
      toast(
        'error',
        err instanceof Error && err.message
          ? translateMessage(language, err.message)
          : t('Hesap kaldırılamadı.'),
      );
    }
    setBusy(null);
  };

  const openAppPasswords = () => {
    void window.ezwin?.app.openExternal('https://myaccount.google.com/apppasswords');
  };

  return (
    <Modal
      open={open}
      title={account ? t('Gmail hesabını düzenle') : t('Gmail hesabı ekle')}
      subtitle={
        account
          ? t('Hesap adını değiştir veya yeni bir uygulama şifresi tanımla.')
          : t('Gmail adresini ve 16 haneli uygulama şifresini gir.')
      }
      onClose={onClose}
      size="sm"
      icon={<Mail size={17} />}
      footer={
        <div className="footer-split">
          {account ? (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => void remove()}
              disabled={Boolean(busy)}
            >
              {busy === 'remove' ? t('Kaldırılıyor…') : t('Hesabı kaldır')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={Boolean(busy)}>
              {t('Vazgeç')}
            </button>
            <button
              type="submit"
              form="mail-account-form"
              className="btn btn-primary"
              disabled={!canSave}
            >
              {busy === 'save' ? (
                <>
                  <Loader2 size={14} className="spin" /> {t('Bağlanıyor…')}
                </>
              ) : account ? (
                t('Değişiklikleri kaydet')
              ) : (
                t('Bağlan ve kaydet')
              )}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="mail-account-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mail-help-box">
          <ShieldCheck size={17} />
          <div>
            <strong>{t('Gmail uygulama şifresi')}</strong>
            <p>
              {t('Google Hesabı → Güvenlik bölümünde 2 Adımlı Doğrulama açık olmalı. Ardından “Uygulama şifreleri” sayfasından Gmail için yeni bir şifre oluştur.')}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openAppPasswords}>
              <ExternalLink size={12} /> {t('Uygulama şifresi oluştur')}
            </button>
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">
            {t('Hesap adı')} <span className="form-optional">{t('isteğe bağlı')}</span>
          </span>
          <input
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('Örn. Kişisel Gmail')}
            maxLength={40}
          />
        </label>

        <label className="form-field">
          <span className="form-label">{t('Gmail adresi')}</span>
          <input
            ref={emailRef}
            className={`input ${touched && !emailValid ? 'input-error' : ''}`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@gmail.com"
            autoComplete="off"
            spellCheck={false}
            disabled={Boolean(account)}
          />
          {touched && !emailValid ? (
            <span className="form-error">{t('Geçerli bir Gmail adresi gir.')}</span>
          ) : account ? (
            <span className="form-hint">{t('Adres değiştirilemez; yeni bir hesap ekleyebilirsin.')}</span>
          ) : null}
        </label>

        <label className="form-field">
          <span className="form-label">
            {account ? t('Yeni uygulama şifresi') : t('Uygulama şifresi')}
            {account ? <span className="form-optional">{t('isteğe bağlı')}</span> : null}
          </span>
          <div className="input-group">
            <input
              className={`input ${touched && !passwordValid ? 'input-error' : ''}`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={account ? t('Değiştirmek istemiyorsan boş bırak.') : 'xxxx xxxx xxxx xxxx'}
              autoComplete="new-password"
              spellCheck={false}
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t('Şifreyi gizle') : t('Şifreyi göster')}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {touched && !passwordValid ? (
            <span className="form-error">{t('16 haneli Gmail uygulama şifresini gir.')}</span>
          ) : (
            <span className="form-hint">
              {t('Şifre yalnızca bu cihazda, Windows DPAPI ile şifrelenerek saklanır; arayüze geri dönmez.')}
            </span>
          )}
        </label>

        <div className="mail-modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void test()}
            disabled={Boolean(busy) || !emailValid || normalizedPassword.length < 8}
          >
            {busy === 'test' ? <Loader2 size={13} className="spin" /> : <Mail size={13} />}
            {busy === 'test' ? t('Test ediliyor…') : t('Bağlantıyı test et')}
          </button>
          {testResult ? (
            <span className={`mail-test-result ${testResult.ok ? 'ok' : 'error'}`}>
              {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {testResult.message}
            </span>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
