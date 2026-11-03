import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Eye,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import type { Connection, ConnectionPlatform, PlatformInfo } from '../types';

const STATUS_TEXT: Record<string, string> = {
  active: 'Bağlı',
  unverified: 'Doğrulanmadı',
  needs_attention: 'İlgi gerekli',
};

interface FormState {
  label: string;
  token: string;
  refreshToken: string;
}

const EMPTY_FORM: FormState = { label: '', token: '', refreshToken: '' };

function numericMeta(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compactCount(value: number): string {
  return new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** YouTube Data API yanıtındaki gerçek abone/video/görüntüleme sayıları. */
function ConnectionStats({ connection }: { connection: Connection }) {
  if (connection.platform !== 'youtube' || connection.status !== 'active') return null;
  const subscribers = numericMeta(connection.meta?.subscribers);
  const videos = numericMeta(connection.meta?.videos);
  const views = numericMeta(connection.meta?.views);
  if (subscribers === null && videos === null && views === null) return null;
  const updatedAt = numericMeta(connection.meta?.statsUpdatedAt);
  const hidden = numericMeta(connection.meta?.hiddenSubscribers) === 1;

  return (
    <div className="connection-stats">
      <span title="Abone sayısı">
        <Users size={12} /> {hidden || subscribers === null ? 'Gizli' : compactCount(subscribers)} abone
      </span>
      <span title="Video sayısı">
        <Video size={12} /> {videos === null ? '—' : compactCount(videos)} video
      </span>
      <span title="Toplam görüntüleme">
        <Eye size={12} /> {views === null ? '—' : compactCount(views)} görüntüleme
      </span>
      {updatedAt ? (
        <small>
          {new Date(updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </small>
      ) : null}
    </div>
  );
}

export function Connections() {
  const { data, actions, confirm } = useApp();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [openForm, setOpenForm] = useState<ConnectionPlatform | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await window.ezwin?.connections.platforms();
        if (active && list) setPlatforms(list);
      } catch {
        /* platform listesi alınamazsa kartlar boş kalır */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;
  const connections = data.connections;

  async function addAccount(event: FormEvent<HTMLFormElement>, platform: ConnectionPlatform) {
    event.preventDefault();
    if (busy) return;
    setBusy(`add:${platform}`);
    const ok = await actions.addConnection({
      platform,
      token: form.token.trim(),
      refreshToken: form.refreshToken.trim() || undefined,
      label: form.label.trim() || undefined,
    });
    setBusy(null);
    if (ok) {
      setOpenForm(null);
      setForm(EMPTY_FORM);
    }
  }

  async function run(key: string, action: () => Promise<boolean>) {
    if (busy) return;
    setBusy(key);
    await action();
    setBusy(null);
  }

  async function remove(connection: Connection) {
    const ok = await confirm({
      title: 'Bağlantıyı kaldır',
      message: `“${connection.label}” hesabının jetonu silinecek. Devam edilsin mi?`,
      confirmLabel: 'Kaldır',
    });
    if (!ok) return;
    await run(`remove:${connection.id}`, () => actions.removeConnection(connection.id));
  }

  return (
    <>
      <PageHeader
        eyebrow="Hesaplar"
        title="Bağlantılar"
        subtitle="Her platform için istediğin kadar hesap ekle. Jetonlar şifrelenerek saklanır, hiçbir hesap diğerinin jetonunu ezmez."
        actions={
          <span className="connection-total">
            {connections.length} bağlı hesap
          </span>
        }
      />

      <div className="card connection-note">
        <AlertTriangle size={16} />
        <p>
          Jetonlar Windows DPAPI ile şifrelenir ve yalnızca bu bilgisayarda çözülebilir.
          Doğrulama, jetonu platformun kendi API’sine sorar; sonuç gerçek yanıttır.
        </p>
      </div>

      <div className="connection-platforms">
        {platforms.map((platform) => {
          const accounts = connections.filter((item) => item.platform === platform.id);
          const isOpen = openForm === platform.id;
          return (
            <article key={platform.id} className="card connection-card">
              <header className="connection-card-head">
                <div className="connection-platform">
                  <span className="connection-dot" style={{ background: platform.color }} />
                  <div>
                    <h2>{platform.label}</h2>
                    <p>
                      {accounts.length} hesap · {platform.hint}
                    </p>
                  </div>
                </div>
                <div className="connection-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void actions.openExternal(platform.docsUrl)}
                    title="Platformun geliştirici sayfasını aç"
                  >
                    <ExternalLink size={13} /> Doküman
                  </button>
                  <button
                    type="button"
                    className={isOpen ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                    onClick={() => {
                      setOpenForm(isOpen ? null : platform.id);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    {isOpen ? (
                      <>
                        <X size={13} /> Vazgeç
                      </>
                    ) : (
                      <>
                        <Plus size={13} /> Hesap ekle
                      </>
                    )}
                  </button>
                </div>
              </header>

              {isOpen ? (
                <form className="connection-form" onSubmit={(event) => void addAccount(event, platform.id)}>
                  <div className="connection-guide">
                    <div className="connection-guide-head">
                      <strong>{platform.label} jetonu nasıl alınır?</strong>
                      <small>Adımları izle, örnek biçimle karşılaştır.</small>
                    </div>
                    <ol className="connection-steps">
                      {platform.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <div className="connection-example">
                      <span>Örnek erişim jetonu</span>
                      <code>{platform.exampleToken}</code>
                      {platform.exampleRefresh ? (
                        <>
                          <span>Örnek yenileme jetonu</span>
                          <code>{platform.exampleRefresh}</code>
                        </>
                      ) : null}
                    </div>
                    {platform.note ? <p className="connection-guide-note">{platform.note}</p> : null}
                  </div>

                  <label className="connection-field">
                    <span>Hesap adı (isteğe bağlı)</span>
                    <input
                      className="input"
                      value={form.label}
                      onChange={(event) => setForm({ ...form, label: event.target.value })}
                      placeholder={`${platform.label} hesabı ${accounts.length + 1}`}
                      maxLength={80}
                    />
                  </label>
                  <label className="connection-field">
                    <span>Erişim jetonu</span>
                    <textarea
                      className="input connection-textarea"
                      value={form.token}
                      onChange={(event) => setForm({ ...form, token: event.target.value })}
                      placeholder={`${platform.hint} — örn. ${platform.exampleToken}`}
                      rows={2}
                      spellCheck={false}
                      required
                    />
                    {platform.tokenPrefix &&
                    form.token.trim().length >= 6 &&
                    !form.token.trim().startsWith(platform.tokenPrefix) ? (
                      <small className="connection-warn">
                        Bu jeton “{platform.tokenPrefix}” ile başlamıyor. Yine de ekleyebilirsin ama
                        doğrulama başarısız olabilir.
                      </small>
                    ) : null}
                  </label>
                  <label className="connection-field">
                    <span>Yenileme jetonu (isteğe bağlı)</span>
                    <input
                      className="input"
                      value={form.refreshToken}
                      onChange={(event) => setForm({ ...form, refreshToken: event.target.value })}
                      placeholder={
                        platform.exampleRefresh
                          ? `Örn. ${platform.exampleRefresh}`
                          : 'Jetonun süresi dolduğunda kullanılır'
                      }
                      spellCheck={false}
                    />
                  </label>
                  <div className="connection-form-foot">
                    <small>{platform.scopes}</small>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy === `add:${platform.id}`}>
                      {busy === `add:${platform.id}` ? 'Ekleniyor…' : 'Hesabı ekle'}
                    </button>
                  </div>
                </form>
              ) : null}

              {accounts.length === 0 ? (
                <p className="connection-empty">Henüz {platform.label} hesabı eklenmedi.</p>
              ) : (
                <ul className="connection-list">
                  {accounts.map((connection) => (
                    <li key={connection.id} className="connection-row">
                      <span className="connection-avatar" style={{ borderColor: platform.color }}>
                        {connection.avatar ? (
                          <img src={connection.avatar} alt="" />
                        ) : (
                          connection.label.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div className="connection-info">
                        <div className="connection-title">
                          <strong>{connection.label}</strong>
                          {connection.isPrimary ? (
                            <span className="connection-tag">
                              <Star size={10} /> birincil
                            </span>
                          ) : null}
                          <span className={`connection-status connection-status-${connection.status}`}>
                            {STATUS_TEXT[connection.status] ?? connection.status}
                          </span>
                        </div>
                        <small>
                          {connection.handle ? `${connection.handle} · ` : ''}
                          {connection.tokenHint ? `jeton ${connection.tokenHint} · ` : ''}
                          {connection.expiresAt
                            ? `bitiş ${new Date(connection.expiresAt).toLocaleDateString()}`
                            : 'bitiş kaydı yok'}
                        </small>
                        <ConnectionStats connection={connection} />
                        {connection.status === 'needs_attention' && connection.lastError ? (
                          <p className="connection-error">{connection.lastError}</p>
                        ) : null}
                      </div>
                      <div className="connection-actions">
                        {connection.isPrimary ? null : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={Boolean(busy)}
                            onClick={() => void run(`primary:${connection.id}`, () => actions.primaryConnection(connection.id))}
                          >
                            <Star size={13} /> Birincil
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={Boolean(busy)}
                          title="Jetonu platformun gerçek API'siyle doğrula ve istatistikleri tazele"
                          onClick={() => void run(`verify:${connection.id}`, () => actions.verifyConnection(connection.id))}
                        >
                          <Check size={13} /> Doğrula
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={Boolean(busy)}
                          onClick={() => void run(`refresh:${connection.id}`, () => actions.refreshConnection(connection.id))}
                        >
                          <RefreshCw size={13} /> Yenile
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          disabled={Boolean(busy)}
                          onClick={() => void remove(connection)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
