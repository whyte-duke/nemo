"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Film,
  Tv,
  ChevronDown,
  ChevronRight,
  Layers,
  FolderOpen,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDownloadQueue } from "@/hooks/use-downloads";
import type { DownloadQueueRow, DownloadStatus } from "@/types/download";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  fre: "FR", fra: "FR",
  eng: "EN",
  spa: "ES",
  ger: "DE", deu: "DE",
  ita: "IT",
  por: "PT",
  jpn: "JP",
  chi: "ZH", zho: "ZH",
  kor: "KO",
  und: "?",
};

function langShort(code: string): string {
  return LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "à l'instant";
  if (mins < 60)  return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours} h`;
  if (days < 7)   return `il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Badge de statut ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DownloadStatus, { label: string; icon: React.ElementType; classes: string }> = {
  pending:     { label: "En attente",    icon: Clock,         classes: "text-white/50  bg-white/8   border-white/15" },
  downloading: { label: "En cours",      icon: Loader2,       classes: "text-blue-400  bg-blue-400/10 border-blue-400/25" },
  completed:   { label: "Terminé",       icon: CheckCircle2,  classes: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25" },
  error:       { label: "Erreur",        icon: AlertCircle,   classes: "text-red-400   bg-red-400/10  border-red-400/25" },
};

function StatusBadge({ status }: { status: DownloadStatus }) {
  const { label, icon: Icon, classes } = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold", classes)}>
      <Icon className={cn("size-3", status === "downloading" && "animate-spin")} />
      {label}
    </span>
  );
}

// ─── Drawer de détail ─────────────────────────────────────────────────────────

function DownloadDetailDrawer({
  item,
  onClose,
}: {
  item: DownloadQueueRow;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 glass-tile rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          {item.media_type === "movie"
            ? <Film className="size-4 text-nemo-accent shrink-0" />
            : <Tv className="size-4 text-blue-400 shrink-0" />
          }
          <p className="text-white font-semibold text-sm truncate">{item.media_title}</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="shrink-0 size-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ml-2">
          <X className="size-3.5 text-white/50" />
        </button>
      </div>

      {/* Contenu */}
      <div className="px-4 py-4 space-y-3.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <StatusBadge status={item.status} />
          <span className="text-white/30 text-xs shrink-0">{relativeTime(item.created_at)}</span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt className="text-white/40">Type</dt>
          <dd className="text-white/75">{item.media_type === "movie" ? "Film" : "Série"}</dd>

          {item.season_number !== null && (
            <>
              <dt className="text-white/40">Saison</dt>
              <dd className="text-white/75">{item.season_number}</dd>
            </>
          )}
          {item.episode_number !== null && (
            <>
              <dt className="text-white/40">Épisode</dt>
              <dd className="text-white/75">{item.episode_number}</dd>
            </>
          )}
          {item.quality && (
            <>
              <dt className="text-white/40">Qualité</dt>
              <dd className="text-white/75">{item.quality}</dd>
            </>
          )}
          {item.audio_languages.length > 0 && (
            <>
              <dt className="text-white/40">Audio</dt>
              <dd className="text-white/75">{item.audio_languages.map(langShort).join(", ")}</dd>
            </>
          )}
          {item.sub_languages.length > 0 && (
            <>
              <dt className="text-white/40">Sous-titres</dt>
              <dd className="text-white/75">{item.sub_languages.map(langShort).join(", ")}</dd>
            </>
          )}
          {item.is_batch && (
            <>
              <dt className="text-white/40">Mode</dt>
              <dd className="flex items-center gap-1 text-nemo-accent/80"><Layers className="size-3" /> Batch ({item.source_urls.length} fichiers)</dd>
            </>
          )}
          <dt className="text-white/40">Destination</dt>
          <dd className="font-mono text-[10px] text-white/45 break-all leading-relaxed">{item.destination_path}</dd>

          {item.file_path && (
            <>
              <dt className="text-white/40">Fichier</dt>
              <dd className="font-mono text-[10px] text-emerald-400/80 break-all leading-relaxed">{item.file_path}</dd>
            </>
          )}
          {item.error_log && (
            <>
              <dt className="text-white/40">Erreur</dt>
              <dd className="text-red-400/80 break-all leading-relaxed">{item.error_log}</dd>
            </>
          )}
          <dt className="text-white/40">Demandé par</dt>
          <dd className="flex items-center gap-1 text-white/75">
            <User className="size-3" />
            {item.user_name}
          </dd>
        </dl>
      </div>
    </motion.div>
  );
}

// ─── Ligne de download ────────────────────────────────────────────────────────

function DownloadRow({
  item,
  onSelect,
  isSelected,
}: {
  item: DownloadQueueRow;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <motion.button
      layout
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all",
        isSelected
          ? "border-nemo-accent/30 bg-nemo-accent/5"
          : "glass border-white/6 hover:border-white/15 hover:bg-white/4"
      )}
    >
      {/* Icône type */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-center size-10 rounded-xl",
          item.status === "completed" ? "bg-emerald-400/10 text-emerald-400"
            : item.status === "error" ? "bg-red-400/10 text-red-400"
            : item.status === "downloading" ? "bg-blue-400/10 text-blue-400"
            : "bg-white/8 text-white/40"
        )}
      >
        {item.is_batch
          ? <Layers className="size-5" />
          : item.media_type === "movie"
            ? <Film className="size-5" />
            : <Tv className="size-5" />
        }
      </div>

      {/* Infos principales */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-white font-medium text-sm truncate">{item.media_title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          {item.quality && (
            <span className="text-[11px] text-white/40 font-medium">{item.quality}</span>
          )}
          {item.audio_languages.length > 0 && (
            <span className="text-[11px] text-white/35">
              {item.audio_languages.map(langShort).join("·")}
            </span>
          )}
        </div>
      </div>

      {/* Date + flèche */}
      <div className="shrink-0 text-right space-y-1">
        <p className="text-white/30 text-xs">{relativeTime(item.created_at)}</p>
        <ChevronRight className={cn("size-4 text-white/20 ml-auto transition-transform", isSelected && "rotate-90 text-nemo-accent/60")} />
      </div>
    </motion.button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type FilterStatus = "all" | DownloadStatus;

export default function NotificationsPage() {
  const { data: downloads, isLoading, error, refetch } = useDownloadQueue();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = downloads?.filter((d) => filter === "all" || d.status === filter) ?? [];
  const selectedItem = downloads?.find((d) => d.id === selectedId) ?? null;

  const counts = {
    all:         downloads?.length ?? 0,
    pending:     downloads?.filter((d) => d.status === "pending").length ?? 0,
    downloading: downloads?.filter((d) => d.status === "downloading").length ?? 0,
    completed:   downloads?.filter((d) => d.status === "completed").length ?? 0,
    error:       downloads?.filter((d) => d.status === "error").length ?? 0,
  };

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: "all",         label: `Tout (${counts.all})` },
    { key: "downloading", label: `En cours (${counts.downloading})` },
    { key: "pending",     label: `En attente (${counts.pending})` },
    { key: "completed",   label: `Terminés (${counts.completed})` },
    { key: "error",       label: `Erreurs (${counts.error})` },
  ];

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Titre ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="size-6 text-nemo-accent" />
            <h1 className="text-2xl font-black text-white">Mes téléchargements</h1>
          </div>
          <button
            onClick={() => void refetch()}
            className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="size-3.5" />
            Actualiser
          </button>
        </div>

        {/* ── Filtres ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all",
                filter === f.key
                  ? "bg-nemo-accent/15 border-nemo-accent/40 text-nemo-accent"
                  : "glass border-white/10 text-white/45 hover:text-white hover:border-white/25"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── États ── */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="size-7 text-nemo-accent animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-red-400/70" />
            <p className="text-white/60 text-sm">Impossible de charger la file</p>
            <button
              onClick={() => void refetch()}
              className="text-nemo-accent text-sm hover:underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            {filter === "all" ? (
              <>
                <div className="size-16 rounded-2xl glass flex items-center justify-center">
                  <HardDrive className="size-7 text-white/20" />
                </div>
                <p className="text-white/50 font-medium text-sm">Aucun téléchargement</p>
                <p className="text-white/25 text-xs max-w-xs leading-relaxed">
                  Sélectionnez une source dans un film ou une série, puis cliquez sur
                  &ldquo;Télécharger sur Jellyfin&rdquo;.
                </p>
                <Link
                  href="/films"
                  className="mt-2 inline-flex items-center gap-2 text-nemo-accent text-sm hover:underline"
                >
                  <Film className="size-4" />
                  Parcourir les films
                </Link>
              </>
            ) : (
              <p className="text-white/40 text-sm">Aucun téléchargement dans cette catégorie</p>
            )}
          </div>
        )}

        {/* ── Liste ── */}
        {!isLoading && filtered.length > 0 && (
          <motion.div layout className="space-y-2">
            {filtered.map((item) => (
              <DownloadRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Drawer de détail ── */}
      <AnimatePresence>
        {selectedItem && (
          <DownloadDetailDrawer
            key={selectedItem.id}
            item={selectedItem}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
