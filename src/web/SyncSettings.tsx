import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Copy,
  Eye,
  EyeOff,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/core';
import {
  connectSync,
  createSync,
  disconnectSync,
  getSyncCode,
  getSyncStatus,
  startSyncAgent,
  subscribeSyncStatus,
  syncNow,
  type SyncStatus,
} from './cloudSync';

const ERROR_KEYS: Record<string, TranslationKey> = {
  sync_unavailable: 'Eşitleme servisine ulaşılamadı.',
  sync_timeout: 'Eşitleme servisine ulaşılamadı.',
  sync_unsupported: 'Eşitleme servisine ulaşılamadı.',
  sync_payload_invalid: 'Eşitleme verisi bozuk.',
  sync_empty: 'Bu koda ait veri bulunamadı.',
  sync_code_invalid: 'Eşitleme kodu geçersiz.',
  sync_conflict: 'Eşitleme çakışması oluştu.',
};

function resultMessage(action: string | undefined): TranslationKey {
  if (action === 'conflict') return 'Çakışma: en yeni veriler alındı.';
  return 'Eşitleme tamamlandı.';
}

export function SyncSettings() {
  const data = useAppData();
  const { toast, confirm } = useApp();
  const { t, language } = useI18n();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startSyncAgent();
    return subscribeSyncStatus(() => setStatus(getSyncStatus()));
  }, []);

  const code = status.code ?? getSyncCode();
  const hasLocalData =
    data.companies.length > 0 ||
    data.assets.length > 0 ||
    data.tasks.length > 0 ||
    data.notes.length > 0 ||
    data.finance.length > 0 ||
    data.mailAccounts.length > 0 ||
    data.youtubeChannels.length > 0;

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast('success', t('Kopyalandı.'));
    } catch {
      toast('error', t('Kopyalanamadı.'));
    }
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    const result = await createSync();
    setBusy(false);
    if (result.code) setReveal(true);
    if (result.ok) toast('success', t('Eşitleme tamamlandı.'));
    else toast('error', t(ERROR_KEYS[result.error ?? ''] ?? 'Eşitleme servisine ulaşılamadı.'));
  };

  const connect = async () => {
    if (busy) return;
    if (!input.trim()) {
      toast('error', t('Eşitleme kodu geçersiz.'));
      return;
    }
    if (hasLocalData) {
      const ok = await confirm({
        title: t('Koda bağlan'),
        message: t('Bu cihazdaki veriler koddaki verilerle değiştirilecek. Devam edilsin mi?'),
        confirmLabel: t('Koda bağlan'),
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    const result = await connectSync(input);
    setBusy(false);
    if (result.ok) {
      toast('success', t('Eşitleme tamamlandı.'));
      setInput('');
    } else {
      toast('error', t(ERROR_KEYS[result.error ?? ''] ?? 'Eşitleme servisine ulaşılamadı.'));
    }
  };

  const runNow = async (mode: 'auto' | 'pull' = 'auto') => {
    if (busy) return;
    if (mode === 'pull') {
      const ok = await confirm({
        title: t('Koddaki verileri al'),
        message: t('Bu cihazdaki veriler koddaki verilerle değiştirilecek. Devam edilsin mi?'),
        confirmLabel: t('Koddaki verileri al'),
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    const result = await syncNow(mode);
    setBusy(false);
    if (result.ok) toast('success', t(resultMessage(result.action)));
    else toast('error', t(ERROR_KEYS[result.error ?? ''] ?? 'Eşitleme servisine ulaşılamadı.'));
  };

  const stop = () => {
    disconnectSync();
    setReveal(false);
  };

  const errorKey = status.error ? ERROR_KEYS[status.error] : null;
  const statusLabel: TranslationKey =
    status.phase === 'disabled'
      ? 'Eşitleme kapalı'
      : status.phase === 'syncing'
        ? 'Eşitleniyor…'
        : status.phase === 'error'
          ? errorKey ?? 'Eşitleme servisine ulaşılamadı.'
          : status.pending
            ? 'Bekleyen değişiklik var.'
            : 'Bağlı';
  const timeLabel =
    status.lastSyncedAt > 0
      ? new Date(status.lastSyncedAt).toLocaleTimeString(language, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return (
    <section className="card sync-card">
      <div className="card-header">
        <div>
          <h2>
            <Cloud size={17} /> {t('Cihaz eşitleme')}
          </h2>
          <p>{t('Web, masaüstü ve telefon aynı verileri kullansın.')}</p>
        </div>
        <span className={`sync-state sync-state-${status.phase}`}>
          <span className="sync-state-dot" />
          {t(statusLabel)}
        </span>
      </div>

      {status.enabled && code ? (
        <>
          <div className="sync-code-row">
            <span className="sync-code-label">{t('Eşitleme kodu')}</span>
            <code className="sync-code" dir="ltr">
              {reveal ? code : 'ORBITA-•••••-•••••-•••••-•••••-••••••'}
            </code>
            <button
              type="button"
              className="icon-button"
              onClick={() => setReveal((prev) => !prev)}
              title={t(reveal ? 'Gizle' : 'Göster')}
              aria-label={t(reveal ? 'Gizle' : 'Göster')}
            >
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => void copyCode()}
              title={t('Kopyala')}
              aria-label={t('Kopyala')}
            >
              <Copy size={15} />
            </button>
          </div>
          <div className="sync-meta">
            {timeLabel ? (
              <span>{t('Son eşitleme: {time}', { time: timeLabel })}</span>
            ) : null}
          </div>
          <div className="sync-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void runNow('auto')} disabled={busy}>
              <RefreshCw size={14} className={status.phase === 'syncing' ? 'spin' : ''} />
              {t('Şimdi eşitle')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void runNow('pull')} disabled={busy}>
              <CloudOff size={14} /> {t('Koddaki verileri al')}
            </button>
            <button type="button" className="btn btn-ghost sync-stop" onClick={stop} disabled={busy}>
              <Unplug size={14} /> {t('Eşitlemeyi kapat')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sync-start">
            <button type="button" className="btn btn-primary" onClick={() => void start()} disabled={busy}>
              <Cloud size={15} /> {t('Eşitleme oluştur')}
            </button>
            <div className="sync-connect">
              <Link2 size={15} />
              <input
                type="text"
                className="sync-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t('Eşitleme kodu')}
                aria-label={t('Eşitleme kodu')}
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
              />
              <button type="button" className="btn btn-secondary" onClick={() => void connect()} disabled={busy}>
                {t('Koda bağlan')}
              </button>
            </div>
          </div>
          <p className="sync-hint">{t('Kodu diğer cihazlarda gir.')}</p>
        </>
      )}

      <div className="sync-note">
        <ShieldCheck size={15} />
        <span>
          {t(
            'Sunucu yalnızca AES-GCM ile şifrelenmiş paketi saklar; kodu paylaşan herkes verilere erişebilir. Kod kaybolursa verilere erişilemez.',
          )}
        </span>
      </div>
    </section>
  );
}
