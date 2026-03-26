"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Layers,
  Video,
  Music,
  Subtitles,
  FolderOpen,
  Play,
  Film,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useStartBatchDownload, useStartDownload } from "@/hooks/use-downloads";
import { fetchStreams, parseStreams } from "@/lib/stremio/resolver";
import type { ParsedStream, StreamQuality, StreamLanguage } from "@/types/stremio";
import type { ProbeStream } from "@/types/download";
import type { TMDbEpisode } from "@/types/tmdb";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const LANG_LABELS: Record<string, string> = {
  fre: "Français", fra: "Français",
  eng: "Anglais", spa: "Espagnol",
  ger: "Allemand", deu: "Allemand",
  ita: "Italien", por: "Portugais",
  jpn: "Japonais", chi: "Chinois", zho: "Chinois",
  kor: "Coréen", rus: "Russe", ara: "Arabe",
  und: "Indéterminée", "": "Inconnue",
};

function langLabel(code: string): string {
  return LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();
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

// ─── Smart URL matching ────────────────────────────────────────────────────────

function matchBestUrl(streams: ParsedStream[], reference: ParsedStream): string | null {
  if (streams.length === 0) return null;
  // 1. Source + qualité + langue
  const exact = streams.find(
    (s) => s.source === reference.source && s.quality === reference.quality && s.language === reference.language
  );
  if (exact) return exact.url;
  // 2. Qualité + langue
  const qualLang = streams.find(
    (s) => s.quality === reference.quality && s.language === reference.language
  );
  if (qualLang) return qualLang.url;
  // 3. Qualité seulement
  const qual = streams.find((s) => s.quality === reference.quality);
  if (qual) return qual.url;
  // 4. Meilleur disponible
  return streams[0].url;
}

// ─── Episode stream data ───────────────────────────────────────────────────────

interface EpisodeStreamData {
  episodeNumber: number;
  streams: ParsedStream[];
  error: boolean;
}

// ─── TrackRow ─────────────────────────────────────────────────────────────────

function TrackRow({
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
            <path d="M1 4l3 3L9 1" stroke="black" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
        <span className="text-sm font-medium tabular-nums text-white/40">#{stream.index}</span>
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

// ─── StreamRow ────────────────────────────────────────────────────────────────

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
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold",
              LANG_COLORS[stream.language]
            )}
          >
            {stream.language}
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
          {stream.sizeLabel && <span>~{stream.sizeLabel}/ép.</span>}
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-center size-7 rounded-full bg-white/0 group-hover:bg-white/90 text-transparent group-hover:text-black transition-all duration-150">
        <Play className="size-3 fill-current ml-px" />
      </div>
    </button>
  );
}

// ─── Types / étapes ───────────────────────────────────────────────────────────

type DownloadScope = "season" | "episode";

type Step =
  | "scope"       // Choisir : saison ou épisode spécifique
  | "resolving"   // Résolution des flux Stremio
  | "picking"     // Choisir la source / qualité
  | "probing"     // Probe du 1er épisode / épisode choisi
  | "selecting"   // Sélection des pistes
  | "submitting"  // Envoi au backend
  | "success"
  | "error";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SeasonDownloadModalProps {
  open: boolean;
  onClose: () => void;
  showTitle: string;
  showTmdbId: number;
  imdbId: string | null;
  seasonNumber: number;
  episodes: TMDbEpisode[];
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SeasonDownloadModal({
  open,
  onClose,
  showTitle,
  showTmdbId,
  imdbId,
  seasonNumber,
  episodes,
}: SeasonDownloadModalProps) {
  const { user } = useAuth();
  const { mutate: startBatch } = useStartBatchDownload();
  const { mutate: startSingle } = useStartDownload();
  const abortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>("scope");
  const [scope, setScope] = useState<DownloadScope>("season");
  const [selectedEpisodeNum, setSelectedEpisodeNum] = useState<number | null>(null);

  const [resolveProgress, setResolveProgress] = useState(0);
  const [resolveTotal, setResolveTotal] = useState(0);
  const [episodeStreams, setEpisodeStreams] = useState<EpisodeStreamData[]>([]);
  const [ep1Streams, setEp1Streams] = useState<ParsedStream[]>([]);

  const [selectedStream, setSelectedStream] = useState<ParsedStream | null>(null);
  const [probeStreams, setProbeStreams] = useState<ProbeStream[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Reset à la fermeture ────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setStep("scope");
    setScope("season");
    setSelectedEpisodeNum(null);
    setResolveProgress(0);
    setResolveTotal(0);
    setEpisodeStreams([]);
    setEp1Streams([]);
    setSelectedStream(null);
    setProbeStreams([]);
    setSelectedTracks(new Set());
    setError(null);
    onClose();
  }, [onClose]);

  // ── Résolution des flux ─────────────────────────────────────────────────────
  const resolveEpisodes = useCallback(
    async (targetEpisodes: TMDbEpisode[]) => {
      if (!imdbId) {
        setError("Identifiant IMDB introuvable pour cette série. Impossible de résoudre les sources.");
        setStep("error");
        return;
      }
      if (targetEpisodes.length === 0) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setStep("resolving");
      setResolveProgress(0);
      setResolveTotal(targetEpisodes.length);
      setEpisodeStreams([]);
      setEp1Streams([]);
      setError(null);

      const results: EpisodeStreamData[] = [];

      for (let i = 0; i < targetEpisodes.length; i++) {
        if (ctrl.signal.aborted) return;

        const ep = targetEpisodes[i];
        const stremioId = `${imdbId}:${seasonNumber}:${ep.episode_number}`;

        try {
          const response = await fetchStreams(stremioId, "series", ctrl.signal);
          const parsed = parseStreams(response);
          results.push({ episodeNumber: ep.episode_number, streams: parsed, error: false });

          if (i === 0) {
            setEp1Streams(parsed);
            // Dès que l'épisode 1 est prêt, on peut déjà afficher les sources
            // même si les autres épisodes ne sont pas encore résolus
            if (parsed.length === 0) {
              setError("Aucune source disponible pour l'épisode 1 de cette saison.");
              setStep("error");
              return;
            }
          }
        } catch (err) {
          // Si c'est une annulation volontaire, on sort silencieusement
          if (ctrl.signal.aborted) return;
          const isAbort = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
          if (isAbort) return;

          results.push({ episodeNumber: ep.episode_number, streams: [], error: true });
          if (i === 0) {
            setError("Impossible de résoudre les sources de l'épisode 1. Le lien est peut-être expiré.");
            setStep("error");
            return;
          }
        }

        if (!ctrl.signal.aborted) {
          setResolveProgress(i + 1);
        }
      }

      if (ctrl.signal.aborted) return;

      setEpisodeStreams(results);
      setStep("picking");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imdbId, seasonNumber]
  );

  // ── Lancer la résolution (appel direct depuis les boutons du scope) ──────────
  const startSeasonResolving = useCallback(() => {
    setScope("season");
    void resolveEpisodes(episodes);
  }, [episodes, resolveEpisodes]);

  const startEpisodeResolving = useCallback(
    (ep: TMDbEpisode) => {
      setScope("episode");
      setSelectedEpisodeNum(ep.episode_number);
      void resolveEpisodes([ep]);
    },
    [resolveEpisodes]
  );

  // ── Probe de l'épisode de référence ────────────────────────────────────────
  const probeStream = useCallback(
    async (stream: ParsedStream) => {
      setSelectedStream(stream);
      setStep("probing");
      setError(null);

      try {
        const res = await fetch("/api/download/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: stream.url, title: showTitle, type: "series" }),
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
        const defaultAudio = audioFre ?? audioEng ?? ps.find((s) => s.codec_type === "audio");
        if (defaultAudio) defaults.add(defaultAudio.index);
        const subForced = ps.find(
          (s) =>
            s.codec_type === "subtitle" &&
            ["fre", "fra"].includes(s.language.toLowerCase()) &&
            /forc/i.test(s.title)
        );
        if (subForced) defaults.add(subForced.index);

        setSelectedTracks(defaults);
        setStep("selecting");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'analyse du flux.");
        setStep("error");
      }
    },
    [showTitle]
  );

  // ── Soumission ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!user || !selectedStream) return;
    setStep("submitting");

    const audioLangs = probeStreams
      .filter((s) => s.codec_type === "audio" && selectedTracks.has(s.index))
      .map((s) => s.language)
      .filter(Boolean);
    const subLangs = probeStreams
      .filter((s) => s.codec_type === "subtitle" && selectedTracks.has(s.index))
      .map((s) => s.language)
      .filter(Boolean);

    const sNum = pad2(seasonNumber);
    const indices = Array.from(selectedTracks);

    if (scope === "season") {
      // Batch : construire les URLs pour chaque épisode
      const urls: string[] = [];
      for (const epData of episodeStreams) {
        const url = matchBestUrl(epData.streams, selectedStream);
        if (url) urls.push(url);
      }

      if (urls.length === 0) {
        setError("Aucune URL disponible pour lancer le batch.");
        setStep("error");
        return;
      }

      const resolvedCount = episodeStreams.filter((e) => !e.error && e.streams.length > 0).length;
      const urlCount = urls.length;

      startBatch(
        {
          urls,
          reference_indices: indices,
          destination_dir: `/mnt/nas/Series/${showTitle}/Saison ${sNum}/`,
          audio_languages: audioLangs,
          sub_languages: subLangs,
          metadata: {
            title: `${showTitle} — Saison ${seasonNumber}`,
            type: "tv",
            user_id: user.id,
            user_name: user.name,
            tmdb_id: showTmdbId,
            season_number: seasonNumber,
          },
        },
        {
          onSuccess: () => {
            void resolvedCount; // consumed
            void urlCount;
            setStep("success");
            setTimeout(handleClose, 2500);
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
            setStep("error");
          },
        }
      );
    } else {
      // Single episode
      const epNum = selectedEpisodeNum ?? 1;
      const file = sanitizeFilename(showTitle);
      const eNum = pad2(epNum);
      const destPath = `/mnt/nas/Series/${showTitle}/Saison ${sNum}/${file}.S${sNum}E${eNum}.mkv`;

      startSingle(
        {
          url: selectedStream.url,
          selected_indices: indices,
          destination_path: destPath,
          audio_languages: audioLangs,
          sub_languages: subLangs,
          metadata: {
            title: showTitle,
            type: "tv",
            user_id: user.id,
            user_name: user.name,
            tmdb_id: showTmdbId,
            season_number: seasonNumber,
            episode_number: epNum,
          },
        },
        {
          onSuccess: () => {
            setStep("success");
            setTimeout(handleClose, 2500);
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
            setStep("error");
          },
        }
      );
    }
  }, [
    user,
    selectedStream,
    probeStreams,
    selectedTracks,
    scope,
    seasonNumber,
    showTitle,
    showTmdbId,
    episodeStreams,
    selectedEpisodeNum,
    startBatch,
    startSingle,
    handleClose,
  ]);

  // ── Ouvrir la modale ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep("scope");
  }, [open]);

  // ── Retour ──────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === "picking") setStep("scope");
    else if (step === "selecting") setStep("picking");
    else if (step === "error") setStep("picking");
  };

  // ── Dérivés ─────────────────────────────────────────────────────────────────
  const videoTracks = probeStreams.filter((s) => s.codec_type === "video");
  const audioTracks = probeStreams.filter((s) => s.codec_type === "audio");
  const subTracks   = probeStreams.filter((s) => s.codec_type === "subtitle");

  const isBatchScope = scope === "season";
  const episodesWithStreams = episodeStreams.filter((e) => !e.error && e.streams.length > 0).length;
  const episodesWithErrors  = episodeStreams.filter((e) => e.error || e.streams.length === 0).length;

  const TITLE_MAP: Partial<Record<Step, string>> = {
    scope:      "Télécharger sur Jellyfin",
    resolving:  "Résolution des sources…",
    picking:    "Choisir la qualité",
    probing:    "Analyse en cours…",
    selecting:  "Configurer les pistes",
    submitting: "Lancement…",
    success:    "Ajouté à la file !",
    error:      "Erreur",
  };

  const hasBack = step === "picking" || step === "selecting" || step === "error";
  const hideClose = step === "resolving" || step === "probing" || step === "submitting";

  const sNum = pad2(seasonNumber);
  const destDir  = `/mnt/nas/Series/${showTitle}/Saison ${sNum}/`;
  const destFile = selectedEpisodeNum !== null
    ? `${destDir}${sanitizeFilename(showTitle)}.S${sNum}E${pad2(selectedEpisodeNum)}.mkv`
    : destDir;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-(--z-modal) bg-black/75 backdrop-blur-md"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby="season-dl-body">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-(--z-modal) w-[calc(100vw-2rem)] max-w-115 max-h-[88dvh] flex flex-col rounded-3xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none overflow-hidden"
              >
                {/* ── Header ─────────────────────────────────────────────── */}
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
                    <Dialog.Title className="text-white font-semibold text-base leading-tight">
                      {TITLE_MAP[step] ?? "Télécharger"}
                    </Dialog.Title>
                    <p className="text-white/40 text-xs truncate mt-0.5">
                      {showTitle} — Saison {seasonNumber}
                      {scope === "episode" && selectedEpisodeNum !== null && ` — Ép. ${selectedEpisodeNum}`}
                    </p>
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

                {/* ── Corps scrollable ────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-3" id="season-dl-body">
                  <AnimatePresence mode="wait">

                    {/* ════ SCOPE ══════════════════════════════════════════ */}
                    {step === "scope" && (
                      <motion.div
                        key="scope"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-3 pt-1"
                      >
                        {!imdbId && (
                          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                            <AlertCircle className="size-4 text-red-400 shrink-0 mt-px" />
                            <p className="text-xs text-red-300/90 leading-relaxed">
                              Identifiant IMDB manquant — les sources Stremio ne pourront pas être résolues pour cette série.
                            </p>
                          </div>
                        )}
                        <p className="text-white/45 text-sm">Que souhaitez-vous télécharger ?</p>

                        {/* Saison complète */}
                        <button
                          onClick={startSeasonResolving}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-nemo-accent/30 hover:bg-nemo-accent/5 transition-all text-left group"
                        >
                          <div className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-nemo-accent/15">
                            <Layers className="size-5 text-nemo-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-white font-semibold text-sm block">
                              Saison {seasonNumber} complète
                            </span>
                            <span className="text-white/40 text-xs">
                              {episodes.length} épisode{episodes.length > 1 ? "s" : ""} — Batch intelligent
                            </span>
                          </div>
                          <ChevronRight className="size-4 text-white/25 group-hover:text-nemo-accent transition-colors" />
                        </button>

                        {/* Épisode spécifique */}
                        <div className="space-y-2">
                          <p className="text-white/30 text-xs px-1">Ou choisir un épisode précis :</p>
                          <div className="max-h-64 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
                            {episodes.map((ep) => (
                              <button
                                key={ep.id}
                                onClick={() => startEpisodeResolving(ep)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
                              >
                                <span className="text-white/30 text-sm tabular-nums shrink-0 w-7">
                                  {ep.episode_number}
                                </span>
                                <span className="flex-1 text-white/75 text-sm font-medium truncate group-hover:text-white transition-colors">
                                  {ep.name}
                                </span>
                                {ep.runtime && (
                                  <span className="text-white/25 text-xs tabular-nums shrink-0">
                                    {ep.runtime}min
                                  </span>
                                )}
                                <Film className="size-3.5 text-white/20 group-hover:text-nemo-accent/60 shrink-0 transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ════ RESOLVING ══════════════════════════════════════ */}
                    {step === "resolving" && (
                      <motion.div
                        key="resolving"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-12 gap-5"
                      >
                        <div className="relative size-14 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-[#00a4dc]/20" />
                          <Loader2 className="size-7 text-[#00a4dc] animate-spin" />
                        </div>
                        <div className="text-center space-y-2 w-full max-w-xs">
                          <p className="text-white/80 font-medium text-sm">
                            {isBatchScope
                              ? `Résolution des sources : ${resolveProgress}/${resolveTotal}`
                              : "Recherche des sources…"}
                          </p>
                          {isBatchScope && resolveTotal > 0 && (
                            <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-[#00a4dc] rounded-full transition-all duration-300"
                                style={{ width: `${(resolveProgress / resolveTotal) * 100}%` }}
                              />
                            </div>
                          )}
                          <p className="text-white/30 text-xs">
                            {isBatchScope
                              ? `Épisode ${resolveProgress} sur ${resolveTotal}`
                              : "Récupération des liens Debrid…"}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* ════ PICKING SOURCE ═════════════════════════════════ */}
                    {step === "picking" && (
                      <motion.div
                        key="picking"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-3"
                      >
                        {/* Info batch */}
                        {isBatchScope && (
                          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-nemo-accent/8 border border-nemo-accent/20">
                            <Layers className="size-4 text-nemo-accent shrink-0 mt-px" />
                            <div className="text-xs text-nemo-accent/90 leading-relaxed">
                              <strong>{episodesWithStreams}</strong> épisode{episodesWithStreams > 1 ? "s" : ""} résolus
                              {episodesWithErrors > 0 && (
                                <span className="text-orange-400/80 ml-1">
                                  · {episodesWithErrors} sans source
                                </span>
                              )}
                              . La qualité choisie sera appliquée à tous.
                            </div>
                          </div>
                        )}

                        <p className="text-white/35 text-xs px-0.5">
                          Sélectionne la qualité souhaitée (basé sur l&apos;épisode 1)
                        </p>

                        {ep1Streams.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                            <AlertCircle className="size-6 text-white/30" />
                            <p className="text-white/50 text-sm">Aucune source disponible</p>
                          </div>
                        ) : (
                          ep1Streams.slice(0, 12).map((s) => (
                            <StreamRow key={s.id} stream={s} onSelect={(st) => void probeStream(st)} />
                          ))
                        )}
                      </motion.div>
                    )}

                    {/* ════ PROBING ════════════════════════════════════════ */}
                    {step === "probing" && (
                      <motion.div
                        key="probing"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16 gap-4"
                      >
                        <div className="relative size-12 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-[#00a4dc]/20" />
                          <Loader2 className="size-6 text-[#00a4dc] animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-white/80 font-medium text-sm">Analyse du flux…</p>
                          <p className="text-white/35 text-xs mt-1">Détection des pistes audio et sous-titres</p>
                        </div>
                      </motion.div>
                    )}

                    {/* ════ SELECTING ══════════════════════════════════════ */}
                    {step === "selecting" && (
                      <motion.div
                        key="selecting"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-4"
                      >
                        {isBatchScope && (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-nemo-accent/8 border border-nemo-accent/25">
                            <Layers className="size-4 text-nemo-accent shrink-0" />
                            <p className="text-xs text-nemo-accent/90">
                              Mode batch — ces réglages seront appliqués à <strong>tous les épisodes</strong>.
                            </p>
                          </div>
                        )}

                        {videoTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Video className="size-3.5" /> Vidéo
                            </h3>
                            {videoTracks.map((s) => (
                              <TrackRow
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const n = new Set(prev);
                                    v ? n.add(s.index) : n.delete(s.index);
                                    return n;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        {audioTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Music className="size-3.5" /> Audio
                            </h3>
                            {audioTracks.map((s) => (
                              <TrackRow
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const n = new Set(prev);
                                    v ? n.add(s.index) : n.delete(s.index);
                                    return n;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        {subTracks.length > 0 && (
                          <section className="space-y-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                              <Subtitles className="size-3.5" /> Sous-titres
                            </h3>
                            {subTracks.map((s) => (
                              <TrackRow
                                key={s.index}
                                stream={s}
                                checked={selectedTracks.has(s.index)}
                                onChange={(v) =>
                                  setSelectedTracks((prev) => {
                                    const n = new Set(prev);
                                    v ? n.add(s.index) : n.delete(s.index);
                                    return n;
                                  })
                                }
                              />
                            ))}
                          </section>
                        )}

                        <section className="space-y-1.5">
                          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/35 uppercase tracking-wider">
                            <FolderOpen className="size-3.5" /> Destination NAS
                          </h3>
                          <div className="px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                            <code className="text-[11px] text-white/40 font-mono break-all leading-relaxed">
                              {isBatchScope ? destDir : destFile}
                            </code>
                          </div>
                          {isBatchScope && (
                            <p className="text-white/25 text-[11px] px-1">
                              Les fichiers seront nommés automatiquement par le backend (Episode_01.mkv, …)
                            </p>
                          )}
                        </section>
                      </motion.div>
                    )}

                    {/* ════ SUBMITTING ═════════════════════════════════════ */}
                    {step === "submitting" && (
                      <motion.div
                        key="submitting"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16 gap-4"
                      >
                        <Loader2 className="size-8 text-nemo-accent animate-spin" />
                        <p className="text-white/60 text-sm">Envoi à la file d&apos;attente…</p>
                      </motion.div>
                    )}

                    {/* ════ SUCCESS ════════════════════════════════════════ */}
                    {step === "success" && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="flex flex-col items-center justify-center py-14 gap-3 text-center"
                      >
                        <CheckCircle2 className="size-12 text-emerald-400" />
                        <p className="text-white font-semibold">
                          {isBatchScope ? "Saison ajoutée à la file !" : "Épisode ajouté à la file !"}
                        </p>
                        <p className="text-white/40 text-sm max-w-xs leading-relaxed">
                          {isBatchScope
                            ? `${episodeStreams.filter((e) => e.streams.length > 0).length} épisode(s) seront téléchargés sur votre Jellyfin.`
                            : "Le téléchargement a été lancé sur votre serveur Jellyfin."}
                        </p>
                      </motion.div>
                    )}

                    {/* ════ ERROR ══════════════════════════════════════════ */}
                    {step === "error" && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4"
                      >
                        <AlertCircle className="size-8 text-red-400/80" />
                        <div>
                          <p className="text-white/80 font-medium text-sm">Erreur</p>
                          <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-xs">
                            {error ?? "Une erreur inattendue s'est produite."}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStep("scope")}
                            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
                          >
                            <ArrowLeft className="size-3.5" />
                            Recommencer
                          </button>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>

                {/* ── Footer CTA ──────────────────────────────────────────── */}
                {step === "selecting" && (
                  <div className="px-4 py-3 border-t border-white/8 shrink-0">
                    <button
                      onClick={handleSubmit}
                      disabled={selectedTracks.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00a4dc] hover:bg-[#00b5e8] text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="size-4" />
                      {isBatchScope
                        ? `Télécharger la saison ${seasonNumber} (${episodeStreams.filter((e) => e.streams.length > 0).length} ép.)`
                        : `Télécharger l'épisode ${selectedEpisodeNum}`}
                      <ChevronRight className="size-4 ml-auto" />
                    </button>
                    <p className="text-center text-white/25 text-xs mt-2">
                      {selectedTracks.size} piste{selectedTracks.size > 1 ? "s" : ""} sélectionnée{selectedTracks.size > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
