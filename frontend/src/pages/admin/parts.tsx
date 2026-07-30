import React from 'react';
import { RotateCw } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Button, Card, Select, Skeleton, Spinner, Tag, type Tone } from '../../components/ui';

/**
 * Shared furniture for the admin surface — the Control Room.
 *
 * These compose the sanctioned `components/ui` primitives; they never restyle
 * them. Anything used by two or more admin screens belongs here rather than
 * being copied per page.
 */

/* ------------------------------------------------------------------- tones */

export const TONE_SOFT: Record<Tone, string> = {
  accent: 'bg-accent-tint text-accent-deep',
  peach: 'bg-peach-tint text-peach-ink',
  mint: 'bg-mint-tint text-mint-ink',
  sky: 'bg-sky-tint text-sky-ink',
  butter: 'bg-butter-tint text-butter-ink',
  rose: 'bg-rose-tint text-rose-ink',
  neutral: 'bg-canvas-deep text-ink-2',
};

/** Solid fill for meters and chart marks — same hue family as the tint. */
export const TONE_FILL: Record<Tone, string> = {
  accent: 'bg-accent',
  peach: 'bg-peach',
  mint: 'bg-mint',
  sky: 'bg-sky',
  butter: 'bg-butter',
  rose: 'bg-rose',
  neutral: 'bg-line-strong',
};

/** low | medium | high — rising heat. */
export function priorityTone(priority: string): Tone {
  const p = priority.toLowerCase();
  if (p === 'high') return 'rose';
  if (p === 'medium') return 'butter';
  return 'neutral';
}

/** open | in_progress | resolved — the shared lifecycle for alerts and tickets. */
export function lifecycleTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'resolved') return 'mint';
  if (s === 'in_progress') return 'butter';
  if (s === 'open') return 'sky';
  return 'neutral';
}

/** active | inactive | blocked. */
export function accountTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'active') return 'mint';
  if (s === 'blocked') return 'rose';
  return 'neutral';
}

/** complaint | system | security. */
export function alertTypeTone(type: string): Tone {
  const t = type.toLowerCase();
  if (t === 'security') return 'rose';
  if (t === 'system') return 'sky';
  if (t === 'complaint') return 'peach';
  return 'neutral';
}

/* ------------------------------------------------------------------ header */

/** The eyebrow + display headline every admin screen opens with. */
export function AdminHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-cap font-semibold uppercase tracking-wider text-accent-deep">{eyebrow}</p>
        <h1 className="mt-1 font-display text-h1 text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/* -------------------------------------------------------------- stat tiles */

/**
 * One headline number. Becomes a button when `onClick` is given, so an
 * overview tile can carry you to the screen that explains it.
 */
export function StatCard({
  icon,
  label,
  value,
  tone = 'accent',
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: Tone;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      interactive={!!onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="flex items-center gap-3 p-4 outline-none focus-visible:shadow-ring"
    >
      <div
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl',
          TONE_SOFT[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-h3 leading-none text-ink tabular-nums">{value}</p>
        <p className="mt-1 truncate text-cap text-ink-3">{label}</p>
        {hint && <p className="mt-0.5 truncate text-cap text-ink-3">{hint}</p>}
      </div>
    </Card>
  );
}

/** Four stat tiles' worth of shimmer, shaped like the loaded row. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[74px] rounded-card" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ meters */

/**
 * Labelled proportion bar. Used wherever a whole splits into named parts
 * (account status, ticket lifecycle, alert priority).
 */
export function MeterRow({
  label,
  value,
  total,
  tone = 'accent',
}: {
  label: string;
  value: number;
  total: number;
  tone?: Tone;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-ink-2">{label}</span>
        <span className="shrink-0 font-mono text-cap text-ink-3">
          <span className="text-ink">{value}</span> · {pct}%
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas-deep"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <i
          className={cx(
            'block h-full rounded-full transition-[width] duration-panel ease-study',
            TONE_FILL[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ranges */

export const RANGE_OPTIONS = [
  { value: 'all', label: 'All time', days: undefined },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
] as const;

export type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];

export function rangeDays(key: RangeKey): number | undefined {
  return RANGE_OPTIONS.find((o) => o.value === key)?.days;
}

/**
 * Compact range picker for a chart card. Changing it re-queries the API — the
 * window is applied in SQL, not by filtering an already-fetched payload.
 */
export function RangeSelect({
  value,
  onChange,
  label,
  busy = false,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
  label: string;
  busy?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {busy && <Spinner size={12} />}
      <Select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as RangeKey)}
        className="h-9 w-auto rounded-full py-0 pl-3.5 pr-8 text-cap"
      >
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ charts */

/**
 * Axis ticks that land on round numbers, so the gridlines read as 0/25/50/…
 * rather than 0/23/46/…. Always includes 0 and a top at or above `max`.
 */
export function niceTicks(max: number, steps = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v));
  return ticks;
}

export interface BarDatum {
  label: string;
  value: number;
  /** Tailwind background class for the mark, e.g. `bg-accent`. */
  fill: string;
}

/**
 * Categorical bar chart.
 *
 * Deliberately bars rather than a line or area: the categories are unrelated
 * counts with no order between them, so a connecting curve would imply a trend
 * that does not exist. Values are direct-labelled, so identity and magnitude
 * never depend on colour alone.
 */
export function CategoryBars({
  data,
  caption,
  height = 176,
}: {
  data: BarDatum[];
  caption?: string;
  height?: number;
}) {
  const peak = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1] || 1;

  return (
    <figure className="m-0">
      <div className="flex gap-3">
        {/* y axis */}
        <div
          className="relative w-8 shrink-0 font-mono text-[10px] text-ink-3"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {/* recessive gridlines */}
            {ticks.map((t) => (
              <i
                key={t}
                className="absolute inset-x-0 block border-t border-line"
                style={{ bottom: `${(t / top) * 100}%` }}
                aria-hidden
              />
            ))}
            {/* marks — 2px surface gap between neighbours */}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {data.map((d) => (
                <div
                  key={d.label}
                  className="group relative flex h-full flex-1 flex-col justify-end px-1.5"
                >
                  <span className="pointer-events-none absolute inset-x-0 -top-1 z-10 text-center font-mono text-[10px] tabular-nums text-ink-2 opacity-0 transition-opacity duration-micro group-hover:opacity-100">
                    {d.label}
                  </span>
                  <span className="mb-1 text-center font-mono text-[11px] font-semibold tabular-nums text-ink">
                    {d.value}
                  </span>
                  <i
                    className={cx(
                      'block w-full rounded-t-[4px] transition-[height] duration-panel ease-study',
                      d.value === 0 ? 'bg-line' : d.fill,
                    )}
                    style={{ height: `${d.value === 0 ? 2 : (d.value / top) * 100}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* category axis — the direct labels that carry identity */}
          <div className="mt-2 flex gap-[2px] border-t border-line-strong pt-2">
            {data.map((d) => (
              <span key={d.label} className="flex-1 truncate px-1 text-center text-cap text-ink-2">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {caption && <figcaption className="mt-3 text-cap text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

/** Skeleton shaped like a `CategoryBars` block. */
export function ChartSkeleton({ height = 176 }: { height?: number }) {
  return (
    <div>
      <Skeleton style={{ height }} className="rounded-ctl" />
      <Skeleton className="mt-3 h-3 w-2/3 rounded-chip" />
    </div>
  );
}

/* ------------------------------------------------------------ load failure */

/** The readable "couldn't reach it" card, with a retry. */
export function LoadFailure({
  what,
  message,
  onRetry,
}: {
  what: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="p-8 text-center" role="alert">
      <p className="text-body font-semibold text-ink">{what}</p>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      <div className="mt-5 flex justify-center">
        <Button variant="secondary" icon={<RotateCw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- countTag */

/** Filter chip carrying its own count — the Shelf idiom, reused for admin. */
export function CountTag({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tag
      tone={tone}
      interactive
      active={active}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="outline-none focus-visible:shadow-ring"
    >
      {label}
      <span className="opacity-60 tabular-nums">{count}</span>
    </Tag>
  );
}
