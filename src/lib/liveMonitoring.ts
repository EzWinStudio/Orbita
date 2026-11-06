import type { TFunction } from '../i18n/core';
import { IS_ANDROID_APP } from './native';

export function liveMonitoringLabel(t: TFunction): string {
  return IS_ANDROID_APP
    ? t('Canlı izleme mobil uygulamada kapalı.')
    : t('Canlı izleme tarayıcı sürümünde kapalı.');
}

export function liveMonitoringNote(t: TFunction): string {
  return IS_ANDROID_APP
    ? t(
        'Mobil uygulama; Discord, Pterodactyl veya site durumlarını güvenli şekilde kontrol edemez. Sahte durum göstermiyoruz; servisler envanter ve hızlı bağlantı olarak kalır.',
      )
    : t(
        'Tarayıcı; Discord, Pterodactyl veya site durumlarını güvenli şekilde kontrol edemez. Sahte durum göstermiyoruz; servisler envanter ve hızlı bağlantı olarak kalır.',
      );
}
