import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { IS_TRAY, IS_WEB } from '../lib/runtime';
import { useBotHints } from '../web/botSecrets';
import { checkBotsNow, clearBotSecret, saveBotSecret } from '../web/botBridge';
import { clearServiceStatuses, findAssetId } from '../web/browserApi';
import type { TranslationKey } from '../i18n/core';
import type { Asset, AssetType, TestResult } from '../types';

interface AssetModalProps {
  open: boolean;
  onClose: () => void;
  asset?: Asset | null;
  defaultCompanyId?: string | null;
}

const TYPE_OPTIONS: {
  type: AssetType;
  label: TranslationKey;
  description: TranslationKey;
  icon: typeof Bot;
}[] = [
  {
    type: 'discord',
    label: 'Discord Bot',
    description: 'Bot tokenı ile sunucu sayısı ve API sağlığı.',
    icon: Bot,
  },
  {
    type: 'pterodactyl',
    label: 'Pterodactyl',
    description: 'Client API anahtarı ile sunucu durumu ve kaynakları.',
    icon: Server,
  },
  {
    type: 'website',
    label: 'Web Sitesi',
    description: 'Token gerekmez; erişim, yanıt süresi ve SSL takibi.',
    icon: Globe2,
  },
];

export function AssetModal({ open, onClose, asset, defaultCompanyId }: AssetModalProps) {
  const { data, actions, toast } = useApp();
  const { t, language } = useI18n();
  const botHints = useBotHints();
  const [type, setType] = useState<AssetType>('discord');
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [tested, setTested] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initialType = asset?.type ?? 'discord';
    setType(initialType);
    setCompanyId(asset?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setName(asset?.name ?? '');
    setUrl(asset?.config.url ?? '');
    setBaseUrl(asset?.config.baseUrl ?? '');
    setSecret('');
    setShowSecret(false);
    setTested(null);
    setTesting(false);
    setBusy(false);
    setTouched(false);
    setTokenBusy(false);
    setTokenError('');
    window.setTimeout(() => nameRef.current?.focus(), 30);
  }, [open, asset, defaultCompanyId, data?.companies]);

  const trayDiscord = IS_TRAY && type === 'discord';
  const savedHint = asset ? botHints[asset.id] ?? null : null;
  const needsSecret = !IS_WEB && (type === 'discord' || type === 'pterodactyl');
  const canSave =
    name.trim().length > 0 &&
    Boolean(companyId) &&
    (type === 'website' ? url.trim().length > 0 : baseUrl.trim().length > 0 || type === 'discord') &&
    (!needsSecret || Boolean(asset) || secret.trim().length > 0);

  const buildConfig = () =>
    type === 'website' ? { url: url.trim() } : type === 'pterodactyl' ? { baseUrl: baseUrl.trim() } : {};

  const test = async () => {
    if (testing) return;
    setTesting(true);
    setTested(null);
    const result = await actions.testAsset({
      type,
      config: buildConfig(),
      secret: secret.trim() || undefined,
      assetId: asset?.id,
    });
    setTested(result);
    setTesting(false);
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    setTokenError('');
    const payload = {
      name: name.trim(),
      companyId,
      config: buildConfig(),
      secret: IS_WEB ? undefined : secret.trim() || undefined,
    };
    const success = asset
      ? await actions.updateAsset({ id: asset.id, ...payload })
      : await actions.createAsset({ ...payload, type });
    if (!success) {
      setBusy(false);
      return;
    }
    const token = trayDiscord ? secret.trim() : '';
    if (token) {
      let assetId = asset?.id ?? findAssetId(companyId, payload.name, type);
      if (!assetId) {
        setBusy(false);
        setTokenError(t('Servis kaydedildi ancak kimliği bulunamadı.'));
        return;
      }
      setTokenBusy(true);
      const saved = await saveBotSecret(assetId, token);
      setTokenBusy(false);
      if (!saved.ok) {
        setBusy(false);
        setTokenError(
          saved.error === 'Bot tokenı geçersiz görünüyor.'
            ? t('Bot tokenı geçersiz görünüyor.')
            : t('Anahtar kaydedilemedi.'),
        );
        return;
      }
      setSecret('');
      clearServiceStatuses([assetId]);
      checkBotsNow([{ id: assetId, name: payload.name }]);
      toast('success', t('Bot tokenı kaydedildi; durum kontrol ediliyor.'));
    }
    setBusy(false);
    onClose();
  };

  const removeToken = async () => {
    if (!asset || tokenBusy) return;
    setTokenBusy(true);
    setTokenError('');
    const result = await clearBotSecret(asset.id);
    setTokenBusy(false);
    if (!result.ok) {
      setTokenError(t('Anahtar kaldırılamadı.'));
      return;
    }
    clearServiceStatuses([asset.id]);
    checkBotsNow([{ id: asset.id, name: asset.name }]);
    setSecret('');
    toast('success', t('Bot bağlantısı kaldırıldı.'));
  };

  return (
    <Modal
      open={open}
      title={asset ? t('Servisi düzenle') : t('Servis bağla')}
      subtitle={
        IS_TRAY
          ? trayDiscord
            ? t('Bot tokenı bu cihazda güvenle saklanır; durum Discord API’sinden doğrulanır.')
            : t('Site ve bot durumları arka planda düzenli olarak kontrol edilir.')
          : IS_WEB
            ? asset
              ? t('Servis bilgilerini güncelle.')
              : t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
            : asset
              ? t('Bağlantı bilgilerini güncelle. Anahtarı boş bırakırsan mevcut anahtar korunur.')
              : t('Gerçek API bağlantısı kur; EZWIN HUB verileri doğrudan kaynaktan çeker.')
      }
      onClose={onClose}
      size="md"
      icon={asset ? <Server size={17} /> : <Bot size={17} />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('Vazgeç')}
          </button>
          <button type="submit" form="asset-form" className="btn btn-primary" disabled={busy}>
            {busy ? t('Kaydediliyor…') : asset ? t('Değişiklikleri kaydet') : t('Servisi bağla')}
          </button>
        </>
      }
    >
      <form
        id="asset-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {!asset ? (
          <div className="type-grid">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.type}
                  className={`type-card ${type === option.type ? 'active' : ''}`}
                  onClick={() => {
                    setType(option.type);
                    setSecret('');
                    setTested(null);
                  }}
                >
                  <span className="type-card-icon">
                    <Icon size={17} />
                  </span>
                  <span className="type-card-label">{t(option.label)}</span>
                  <span className="type-card-desc">
                    {IS_TRAY
                      ? option.type === 'pterodactyl'
                        ? t('Panel envanteri; canlı kontrol bu sürümde yok.')
                        : t(option.description)
                      : IS_WEB
                        ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
                        : t(option.description)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="type-static">
            {(() => {
              const option = TYPE_OPTIONS.find((item) => item.type === type);
              const Icon = option?.icon ?? Server;
              return (
                <>
                  <Icon size={15} />
                  {option ? t(option.label) : null}
                </>
              );
            })()}
          </div>
        )}

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {data?.companies.length === 0 ? <option value="">{t('Önce şirket ekle')}</option> : null}
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">{t('Servis adı')}</span>
            <input
              ref={nameRef}
              className={`input ${touched && !name.trim() ? 'input-error' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                type === 'discord'
                  ? t('Örn. Ana bot')
                  : type === 'pterodactyl'
                    ? t('Örn. Oyun paneli')
                    : t('Örn. Kurumsal site')
              }
              maxLength={60}
            />
            {touched && !name.trim() ? <span className="form-error">{t('Servis adı gerekli.')}</span> : null}
          </label>
        </div>

        {type === 'website' ? (
          <label className="form-field">
            <span className="form-label">{t('Site adresi')}</span>
            <input
              className="input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://animax.com"
              spellCheck={false}
            />
            <span className="form-hint">
              {IS_TRAY || !IS_WEB
                ? t('Her {seconds} saniyede erişim, yanıt süresi ve SSL bitişi kontrol edilir.', {
                    seconds: data?.settings.pollIntervalSec ?? 60,
                  })
                : t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')}
            </span>
          </label>
        ) : null}

        {type === 'pterodactyl' ? (
          <label className="form-field">
            <span className="form-label">{t('Panel adresi')}</span>
            <input
              className="input"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://panel.ornek.com"
              spellCheck={false}
            />
            <span className="form-hint">
              {IS_TRAY
                ? t('Panel envanteri bu sürümde saklanır; canlı panel kontrolü henüz yok.')
                : IS_WEB
                  ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
                  : t('Panelin kurulu olduğu kök adres. Sonuna /api eklemene gerek yok.')}
            </span>
          </label>
        ) : null}

        {needsSecret ? (
          <label className="form-field">
            <span className="form-label">
              {type === 'discord' ? t('Bot tokenı') : t('Client API anahtarı')}
            </span>
            <div className="input-group">
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={
                  asset?.secretHint
                    ? t('Kayıtlı: {hint} — değiştirmek için yaz', { hint: asset.secretHint })
                    : type === 'discord'
                      ? t('Discord bot tokenı')
                      : t('pacc_ ile başlayan client anahtarı')
                }
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowSecret((prev) => !prev)}
                aria-label={showSecret ? t('Anahtarı gizle') : t('Anahtarı göster')}
              >
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <span className="form-hint">
              {type === 'discord'
                ? t('Discord Developer Portal → Bot → Token. Token yalnızca bu cihazda, Windows DPAPI ile şifrelenmiş saklanır.')
                : t('Pterodactyl → Account → API Credentials → Client anahtarı (pacc_). Application anahtarı desteklenmez.')}
            </span>
          </label>
        ) : null}

        {trayDiscord ? (
          <div className="form-field">
            <span className="form-label">
              {t('Bot tokenı')}
              {savedHint ? (
                <span className="form-hint"> {t('Kayıtlı: {hint}', { hint: savedHint })}</span>
              ) : null}
            </span>
            <div className="input-group">
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setTokenError('');
                }}
                placeholder={
                  savedHint
                    ? t('Değiştirmek için yeni token yaz')
                    : t('Discord bot tokenı')
                }
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowSecret((prev) => !prev)}
                aria-label={showSecret ? t('Anahtarı gizle') : t('Anahtarı göster')}
              >
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              {asset && savedHint ? (
                <button
                  type="button"
                  className="input-action"
                  onClick={() => void removeToken()}
                  disabled={tokenBusy}
                  aria-label={t('Bağlantıyı kaldır')}
                  title={t('Bağlantıyı kaldır')}
                >
                  {tokenBusy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                </button>
              ) : null}
            </div>
            <span className="form-hint">
              <ShieldCheck size={13} />{' '}
              {t('Token yalnızca bu cihazda, Windows DPAPI ile şifrelenmiş saklanır; hiçbir sunucuya gönderilmez.')}
            </span>
            {tokenError ? <span className="form-error">{tokenError}</span> : null}
          </div>
        ) : null}

        {!IS_WEB ? (
          <>
            <div className="test-panel">
              <div>
                <strong>{t('Bağlantıyı doğrula')}</strong>
                <span>{t('Kaydetmeden önce gerçek API yanıtını kontrol et.')}</span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void test()} disabled={testing}>
                {testing ? <Loader2 size={14} className="spin" /> : null}
                {testing ? t('Test ediliyor…') : t('Test et')}
              </button>
            </div>

            {tested ? (
              <div className={`test-result ${tested.ok ? 'success' : 'error'}`}>
                {tested.ok ? <CircleCheck size={16} /> : <CircleX size={16} />}
                <span>{translateMessage(language, tested.message)}</span>
              </div>
            ) : null}
          </>
        ) : IS_TRAY ? (
          <p className="setting-note web-form-note">
            {trayDiscord
              ? savedHint || secret.trim()
                ? t('Token kaydedildikten sonra bot durumu arka planda kontrol edilir.')
                : t('Bot bağlantısı için token ekle; durum arka planda kontrol edilir.')
              : type === 'website'
                ? t('Site adresi arka planda düzenli olarak kontrol edilir.')
                : t('Panel envanteri bu sürümde saklanır; canlı panel kontrolü henüz yok.')}
          </p>
        ) : (
          <p className="setting-note web-form-note">
            {t('Canlı izleme tarayıcı sürümünde kapalı.')}
          </p>
        )}
      </form>
    </Modal>
  );
}
