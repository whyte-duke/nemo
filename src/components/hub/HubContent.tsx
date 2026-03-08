"use client";

import { useState, useCallback } from "react";
import { useInfiniteMoviesByProvider } from "@/hooks/use-tmdb";
import { MediaCard } from "@/components/media/MediaCard";
import { DetailModal } from "@/components/media/DetailModal";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { NemoPlayer } from "@/components/player/NemoPlayer";
import { ProviderLogo } from "@/components/ui/ProviderLogo";
import { useMovieDetail } from "@/hooks/use-tmdb";
import { Loader2 } from "lucide-react";
import type { TMDbMovieDetail } from "@/types/tmdb";

interface Props {
  providerId: number;
  providerName: string;
  providerSlug: string;
}

type MediaItem = { id: number; title?: string; name?: string; imdb_id?: string | null };

export function HubContent({ providerId, providerName, providerSlug }: Props) {
  const [detailId, setDetailId] = useState<number | null>(null);
  const [watchMovieId, setWatchMovieId] = useState<number | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteMoviesByProvider(providerId);

  const movieDetail = useMovieDetail(detailId ?? 0);

  const allMovies = data?.pages.flatMap((p) => p.results) ?? [];

  const handlePlay = useCallback((item: MediaItem) => {
    setWatchMovieId(item.id);
  }, []);

  if (activeStream) {
    return (
      <div className="fixed inset-0 z-[var(--z-overlay)] bg-black">
        <NemoPlayer
          url={activeStream}
          title={activeTitle}
          onBack={() => setActiveStream(null)}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
      {/* Header Hub */}
      <div className="relative py-16 px-6 sm:px-12 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(232,184,75,0.08)_0%,_transparent_70%)]" />
        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
          {providerSlug && (
            <ProviderLogo provider={providerSlug} size="lg" showBrandBackground ariaLabel={providerName} />
          )}
          <h1 className="text-4xl sm:text-5xl font-black text-white text-balance">
            {providerName}
          </h1>
        </div>
        <p className="relative text-white/50 text-lg">
          Les meilleurs films disponibles en France
        </p>
      </div>

      {/* Grille de films */}
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-12 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4">
              {allMovies.map((movie, index) => (
                <MediaCard
                  key={`${movie.id}-${index}`}
                  item={movie}
                  mediaType="movie"
                  size="md"
                  onPlay={(item) => void handlePlay(item as MediaItem)}
                  onMoreInfo={(item) => setDetailId(item.id)}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex items-center gap-2 glass hover:bg-white/10 text-white px-8 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : null}
                  {isFetchingNextPage ? "Chargement..." : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {detailId && (
        <DetailModal
          media={movieDetail.data as TMDbMovieDetail ?? null}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          mediaType="movie"
          onPlay={(media) => {
            setDetailId(null);
            handlePlay(media as MediaItem);
          }}
        />
      )}

      <MovieWatchModal
        open={watchMovieId !== null}
        onClose={() => setWatchMovieId(null)}
        movieId={watchMovieId ?? 0}
      />
    </div>
  );
}
