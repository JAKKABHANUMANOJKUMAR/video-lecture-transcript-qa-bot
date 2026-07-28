import React from 'react';
import { Loader2 } from 'lucide-react';

// =============================================================================
// LEKTA UI PRIMITIVES
// Everything here speaks in role tokens (surface / content / accent / line …)
// from tailwind.config.js, so both themes and any palette swap stay a
// one-file change. Pages should compose these instead of hand-rolling markup —
// the app previously carried ~20 copies of card markup and 10 hand-built modals.
// =============================================================================

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-e1 hover:bg-accent-hover ' +
    'disabled:bg-surface-sunk disabled:text-content-disabled disabled:shadow-none',
  secondary:
    'bg-surface text-content-body border border-line-strong hover:bg-surface-sunk ' +
    'disabled:text-content-disabled',
  ghost:
    'bg-transparent text-content-muted hover:bg-surface-sunk hover:text-content ' +
    'disabled:text-content-disabled',
  // Destructive rests as a soft tint and only commits to full red on hover, so
  // the dangerous option never out-shouts the safe one.
  danger:
    'bg-danger-soft text-danger-ink hover:bg-danger hover:text-white ' +
    'disabled:text-content-disabled',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 min-h-[32px] gap-1.5 rounded-sm',
  md: 'text-sm px-4 py-2 min-h-[38px] gap-2 rounded-md',
  lg: 'text-[15px] px-5 py-2.5 min-h-[44px] gap-2 rounded-md',
};

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-canvas';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center font-medium transition-colors duration-200
      disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${FOCUS} ${className}`}
    {...rest}
  >
    {loading ? (
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
    ) : (
      Icon && <Icon className="w-4 h-4" aria-hidden="true" />
    )}
    {children}
  </button>
);

/** Icon-only button. `label` is required — it becomes the accessible name. */
interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: React.ElementType;
  label: string;
  tone?: 'default' | 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  label,
  tone = 'default',
  className = '',
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-grid place-items-center w-9 h-9 rounded-md transition-colors duration-200
      disabled:cursor-not-allowed disabled:text-content-disabled ${FOCUS}
      ${tone === 'danger'
        ? 'text-content-muted hover:bg-danger-soft hover:text-danger-ink'
        : 'text-content-muted hover:bg-surface-sunk hover:text-content'} ${className}`}
    {...rest}
  >
    <Icon className="w-4 h-4" aria-hidden="true" />
  </button>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...rest
}) => <div className={`bg-surface border border-line rounded-lg shadow-e1 ${className}`} {...rest} />;

type Tone = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'accent';

const TONES: Record<Tone, string> = {
  ok: 'bg-success-soft text-success-ink',
  warn: 'bg-warning-soft text-warning-ink',
  err: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  accent: 'bg-accent-soft text-accent-ink',
  neutral: 'bg-surface-sunk text-content-muted',
};

/** Status pill. Carries a dot as well as a word so colour is never the only channel. */
export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
      text-[11.5px] font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
    {children}
  </span>
);

/** Matches the real layout so nothing jumps when data lands. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`bg-[linear-gradient(90deg,rgb(var(--c-surface-sunk))_25%,rgb(var(--c-border))_37%,rgb(var(--c-surface-sunk))_63%)]
      bg-[length:400%_100%] animate-shimmer rounded-sm ${className}`}
    aria-hidden="true"
  />
);

export const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  body?: string;
  children?: React.ReactNode;
}> = ({ icon: Icon, title, body, children }) => (
  <div className="flex flex-col items-center text-center px-4 py-12">
    <div className="w-11 h-11 rounded-md grid place-items-center bg-accent-soft mb-3">
      <Icon className="w-5 h-5 text-accent" aria-hidden="true" />
    </div>
    <h3 className="text-h3 text-content">{title}</h3>
    {body && <p className="text-cap text-content-muted mt-1.5 max-w-[38ch]">{body}</p>}
    {children && <div className="flex flex-wrap gap-3 justify-center mt-5">{children}</div>}
  </div>
);

/** Error block that names what happened and offers a way forward. */
export const ErrorBlock: React.FC<{
  title: string;
  body?: string;
  children?: React.ReactNode;
}> = ({ title, body, children }) => (
  <div
    role="alert"
    className="flex gap-3 p-4 rounded-md bg-danger-soft border border-danger/25"
  >
    <svg
      className="w-[17px] h-[17px] shrink-0 mt-0.5 text-danger"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
    </svg>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-danger-ink">{title}</p>
      {body && <p className="text-cap text-content-muted mt-1">{body}</p>}
      {children && <div className="flex flex-wrap gap-2 mt-3">{children}</div>}
    </div>
  </div>
);
