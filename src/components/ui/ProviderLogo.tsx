"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  getProviderLogoConfig,
  getSimpleIconUrl,
  getProviderInitials,
} from "@/lib/provider-logos";

export interface ProviderLogoProps {
  /**
   * Identifiant du provider : hub slug (netflix, apple-tv), catalog id (netflix, prime),
   * import source (letterboxd, trakt), ou TMDb provider id (8, 350).
   */
  provider: string | number;
  /** Couleur de l'icône (hex). Par défaut : couleur de marque du SVG (pas de param dans l'URL CDN). */
  iconColor?: string | null;
  /** Taille : sm (8), md (10), lg (12). Ou classes Tailwind. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Pour fallback initiales : fond + bordure utilisent la couleur brand. */
  showBrandBackground?: boolean;
  /** Accessibilité : décrit le provider (ex: "Logo Netflix"). */
  ariaLabel?: string;
}

const SIZE_CLASSES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
} as const;

export function ProviderLogo({
  provider,
  iconColor = null,
  size = "md",
  className,
  showBrandBackground = false,
  ariaLabel,
}: ProviderLogoProps) {
  const config = getProviderLogoConfig(provider);
  if (!config) {
    return null;
  }

  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size];
  const imageSrc =
    config.customImageUrl ??
    (config.simpleIconSlug ? getSimpleIconUrl(config.simpleIconSlug, iconColor ?? undefined) : null);
  const useImage = !!imageSrc && !imgError;
  const initials = getProviderInitials(config.name);

  const content = useImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt=""
      className={cn("object-contain w-full h-full", !showBrandBackground && "opacity-90")}
      loading="lazy"
      decoding="async"
      onError={() => setImgError(true)}
    />
  ) : (
    <span
      className="font-black text-sm leading-none truncate"
      style={{ color: iconColor ? `#${String(iconColor).replace("#", "")}` : config.color }}
    >
      {initials}
    </span>
  );

  const wrapperClassName = cn(
    "shrink-0 rounded-xl flex items-center justify-center overflow-hidden",
    sizeClass,
    showBrandBackground && "border",
    className
  );

  const wrapperStyle = showBrandBackground
    ? {
        backgroundColor: `${config.color}22`,
        borderColor: `${config.color}44`,
      }
    : undefined;

  return (
    <div
      className={wrapperClassName}
      style={wrapperStyle}
      role="img"
      aria-label={ariaLabel ?? `Logo ${config.name}`}
    >
      {content}
    </div>
  );
}
