import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  Download,
  FolderOpen,
  KeyRound,
  LogOut,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import type { AutoLockMinutes, SessionPayload } from '../types';

const AVATARS = ['🦊', '🐺', '🦉', '🐯', '🦁', '🐼', '🐨', '🐸', '🦄', '🐙', '🦋', '🌙', '⚡', '🚀', '🎧', '💎'];
const COLORS = ['#3ef2b5', '#5fc6ff', '#b98bff', '#ffc857', '#ff8fd8', '#a8ff60', '#ff8a1e'];
const AUTO_LOCK: { value: AutoLockMinutes; label: string }[] = [
  { value: 0, label: 'Kapalı' },
  { value: 5, label: '5 dakika' },
  { value: 15, label: '15 dakika' },
  { value: 30, label: '30 dakika' },
  { value: 60, label: '60 dakika' },
];

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

function levelLabel(score: number): string {
  if (score >= 80) return 'Yüksek';
  if (score >= 55) return 'Orta';
  return 'Geliştirilmeli';
}

export function Account() {
  const { actions, meta, toast } = useApp();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);

  const load = async () => {
    const payload = await window.ezwin?.session.get();
    if (!payload) return;
    setSession(payload);
    if (payload.account) {
      setName(payload.account.name);
      setAvatar(payload.account.avatar);
      setColor(payload.account.color);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const account = session?.account ?? null;
  const strength = useMemo(() => scorePassword(next), [next]);
  const passwordsMatch = !confirm || next === confirm;

  if (!account) {
    return (
      <>
        <PageHeader eyebrow="Hesap" title="Hesap" subtitle="Hesap bilgileri yükleniyor…" />
      </>
    );
  }

  const security = account.security;

  async function saveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    const result = await actions.updateAccountProfile({ name, avatar, color });
    if (result) {
      setSession((prev) =>
        prev ? { ...prev, account: result.account, accounts: result.accounts } : prev,
      );
      toast('success', 'Profil güncellendi.');
    }
    setSavingProfile(false);
  }

  async function saveSecurity(patch: Parameters<typeof actions.updateAccountSecurity>[0]) {
    if (savingSecurity) return;
    setSavingSecurity(true);
    const result = await actions.updateAccountSecurity(patch);
    if (result) {
      setSession((prev) =>
        prev ? { ...prev, account: result.account, accounts: result.accounts } : prev,
      );
    }
    setSavingSecurity(false);
  }

  async function changePassword() {
    if (changing) return;
    if (next.length < 10) {
      toast('error', 'Yeni şifre en az 10 karakter olmalı.');
      return;
    }
    if (next !== confirm) {
      toast('error', 'Yeni şifreler eşleşmiyor.');
      return;
    }
    setChanging(true);
    const result = await actions.changePassword({ currentPassword: current, nextPassword: next });
    if (result) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setSession((prev) =>
        prev ? { ...prev, account: result.account, accounts: result.accounts } : prev,
      );
    }
    setChanging(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Hesap"
        title={account.name}
        subtitle="Profilini özelleştir, güvenlik seviyeni yükselt ve oturum davranışını yönet."
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void actions.lockApp()}
            title="Hesabı kilitle ve giriş ekranına dön"
          >
            <LogOut size={15} /> Kilitle
          </button>
        }
      />

      <div className="account-hero card">
        <span className="account-avatar" style={{ background: account.color }}>
          {account.avatar || initials(account.name)}
        </span>
        <div className="account-hero-text">
          <strong>{account.name}</strong>
          <small>{account.email}</small>
          <span className="account-hero-meta">
            <Clock3 size={12} /> Oluşturma:{' '}
            {new Date(account.createdAt).toLocaleDateString('tr-TR')}
            {account.lastLoginAt
              ? ` · Son giriş: ${new Date(account.lastLoginAt).toLocaleString('tr-TR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}`
              : ''}
          </span>
        </div>
        <div className="account-score">
          <span className={`account-score-ring score-${account.securityScore >= 80 ? 'high' : account.securityScore >= 55 ? 'mid' : 'low'}`}>
            <b>{account.securityScore}</b>
            <small>/100</small>
          </span>
          <span className="account-score-text">
            Güvenlik seviyesi
            <strong>{levelLabel(account.securityScore)}</strong>
          </span>
        </div>
      </div>

      <div className="account-grid">
        <section className="card account-card">
          <div className="card-header">
            <h2>
              <UserRound size={16} /> Profil
            </h2>
          </div>
          <div className="account-card-body">
            <label className="account-field">
              <span>Görünen ad</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="Adın"
              />
            </label>

            <div className="account-field">
              <span>Avatar</span>
              <div className="account-avatars">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={avatar === emoji ? 'account-avatar-option active' : 'account-avatar-option'}
                    onClick={() => setAvatar(emoji)}
                    aria-label={`Avatar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  className={avatar === null ? 'account-avatar-option active' : 'account-avatar-option'}
                  onClick={() => setAvatar(null)}
                  title="Baş harfleri kullan"
                >
                  {initials(name || account.name)}
                </button>
              </div>
            </div>

            <div className="account-field">
              <span>Renk</span>
              <div className="account-colors">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={color === value ? 'account-color active' : 'account-color'}
                    style={{ background: value }}
                    onClick={() => setColor(value)}
                    aria-label={`Renk ${value}`}
                  >
                    {color === value ? <Check size={12} /> : null}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void saveProfile()}
              disabled={savingProfile || !name.trim()}
            >
              <Palette size={13} /> {savingProfile ? 'Kaydediliyor…' : 'Profili kaydet'}
            </button>
          </div>
        </section>

        <section className="card account-card">
          <div className="card-header">
            <h2>
              <ShieldCheck size={16} /> Güvenlik
            </h2>
            <span className="account-muted">{account.securityScore}/100</span>
          </div>
          <div className="account-card-body">
            <label className="account-field">
              <span>Hareketsizlikte otomatik kilit</span>
              <select
                className="input"
                value={security.autoLockMinutes}
                disabled={savingSecurity}
                onChange={(event) =>
                  void saveSecurity({ autoLockMinutes: Number(event.target.value) as AutoLockMinutes })
                }
              >
                {AUTO_LOCK.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Belirtilen süre boyunca işlem yapılmazsa uygulama kilitlenir.</small>
            </label>

            <label className="account-toggle">
              <input
                type="checkbox"
                checked={security.lockOnBlur}
                disabled={savingSecurity}
                onChange={(event) => void saveSecurity({ lockOnBlur: event.target.checked })}
              />
              <span>
                Pencere odağı kaybolunca kilitle
                <small>Başka bir uygulamaya geçtiğinde veriler gizlenir.</small>
              </span>
            </label>

            <label className="account-toggle">
              <input
                type="checkbox"
                checked={security.rememberDefault}
                disabled={savingSecurity}
                onChange={(event) => void saveSecurity({ rememberDefault: event.target.checked })}
              />
              <span>
                Girişte “Beni hatırla” varsayılan açık
                <small>Kapalıysa her açılışta şifre sorulur.</small>
              </span>
            </label>

            <div className="account-meta-list">
              <span>
                Şifre gücü <b>{account.passwordScore}/5</b>
              </span>
              <span>
                Son değişiklik{' '}
                <b>
                  {account.passwordChangedAt
                    ? new Date(account.passwordChangedAt).toLocaleDateString('tr-TR')
                    : 'bilinmiyor'}
                </b>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="card account-card">
        <div className="card-header">
          <h2>
            <KeyRound size={16} /> Şifre değiştir
          </h2>
        </div>
        <div className="account-card-body account-password">
          <label className="account-field">
            <span>Mevcut şifre</span>
            <input
              className="input"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="account-field">
            <span>Yeni şifre</span>
            <input
              className="input"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="account-field">
            <span>Yeni şifre (tekrar)</span>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
            {!passwordsMatch ? <small className="account-error">Şifreler eşleşmiyor.</small> : null}
          </label>
          <div className="account-strength">
            <div className="account-strength-bar" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={strength.score >= step ? `filled level-${strength.score}` : ''}
                />
              ))}
            </div>
            <small>Yeni şifre: {next ? strength.label : 'en az 10 karakter, harf + rakam'}</small>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void changePassword()}
            disabled={changing || !current || next.length < 10 || !passwordsMatch}
          >
            <ShieldCheck size={13} /> {changing ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
          </button>
        </div>
      </section>

      <section className="card account-card">
        <div className="card-header">
          <h2>
            <FolderOpen size={16} /> Veri ve yedek
          </h2>
        </div>
        <div className="account-card-body">
          <p className="account-path">
            <span>Veri dosyası</span>
            <code>{meta?.dataPath ?? '—'}</code>
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ezwin?.app.revealData()}
            >
              <FolderOpen size={13} /> Klasörü aç
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                try {
                  const result = await window.ezwin?.app.exportData();
                  if (result && !result.canceled) toast('success', 'Yedek kaydedildi.');
                } catch {
                  toast('error', 'Yedek alınamadı.');
                }
              }}
            >
              <Download size={13} /> Yedek al
            </button>
          </div>
          <p className="account-muted">
            Bu hesabın verisi ayrı klasörde tutulur; başka hesapla karışmaz.
          </p>
        </div>
      </section>
    </>
  );
}
