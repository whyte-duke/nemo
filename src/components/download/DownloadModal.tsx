"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Loader2,
  Download,
  Video,
  Music,
  Subtitles,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useStartDownload, useStartBatchDownload } from "@/hooks/use-downloads";
import type { ProbeStream, DownloadMediaInfo } from "@/types/download";

// ─── Mapping codes langue ISO 639-2 → libellé FR ────────────────────────────

const LANG_LABELS: Record<string, string> = {
  fre: "Français", fra: "Français",
  eng: "Anglais",
  spa: "Espagnol",
  ger: "Allemand", deu: "Allemand",
  ita: "Italien",
  por: "Portugais",
  jpn: "Japonais",
  chi: "Chinois", zho: "Chinois",
  kor: "Coréen",
  rus: "Russe",
  ara: "Arabe",
  und: "Indéterminée",
  "":  "Inconnue",
};

function langLabel(code: string): string {
  return LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

// ─── Génération du chemin NAS ────────────────────────────────────────────────

function sanitizeFilename(str: string): string {
  return str
    .replace(/[?/\\:*"<>|]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function generatePath(info: DownloadMediaInfo, isBatch = false): string {
  const { type, title, year, seasonNumber, episodeNumber } = info;

  if (type === "movie") {
    const folderLabel = year ? `${title} (${year})` : title;
    const fileLabel   = sanitizeFilename(year ? `${title}.${year}` : title);
    return `/mnt/nas/Films/${folderLabel}/${fileLabel}.mkv`;
  }

  const sNum = pad2(seasonNumber ?? 1);
  const dir  = `/mnt/nas/Series/${title}/Saison ${sNum}/`;
  if (isBatch) return dir;

  const eNum = pad2(episodeNumber ?? 1);
  const file = sanitizeFilename(title);
  return `${dir}${file}.S${sNum}E${eNum}.mkv`;
}

// ─── Probe step ──────────────────────────────────────────────────────────────

type Step = "probing" | "selecting" | "submitting" | "success" | "error";

// ─── Track row ───────────────────────────────────────────────────────────────

function TrackRow({
  stream,
  checked,
  onChange,
}: {
  stream: ProbeStream;
  checked: boolean;
  onChange: (checked: boolean) => void;
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

// ─── Props ───────────────────────────────────────────────────────────────────

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  mediaInfo: DownloadMediaInfo;
  /** Mode batch : listes d'URLs supplémentaires (ex: tous les épisodes d'une saison) */
  batchUrls?: string[];
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function DownloadModal({ open, onClose, mediaInfo, batchUrls }: DownloadModalProps) {
  const { user } = useAuth();

  const isBatch = !!(batchUrls && batchUrls.length > 0);
  const [step, setStep]             = useState<Step>("probing");
  const [streams, setStreams]        = useState<ProbeStream[]>([]);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [probeError, setProbeError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { mutate: startDownload }      = useStartDownload();
  const { mutate: startBatchDownload } = useStartBatchDownload();

  // Dérive : groupes de pistes
  const videoStreams    = streams.filter((s) => s.codec_type === "video");
  const audioStreams    = streams.filter((s) => s.codec_type === "audio");
  const subtitleStreams = streams.filter((s) => s.codec_type === "subtitle");

  // Chemin de destination
  const destinationPath = generatePath(mediaInfo, isBatch);

  // ── Probe automatique à l'ouverture ────────────────────────────────────────
  const probe = useCallback(async () => {
    setStep("probing");
    setProbeError(null);

    try {
      const res = await fetch("/api/download/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mediaInfo.streamUrl,
          title: mediaInfo.title,
          type: mediaInfo.type,
        }),
      });

      if (!res.ok) throw new Error("Flux invalide ou expiré");

      const data = await res.json();
      if (data.status !== "success" || !Array.isArray(data.streams)) {
        throw new Error("Réponse inattendue du serveur");
      }

      const probeStreams: ProbeStream[] = data.streams;
      setStreams(probeStreams);

      // Smart defaults
      const defaults = new Set<number>();

      // Vidéo : 1ère piste
      const firstVideo = probeStreams.find((s) => s.codec_type === "video");
      if (firstVideo) defaults.add(firstVideo.index);

      // Audio : fre en priorité, sinon eng
      const audioFre = probeStreams.find(
        (s) => s.codec_type === "audio" && ["fre", "fra"].includes(s.language.toLowerCase())
      );
      const audioEng = probeStreams.find(
        (s) => s.codec_type === "audio" && s.language.toLowerCase() === "eng"
      );
      const defaultAudio = audioFre ?? audioEng ?? probeStreams.find((s) => s.codec_type === "audio");
      if (defaultAudio) defaults.add(defaultAudio.index);

      // Sous-titres : fre forcés
      const subForced = probeStreams.find(
        (s) =>
          s.codec_type === "subtitle" &&
          ["fre", "fra"].includes(s.language.toLowerCase()) &&
          /forc/i.test(s.title)
      );
      if (subForced) defaults.add(subForced.index);

      setSelected(defaults);
      setStep("selecting");
    } catch (err) {
      setProbeError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'analyse du flux. Le lien est invalide ou expiré."
      );
      setStep("error");
    }
  }, [mediaInfo]);

  // Relancer le probe quand la modale s'ouvre
  useEffect(() => {
    if (open) {
      void probe();
    }
  }, [open, probe]);

  // Reset au fermeture
  const handleClose = () => {
    setStep("probing");
    setStreams([]);
    setSelected(new Set());
    setProbeError(null);
    setSuccessMsg(null);
    onClose();
  };

  const toggleTrack = (index: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  // ── Récupère les langues sélectionnées ──────────────────────────────────────
  const selectedAudioLangs = audioStreams
    .filter((s) => selected.has(s.index))
    .map((s) => s.language)
    .filter(Boolean);

  const selectedSubLangs = subtitleStreams
    .filter((s) => selected.has(s.index))
    .map((s) => s.language)
    .filter(Boolean);

  // ── Lancer le téléchargement ─────────────────────────────────────────────
  const handleSubmit = () => {
    if (!user) return;

    setStep("submitting");

    const indices = Array.from(selected);
    const baseMetadata = {
      title: mediaInfo.title,
      type: mediaInfo.type,
      user_id: user.id,
      user_name: user.name,
      tmdb_id: mediaInfo.tmdbId,
      season_number: mediaInfo.seasonNumber,
      episode_number: mediaInfo.episodeNumber,
    };

    if (isBatch && batchUrls) {
      startBatchDownload(
        {
          urls: [mediaInfo.streamUrl, ...batchUrls],
          reference_indices: indices,
          destination_dir: destinationPath,
          audio_languages: selectedAudioLangs,
          sub_languages: selectedSubLangs,
          metadata: baseMetadata,
        },
        {
          onSuccess: (data) => {
            setSuccessMsg(data.message);
            setStep("success");
            setTimeout(handleClose, 2000);
          },
          onError: (err) => {
            setProbeError(err instanceof Error ? err.message : "Erreur inconnue");
            setStep("error");
          },
        }
      );
    } else {
      startDownload(
        {
          url: mediaInfo.streamUrl,
          selected_indices: indices,
          destination_path: destinationPath,
          audio_languages: selectedAudioLangs,
          sub_languages: selectedSubLangs,
          metadata: baseMetadata,
        },
        {
          onSuccess: (data) => {
            setSuccessMsg(data.message);
            setStep("success");
            setTimeout(handleClose, 2000);
          },
          onError: (err) => {
            setProbeError(err instanceof Error ? err.message : "Erreur inconnue");
            setStep("error");
          },
        }
      );
    }
  };

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
                className="fixed inset-0 z-(--z-modal) bg-black/80 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby="download-modal-desc">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-(--z-modal) w-full sm:w-130 max-h-[85dvh] flex flex-col rounded-2xl bg-[#0e1018] border border-white/8 shadow-2xl focus:outline-none"
              >
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-[#00a4dc]/15 text-[#00a4dc]">
                      <Download className="size-4" />
                    </div>
                    <div>
                      <Dialog.Title className="text-white font-semibold text-sm leading-tight">
                        Télécharger sur Jellyfin
                      </Dialog.Title>
                      <p className="text-white/40 text-xs truncate mt-0.5 max-w-64">
                        {mediaInfo.title}
                        {mediaInfo.seasonNumber !== undefined && mediaInfo.episodeNumber !== undefined && (
                          <> — S{pad2(mediaInfo.seasonNumber)}E{pad2(mediaInfo.episodeNumber)}</>
                        )}
                        {isBatch && (
                          <span className="ml-1 text-nemo-accent">Saison complète</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {(step === "selecting" || step === "error") && (
                    <Dialog.Close asChild>
                      <button
                        aria-label="Fermer"
                        className="ml-3 shrink-0 flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <X className="size-4 text-white/60" />
                      </button>
                    </Dialog.Close>
                  )}
                </div>

                {/* ── Corps scrollable ────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 p-4 space-y-4" id="download-modal-desc">

                  {/* ── Chargement (probe) ─────────────────────────────── */}
                  {step === "probing" && (
                    <div className="flex flex-col items-center justify-center py-14 gap-4">
                      <div className="relative size-12 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-[#00a4dc]/20" />
                        <Loader2 className="size-6 text-[#00a4dc] animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/80 font-medium text-sm">Analyse du flux média en cours…</p>
                        <p className="text-white/35 text-xs mt-1">Détection des pistes audio, vidéo et sous-titres</p>
                      </div>
                    </div>
                  )}

                  {/* ── Envoi en cours ────────────────────────────────── */}
                  {step === "submitting" && (
                    <div className="flex flex-col items-center justify-center py-14 gap-4">
                      <Loader2 className="size-7 text-nemo-accent animate-spin" />
                      <p className="text-white/70 text-sm">Envoi en cours…</p>
                    </div>
                  )}

                  {/* ── Succès ───────────────────────────────────────── */}
                  {step === "success" && (
                    <div className="flex flex-col items-center justify-center py-14 gap-4">
                      <CheckCircle2 className="size-10 text-emerald-400" />
                      <div className="text-center">
                        <p className="text-white font-semibold text-sm">
                          {successMsg ?? "Ajouté à la file d'attente !"}
                        </p>
                        <p className="text-white/35 text-xs mt-1">Vous serez notifié à la fin du téléchargement.</p>
                      </div>
                    </div>
                  )}

                  {/* ── Erreur ───────────────────────────────────────── */}
                  {step === "error" && (
                    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center px-4">
                      <AlertCircle className="size-8 text-red-400/80" />
                      <div>
                        <p className="text-white/80 font-medium text-sm">Erreur</p>
                        <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-xs">
                          {probeError ?? "Erreur lors de l'analyse du flux. Le lien est invalide ou expiré."}
                        </p>
                      </div>
                      <button
                        onClick={() => void probe()}
                        className="text-nemo-accent text-sm flex items-center gap-1.5 hover:underline"
                      >
                        <ArrowLeft className="size-3.5" />
                        Réessayer
                      </button>
                    </div>
                  )}

                  {/* ── Sélection des pistes ─────────────────────────── */}
                  {step === "selecting" && (
                    <>
                      {isBatch && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-nemo-accent/8 border border-nemo-accent/25">
                          <Layers className="size-4 text-nemo-accent shrink-0" />
                          <p className="text-xs text-nemo-accent/90">
                            Mode batch — ces réglages seront appliqués à <strong>tous les épisodes</strong> de la saison.
                          </p>
                        </div>
                      )}

                      {/* Vidéo */}
                      {videoStreams.length > 0 && (
                        <section className="space-y-2">
                          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                            <Video className="size-3.5" />
                            Vidéo
                          </h3>
                          {videoStreams.map((s) => (
                            <TrackRow
                              key={s.index}
                              stream={s}
                              checked={selected.has(s.index)}
                              onChange={(v) => toggleTrack(s.index, v)}
                            />
                          ))}
                        </section>
                      )}

                      {/* Audio */}
                      {audioStreams.length > 0 && (
                        <section className="space-y-2">
                          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                            <Music className="size-3.5" />
                            Audio
                          </h3>
                          {audioStreams.map((s) => (
                            <TrackRow
                              key={s.index}
                              stream={s}
                              checked={selected.has(s.index)}
                              onChange={(v) => toggleTrack(s.index, v)}
                            />
                          ))}
                        </section>
                      )}

                      {/* Sous-titres */}
                      {subtitleStreams.length > 0 && (
                        <section className="space-y-2">
                          <h3 className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                            <Subtitles className="size-3.5" />
                            Sous-titres
                          </h3>
                          {subtitleStreams.map((s) => (
                            <TrackRow
                              key={s.index}
                              stream={s}
                              checked={selected.has(s.index)}
                              onChange={(v) => toggleTrack(s.index, v)}
                            />
                          ))}
                        </section>
                      )}

                      {/* Destination */}
                      <section className="space-y-1.5">
                        <h3 className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                          <FolderOpen className="size-3.5" />
                          Destination NAS
                        </h3>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                          <code className="text-[11px] text-white/55 font-mono break-all leading-relaxed flex-1">
                            {destinationPath}
                          </code>
                        </div>
                      </section>
                    </>
                  )}
                </div>

                {/* ── Footer avec bouton lancer ────────────────────────── */}
                {step === "selecting" && (
                  <div className="px-4 py-3 border-t border-white/8 shrink-0">
                    <button
                      onClick={handleSubmit}
                      disabled={selected.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00a4dc] hover:bg-[#00b8f0] text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="size-4" />
                      {isBatch ? "Lancer le téléchargement de la saison" : "Lancer le téléchargement"}
                      <ChevronRight className="size-4 ml-auto" />
                    </button>
                    <p className="text-center text-white/25 text-xs mt-2">
                      {selected.size} piste{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
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
