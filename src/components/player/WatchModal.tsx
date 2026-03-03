"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Clock,
  Copy,
  ExternalLink,
  Video,
  Music,
  Subtitles,
  FolderOpen,
  Play,
  TriangleAlert,
  Smartphone,
  Phone,
  Lock,
} from "lucide-react";
import { cn, getLanguageFlag } from "@/lib/utils";
import { useStream } from "@/providers/stream-provider";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useStartDownload } from "@/hooks/use-downloads";
import { downloadM3U } from "@/lib/m3u";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import type { ParsedStream, StreamQuality, StreamLanguage } from "@/types/stremio";
import type { StreamingOption } from "@/app/api/streaming/[imdbId]/route";
import type { ProbeStream, DownloadMediaInfo } from "@/types/download";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const QUALITY_SHORT: Record<string, string> = {
  uhd: "4K", qhd: "2K", hd: "HD", sd: "SD",
};

const TYPE_LABELS: Record<string, string> = {
  subscription: "Abonnement",
  free: "Gratuit",
  rent: "Location",
  buy: "Achat",
  addon: "Add-on",
};

const LANG_LABELS: Record<string, string> = {
  fre: "Français", fra: "Français",
  eng: "Anglais", spa: "Espagnol",
  ger: "Allemand", deu: "Allemand",
  ita: "Italien", por: "Portugais",
  jpn: "Japonais", chi: "Chinois", zho: "Chinois",
  kor: "Coréen", rus: "Russe", ara: "Arabe",
  und: "Indéterminée", "": "Inconnue",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function langLabel(code: string): string {
  return LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function sanitizeFilename(str: string): string {
  return str
    .replace(/[?/\\:*"<>|]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function generatePath(info: DownloadMediaInfo): string {
  const { type, title, year, seasonNumber, episodeNumber } = info;
  if (type === "movie") {
    const folderLabel = year ? `${title} (${year})` : title;
    const fileLabel = sanitizeFilename(year ? `${title}.${year}` : title);
    return `/mnt/nas/Films/${folderLabel}/${fileLabel}.mkv`;
  }
  const sNum = pad2(seasonNumber ?? 1);
  const eNum = pad2(episodeNumber ?? 1);
  const file = sanitizeFilename(title);
  return `/mnt/nas/Series/${title}/Saison ${sNum}/${file}.S${sNum}E${eNum}.mkv`;
}

// ─── View type ────────────────────────────────────────────────────────────────

type WatchView =
  | "options"
  | "vlc-sources"
  | "vlc-ready"
  | "jf-sources"
  | "jf-probing"
  | "jf-selecting"
  | "jf-submitting"
  | "jf-success"
  | "jf-error"
  | "jf-user-loading"
  | "jf-user-error"
  | "whatsapp";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WatchModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  jellyfinInLibrary?: boolean;
  jellyfinItemUrl?: string;
  /** ID Jellyfin de l'item (pour lecture directe via compte utilisateur). */
  jellyfinItemId?: string;
  streamingOptions?: StreamingOption[];
  mediaInfo: DownloadMediaInfo;
  /** Appelé quand l'utilisateur veut lire via son Jellyfin intégré. */
  onPlayStream?: (url: string, title: string, tmdbId?: number, mediaType?: "movie" | "tv", startTime?: number) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StreamRow({
  stream,
  onSelect,
}: {
  stream: ParsedStream;
  onSelect: (s: ParsedStream) => void;
}) {
  return (
    <button
      onClick={() => onSelect(stream)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/6 hover:border-white/18 hover:bg-white/5 transition-all text-left group"
    >
      <span
        className={cn(
          "shrink-0 w-14 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums",
          QUALITY_COLORS[stream.quality]
        )}
      >
        {stream.quality}
      </span>

      <div className="flex-1 min-w-0 space-y-1.5">
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
        <div className="flex items-center gap-3 text-xs text-white/30">
          {stream.source && <span>{stream.source}</span>}
          {stream.sizeLabel && <span>{stream.sizeLabel}</span>}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-center size-7 rounded-full bg-white/0 group-hover:bg-white/90 text-transparent group-hover:text-black transition-all duration-150">
        <Play className="size-3 fill-current ml-px" />
      </div>
    </button>
  );
}

// ── Ligne de source Jellyfin avec restriction 4K ──────────────────────────────
// Les admins peuvent tout télécharger.
// Pour les autres (vip) : les sources 4K sont grisées + suggestion VLC M3U.

function JfStreamRow({
  stream,
  canDownload4K,
  onSelect,
  onVlcFallback,
}: {
  stream: ParsedStream;
  canDownload4K: boolean;
  onSelect: (s: ParsedStream) => void;
  onVlcFallback: (s: ParsedStream) => void;
}) {
  const is4K = stream.quality === "4K";
  const blocked = is4K && !canDownload4K;

  if (!blocked) {
    return <StreamRow stream={stream} onSelect={onSelect} />;
  }

  return (
    <div className="rounded-xl border border-white/6 overflow-hidden">
      {/* Ligne grisée non-cliquable */}
      <div className="flex items-center gap-3 p-3 opacity-35 select-none">
        <span
          className={cn(
            "shrink-0 w-14 text-center px-2 py-1 rounded-lg border text-xs font-bold tabular-nums",
            QUALITY_COLORS[stream.quality]
          )}
        >
          {stream.quality}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
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
          <div className="flex items-center gap-3 text-xs text-white/30">
            {stream.source && <span>{stream.source}</span>}
            {stream.sizeLabel && <span>{stream.sizeLabel}</span>}
          </div>
        </div>
        <Lock className="size-4 shrink-0 text-white/25" />
      </div>

      {/* Suggestion VLC */}
      <button
        onClick={() => onVlcFallback(stream)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-orange-500/8 hover:bg-orange-500/15 border-t border-orange-500/15 hover:border-orange-500/30 transition-all text-left group"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-orange-400"
          fill="currentColor"
          aria-hidden
        >
          <path d="M11.18 2.5L2 21.5h20L12.82 2.5h-1.64zm.82 3l7.5 14H4.5L12 5.5z" />
          <rect x="9" y="22" width="6" height="1.5" rx="0.75" />
        </svg>
        <div className="flex-1 min-w-0">
          <span className="text-orange-300 text-xs font-semibold">
            Regarder en 4K via VLC
          </span>
          <span className="text-white/30 text-xs ml-1.5">· Télécharge le fichier .m3u</span>
        </div>
        <span className="shrink-0 text-orange-400/60 text-xs font-bold group-hover:text-orange-300 transition-colors">
          →
        </span>
      </button>
    </div>
  );
}

function TrackToggle({
  stream,
  checked,
  onChange,
}: {
  stream: ProbeStream;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none",
        checked
          ? "border-nemo-accent/40 bg-nemo-accent/8 text-white"
          : "border-white/8 hover:border-white/18 text-white/60 hover:text-white/80"
      )}
    >
      <span
        className={cn(
          "size-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
          checked ? "border-nemo-accent bg-nemo-accent" : "border-white/25"
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-black" aria-hidden>
            <path
              d="M1 4l3 3L9 1"
              stroke="black"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium tabular-nums text-white/40">
          #{stream.index}
        </span>
        {stream.language && (
          <span className="text-sm font-semibold">{langLabel(stream.language)}</span>
        )}
        {stream.title && (
          <span className="text-xs text-white/45 truncate">{stream.title}</span>
        )}
      </div>
    </label>
  );
}

// ─── Animation variant ────────────────────────────────────────────────────────

const fadeSlide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.18 },
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

export function WatchModal({
  open,
  onClose,
  title,
  jellyfinInLibrary,
  jellyfinItemUrl,
  jellyfinItemId,
  streamingOptions,
  mediaInfo,
  onPlayStream,
}: WatchModalProps) {
  const { state } = useStream();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { mutate: startDownload } = useStartDownload();
  const { mutate: updateProfile } = useUpdateProfile();

  const [view, setView] = useState<WatchView>("options");
  const [vlcReadyStream, setVlcReadyStream] = useState<ParsedStream | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Lecteur intégré (quand onPlayStream n'est pas fourni)
  const [internalStream, setInternalStream] = useState<{
    url: string; title: string; tmdbId?: number; mediaType?: "movie" | "tv";
    subtitles?: Array<{ src: string; label: string; language: string; default?: boolean }>;
    audioTracks?: Array<{ index: number; label: string; language: string; codec?: string | null; default?: boolean }>;
    startTime?: number;
  } | null>(null);

  // Jellyfin download state
  const [selectedJfStream, setSelectedJfStream] = useState<ParsedStream | null>(null);
  const [probeStreams, setProbeStreams] = useState<ProbeStream[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [probeError, setProbeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // WhatsApp phone state
  const [phoneInput, setPhoneInput] = useState("+33");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  // Jellyfin user stream state
  const [jfUserStreamError, setJfUserStreamError] = useState<string | null>(null);

  const streams = state.streams;
  const streamsLoading = state.isLoading;

  // ── Probe ──────────────────────────────────────────────────────────────────
  const probeStream = useCallback(
    async (stream: ParsedStream) => {
      setSelectedJfStream(stream);
      setView("jf-probing");
      setProbeError(null);

      try {
        const res = await fetch("/api/download/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: stream.url,
            title: mediaInfo.title,
            type: mediaInfo.type,
          }),
        });
        if (!res.ok) throw new Error("Flux invalide ou expiré");
        const data = await res.json();
        if (data.status !== "success" || !Array.isArray(data.streams)) {
          throw new Error("Réponse inattendue du serveur");
        }

        const ps: ProbeStream[] = data.streams;
        setProbeStreams(ps);

        // Smart defaults
        const defaults = new Set<number>();
        const firstVideo = ps.find((s) => s.codec_type === "video");
        if (firstVideo) defaults.add(firstVideo.index);
        const audioFre = ps.find(
          (s) => s.codec_type === "audio" && ["fre", "fra"].includes(s.language.toLowerCase())
        );
        const audioEng = ps.find(
          (s) => s.codec_type === "audio" && s.language.toLowerCase() === "eng"
        );
        const defaultAudio =
          audioFre ?? audioEng ?? ps.find((s) => s.codec_type === "audio");
        if (defaultAudio) defaults.add(defaultAudio.index);
        const subForced = ps.find(
          (s) =>
            s.codec_type === "subtitle" &&
            ["fre", "fra"].includes(s.language.toLowerCase()) &&
            /forc/i.test(s.title)
        );
        if (subForced) defaults.add(subForced.index);

        setSelectedTracks(defaults);
        setView("jf-selecting");
      } catch (err) {
        setProbeError(
          err instanceof Error ? err.message : "Erreur lors de l'analyse du flux."
        );
        setView("jf-error");
      }
    },
    [mediaInfo]
  );

  // ── Submit download ────────────────────────────────────────────────────────
  const handleSubmitDownload = () => {
    if (!user || !selectedJfStream) return;
    setView("jf-submitting");

    const audioStreams = probeStreams.filter(
      (s) => s.codec_type === "audio" && selectedTracks.has(s.index)
    );
    const subStreams = probeStreams.filter(
      (s) => s.codec_type === "subtitle" && selectedTracks.has(s.index)
    );

    startDownload(
      {
        url: selectedJfStream.url,
        selected_indices: Array.from(selectedTracks),
        destination_path: generatePath(mediaInfo),
        audio_languages: audioStreams.map((s) => s.language).filter(Boolean),
        sub_languages: subStreams.map((s) => s.language).filter(Boolean),
        metadata: {
          title: mediaInfo.title,
          type: mediaInfo.type,
          user_id: user.id,
          user_name: user.name,
          tmdb_id: mediaInfo.tmdbId,
          season_number: mediaInfo.seasonNumber,
          episode_number: mediaInfo.episodeNumber,
        },
      },
      {
        onSuccess: () => {
          setView("jf-success");
          setTimeout(() => {
            if (!profile?.phone_number) {
              setView("whatsapp");
            } else {
              handleClose();
            }
          }, 1400);
        },
        onError: (err) => {
          setSubmitError(err instanceof Error ? err.message : "Erreur inconnue");
          setView("jf-error");
        },
      }
    );
  };

  // ── VLC handlers ───────────────────────────────────────────────────────────
  const handleVlcSelect = (stream: ParsedStream) => {
    downloadM3U(stream, title);
    setVlcReadyStream(stream);
    setView("vlc-ready");
  };

  const handleCopyUrl = async () => {
    if (!vlcReadyStream) return;
    try {
      await navigator.clipboard.writeText(vlcReadyStream.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // ── Phone save ─────────────────────────────────────────────────────────────
  const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

  const handlePhoneChange = (value: string) => {
    setPhoneInput(value);
    if (value && !PHONE_REGEX.test(value.replace(/\s/g, ""))) {
      setPhoneError("Format invalide — ex: +33768117912");
    } else {
      setPhoneError(null);
    }
  };

  const handlePhoneSave = () => {
    const clean = phoneInput.replace(/\s/g, "");
    if (!clean || !PHONE_REGEX.test(clean)) {
      setPhoneError("Format invalide — ex: +33768117912");
      return;
    }
    setPhoneSaving(true);
    updateProfile(
      { phone_number: clean },
      {
        onSuccess: () => {
          setPhoneSaved(true);
          setPhoneSaving(false);
          setTimeout(() => handleClose(), 1400);
        },
        onError: () => {
          setPhoneError("Erreur lors de l'enregistrement");
          setPhoneSaving(false);
        },
      }
    );
  };

  // ── Reset & close ──────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setView("options");
    setVlcReadyStream(null);
    setSelectedJfStream(null);
    setProbeStreams([]);
    setSelectedTracks(new Set());
    setProbeError(null);
    setSubmitError(null);
    setCopiedUrl(false);
    setPhoneInput("+33");
    setPhoneError(null);
    setPhoneSaving(false);
    setPhoneSaved(false);
    setJfUserStreamError(null);
    setInternalStream(null);
    onClose();
  }, [onClose]);

  // ── Jellyfin user stream ───────────────────────────────────────────────────
  const handlePlayViaJellyfin = useCallback(async () => {
    if (!jellyfinItemId) return;
    setJfUserStreamError(null);
    setView("jf-user-loading");
    try {
      const res = await fetch(`/api/jellyfin/user/stream/${jellyfinItemId}`);
      const data = await res.json() as {
        url?: string;
        error?: string;
        subtitles?: Array<{ src: string; label: string; language: string; default?: boolean }>;
        audioTracks?: Array<{ index: number; label: string; language: string; codec?: string | null; default?: boolean }>;
        resumePosition?: number;
      };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Flux indisponible");

      const tmdbId = mediaInfo.tmdbId;
      const mediaType = mediaInfo.type === "movie" ? "movie" as const : "tv" as const;
      const startTime = data.resumePosition && data.resumePosition > 0 ? data.resumePosition : undefined;

      if (onPlayStream) {
        onPlayStream(data.url, title, tmdbId, mediaType, startTime);
      } else {
        setInternalStream({
          url: data.url,
          title,
          tmdbId,
          mediaType,
          subtitles: data.subtitles,
          audioTracks: data.audioTracks,
          startTime,
        });
        setView("options");
      }
    } catch (err) {
      setJfUserStreamError(err instanceof Error ? err.message : "Impossible de récupérer le flux");
      setView("jf-user-error");
    }
  }, [jellyfinItemId, mediaInfo, title, onPlayStream]);

  const handleOpenChange = (o: boolean) => {
    if (!o) handleClose();
  };

  // ── Back navigation ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (
      view === "vlc-sources" ||
      view === "vlc-ready" ||
      view === "jf-sources" ||
      view === "jf-selecting" ||
      view === "jf-error" ||
      view === "jf-user-error"
    ) {
      setView("options");
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const videoTracks = probeStreams.filter((s) => s.codec_type === "video");
  const audioTracks = probeStreams.filter((s) => s.codec_type === "audio");
  const subTracks = probeStreams.filter((s) => s.codec_type === "subtitle");

  // ── Permissions selon le rôle ──────────────────────────────────────────────
  const userRole = profile?.role ?? "free";
  const canStream   = userRole === "sources" || userRole === "vip" || userRole === "admin";
  const canDownload = userRole === "vip"     || userRole === "admin";
  // 4K vers Jellyfin : réservé aux admins (VLC/M3U reste ouvert à tous)
  const canDownload4K = userRole === "admin";

  const hasJellyfinDownload = !jellyfinInLibrary && !!user && canDownload;
  const hasVlcOption = canStream && (streams.length > 0 || streamsLoading);
  const hasAnyOption =
    jellyfinInLibrary ||
    (streamingOptions && streamingOptions.length > 0) ||
    hasVlcOption ||
    hasJellyfinDownload;

  const VIEW_TITLES: Record<WatchView, string> = {
    options:          "Comment regarder ?",
    "vlc-sources":    "Choisir une source",
    "vlc-ready":      "Prêt à lire",
    "jf-sources":     "Choisir la qualité",
    "jf-probing":     "Analyse en cours…",
    "jf-selecting":   "Configurer le téléchargement",
    "jf-submitting":  "Lancement…",
    "jf-success":     "Téléchargement lancé !",
    "jf-error":       "Erreur",
    "jf-user-loading":"Chargement du flux…",
    "jf-user-error":  "Erreur de lecture",
    whatsapp:         "Notifications WhatsApp",
  };

  const hasBack =
    view !== "options" &&
    view !== "jf-submitting" &&
    view !== "jf-success" &&
    view !== "jf-probing" &&
    view !== "jf-user-loading" &&
    view !== "whatsapp";

  const hideClose =
    view === "jf-submitting" ||
    view === "jf-probing" ||
    view === "jf-user-loading";

  return (
    <>
      {/* ── Lecteur intégré plein écran (portal vers document.body) ──── */}
      {internalStream && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-9999 bg-black">
          <VideoPlayer
            url={internalStream.url}
            title={internalStream.title}
            tmdbId={internalStream.tmdbId}
            mediaType={internalStream.mediaType}
            subtitles={internalStream.subtitles}
            audioTracks={internalStream.audioTracks}
            startTime={internalStream.startTime}
            onBack={() => {
              setInternalStream(null);
              handleClose();
            }}
            className="w-full h-full"
          />
        </div>,
        document.body
      )}

    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* ── Overlay ─────────────────────────────────────────────── */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-(--z-modal) bg-black/70 backdrop-blur-md"
                onClick={hideClose ? undefined : handleClose}
              />
            </Dialog.Overlay>

            {/* ── Modal ───────────────────────────────────────────────── */}
            <Dialog.Content asChild aria-describedby="watch-modal-body">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-(--z-modal) w-[calc(100vw-2rem)] max-w-115 max-h-[88dvh] flex flex-col rounded-3xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none overflow-hidden"
              >
                {/* ── Header ────────────────────────────────────────── */}
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 shrink-0">
                  {hasBack && (
                    <button
                      onClick={handleBack}
                      aria-label="Retour"
                      className="shrink-0 flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <Dialog.Title className="text-white font-semibold text-base leading-tight text-balance">
                      {VIEW_TITLES[view]}
                    </Dialog.Title>
                    <p className="text-white/40 text-xs truncate mt-0.5">{title}</p>
                  </div>
                  {!hideClose && (
                    <Dialog.Close asChild>
                      <button
                        aria-label="Fermer"
                        className="shrink-0 flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <X className="size-4 text-white/50" />
                      </button>
                    </Dialog.Close>
                  )}
                </div>

                {/* ── Scrollable body ────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 px-4 pb-4" id="watch-modal-body">
                  <AnimatePresence mode="wait">

                    {/* ════ OPTIONS ════════════════════════════════════ */}
                    {view === "options" && (
                      <motion.div key="options" {...fadeSlide} className="space-y-3">

                        {/* 1a — Lire directement dans NEMO via compte Jellyfin */}
                        {jellyfinInLibrary && jellyfinItemId && profile?.jellyfin_user_id && (
                          <button
                            onClick={() => void handlePlayViaJellyfin()}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#00a4dc]/40 bg-[#00a4dc]/10 hover:bg-[#00a4dc]/18 hover:border-[#00a4dc]/60 transition-all text-left"
                          >
                            <div className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-[#00a4dc]/25">
                              <Play className="size-5 fill-[#00A4DC] text-[#00A4DC]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-semibold text-sm block">
                                Lire maintenant sur NEMO
                              </span>
                              <span className="text-white/45 text-xs">
                                Via votre bibliothèque Jellyfin
                              </span>
                            </div>
                            <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                              GRATUIT
                            </span>
                          </button>
                        )}

                        {/* 1b — Jellyfin (in library) — lien externe */}
                        {jellyfinInLibrary && jellyfinItemUrl && (
                          <a
                            href={jellyfinItemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleClose}
                            className="flex items-center gap-4 p-4 rounded-2xl border border-[#00a4dc]/30 bg-[#00a4dc]/8 hover:bg-[#00a4dc]/14 hover:border-[#00a4dc]/50 transition-all"
                          >
                            <div className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-[#00a4dc]/20">
                              <JellyfinIcon className="size-6" style={{ color: "#00A4DC" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-semibold text-sm block">
                                Ouvrir dans Jellyfin
                              </span>
                              <span className="text-white/45 text-xs">
                                Application Jellyfin
                              </span>
                            </div>
                            <ExternalLink className="shrink-0 size-4 text-white/30" />
                          </a>
                        )}

                        {/* 2 — Legal streaming services */}
                        {streamingOptions && streamingOptions.length > 0 && (
                          <div className="space-y-2">
                            {(jellyfinInLibrary) && (
                              <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/8" />
                                <span className="text-white/25 text-[11px]">Aussi disponible sur</span>
                                <div className="h-px flex-1 bg-white/8" />
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              {streamingOptions.map((opt, i) => (
                                <a
                                  key={`${opt.service.id}-${opt.type}-${i}`}
                                  href={opt.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex flex-col items-center justify-between gap-2.5 p-3 pt-3.5 rounded-2xl border border-white/8 hover:border-white/18 hover:bg-white/5 transition-all min-h-20"
                                  style={{
                                    borderColor: opt.service.themeColorCode
                                      ? `${opt.service.themeColorCode}33`
                                      : undefined,
                                    backgroundColor: opt.service.themeColorCode
                                      ? `${opt.service.themeColorCode}0a`
                                      : undefined,
                                  }}
                                  aria-label={`Regarder sur ${opt.service.name}`}
                                >
                                  {opt.service.imageSet?.whiteImage ? (
                                    <img
                                      src={opt.service.imageSet.whiteImage}
                                      alt={opt.service.name}
                                      className="h-5 w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-white text-xs font-semibold text-center line-clamp-2 w-full">
                                      {opt.service.name}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 flex-wrap justify-center">
                                    {opt.quality && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/55">
                                        {QUALITY_SHORT[opt.quality] ?? opt.quality.toUpperCase()}
                                      </span>
                                    )}
                                    {opt.price ? (
                                      <span className="text-[10px] font-medium text-amber-300/90 px-1.5 py-0.5 rounded-full bg-amber-400/10">
                                        {opt.price.formatted}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-white/40 px-1.5 py-0.5 rounded-full bg-white/6">
                                        {TYPE_LABELS[opt.type] ?? opt.type}
                                      </span>
                                    )}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Divider before free options */}
                        {(jellyfinInLibrary || (streamingOptions && streamingOptions.length > 0)) &&
                          (hasJellyfinDownload || hasVlcOption) && (
                            <div className="flex items-center gap-3">
                              <div className="h-px flex-1 bg-white/8" />
                              <span className="text-white/25 text-[11px]">Options gratuites</span>
                              <div className="h-px flex-1 bg-white/8" />
                            </div>
                          )}

                        {/* 3 — Download to Jellyfin (not in library) */}
                        {hasJellyfinDownload && (
                          <button
                            onClick={() => setView("jf-sources")}
                            disabled={!streams.length && !streamsLoading}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-white/22 hover:bg-white/4 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-[#00a4dc]/15">
                              <Clock className="size-5 text-[#00a4dc]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-semibold text-sm block">
                                Regarder dans quelques minutes
                              </span>
                              <span className="text-white/40 text-xs">
                                Upload sécurisé sur votre Jellyfin
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                GRATUIT
                              </span>
                              {streamsLoading && (
                                <Loader2 className="size-3 text-white/30 animate-spin" />
                              )}
                            </div>
                          </button>
                        )}

                        {/* 4 — VLC / Torrent */}
                        {hasVlcOption && (
                          <button
                            onClick={() => setView("vlc-sources")}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-orange-500/18 hover:border-orange-500/35 hover:bg-orange-500/5 transition-all text-left"
                          >
                            <div className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-orange-500/15">
                              <svg
                                viewBox="0 0 24 24"
                                className="size-6 text-orange-400"
                                fill="currentColor"
                                aria-hidden
                              >
                                <path d="M11.18 2.5L2 21.5h20L12.82 2.5h-1.64zm.82 3l7.5 14H4.5L12 5.5z" />
                                <rect x="9" y="22" width="6" height="1.5" rx="0.75" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-white font-semibold text-sm">
                                  Regarder via VLC
                                </span>
                                {streams.length > 0 && (
                                  <span className="text-white/30 text-xs tabular-nums">
                                    {streams.length} source{streams.length > 1 ? "s" : ""}
                                  </span>
                                )}
                                {streamsLoading && streams.length === 0 && (
                                  <Loader2 className="size-3 text-white/30 animate-spin" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-[11px] font-medium text-orange-400/90">
                                  <TriangleAlert className="size-3" />
                                  Illégal
                                </span>
                                <span className="text-[11px] text-white/35">· VPN conseillé</span>
                              </div>
                            </div>
                            <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/6 border border-white/12 text-white/40 text-xs font-bold">
                              GRATUIT
                            </span>
                          </button>
                        )}

                        {/* Empty state */}
                        {!hasAnyOption && (
                          <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                            <p className="text-white/50 font-medium text-sm">
                              Aucune option disponible
                            </p>
                            <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                              Ce contenu n&apos;est pas encore disponible. Revenez plus tard.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* ════ VLC SOURCES ════════════════════════════════ */}
                    {view === "vlc-sources" && (
                      <motion.div key="vlc-sources" {...fadeSlide} className="space-y-2">
                        {streamsLoading && streams.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-14 gap-3">
                            <Loader2 className="size-6 text-nemo-accent animate-spin" />
                            <p className="text-white/40 text-sm">Recherche des sources…</p>
                          </div>
                        )}
                        {!streamsLoading && streams.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                            <AlertCircle className="size-6 text-white/30" />
                            <p className="text-white/50 text-sm">Aucune source disponible</p>
                          </div>
                        )}
                        {streams.length > 0 && (
                          <>
                            <p className="text-white/30 text-xs px-0.5 pb-1">
                              Sélectionne une source pour télécharger le fichier .m3u
                            </p>
                            {streams.slice(0, 12).map((stream) => (
                              <StreamRow
                                key={stream.id}
                                stream={stream}
                                onSelect={handleVlcSelect}
                              />
                            ))}
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* ════ VLC READY ══════════════════════════════════ */}
                    {view === "vlc-ready" && vlcReadyStream && (
                      <motion.div key="vlc-ready" {...fadeSlide} className="space-y-4">
                        {/* Source info */}
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/4 border border-white/8 flex-wrap">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-lg border text-xs font-bold tabular-nums",
                              QUALITY_COLORS[vlcReadyStream.quality]
                            )}
                          >
                            {vlcReadyStream.quality}
                          </span>
                          <span
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold",
                              LANG_COLORS[vlcReadyStream.language]
                            )}
                          >
                            {getLanguageFlag(vlcReadyStream.language)} {vlcReadyStream.language}
                          </span>
                          {vlcReadyStream.sizeLabel && (
                            <span className="text-white/35 text-xs ml-auto tabular-nums">
                              {vlcReadyStream.sizeLabel}
                            </span>
                          )}
                        </div>

                        {/* Success state */}
                        <div className="flex flex-col items-center gap-2 py-5 text-center">
                          <CheckCircle2 className="size-10 text-emerald-400" />
                          <p className="text-white font-semibold text-sm">
                            Fichier .m3u téléchargé
                          </p>
                          <p className="text-white/40 text-xs max-w-xs leading-relaxed">
                            Ouvre le fichier dans VLC pour lancer la lecture
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              window.location.href = `vlc://${vlcReadyStream.url}`;
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-orange-500/18 border border-orange-500/30 hover:bg-orange-500/28 text-orange-300 font-semibold text-sm transition-all"
                          >
                            <ExternalLink className="size-4" />
                            Ouvrir avec VLC
                          </button>
                          <button
                            onClick={() => void handleCopyUrl()}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/8 hover:border-white/15 hover:bg-white/4 text-white/50 hover:text-white/80 text-sm transition-all"
                          >
                            {copiedUrl ? (
                              <>
                                <CheckCircle2 className="size-4 text-emerald-400" />
                                Copié !
                              </>
                            ) : (
                              <>
                                <Copy className="size-4" />
                                Copier le lien direct
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ════ JF SOURCES ═════════════════════════════════ */}
                    {view === "jf-sources" && (
                      <motion.div key="jf-sources" {...fadeSlide} className="space-y-3">
                        {/* Info card */}
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#00a4dc]/8 border border-[#00a4dc]/20">
                          <JellyfinIcon
                            className="size-5 shrink-0 mt-px"
                            style={{ color: "#00A4DC" }}
                          />
                          <p className="text-white/65 text-xs leading-relaxed">
                            Le fichier sera uploadé directement sur votre serveur Jellyfin. Retrouvez-le dans votre bibliothèque une fois prêt.
                          </p>
                        </div>

                        {streamsLoading && streams.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="size-6 text-nemo-accent animate-spin" />
                            <p className="text-white/40 text-sm">Chargement des sources…</p>
                          </div>
                        )}
                        {!streamsLoading && streams.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                            <AlertCircle className="size-6 text-white/30" />
                            <p className="text-white/50 text-sm">Aucune source disponible</p>
                          </div>
                        )}
                        {streams.length > 0 && (
                          <>
                            <p className="text-white/30 text-xs px-0.5">
                              Choisis la qualité souhaitée
                            </p>
                            {streams.slice(0, 12).map((stream) => (
                              <JfStreamRow
                                key={stream.id}
                                stream={stream}
                                canDownload4K={canDownload4K}
                                onSelect={(s) => void probeStream(s)}
                                onVlcFallback={handleVlcSelect}
                              />
                            ))}
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* ════ JF PROBING ═════════════════════════════════ */}
                    {view === "jf-probing" && (
                      <motion.div
                        key="jf-probing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16 gap-4"
                      >
                        <div className="relative size-12 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-[#00a4dc]/20" />
                          <Loader2 className="size-6 text-[#00a4dc] animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-white/80 font-medium text-sm">Analyse du flux…</p>
                          <p className="text-white/35 text-xs mt-1">
                            Détection des pistes audio et sous-titres
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* ════ JF SELECTING ═══════════════════════════════ */}
                    {view === "jf-selecting" && (
                      <motion.div key="jf-selecting" {...fadeSlide} className="space-y-4">
                        {/* Video tracks */}
                        {videoTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Video className="size-3.5" />
                              Vidéo
                            </h3>
                            {videoTracks.map((s) => (
                              <TrackToggle
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const next = new Set(prev);
                                    if (v) next.add(s.index);
                                    else next.delete(s.index);
                                    return next;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        {/* Audio tracks */}
                        {audioTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Music className="size-3.5" />
                              Audio
                            </h3>
                            {audioTracks.map((s) => (
                              <TrackToggle
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const next = new Set(prev);
                                    if (v) next.add(s.index);
                                    else next.delete(s.index);
                                    return next;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        {/* Subtitle tracks */}
                        {subTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Subtitles className="size-3.5" />
                              Sous-titres
                            </h3>
                            {subTracks.map((s) => (
                              <TrackToggle
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const next = new Set(prev);
                                    if (v) next.add(s.index);
                                    else next.delete(s.index);
                                    return next;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        {/* Destination */}
                        <section className="space-y-1.5">
                          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                            <FolderOpen className="size-3.5" />
                            Destination NAS
                          </h3>
                          <div className="px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                            <code className="text-[11px] text-white/40 font-mono break-all leading-relaxed">
                              {generatePath(mediaInfo)}
                            </code>
                          </div>
                        </section>
                      </motion.div>
                    )}

                    {/* ════ JF SUBMITTING ══════════════════════════════ */}
                    {view === "jf-submitting" && (
                      <motion.div
                        key="jf-submitting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16 gap-4"
                      >
                        <Loader2 className="size-8 text-nemo-accent animate-spin" />
                        <p className="text-white/60 text-sm">Lancement du téléchargement…</p>
                      </motion.div>
                    )}

                    {/* ════ JF SUCCESS ═════════════════════════════════ */}
                    {view === "jf-success" && (
                      <motion.div
                        key="jf-success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="flex flex-col items-center justify-center py-14 gap-3 text-center"
                      >
                        <CheckCircle2 className="size-12 text-emerald-400" />
                        <p className="text-white font-semibold">Ajouté à la file d&apos;attente !</p>
                        <p className="text-white/40 text-sm max-w-xs leading-relaxed">
                          Le téléchargement a été lancé sur votre serveur Jellyfin.
                        </p>
                      </motion.div>
                    )}

                    {/* ════ JF USER LOADING ════════════════════════════ */}
                    {view === "jf-user-loading" && (
                      <motion.div
                        key="jf-user-loading"
                        {...fadeSlide}
                        className="flex flex-col items-center justify-center py-16 gap-4 text-center"
                      >
                        <div className="flex items-center justify-center size-14 rounded-2xl bg-[#00A4DC]/15">
                          <JellyfinIcon className="size-7 animate-pulse" style={{ color: "#00A4DC" }} />
                        </div>
                        <p className="text-white/60 text-sm">Récupération du flux Jellyfin…</p>
                      </motion.div>
                    )}

                    {/* ════ JF USER ERROR ══════════════════════════════ */}
                    {view === "jf-user-error" && (
                      <motion.div
                        key="jf-user-error"
                        {...fadeSlide}
                        className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4"
                      >
                        <AlertCircle className="size-8 text-red-400/80" />
                        <div>
                          <p className="text-white/80 font-medium text-sm">Impossible de lire via Jellyfin</p>
                          <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-xs">
                            {jfUserStreamError ?? "Une erreur inattendue s'est produite."}
                          </p>
                        </div>
                        <button
                          onClick={() => setView("options")}
                          className="flex items-center gap-1.5 text-nemo-accent text-sm hover:underline"
                        >
                          <ArrowLeft className="size-3.5" />
                          Retour aux options
                        </button>
                      </motion.div>
                    )}

                    {/* ════ JF ERROR ═══════════════════════════════════ */}
                    {view === "jf-error" && (
                      <motion.div
                        key="jf-error"
                        {...fadeSlide}
                        className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4"
                      >
                        <AlertCircle className="size-8 text-red-400/80" />
                        <div>
                          <p className="text-white/80 font-medium text-sm">Erreur</p>
                          <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-xs">
                            {probeError ?? submitError ?? "Une erreur inattendue s'est produite."}
                          </p>
                        </div>
                        <button
                          onClick={() => setView("jf-sources")}
                          className="flex items-center gap-1.5 text-nemo-accent text-sm hover:underline"
                        >
                          <ArrowLeft className="size-3.5" />
                          Choisir une autre source
                        </button>
                      </motion.div>
                    )}

                    {/* ════ WHATSAPP ════════════════════════════════════ */}
                    {view === "whatsapp" && (
                      <motion.div
                        key="whatsapp"
                        {...fadeSlide}
                        className="flex flex-col items-center gap-5 py-5 px-1"
                      >
                        {/* Icon + text */}
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="flex items-center justify-center size-14 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/25">
                            <Smartphone className="size-6 text-[#25D366]" />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-white font-semibold text-base text-balance">
                              Reçois une notification WhatsApp
                            </p>
                            <p className="text-white/50 text-sm leading-relaxed max-w-70 mx-auto text-pretty">
                              Entre ton numéro pour être averti(e) dès que le film est prêt à regarder.
                            </p>
                          </div>
                        </div>

                        {/* Success state */}
                        {phoneSaved ? (
                          <div className="flex flex-col items-center gap-2 py-3 text-center">
                            <CheckCircle2 className="size-8 text-emerald-400" />
                            <p className="text-white font-medium text-sm">Numéro enregistré !</p>
                            <p className="text-white/40 text-xs">Tu recevras un message WhatsApp quand c&apos;est prêt.</p>
                          </div>
                        ) : (
                          <div className="w-full space-y-3">
                            {/* Phone input */}
                            <div className="space-y-1.5">
                              <div className="relative">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30 pointer-events-none" />
                                <input
                                  type="tel"
                                  value={phoneInput}
                                  onChange={(e) => handlePhoneChange(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handlePhoneSave();
                                  }}
                                  placeholder="+33768117912"
                                  autoFocus
                                  className={cn(
                                    "w-full pl-10 pr-4 py-3.5 rounded-xl text-white text-sm outline-none border transition-colors bg-white/5 placeholder:text-white/25",
                                    phoneError
                                      ? "border-red-500/50 focus:border-red-500/70"
                                      : "border-white/12 focus:border-[#25D366]/50"
                                  )}
                                />
                              </div>
                              {phoneError ? (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <AlertCircle className="size-3 shrink-0" />
                                  {phoneError}
                                </p>
                              ) : (
                                <p className="text-white/25 text-xs">
                                  Indicatif pays + numéro, le + est optionnel (ex : 33768117912)
                                </p>
                              )}
                            </div>

                            {/* Save button */}
                            <button
                              onClick={handlePhoneSave}
                              disabled={phoneSaving || !!phoneError || !phoneInput.replace(/[\s+]/g, "")}
                              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#25D366]/18 border border-[#25D366]/30 hover:bg-[#25D366]/28 text-[#25D366] font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {phoneSaving ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Smartphone className="size-4" />
                              )}
                              {phoneSaving ? "Enregistrement…" : "Activer les notifications"}
                            </button>

                            <button
                              onClick={handleClose}
                              className="w-full py-2 text-white/30 hover:text-white/55 text-sm transition-colors"
                            >
                              Ignorer, merci
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>

                {/* ── Footer CTA (jf-selecting only) ────────────────── */}
                {view === "jf-selecting" && (
                  <div className="px-4 py-3 border-t border-white/8 shrink-0">
                    <button
                      onClick={handleSubmitDownload}
                      disabled={selectedTracks.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00a4dc] hover:bg-[#00b5e8] text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="size-4" />
                      Lancer le téléchargement
                    </button>
                    <p className="text-center text-white/25 text-xs mt-2">
                      {selectedTracks.size} piste{selectedTracks.size > 1 ? "s" : ""}{" "}
                      sélectionnée{selectedTracks.size > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
    </>
  );
}
