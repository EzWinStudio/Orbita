import { useEffect, useState } from 'react';
import { Download, Sparkles, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { getUpdateState, installUpdate, startUpdateAgent, subscribeUpdate } from './updater';

export function UpdateBanner() {
  const { t } = useI18n();
  const [state, setState] = useState(getUpdateState);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    startUpdateAgent();
    return subscribeUpdate(() => setState(getUpdateState()));
  }, []);

  const ready =
    state.supported &&
    state.available &&
    (state.platform === 'android' || state.downloaded) &&
    !state.downloading;
  if (!ready || dismissed) return null;

  const install = async () => {
    if (installing) return;
    setInstalling(true);
    await installUpdate();
    setInstalling(false);
  };

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-icon">
        <Sparkles size={16} />
      </span>
      <div className="update-banner-text">
        <strong>{t('Yeni sürüm hazır')}</strong>
        <span dir="ltr">v{state.latest}</span>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void install()}
        disabled={installing}
      >
        <Download size={14} />
        {state.platform === 'desktop' ? t('Yeniden başlat ve kur') : t('Şimdi kur')}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => setDismissed(true)}
        aria-label={t('Kapat')}
        title={t('Kapat')}
      >
        <X size={15} />
      </button>
    </div>
  );
}
