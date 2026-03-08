"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Play, Loader2, AlertCircle, ChevronDown, ChevronUp,
  HardDrive, Users, MoreVertical, ExternalLink, Download,
} from "lucide-react";
import { cn, getLanguageFlag } from "@/lib/utils";
import { useStream } from "@/providers/stream-provider";
import { downloadM3U } from "@/lib/m3u";
import type { ParsedStream, StreamQuality, StreamLanguage } from "@/types/stremio";

// ── Logos ─────────────────────────────────────────────────────────────────────

function JellyfinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-8", className)} aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1 4h2v6h-2V8zm0 8h2v2h-2v-2z" />
    </svg>
  );
}

function VLCLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="512" height="512" rx="115" fill="#FF8800" />
      <ellipse cx="256" cy="340" rx="145" ry="18" fill="rgba(0,0,0,0.25)" />
      <path d="M256 72 L390 330 H122 Z" fill="white" />
      <path d="M256 72 L390 330 H256 Z" fill="rgba(0,0,0,0.12)" />
      <rect x="108" y="338" width="296" height="36" rx="8" fill="white" />
      <rect x="130" y="384" width="252" height="28" rx="7" fill="white" opacity="0.7" />
      <rect x="155" y="422" width="202" height="22" rx="6" fill="white" opacity="0.45" />
    </svg>
  );
}

// ── Constantes qualité / langue ───────────────────────────────────────────────

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

// ── AdvancedSheet — options avancées pour une source ────────────────────────

interface AdvancedSheetProps {
  stream: ParsedStream;
  title?: string;
  onClose: () => void;
  onDownloadToJellyfin?: (stream: ParsedStream) => void;
}

function AdvancedSheet({ stream, title, onClose, onDownloadToJellyfin }: AdvancedSheetProps) {
  const handleOpenInVLC = () => {
    window.location.href = `vlc://${stream.url}`;
    onClose();
  };

  const handleDownloadM3U = () => {
    downloadM3U(stream, title ?? undefined);
    onClose();
  };

  const handleDownloadOffline = () => {
    const a = document.createElement("a");
    a.href = stream.url;
    a.download = (title ?? "film").replace(/[^a-z0-9]/gi, "_");
    a.click();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute inset-x-0 bottom-0 z-10 rounded-b-2xl bg-[#0a0d14] border-t border-white/8 p-3 space-y-1.5"
    >
      <button
        type="button"
        onClick={handleOpenInVLC}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors text-left"
      >
        <VLCLogo size={20} />
        <div>
          <span className="text-white/80 text-sm font-medium block">Ouvrir dans VLC</span>
          <span className="text-white/30 text-xs">Lance le stream dans l&apos;application VLC</span>
        </div>
      </button>

      <button
        type="button"
        onClick={handleDownloadM3U}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors text-left"
      >
        <ExternalLink className="size-5 text-white/40 shrink-0" />
        <span className="text-white/70 text-sm">Télécharger .m3u</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadOffline}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors text-left"
      >
        <Download className="size-5 text-white/40 shrink-0" />
        <span className="text-white/70 text-sm">Télécharger hors-ligne</span>
      </button>

      {onDownloadToJellyfin && (
        <button
          type="button"
          onClick={() => { onDownloadToJellyfin(stream); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#00a4dc]/8 transition-colors text-left"
        >
          <JellyfinLogo className="size-5 text-[#00a4dc]" />
          <div>
            <span className="text-white/80 text-sm font-medium block">Envoyer sur Jellyfin</span>
            <span className="text-white/30 text-xs">Télécharge directement sur ton NAS</span>
          </div>
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2 text-white/30 hover:text-white/60 text-xs transition-colors"
      >
        Annuler
      </button>
    </motion.div>
  );
}

// ── StreamCard ────────────────────────────────────────────────────────────────

interface StreamCardProps {
  stream: ParsedStream;
  onSelect: (stream: ParsedStream) => void;
  onAdvanced: (stream: ParsedStream) => void;
}

function StreamCard({ stream, onSelect, onAdvanced }: StreamCardProps) {
  const sourceIcon = stream.source ? (SOURCE_ICONS[stream.source] ?? "📦") : null;

  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={() => onSelect(stream)}
        className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-white/6 hover:border-nemo-accent/30 hover:bg-nemo-accent/5 transition-all text-left"
      >
        <span className={cn("shrink-0 w-14 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums", QUALITY_COLORS[stream.quality])}>
          {stream.quality}
        </span>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold", LANG_COLORS[stream.language])}>
              {getLanguageFlag(stream.language)} {stream.language}
            </span>
            {stream.codec && (
              <span className="text-white/40 text-xs border border-white/15 px-1.5 py-0.5 rounded">{stream.codec}</span>
            )}
            {stream.hdr && stream.hdr !== "SDR" && (
              <span className="text-purple-300 text-xs border border-purple-400/30 bg-purple-400/10 px-1.5 py-0.5 rounded">{stream.hdr}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/35">
            {stream.source && <span className="flex items-center gap-1">{sourceIcon} {stream.source}</span>}
            {stream.sizeLabel && <span className="flex items-center gap-1 tabular-nums"><HardDrive className="size-3" />{stream.sizeLabel}</span>}
            {stream.seeders !== null && <span className="flex items-center gap-1 tabular-nums"><Users className="size-3" />{stream.seeders}</span>}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-white/0 group-hover:bg-nemo-accent text-white/0 group-hover:text-black transition-all duration-200">
          <Play className="size-3.5 fill-current ml-0.5" />
        </div>
      </button>

      {/* Bouton options avancées */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAdvanced(stream); }}
        className="shrink-0 flex items-center justify-center size-8 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/6 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Options avancées"
      >
        <MoreVertical className="size-4" />
      </button>
    </div>
  );
}

// ── StreamModal ───────────────────────────────────────────────────────────────

interface StreamModalProps {
  open: boolean;
  onClose: () => void;
  onSelectStream: (stream: ParsedStream) => void;
  onDownloadToJellyfin?: (stream: ParsedStream) => void;
  title?: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
}

export function StreamModal({ open, onClose, onSelectStream, onDownloadToJellyfin, title, tmdbId: _tmdbId, mediaType: _mediaType }: StreamModalProps) {
  const { state } = useStream();
  const [showAll, setShowAll] = useState(false);
  const [advancedStream, setAdvancedStream] = useState<ParsedStream | null>(null);

  const displayedStreams = showAll ? state.streams : state.streams.slice(0, 8);
  const hasMore = state.streams.length > 8;

  const handleSelect = (stream: ParsedStream) => {
    onSelectStream(stream);
    onClose();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setAdvancedStream(null);
      setShowAll(false);
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
                className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-(--z-modal) w-full sm:w-135 max-h-[80dvh] flex flex-col rounded-2xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div className="min-w-0">
                    <Dialog.Title className="text-white font-semibold text-base leading-tight">
                      Sources disponibles
                    </Dialog.Title>
                    {title && <p className="text-white/40 text-sm truncate mt-0.5">{title}</p>}
                  </div>
                  <Dialog.Close asChild>
                    <button aria-label="Fermer" className="ml-3 shrink-0 flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors">
                      <X className="size-4 text-white/60" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Corps */}
                <div className="relative overflow-y-auto flex-1 p-4 space-y-2" id="stream-modal-desc">
                  {state.isLoading && (
                    <div className="flex flex-col items-center justify-center py-14 gap-3">
                      <Loader2 className="size-7 text-nemo-accent animate-spin" />
                      <p className="text-white/50 text-sm">Recherche des sources…</p>
                    </div>
                  )}
                  {state.error && !state.isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <AlertCircle className="size-7 text-nemo-red" />
                      <p className="text-white/80 font-medium text-sm">Erreur de résolution</p>
                      <p className="text-white/40 text-xs max-w-xs leading-relaxed">{state.error}</p>
                    </div>
                  )}
                  {!state.isLoading && !state.error && state.streams.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                      <p className="text-white/60 font-medium text-sm">Aucune source trouvée</p>
                      <p className="text-white/30 text-xs max-w-xs">Aucun flux disponible pour ce contenu.</p>
                    </div>
                  )}
                  {!state.isLoading && state.streams.length > 0 && (
                    <>
                      <p className="text-white/30 text-xs tabular-nums pb-1">
                        {state.streams.length} source{state.streams.length > 1 ? "s" : ""} — cliquer pour lire
                      </p>
                      {displayedStreams.map((stream) => (
                        <StreamCard
                          key={stream.id}
                          stream={stream}
                          onSelect={handleSelect}
                          onAdvanced={setAdvancedStream}
                        />
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
                </div>

                {/* Options avancées (mini-sheet glissante) */}
                <AnimatePresence>
                  {advancedStream && (
                    <AdvancedSheet
                      stream={advancedStream}
                      title={title}
                      onClose={() => setAdvancedStream(null)}
                      onDownloadToJellyfin={onDownloadToJellyfin}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
