"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Film, Tv, User } from "lucide-react";
import { useSearchMulti } from "@/hooks/use-tmdb";
import { tmdbImage } from "@/lib/tmdb/client";
import { formatYear } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FilterType = "all" | "movie" | "tv" | "person";

export function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  const { data, isFetching } = useSearchMulti(query);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const results = (data?.results ?? []).filter(
    (r) => filter === "all" || r.media_type === filter
  );

  const counts = {
    all: data?.results?.length ?? 0,
    movie: data?.results?.filter((r) => r.media_type === "movie").length ?? 0,
    tv: data?.results?.filter((r) => r.media_type === "tv").length ?? 0,
    person: data?.results?.filter((r) => r.media_type === "person").length ?? 0,
  };

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-12 py-10 space-y-8">
        {/* Barre de recherche principale */}
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <div className="flex items-center gap-3 glass-strong rounded-2xl px-5 py-4">
            <Search className="size-5 text-white/40 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un film, une série, un acteur..."
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-base outline-none"
              autoFocus
              autoComplete="off"
            />
          </div>
        </form>

        {/* Filtres */}
        {data && (
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "movie", "tv", "person"] as FilterType[]).map((f) => {
              const icons = { all: null, movie: Film, tv: Tv, person: User };
              const labels = { all: "Tout", movie: "Films", tv: "Séries", person: "Personnes" };
              const Icon = icons[f];
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    filter === f
                      ? "bg-white text-black"
                      : "glass text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                  {labels[f]}
                  <span className={cn(
                    "text-xs tabular-nums px-1.5 py-0.5 rounded-full",
                    filter === f ? "bg-black/20 text-black/70" : "bg-white/10 text-white/40"
                  )}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Résultats */}
        {isFetching && !data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
            ))}
          </div>
        )}

        {query.length >= 2 && data && results.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/60 text-lg">Aucun résultat pour &ldquo;{query}&rdquo;</p>
            <p className="text-white/30 text-sm mt-2">Essayez avec d&apos;autres mots-clés</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((result) => {
              const href =
                result.media_type === "movie"
                  ? `/film/${result.id}`
                  : result.media_type === "tv"
                    ? `/serie/${result.id}`
                    : `/acteur/${result.id}`;

              const imagePath =
                result.media_type === "person"
                  ? tmdbImage.profile(result.profile_path ?? null, "w185")
                  : tmdbImage.poster(result.poster_path ?? null, "w342");

              const title = result.title ?? result.name;
              const date = result.release_date ?? result.first_air_date;

              const typeLabel =
                result.media_type === "movie"
                  ? "Film"
                  : result.media_type === "tv"
                    ? "Série"
                    : result.known_for_department ?? "Personne";

              return (
                <Link key={`${result.media_type}-${result.id}`} href={href} className="group">
                  <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1a1e28] mb-3 shadow-lg">
                    {imagePath ? (
                      <Image
                        src={imagePath}
                        alt={title ?? ""}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 150px, 200px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-3">
                        <span className="text-white/20 text-xs text-center text-balance">{title}</span>
                      </div>
                    )}

                    {/* Badge type */}
                    <div className="absolute top-2 left-2">
                      <span className="glass px-2 py-0.5 rounded text-white/70 text-xs font-medium">
                        {typeLabel}
                      </span>
                    </div>
                  </div>

                  <p className="text-white/80 text-sm font-medium truncate group-hover:text-white transition-colors">
                    {title}
                  </p>
                  {date && (
                    <p className="text-white/40 text-xs">{formatYear(date)}</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* État vide initial */}
        {!query && (
          <div className="text-center py-20">
            <Search className="size-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 text-lg">Que cherchez-vous ?</p>
            <p className="text-white/30 text-sm mt-2">Films, séries, acteurs, réalisateurs...</p>
          </div>
        )}
      </div>
    </div>
  );
}
