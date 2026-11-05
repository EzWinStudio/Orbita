import { useEffect, useRef, useState } from 'react';
import { Lock, Megaphone, Pin } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABEL,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_PRIORITY_LABEL,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_STATUS_LABEL,
  ANNOUNCEMENT_VISIBILITIES,
  ANNOUNCEMENT_VISIBILITY_LABEL,
} from '../constants';
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementVisibility,
} from '../types';

interface AnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  announcement?: Announcement | null;
  defaultCompanyId?: string | null;
}

export function AnnouncementModal({
  open,
  onClose,
  announcement,
  defaultCompanyId,
}: AnnouncementModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('company');
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<AnnouncementVisibility>('team');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [status, setStatus] = useState<AnnouncementStatus>('draft');
  const [pinned, setPinned] = useState(false);
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const departments = (data?.departments ?? []).filter((item) => item.companyId === companyId);

  useEffect(() => {
    if (!open) return;
    const initialCompany =
      announcement?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '';
    setCompanyId(initialCompany);
    setAudience(announcement?.audience ?? 'company');
    setDepartmentId(announcement?.departmentId ?? '');
    setTitle(announcement?.title ?? '');
    setBody(announcement?.body ?? '');
    setVisibility(announcement?.visibility ?? 'team');
    setPriority(announcement?.priority ?? 'normal');
    setStatus(announcement?.status ?? 'draft');
    setPinned(announcement?.pinned ?? false);
    setAuthor(announcement?.author ?? '');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, announcement, defaultCompanyId, data?.companies]);

  useEffect(() => {
    if (!open || audience !== 'department') return;
    setDepartmentId((current) =>
      departments.some((item) => item.id === current) ? current : departments[0]?.id ?? '',
    );
  }, [open, audience, departments]);

  const canSave =
    Boolean(companyId) &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'company' || Boolean(departmentId));

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const base = {
      companyId,
      audience,
      title: title.trim(),
      body: body.trim(),
      visibility,
      priority,
      pinned,
      status,
      author: author.trim(),
    };
    const success = announcement
      ? await actions.updateAnnouncement({
          id: announcement.id,
          ...base,
          departmentId: audience === 'department' ? departmentId : null,
        })
      : await actions.createAnnouncement({
          ...base,
          ...(audience === 'department' ? { departmentId } : {}),
        });
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!announcement) return;
    const sure = await confirm({
      title: t('Duyuru silinsin mi?'),
      message: t('“{title}” duyurusu kaldırılacak.', { title: announcement.title }),
      confirmLabel: t('Duyuruyu sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteAnnouncement(announcement.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={announcement ? t('Duyuruyu düzenle') : t('Yeni duyuru')}
      subtitle={t('Duyurular bu çalışma alanında yayınlanır; ekip akışı ayrımı kurumsal etikettir.')}
      onClose={onClose}
      size="md"
      icon={<Megaphone size={17} />}
      footer={
        <div className="footer-split">
          {announcement ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Duyuruyu sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="announcement-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : announcement ? t('Kaydet') : t('Duyuru oluştur')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="announcement-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Şirket')}</span>
            <select
              className="input select"
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setDepartmentId('');
              }}
            >
              {data?.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">{t('Hedef kitle')}</span>
            <select
              className="input select"
              value={audience}
              onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
            >
              {ANNOUNCEMENT_AUDIENCES.map((item) => (
                <option key={item} value={item}>
                  {t(ANNOUNCEMENT_AUDIENCE_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        </div>

        {audience === 'department' ? (
          <label className="form-field">
            <span className="form-label">{t('Departman')}</span>
            <select
              className="input select"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              {departments.length === 0 ? <option value="">{t('Departman yok')}</option> : null}
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {departments.length === 0 ? (
              <span className="form-error">{t('Önce Operasyon sayfasından bir departman ekle.')}</span>
            ) : null}
          </label>
        ) : null}

        <label className="form-field">
          <span className="form-label">{t('Başlık')}</span>
          <input
            ref={titleRef}
            className={`input ${touched && !title.trim() ? 'input-error' : ''}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Örn. Haftalık ekip toplantısı')}
            maxLength={160}
          />
          {touched && !title.trim() ? (
            <span className="form-error">{t('Başlık gerekli.')}</span>
          ) : null}
        </label>

        <label className="form-field">
          <span className="form-label">{t('Duyuru metni')}</span>
          <textarea
            className={`input textarea ${touched && !body.trim() ? 'input-error' : ''}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('Ekibe iletmek istediğin mesajı yaz…')}
            rows={5}
            maxLength={8000}
          />
          {touched && !body.trim() ? (
            <span className="form-error">{t('Duyuru metni gerekli.')}</span>
          ) : null}
        </label>

        <div className="form-row">
          <div className="form-field">
            <span className="form-label">{t('Öncelik')}</span>
            <div className="segmented segmented-block">
              {ANNOUNCEMENT_PRIORITIES.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`segment ${priority === item ? 'active' : ''}`}
                  onClick={() => setPriority(item)}
                >
                  {t(ANNOUNCEMENT_PRIORITY_LABEL[item])}
                </button>
              ))}
            </div>
          </div>
          <div className="form-field">
            <span className="form-label">{t('Durum')}</span>
            <div className="segmented segmented-block">
              {ANNOUNCEMENT_STATUSES.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`segment ${status === item ? 'active' : ''}`}
                  onClick={() => setStatus(item)}
                >
                  {t(ANNOUNCEMENT_STATUS_LABEL[item])}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-field">
          <span className="form-label">{t('Görünürlük')}</span>
          <div className="segmented segmented-block">
            {ANNOUNCEMENT_VISIBILITIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${visibility === item ? 'active' : ''}`}
                onClick={() => setVisibility(item)}
              >
                {item === 'admin' ? <Lock size={13} /> : null}
                {t(ANNOUNCEMENT_VISIBILITY_LABEL[item])}
              </button>
            ))}
          </div>
          <span className="form-hint">
            {t('Yöneticiye özel duyurular ekip akışından ayrılır; çalışma alanı erişimini kısıtlamaz.')}
          </span>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Yayınlayan')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder={t('Örn. EzWin')}
              maxLength={80}
            />
          </label>
          <div className="form-field">
            <span className="form-label">{t('Sabitle')}</span>
            <button
              type="button"
              className={`toggle-row ${pinned ? 'is-on' : ''}`}
              onClick={() => setPinned((current) => !current)}
            >
              <Pin size={15} />
              <span>{pinned ? t('Duyuru sabitlendi') : t('Duyuruyu sabitle')}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
