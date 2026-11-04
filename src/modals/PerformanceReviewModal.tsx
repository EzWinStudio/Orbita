import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { currentMonthKey, monthLabel } from '../lib/format';
import type { Employee, PerformanceReview } from '../types';

interface PerformanceReviewModalProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  review?: PerformanceReview | null;
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toLocaleUpperCase() || '?'
  );
}

export function PerformanceReviewModal({
  open,
  onClose,
  employee,
  review,
}: PerformanceReviewModalProps) {
  const { actions, confirm } = useApp();
  const { t } = useI18n();
  const [period, setPeriod] = useState(currentMonthKey());
  const [score, setScore] = useState(80);
  const [reviewer, setReviewer] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPeriod(review?.period ?? currentMonthKey());
    setScore(review?.score ?? 80);
    setReviewer(review?.reviewer ?? '');
    setStrengths(review?.strengths ?? '');
    setImprovements(review?.improvements ?? '');
    setBusy(false);
    setTouched(false);
  }, [open, review, employee?.id]);

  if (!employee) return null;

  const validPeriod = /^\d{4}-\d{2}$/.test(period);
  const validScore = Number.isFinite(score) && score >= 0 && score <= 100;
  const canSave = validPeriod && validScore;

  const submit = async () => {
    setTouched(true);
    if (!canSave || busy) return;
    setBusy(true);
    const payload = {
      period,
      score,
      reviewer: reviewer.trim(),
      strengths: strengths.trim(),
      improvements: improvements.trim(),
    };
    const success = review
      ? await actions.updatePerformanceReview({ id: review.id, ...payload })
      : await actions.createPerformanceReview({ employeeId: employee.id, ...payload });
    setBusy(false);
    if (success) onClose();
  };

  const remove = async () => {
    if (!review) return;
    const sure = await confirm({
      title: t('Değerlendirme silinsin mi?'),
      message: t('“{period}” dönemindeki değerlendirme silinecek.', {
        period: monthLabel(review.period),
      }),
      confirmLabel: t('Değerlendirmeyi sil'),
    });
    if (!sure) return;
    setBusy(true);
    const success = await actions.deletePerformanceReview(review.id);
    setBusy(false);
    if (success) onClose();
  };

  return (
    <Modal
      open={open}
      title={review ? t('Değerlendirmeyi düzenle') : t('Yeni değerlendirme')}
      subtitle={t('Puanı ve geri bildirimi kaydet; çalışan profilinde geçmiş olarak görünür.')}
      onClose={onClose}
      size="md"
      icon={<Star size={17} />}
      footer={
        <div className="footer-split">
          {review ? (
            <button type="button" className="btn btn-danger-ghost" onClick={() => void remove()} disabled={busy}>
              {t('Değerlendirmeyi sil')}
            </button>
          ) : (
            <span />
          )}
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('Vazgeç')}
            </button>
            <button type="submit" form="review-form" className="btn btn-primary" disabled={busy}>
              {busy ? t('Kaydediliyor…') : review ? t('Kaydet') : t('Değerlendirme ekle')}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="review-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="review-employee">
          <span className="employee-avatar">{initialsOf(employee.name)}</span>
          <span>
            <strong>{employee.name}</strong>
            <em>{employee.role || t('Rol belirtilmedi')}</em>
          </span>
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('Dönem')}</span>
            <input
              className={`input ${touched && !validPeriod ? 'input-error' : ''}`}
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              min="2000-01"
              max="2100-12"
            />
            {touched && !validPeriod ? (
              <span className="form-error">{t('Dönem gerekli.')}</span>
            ) : null}
          </label>
          <label className="form-field">
            <span className="form-label">{t('Değerlendiren')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
            <input
              className="input"
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
              placeholder={t('Örn. Şirket yöneticisi')}
              maxLength={120}
            />
          </label>
        </div>

        <div className="form-field">
          <span className="form-label">
            {t('Puan')}{' '}
            <span
              className={`score-badge ${
                score >= 85 ? 'score-high' : score >= 70 ? 'score-mid' : 'score-low'
              }`}
            >
              {score} / 100
            </span>
          </span>
          <div className="review-score-row">
            <input
              className="score-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
              aria-label={t('Performans puanı')}
            />
            <input
              className={`input score-number ${touched && !validScore ? 'input-error' : ''}`}
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
              aria-label={t('Puan')}
            />
          </div>
          {touched && !validScore ? (
            <span className="form-error">{t('Puan 0 ile 100 arasında olmalı.')}</span>
          ) : null}
        </div>

        <label className="form-field">
          <span className="form-label">{t('Güçlü yönler')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
            placeholder={t('Güçlü yönleri kısaca yaz.')}
            maxLength={400}
            rows={3}
          />
        </label>

        <label className="form-field">
          <span className="form-label">{t('Gelişim alanları')} <span className="form-optional">{t('isteğe bağlı')}</span></span>
          <textarea
            className="input textarea"
            value={improvements}
            onChange={(event) => setImprovements(event.target.value)}
            placeholder={t('Gelişim alanlarını kısaca yaz.')}
            maxLength={400}
            rows={3}
          />
        </label>
      </form>
    </Modal>
  );
}
