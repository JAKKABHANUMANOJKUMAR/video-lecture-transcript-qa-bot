import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';

/** Shimmer block — size with w-/h- utilities (or `style` for a measured height). */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden style={style} className={cx('skeleton', className)} />;
}

/** N shimmering text lines, last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cx('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cx('skeleton h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
