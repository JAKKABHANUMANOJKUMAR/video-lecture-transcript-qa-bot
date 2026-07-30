import React from 'react';
import { cx } from '../../lib/cx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Strengthens the hairline on hover + pointer, for interactive cards. */
  interactive?: boolean;
  /** panel = floating surface. Same radius as a card under Air's shape rules. */
  as?: 'card' | 'panel';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, as = 'card', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cx(
        'bg-surface border border-line',
        as === 'panel' ? 'rounded-panel' : 'rounded-card',
        // Air has no elevation, so hover deepens the hairline instead of lifting
        // the card — a shadowless lift just looks like a glitch.
        interactive &&
          'cursor-pointer transition-colors duration-micro ease-study hover:border-ink',
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = 'Card';
