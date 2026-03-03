"use client";

import Image from "next/image";
import { ExternalLink, ShoppingCart, Tag, Tv } from "lucide-react";
import { motion } from "motion/react";
import { useStreamingAvailability } from "@/hooks/use-streaming-availability";
import { useStreamingPreferences, filterStreamingOptions } from "@/hooks/use-streaming-preferences";
import type { StreamingOption } from "@/hooks/use-streaming-availability";

interface Props {
  imdbId: string | null | undefined;
  country?: string;
}

const TYPE_LABELS: Record<StreamingOption["type"], string> = {
  subscription: "Abonnement",
  free: "Gratuit",
  rent: "Location",
  buy: "Achat",
  addon: "Addon",
};

const TYPE_COLORS: Record<StreamingOption["type"], string> = {
  subscription: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  free: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  rent: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  buy: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  addon: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const QUALITY_LABELS: Record<string, string> = {
  uhd: "4K",
  qhd: "1440p",
  hd: "HD",
  sd: "SD",
};

function ServiceButton({ option }: { option: StreamingOption }) {
  const hasLogo = !!option.service.imageSet?.whiteImage;
  const quality = option.quality ? (QUALITY_LABELS[option.quality] ?? option.quality.toUpperCase()) : null;
  const label = option.addon
    ? `${option.addon.name} via ${option.service.name}`
    : option.service.name;

  return (
    <motion.a
      href={option.link}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors"
      style={
        option.service.themeColorCode
          ? {
              borderColor: `${option.service.themeColorCode}30`,
              backgroundColor: `${option.service.themeColorCode}0D`,
            }
          : undefined
      }
      aria-label={`Regarder sur ${label}`}
    >
      {/* Logo ou icône de fallback */}
      <div className="shrink-0 flex items-center justify-center size-9 rounded-lg overflow-hidden bg-white/8">
        {hasLogo ? (
          <Image
            src={option.service.imageSet.whiteImage}
            alt={option.service.name}
            width={36}
            height={36}
            className="object-contain w-8 h-8"
            unoptimized
          />
        ) : (
          <Tv className="size-4 text-white/60" />
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate leading-tight">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[option.type]}`}
          >
            {TYPE_LABELS[option.type]}
          </span>
          {quality && (
            <span className="text-[10px] font-semibold text-white/40 px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5">
              {quality}
            </span>
          )}
          {option.price && (
            <span className="text-[10px] font-medium text-amber-300/80">
              {option.price.formatted}
            </span>
          )}
          {option.expiresSoon && (
            <span className="text-[10px] font-medium text-red-400/80">
              Expire bientôt
            </span>
          )}
        </div>
      </div>

      <ExternalLink className="size-3.5 text-white/30 group-hover:text-white/60 shrink-0 transition-colors" />
    </motion.a>
  );
}

function SkeletonButton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/4 animate-pulse">
      <div className="size-9 rounded-lg bg-white/10 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-24 bg-white/10 rounded-full" />
        <div className="h-2.5 w-16 bg-white/6 rounded-full" />
      </div>
    </div>
  );
}

export function StreamingServices({ imdbId, country = "fr" }: Props) {
  const { data: rawOptions, isLoading, isError } = useStreamingAvailability(imdbId, country);
  const prefs = useStreamingPreferences();

  if (!imdbId) return null;
  if (isError) return null;

  // Appliquer les préférences utilisateur
  const filtered = rawOptions ? filterStreamingOptions(rawOptions, prefs) : [];

  // Trier : subscription & free en premier, puis rent, buy, addon
  const ORDER: StreamingOption["type"][] = ["subscription", "free", "addon", "rent", "buy"];
  const sorted = filtered.length > 0
    ? [...filtered].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    : [];

  const subscriptions = sorted.filter((o) => o.type === "subscription" || o.type === "free");
  const rentBuy = sorted.filter((o) => o.type === "rent" || o.type === "buy");
  const addons = sorted.filter((o) => o.type === "addon");

  if (!isLoading && sorted.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-white font-semibold text-lg flex items-center gap-3">
        Où regarder
        {!isLoading && sorted.length > 0 && (
          <span className="section-label">{sorted.length}</span>
        )}
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonButton key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Inclus dans l'abonnement / Gratuit */}
          {subscriptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Tv className="size-3" />
                Inclus dans un abonnement
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {subscriptions.map((opt, i) => (
                  <ServiceButton key={`${opt.service.id}-${opt.type}-${i}`} option={opt} />
                ))}
              </div>
            </div>
          )}

          {/* Addons */}
          {addons.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Tv className="size-3" />
                Via un addon
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {addons.map((opt, i) => (
                  <ServiceButton key={`${opt.service.id}-${opt.type}-${i}`} option={opt} />
                ))}
              </div>
            </div>
          )}

          {/* Location / Achat */}
          {rentBuy.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="size-3" />
                Location &amp; Achat
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rentBuy.map((opt, i) => (
                  <ServiceButton key={`${opt.service.id}-${opt.type}-${i}`} option={opt} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <p className="text-[11px] text-white/25 flex items-center gap-1.5">
          <Tag className="size-3" />
          Disponibilités en France — données fournies par Streaming Availability API
        </p>
      )}
    </section>
  );
}
