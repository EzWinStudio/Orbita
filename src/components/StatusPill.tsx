import type { ServiceState } from '../types';
import { STATE_LABEL } from '../constants';
import { useI18n } from '../i18n';

interface StatusPillProps {
  state: ServiceState;
  label?: string;
  subtle?: boolean;
}

export function StatusPill({ state, label, subtle = false }: StatusPillProps) {
  const { t } = useI18n();
  return (
    <span className={`status-pill status-${state} ${subtle ? 'status-subtle' : ''}`}>
      <span className="status-dot" />
      {label ?? t(STATE_LABEL[state])}
    </span>
  );
}

export function StatusDot({ state }: { state: ServiceState }) {
  return <span className={`status-dot status-dot-${state}`} aria-hidden="true" />;
}
