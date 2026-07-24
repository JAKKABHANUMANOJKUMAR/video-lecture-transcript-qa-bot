import React, { useId } from 'react';

interface LektaLogoProps {
  size?: number;
  className?: string;
}

// Brand mark: a play triangle sliced into audio-waveform bars — video + speech
// in a single shape. Teal to match the app palette.
export const LektaLogo: React.FC<LektaLogoProps> = ({ size = 64, className = '' }) => {
  // Unique clip id per instance (the logo is rendered at several sizes).
  const clipId = `lekta-wave-${useId().replace(/:/g, '')}`;
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
      <rect width="72" height="72" rx="18" fill="#0d9488" />
      <g clipPath={`url(#${clipId})`} fill="#ffffff">
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
