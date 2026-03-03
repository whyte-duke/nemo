"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  User,
  Users,
  ChevronDown,
  Loader2,
  Film,
  Star,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useFriends } from "@/hooks/use-friends";
import { useProfile } from "@/hooks/use-profile";
import { useMovieGenres } from "@/hooks/use-tmdb";
import { tmdbImage } from "@/lib/tmdb/client";
import { formatYear } from "@/lib/utils";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";

type Mode = "alone" | "with_friends";

type FinderMovie = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  overview: string | null;
  inJellyfin?: boolean;
};

export default function TrouveUnFilmPage() {
  const { user } = useAuth();
  const { data: friends = [] } = useFriends();
  const { data: profile } = useProfile();
  const { data: genresData } = useMovieGenres();
  const genres = genresData?.genres ?? [];

  const [mode, setMode] = useState<Mode>("alone");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(7.5);
  const [releaseYearFrom, setReleaseYearFrom] = useState<number | "">("");
  const [releaseYearTo, setReleaseYearTo] = useState<number | "">("");
  const [onlyJellyfin, setOnlyJellyfin] = useState(false);
  const [friendsDropdownOpen, setFriendsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FinderMovie[]>([]);
  const [excludedMovieIds, setExcludedMovieIds] = useState<number[]>([]);

  const hasJellyfin = !!profile?.jellyfin_user_id;

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const suggest = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/finder/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendIds: mode === "with_friends" ? selectedFriendIds : undefined,
          genreIds: genreIds.length ? genreIds : undefined,
          minRating,
          releaseYearFrom: releaseYearFrom !== "" ? releaseYearFrom : undefined,
          releaseYearTo: releaseYearTo !== "" ? releaseYearTo : undefined,
          onlyJellyfin: hasJellyfin && onlyJellyfin,
          limit: 5,
          excludeMovieIds: excludedMovieIds.length ? excludedMovieIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setResults(data.movies ?? []);
      if ((data.movies ?? []).length > 0) {
        setExcludedMovieIds((prev) => [
          ...prev,
          ...(data.movies as FinderMovie[]).map((m) => m.id),
        ].slice(-20));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suggestion");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedFriendIds, genreIds, minRating, releaseYearFrom, releaseYearTo, onlyJellyfin, hasJellyfin, excludedMovieIds]);

  const toggleGenre = useCallback((id: number) => {
    setGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }, []);

  if (!user) {
    return (
      <div className="min-h-dvh pt-24 pb-16 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-nemo-accent/15 mb-6">
            <Film className="size-8 text-nemo-accent" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">W3NO</h1>
          <p className="text-white/60 text-sm mb-6">
            Connecte-toi pour qu’on te propose le film idéal selon tes goûts et ton historique.
          </p>
          <Link
            href="/connexion"
            className="inline-flex items-center gap-2 px-6 py-3 bg-nemo-accent hover:bg-[#f0c85a] text-black font-bold rounded-full transition-colors"
          >
            Connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {/* Titre */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Tu veux un film pour…
          </h1>
          <p className="text-white/50 text-sm">On te propose le bon film, rien que pour toi.</p>
        </div>

        {/* Mode */}
        <div className="flex gap-3 justify-center mb-8">
          <button
            type="button"
            onClick={() => setMode("alone")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200",
              mode === "alone"
                ? "bg-white/15 text-white border border-white/20"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            <User className="size-4" />
            Tout seul
          </button>
          <button
            type="button"
            onClick={() => setMode("with_friends")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200",
              mode === "with_friends"
                ? "bg-white/15 text-white border border-white/20"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            <Users className="size-4" />
            Avec des potes
          </button>
        </div>

        {/* Amis (si mode with_friends) */}
        <AnimatePresence>
          {mode === "with_friends" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-8"
            >
              <div className="glass-tile rounded-2xl p-4 border border-white/10">
                <p className="text-white/60 text-xs mb-3">
                  On ne proposera que des films qu’aucun de vous n’a vus.
                </p>
                {friends.length === 0 ? (
                  <p className="text-white/40 text-sm">Tu n’as pas encore d’amis sur Nemo.</p>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFriendsDropdownOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left text-sm text-white/80 hover:bg-white/8 transition-colors"
                    >
                      <span>
                        {selectedFriendIds.length === 0
                          ? "Ajouter des amis"
                          : `${selectedFriendIds.length} ami(s) sélectionné(s)`}
                      </span>
                      <ChevronDown
                        className={cn("size-4 shrink-0 transition-transform", friendsDropdownOpen && "rotate-180")}
                      />
                    </button>
                    <AnimatePresence>
                      {friendsDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full left-0 right-0 mt-1 py-2 rounded-xl glass-tile border border-white/10 z-10 max-h-48 overflow-y-auto"
                        >
                          {friends.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => toggleFriend(f.id)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/8 text-left"
                            >
                              <div className="relative size-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                                {f.avatar_url ? (
                                  <Image src={f.avatar_url} alt="" fill className="object-cover" sizes="32px" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-white/70 font-bold text-sm">
                                    {(f.display_name ?? "?").charAt(0)}
                                  </div>
                                )}
                              </div>
                              <span className="text-white text-sm truncate flex-1">
                                {f.display_name ?? "Ami"}
                              </span>
                              {selectedFriendIds.includes(f.id) ? (
                                <Check className="size-4 text-nemo-accent shrink-0" />
                              ) : null}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {selectedFriendIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {friends
                          .filter((f) => selectedFriendIds.includes(f.id))
                          .map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-nemo-accent/15 text-nemo-accent text-xs font-medium"
                            >
                              {f.display_name ?? "Ami"}
                              <button
                                type="button"
                                onClick={() => toggleFriend(f.id)}
                                aria-label="Retirer"
                                className="hover:bg-nemo-accent/20 rounded-full p-0.5"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filtres */}
        <div className="glass-tile rounded-2xl p-5 border border-white/10 mb-8">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Filtres</h2>

          {/* Genre */}
          <div className="mb-4">
            <label className="block text-xs text-white/50 mb-2">Genre(s)</label>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    genreIds.includes(g.id)
                      ? "bg-nemo-accent/25 text-nemo-accent border border-nemo-accent/30"
                      : "bg-white/8 text-white/70 hover:bg-white/12 border border-transparent"
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Note min */}
          <div className="mb-4">
            <label className="block text-xs text-white/50 mb-2">
              Note minimale : {minRating.toFixed(1)}/10
            </label>
            <input
              type="range"
              min={5}
              max={9}
              step={0.5}
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full bg-white/10 accent-nemo-accent"
            />
          </div>

          {/* Années de sortie */}
          <div className="mb-4">
            <label className="block text-xs text-white/50 mb-2">Années de sortie</label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={releaseYearFrom === "" ? "" : releaseYearFrom}
                onChange={(e) =>
                  setReleaseYearFrom(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-nemo-accent/50 min-w-20"
              >
                <option value="">De (toutes)</option>
                {Array.from({ length: new Date().getFullYear() - 1919 }, (_, i) => 1920 + i)
                  .reverse()
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
              <span className="text-white/40 text-sm">→</span>
              <select
                value={releaseYearTo === "" ? "" : releaseYearTo}
                onChange={(e) =>
                  setReleaseYearTo(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-nemo-accent/50 min-w-20"
              >
                <option value="">À (toutes)</option>
                {Array.from({ length: new Date().getFullYear() - 1919 }, (_, i) => 1920 + i)
                  .reverse()
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Jellyfin */}
          {hasJellyfin && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyJellyfin}
                onChange={(e) => setOnlyJellyfin(e.target.checked)}
                className="rounded border-white/30 bg-white/5 text-nemo-accent focus:ring-nemo-accent"
              />
              <span className="text-sm text-white/80 flex items-center gap-2">
                <JellyfinIcon className="size-4 text-[#00A4DC]" />
                Uniquement dans ma bibliothèque Jellyfin
              </span>
            </label>
          )}
        </div>

        {/* Bouton Trouve-moi un film */}
        <div className="flex justify-center mb-10">
          <button
            type="button"
            onClick={() => void suggest()}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-lg tracking-wide transition-all duration-200",
              "bg-nemo-accent hover:bg-[#f0c85a] text-black shadow-lg shadow-amber-500/20",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Sparkles className="size-5" />
            )}
            Trouve-moi un film
          </button>
        </div>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-nemo-red text-sm mb-6"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Résultats */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Film className="size-5 text-nemo-accent" />
                Ta sélection
              </h2>
              {results.map((movie, i) => (
                <motion.article
                  key={movie.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass-tile rounded-2xl overflow-hidden border border-white/10"
                >
                  <Link href={`/film/${movie.id}`} className="flex gap-4 p-4 hover:bg-white/5 transition-colors">
                    <div className="relative w-24 h-36 rounded-xl overflow-hidden bg-white/10 shrink-0">
                      {movie.poster_path ? (
                        <Image
                          src={tmdbImage.poster(movie.poster_path, "w342") ?? ""}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/30">
                          <Film className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="text-white font-bold text-lg truncate">{movie.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-white/60">
                        {movie.release_date && (
                          <span>{formatYear(movie.release_date)}</span>
                        )}
                        <span className="flex items-center gap-1 text-nemo-accent font-medium">
                          <Star className="size-3.5 fill-current" />
                          {movie.vote_average.toFixed(1)}
                        </span>
                        {movie.inJellyfin && (
                          <span className="flex items-center gap-1 text-[#00A4DC]">
                            <JellyfinIcon className="size-3.5" />
                            Jellyfin
                          </span>
                        )}
                      </div>
                      {movie.overview && (
                        <p className="text-white/50 text-xs mt-2 line-clamp-2">{movie.overview}</p>
                      )}
                    </div>
                  </Link>
                </motion.article>
              ))}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => void suggest()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  Un autre
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
