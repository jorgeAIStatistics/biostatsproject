import { forwardRef, useId, useState, type ButtonHTMLAttributes, type ReactNode, type HTMLAttributes } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'subtle' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, iconRight, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children?: ReactNode;
  block?: boolean;
}

export function ButtonLink({ to, variant = 'default', size = 'md', icon, iconRight, className, children, block }: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={clsx('btn', variant !== 'default' && `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  pressed?: boolean;
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', pressed, className, children, type = 'button', tooltip = true, ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={clsx('icon-btn', size === 'sm' && 'icon-btn--sm', className)}
      {...rest}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{btn}</Tooltip> : btn;
});

/* ---------------------------------- Tooltip -------------------------------- */

export function Tooltip({
  content,
  children,
  wide,
  placement = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  wide?: boolean;
  placement?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} className={clsx('tooltip', wide && 'tooltip--wide', placement === 'bottom' && 'tooltip--bottom')}>
          {content}
        </span>
      )}
    </span>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

export function Badge({
  tone = 'neutral',
  outline,
  dot,
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  outline?: boolean;
  dot?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={clsx('badge', tone !== 'neutral' && `badge--${tone}`, outline && 'badge--outline', className)}>
      {dot && <span className="badge__dot" />}
      {icon}
      {children}
    </span>
  );
}

export function Tag({ children, mono, className, title }: { children: ReactNode; mono?: boolean; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('tag', mono && 'tag--mono', className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/* ---------------------------------- Card ----------------------------------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pad?: 'none' | 'sm' | 'md';
  flat?: boolean;
}

export function Card({ pad = 'none', flat, className, children, ...rest }: CardProps) {
  return (
    <div className={clsx('card', pad === 'md' && 'card--pad', pad === 'sm' && 'card--pad-sm', flat && 'card--flat', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card__header">
      <div className="row gap-3" style={{ minWidth: 0, alignItems: 'flex-start' }}>
        {icon && <span style={{ color: 'var(--text-3)', marginTop: 1 }}>{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <div className="card__title">{title}</div>
          {subtitle && <div className="card__subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  );
}

export function CardLink({ to, className, children, pad = 'md' }: { to: string; className?: string; children: ReactNode; pad?: 'sm' | 'md' }) {
  return (
    <Link to={to} className={clsx('card card--interactive', pad === 'md' ? 'card--pad' : 'card--pad-sm', className)}>
      {children}
    </Link>
  );
}

/* ---------------------------------- Tabs ----------------------------------- */

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    const el = (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined) ?? null;
    el?.focus();
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className={clsx('tabs', className)}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          title={o.title}
          aria-checked={o.value === value}
          className="segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Progress -------------------------------- */

export function ProgressBar({
  value,
  tone = 'accent',
  thin,
  label,
  className,
}: {
  value: number;
  tone?: 'accent' | 'success';
  thin?: boolean;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={clsx('progress', tone === 'success' && 'progress--success', thin && 'progress--thin', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 44, stroke = 4, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 400ms var(--ease-out)' }}
        />
      </svg>
      {label !== undefined && (
        <span
          className="num"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: size > 50 ? 13 : 11,
            fontWeight: 600,
            color: 'var(--text-2)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ---------------------------------- Stat ----------------------------------- */

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

/* -------------------------------- EmptyState ------------------------------- */

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <span className="empty__icon">{icon}</span>}
      <div className="empty__title">{title}</div>
      {children && <div className="empty__body">{children}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="row gap-3" style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>
      <Spinner />
      {label}
    </div>
  );
}

/* ------------------------------- Disclosure -------------------------------- */

export function Disclosure({
  kind = 'why',
  label,
  icon,
  defaultOpen = false,
  children,
}: {
  kind?: string;
  label: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={clsx('disclosure', `disclosure--${kind}`)} data-open={open}>
      <button type="button" className="disclosure__summary" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="disclosure__kind">{icon}</span>
        <span className="disclosure__label">{label}</span>
        <span className="disclosure__chev">
          <ChevronRight />
        </span>
      </button>
      {open && (
        <div id={id} className="disclosure__content">
          {children}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Field ----------------------------------- */

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
