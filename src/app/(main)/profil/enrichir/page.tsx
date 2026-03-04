"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, ThumbsUp, ThumbsDown, BarChart3, Loader2 } from "lucide-react";
import Link from "next/link";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

// ─── Noms des genres TMDB (les plus courants) ─────────────────────────────────
const GENRE_NAMES: Record<string, string> = {
  "28": "Action", "12": "Aventure", "16": "Animation", "35": "Comédie",
  "80": "Crime", "99": "Documentaire", "18": "Drame", "10751": "Famille",
  "14": "Fantaisie", "36": "Histoire", "27": "Horreur", "10402": "Musique",
  "9648": "Mystère", "10749": "Romance", "878": "Science-Fiction",
  "10770": "Téléfilm", "53": "Thriller", "10752": "Guerre", "37": "Western",
  "10759": "Action & Aventure (TV)", "10762": "Enfants (TV)",
  "10763": "Actualités (TV)", "10764": "Réalité (TV)", "10765": "Sci-Fi & Fantasy (TV)",
  "10766": "Soap (TV)", "10767": "Talk (TV)", "10768": "Guerre & Politique (TV)",
};

interface TasteProfileResponse {
  profile: TasteProfile | null;
}

function GenreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.abs(score) / max : 0;
  const isPositive = score >= 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/60 text-xs w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isPositive ? "bg-indigo-400" : "bg-red-400/70"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className={`text-[11px] font-mono w-8 text-right ${isPositive ? "text-indigo-300" : "text-red-400"}`}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </span>
    </div>
  );
}

export default function EnrichirPage() {
  const { data, isLoading } = useQuery<TasteProfileResponse>({
    queryKey: ["taste-profile"],
    queryFn: async () => {
      const res = await fetch("/api/taste-profile");
      if (!res.ok) throw new Error();
      return res.json() as Promise<TasteProfileResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const profile = data?.profile;
  const hasProfile = profile && Object.keys(profile.genre_scores).length > 0;

  // Top genres (positifs + négatifs triés par valeur absolue)
  const genreEntries = Object.entries(profile?.genre_scores ?? {})
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 12);
  const maxGenreScore = genreEntries.reduce((m, [, v]) => Math.max(m, Math.abs(v)), 0);

  const likedCount = Object.values(profile?.genre_scores ?? {}).filter(v => v > 0).length;
  const dislikedCount = Object.values(profile?.genre_scores ?? {}).filter(v => v < 0).length;

  return (
    <div className="pt-6 pb-12 px-4 sm:px-6 max-w-2xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Sparkles className="size-5 text-indigo-400" />
        <h1 className="text-white text-xl font-bold">Affiner vos goûts</h1>
      </div>

      {/* Stats du profil */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 text-white/30 animate-spin" />
        </div>
      ) : hasProfile ? (
        <div className="space-y-6">
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
              <ThumbsUp className="size-5 text-indigo-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{likedCount}</p>
              <p className="text-white/40 text-xs">Genres aimés</p>
            </div>
            <div className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
              <ThumbsDown className="size-5 text-red-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{dislikedCount}</p>
              <p className="text-white/40 text-xs">Genres évités</p>
            </div>
            <div className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
              <BarChart3 className="size-5 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">
                {Object.keys(profile?.director_scores ?? {}).length}
              </p>
              <p className="text-white/40 text-xs">Réalisateurs</p>
            </div>
          </div>

          {/* Barres des genres */}
          <div className="rounded-2xl bg-white/4 border border-white/8 p-4 space-y-3">
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
              Genres — affinité
            </h2>
            {genreEntries.map(([id, score]) => (
              <GenreBar
                key={id}
                label={GENRE_NAMES[id] ?? `Genre ${id}`}
                score={score}
                max={maxGenreScore}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/4 border border-white/8 p-6 text-center space-y-2">
          <p className="text-white/60 text-sm">Aucun profil de goût encore calculé.</p>
          <p className="text-white/30 text-xs">Swipez au moins quelques films pour voir vos statistiques.</p>
        </div>
      )}

      {/* CTA — swiper plus */}
      <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-5 flex items-center gap-4">
        <Sparkles className="size-6 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Améliorer vos recommandations</p>
          <p className="text-white/50 text-xs mt-0.5">
            Plus vous swipez, plus les recommandations s'affinent.
          </p>
        </div>
        <Link
          href="/decouvrir"
          className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
        >
          Swiper
        </Link>
      </div>

      {/* Lien vers les recommandations */}
      {hasProfile && (
        <Link
          href="/pour-vous"
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <Sparkles className="size-4" />
          Voir mes recommandations personnalisées →
        </Link>
      )}
    </div>
  );
}
