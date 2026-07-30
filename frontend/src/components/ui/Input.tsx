import React from 'react';
import { Search } from 'lucide-react';
import { cx } from '../../lib/cx';

// Air gives form fields their own radius — 4px, tighter than any other control.
const base =
  'w-full bg-surface text-body text-ink placeholder:text-ink-3 border border-line rounded-input transition-all duration-micro ease-study hover:border-line-strong focus:border-accent-soft focus:shadow-ring focus:outline-none disabled:opacity-60 disabled:pointer-events-none';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cx(base, 'h-11 px-3.5', className)} {...rest} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cx(base, 'min-h-[96px] px-3.5 py-2.5 resize-y', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cx(base, 'h-11 px-3 pr-8 appearance-none cursor-pointer', className)} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';

/** Label + control + hint/error wrapper. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-cap text-danger animate-fade-in" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-cap text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Search input with leading icon and optional trailing keyboard hint. */
export function SearchInput({
  kbdHint,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { kbdHint?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input type="search" className={cx(base, 'h-11 pl-10 pr-12')} {...rest} />
      {kbdHint && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-3">
          {kbdHint}
        </kbd>
      )}
    </div>
  );
}
