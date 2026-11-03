import { useRef, useState, type CSSProperties } from 'react';
import {
  Clock3,
  Database,
  Download,
  HardDrive,
  LogOut,
  PackageOpen,
  Palette,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import type { TranslationKey } from '../i18n/core';
import { CURRENCY_LABEL } from '../constants';
import { clearAllData, importBackup, loadPortfolioSeed, storageBytes } from './browserApi';
import { IS_TRAY } from '../lib/runtime';
import { APP_THEMES } from '../lib/appearance';
import { fileToAvatarDataUrl } from '../lib/imageFile';
import { useWebAuth } from './WebAuthGate';
import { AccountAvatar } from './AccountAvatar';
import { SyncSettings } from './SyncSettings';
import type { ClockFormat, Currency, LanguageCode, StartPage } from '../types';

const START_PAGES: { value: StartPage; label: TranslationKey }[] = [
  { value: 'dashboard', label: 'Genel Bakış' },
  { value: 'services', label: 'Servisler' },
  { value: 'companies', label: 'Şirketler' },
  { value: 'finance', label: 'Finans' },
  { value: 'tasks', label: 'Görev & Notlar' },
  { value: 'tools', label: 'Hesap & Kur' },
];

export function WebSettings() {
  const data = useAppData();
  const { meta, actions, toast, confirm } = useApp();
  const { t, language, languages, setLanguage } = useI18n();
  const { account, session, isGuest, signOut, createAccount, updateAvatar } = useWebAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      updateAvatar(await fileToAvatarDataUrl(file));
      toast('success', t('Profil fotoğrafı güncellendi.'));
    } catch (err) {
      setAvatarError(
        translateMessage(
          language,
          err instanceof Error ? err.message : t('Görsel yüklenemedi.'),
        ),
      );
    }
    setAvatarBusy(false);
  };

  const removeAvatar = () => {
    if (avatarBusy) return;
    try {
      updateAvatar(null);
      setAvatarError(null);
      toast('success', t('Profil fotoğrafı kaldırıldı.'));
    } catch (err) {
      setAvatarError(
        translateMessage(
          language,
          err instanceof Error ? err.message : t('Görsel kaldırılamadı.'),
        ),
      );
    }
  };

  const update = async (key: string, payload: Parameters<typeof actions.updateSettings>[0]) => {
    setBusy(key);
    await actions.updateSettings(payload);
    setBusy(null);
  };

  const exportBackup = async () => {
    if (exporting || !window.ezwin) return;
    setExporting(true);
    try {
      const result = await window.ezwin.app.exportData();
      if (!result.canceled && result.path) {
        toast('success', t('Yedek kaydedildi.'));
      }
    } catch (err) {
      toast('error', translateMessage(language, err instanceof Error ? err.message : t('Yedek alınamadı.')));
    }
    setExporting(false);
  };

  const importFile = async (file: File) => {
    const ok = await confirm({
      title: t('JSON yedeğini içe aktar'),
      message: IS_TRAY
        ? t('İçe aktarma mevcut cihaz verisinin yerine geçer. Devam edilsin mi?')
        : t('İçe aktarma mevcut tarayıcı verisinin yerine geçer. Devam edilsin mi?'),
      confirmLabel: t('Onayla'),
      danger: true,
    });
    if (!ok) return;
    setImporting(true);
    try {
      importBackup(await file.text());
      toast('success', t('Yedek içe aktarıldı.'));
      window.setTimeout(() => window.location.reload(), 650);
    } catch (err) {
      toast(
        'error',
        translateMessage(
          language,
          err instanceof Error ? err.message : t('Yedek dosyası okunamadı.'),
        ),
      );
      setImporting(false);
    }
  };

  const loadSeed = async () => {
    const ok = await confirm({
      title: t('EZWIN portföyünü yükle'),
      message: t(
        'EZWIN portföyü, 15 şirket ve public servis bağlantılarıyla yüklenir. Finans, görev ve not verileri eklenmez.',
      ),
      confirmLabel: t('Onayla'),
    });
    if (!ok) return;
    setBusy('seed');
    try {
      await loadPortfolioSeed();
      toast('success', t('Portföy yüklendi.'));
      window.setTimeout(() => window.location.reload(), 650);
    } catch (err) {
      toast('error', translateMessage(language, err instanceof Error ? err.message : t('Portföy dosyası yüklenemedi.')));
      setBusy(null);
    }
  };

  const clearData = async () => {
    const ok = await confirm({
      title: IS_TRAY ? t('Cihaz verisini temizle') : t('Tarayıcı verisini temizle'),
      message: IS_TRAY
        ? t('Tüm şirketler, servisler, görevler, notlar ve finans kayıtları bu cihazdan silinecek. Bu işlem geri alınamaz.')
        : t('Tüm şirketler, servisler, görevler, notlar ve finans kayıtları bu tarayıcıdan silinecek. Bu işlem geri alınamaz.'),
      confirmLabel: t('Sil'),
      danger: true,
    });
    if (!ok) return;
    setBusy('clear');
    try {
      clearAllData();
      toast('success', IS_TRAY ? t('Cihaz verisi temizlendi.') : t('Tarayıcı verisi temizlendi.'));
      window.setTimeout(() => window.location.reload(), 650);
    } catch (err) {
      toast(
        'error',
        translateMessage(
          language,
          err instanceof Error
            ? err.message
            : IS_TRAY
              ? t('Cihaz verisi temizlenemedi.')
              : t('Tarayıcı verisi temizlenemedi.'),
        ),
      );
      setBusy(null);
    }
  };

  const bytes = storageBytes();
  const sizeLabel = bytes < 1024 ? `${bytes} B` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <>
      <PageHeader
        eyebrow={t('Sistem')}
        title={t('Ayarlar')}
        subtitle={t('Dil, tema, para birimi, veri ve JSON yedekleme.')}
      />

      <div className="settings-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Genel')}</h2>
              <p>{t('Uygulamanın çalışma biçimi.')}</p>
            </div>
            <span className="card-icon"><SlidersHorizontal size={17} /></span>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Dil')}</strong>
              <span>{t('Arayüz dili. Seçim anında uygulanır.')}</span>
            </div>
            <select
              className="input select select-compact"
              value={language}
              onChange={(event) => void setLanguage(event.target.value as LanguageCode)}
              aria-label={t('Dil')}
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nativeName}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Para birimi')}</strong>
              <span>{t('Finans ekranlarındaki görüntüleme birimi.')}</span>
            </div>
            <select
              className="input select select-compact"
              value={data.settings.currency}
              disabled={busy === 'currency'}
              onChange={(event) =>
                void update('currency', { currency: event.target.value as Currency })
              }
            >
              {(Object.keys(CURRENCY_LABEL) as Currency[]).map((currency) => (
                <option key={currency} value={currency}>
                  {t(CURRENCY_LABEL[currency])}
                </option>
              ))}
            </select>
          </div>
          <p className="setting-note">
            {t('Para birimi değişikliği mevcut tutarları dönüştürmez; yalnızca sembol ve biçim değişir.')}
          </p>
        </section>

        <section className="card appearance-card">
          <div className="card-header">
            <div>
              <h2>{t('Görünüm')}</h2>
              <p>{t('Tema ve hareket ayarları.')}</p>
            </div>
            <span className="card-icon"><Palette size={17} /></span>
          </div>

          <div className="setting-row appearance-theme-row">
            <div className="setting-text">
              <strong>{t('Tema')}</strong>
              <span>{t('Uygulama renk paleti. Seçim anında uygulanır.')}</span>
            </div>
            <div className="theme-options" role="radiogroup" aria-label={t('Tema')}>
              {APP_THEMES.map((theme) => {
                const active = data.settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(theme.label)}
                    className={`theme-option ${active ? 'is-active' : ''}`}
                    disabled={busy === 'theme'}
                    onClick={() => void update('theme', { theme: theme.id })}
                    style={
                      {
                        '--theme-accent': theme.accent,
                        '--theme-surface': theme.surface,
                      } as CSSProperties
                    }
                  >
                    <span className="theme-swatch" aria-hidden="true" />
                    <span>{t(theme.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Hareketleri azalt')}</strong>
              <span>{t('Arka plan hareketlerini ve arayüz geçişlerini azaltır.')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.settings.reduceMotion}
              aria-label={t('Hareketleri azalt')}
              className={`switch ${data.settings.reduceMotion ? 'on' : ''}`}
              disabled={busy === 'motion'}
              onClick={() =>
                void update('motion', { reduceMotion: !data.settings.reduceMotion })
              }
            >
              <span className="switch-knob" />
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Saat ve başlangıç')}</h2>
              <p>{t('Saat biçimi ve açılış sayfası.')}</p>
            </div>
            <span className="card-icon"><Clock3 size={17} /></span>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Saat biçimi')}</strong>
              <span>{t('24 veya 12 saatlik gösterim.')}</span>
            </div>
            <select
              className="input select select-compact"
              value={data.settings.clockFormat ?? '24h'}
              disabled={busy === 'clock-format'}
              onChange={(event) =>
                void update('clock-format', {
                  clockFormat: event.target.value as ClockFormat,
                })
              }
            >
              <option value="24h">{t('24 saat')}</option>
              <option value="12h">{t('12 saat')}</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Saniyeyi göster')}</strong>
              <span>{t('Saat kartında saniyeleri de göster.')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.settings.showSeconds}
              aria-label={t('Saniyeyi göster')}
              className={`switch ${data.settings.showSeconds ? 'on' : ''}`}
              disabled={busy === 'clock-seconds'}
              onClick={() =>
                void update('clock-seconds', { showSeconds: !data.settings.showSeconds })
              }
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Başlangıç sayfası')}</strong>
              <span>{t('Uygulama açıldığında gösterilecek sayfa.')}</span>
            </div>
            <select
              className="input select select-compact"
              value={data.settings.startPage ?? 'dashboard'}
              disabled={busy === 'start-page'}
              onChange={(event) =>
                void update('start-page', { startPage: event.target.value as StartPage })
              }
            >
              {START_PAGES.map((page) => (
                <option key={page.value} value={page.value}>
                  {t(page.label)}
                </option>
              ))}
            </select>
          </div>

          <p className="setting-note">
            {t('Saat sistem saatine göre her saniye güncellenir.')}
          </p>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Güvenlik')}</h2>
              <p>{t('Yerel hesap, veri ve gizlilik.')}</p>
            </div>
            <span className="card-icon"><ShieldCheck size={17} /></span>
          </div>

          <div className="web-account-row">
            <AccountAvatar account={account} className="web-account-avatar" />
            <div className="web-account-text">
              <strong>{account.name}</strong>
              <span dir="ltr">{isGuest ? t('Hesap oluşturulmadı') : account.email}</span>
            </div>
            {isGuest ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={createAccount}
              >
                <UserPlus size={14} />
                {t('Hesap oluştur')}
              </button>
            ) : (
              <span className="web-platform-badge">{t('Yerel hesap')}</span>
            )}
          </div>

          <div className="profile-upload">
            <AccountAvatar account={account} className="profile-upload-avatar" />
            <div className="profile-upload-copy">
              <strong>{t('Profil fotoğrafı')}</strong>
              <span>{t('PNG, JPG veya WebP · en fazla 6 MB')}</span>
            </div>
            <div className="profile-upload-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => avatarRef.current?.click()}
                disabled={avatarBusy}
              >
                <Upload size={14} />
                {avatarBusy
                  ? t('Hazırlanıyor…')
                  : account.avatar
                    ? t('Değiştir')
                    : t('Görsel yükle')}
              </button>
              {account.avatar ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={removeAvatar}
                  disabled={avatarBusy}
                >
                  <Trash2 size={14} />
                  {t('Kaldır')}
                </button>
              ) : null}
            </div>
            <input
              ref={avatarRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="web-file-input"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadAvatar(file);
              }}
            />
          </div>
          {avatarError ? <p className="profile-upload-error">{avatarError}</p> : null}

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Oturum')}</strong>
              <span>
                {isGuest
                  ? t('Hesapsız oturum')
                  : session.remember
                    ? t('30 gün hatırlanıyor')
                    : t('Bu sekmede açık')}
              </span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>
                {IS_TRAY ? t('Bu cihazda saklanan veri') : t('Bu tarayıcıda saklanan veri')}
              </strong>
              <span>{t('Yerel depolama')}</span>
            </div>
            <span className="web-data-size">{sizeLabel}</span>
          </div>

          <p className="setting-note">
            {t('Veriler bu cihazda saklanır; eşitleme açıksa yalnızca şifreli kopya gönderilir.')}
          </p>
          <p className="setting-note">
            {t(
              'Bu giriş yerel bir kilittir; çalışma alanı verilerini şifrelemez. Şifren düz metin olarak saklanmaz.',
            )}
          </p>

          <div className="web-danger-zone web-danger-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={signOut}>
              <LogOut size={14} />
              {t('Çıkış yap')}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void clearData()}
              disabled={busy === 'clear'}
            >
              <Trash2 size={14} />
              {IS_TRAY ? t('Cihaz verisini temizle') : t('Tarayıcı verisini temizle')}
            </button>
          </div>
        </section>

        <SyncSettings />

        <section className="card settings-wide">
          <div className="card-header">
            <div>
              <h2>{t('Yedekleme')}</h2>
              <p>{t('Komuta merkezinin taşınabilir kopyası.')}</p>
            </div>
            <span className="card-icon"><Database size={17} /></span>
          </div>

          <p className="setting-note">
            {t(
              'Şirketler, servisler, görevler, notlar ve finans kayıtları JSON olarak dışa aktarılır. Dosya bu cihazda kalır.',
            )}
          </p>

          <div className="web-data-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void exportBackup()}
              disabled={exporting}
            >
              <Download size={15} />
              {exporting ? t('Hazırlanıyor…') : t('JSON yedeği al')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Upload size={15} />
              {importing ? t('Hazırlanıyor…') : t('JSON yedeğini içe aktar')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="web-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importFile(file);
              }}
            />
          </div>

          {data.companies.length === 0 ? (
            <div className="web-seed-row">
              <span className="web-seed-icon"><PackageOpen size={17} /></span>
              <div className="web-seed-text">
                <strong>{t('Hazır portföy')}</strong>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void loadSeed()}
                disabled={busy === 'seed'}
              >
                {t('EZWIN portföyünü yükle')}
              </button>
            </div>
          ) : null}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Uygulama')}</h2>
              <p>{t('Kurulu sürüm ve çalışma ortamı.')}</p>
            </div>
            <span className="card-icon"><Server size={17} /></span>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Sürüm')}</strong>
              <span>{meta?.appVersion ?? '2.0.0'}</span>
            </div>
            <span className="web-platform-badge">
              {IS_TRAY ? t('Masaüstü') : t('Web sürümü')}
            </span>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Veri saklama')}</strong>
              <span>
                {IS_TRAY ? t('Bu cihazda saklanıyor') : t('Bu tarayıcıda saklanıyor')}
              </span>
            </div>
            <span className="card-icon card-icon-soft"><HardDrive size={17} /></span>
          </div>
          <p className="setting-note">
            {t(
              'Tek kişilik komuta merkezi. Şirket portföyün, finans, görevler ve notlar tek uygulamada; veriler bu cihazda kalır.',
            )}
          </p>
          {!IS_TRAY ? (
            <p className="setting-note">
              {t('Telefonda tarayıcı menüsünden Ana ekrana ekle ile uygulamayı yükleyebilirsin.')}
            </p>
          ) : null}
        </section>

        <section className="card settings-wide">
          <div className="card-header">
            <div>
              <h2>{IS_TRAY ? t('Masaüstü sınırlamaları') : t('Tarayıcı sınırlamaları')}</h2>
              <p>{t('Güvenlik nedeniyle kapalı özellikler.')}</p>
            </div>
            <span className="card-icon"><ShieldCheck size={17} /></span>
          </div>

          {IS_TRAY ? (
            <>
              <ul className="web-limits-list">
                <li>
                  <strong>{t('Site ve bot sağlığı arka planda izlenir.')}</strong>
                  <span>
                    {t(
                      'Site erişimi ve Discord bot API’si arka planda kontrol edilir; Pterodactyl ve Gmail canlı izlenmez.',
                    )}
                  </span>
                </li>
                <li>
                  <strong>{t('Bot tokenları şifreli saklanır')}</strong>
                  <span>
                    {t(
                      'Token yalnızca bu cihazda, Windows DPAPI ile şifrelenmiş saklanır; hiçbir sunucuya gönderilmez.',
                    )}
                  </span>
                </li>
              </ul>
              <p className="setting-note">
                {t(
                  'Site ve bot durumları arka planda düzenli olarak kontrol edilir; sahte durum gösterilmez.',
                )}
              </p>
            </>
          ) : (
            <>
              <ul className="web-limits-list">
                <li>
                  <strong>{t('Canlı izleme tarayıcı sürümünde kapalı.')}</strong>
                  <span>{t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')}</span>
                </li>
                <li>
                  <strong>{t('Masaüstü sürümü gerekir')}</strong>
                  <span>
                    {t(
                      'Gmail IMAP, Discord bot API’si ve Pterodactyl anahtarları tarayıcı güvenliği nedeniyle kullanılmaz. API anahtarı veya e-posta şifresi istenmez.',
                    )}
                  </span>
                </li>
              </ul>
              <p className="setting-note">
                {t(
                  'Tarayıcı; Discord, Pterodactyl veya site durumlarını güvenli şekilde kontrol edemez. Sahte durum göstermiyoruz; servisler envanter ve hızlı bağlantı olarak kalır.',
                )}
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
