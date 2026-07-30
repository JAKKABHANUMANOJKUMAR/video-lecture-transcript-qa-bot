import React from 'react';
import { cx } from '../../lib/cx';

/**
 * Admin data table: quiet header, hairline rows, hover wash.
 * Wrap in a Card and give the wrapper overflow-x-auto on small screens.
 */
export function Table({ className, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse text-left text-sm', className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        'whitespace-nowrap border-b border-line px-4 py-3 text-micro uppercase tracking-wider text-ink-3',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx('border-b border-line/60 px-4 py-3 align-middle text-ink-2', className)} {...rest} />
  );
}

export function Tr({
  interactive,
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cx(
        interactive && 'cursor-pointer transition-colors duration-micro hover:bg-canvas/70',
        className,
      )}
      {...rest}
    />
  );
}
