"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X, Play, Loader2, AlertCircle, ChevronDown, ChevronUp,
  HardDrive, Users, ArrowLeft, ThumbsUp, ThumbsDown, Check,
  HelpCircle, Smartphone, Monitor, Download,
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

// ── Détection plateforme ──────────────────────────────────────────────────────

type DeviceType = "mobile" | "desktop";

function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop");
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod|Android/i.test(ua)) setDevice("mobile");
  }, []);
  return device;
}

// ── Popup "Besoin d'aide" ─────────────────────────────────────────────────────

function HelpPopup({ open, onClose, m3uUrl, title }: {
  open: boolean;
  onClose: () => void;
  m3uUrl: string | null;
  title?: string;
}) {
  const device = useDeviceType();
  const isMobile = device === "mobile";

  const vlcMobileUrl = /iPhone|iPad|iPod/.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  )
    ? "https://apps.apple.com/fr/app/vlc-for-mobile/id650377962"
    : "https://play.google.com/store/apps/details?id=org.videolan.vlc";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[calc(var(--z-modal)+1)] bg-black/70 backdrop-blur-sm"
                onClick={onClose}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-[calc(var(--z-modal)+1)] w-full sm:w-110 max-h-[80dvh] overflow-y-auto rounded-2xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="size-4.5 text-nemo-accent" />
                    <Dialog.Title className="text-white font-semibold text-base">
                      Comment regarder ?
                    </Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <button aria-label="Fermer" className="size-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                      <X className="size-4 text-white/60" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="p-5 space-y-5">
                  {/* Onglets mobile / desktop */}
                  <div className="flex gap-2 p-1 rounded-xl bg-white/5">
                    <div className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors", isMobile ? "bg-white/10 text-white" : "text-white/40")}>
                      <Smartphone className="size-4" /> Mobile
                    </div>
                    <div className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors", !isMobile ? "bg-white/10 text-white" : "text-white/40")}>
                      <Monitor className="size-4" /> Ordinateur
                    </div>
                  </div>

                  {isMobile ? (
                    /* ── Guide mobile ── */
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">1</span>
                        <div>
                          <p className="text-white font-medium text-sm">Télécharge l&apos;app VLC</p>
                          <a
                            href={vlcMobileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg bg-[#FF8800]/15 border border-[#FF8800]/25 text-[#FF8800] text-xs font-semibold hover:bg-[#FF8800]/25 transition-colors"
                          >
                            <VLCLogo size={14} />
                            Télécharger VLC
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">2</span>
                        <div>
                          <p className="text-white font-medium text-sm">Clique sur &quot;Regarder via VLC&quot;</p>
                          <p className="text-white/45 text-xs mt-0.5">Le stream s&apos;ouvre automatiquement dans VLC.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">3</span>
                        <div>
                          <p className="text-white font-medium text-sm">Profite !</p>
                          <p className="text-white/45 text-xs mt-0.5">Reviens ici pour noter le film une fois terminé.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ── Guide desktop ── */
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">1</span>
                        <div>
                          <p className="text-white font-medium text-sm">Télécharge VLC</p>
                          <a
                            href="https://www.videolan.org/vlc/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg bg-[#FF8800]/15 border border-[#FF8800]/25 text-[#FF8800] text-xs font-semibold hover:bg-[#FF8800]/25 transition-colors"
                          >
                            <VLCLogo size={14} />
                            videolan.org
                          </a>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">2</span>
                        <div>
                          <p className="text-white font-medium text-sm">Clique sur &quot;Regarder via VLC&quot;</p>
                          <p className="text-white/45 text-xs mt-0.5 leading-relaxed">
                            VLC s&apos;ouvre directement avec le stream. Si ça ne fonctionne pas, clique sur &quot;Télécharger .m3u&quot; puis fais clic droit sur le fichier → <span className="text-white/70">Ouvrir avec VLC</span>.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="shrink-0 size-6 rounded-full bg-nemo-accent/20 text-nemo-accent text-xs font-bold flex items-center justify-center">3</span>
                        <div>
                          <p className="text-white font-medium text-sm">Profite !</p>
                          <p className="text-white/45 text-xs mt-0.5">Reviens ici pour noter le film une fois terminé.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note finale */}
                  <p className="text-white/25 text-xs text-center pt-1">
                    Streaming direct — aucun fichier téléchargé sur ton appareil
                  </p>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
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

// ── StreamCard ────────────────────────────────────────────────────────────────

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

      <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-white/0 group-hover:bg-white/90 text-white/0 group-hover:text-black transition-all duration-200">
        <Play className="size-3.5 fill-current ml-0.5" />
      </div>
    </button>
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

export function StreamModal({ open, onClose, onSelectStream, onDownloadToJellyfin, title, tmdbId, mediaType }: StreamModalProps) {
  const { state } = useStream();
  const [showAll, setShowAll] = useState(false);
  const [selectedStream, setSelectedStream] = useState<ParsedStream | null>(null);
  const [vlcLaunched, setVlcLaunched] = useState(false);
  const [ratingDone, setRatingDone] = useState<"like" | "dislike" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const displayedStreams = showAll ? state.streams : state.streams.slice(0, 8);
  const hasMore = state.streams.length > 8;

  const handleSelectSource = (stream: ParsedStream) => {
    setSelectedStream(stream);
    setVlcLaunched(false);
    setRatingDone(null);
  };

  const handlePlayInBrowser = () => {
    if (selectedStream) {
      onSelectStream(selectedStream);
      setSelectedStream(null);
      onClose();
    }
  };

  const handleOpenInVLC = () => {
    if (!selectedStream) return;
    window.location.href = `vlc://${selectedStream.url}`;
    setVlcLaunched(true);
  };

  const handleDownloadM3U = () => {
    if (!selectedStream) return;
    downloadM3U(selectedStream, title ?? undefined);
  };

  const handleDownloadOffline = () => {
    if (!selectedStream) return;
    // Télécharge directement l'URL du flux
    const a = document.createElement("a");
    a.href = selectedStream.url;
    a.download = (title ?? "film").replace(/[^a-z0-9]/gi, "_");
    a.click();
  };

  const handleRate = async (type: "like" | "dislike") => {
    setRatingDone(type);
    if (tmdbId && mediaType) {
      try {
        await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId, mediaType, type }),
        });
      } catch {
        // continue anyway
      }
    }
    setTimeout(() => {
      setSelectedStream(null);
      setVlcLaunched(false);
      setRatingDone(null);
      onClose();
    }, 900);
  };

  const handleBackToSources = () => {
    setSelectedStream(null);
    setVlcLaunched(false);
    setRatingDone(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedStream(null);
      setVlcLaunched(false);
      setRatingDone(null);
      onClose();
    }
  };

  return (
    <>
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
                        {selectedStream ? "Comment regarder ?" : "Sources disponibles"}
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
                  <div className="overflow-y-auto flex-1 p-4 space-y-2" id="stream-modal-desc">
                    {selectedStream ? (
                      <div className="space-y-3">
                        {!vlcLaunched && (
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={handleBackToSources}
                              className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
                            >
                              <ArrowLeft className="size-4" />
                              Retour aux sources
                            </button>
                            <button
                              type="button"
                              onClick={() => setHelpOpen(true)}
                              className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-xs transition-colors"
                            >
                              <HelpCircle className="size-3.5" />
                              Besoin d&apos;aide ?
                            </button>
                          </div>
                        )}

                        <AnimatePresence mode="wait">
                          {vlcLaunched ? (
                            /* ── État : VLC lancé → noter ── */
                            <motion.div
                              key="vlc-launched"
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="flex flex-col items-center text-center gap-5 py-6"
                            >
                              <div style={{ filter: "drop-shadow(0 0 16px rgba(255,136,0,0.4))" }}>
                                <VLCLogo size={56} />
                              </div>

                              <div className="space-y-1">
                                <p className="text-white font-bold text-lg">C&apos;est lancé !</p>
                                <p className="text-white/50 text-sm">Reviens ici pour noter le film</p>
                              </div>

                              <div className="flex gap-4">
                                <button
                                  type="button"
                                  onClick={() => void handleRate("like")}
                                  disabled={ratingDone !== null}
                                  className={cn(
                                    "flex flex-col items-center gap-1.5 px-6 py-4 rounded-2xl border transition-all",
                                    ratingDone === "like"
                                      ? "bg-green-500/20 border-green-500/40 text-green-400 scale-105"
                                      : ratingDone === "dislike"
                                      ? "opacity-30 border-white/10 text-white/30 cursor-not-allowed"
                                      : "border-white/12 hover:border-green-500/40 hover:bg-green-500/10 hover:text-green-400 text-white/60 cursor-pointer"
                                  )}
                                >
                                  {ratingDone === "like" ? <Check className="size-7 text-green-400" /> : <ThumbsUp className="size-7" />}
                                  <span className="text-xs font-medium">J&apos;ai aimé</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleRate("dislike")}
                                  disabled={ratingDone !== null}
                                  className={cn(
                                    "flex flex-col items-center gap-1.5 px-6 py-4 rounded-2xl border transition-all",
                                    ratingDone === "dislike"
                                      ? "bg-red-500/20 border-red-500/40 text-red-400 scale-105"
                                      : ratingDone === "like"
                                      ? "opacity-30 border-white/10 text-white/30 cursor-not-allowed"
                                      : "border-white/12 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 text-white/60 cursor-pointer"
                                  )}
                                >
                                  {ratingDone === "dislike" ? <Check className="size-7 text-red-400" /> : <ThumbsDown className="size-7" />}
                                  <span className="text-xs font-medium">Pas mon truc</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => { setSelectedStream(null); setVlcLaunched(false); onClose(); }}
                                className="text-white/30 hover:text-white/60 text-xs transition-colors"
                              >
                                Fermer sans noter
                              </button>
                            </motion.div>
                          ) : (
                            /* ── État : choisir comment regarder ── */
                            <motion.div
                              key="action-select"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="grid gap-2 pt-1"
                            >
                              {/* Navigateur — option principale */}
                              <button
                                type="button"
                                onClick={handlePlayInBrowser}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-nemo-accent/30 bg-nemo-accent/5 hover:border-nemo-accent/50 hover:bg-nemo-accent/10 transition-all text-left"
                              >
                                <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-nemo-accent/20">
                                  <Play className="size-6 text-nemo-accent fill-current" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-white">Lire maintenant</span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-nemo-accent/15 border border-nemo-accent/25 text-nemo-accent text-[11px] font-semibold">Recommandé</span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[11px] font-semibold">Reprendre où tu en es</span>
                                  </div>
                                  <span className="text-white/40 text-sm">Lecture directe dans le navigateur, sans installation</span>
                                </div>
                              </button>

                              {/* VLC — option secondaire */}
                              <button
                                type="button"
                                onClick={handleOpenInVLC}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all text-left"
                              >
                                <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-white/8">
                                  <VLCLogo size={28} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-white/80 block">Ouvrir dans VLC</span>
                                  <span className="text-white/35 text-sm">Lance le stream dans l&apos;application VLC</span>
                                </div>
                              </button>

                              {/* Fallback .m3u + téléchargement hors-ligne */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleDownloadM3U}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/8 hover:border-white/15 hover:bg-white/5 text-white/45 hover:text-white/70 text-xs transition-all"
                                >
                                  Télécharger .m3u
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDownloadOffline}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/8 hover:border-white/15 hover:bg-white/5 text-white/45 hover:text-white/70 text-xs transition-all"
                                >
                                  <Download className="size-3.5" />
                                  Télécharger hors-ligne
                                </button>
                              </div>

                              {/* Jellyfin */}
                              {onDownloadToJellyfin ? (
                                <button
                                  type="button"
                                  onClick={() => { onDownloadToJellyfin(selectedStream); setSelectedStream(null); onClose(); }}
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
                                <button type="button" disabled className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/6 bg-white/5 opacity-50 cursor-not-allowed text-left">
                                  <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-[#00a4dc]/20 text-[#00a4dc]">
                                    <JellyfinLogo className="text-[#00a4dc]" />
                                  </div>
                                  <div>
                                    <span className="font-medium text-white/60 block">Télécharger sur Jellyfin</span>
                                    <span className="text-white/30 text-sm">Non disponible pour ce contenu</span>
                                  </div>
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <>
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

      {/* Popup d'aide */}
      <HelpPopup
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        m3uUrl={selectedStream?.url ?? null}
        title={title}
      />
    </>
  );
}
