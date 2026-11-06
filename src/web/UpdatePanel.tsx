import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/core';
import {
  checkForUpdate,
  getUpdateState,
  installUpdate,
  openInstallPermission,
  startUpdateAgent,
  subscribeUpdate,
} from './updater';

const ERROR_KEYS: Record<string, TranslationKey> = {
  check_failed: 'Güncelleme denetlenemedi.',
  release_unavailable: 'Güncelleme denetlenemedi.',
  release_invalid: 'Güncelleme denetlenemedi.',
  release_assets_missing: 'Güncelleme paketi bulunamadı.',
  checksum_unavailable: 'Güncelleme doğrulanamadı.',
  checksum_mismatch: 'Güncelleme doğrulanamadı.',
  download_failed: 'Güncelleme indirilemedi.',
  install_failed: 'Güncelleme kurulamadı.',
  permission_required: 'Bilinmeyen kaynak izni gerekiyor.',
  not_ready: 'Güncelleme henüz hazır değil.',
  unsupported: 'Güncelleme bu sürümde kullanılamıyor.',
};

function errorKey(code: string | null): TranslationKey | null {
  if (!code) return null;
  if (code.startsWith('download_failed')) return 'Güncelleme indirilemedi.';
  return ERROR_KEYS[code] ?? null;
}

export function UpdatePanel() {
  const { t, language } = useI18n();
  const [state, setState] = useState(getUpdateState);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    startUpdateAgent();
    return subscribeUpdate(() => setState(getUpdateState()));
  }, []);

  if (!state.supported) return null;

  const translatedError = errorKey(state.error);
  const timeLabel = state.checkedAt
    ? new Date(state.checkedAt).toLocaleTimeString(language, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const progress = state.progress ?? 0;
  const canInstall =
    !installing &&
    !state.checking &&
    !state.downloading &&
    (state.downloaded || state.available);
  const showInstall =
    !state.downloading &&
    (state.platform === 'desktop' ? state.downloaded : state.available || state.downloaded);

  const runCheck = () => {
    void checkForUpdate(true);
  };

  const runInstall = async () => {
    if (!canInstall) return;
    setInstalling(true);
    await installUpdate();
    setInstalling(false);
  };

  return (
    <section className="card settings-wide update-card">
      <div className="card-header">
        <div>
          <h2>
            <RotateCw size={17} /> {t('Otomatik güncelleme')}
          </h2>
          <p>{t('Yeni sürümleri GitHub üzerinden denetle, indir ve kur.')}</p>
        </div>
        <span className={`web-platform-badge update-badge-${state.platform ?? 'web'}`}>
          {state.platform === 'desktop' ? t('Masaüstü') : 'Android'}
        </span>
      </div>

      <div className="update-version-row">
        <div>
          <span className="update-label">{t('Sürüm')}</span>
          <strong dir="ltr">v{state.currentVersion || '—'}</strong>
        </div>
        <div className="update-status">
          {state.error ? (
            <span className="update-state error">
              <AlertTriangle size={14} />
              {translatedError ? t(translatedError) : state.error}
            </span>
          ) : state.downloading ? (
            <span className="update-state">
              <Download size={14} />
              {t('İndiriliyor… %{percent}', { percent: progress })}
            </span>
          ) : state.checking ? (
            <span className="update-state">
              <RefreshCw size={14} className="spin" />
              {t('Denetleniyor…')}
            </span>
          ) : state.available ? (
            <span className="update-state ready">
              <Download size={14} />
              {t('Yeni sürüm hazır: v{version}', { version: state.latest ?? '' })}
            </span>
          ) : state.checkedAt ? (
            <span className="update-state ok">
              <CheckCircle2 size={14} />
              {t('En güncel sürümü kullanıyorsun.')}
            </span>
          ) : (
            <span className="update-state muted">{t('Yeni sürümleri GitHub üzerinden denetle, indir ve kur.')}</span>
          )}
        </div>
      </div>

      {state.downloading ? (
        <div className="update-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.max(2, progress)}%` }} />
        </div>
      ) : null}

      {state.downloaded && state.platform === 'desktop' ? (
        <p className="update-note">
          {t('Güncelleme indirildi ve doğrulandı. Yeniden başlatınca kurulur.')}
        </p>
      ) : null}

      {state.platform === 'android' ? (
        <p className="update-note">
          {t('Telefon, yeni sürümü kurmadan önce bilinmeyen kaynak izni isteyebilir.')}
        </p>
      ) : null}

      {state.available && state.notes.length > 0 ? (
        <ul className="update-notes">
          {state.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="update-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={runCheck}
          disabled={state.checking || state.downloading || installing}
        >
          <RefreshCw size={14} className={state.checking ? 'spin' : ''} />
          {state.checking ? t('Denetleniyor…') : t('Şimdi denetle')}
        </button>
        {state.error === 'permission_required' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void openInstallPermission()}
          >
            <ShieldAlert size={14} />
            {t('Kurulum iznini aç')}
          </button>
        ) : showInstall ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void runInstall()}
            disabled={!canInstall}
          >
            <Download size={14} />
            {state.platform === 'desktop'
              ? t('Yeniden başlat ve kur')
              : t('Güncellemeyi indir ve kur')}
          </button>
        ) : null}
        {timeLabel ? (
          <span className="update-checked">{t('Son denetim: {time}', { time: timeLabel })}</span>
        ) : null}
      </div>
    </section>
  );
}
