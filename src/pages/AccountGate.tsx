import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { LogoMark, Wordmark } from '../components/Logo';
import type { AccountInfo, TwoFactorPending } from '../types';

interface AccountGateProps {
  accounts: AccountInfo[];
  onAuthed: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EZ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function scorePassword(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-zçğıöşü]/i.test(value) && /[A-ZÇĞİÖŞÜ]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 16) score += 1;
  const capped = Math.min(5, score);
  const labels = ['çok zayıf', 'zayıf', 'orta', 'iyi', 'güçlü', 'çok güçlü'];
  return { score: capped, label: labels[capped] };
}

export function AccountGate({ accounts, onAuthed }: AccountGateProps) {
  const hasAccounts = accounts.length > 0;
  const [mode, setMode] = useState<'login' | 'register'>(hasAccounts ? 'login' : 'register');
  const [email, setEmail] = useState(hasAccounts ? accounts[0].email : '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [remember, setRemember] = useState(
    hasAccounts ? accounts[0]?.security?.rememberDefault ?? true : true,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<TwoFactorPending | null>(null);
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const strength = useMemo(() => scorePassword(password), [password]);
  const selectedAccount = accounts.find((account) => account.email === email) ?? null;
  const verifying = challenge !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const api = window.ezwin;
    if (!api) {
      setError('Uygulama köprüsü kurulamadı. Orbita’yı uygulama olarak başlat.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (challenge) {
        const result = await api.session.verify2fa({
          challengeId: challenge.challengeId,
          code,
        });
        if (result.account) {
          onAuthed();
          return;
        }
        throw new Error('Doğrulama tamamlanamadı. Girişi baştan dene.');
      }
      if (mode === 'register') {
        await api.session.register({ email, password, name, remember });
        onAuthed();
        return;
      }
      const result = await api.session.login({ email, password, remember });
      if ('challengeId' in result) {
        setChallenge(result);
        setCode('');
        setUseBackupCode(false);
        setBusy(false);
        window.setTimeout(() => codeRef.current?.focus(), 60);
        return;
      }
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
      setBusy(false);
    }
  }

  function backToLogin() {
    setChallenge(null);
    setCode('');
    setUseBackupCode(false);
    setError(null);
    setBusy(false);
    setPassword('');
  }

  function switchMode(next: 'login' | 'register') {
    if (next === mode) return;
    setMode(next);
    setPassword('');
    setError(null);
  }

  function chooseAccount(account: AccountInfo) {
    if (verifying) backToLogin();
    setMode('login');
    setEmail(account.email);
    setPassword('');
    setError(null);
  }

  if (challenge) {
    return (
      <div className="gate">
        <div className="gate-aurora" aria-hidden="true" />
        <section className="gate-brand">
          <Wordmark />
          <h1>
            Bir adım daha
            <br />
            <span className="gate-gradient">güvendesin.</span>
          </h1>
          <p>
            Hesabında iki adımlı doğrulama açık. Telefonundaki doğrulayıcı uygulamadan gelen
            6 haneli kodu girerek girişi tamamla.
          </p>
          <ul className="gate-features">
            <li>
              <ShieldCheck size={15} /> Şifren tek başına yeterli değil; kod da gerekir.
            </li>
            <li>
              <KeyRound size={15} /> Telefonuna ulaşamıyorsan yedek kodlarından birini kullan.
            </li>
            <li>
              <Lock size={15} /> Doğrulama birkaç dakika içinde tamamlanmalı.
            </li>
          </ul>
        </section>

        <section className="gate-panel">
          <div className="gate-card">
            <div className="gate-card-head">
              <span className="gate-logo">
                <ShieldCheck size={22} />
              </span>
              <div>
                <strong>İki adımlı doğrulama</strong>
                <small>{challenge.email} için doğrulama kodu</small>
              </div>
            </div>

            <div className="gate-accounts" role="list">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="listitem"
                  className="gate-account active"
                  onClick={() => chooseAccount(account)}
                >
                  <span className="gate-avatar" style={{ background: account.color }}>
                    {account.avatar || initials(account.name)}
                  </span>
                  <span className="gate-account-text">
                    <strong>{account.name}</strong>
                    <small>{account.email}</small>
                  </span>
                  <ShieldCheck size={14} />
                </button>
              ))}
            </div>

            <form className="gate-form" onSubmit={submit}>
              <label className="gate-field">
                <span>{useBackupCode ? 'Yedek kod' : 'Doğrulama kodu'}</span>
                <input
                  ref={codeRef}
                  className={`input gate-code ${useBackupCode ? 'backup' : ''}`}
                  value={code}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCode(useBackupCode ? value.toUpperCase() : value.replace(/[^\d]/g, ''));
                  }}
                  placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
                  inputMode={useBackupCode ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  maxLength={useBackupCode ? 9 : 6}
                  required
                />
                <small>
                  {useBackupCode
                    ? 'Yedek kodlar yalnızca bir kez kullanılabilir.'
                    : 'Kod her 30 saniyede yenilenir.'}
                </small>
              </label>

              {error ? <p className="gate-error">{error}</p> : null}

              <button type="submit" className="btn btn-primary gate-submit" disabled={busy}>
                {busy ? 'Doğrulanıyor…' : 'Doğrula ve giriş yap'}
                {busy ? null : <ArrowRight size={15} />}
              </button>
            </form>

            <div className="gate-switch gate-switch-row">
              <button
                type="button"
                className="gate-link"
                onClick={() => {
                  setUseBackupCode((prev) => !prev);
                  setCode('');
                  setError(null);
                  window.setTimeout(() => codeRef.current?.focus(), 40);
                }}
              >
                {useBackupCode ? 'Doğrulama kodunu kullan' : 'Yedek kod kullan'}
              </button>
              <button type="button" className="gate-link gate-back" onClick={backToLogin}>
                <ArrowLeft size={12} /> Girişe dön
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate-aurora" aria-hidden="true" />
      <section className="gate-brand">
        <Wordmark />
        <h1>
          Şirketini tek yerden
          <br />
          <span className="gate-gradient">yönet.</span>
        </h1>
        <p>
          Orbita hesabınla giriş yap. Kanal bağlantıların, müziğin, notların ve finans
          kayıtların yalnızca senin hesabına ait klasörde tutulur.
        </p>
        <ul className="gate-features">
          <li>
            <ShieldCheck size={15} /> Şifreler scrypt ile, erişim jetonları Windows DPAPI ile şifrelenir.
          </li>
          <li>
            <Lock size={15} /> Hatalı denemeler kademeli olarak kilitlenir.
          </li>
          <li>
            <UserPlus size={15} /> Her hesabın kendi profili, avatarı ve güvenlik ayarı var.
          </li>
        </ul>
      </section>

      <section className="gate-panel">
        <div className="gate-card">
          <div className="gate-card-head">
            <span className="gate-logo">
              <LogoMark size={22} />
            </span>
            <div>
              <strong>{mode === 'register' ? 'Hesap oluştur' : 'Tekrar hoş geldin'}</strong>
              <small>
                {mode === 'register'
                  ? 'Devam etmek için bir hesap gerekli.'
                  : 'Devam etmek için şifreni gir.'}
              </small>
            </div>
          </div>

          <div className="gate-tabs" role="tablist" aria-label="Hesap işlemi">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'gate-tab active' : 'gate-tab'}
              onClick={() => switchMode('login')}
            >
              Giriş yap
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'gate-tab active' : 'gate-tab'}
              onClick={() => switchMode('register')}
            >
              Hesap oluştur
            </button>
          </div>

          {hasAccounts ? (
            <div className="gate-accounts" role="list">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="listitem"
                  className={`gate-account ${email === account.email && mode === 'login' ? 'active' : ''}`}
                  onClick={() => chooseAccount(account)}
                >
                  <span className="gate-avatar" style={{ background: account.color }}>
                    {account.avatar || initials(account.name)}
                  </span>
                  <span className="gate-account-text">
                    <strong>{account.name}</strong>
                    <small>{account.email}</small>
                  </span>
                  {account.twoFactorEnabled ? (
                    <span className="gate-2fa" title="İki adımlı doğrulama açık">
                      <ShieldCheck size={12} /> 2FA
                    </span>
                  ) : null}
                  {email === account.email && mode === 'login' && !account.twoFactorEnabled ? (
                    <Lock size={13} />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <form className="gate-form" onSubmit={submit}>
            {mode === 'register' ? (
              <label className="gate-field">
                <span>Ad</span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Orbita"
                  maxLength={60}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="gate-field">
              <span>E-posta</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sen@orbita.app"
                required
                autoComplete="email"
              />
            </label>

            <label className="gate-field">
              <span>Şifre</span>
              <div className="gate-password">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'register' ? 'En az 10 karakter' : '••••••••'}
                  required
                  minLength={mode === 'register' ? 10 : undefined}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="gate-eye"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {mode === 'register' ? (
              <div className="gate-strength">
                <div className="gate-strength-bar" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      className={`gate-strength-step ${strength.score >= step ? `filled level-${strength.score}` : ''}`}
                    />
                  ))}
                </div>
                <div className="gate-strength-text">
                  <span>Şifre gücü: {strength.label}</span>
                  <small>12+ karakter, harf + rakam + simge önerilir.</small>
                </div>
              </div>
            ) : null}

            <label className="gate-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>
                Beni hatırla
                <small>
                  {remember
                    ? 'Oturum 30 gün boyunca bu cihazda açık kalır.'
                    : 'Uygulama kapanınca oturum sona erer; tekrar giriş istersin.'}
                </small>
              </span>
            </label>

            {selectedAccount && mode === 'login' ? (
              <p className="gate-account-meta">
                {selectedAccount.securityScore}/100 güvenlik puanı
                {selectedAccount.twoFactorEnabled ? ' · iki adımlı doğrulama açık' : ''} · son giriş{' '}
                {selectedAccount.lastLoginAt
                  ? new Date(selectedAccount.lastLoginAt).toLocaleString('tr-TR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'yok'}
              </p>
            ) : null}

            {!hasAccounts && mode === 'login' ? (
              <p className="gate-hint">
                Bu bilgisayarda kayıtlı hesap yok. Önce <b>Hesap oluştur</b> sekmesinden bir hesap aç;
                sonraki açılışlarda bu ekrandan şifrenle giriş yapacaksın.
              </p>
            ) : null}

            {error ? <p className="gate-error">{error}</p> : null}

            <button
              type="submit"
              className="btn btn-primary gate-submit"
              disabled={busy || (!hasAccounts && mode === 'login')}
            >
              {busy ? 'İşleniyor…' : mode === 'register' ? 'Hesabı oluştur' : 'Giriş yap'}
              {busy ? null : <ArrowRight size={15} />}
            </button>
          </form>

          <div className="gate-switch">
            {hasAccounts ? (
              <button
                type="button"
                className="gate-link"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Bu bilgisayarda yeni hesap oluştur' : 'Mevcut hesabımla giriş yap'}
              </button>
            ) : mode === 'register' ? (
              <span>Bu bilgisayarda ilk hesabı oluşturuyorsun.</span>
            ) : (
              <span>Hesabın yoksa üstteki <b>Hesap oluştur</b> sekmesine geç.</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
