import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Users } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { MEETING_STATUSES, MEETING_STATUS_LABEL } from '../constants';
import { todayISO } from '../lib/format';
import type { Meeting, MeetingStatus } from '../types';

interface MeetingModalProps {
  open: boolean;
  onClose: () => void;
  meeting?: Meeting | null;
  defaultCompanyId?: string | null;
}

export function MeetingModal({ open, onClose, meeting, defaultCompanyId }: MeetingModalProps) {
  const { data, actions, confirm } = useApp();
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('10:00');
  const [durationMin, setDurationMin] = useState('30');
  const [location, setLocation] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [status, setStatus] = useState<MeetingStatus>('planned');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const departments = useMemo(
    () => (data?.departments ?? []).filter((item) => item.companyId === companyId),
    [data?.departments, companyId],
  );
  const employees = useMemo(
    () =>
      (data?.employees ?? []).filter(
        (item) => item.companyId === companyId && item.status !== 'inactive',
      ),
    [data?.employees, companyId],
  );

  useEffect(() => {
    if (!open) return;
    const initialCompany = meeting?.companyId ?? defaultCompanyId ?? data?.companies[0]?.id ?? '';
    setCompanyId(initialCompany);
    setDepartmentId(meeting?.departmentId ?? '');
    setTitle(meeting?.title ?? '');
    setAgenda(meeting?.agenda ?? '');
    setDate(meeting?.date ?? todayISO());
    setTime(meeting?.time ?? '10:00');
    setDurationMin(String(meeting?.durationMin ?? 30));
    setLocation(meeting?.location ?? '');
    setAttendeeIds(meeting?.attendeeIds ?? []);
    setStatus(meeting?.status ?? 'planned');
    setBusy(false);
    setTouched(false);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [open, meeting, defaultCompanyId, data?.companies]);

  useEffect(() => {
    setAttendeeIds((current) =>
      current.filter((id) => employees.some((employee) => employee.id === id)),
    );
    setDepartmentId((current) =>
      departments.some((department) => department.id === current) ? current : '',
    );
  }, [employees, departments]);

  const numericDuration = Number(durationMin);
  const canSave =
    Boolean(companyId) &&
    title.trim().length > 0 &&
    Boolean(date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    Number.isFinite(numericDuration) &&
    numericDuration >= 5 &&
    numericDuration <= 480;

  const toggleAttendee = (id: string) => {
    setAttendeeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const base = {
      companyId,
      title: title.trim(),
      agenda: agenda.trim(),
      date,
      time,
      durationMin: numericDuration,
      location: location.trim(),
      attendeeIds,
      status,
    };
    const success = meeting
      ? await actions.updateMeeting({
          id: meeting.id,
          ...base,
          departmentId: departmentId || null,
        })
      : await actions.createMeeting({
          ...base,
          ...(departmentId ? { departmentId } : {}),
        });
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!meeting) return;
    const sure = await confirm({
      title: t('Toplantı silinsin mi?'),
      message: t('“{title}” toplantısı kaldırılacak.', { title: meeting.title }),
      confirmLabel: t('Toplantıyı sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deleteMeeting(meeting.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={meeting ? t('Toplantıyı düzenle') : t('Toplantı planla')}
      subtitle={t('Katılımcılar organizasyon kaydıdır; toplantı daveti gönderilmez.')}
      onClose={onClose}
      size="md"
      icon={<CalendarClock size={17} />}
      footer={
        <div className="footer-split">
          {meeting ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Toplantıyı sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="meeting-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : meeting ? t('Kaydet') : t('Toplantıyı planla')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="meeting-form"
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
                setAttendeeIds([]);
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
            <span className="form-label">{t('Departman')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <select
              className="input select"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">{t('Departmansız')}</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Toplantı başlığı')}</span>
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

        <div className="form-row form-row-three">
          <label className="form-field">
            <span className="form-label">{t('Tarih')}</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              max="2100-12-31"
            />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Saat')}</span>
            <input
              className="input"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">{t('Süre (dk)')}</span>
            <input
              className="input"
              inputMode="numeric"
              value={durationMin}
              onChange={(event) => setDurationMin(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="30"
            />
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">{t('Konum veya bağlantı')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <input
            className="input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t('Örn. Discord · Sesli kanal')}
            maxLength={200}
          />
        </label>

        <div className="form-field">
          <span className="form-label">
            {t('Katılımcılar')} <span className="form-optional">{t('{count} seçili', { count: attendeeIds.length })}</span>
          </span>
          {employees.length === 0 ? (
            <span className="form-hint">{t('Bu şirkette aktif çalışan yok.')}</span>
          ) : (
            <div className="meeting-attendees">
              {employees.map((employee) => (
                <button
                  type="button"
                  key={employee.id}
                  className={`attendee-chip ${attendeeIds.includes(employee.id) ? 'is-on' : ''}`}
                  onClick={() => toggleAttendee(employee.id)}
                >
                  <span className="attendee-dot" />
                  {employee.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="form-field">
          <span className="form-label">{t('Gündem')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            placeholder={t('Görüşülecek maddeler…')}
            rows={4}
            maxLength={4000}
          />
        </label>

        <div className="form-field">
          <span className="form-label">{t('Durum')}</span>
          <div className="segmented segmented-block">
            {MEETING_STATUSES.map((item) => (
              <button
                type="button"
                key={item}
                className={`segment ${status === item ? 'active' : ''}`}
                onClick={() => setStatus(item)}
              >
                {t(MEETING_STATUS_LABEL[item])}
              </button>
            ))}
          </div>
        </div>

        {attendeeIds.length > 0 ? (
          <div className="form-callout">
            <Users size={15} />
            <span>{t('{count} katılımcı seçildi.', { count: attendeeIds.length })}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
