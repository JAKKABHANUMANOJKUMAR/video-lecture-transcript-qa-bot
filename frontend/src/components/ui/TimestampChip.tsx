import { Play } from 'lucide-react';
import { cx } from '../../lib/cx';

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/**
 * Time is the atom of Lekta: a timestamp is always a mono-font chip.
 * Clickable chips seek the video to that moment.
 */
export function TimestampChip({
  seconds,
  endSeconds,
  onSeek,
  className,
}: {
  seconds: number;
  endSeconds?: number;
  onSeek?: (seconds: number) => void;
  className?: string;
}) {
  const label =
    endSeconds != null ? `${formatTime(seconds)}–${formatTime(endSeconds)}` : formatTime(seconds);
  if (!onSeek) {
    return (
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-chip bg-canvas-deep px-1.5 py-0.5 font-mono text-[12px] text-ink-2',
          className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSeek(seconds)}
      title={`Jump to ${formatTime(seconds)}`}
      className={cx(
        'group inline-flex items-center gap-1 rounded-chip bg-accent-tint px-1.5 py-0.5 font-mono text-[12px] font-medium text-accent-deep',
        'transition-all duration-micro ease-study hover:bg-accent-soft/60 active:scale-95',
        className,
      )}
    >
      <Play size={10} className="fill-current opacity-70 transition-transform duration-micro group-hover:scale-110" />
      {label}
    </button>
  );
}
