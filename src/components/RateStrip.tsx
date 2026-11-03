import { RefreshCw } from 'lucide-react';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { crossRate, formatRate, rateDateLabel } from '../lib/rates';
import { relativeTime } from '../lib/format';

export function RateStrip() {
  const { rates, ratesLoading, ratesError, refreshRates } = useApp();
  const { t, language } = useI18n();

  return (
    <div className={`rate-strip ${rates?.stale ? 'is-stale' : ''}`} title={ratesError ?? undefined}>
      <span className="rate-strip-title">
        <span className={`live-dot ${rates?.stale ? 'is-stale' : ''}`} />
        {t('Kur')}
      </span>

      {rates ? (
        <>
          <span className="rate-pair">
            <span>USD/TRY</span>
            <strong>{formatRate(crossRate(rates, 'USD', 'TRY'))}</strong>
          </span>
          <span className="rate-pair">
            <span>EUR/TRY</span>
            <strong>{formatRate(crossRate(rates, 'EUR', 'TRY'))}</strong>
          </span>
          <span className="rate-pair">
            <span>EUR/USD</span>
            <strong>{formatRate(crossRate(rates, 'EUR', 'USD'))}</strong>
          </span>
          <span className="rate-strip-meta">
            {rates.stale ? t('Önbellek') : t('ECB referans')}
            {rateDateLabel(rates) ? ` · ${rateDateLabel(rates)}` : ` · ${relativeTime(rates.fetchedAt)}`}
          </span>
        </>
      ) : (
        <span className={`rate-strip-empty ${ratesError ? 'is-error' : ''}`}>
          {ratesLoading ? t('Kur yükleniyor…') : ratesError ? translateMessage(language, ratesError) : t('Kur bekleniyor.')}
        </span>
      )}

      <button
        type="button"
        className="rate-strip-refresh"
        onClick={() => void refreshRates(true)}
        disabled={ratesLoading}
        aria-label={t('Kurları yenile')}
        title={t('Kurları yenile')}
      >
        <RefreshCw size={13} className={ratesLoading ? 'spin' : undefined} />
      </button>
    </div>
  );
}
