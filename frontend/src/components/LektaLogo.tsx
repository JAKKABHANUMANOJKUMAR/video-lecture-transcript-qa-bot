import React, { useId } from 'react';

interface LektaLogoProps {
  size?: number;
  className?: string;
  /** tile = accent rounded square w/ white mark (default); ink = bare mark in accent */
  variant?: 'tile' | 'ink';
}

// Brand mark: a play triangle sliced into audio-waveform bars — video + speech
// in a single shape. Colors come from the design tokens so a palette swap in
// index.css re-brands the logo too.
export const LektaLogo: React.FC<LektaLogoProps> = ({
  size = 64,
  className = '',
  variant = 'tile',
}) => {
  // Unique clip id per instance (the logo is rendered at several sizes).
  const clipId = `lekta-wave-${useId().replace(/:/g, '')}`;
  const barFill = variant === 'tile' ? '#ffffff' : 'rgb(var(--c-accent))';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={className}
      role="img"
      aria-label="Lekta"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points="27,18 27,54 55,36" />
        </clipPath>
      </defs>
      {variant === 'tile' && (
        <rect width="72" height="72" rx="18" fill="rgb(var(--c-accent))" />
      )}
      <g clipPath={`url(#${clipId})`} fill={barFill}>
        <rect x="25" y="8" width="5" height="56" />
        <rect x="32" y="8" width="5" height="56" />
        <rect x="39" y="8" width="5" height="56" />
        <rect x="46" y="8" width="5" height="56" />
        <rect x="53" y="8" width="5" height="56" />
      </g>
    </svg>
  );
};

export default LektaLogo;
