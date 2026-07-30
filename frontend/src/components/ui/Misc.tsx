import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { Tone } from './Tag';

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('animate-spin text-ink-3', className)} />;
}

/* -------------------------------------------------------------------- Kbd */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex items-center rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-3',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ----------------------------------------------------------------- Avatar */

const avatarTones: Tone[] = ['accent', 'peach', 'mint', 'sky', 'butter', 'rose'];
const avatarToneClass: Record<Tone, string> = {
  accent: 'bg-accent-tint text-accent-deep',
  peach: 'bg-peach-tint text-peach-ink',
  mint: 'bg-mint-tint text-mint-ink',
  sky: 'bg-sky-tint text-sky-ink',
  butter: 'bg-butter-tint text-butter-ink',
  rose: 'bg-rose-tint text-rose-ink',
  neutral: 'bg-canvas-deep text-ink-2',
};

/** Initials orb; pastel tone is stable per name. */
export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const hash = Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const tone = avatarTones[hash % avatarTones.length];
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cx('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-full font-bold',
        avatarToneClass[tone],
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}

/* ----------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        // A pill is legal here — Air reserves the shape for toggles and filters.
        // The track is Ink, not Signal Blue: the accent is never a control fill.
        'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-micro ease-study disabled:opacity-50',
        checked ? 'bg-ink' : 'bg-line-strong',
        className,
      )}
    >
      <i
        className={cx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all duration-micro ease-study',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- Tabs */

/** Pill segmented control. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx('inline-flex items-center gap-0.5 rounded-full bg-canvas-deep p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-micro ease-study',
            // Selected reads by contrast + hairline, not by elevation.
            value === o.value
              ? 'border border-line bg-surface text-ink'
              : 'border border-transparent text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Tooltip */

/** CSS-only hover/focus tooltip. */
export function Tooltip({
  label,
  side = 'top',
  children,
  className,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  className?: string;
}) {
  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];
  return (
    <span className={cx('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-chip bg-ink px-2 py-1 text-[11.5px] font-medium text-white opacity-0 transition-opacity duration-micro',
          'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
          pos,
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------- Menu */

/** Click-to-open dropdown anchored to its trigger; closes on outside click / Esc. */
export function Menu({
  trigger,
  align = 'end',
  direction = 'down',
  children,
  className,
}: {
  trigger: (open: boolean) => React.ReactNode;
  align?: 'start' | 'end';
  /** 'up' flips the panel above the trigger — for bottom-anchored menus. */
  direction?: 'down' | 'up';
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cx('relative', className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-50 min-w-[200px] overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-lg animate-pop',
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  danger,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      className={cx(
        'flex w-full items-center gap-2.5 rounded-chip px-3 py-2 text-left text-sm font-medium transition-colors duration-micro',
        danger ? 'text-danger hover:bg-rose-tint' : 'text-ink-2 hover:bg-canvas-deep hover:text-ink',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line" />;
}

/* ------------------------------------------------------------- Collapse */

/** Simple disclosure row (used for expandable sections). */
export function Disclosure({
  summary,
  defaultOpen,
  children,
  className,
}: {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-chip px-1 py-1.5 text-sm font-semibold text-ink-2 transition-colors duration-micro hover:text-ink"
      >
        {summary}
        <ChevronDown
          size={15}
          className={cx('transition-transform duration-micro ease-study', open && 'rotate-180')}
        />
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}
