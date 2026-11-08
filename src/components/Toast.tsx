import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import '../styles/button.css';
import { CloseIcon } from './icons';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastContextValue {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;
// Matches the exit transition in Toast.css.
const EXIT_DURATION_MS = 150;

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  isLeaving: boolean;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const { id, duration, isLeaving } = toast;

  useEffect(() => {
    if (isLeaving) return undefined;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, isLeaving, onDismiss]);

  return (
    <div className={`toast toast--${toast.type}`} data-state={isLeaving ? 'leaving' : 'visible'}>
      <p className="toast__message">{toast.message}</p>
      <button
        type="button"
        className="icon-btn toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, isLeaving: true } : toast)),
      );
      setTimeout(() => removeToast(id), EXIT_DURATION_MS);
    },
    [removeToast],
  );

  const showToast = useCallback(
    (message: string, type: ToastType, duration: number = DEFAULT_DURATION_MS) => {
      const id = nextId.current++;
      // Newest first so the visual stack order matches the DOM order.
      setToasts((current) => [{ id, message, type, duration, isLeaving: false }, ...current]);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
