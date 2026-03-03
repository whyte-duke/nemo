import type React from "react";

interface JellyfinIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Logo Jellyfin — silhouette de méduse (jellyfish), identique au branding officiel.
 * Utilise `currentColor` pour hériter de la couleur parente.
 */
export function JellyfinIcon({ className, size, style }: JellyfinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
    >
      {/* Cloche / dôme de la méduse */}
      <path
        d="M3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12V13H3V12Z"
        fill="currentColor"
      />
      {/* Manteau */}
      <rect x="3" y="12" width="18" height="2.5" rx="1.25" fill="currentColor" />
      {/* Tentacules */}
      <path d="M6 14.5 Q5 17 6 19.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 15 Q8 17.5 9 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 15 Q13 17.5 12 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 15 Q16 17.5 15 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18 14.5 Q19 17 18 19.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
