import { useState, type CSSProperties } from 'react';
import {
  Bell,
  BellRing,
  Bot,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Globe2,
  KeyRound,
  Monitor,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { YoutubeIcon } from '../components/YoutubeIcon';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { CURRENCY_LABEL } from '../constants';
import { APP_THEMES } from '../lib/appearance';
import type { TranslationKey } from '../i18n/core';
import type { ClockFormat, Currency, LanguageCode, StartPage, YoutubeKey } from '../types';

const INTERVALS: { value: number; label: TranslationKey }[] = [
  { value: 30, label: '30 saniye' },
  { value: 60, label: '60 saniye' },
  { value: 120, label: '2 dakika' },
  { value: 300, label: '5 dakika' },
  { value: 600, label: '10 dakika' },
];

const START_PAGES: { value: StartPage; label: TranslationKey }[] = [
  { value: 'dashboard', label: 'Genel Bakış' },
  { value: 'services', label: 'Servisler' },
  { value: 'companies', label: 'Şirketler' },
  { value: 'mail', label: 'Posta' },
  { value: 'finance', label: 'Finans' },
  { value: 'tasks', label: 'Görev & Notlar' },
  { value: 'tools', label: 'Hesap & Kur' },
];

export function Settings() {
  const data = useAppData();
  const { meta, actions, toast, confirm } = useApp();
  const { t, language, languages, setLanguage } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [youtubeLabel, setYoutubeLabel] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [youtubeBusy, setYoutubeBusy] = useState<string | null>(null);
  const [youtubeTesting, setYoutubeTesting] = useState<string | null>(null);
  const [youtubeGuideOpen, setYoutubeGuideOpen] = useState(data.youtubeKeys.length === 0);

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
      toast('error', err instanceof Error ? err.message : t('Yedek alınamadı.'));
    }
    setExporting(false);
  };

  const revealData = async () => {
    try {
      await window.ezwin?.app.revealData();
    } catch {
      toast('error', t('Veri klasörü açılamadı.'));
    }
  };

  const sendTestNotification = async () => {
    if (testingNotification) return;
    setTestingNotification(true);
    try {
      await window.ezwin?.settings.testNotification();
      toast('success', t('Test bildirimi gönderildi.'));
    } catch (err) {
      toast(
        'error',
        err instanceof Error ? err.message : t('Test bildirimi gönderilemedi.'),
      );
    }
    setTestingNotification(false);
  };

  const saveYoutubeKey = async () => {
    const value = youtubeKey.trim();
    if (!value || youtubeBusy) return;
    setYoutubeBusy('add');
    const label =
      youtubeLabel.trim() ||
      t('YouTube anahtarı {count}', { count: data.youtubeKeys.length + 1 });
    const ok = await actions.addYoutubeKey(label, value);
    if (ok) {
      setYoutubeLabel('');
      setYoutubeKey('');
      setShowYoutubeKey(false);
    }
    setYoutubeBusy(null);
  };

  const testNewYoutubeKey = async () => {
    if (!youtubeKey.trim() || youtubeTesting) return;
    setYoutubeTesting('new');
    const result = await actions.testYoutubeKey({ key: youtubeKey.trim() });
    setYoutubeTesting(null);
    if (!result) return;
    toast(
      result.ok ? 'success' : 'error',
      translateMessage(language, result.message),
    );
  };

  const testSavedYoutubeKey = async (id: string) => {
    if (youtubeTesting) return;
    setYoutubeTesting(id);
    const result = await actions.testYoutubeKey({ id });
    setYoutubeTesting(null);
    if (!result) return;
    toast(
      result.ok ? 'success' : 'error',
      translateMessage(language, result.message),
    );
  };

  const makeDefaultYoutubeKey = async (id: string) => {
    if (youtubeBusy) return;
    setYoutubeBusy(`default:${id}`);
    await actions.setDefaultYoutubeKey(id);
    setYoutubeBusy(null);
  };

  const removeYoutubeKey = async (key: YoutubeKey) => {
    const ok = await confirm({
      title: t('Anahtarı kaldır'),
      message: t(
        'Bu anahtar kaldırılsın mı? Bağlı kanallar varsayılan anahtara taşınır.',
      ),
      confirmLabel: t('Anahtarı kaldır'),
      danger: true,
    });
    if (ok) await actions.removeYoutubeKey(key.id);
  };

  return (
    <>
      <PageHeader
        eyebrow={t('Sistem')}
        title={t('Ayarlar')}
        subtitle={t('İzleme ritmi, para birimi, güvenlik ve yerel yedekleme.')}
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
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
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
              onChange={(event) => void update('currency', { currency: event.target.value as Currency })}
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

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Kontrol aralığı')}</strong>
              <span>{t('Servislerin gerçek API kontrol sıklığı.')}</span>
            </div>
            <select
              className="input select select-compact"
              value={data.settings.pollIntervalSec}
              disabled={busy === 'interval'}
              onChange={(event) =>
                void update('interval', { pollIntervalSec: Number(event.target.value) })
              }
            >
              {INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {t(interval.label)}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Windows açılışında başlat')}</strong>
              <span>{t('Bilgisayar açıldığında Orbita otomatik açılır.')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.settings.openAtLogin}
              className={`switch ${data.settings.openAtLogin ? 'on' : ''}`}
              onClick={() =>
                void update('login', { openAtLogin: !data.settings.openAtLogin })
              }
            >
              <span className="switch-knob" />
            </button>
          </div>
        </section>

        <section className="card appearance-card">
          <div className="card-header">
            <div>
              <h2>{t('Görünüm')}</h2>
              <p>{t('Tema, pencere modu ve hareket ayarları.')}</p>
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
              <strong>{t('Pencereyi büyüt')}</strong>
              <span>
                {t('Başlık çubuğu görünür kalır; pencere ekranın kenarlarını kaplar. Seçim açılışta korunur.')}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.settings.maximized}
              aria-label={t('Pencereyi büyüt')}
              className={`switch ${data.settings.maximized ? 'on' : ''}`}
              disabled={busy === 'maximize'}
              onClick={() =>
                void update('maximize', { maximized: !data.settings.maximized })
              }
            >
              <span className="switch-knob" />
            </button>
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
              className={`switch ${data.settings.showSeconds ? 'on' : ''}`}
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
                void update('start-page', {
                  startPage: event.target.value as StartPage,
                })
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

        <section className="card settings-wide youtube-key-card">
          <div className="card-header">
            <div>
              <h2 className="yt-heading">
                <span className="yt-heading-icon">
                  <YoutubeIcon size={16} />
                </span>
                {t('YouTube API')}
              </h2>
              <p>{t('Birden fazla anahtar ekle; kanalları anahtarlara paylaştır.')}</p>
            </div>
            <span className="card-icon"><YoutubeIcon size={17} /></span>
          </div>

          {data.youtubeKeys.length > 0 ? (
            <>
              <div className="yt-key-list-head">
                <strong>{t('Anahtarlar')}</strong>
                <span>{t('{count} kanal', { count: data.youtubeChannels.length })}</span>
              </div>
              <div className="yt-key-list">
                {data.youtubeKeys.map((key) => (
                  <div key={key.id} className={`yt-key-row${key.isDefault ? ' default' : ''}`}>
                    <span className="yt-key-row-icon"><KeyRound size={15} /></span>
                    <div className="yt-key-copy">
                      <div className="yt-key-name">
                        <strong>{key.label}</strong>
                        {key.isDefault ? (
                          <span className="yt-key-badge">{t('Varsayılan')}</span>
                        ) : null}
                      </div>
                      <span className="yt-key-meta">
                        {key.hasKey ? key.hint ?? '••••' : t('YouTube API anahtarı yok')}
                        {' · '}
                        {t('{count} kanal', { count: key.channelCount })}
                      </span>
                      {key.lastError ? (
                        <span className="yt-key-error">
                          {translateMessage(language, key.lastError)}
                        </span>
                      ) : null}
                    </div>
                    <div className="yt-key-row-actions">
                      {!key.isDefault ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void makeDefaultYoutubeKey(key.id)}
                          disabled={Boolean(youtubeBusy)}
                        >
                          <Star size={13} /> {t('Varsayılan yap')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="icon-btn"
                        title={t('Test et')}
                        aria-label={t('Test et')}
                        onClick={() => void testSavedYoutubeKey(key.id)}
                        disabled={Boolean(youtubeTesting) || !key.hasKey}
                      >
                        <RefreshCw
                          size={13}
                          className={youtubeTesting === key.id ? 'spin' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={t('Anahtarı kaldır')}
                        aria-label={t('Anahtarı kaldır')}
                        onClick={() => void removeYoutubeKey(key)}
                        disabled={Boolean(youtubeBusy)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="yt-key-status warn">
              <KeyRound size={16} />
              <div>
                <strong>{t('YouTube API anahtarı eklenmedi')}</strong>
                <span>
                  {t(
                    'Kanal bağlamak, yeni yorumları ve abone artışını almak için bir YouTube Data API v3 anahtarı gerekir.',
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="yt-key-add">
            <div className="yt-key-input-row">
              <input
                className="input"
                value={youtubeLabel}
                onChange={(event) => setYoutubeLabel(event.target.value)}
                placeholder={t('Anahtar adı')}
                aria-label={t('Anahtar adı')}
                maxLength={60}
                disabled={Boolean(youtubeBusy)}
              />
              <div className="yt-key-input">
                <input
                  className="input"
                  type={showYoutubeKey ? 'text' : 'password'}
                  value={youtubeKey}
                  onChange={(event) => setYoutubeKey(event.target.value)}
                  placeholder="AIza…"
                  aria-label={t('YouTube API anahtarı')}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={Boolean(youtubeBusy)}
                />
                <button
                  type="button"
                  className="icon-btn yt-key-eye"
                  onClick={() => setShowYoutubeKey((value) => !value)}
                  aria-label={showYoutubeKey ? t('Şifreyi gizle') : t('Şifreyi göster')}
                >
                  {showYoutubeKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="yt-key-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void testNewYoutubeKey()}
                disabled={!youtubeKey.trim() || Boolean(youtubeTesting) || Boolean(youtubeBusy)}
              >
                <RefreshCw
                  size={14}
                  className={youtubeTesting === 'new' ? 'spin' : ''}
                />
                {youtubeTesting === 'new' ? t('Test ediliyor…') : t('Bağlantıyı test et')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveYoutubeKey()}
                disabled={!youtubeKey.trim() || Boolean(youtubeBusy)}
              >
                {youtubeBusy === 'add' ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  <KeyRound size={14} />
                )}
                {youtubeBusy === 'add' ? t('Kaydediliyor…') : t('Anahtarı kaydet')}
              </button>
            </div>
          </div>

          <details
            className="yt-key-guide"
            open={youtubeGuideOpen}
            onToggle={(event) => setYoutubeGuideOpen(event.currentTarget.open)}
          >
            <summary>{t('API anahtarı nasıl alınır? (bir kez)')}</summary>
            <ol>
              <li>
                <span>{t('Google Cloud Console’da YouTube Data API v3’ü etkinleştir.')}</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    void actions.openExternal(
                      'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
                    )
                  }
                >
                  {t('API kütüphanesini aç')} <ExternalLink size={11} />
                </button>
              </li>
              <li>
                <span>{t('Kimlik bilgileri → API anahtarı oluştur.')}</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    void actions.openExternal('https://console.cloud.google.com/apis/credentials')
                  }
                >
                  {t('Kimlik bilgilerini aç')} <ExternalLink size={11} />
                </button>
              </li>
              <li>
                <span>
                  {t(
                    'Anahtarı yalnızca YouTube Data API v3 ile sınırlandır; güvenlik için bu önerilir.',
                  )}
                </span>
              </li>
              <li>
                <span>{t('Anahtarı buraya yapıştır ve kaydet. Anahtar yalnızca Google API isteklerinde kullanılır; Orbita sunucusuna gönderilmez.')}</span>
              </li>
            </ol>
          </details>

          <p className="setting-note">
            {t(
              'Google varsayılan kotası günde 10.000 birimdir. YouTube tekil abone olayı sunmaz; abone artışı toplam sayı karşılaştırılarak, yeni yorumlar herkese açık yorum akışından algılanır. Kontroller yaklaşık 5–10 dakikada bir yapılır.',
            )}
          </p>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Güvenlik')}</h2>
              <p>{t('API anahtarları ve yerel veri.')}</p>
            </div>
            <span className="card-icon"><ShieldCheck size={17} /></span>
          </div>

          <div className={`security-badge ${meta?.secureStorage ? 'ok' : 'warn'}`}>
            <KeyRound size={16} />
            <div>
              <strong>
                {meta?.secureStorage
                  ? t('Windows DPAPI şifrelemesi aktif')
                  : t('Windows güvenli depolama kullanılamıyor')}
              </strong>
              <span>
                {meta?.secureStorage
                  ? t('Bot tokenları, panel anahtarları, Gmail uygulama şifreleri ve YouTube API anahtarı cihazına bağlı anahtarla şifrelenir. Dışa aktarılan yedeğe dahil edilmez.')
                  : t('API anahtarları kaydedilemez. Windows oturumunun kullanıcı profiline bağlı DPAPI hizmetini kontrol et.')}
              </span>
            </div>
          </div>

          <div className="path-box">
            <div>
              <span>{t('Yerel veri dosyası')}</span>
              <code>{meta?.dataPath ?? '—'}</code>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void revealData()}>
              <FolderOpen size={14} /> {t('Klasörü aç')}
            </button>
          </div>

          <p className="setting-note">
            {t('Tüm veriler bu bilgisayarda kalır. Uygulama bulut hesabı veya dış sunucu kullanmaz; yalnızca bağladığın API’lere doğrudan istek gönderir.')}
          </p>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Bildirimler')}</h2>
              <p>{t('Yerel masaüstü uyarıları.')}</p>
            </div>
            <span className="card-icon"><Bell size={17} /></span>
          </div>

          <div className="setting-row">
            <div className="setting-text">
              <strong>{t('Masaüstü bildirimleri')}</strong>
              <span>{t('Bir servis çalışmıyor durumuna geçtiğinde Windows bildirimi gönder.')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.settings.notifications}
              className={`switch ${data.settings.notifications ? 'on' : ''}`}
              onClick={() =>
                void update('notifications', { notifications: !data.settings.notifications })
              }
            >
              <span className="switch-knob" />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm notification-test"
            onClick={() => void sendTestNotification()}
            disabled={testingNotification}
          >
            <BellRing size={14} />
            {testingNotification ? t('Gönderiliyor…') : t('Test bildirimi gönder')}
          </button>

          <p className="setting-note">
            {t('Yalnızca uygulama açıkken, çalışan bir servis çalışmıyor durumuna geçtiğinde bildirim gönderilir; her kontrolde tekrarlanmaz.')}
          </p>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Yedekleme')}</h2>
              <p>{t('Komuta merkezinin taşınabilir kopyası.')}</p>
            </div>
            <span className="card-icon"><Download size={17} /></span>
          </div>
          <p className="setting-copy">
            {t('Şirketler, servis tanımları, görevler, notlar ve finans kayıtları JSON olarak dışa aktarılır. API anahtarları güvenlik gereği yedeğe eklenmez. Yedeği istediğin zaman bu bilgisayarda saklayabilirsin.')}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void exportBackup()} disabled={exporting}>
            <Download size={15} /> {exporting ? t('Hazırlanıyor…') : t('JSON yedeği al')}
          </button>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t('Uygulama')}</h2>
              <p>{t('Kurulu sürüm ve çalışma ortamı.')}</p>
            </div>
            <span className="card-icon"><Monitor size={17} /></span>
          </div>
          <div className="about-rows">
            <div><span>{t('Uygulama')}</span><strong>ORBITA</strong></div>
            <div><span>{t('Sürüm')}</span><strong>v{meta?.appVersion ?? '1.0.0'}</strong></div>
            <div><span>{t('Platform')}</span><strong>Windows · x64</strong></div>
            <div><span>{t('Veri saklama')}</span><strong>{t('Yerel, şifreli anahtarlar')}</strong></div>
          </div>
          <p className="setting-note">
            {t('Tek kişilik komuta merkezi. Şirket portföyün, servis sağlığı, finans, görevler ve notlar tek uygulamada.')}
          </p>
        </section>

        <section className="card settings-guides">
          <div className="card-header">
            <div>
              <h2>{t('Entegrasyon rehberi')}</h2>
              <p>{t('Anahtarları nereden alacağını adım adım gör.')}</p>
            </div>
          </div>
          <div className="guide-grid">
            <div className="guide-item">
              <span className="guide-icon"><Bot size={17} /></span>
              <div>
                <strong>{t('Discord Bot API')}</strong>
                <ol>
                  <li>{t('discord.com/developers/applications → New Application.')}</li>
                  <li>{t('Bot sekmesinde tokenı oluştur / sıfırla.')}</li>
                  <li>{t('Botu en az bir sunucuya davet et.')}</li>
                  <li>{t('Tokenı Servis bağla → Discord Bot ekranına gir.')}</li>
                </ol>
              </div>
            </div>
            <div className="guide-item">
              <span className="guide-icon"><Server size={17} /></span>
              <div>
                <strong>{t('Pterodactyl Client API')}</strong>
                <ol>
                  <li>{t('Paneline kendi hesabınla giriş yap.')}</li>
                  <li>{t('Account → API Credentials → Create API Key.')}</li>
                  <li>{t('pacc_ ile başlayan anahtarı kopyala.')}</li>
                  <li>{t('Panel adresiyle birlikte Servis bağla ekranına gir.')}</li>
                </ol>
              </div>
            </div>
            <div className="guide-item">
              <span className="guide-icon"><Globe2 size={17} /></span>
              <div>
                <strong>{t('Web Sitesi İzleme')}</strong>
                <ol>
                  <li>{t('Servis bağla → Web Sitesi seç.')}</li>
                  <li>{t('Kök adresi gir (https://…).')}</li>
                  <li>{t('Test et ile gerçek yanıtı doğrula.')}</li>
                  <li>{t('SSL ve yanıt süresi otomatik izlenir.')}</li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
