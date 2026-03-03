"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Play, Loader2, AlertCircle, ChevronDown, ChevronUp, HardDrive, Users, ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { cn, getLanguageFlag } from "@/lib/utils";
import { useStream } from "@/providers/stream-provider";
import { downloadM3U } from "@/lib/m3u";
import type { ParsedStream, StreamQuality, StreamLanguage } from "@/types/stremio";

// Logos simples inline (remplaçables par des assets plus tard)
function JellyfinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-8", className)} aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1 4h2v6h-2V8zm0 8h2v2h-2v-2z" />
    </svg>
  );
}

function VLCLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-8", className)} aria-hidden>
      {/* Cône VLC simplifié */}
      <path fill="currentColor" d="M12 2L4 20h16L12 2zm0 4.5l4.5 11h-9L12 6.5z" />
    </svg>
  );
}

const QUALITY_COLORS: Record<StreamQuality, string> = {
  "4K":    "text-[#e8b84b] border-[#e8b84b]/40 bg-[#e8b84b]/10",
  "1080p": "text-blue-400  border-blue-400/40  bg-blue-400/10",
  "720p":  "text-green-400 border-green-400/40 bg-green-400/10",
  "480p":  "text-white/50  border-white/20     bg-white/5",
  "SD":    "text-white/30  border-white/10     bg-white/5",
};

const LANG_COLORS: Record<StreamLanguage, string> = {
  MULTI:  "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  VF:     "text-blue-300   border-blue-300/40   bg-blue-300/10",
  VFF:    "text-blue-300   border-blue-300/40   bg-blue-300/10",
  VOSTFR: "text-violet-400 border-violet-400/40 bg-violet-400/10",
  VO:     "text-white/50   border-white/20      bg-white/5",
};

const SOURCE_ICONS: Record<string, string> = {
  Yggflix:   "🎬",
  Yggtorrent:"🌿",
  YGG:       "🌿",
  Sharewood: "🪵",
  Zilean:    "⚡",
  AllDebrid: "⚡",
  RealDebrid:"🔴",
};

interface StreamCardProps {
  stream: ParsedStream;
  onSelect: (stream: ParsedStream) => void;
}

function StreamCard({ stream, onSelect }: StreamCardProps) {
  const sourceIcon = stream.source ? (SOURCE_ICONS[stream.source] ?? "📦") : null;

  return (
    <button
      onClick={() => onSelect(stream)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/6 hover:border-white/15 hover:bg-white/5 transition-all text-left group"
    >
      {/* Badge qualité */}
      <span
        className={cn(
          "shrink-0 w-14 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums",
          QUALITY_COLORS[stream.quality]
        )}
      >
        {stream.quality}
      </span>

      {/* Infos principales */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Ligne 1 : langue + codec + HDR */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold",
              LANG_COLORS[stream.language]
            )}
          >
            {getLanguageFlag(stream.language)} {stream.language}
          </span>
          {stream.codec && (
            <span className="text-white/40 text-xs border border-white/15 px-1.5 py-0.5 rounded">
              {stream.codec}
            </span>
          )}
          {stream.hdr && stream.hdr !== "SDR" && (
            <span className="text-purple-300 text-xs border border-purple-400/30 bg-purple-400/10 px-1.5 py-0.5 rounded">
              {stream.hdr}
            </span>
          )}
        </div>

        {/* Ligne 2 : source + poids + seeders */}
        <div className="flex items-center gap-3 text-xs text-white/35">
          {stream.source && (
            <span className="flex items-center gap-1">
              {sourceIcon} {stream.source}
            </span>
          )}
          {stream.sizeLabel && (
            <span className="flex items-center gap-1 tabular-nums">
              <HardDrive className="size-3" />
              {stream.sizeLabel}
            </span>
          )}
          {stream.seeders !== null && (
            <span className="flex items-center gap-1 tabular-nums">
              <Users className="size-3" />
              {stream.seeders}
            </span>
          )}
        </div>
      </div>

      {/* Bouton play */}
      <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-white/0 group-hover:bg-white/90 text-white/0 group-hover:text-black transition-all duration-200">
        <Play className="size-3.5 fill-current ml-0.5" />
      </div>
    </button>
  );
}

interface StreamModalProps {
  open: boolean;
  onClose: () => void;
  onSelectStream: (stream: ParsedStream) => void;
  onDownloadToJellyfin?: (stream: ParsedStream) => void;
  title?: string;
}

export function StreamModal({ open, onClose, onSelectStream, onDownloadToJellyfin, title }: StreamModalProps) {
  const { state } = useStream();
  const [showAll, setShowAll] = useState(false);
  const [selectedStream, setSelectedStream] = useState<ParsedStream | null>(null);

  const displayedStreams = showAll ? state.streams : state.streams.slice(0, 8);
  const hasMore = state.streams.length > 8;

  const handleSelectSource = (stream: ParsedStream) => {
    setSelectedStream(stream);
  };

  const handlePlayInBrowser = () => {
    if (selectedStream) {
      onSelectStream(selectedStream);
      setSelectedStream(null);
      onClose();
    }
  };

  const handleVLC = () => {
    if (!selectedStream) return;
    downloadM3U(selectedStream, title ?? undefined);
    setSelectedStream(null);
    onClose();
  };

  const handleOpenInVLC = () => {
    if (!selectedStream) return;
    window.location.href = `vlc://${selectedStream.url}`;
  };

  const handleCopyStreamUrl = async () => {
    if (!selectedStream) return;
    try {
      await navigator.clipboard.writeText(selectedStream.url);
    } catch {
      // fallback non sécurisé si clipboard non dispo
    }
  };

  const handleBackToSources = () => setSelectedStream(null);

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedStream(null);
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-(--z-modal) bg-black/80 backdrop-blur-sm"
                onClick={onClose}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby="stream-modal-desc">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-(--z-modal) w-full sm:w-135 max-h-[80dvh] flex flex-col rounded-2xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div className="min-w-0">
                    <Dialog.Title className="text-white font-semibold text-base leading-tight">
                      Sources disponibles
                    </Dialog.Title>
                    {title && (
                      <p className="text-white/40 text-sm truncate mt-0.5">{title}</p>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      aria-label="Fermer"
                      className="ml-3 shrink-0 flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="size-4 text-white/60" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Corps scrollable */}
                <div className="overflow-y-auto flex-1 p-4 space-y-2" id="stream-modal-desc">
                  {/* Écran : Choisir comment lire (après clic sur une source) */}
                  {selectedStream ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleBackToSources}
                        className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
                      >
                        <ArrowLeft className="size-4" />
                        Retour aux sources
                      </button>
                      <p className="text-white/40 text-xs line-clamp-2">{selectedStream.name}</p>

                      <div className="grid gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handlePlayInBrowser}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-left"
                        >
                          <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-white/10">
                            <Play className="size-6 text-nemo-accent fill-current" />
                          </div>
                          <div>
                            <span className="font-medium text-white block">Lire dans le navigateur</span>
                            <span className="text-white/40 text-sm">Lecture directe sur cette page</span>
                          </div>
                        </button>

                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <button
                            type="button"
                            onClick={handleVLC}
                            className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all text-left"
                          >
                            <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-orange-500/20 text-orange-400">
                              <VLCLogo className="text-orange-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-white block">Lire maintenant</span>
                              <span className="text-white/40 text-sm">
                                Télécharge un .m3u nommé d&apos;après le film, lisible dans VLC (flux réseau)
                              </span>
                            </div>
                          </button>
                          <div className="flex border-t border-white/8">
                            <button
                              type="button"
                              onClick={handleOpenInVLC}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-orange-400/90 hover:text-orange-400 hover:bg-white/5 text-xs transition-colors"
                            >
                              <ExternalLink className="size-3.5" />
                              Ouvrir avec VLC
                            </button>
                            <span className="w-px bg-white/10" aria-hidden />
                            <button
                              type="button"
                              onClick={handleCopyStreamUrl}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white/50 hover:text-white/80 hover:bg-white/5 text-xs transition-colors"
                            >
                              <Copy className="size-3.5" />
                              Copier le lien
                            </button>
                          </div>
                        </div>

                        {onDownloadToJellyfin ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDownloadToJellyfin(selectedStream);
                              setSelectedStream(null);
                              onClose();
                            }}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#00a4dc]/25 hover:border-[#00a4dc]/50 hover:bg-[#00a4dc]/8 transition-all text-left"
                          >
                            <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-[#00a4dc]/20 text-[#00a4dc]">
                              <JellyfinLogo className="text-[#00a4dc]" />
                            </div>
                            <div>
                              <span className="font-medium text-white block">Télécharger sur Jellyfin</span>
                              <span className="text-white/40 text-sm">Envoie le fichier directement sur ton NAS</span>
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/6 bg-white/5 opacity-50 cursor-not-allowed text-left"
                          >
                            <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-[#00a4dc]/20 text-[#00a4dc]">
                              <JellyfinLogo className="text-[#00a4dc]" />
                            </div>
                            <div>
                              <span className="font-medium text-white/60 block">Télécharger sur Jellyfin</span>
                              <span className="text-white/30 text-sm">Non disponible pour ce contenu</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Chargement */}
                      {state.isLoading && (
                        <div className="flex flex-col items-center justify-center py-14 gap-3">
                          <Loader2 className="size-7 text-nemo-accent animate-spin" />
                          <p className="text-white/50 text-sm">Recherche des sources…</p>
                        </div>
                      )}

                      {/* Erreur */}
                      {state.error && !state.isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                          <AlertCircle className="size-7 text-nemo-red" />
                          <p className="text-white/80 font-medium text-sm">Erreur de résolution</p>
                          <p className="text-white/40 text-xs max-w-xs leading-relaxed">{state.error}</p>
                        </div>
                      )}

                      {/* Vide */}
                      {!state.isLoading && !state.error && state.streams.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                          <p className="text-white/60 font-medium text-sm">Aucune source trouvée</p>
                          <p className="text-white/30 text-xs max-w-xs">
                            Aucun flux disponible pour ce contenu.
                          </p>
                        </div>
                      )}

                      {/* Liste des sources */}
                      {!state.isLoading && state.streams.length > 0 && (
                        <>
                          <p className="text-white/30 text-xs tabular-nums pb-1">
                            {state.streams.length} source{state.streams.length > 1 ? "s" : ""} — triées par qualité
                          </p>

                          {displayedStreams.map((stream) => (
                            <StreamCard key={stream.id} stream={stream} onSelect={handleSelectSource} />
                          ))}

                          {hasMore && (
                            <button
                              onClick={() => setShowAll((v) => !v)}
                              className="w-full flex items-center justify-center gap-1.5 py-3 text-white/40 hover:text-white/80 text-xs transition-colors"
                            >
                              {showAll ? (
                                <><ChevronUp className="size-3.5" /> Afficher moins</>
                              ) : (
                                <><ChevronDown className="size-3.5" /> {state.streams.length - 8} sources supplémentaires</>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
