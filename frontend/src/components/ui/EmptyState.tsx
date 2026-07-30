import React from 'react';
import { cx } from '../../lib/cx';
import type { Tone } from './Tag';

const orbTones: Record<Tone, string> = {
  accent: 'bg-accent-tint text-accent-deep',
  peach: 'bg-peach-tint text-peach-ink',
  mint: 'bg-mint-tint text-mint-ink',
  sky: 'bg-sky-tint text-sky-ink',
  butter: 'bg-butter-tint text-butter-ink',
  rose: 'bg-rose-tint text-rose-ink',
  neutral: 'bg-canvas-deep text-ink-2',
};

/**
 * Calm, encouraging empty state: pastel icon orb + Fraunces headline + action.
 */
export function EmptyState({
  icon,
  tone = 'accent',
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-14 text-center animate-rise', className)}>
      <div
        className={cx(
          'mb-5 flex h-16 w-16 items-center justify-center rounded-panel',
          orbTones[tone],
        )}
      >
        {icon}
      </div>
      <h3 className="font-display text-h2 text-ink text-balance">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-ink-2 text-balance">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
