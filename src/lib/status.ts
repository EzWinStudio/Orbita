import type { Asset, CompanyHealthState, ServiceState, ServiceStatus } from '../types';
import type { TFunction, TranslationKey } from '../i18n/core';
import { STATE_LABEL } from '../constants';
import { IS_TRAY, IS_WEB } from './runtime';
import { liveMonitoringLabel } from './liveMonitoring';

const EXACT_MESSAGES: Record<string, TranslationKey> = {
  'Bağlantı reddedildi': 'Bağlantı reddedildi',
  'SSL sertifika hatası': 'SSL sertifika hatası',
  'Discord API erişilemedi': 'Discord API erişilemedi',
  'Token geçersiz': 'Token geçersiz',
  'Discord rate limit': 'Discord rate limit',
  'Bot doğrulandı, yanıt okunamadı': 'Bot doğrulandı, yanıt okunamadı',
  'Bot doğrulandı, sunucu listesi alınamadı': 'Bot doğrulandı, sunucu listesi alınamadı',
  'Kontrol edilemedi': 'Kontrol edilemedi',
  'Kayıtlı bot tokenı çözülemedi. Yeniden bağla.': 'Kayıtlı bot tokenı çözülemedi. Yeniden bağla.',
  'Bot tokenı geçerli ama sunucu listesi çekilemedi.':
    'Bot tokenı geçerli ama sunucu listesi çekilemedi.',
  'Discord yanıtı ayrıştırılamadı.': 'Discord yanıtı ayrıştırılamadı.',
  'Discord tokenı reddedildi (401). Bot tokenını yenile.':
    'Discord tokenı reddedildi (401). Bot tokenını yenile.',
  'Discord API rate limit uyguladı, sonraki kontrolde tekrar denenecek.':
    'Discord API rate limit uyguladı, sonraki kontrolde tekrar denenecek.',
  'Yanlış anahtar türü': 'Yanlış anahtar türü',
  'Panel anahtarı geçersiz': 'Panel anahtarı geçersiz',
  'Panele ulaşılamadı': 'Panele ulaşılamadı',
  'Anahtar çözülemedi': 'Anahtar çözülemedi',
  'Bilinmeyen servis türü': 'Bilinmeyen servis türü',
  'API anahtarı reddedildi (401). Client API anahtarını kontrol et.':
    'API anahtarı reddedildi (401). Client API anahtarını kontrol et.',
  'API anahtarının bu panele erişim yetkisi yok (403).':
    'API anahtarının bu panele erişim yetkisi yok (403).',
  'Panel API adresi bulunamadı (404). Panel URL’sini kontrol et.':
    'Panel API adresi bulunamadı (404). Panel URL’sini kontrol et.',
};

export function localizeStatusText(text: string | null, t: TFunction): string | null {
  if (!text) return null;

  const timeout = text.match(/^Zaman aşımı \((\d+) sn\)$/);
  if (timeout) return t('Zaman aşımı: {seconds} sn', { seconds: timeout[1] });

  const discordError = text.match(/^Discord API hatası \((\d+)\)$/);
  if (discordError) return t('Discord API hatası ({status})', { status: discordError[1] });

  const discordHttp = text.match(/^Discord API HTTP (\d+) döndü\.$/);
  if (discordHttp) return t('Discord API HTTP {status} döndü.', { status: discordHttp[1] });

  const panelError = text.match(/^Panel API hatası \(HTTP (\d+)\)\.$/);
  if (panelError) return t('Panel API hatası ({status})', { status: panelError[1] });

  const sslDays = text.match(/^SSL sertifikası (\d+) gün içinde doluyor$/);
  if (sslDays) return t('SSL sertifikası {days} gün içinde doluyor', { days: sslDays[1] });
  if (text === 'SSL sertifikası süresi dolmuş') return t('SSL sertifikası süresi dolmuş');

  const mapped = EXACT_MESSAGES[text];
  if (mapped) return t(mapped);

  if (text.startsWith('Bağlantı hatası: ')) {
    return t('Bağlantı hatası: {detail}', { detail: text.slice('Bağlantı hatası: '.length) });
  }

  return text;
}

export function serviceStateLabel(
  asset: Asset,
  state: ServiceState,
  hasSecret = asset.hasSecret,
): TranslationKey {
  if (asset.type === 'discord') {
    if (IS_WEB) {
      if (!IS_TRAY) return 'Masaüstü gerekli';
      if (!hasSecret) return 'Bağlantı gerekli';
      if (state === 'online') return 'Aktif';
      if (state === 'offline') return 'Kapalı';
      if (state === 'degraded') return 'Kısmen aktif';
      return 'Kontrol ediliyor';
    }
    if (state === 'online') return 'API doğrulandı';
  }
  return STATE_LABEL[state];
}

export interface CompanyHealthInfo {
  state: CompanyHealthState;
  online: number;
  monitored: number;
}

export function companyHealth(
  assets: Asset[],
  statuses: Record<string, ServiceStatus>,
): CompanyHealthInfo {
  const monitored = assets.filter(
    (asset) => asset.type === 'website' || asset.hasSecret || Boolean(statuses[asset.id]),
  );
  if (monitored.length === 0) return { state: 'none', online: 0, monitored: 0 };

  let online = 0;
  let offline = 0;
  let degraded = 0;
  let operationalOnline = 0;

  for (const asset of monitored) {
    const state = statuses[asset.id]?.state;
    if (state === 'online') {
      online += 1;
      if (asset.type !== 'discord') operationalOnline += 1;
    } else if (state === 'offline') {
      offline += 1;
    } else if (state === 'degraded') {
      degraded += 1;
    }
  }

  if (offline > 0) {
    return { state: online > 0 || degraded > 0 ? 'partial' : 'broken', online, monitored: monitored.length };
  }
  if (degraded > 0) {
    return { state: 'partial', online, monitored: monitored.length };
  }
  if (online === monitored.length) {
    return { state: operationalOnline > 0 ? 'working' : 'partial', online, monitored: monitored.length };
  }
  return { state: online > 0 ? 'partial' : 'unchecked', online, monitored: monitored.length };
}

export function serviceSummary(
  asset: Asset,
  status: ServiceStatus | undefined,
  t: TFunction,
  hasSecret = asset.hasSecret,
): string {
  if (IS_TRAY) {
    if (!status) {
      if (asset.type === 'website') return t('İlk kontrol bekleniyor');
      if (asset.type === 'discord') {
        return hasSecret ? t('İlk kontrol bekleniyor') : t('Bot bağlantısı bekliyor');
      }
      return t('Yerel envanter');
    }
    if (status.website?.statusCode) {
      return `HTTP ${status.website.statusCode} · ${status.latencyMs ?? '—'} ms`;
    }
    if (status.error) return localizeStatusText(status.error, t) ?? status.summary;
    if (status.discord) {
      const guilds = status.discord.guildCount ?? status.discord.guilds.length;
      return `${status.discord.username} · ${t('Sunucu: {count}', { count: guilds })}`;
    }
    return localizeStatusText(status.summary, t) ?? status.summary;
  }

  if (IS_WEB) {
    return asset.type === 'discord'
      ? t('Bot durumu masaüstü uygulamasında kontrol edilir.')
      : liveMonitoringLabel(t);
  }

  if (!status) {
    return asset.type !== 'website' && !asset.hasSecret
      ? t('API anahtarı bekliyor')
      : t('İlk kontrol bekleniyor');
  }

  if (status.discord) {
    const guilds = status.discord.guildCount ?? status.discord.guilds.length;
    return `${status.discord.username} · ${t('Sunucu: {count}', { count: guilds })}`;
  }

  if (status.pterodactyl) {
    const running = status.pterodactyl.servers.filter((server) => server.state === 'running').length;
    return t('Çalışan: {running} / Toplam: {total}', {
      running,
      total: status.pterodactyl.total,
    });
  }

  if (status.website?.statusCode) {
    return `HTTP ${status.website.statusCode} · ${status.latencyMs ?? '—'} ms`;
  }

  if (status.error) return localizeStatusText(status.error, t) ?? status.summary;

  return localizeStatusText(status.summary, t) ?? status.summary;
}
