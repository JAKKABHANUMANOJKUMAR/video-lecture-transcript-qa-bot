import React from 'react';
import { cx } from '../../lib/cx';

export type Tone = 'accent' | 'peach' | 'mint' | 'sky' | 'butter' | 'rose' | 'neutral';

const tones: Record<Tone, string> = {
  accent: 'bg-accent-tint text-accent-deep',
  peach: 'bg-peach-tint text-peach-ink',
  mint: 'bg-mint-tint text-mint-ink',
  sky: 'bg-sky-tint text-sky-ink',
  butter: 'bg-butter-tint text-butter-ink',
  rose: 'bg-rose-tint text-rose-ink',
  neutral: 'bg-canvas-deep text-ink-2',
};

export function Tag({
  tone = 'neutral',
  icon,
  interactive,
  active,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  icon?: React.ReactNode;
  interactive?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 px-2.5 py-0.5 text-cap font-semibold',
        // Air reserves the pill shape for toggles and filter chips; a plain
        // label tag takes the ordinary 8px radius.
        interactive ? 'rounded-full' : 'rounded-chip',
        tones[tone],
        interactive &&
          'cursor-pointer select-none transition-all duration-micro ease-study hover:brightness-95 active:scale-95',
        active && 'ring-2 ring-accent-soft',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

/** Dot + label status pill for lecture/processing lifecycle. */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status.toLowerCase();
  const map: Record<string, { tone: Tone; label: string; pulse?: boolean }> = {
    ready: { tone: 'mint', label: 'Ready' },
    completed: { tone: 'mint', label: 'Ready' },
    processing: { tone: 'butter', label: 'Processing', pulse: true },
    transcribing: { tone: 'butter', label: 'Transcribing', pulse: true },
    embedding: { tone: 'sky', label: 'Embedding', pulse: true },
    uploading: { tone: 'peach', label: 'Uploading', pulse: true },
    pending: { tone: 'neutral', label: 'Queued' },
    failed: { tone: 'rose', label: 'Failed' },
    error: { tone: 'rose', label: 'Failed' },
  };
  const m = map[s] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Tag tone={m.tone} className={className}>
      <i
        className={cx(
          'h-1.5 w-1.5 rounded-full bg-current',
          m.pulse && 'animate-pulse-soft',
        )}
      />
      {m.label}
    </Tag>
  );
}
