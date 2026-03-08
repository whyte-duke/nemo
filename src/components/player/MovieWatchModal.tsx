"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { StreamModal } from "@/components/player/StreamModal";
import { NemoPlayer } from "@/components/player/NemoPlayer";
import { saveLastStream, getLastStream } from "@/lib/player/last-stream";
import { useMovieDetail } from "@/hooks/use-tmdb";
import { useStream } from "@/providers/stream-provider";
import { useItemProgress } from "@/hooks/use-watch-history";
import { tmdbImage } from "@/lib/tmdb/client";
import type { ParsedStream } from "@/types/stremio";

interface MovieWatchModalProps {
  open: boolean;
  onClose: () => void;
  movieId: number;
  onDownloadToJellyfin?: (stream: ParsedStream) => void;
}

/**
 * Ouvre le modal "Comment regarder ?" (Jellyfin, streaming, sources torrent)
 * à partir d'un seul TMDB movie id. Charge le détail, la dispo Jellyfin et
 * les options de streaming, puis affiche le même flux que la page détail film.
 */
export function MovieWatchModal({ open, onClose, movieId, onDownloadToJellyfin }: MovieWatchModalProps) {
  const { data: movie, isLoading: movieLoading } = useMovieDetail(open && movieId > 0 ? movieId : 0);
  const { resolveStreams } = useStream();
  const historyEntry = useItemProgress(movieId, "movie");

  // Precise resume position (seconds) from last_position_seconds, fallback to percentage
  const resumeTime = historyEntry
    ? ((historyEntry as { last_position_seconds?: number | null }).last_position_seconds ??
        (historyEntry.progress > 0 && historyEntry.duration
          ? Math.floor((historyEntry.progress / 100) * historyEntry.duration)
          : 0))
    : 0;

  const [activeStream, setActiveStream] = useState<{ url: string; title: string; tmdbId?: number; startTime?: number } | null>(null);

  // Resume direct — skip StreamModal if user has progress and a known last source
  useEffect(() => {
    if (!open) return;
    const hasProgress = historyEntry && historyEntry.progress > 5;
    const lastUrl = hasProgress ? getLastStream(movieId, "movie") : null;
    if (lastUrl && movie) {
      onClose();
      setActiveStream({ url: lastUrl, title: movie.title ?? "", tmdbId: movie.id, startTime: resumeTime });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, movie]);

  useEffect(() => {
    if (open && movie?.imdb_id) {
      void resolveStreams(movie.imdb_id, "movie");
    }
  }, [open, movie?.imdb_id, resolveStreams]);

  // ── VideoPlayer fullscreen — vérifié EN PREMIER, indépendamment de `open` ──
  // Quand onPlayStream est appelé, onClose() ferme le modal (open → false)
  // puis activeStream est défini. On doit afficher le player même si open=false.
  if (activeStream) {
    return (
      <div className="fixed inset-0 z-(--z-overlay) bg-black">
        <NemoPlayer
          url={activeStream.url}
          title={activeStream.title}
          poster={movie?.backdrop_path ? (tmdbImage.backdrop(movie.backdrop_path, "w1280") ?? undefined) : undefined}
          tmdbId={activeStream.tmdbId}
          mediaType="movie"
          startTime={activeStream.startTime}
          onBack={() => setActiveStream(null)}
          onChangeSource={() => { setActiveStream(null); }}
          className="w-full h-full"
        />
      </div>
    );
  }

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

  return (
    <StreamModal
      open={open}
      onClose={onClose}
      title={title}
      tmdbId={movie.id}
      mediaType="movie"
      onSelectStream={(stream) => {
        onClose();
        saveLastStream(movie.id, "movie", stream.url);
        setActiveStream({ url: stream.url, title, tmdbId: movie.id, startTime: resumeTime });
      }}
      onDownloadToJellyfin={onDownloadToJellyfin}
    />
  );
}
