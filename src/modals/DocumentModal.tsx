import { useEffect, useRef, useState } from 'react';
import { FileUp, FolderOpen, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL } from '../constants';
import { deleteDocumentFile, formatFileSize, saveDocumentFile } from '../lib/docStore';
import type { CompanyDocument, DocumentCategory } from '../types';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

interface DocumentModalProps {
  open: boolean;
  onClose: () => void;
  document?: CompanyDocument | null;
  defaultCompanyId?: string | null;
}

export function DocumentModal({ open, onClose, document, defaultCompanyId }: DocumentModalProps) {
  const { data, actions, confirm, toast } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyId(document?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '');
    setTitle(document?.title ?? '');
    setCategory(document?.category ?? 'other');
    setNote(document?.note ?? '');
    setFile(null);
    setRemoveExisting(false);
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, document, defaultCompanyId, data?.companies]);

  const canSave = Boolean(companyId) && title.trim().length > 0;

  const pickFile = (next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      toast('error', t('Dosya 8 MB sınırını aşıyor.'));
      return;
    }
    setFile(next);
    setRemoveExisting(false);
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, '').slice(0, 200));
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const keepExisting = Boolean(document?.hasFile) && !removeExisting;
    if (document) {
      if (file) {
        try {
          await saveDocumentFile(document.id, file);
        } catch {
          toast('error', t('Dosya cihaz deposuna kaydedilemedi.'));
          setBusy(false);
          return;
        }
      } else if (removeExisting && document.hasFile) {
        try {
          await deleteDocumentFile(document.id);
        } catch {
          /* metadata can still be updated when the blob is already gone */
        }
      }
      const ok = await actions.updateDocument({
        id: document.id,
        companyId,
        title: title.trim(),
        category,
        note: note.trim(),
        hasFile: file ? true : keepExisting && !removeExisting,
        fileName: file ? file.name : removeExisting ? '' : document.fileName,
        mimeType: file ? file.type || 'application/octet-stream' : removeExisting ? '' : document.mimeType,
        size: file ? file.size : removeExisting ? 0 : document.size,
      });
      setBusy(false);
      if (ok) onClose();
      return;
    }

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (file) {
      try {
        await saveDocumentFile(id, file);
      } catch {
        toast('error', t('Dosya cihaz deposuna kaydedilemedi.'));
        setBusy(false);
        return;
      }
    }
    const ok = await actions.createDocument({
      id,
      companyId,
      title: title.trim(),
      category,
      note: note.trim(),
      hasFile: Boolean(file),
      fileName: file?.name ?? '',
      mimeType: file?.type || '',
      size: file?.size ?? 0,
    });
    if (!ok && file) await deleteDocumentFile(id).catch(() => undefined);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!document) return;
    const sure = await confirm({
      title: t('Belge silinsin mi?'),
      message: t('“{title}” belgesi ve cihazdaki dosyası kaldırılacak.', { title: document.title }),
      confirmLabel: t('Belgeyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    await deleteDocumentFile(document.id).catch(() => undefined);
    const ok = await actions.deleteDocument(document.id);
    setBusy(false);
    if (ok) onClose();
  };

  const currentFile = file
    ? { name: file.name, size: file.size }
    : document?.hasFile && !removeExisting
      ? { name: document.fileName || t('Kayıtlı dosya'), size: document.size }
      : null;

  return (
    <Modal
      open={open}
      title={document ? t('Belgeyi düzenle') : t('Yeni belge')}
      subtitle={t('Belge kaydı eşitlenir; dosya içeriği yalnızca bu cihazda saklanır.')}
      onClose={onClose}
      size="sm"
      icon={<FolderOpen size={17} />}
      footer={
        <div className="footer-split">
          {document ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Belgeyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="document-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : document ? t('Kaydet') : t('Belge ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="document-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select className="input select" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Kategori')}</span>
            <select className="input select" value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(DOCUMENT_CATEGORY_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Belge başlığı')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. 2026 hizmet sözleşmesi')}
            maxLength={200}
          />
          {touched && !title.trim() ? <span className="form-error">{t('Belge başlığı gerekli.')}</span> : null}
        </label>

        <div className="form-field">
          <span className="form-label">
            <FileUp size={13} /> {t('Dosya')} <span className="form-optional">{t('8 MB sınırı')}</span>
          </span>
          <input
            className="input"
            type="file"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
          {currentFile ? (
            <div className="adm-file-chip">
              <span>
                {currentFile.name} · {formatFileSize(currentFile.size)}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  if (file) setFile(null);
                  else setRemoveExisting(true);
                }}
                aria-label={t('Dosyayı kaldır')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <span className="form-hint">{t('Dosya olmadan da kayıt oluşturabilirsin.')}</span>
          )}
        </div>

        <label className="form-field">
          <span className="form-label">{t('Not')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea className="input textarea" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} />
        </label>
      </form>
    </Modal>
  );
}
