import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { tGlobal } from '../i18n/core';

const modalStack: string[] = [];
let bodyLocks = 0;

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
  icon,
}: ModalProps) {
  const titleId = useId();
  const stackId = useRef(`modal_${Math.random().toString(36).slice(2)}`);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = stackId.current;
    modalStack.push(id);
    bodyLocks += 1;
    document.body.classList.add('modal-open');

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== id) return;
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      const index = modalStack.lastIndexOf(id);
      if (index >= 0) modalStack.splice(index, 1);
      bodyLocks = Math.max(0, bodyLocks - 1);
      if (bodyLocks === 0) document.body.classList.remove('modal-open');
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          {icon ? <span className="modal-icon">{icon}</span> : null}
          <div className="modal-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label={tGlobal('Kapat')}>
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
