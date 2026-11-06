import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CloudOff,
  Eye,
  EyeOff,
  FileJson,
  ImagePlus,
  KeyRound,
  Languages,
  Loader2,
  LockKeyhole,
  LogIn,
  MonitorDown,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { LogoMark, Wordmark } from '../components/Logo';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { IS_TRAY } from '../lib/runtime';
import { IS_ANDROID_APP } from '../lib/native';
import { PRODUCT_NAME } from '../lib/product';
import type { LanguageCode } from '../types';
import { AccountAvatar } from './AccountAvatar';
import {
  ACCOUNTS_STORAGE_KEY,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getLastCloudEmail,
  getLocalAccounts,
  importAccountBundle,
  loginLocalAccount,
  passwordStrength,
  registerLocalAccount,
  type AuthSession,
  type LocalAccount,
} from './webAuth';
import {
  CloudAuthError,
  CloudUnavailableError,
  loginCloudAccount,
  registerCloudAccount,
} from './cloudAuth';

const STRENGTH_LABELS = ['Zayıf', 'Orta', 'İyi', 'Güçlü'] as const;

type AuthMode = 'login' | 'register';

interface WebAuthScreenProps {
  account: LocalAccount | null;
  onAuthed: (session: AuthSession) => void;
  onReset: (email?: string) => void;
  onGuest: () => void;
}

export function WebAuthScreen({ account, onAuthed, onReset, onGuest }: WebAuthScreenProps) {
  const { t, language, languages, setLanguage } = useI18n();
  const [mode, setMode] = useState<AuthMode>('login');
  const isRegister = mode === 'register';
  const [accounts, setAccounts] = useState<LocalAccount[]>(() => getLocalAccounts());
  const [name, setName] = useState('');
  const [email, setEmail] = useState(account?.email ?? getLastCloudEmail() ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = PRODUCT_NAME;
  }, []);

  useEffect(() => {
    if (!isRegister && accounts.length > 0) passwordRef.current?.focus();
  }, [accounts.length, isRegister]);

  useEffect(() => {
    const refresh = () => setAccounts(getLocalAccounts());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNTS_STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    refresh();
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const strength = passwordStrength(password);
  const strengthLabel = strength > 0 ? t(STRENGTH_LABELS[strength - 1]) : t('Zayıf');

  function cloudErrorText(error: CloudAuthError): string {
    switch (error.code) {
      case 'two_factor_unsupported':
        return t('Bu hesapta iki adımlı doğrulama açık. Şimdilik masaüstü uygulamasından giriş yap.');
      case 'locked':
        return t('Çok fazla hatalı deneme. {minutes} dakika sonra tekrar dene.', {
          minutes: Math.max(1, Math.ceil(error.retryAfter / 60)),
        });
      case 'email_exists':
        return t('Bu e-posta ile kayıtlı bir hesap var. Giriş yapabilirsin.');
      case 'invalid_credentials':
        return t('E-posta veya şifre hatalı.');
      case 'invalid_input':
        return t('Bilgileri kontrol et.');
      default:
        return t('Giriş yapılamadı.');
    }
  }

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
    setNotice(null);
    try {
      if (isRegister) {
        try {
          const result = await registerCloudAccount({
            name: nameValue,
            email: emailValue,
            password,
            remember,
          });
          onAuthed(result);
        } catch (err) {
          if (!(err instanceof CloudUnavailableError)) throw err;
          const result = await registerLocalAccount({
            name: nameValue,
            email: emailValue,
            password,
            remember,
          });
          onAuthed(result);
        }
      } else {
        try {
          const result = await loginCloudAccount({
            email: emailValue,
            password,
            remember,
          });
          onAuthed(result);
        } catch (err) {
          if (err instanceof CloudUnavailableError) {
            try {
              const result = await loginLocalAccount({
                email: emailValue,
                password,
                remember,
              });
              onAuthed(result);
            } catch {
              throw new Error(t('Sunucuya ulaşılamadı. Yerel hesabınla devam edebilirsin.'));
            }
          } else if (err instanceof CloudAuthError && err.code === 'invalid_credentials') {
            try {
              const result = await loginLocalAccount({
                email: emailValue,
                password,
                remember,
              });
              onAuthed(result);
            } catch {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof CloudAuthError
          ? cloudErrorText(err)
          : err instanceof Error
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
    setNotice(null);
    const typed = email.trim().toLowerCase();
    const target =
      accounts.find((item) => item.email.toLowerCase() === typed) ??
      (accounts.length === 1 ? accounts[0] : null);
    if (!target) {
      setError(typed ? 'Bu e-posta ile kayıtlı hesap yok.' : 'Bu cihazda kayıtlı hesap yok.');
      return;
    }
    try {
      onReset(target.email);
      setAccounts(getLocalAccounts().filter((item) => item.id !== target.id));
      setResetOpen(false);
      setEmail('');
      setPassword('');
      setNotice('Hesabın bu cihazdan kaldırıldı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap kaldırılamadı.');
    }
  }

  function chooseAccount(next: LocalAccount) {
    if (busy) return;
    setMode('login');
    setResetOpen(false);
    setError(null);
    setNotice(null);
    setPassword('');
    setEmail(next.email);
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  async function importFile(file: File) {
    if (importBusy || busy) return;
    setImportBusy(true);
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const imported = importAccountBundle(text);
      setAccounts(getLocalAccounts());
      setMode('login');
      setResetOpen(false);
      setEmail(imported.email);
      setPassword('');
      setNotice('Hesap bu cihaza eklendi. Şifrenle giriş yap.');
      requestAnimationFrame(() => passwordRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap dosyası okunamadı.');
    } finally {
      setImportBusy(false);
    }
  }

  function switchMode(next: AuthMode) {
    if (busy || next === mode) return;
    setMode(next);
    setResetOpen(false);
    setError(null);
    setNotice(null);
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
          <span className="auth-web-tag">{IS_TRAY ? t('Masaüstü') : IS_ANDROID_APP ? 'Android' : 'Web'}</span>
        </div>
        <div className="auth-actions">
          {IS_TRAY || IS_ANDROID_APP ? null : (
            <>
              <a className="auth-download-chip" href="./indir/" title={t('Windows uygulamasını indir')}>
                <MonitorDown size={14} aria-hidden="true" />
                <span>Windows</span>
              </a>
              <a
                className="auth-download-chip"
                href="./indir/#android"
                title={t('Android uygulamasını indir')}
              >
                <Smartphone size={14} aria-hidden="true" />
                <span>Android</span>
              </a>
            </>
          )}
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
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-story">
          <span className="auth-eyebrow">
            <span className="auth-pulse" />
            {t('Yerel komuta merkezi')}
          </span>
          <h1>{t('Komuta merkezi senin elinde.')}</h1>
          <p>
            {IS_TRAY || IS_ANDROID_APP
              ? t(
                  'Şirketler, servisler, finans, görevler ve notlar; hepsi bu uygulamada. Yerel hesabınla aç, kaldığın yerden devam et.',
                )
              : t(
                  'Şirketler, servisler, finans, görevler ve notlar; hepsi bu tarayıcıda. Hesabınla aç, kaldığın yerden devam et.',
                )}
          </p>
          <ul className="auth-features">
            <li>
              <ShieldCheck size={16} />
              <span>
                {t(
                  'Şifren sunucuda yalnızca geri döndürülemez özet olarak saklanır; çalışma alanın bu cihazda kalır.',
                )}
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
          {IS_TRAY || IS_ANDROID_APP ? null : (
            <div className="auth-downloads">
              <a className="auth-desktop-cta" href="./indir/">
                <span className="auth-desktop-icon">
                  <MonitorDown size={18} aria-hidden="true" />
                </span>
                <span className="auth-desktop-text">
                  <strong>{t('Windows uygulamasını indir')}</strong>
                  <em>{t('Tepside çalışır; veriler yerelde kalır.')}</em>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <a className="auth-desktop-cta" href="./indir/#android">
                <span className="auth-desktop-icon">
                  <Smartphone size={18} aria-hidden="true" />
                </span>
                <span className="auth-desktop-text">
                  <strong>{t('Android uygulamasını indir')}</strong>
                  <em>{t('APK olarak indir; aynı hesapla telefonda devam et.')}</em>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          )}
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
                    ? accounts.length > 0
                      ? t('Yeni hesap ekle')
                      : t('Hesap oluştur')
                    : accounts.length > 0
                      ? t('Tekrar hoş geldin')
                      : t('Giriş yap')}
                </h2>
                <p>
                  {isRegister
                    ? accounts.length > 0
                      ? t('Bu cihaza yeni bir hesap ekle.')
                      : t('İlk hesabını oluşturuyorsun.')
                    : t('Devam etmek için hesabınla giriş yap.')}
                </p>
              </div>
            </div>

            <div className="auth-mode-tabs" role="tablist" aria-label={t('Hesap')}>
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
                <span>{accounts.length > 0 ? t('Hesap ekle') : t('Hesap oluştur')}</span>
              </button>
            </div>

            {!isRegister && accounts.length > 0 && !resetOpen ? (
              <div className="auth-accounts">
                <div className="auth-accounts-head">
                  <span>{t('Bu cihazdaki hesaplar')}</span>
                  <small>{t('Giriş yapmak istediğin hesabı seç.')}</small>
                </div>
                <div className="auth-account-list">
                  {accounts.map((item) => {
                    const active = item.email.toLowerCase() === email.trim().toLowerCase();
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`auth-account-chip ${active ? 'is-active' : ''}`}
                        onClick={() => chooseAccount(item)}
                        disabled={busy || importBusy}
                      >
                        <AccountAvatar account={item} className="auth-account-chip-avatar" />
                        <span className="auth-account-chip-text">
                          <strong>{item.name}</strong>
                          <small dir="ltr">{item.email}</small>
                        </span>
                        {active ? <Check size={15} className="auth-account-chip-check" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!isRegister && accounts.length === 0 && !resetOpen ? (
              <div className="auth-note">
                <span className="auth-note-icon">
                  <LogIn size={16} />
                </span>
                <div>
                  <strong>
                    {IS_ANDROID_APP
                      ? t('Bu cihazda kayıtlı hesap yok.')
                      : t('Bu tarayıcıda kayıtlı hesap yok.')}
                  </strong>
                  <p>
                    {t('Masaüstü hesabınla veya yeni bir hesapla giriş yapabilirsin.')}
                  </p>
                </div>
              </div>
            ) : null}

            {resetOpen ? (
              <div className="auth-reset">
                <span className="auth-reset-icon">
                  <AlertTriangle size={18} />
                </span>
                <h3>{t('Bu cihazdaki girişi sıfırla')}</h3>
                {email ? (
                  <strong className="auth-reset-target" dir="ltr">
                    {email}
                  </strong>
                ) : null}
                <p>
                  {t(
                    'Bu işlem yalnızca bu cihazdaki giriş kaydını siler. Sunucu hesabı ve çalışma alanı verileri korunur.',
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
                    {t('Hesabı kaldır')}
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

                {notice ? (
                  <p className="auth-notice" role="status">
                    <Check size={15} />
                    <span>{translateMessage(language, notice)}</span>
                  </p>
                ) : null}
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

            {!resetOpen ? (
              <div className="auth-import">
                <button
                  type="button"
                  className="auth-import-btn"
                  onClick={() => importRef.current?.click()}
                  disabled={busy || importBusy}
                >
                  {importBusy ? (
                    <Loader2 size={14} className="auth-spin" />
                  ) : (
                    <FileJson size={14} />
                  )}
                  <span>{t('Hesap dosyası içe aktar')}</span>
                </button>
                <small>{t('Başka bir cihazdaki hesabı bu cihaza ekle.')}</small>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void importFile(file);
                  }}
                />
              </div>
            ) : null}

            {!isRegister && accounts.length > 0 && !resetOpen ? (
              <div className="auth-switch">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    setResetOpen(true);
                    setError(null);
                    setNotice(null);
                    setPassword('');
                  }}
                >
                  {t('Bu cihazdaki girişi sıfırla')}
                </button>
              </div>
            ) : null}

            {!resetOpen ? (
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
            <span>{t('Hesap · çalışma alanı bu cihazda kalır')}</span>
          </p>
        </section>
      </main>
    </div>
  );
}
