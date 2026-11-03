import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: 'default' | 'mint' | 'amber' | 'danger';
  footer?: ReactNode;
}

export function KpiCard({ label, value, hint, icon, tone = 'default', footer }: KpiCardProps) {
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
      {footer ? <div className="kpi-footer">{footer}</div> : null}
    </div>
  );
}
