import React from 'react';
import { cx } from '../../lib/cx';

/**
 * Animated SVG progress ring. `value` is 0–100; omit for indeterminate spin.
 */
export function ProgressRing({
  value,
  size = 40,
  stroke = 4,
  className,
  children,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  className?: string;
  /** Center content (e.g. percentage label). */
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = value != null ? Math.min(100, Math.max(0, value)) : undefined;
  return (
    <div
      className={cx('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        className={cx('-rotate-90', clamped == null && 'animate-spin [animation-duration:1.4s]')}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-canvas-deep"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={clamped != null ? c - (clamped / 100) * c : c * 0.75}
          className="stroke-accent transition-[stroke-dashoffset] duration-panel ease-study"
        />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-medium text-ink-2">
          {children}
        </span>
      )}
    </div>
  );
}
