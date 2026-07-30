import React from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Leading icon element (a lucide icon sized by the button). */
  icon?: React.ReactNode;
}

// Air permits exactly two button forms: the Solid Light Button (Haze fill, 1px
// Ink border, Ink text) and the Ghost Button (transparent, 1px border). There is
// no filled-colour variant — hierarchy comes from border weight, not from fill,
// and Signal Blue is never promoted to a CTA background.
const variants: Record<Variant, string> = {
  // Solid Light Button — the primary action.
  primary:
    'bg-canvas text-ink border border-ink hover:bg-canvas-deep active:scale-[.98] disabled:border-line disabled:text-ink-3',
  // Ghost, on a hairline — the quieter sibling.
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong active:scale-[.98]',
  // Ghost carrying the accent as *text* only.
  soft: 'bg-transparent text-accent-deep border border-accent-soft hover:bg-accent-tint active:scale-[.98]',
  // A text button, closer to Air's Underline Link than to its bordered ghost.
  ghost: 'text-ink-2 hover:bg-canvas-deep hover:text-ink active:scale-[.98]',
  // State exception: Air ships no danger hue, so destructive keeps its tint.
  danger: 'bg-rose-tint text-rose-ink border border-rose/30 hover:bg-rose/20 active:scale-[.98]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-ctl',
  md: 'h-10 px-4 text-sm font-semibold gap-2 rounded-ctl',
  lg: 'h-12 px-6 text-body font-semibold gap-2 rounded-ctl',
  icon: 'h-10 w-10 rounded-ctl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-micro ease-study',
        'disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
