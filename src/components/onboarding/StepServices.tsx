"use client";

import { useState } from "react";
import { Check, Minus, Tv2, Loader2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { STREAMING_SERVICES_CATALOG, ALL_SERVICE_IDS } from "@/lib/streaming-services-catalog";
import { cn } from "@/lib/utils";
import { getProviderLogoConfig, getSimpleIconUrl, getProviderInitials } from "@/lib/provider-logos";

function ServiceIcon({ serviceId, color, selected }: { serviceId: string; color: string; selected: boolean }) {
  const config = getProviderLogoConfig(serviceId);

  if (config?.simpleIconSlug) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getSimpleIconUrl(config.simpleIconSlug!)}
        alt=""
        className={cn(
          "w-8 h-8 object-contain transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-30"
        )}
        style={selected ? { filter: `drop-shadow(0 0 8px ${color}88)` } : undefined}
        loading="lazy"
      />
    );
  }

  // Fallback : initiales (même logique que provider-logos)
  const initials = config
    ? getProviderInitials(config.name)
    : serviceId
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 3);
  const displayColor = selected ? (config?.color ?? color) : "#ffffff";

  return (
    <span
      className={cn(
        "font-black text-lg tracking-tight transition-opacity duration-200",
        selected ? "opacity-100" : "opacity-30"
      )}
      style={{ color: displayColor }}
    >
      {initials}
    </span>
  );
}

interface StepServicesProps {
  onNext: () => void;
}

export default function StepServices({ onNext }: StepServicesProps) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const isChecked = (id: string) =>
    selected === null || selected.includes(id);

  const allChecked = selected === null;
  const noneChecked = selected !== null && selected.length === 0;
  const partialChecked = !allChecked && !noneChecked;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const current = prev ?? ALL_SERVICE_IDS;
      if (current.includes(id)) {
        const next = current.filter((s) => s !== id);
        return next.length === 0 ? [] : next;
      } else {
        const next = [...current, id];
        return next.length === ALL_SERVICE_IDS.length ? null : next;
      }
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streaming_services: selected }),
      });
    } catch {
      // silently continue
    } finally {
      setSaving(false);
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Tv2 className="size-5 text-nemo-accent" />
          <h2 className="text-white font-bold text-xl">Vos services streaming</h2>
        </div>
        <p className="text-white/50 text-sm">
          Sélectionnez vos abonnements. Seuls ceux-ci apparaîtront sur les fiches film et série.
          Modifiable à tout moment dans les paramètres.
        </p>
      </div>

      {/* Contrôles tout / rien */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
            allChecked
              ? "bg-nemo-accent/15 border-nemo-accent/40 text-nemo-accent"
              : "glass border-white/15 text-white/50 hover:text-white hover:border-white/30"
          )}
        >
          <Check className="size-3" />
          Tout cocher
        </button>
        <button
          type="button"
          onClick={() => setSelected([])}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
            noneChecked
              ? "bg-white/10 border-white/30 text-white"
              : "glass border-white/15 text-white/50 hover:text-white hover:border-white/30"
          )}
        >
          <Minus className="size-3" />
          Tout décocher
        </button>
        {partialChecked && (
          <span className="text-white/30 text-xs ml-auto">
            {(selected ?? []).length} / {ALL_SERVICE_IDS.length}
          </span>
        )}
      </div>

      {/* Grille des services — 2 colonnes, logos */}
      <div className="grid grid-cols-2 gap-2.5 max-h-95 overflow-y-auto pr-1">
        {STREAMING_SERVICES_CATALOG.map((service) => {
          const checked = isChecked(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggle(service.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border transition-all duration-200 overflow-hidden",
                checked
                  ? "border-opacity-60"
                  : "glass border-white/8 hover:border-white/20"
              )}
              style={
                checked
                  ? {
                      borderColor: `${service.color}80`,
                      backgroundColor: `${service.color}18`,
                      boxShadow: `0 0 24px ${service.color}15 inset`,
                    }
                  : undefined
              }
            >
              {/* Icône */}
              <ServiceIcon
                serviceId={service.id}
                color={service.color}
                selected={checked}
              />

              {/* Nom */}
              <span
                className={cn(
                  "text-xs font-semibold leading-tight text-center px-2 transition-colors duration-200",
                  checked ? "text-white" : "text-white/30"
                )}
              >
                {service.name}
              </span>

              {/* Checkmark coin */}
              {checked && (
                <span
                  className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: service.color }}
                >
                  <Check className="size-2.5 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bouton continuer */}
      <div className="flex justify-end pt-1">
        <button
          onClick={() => void handleContinue()}
          disabled={saving}
          className="flex items-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {saving ? "Enregistrement..." : "Continuer"}
        </button>
      </div>
    </motion.div>
  );
}
