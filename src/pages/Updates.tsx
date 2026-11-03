import { useEffect, useState } from 'react';
import { CheckCheck, Download, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import type { UpdateCheck, UpdateNotesPayload } from '../types';

export function Updates() {
  const { data, actions } = useApp();
  const [notes, setNotes] = useState<UpdateNotesPayload | null>(null);
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [feed, setFeed] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function loadNotes() {
    try {
      const payload = await window.ezwin?.updates.notes();
      if (!payload) return;
      setNotes(payload);
      setFeed(payload.feedUrl);
    } catch {
      /* notlar alınamazsa sayfa sürüm kartıyla kalır */
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  if (!data) return null;

  const unseen = notes ? notes.lastSeenVersion !== notes.currentVersion : false;
  const autoUpdate = data.settings.autoUpdate;
  const version = notes?.currentVersion ?? '';

  async function runCheck() {
    setBusy('check');
    const result = await actions.checkUpdates();
    setCheck(result);
    setBusy(null);
  }

  async function markSeen() {
    if (!notes) return;
    setBusy('seen');
    await actions.markNotesSeen(notes.currentVersion);
    await loadNotes();
    setBusy(null);
  }

  async function saveFeed() {
    setBusy('feed');
    await actions.saveUpdateSettings({ updateFeedUrl: feed });
    await loadNotes();
    setBusy(null);
  }

  async function toggleAuto(next: boolean) {
    setBusy('auto');
    await actions.saveUpdateSettings({ autoUpdate: next });
    setBusy(null);
  }

  async function install() {
    setBusy('download');
    await actions.installUpdate();
    setBusy(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Güncellemeler"
        subtitle="Sürüm notları ve otomatik güncelleme denetimi. Yeni sürüm yayınlandığında uygulama bunu kendi fark eder."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void runCheck()} disabled={busy === 'check'}>
            <RefreshCw size={15} /> {busy === 'check' ? 'Denetleniyor…' : 'Şimdi denetle'}
          </button>
        }
      />

      <div className="updates-grid">
        <div className="card updates-version">
          <div className="updates-version-top">
            <div>
              <span className="eyebrow">Kurulu sürüm</span>
              <h2>v{version || '—'}</h2>
            </div>
            {unseen ? <span className="updates-badge">yeni notlar</span> : <span className="updates-badge muted">okundu</span>}
          </div>

          <p className="updates-line">
            {check
              ? check.message
              : 'Henüz denetlenmedi. “Şimdi denetle” butonu güncelleme kanalına bağlanır.'}
          </p>

          {check?.available ? (
            <div className="updates-available">
              <strong>v{check.latest} hazır</strong>
              {check.notes && check.notes.length > 0 ? (
                <ul>
                  {check.notes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void install()} disabled={busy === 'download'}>
                <Download size={14} /> {busy === 'download' ? 'İndiriliyor ve doğrulanıyor…' : 'İndir ve kur'}
              </button>
            </div>
          ) : null}

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markSeen()} disabled={busy === 'seen' || !unseen}>
            <CheckCheck size={14} /> Notları okundu işaretle
          </button>
        </div>

        <div className="card updates-settings">
          <div className="card-header">
            <h2>Otomatik güncelleme</h2>
          </div>
          <div className="updates-row">
            <div>
              <strong>Kendiliğinden denetle</strong>
              <p>Uygulama açıkken güncelleme kanalını düzenli olarak yoklar ve yeni sürümü bildirir.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoUpdate}
              className={`updates-switch${autoUpdate ? ' on' : ''}`}
              onClick={() => void toggleAuto(!autoUpdate)}
              disabled={busy === 'auto'}
            >
              <span />
            </button>
          </div>

          <div className="updates-row column">
            <div>
              <strong>Güncelleme kanalı</strong>
              <p>
                Yayınlanan JSON bildirim adresi. Beklenen biçim: <code>version</code>, <code>url</code>,{' '}
                <code>notes</code>.
              </p>
            </div>
            <div className="updates-feed">
              <input
                className="input"
                value={feed}
                onChange={(event) => setFeed(event.target.value)}
                placeholder="https://ornek.com/orbita/update.json"
                spellCheck={false}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void saveFeed()} disabled={busy === 'feed'}>
                Kaydet
              </button>
            </div>
            {!feed ? (
              <p className="updates-hint">
                Kanal tanımlanmadan denetim yapılmaz; buton bunu açıkça söyler.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="updates-notes">
        {(notes?.entries ?? []).map((entry) => {
          const isCurrent = entry.version === notes?.currentVersion;
          return (
            <article key={entry.version} className={`card updates-note${isCurrent ? ' current' : ''}`}>
              <div className="updates-note-meta">
                <span className="updates-note-version">v{entry.version}</span>
                <span className="updates-note-date">{entry.date}</span>
                {isCurrent ? <span className="updates-note-tag">kurulu</span> : null}
              </div>
              <div className="updates-note-body">
                <h3>{entry.title}</h3>
                <p>{entry.summary}</p>
                {entry.items.length > 0 ? (
                  <ul>
                    {entry.items.map((item) => (
                      <li key={item}>
                        <Sparkles size={12} /> {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
