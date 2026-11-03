import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import type { Note } from '../types';

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  note?: Note | null;
  defaultCompanyId?: string | null;
}

export function NoteModal({ open, onClose, note, defaultCompanyId }: NoteModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title === 'Adsız not' ? '' : note?.title ?? '');
    setBody(note?.body ?? '');
    setCompanyId(note?.companyId ?? defaultCompanyId ?? '');
    setPinned(note?.pinned ?? false);
    setBusy(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, note, defaultCompanyId]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const payload = {
      title: title.trim() || t('Adsız not'),
      body: body,
      companyId: companyId || null,
      pinned,
    };
    const success = note
      ? await actions.updateNote({ id: note.id, ...payload })
      : await actions.createNote(payload);
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!note) return;
    const sure = await confirm({
      title: t('Not silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: note.title }),
      confirmLabel: t('Notu sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteNote(note.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={note ? t('Notu düzenle') : t('Yeni not')}
      subtitle={t('Fikirleri, kararları ve operasyon notlarını şirketlerine bağla.')}
      onClose={onClose}
      size="md"
      icon={<FileText size={17} />}
      footer={
        <div className="footer-split">
          {note ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Notu sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="note-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : note ? t('Notu kaydet') : t('Notu ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="note-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="form-field">
          <span className="form-label">{t('Başlık')}</span>
          <input
            ref={titleRef}
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Yeni abonelik fiyatlandırması')}
            maxLength={120}
          />
        </label>

        <label className="form-field">
          <span className="form-label">{t('Not')}</span>
          <textarea
            className="input textarea note-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('Düşüncelerini buraya yaz…')}
            rows={10}
            maxLength={20000}
          />
          <span className="form-hint">{t('{count} karakter', { count: body.length })}</span>
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">{t('Şirketsiz')}</option>
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-field">
            <span className="form-label">{t('Sabitleme')}</span>
            <label className="switch-row switch-row-inline">
              <span>{t('Listede üste sabitle')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={pinned}
                className={`switch ${pinned ? 'on' : ''}`}
                onClick={() => setPinned((prev) => !prev)}
              >
                <span className="switch-knob" />
              </button>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
