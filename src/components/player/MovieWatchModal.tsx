"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { StreamModal } from "@/components/player/StreamModal";
import { DownloadModal } from "@/components/download/DownloadModal";
import { useMovieDetail } from "@/hooks/use-tmdb";
import { useStream } from "@/providers/stream-provider";
import { useProfile } from "@/hooks/use-profile";
import type { ParsedStream } from "@/types/stremio";

interface MovieWatchModalProps {
  open: boolean;
  onClose: () => void;
  movieId: number;
  /** Optionnel : si fourni, utilisé à la place du callback interne (vip/admin). */
  onDownloadToJellyfin?: (stream: ParsedStream) => void;
}

/**
 * Ouvre le modal "Comment regarder ?" à partir d'un TMDB movie id.
 * Charge le détail du film, résout les streams, affiche StreamModal.
 */
export function MovieWatchModal({ open, onClose, movieId, onDownloadToJellyfin: onDownloadToJellyfinProp }: MovieWatchModalProps) {
  const { data: movie, isLoading: movieLoading } = useMovieDetail(open && movieId > 0 ? movieId : 0);
  const { resolveStreams } = useStream();
  const { data: profile } = useProfile();

  const canDownloadJellyfin = profile?.role === "vip" || profile?.role === "admin";
  const [jellyfinStream, setJellyfinStream] = useState<ParsedStream | null>(null);

  const handleDownloadToJellyfin = canDownloadJellyfin
    ? (stream: ParsedStream) => {
        onClose();
        if (onDownloadToJellyfinProp) {
          onDownloadToJellyfinProp(stream);
        } else {
          setJellyfinStream(stream);
        }
      }
    : undefined;

  useEffect(() => {
    if (open && movie?.imdb_id) {
      void resolveStreams(movie.imdb_id, "movie");
    }
  }, [open, movie?.imdb_id, resolveStreams]);

  if (!open || movieId <= 0) return null;

  const loading = movieLoading || !movie;
  if (loading) {
    return (
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal forceMount>
          <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-black/70 backdrop-blur-md" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-(--z-modal) flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0e1018] border border-white/8 px-8 py-10 min-w-50"
            aria-describedby={undefined}
          >
            {/* Radix exige un Dialog.Title pour l'accessibilité */}
            <Dialog.Title className="sr-only">Chargement…</Dialog.Title>
            <Loader2 className="size-8 animate-spin text-white/50" aria-hidden />
            <p className="text-white/70 text-sm">Chargement…</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  const title = movie.title ?? "";

  const downloadMediaInfo =
    jellyfinStream && movie
      ? {
          streamUrl: jellyfinStream.url,
          title: movie.title ?? "",
          type: "movie" as const,
          year: movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : undefined,
          tmdbId: movie.id,
        }
      : null;

  return (
    <>
      <StreamModal
        open={open}
        onClose={onClose}
        title={title}
        tmdbId={movie.id}
        mediaType="movie"
        onDownloadToJellyfin={handleDownloadToJellyfin}
      />
      {downloadMediaInfo && (
        <DownloadModal
          open
          onClose={() => setJellyfinStream(null)}
          mediaInfo={downloadMediaInfo}
        />
      )}
    </>
  );
}
