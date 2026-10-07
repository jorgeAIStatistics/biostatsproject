import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { create } from 'zustand';
import { IconButton } from './primitives';

/** Traps focus loosely: focuses the panel on open and restores focus on close. */
function useFocusReturn(open: boolean, panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el) return;
      const focusable = el.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([aria-label="Close"])');
      (focusable ?? el).focus();
    }, 10);
    return () => {
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, panel]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
}

function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  width,
  hideHeader,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  hideHeader?: boolean;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusReturn(open, panel);
  useEscape(open, onClose);
  useBodyScrollLock(open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={clsx('dialog', className)}
        style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      >
        {!hideHeader && (
          <div className="dialog__header">
            <div className="dialog__title">{title}</div>
            <IconButton label="Close" onClick={onClose} tooltip={false}>
              <X />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  actions,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusReturn(open, panel);
  useEscape(open, onClose);
  useBodyScrollLock(open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside ref={panel} role="dialog" aria-modal="true" tabIndex={-1} className={clsx('drawer', size !== 'md' && `drawer--${size}`)}>
        <div className="drawer__header">
          <div style={{ fontWeight: 600, fontSize: 15, minWidth: 0 }}>{title}</div>
          <div className="row gap-2">
            {actions}
            <IconButton label="Close" onClick={onClose} tooltip={false}>
              <X />
            </IconButton>
          </div>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

/* ---------------------------------- Toasts --------------------------------- */

type ToastTone = 'success' | 'info' | 'warning';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextToast = 1;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'success') => {
    const id = nextToast++;
    set({ toasts: [...get().toasts, { id, tone, message }] });
    window.setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, tone?: ToastTone) => useToasts.getState().push(message, tone);

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={clsx('toast', `toast--${t.tone}`)}>
          {t.tone === 'success' ? <CircleCheck /> : t.tone === 'warning' ? <TriangleAlert /> : <Info />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
