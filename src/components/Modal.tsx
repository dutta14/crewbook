import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import '../styles/button.css';
import { CloseIcon } from './icons';
import './Modal.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Matches the exit transition in Modal.css; the dialog stays mounted this long after closing.
const EXIT_DURATION_MS = 150;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  role?: 'dialog' | 'alertdialog';
  describedBy?: string;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Below 768px the dialog becomes a full-screen sheet that slides up from the bottom. */
  mobileSheet?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = true,
  role = 'dialog',
  describedBy,
  footer,
  initialFocusRef,
  mobileSheet = false,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(isOpen);

  if (isOpen && !isMounted) setIsMounted(true);

  useEffect(() => {
    if (isOpen) return undefined;
    const timer = setTimeout(() => setIsMounted(false), EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialFocus =
      initialFocusRef?.current ??
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      closeButtonRef.current;
    initialFocus?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
    // Focus is only moved when the dialog opens, not when the caller re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isMounted) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && isOpen && event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="modal-backdrop"
      data-state={isOpen ? 'open' : 'closing'}
      role="presentation"
      aria-hidden={isOpen ? undefined : true}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        className={`modal modal--${size}${mobileSheet ? ' modal--sheet' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div ref={bodyRef} className="modal__body">
          {children}
        </div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
