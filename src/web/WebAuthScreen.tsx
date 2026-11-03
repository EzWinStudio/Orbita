import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CloudOff,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Languages,
  Loader2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { LogoMark, Wordmark } from '../components/Logo';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { IS_TRAY } from '../lib/runtime';
import { PRODUCT_NAME } from '../lib/product';
import type { LanguageCode } from '../types';
import { AccountAvatar } from './AccountAvatar';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  loginLocalAccount,
  passwordStrength,
  registerLocalAccount,
  type AuthSession,
  type LocalAccount,
} from './webAuth';

const STRENGTH_LABELS = ['Zayıf', 'Orta', 'İyi', 'Güçlü'] as const;

type AuthMode = 'login' | 'register';

interface WebAuthScreenProps {
  account: LocalAccount | null;
  onAuthed: (session: AuthSession) => void;
  onReset: () => void;
  onGuest: () => void;
}

export function WebAuthScreen({ account, onAuthed, onReset, onGuest }: WebAuthScreenProps) {
  const { t, language, languages, setLanguage } = useI18n();
  const [mode, setMode] = useState<AuthMode>('login');
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState(account?.email ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = PRODUCT_NAME;
  }, []);

  useEffect(() => {
    if (!isRegister && account) passwordRef.current?.focus();
  }, [account, isRegister]);

  const strength = passwordStrength(password);
  const strengthLabel = strength > 0 ? t(STRENGTH_LABELS[strength - 1]) : t('Zayıf');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const nameValue = name.trim();
    const emailValue = email.trim();

    if (isRegister) {
      if (nameValue.length < 2 || nameValue.length > 60) {
        setError('Ad 2–60 karakter olmalı.');
        return;
      }
      if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        setError('Şifre 8–128 karakter olmalı.');
        return;
      }
    } else if (!emailValue || !password) {
      setError('E-posta ve şifre gerekli.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        const result = await registerLocalAccount({
          name: nameValue,
          email: emailValue,
          password,
          remember,
        });
        onAuthed(result);
      } else {
        const result = await loginLocalAccount({
          email: emailValue,
          password,
          remember,
        });
        onAuthed(result);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isRegister
            ? 'Hesap oluşturulamadı.'
            : 'Giriş yapılamadı.',
      );
      setBusy(false);
    }
  }

  function resetAccount() {
    if (busy) return;
    setError(null);
    try {
      onReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap oluşturulamadı.');
    }
  }

  function switchMode(next: AuthMode) {
    if (busy || next === mode) return;
    setMode(next);
    setResetOpen(false);
    setError(null);
    setPassword('');
    setShowPassword(false);
  }

  const errorBox = error ? (
    <p className="auth-error" role="alert">
      <AlertTriangle size={15} />
      <span>{translateMessage(language, error)}</span>
    </p>
  ) : null;

  return (
    <div className="auth">
      <div className="auth-ambient" aria-hidden="true">
        <span className="auth-glow auth-glow-a" />
        <span className="auth-glow auth-glow-b" />
        <span className="auth-grid" />
      </div>

      <header className="auth-topbar">
        <div className="auth-brand">
          <Wordmark />
          <span className="auth-web-tag">{IS_TRAY ? t('Masaüstü') : 'Web'}</span>
        </div>
        <label className="auth-lang">
          <Languages size={14} aria-hidden="true" />
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
            aria-label={t('Dil')}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.nativeName}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="auth-main">
        <section className="auth-story">
          <span className="auth-eyebrow">
            <span className="auth-pulse" />
            {t('Yerel komuta merkezi')}
          </span>
          <h1>{t('Komuta merkezi senin elinde.')}</h1>
          <p>
            {IS_TRAY
              ? t(
                  'Şirketler, servisler, finans, görevler ve notlar; hepsi bu uygulamada. Yerel hesabınla aç, kaldığın yerden devam et.',
                )
              : t(
                  'Şirketler, servisler, finans, görevler ve notlar; hepsi bu tarayıcıda. Yerel hesabınla aç, kaldığın yerden devam et.',
                )}
          </p>
          <ul className="auth-features">
            <li>
              <ShieldCheck size={16} />
              <span>
                {t('Hesap bu cihazda kalır; eşitleme açıksa yalnızca şifreli kopya gönderilir.')}
              </span>
            </li>
            <li>
              <CloudOff size={16} />
              <span>{t('İsteğe bağlı şifreli eşitleme dışında veri gönderilmez.')}</span>
            </li>
            <li>
              <LockKeyhole size={16} />
              <span>{t('Şifre düz metin olarak saklanmaz.')}</span>
            </li>
            <li>
              <ImagePlus size={16} />
              <span>{t('Profil fotoğrafı ve şirket logoları yüklenebilir.')}</span>
            </li>
          </ul>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-head">
              <span className="auth-mark">
                <LogoMark size={24} />
              </span>
              <div>
                <h2>
                  {isRegister
                    ? t('Yerel hesap oluştur')
                    : account
                      ? t('Tekrar hoş geldin')
                      : t('Giriş yap')}
                </h2>
                <p>
                  {isRegister
                    ? account
                      ? t('Hesap bu cihazda kalır; eşitleme açıksa yalnızca şifreli kopya gönderilir.')
                      : t('Bu cihazda ilk hesabı oluşturuyorsun.')
                    : t('Devam etmek için yerel hesabınla giriş yap.')}
                </p>
              </div>
            </div>

            <div className="auth-mode-tabs" role="tablist" aria-label={t('Yerel hesap')}>
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={`auth-mode-tab ${!isRegister ? 'is-active' : ''}`}
                onClick={() => switchMode('login')}
                disabled={busy}
              >
                <LogIn size={14} />
                <span>{t('Giriş yap')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={`auth-mode-tab ${isRegister ? 'is-active' : ''}`}
                onClick={() => switchMode('register')}
                disabled={busy}
              >
                <UserPlus size={14} />
                <span>{t('Hesap oluştur')}</span>
              </button>
            </div>

            {!isRegister && account ? (
              <div className="auth-account">
                <AccountAvatar account={account} className="auth-avatar" />
                <span className="auth-account-text">
                  <strong>{account.name}</strong>
                  <small dir="ltr">{account.email}</small>
                </span>
                <span className="auth-account-tag">{t('Yerel hesap')}</span>
              </div>
            ) : null}

            {!resetOpen && !isRegister && !account ? (
              <div className="auth-empty">
                <span className="auth-empty-icon">
                  <LogIn size={18} />
                </span>
                <h3>{t('Bu cihazda kayıtlı yerel hesap yok.')}</h3>
                <p>
                  {t(
                    'Giriş için önce bu cihazda bir hesap oluşturman gerekir. Dilersen hesap oluşturmadan da devam edebilirsin.',
                  )}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => switchMode('register')}
                  disabled={busy}
                >
                  <UserPlus size={16} />
                  <span>{t('Hesap oluştur')}</span>
                </button>
                <button type="button" className="auth-empty-link" onClick={onGuest} disabled={busy}>
                  {t('Hesap oluşturmadan devam et')}
                </button>
              </div>
            ) : !resetOpen && isRegister && account ? (
              <div className="auth-empty">
                <span className="auth-empty-icon">
                  <ShieldCheck size={18} />
                </span>
                <h3>{t('Bu cihazda zaten bir yerel hesap var.')}</h3>
                <p>
                  {t(
                    'Aynı cihazda ikinci bir hesap oluşturulamaz. Mevcut hesabınla giriş yapabilirsin.',
                  )}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => switchMode('login')}
                  disabled={busy}
                >
                  <LogIn size={16} />
                  <span>{t('Giriş yap')}</span>
                </button>
                <button
                  type="button"
                  className="auth-empty-link"
                  onClick={() => {
                    setMode('login');
                    setResetOpen(true);
                    setError(null);
                    setPassword('');
                  }}
                  disabled={busy}
                >
                  {t('Giriş kilidini sıfırla')}
                </button>
              </div>
            ) : resetOpen ? (
              <div className="auth-reset">
                <span className="auth-reset-icon">
                  <AlertTriangle size={18} />
                </span>
                <h3>{t('Giriş kilidini sıfırla')}</h3>
                <p>
                  {IS_TRAY
                    ? t(
                        'Bu uygulamada e-posta veya sunucu yok; şifre kurtarma yapılamaz. Sıfırlarsan giriş kilidi kaldırılır, çalışma alanı verilerin silinmez ve yeni bir hesap oluşturursun.',
                      )
                    : t(
                        'Bu tarayıcıda e-posta veya sunucu yok; şifre kurtarma yapılamaz. Sıfırlarsan giriş kilidi kaldırılır, çalışma alanı verilerin silinmez ve yeni bir hesap oluşturursun.',
                      )}
                </p>
                {errorBox}
                <div className="auth-reset-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setResetOpen(false);
                      setError(null);
                    }}
                  >
                    {t('Vazgeç')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={resetAccount}>
                    {t('Hesabı sıfırla')}
                  </button>
                </div>
              </div>
            ) : (
              <form className="auth-form" onSubmit={submit} noValidate>
                {isRegister ? (
                  <>
                    <label className="auth-field">
                      <span>{t('Ad Soyad')}</span>
                      <input
                        className="input"
                        name="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Orbita"
                        maxLength={60}
                        autoComplete="name"
                        autoFocus
                        disabled={busy}
                      />
                    </label>
                    <label className="auth-field">
                      <span>{t('E-posta')}</span>
                      <input
                        className="input"
                        name="email"
                        type="email"
                        dir="ltr"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="ornek@orbita.app"
                        maxLength={EMAIL_MAX_LENGTH}
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={busy}
                      />
                    </label>
                  </>
                ) : (
                  <label className="auth-field">
                    <span>{t('E-posta')}</span>
                    <input
                      className="input"
                      name="email"
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ornek@orbita.app"
                      maxLength={EMAIL_MAX_LENGTH}
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={busy}
                    />
                  </label>
                )}

                <label className="auth-field">
                  <span>{t('Şifre')}</span>
                  <div className="auth-password">
                    <input
                      ref={passwordRef}
                      className="input"
                      name="password"
                      dir="ltr"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={isRegister ? t('En az 8 karakter') : '••••••••'}
                      minLength={isRegister ? PASSWORD_MIN_LENGTH : undefined}
                      maxLength={PASSWORD_MAX_LENGTH}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? t('Şifreyi gizle') : t('Şifreyi göster')}
                      title={showPassword ? t('Şifreyi gizle') : t('Şifreyi göster')}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isRegister ? (
                    password ? (
                      <div className="auth-strength" aria-live="polite">
                        <div className="auth-strength-bars" aria-hidden="true">
                          {[1, 2, 3, 4].map((step) => (
                            <span
                              key={step}
                              className={`auth-strength-bar ${
                                strength >= step ? `is-on strength-${strength}` : ''
                              }`}
                            />
                          ))}
                        </div>
                        <div className="auth-strength-text">
                          <span>{t('Şifre gücü: {label}', { label: strengthLabel })}</span>
                          <small>
                            {t('En az 8 karakter. 12+ karakter, harf, rakam ve simge önerilir.')}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <small className="auth-hint">
                        {t('En az 8 karakter. 12+ karakter, harf, rakam ve simge önerilir.')}
                      </small>
                    )
                  ) : null}
                </label>

                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    {t('Beni hatırla')}
                    <small>
                      {remember
                        ? t('Oturum 30 gün boyunca bu cihazda açık kalır.')
                        : t('Sekme kapanınca oturum sona erer.')}
                    </small>
                  </span>
                </label>

                {errorBox}

                <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
                  {busy ? (
                    <Loader2 size={16} className="auth-spin" />
                  ) : isRegister ? (
                    <UserPlus size={16} />
                  ) : (
                    <LogIn size={16} />
                  )}
                  <span>
                    {busy
                      ? isRegister
                        ? t('Oluşturuluyor…')
                        : t('Doğrulanıyor…')
                      : isRegister
                        ? t('Hesabı oluştur')
                        : t('Giriş yap')}
                  </span>
                </button>
              </form>
            )}

            {!isRegister && account && !resetOpen ? (
              <div className="auth-switch">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    setResetOpen(true);
                    setError(null);
                    setPassword('');
                  }}
                >
                  {t('Şifremi unuttum')}
                </button>
              </div>
            ) : null}

            {!resetOpen && (isRegister || Boolean(account)) ? (
              <div className="auth-guest">
                <button type="button" className="auth-guest-btn" onClick={onGuest} disabled={busy}>
                  <ArrowRight size={14} />
                  <span>{t('Hesap oluşturmadan devam et')}</span>
                </button>
                <small>{t('Veriler yine bu cihazda kalır; hesabı sonradan oluşturabilirsin.')}</small>
              </div>
            ) : null}
          </div>

          <p className="auth-footnote">
            <KeyRound size={13} />
            <span>{t('Yerel hesap · veriler bu cihazda kalır')}</span>
          </p>
        </section>
      </main>
    </div>
  );
}
