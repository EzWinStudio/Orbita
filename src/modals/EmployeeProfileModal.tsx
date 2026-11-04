import { Building2, Pencil, Plus, ShieldCheck, Star, Users } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CompanyChip } from '../components/CompanyChip';
import { useAppData } from '../store';
import { useI18n } from '../i18n';
import { EMPLOYEE_STATUS_LABEL } from '../constants';
import { formatDate, monthLabel } from '../lib/format';
import type { Employee, PerformanceReview } from '../types';

interface EmployeeProfileModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEdit: (employee: Employee) => void;
  onAddReview: (employee: Employee) => void;
  onEditReview: (review: PerformanceReview, employee: Employee) => void;
}

export function EmployeeProfileModal({
  open,
  onClose,
  employee,
  onEdit,
  onAddReview,
  onEditReview,
}: EmployeeProfileModalProps) {
  const data = useAppData();
  const { t, locale } = useI18n();

  if (!employee) return null;

  const company = data.companies.find((item) => item.id === employee.companyId);
  const department = data.departments.find((item) => item.id === employee.departmentId);
  const permissionRole = data.roles.find((item) => item.id === employee.roleId);
  const reviews = data.performanceReviews
    .filter((review) => review.employeeId === employee.id)
    .sort((a, b) => b.period.localeCompare(a.period) || b.createdAt - a.createdAt);
  const average = reviews.length
    ? Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length)
    : null;
  const scoreTone = average == null ? 'none' : average >= 85 ? 'high' : average >= 70 ? 'mid' : 'low';
  const initials =
    employee.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toLocaleUpperCase(locale) || '?';

  return (
    <Modal
      open={open}
      title={employee.name}
      subtitle={employee.role || t('Rol belirtilmedi')}
      onClose={onClose}
      size="lg"
      icon={<Users size={17} />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('Kapat')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(employee)}>
            <Pencil size={14} /> {t('Profili düzenle')}
          </button>
        </>
      }
    >
      <div className="profile-hero">
        <span className="profile-avatar">{initials}</span>
        <div className="profile-hero-main">
          <div className="profile-tags">
            <CompanyChip company={company} />
            <span className={`ops-status ops-status-${employee.status}`}>
              {t(EMPLOYEE_STATUS_LABEL[employee.status])}
            </span>
            <span className={`profile-tag ${department ? '' : 'is-muted'}`}>
              <Building2 size={12} />
              {department?.name || t('Departmansız')}
            </span>
            <span className={`profile-tag ${permissionRole ? '' : 'is-muted'}`}>
              <ShieldCheck size={12} />
              {permissionRole?.name || t('Yetki rolü atanmadı')}
            </span>
          </div>
          <p className={`profile-notes ${employee.notes ? '' : 'is-muted'}`}>
            {employee.notes || t('Henüz profil notu yok.')}
          </p>
        </div>
        <div className={`profile-score score-${scoreTone}`}>
          <span>
            <Star size={12} /> {t('Performans')}
          </span>
          <strong>{average ?? '—'}</strong>
          <em>
            {reviews.length
              ? t('{count} değerlendirme', { count: reviews.length })
              : t('Değerlendirme yok')}
          </em>
        </div>
      </div>

      <div className="profile-details">
        <div>
          <span>{t('E-posta')}</span>
          <strong dir="ltr">{employee.email || '—'}</strong>
        </div>
        <div>
          <span>{t('Başlangıç tarihi')}</span>
          <strong>{employee.startDate ? formatDate(employee.startDate) : '—'}</strong>
        </div>
        <div>
          <span>{t('Departman')}</span>
          <strong>{department?.name || t('Atanmadı')}</strong>
        </div>
        <div>
          <span>{t('Yetki rolü')}</span>
          <strong>{permissionRole?.name || t('Atanmadı')}</strong>
        </div>
      </div>

      <section className="profile-reviews">
        <div className="profile-reviews-head">
          <div>
            <h3>{t('Performans değerlendirmeleri')}</h3>
            <p>
              {reviews.length
                ? t('{count} değerlendirme', { count: reviews.length })
                : t('Henüz değerlendirme eklenmedi.')}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onAddReview(employee)}
          >
            <Plus size={13} /> {t('Değerlendirme ekle')}
          </button>
        </div>

        {reviews.length === 0 ? (
          <div className="profile-reviews-empty">
            <Star size={18} />
            <p>{t('İlk değerlendirmeyi ekle; performans puanı burada oluşsun.')}</p>
          </div>
        ) : (
          <div className="review-list">
            {reviews.map((review) => (
              <button
                type="button"
                className="review-item"
                key={review.id}
                onClick={() => onEditReview(review, employee)}
              >
                <span className="review-item-top">
                  <strong>{monthLabel(review.period)}</strong>
                  <span
                    className={`score-badge ${
                      review.score >= 85
                        ? 'score-high'
                        : review.score >= 70
                          ? 'score-mid'
                          : 'score-low'
                    }`}
                  >
                    {review.score} / 100
                  </span>
                  {review.reviewer ? <em>{review.reviewer}</em> : null}
                </span>
                {review.strengths ? (
                  <span className="review-line">
                    <b>{t('Güçlü yönler')}:</b> {review.strengths}
                  </span>
                ) : null}
                {review.improvements ? (
                  <span className="review-line">
                    <b>{t('Gelişim alanları')}:</b> {review.improvements}
                  </span>
                ) : null}
                {!review.strengths && !review.improvements ? (
                  <span className="review-line is-muted">{t('Not yok')}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}
