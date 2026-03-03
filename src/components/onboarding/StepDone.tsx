"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Film, Loader2, Check } from "lucide-react";
import { motion } from "motion/react";
import { ProviderLogo } from "@/components/ui/ProviderLogo";
import type { ImportResults } from "@/app/onboarding/page";

interface StepDoneProps {
  imports: ImportResults;
}

export default function StepDone({ imports }: StepDoneProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const totalImported =
    (imports.letterboxd?.count ?? 0) +
    (imports.trakt?.count ?? 0) +
    (imports.netflix?.count ?? 0);

  const hasImports = totalImported > 0;

  const handleEnter = async () => {
    setLoading(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_completed: true }),
      });
    } catch {
      // continue anyway
    }
    router.push("/");
    router.refresh();
  };

  const sources = [
    imports.letterboxd && { provider: "letterboxd" as const, name: "Letterboxd", count: imports.letterboxd.count },
    imports.trakt && { provider: "trakt" as const, name: "Trakt.tv", count: imports.trakt.count },
    imports.netflix && { provider: "netflix" as const, name: "Netflix", count: imports.netflix.count },
  ].filter(Boolean) as { provider: string; name: string; count: number }[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 text-center"
    >
      {/* Icône */}
      <div className="flex justify-center">
        <div className="size-20 rounded-full bg-nemo-accent/15 border-2 border-nemo-accent/40 flex items-center justify-center">
          <Sparkles className="size-9 text-nemo-accent" />
        </div>
      </div>

      {/* Titre */}
      <div>
        <h2 className="text-white font-black text-2xl mb-2">
          {hasImports ? "Vous êtes prêt !" : "Bienvenue sur Nemo !"}
        </h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
          {hasImports
            ? `Votre historique de visionnage a été importé. Nemo va utiliser ces données pour vous proposer les meilleures recommandations.`
            : "Votre espace est configuré. Explorez les films et séries et construisez votre bibliothèque personnelle."}
        </p>
      </div>

      {/* Récap des imports */}
      {hasImports && (
        <div className="glass rounded-2xl p-4 space-y-2 text-left">
          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">
            Historique importé
          </p>
          {sources.map((src) => (
            <div key={src.provider} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ProviderLogo provider={src.provider} size="sm" showBrandBackground ariaLabel={src.name} />
                <span className="text-white/70 text-sm">{src.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Film className="size-3.5 text-white/30" />
                <span className="text-white font-semibold">{src.count}</span>
                <span className="text-white/40">entrées</span>
              </div>
            </div>
          ))}
          <div className="border-t border-white/8 pt-2 mt-1 flex items-center justify-between">
            <span className="text-white/50 text-xs">Total importé</span>
            <div className="flex items-center gap-1.5">
              <Check className="size-3.5 text-green-400" />
              <span className="text-white font-bold">{totalImported}</span>
              <span className="text-white/40 text-xs">titres</span>
            </div>
          </div>
        </div>
      )}

      {/* Bouton */}
      <button
        onClick={() => void handleEnter()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-base"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Sparkles className="size-5" />
        )}
        {loading ? "Chargement..." : "Découvrir l'app"}
      </button>

      <p className="text-white/25 text-xs">
        Vous pouvez compléter votre profil et ajouter d&apos;autres services dans les paramètres à tout moment.
      </p>
    </motion.div>
  );
}
