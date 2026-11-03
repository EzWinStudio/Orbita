import { MonitorSmartphone } from 'lucide-react';
import { useI18n } from '../i18n';
import { IS_TRAY } from '../lib/runtime';

export function WebNotice() {
  const { t } = useI18n();
  return (
    <section className="web-notice">
      <span className="web-notice-icon" aria-hidden="true">
        <MonitorSmartphone size={17} />
      </span>
      <div className="web-notice-text">
        <strong>
          {IS_TRAY
            ? t('Site ve bot sağlığı arka planda izlenir.')
            : t('Canlı izleme tarayıcı sürümünde kapalı.')}
        </strong>
        <p>
          {IS_TRAY
            ? t(
                'Site erişimi ve Discord bot API’si arka planda kontrol edilir; Pterodactyl ve Gmail canlı izlenmez.',
              )
            : t(
                'Tarayıcı; Discord, Pterodactyl veya site durumlarını güvenli şekilde kontrol edemez. Sahte durum göstermiyoruz; servisler envanter ve hızlı bağlantı olarak kalır.',
              )}
        </p>
      </div>
    </section>
  );
}
