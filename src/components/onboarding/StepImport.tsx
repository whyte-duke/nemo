"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Upload,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Film,
  ExternalLink,
  X,
  FileArchive,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "@/components/ui/ProviderLogo";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import type { ImportResults } from "@/app/onboarding/page";

type ServiceState = "idle" | "connecting" | "connected" | "importing" | "imported" | "error";

interface StepImportProps {
  onNext: (results: ImportResults) => void;
  initialResults: ImportResults;
}

// ── Parseur CSV Netflix ──────────────────────────────────────────────────────
// Format actuel : "Title","Date" avec Date au format M/DD/YY

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** Convertit "M/DD/YY" ou "M/D/YY" → "YYYY-MM-DD" */
function parseDateMDYY(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return "";
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year2 = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year2)) return "";
  const fullYear = year2 < 100 ? 2000 + year2 : year2;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Extrait le titre de la série si c'est un épisode (Saison/Season) */
function extractShowName(title: string): string {
  // "Black Mirror: Saison 3: Haine virtuelle" → "Black Mirror"
  // "Altered Carbon: Season 1: Episode" → "Altered Carbon"
  const m = /^(.+?): (?:Saison|Season)\s+\d+/i.exec(title);
  return m ? m[1].trim() : title.trim();
}

function parseNetflixCSV(text: string): { title: string; date: string }[] {
  const lines = text.split("\n");
  const entries: { title: string; date: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    // Col 0 = Title, Col 1 = Date
    const rawTitle = cols[0]?.trim() ?? "";
    const rawDate = cols[1]?.trim() ?? "";

    // Ignorer la ligne d'en-tête (Title, Date)
    if (!rawTitle || rawTitle.toLowerCase() === "title") continue;
    // Ignorer si la "date" ne ressemble pas à une date
    if (!rawDate || !/^\d+\/\d+\/\d+$/.test(rawDate)) continue;

    const title = extractShowName(rawTitle);
    const date = parseDateMDYY(rawDate);
    if (!title || !date) continue;

    entries.push({ title, date });
  }

  // Dédupliquer par titre (on ne garde qu'une entrée par titre unique)
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function StepImport({ onNext, initialResults }: StepImportProps) {
  const searchParams = useSearchParams();

  const [letterboxdState, setLetterboxdState] = useState<ServiceState>("idle");
  const [letterboxdCount, setLetterboxdCount] = useState(0);
  const [traktState, setTraktState] = useState<ServiceState>("idle");
  const [traktCount, setTraktCount] = useState(0);
  const [netflixState, setNetflixState] = useState<ServiceState>("idle");
  const [netflixCount, setNetflixCount] = useState(0);
  const [netflixExpanded, setNetflixExpanded] = useState(false);
  const [netflixError, setNetflixError] = useState<string | null>(null);
  const [netflixDragging, setNetflixDragging] = useState(false);
  const [netflixFileName, setNetflixFileName] = useState<string | null>(null);

  const [lbExpanded, setLbExpanded] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [lbDragging, setLbDragging] = useState(false);
  const [lbFileName, setLbFileName] = useState<string | null>(null);

  // Jellyfin
  const [jellyfinState, setJellyfinState] = useState<ServiceState>("idle");
  const [jellyfinCount, setJellyfinCount] = useState(0);
  const [jellyfinHasAccount, setJellyfinHasAccount] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lbFileInputRef = useRef<HTMLInputElement>(null);
  const importCalledRef = useRef<Set<string>>(new Set());

  // Vérifier si le compte Jellyfin est connecté
  useEffect(() => {
    void fetch("/api/profile").then((r) => r.json()).then((d: { profile?: { jellyfin_user_id?: string | null } }) => {
      setJellyfinHasAccount(!!d.profile?.jellyfin_user_id);
    });
  }, []);

  // Restore results from parent state (si retour sur l'étape)
  useEffect(() => {
    if (initialResults.letterboxd) {
      setLetterboxdState("imported");
      setLetterboxdCount(initialResults.letterboxd.count);
    }
    if (initialResults.trakt) {
      setTraktState("imported");
      setTraktCount(initialResults.trakt.count);
    }
    if (initialResults.netflix) {
      setNetflixState("imported");
      setNetflixCount(initialResults.netflix.count);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Détecter le retour depuis OAuth
  const connected = searchParams.get("connected");

  const runImport = useCallback(async (service: "trakt") => {
    if (importCalledRef.current.has(service)) return;
    importCalledRef.current.add(service);

    setTraktState("importing");
    try {
      const res = await fetch(`/api/import/${service}`, { method: "POST" });
      const data = (await res.json()) as { count?: number; error?: string };
      if (res.ok && data.count !== undefined) {
        setTraktCount(data.count);
        setTraktState("imported");
      } else {
        setTraktState("error");
      }
    } catch {
      setTraktState("error");
    }
  }, []);

  useEffect(() => {
    if (connected === "trakt" && traktState === "idle") {
      setTraktState("connected");
      void runImport("trakt");
    }
  }, [connected, traktState, runImport]);

  // ── OAuth Trakt ────────────────────────────────────────────────────────────

  const connectTrakt = () => {
    setTraktState("connecting");
    window.location.href = `/api/auth/trakt?return=/onboarding?step=2`;
  };

  // ── Netflix CSV ─────────────────────────────────────────────────────────────

  const processNetflixFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNetflixError("Le fichier doit être un CSV (.csv)");
      return;
    }
    setNetflixFileName(file.name);
    setNetflixState("importing");
    setNetflixError(null);

    let entries: { title: string; date: string }[] = [];
    try {
      const text = await file.text();
      entries = parseNetflixCSV(text);
      if (entries.length === 0) {
        setNetflixError("Aucune entrée trouvée. Vérifiez le format du fichier Netflix.");
        setNetflixState("idle");
        return;
      }
    } catch {
      setNetflixError("Impossible de lire le fichier");
      setNetflixState("idle");
      return;
    }

    // Envoyer en arrière-plan — le "Continuer" reste toujours cliquable
    try {
      const res = await fetch("/api/import/netflix-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
        // keepalive permet à la requête de continuer même si l'utilisateur navigue
        keepalive: entries.length <= 500,
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (res.ok && data.count !== undefined) {
        setNetflixCount(data.count);
        setNetflixState("imported");
        setNetflixExpanded(false);
      } else {
        setNetflixError(data.error ?? "Erreur lors de l'import");
        setNetflixState("idle");
      }
    } catch {
      setNetflixError("Connexion interrompue — les données ont peut-être été partiellement importées");
      setNetflixState("idle");
    }
  };

  const handleNetflixFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processNetflixFile(file);
    e.target.value = "";
  };

  const handleNetflixDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setNetflixDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processNetflixFile(file);
  };

  // ── Letterboxd ZIP ─────────────────────────────────────────────────────────

  const processLetterboxdFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".zip") && !name.endsWith(".csv")) {
      setLbError("Uploadez le fichier .zip Letterboxd ou un fichier .csv (ratings.csv)");
      return;
    }
    setLbFileName(file.name);
    setLetterboxdState("importing");
    setLbError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/letterboxd-zip", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { count?: number; total?: number; error?: string };
      if (res.ok && data.count !== undefined) {
        setLetterboxdCount(data.count);
        setLetterboxdState("imported");
        setLbExpanded(false);
      } else {
        setLbError(data.error ?? "Erreur lors de l'import");
        setLetterboxdState("idle");
      }
    } catch {
      setLbError("Connexion interrompue");
      setLetterboxdState("idle");
    }
  };

  const handleLbFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processLetterboxdFile(file);
    e.target.value = "";
  };

  const handleLbDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLbDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processLetterboxdFile(file);
  };

  // ── Continuer — toujours disponible, même pendant un import ────────────────

  const handleContinue = () => {
    const results: ImportResults = {};
    if (letterboxdState === "imported") results.letterboxd = { count: letterboxdCount };
    if (traktState === "imported") results.trakt = { count: traktCount };
    if (netflixState === "imported") results.netflix = { count: netflixCount };
    onNext(results);
  };

  const importJellyfin = async () => {
    setJellyfinState("importing");
    try {
      const res = await fetch("/api/import/jellyfin", { method: "POST" });
      const data = (await res.json()) as { count?: number; error?: string };
      if (res.ok && data.count !== undefined) {
        setJellyfinCount(data.count);
        setJellyfinState("imported");
      } else {
        setJellyfinState("error");
      }
    } catch {
      setJellyfinState("error");
    }
  };

  const isTraktAvailable = !!process.env.NEXT_PUBLIC_TRAKT_ENABLED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-white font-bold text-xl mb-2">Importez votre historique</h2>
        <p className="text-white/50 text-sm">
          Connectez vos comptes pour importer vos films et séries déjà vus.
          Toutes les étapes sont optionnelles — vous pouvez continuer à tout moment.
        </p>
      </div>

      {/* Services */}
      <div className="space-y-3">

        {/* ── Netflix ─────────────────────────────────────────────────────── */}
        <ServiceRow
          provider="netflix"
          name="Netflix"
          description="Importez votre historique via un fichier CSV"
          state={netflixState}
          importedCount={netflixCount}
          actionLabel={netflixExpanded ? "Fermer" : "Importer via CSV"}
          onAction={() => {
            if (netflixState !== "importing") setNetflixExpanded((v) => !v);
          }}
        >
          <AnimatePresence initial={false}>
            {netflixExpanded && (
              <motion.div
                key="netflix-csv"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-white/40 bg-white/5 rounded-xl p-3">
                    <ExternalLink className="size-3.5 shrink-0 mt-0.5 text-white/30" />
                    <span>
                      Rendez-vous sur{" "}
                      <a href="https://www.netflix.com/WiViewingActivity" target="_blank" rel="noopener noreferrer" className="text-[#E50914] hover:underline">
                        netflix.com/WiViewingActivity
                      </a>
                      , scrollez en bas et cliquez sur &ldquo;Télécharger tout&rdquo;.
                    </span>
                  </div>
                  <DropZone
                    accept=".csv"
                    label="NetflixViewingHistory.csv"
                    dragging={netflixDragging}
                    loading={netflixState === "importing"}
                    fileName={netflixFileName}
                    error={netflixError}
                    inputRef={fileInputRef}
                    onDragOver={() => setNetflixDragging(true)}
                    onDragLeave={() => setNetflixDragging(false)}
                    onDrop={handleNetflixDrop}
                    onChange={handleNetflixFileChange}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ServiceRow>

        {/* ── Letterboxd ──────────────────────────────────────────────────── */}
        <ServiceRow
          provider="letterboxd"
          name="Letterboxd"
          description="Importez notes et journal via l'export ZIP"
          state={letterboxdState}
          importedCount={letterboxdCount}
          actionLabel={lbExpanded ? "Fermer" : "Importer ZIP / CSV"}
          onAction={() => {
            if (letterboxdState !== "importing") setLbExpanded((v) => !v);
          }}
        >
          <AnimatePresence initial={false}>
            {lbExpanded && (
              <motion.div
                key="lb-zip"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-white/40 bg-white/5 rounded-xl p-3">
                    <ExternalLink className="size-3.5 shrink-0 mt-0.5 text-white/30" />
                    <span>
                      Allez sur{" "}
                      <a href="https://letterboxd.com/settings/data" target="_blank" rel="noopener noreferrer" className="text-[#00C030] hover:underline">
                        letterboxd.com/settings/data
                      </a>
                      {" "}→ &ldquo;Export your data&rdquo;. Uploadez le fichier .zip ou juste <code className="text-white/50">ratings.csv</code>.
                    </span>
                  </div>
                  <DropZone
                    accept=".zip,.csv"
                    label="letterboxd-export.zip ou ratings.csv"
                    icon={<FileArchive className="size-6 text-white/30 mx-auto mb-2" />}
                    dragging={lbDragging}
                    loading={letterboxdState === "importing"}
                    fileName={lbFileName}
                    error={lbError}
                    inputRef={lbFileInputRef}
                    onDragOver={() => setLbDragging(true)}
                    onDragLeave={() => setLbDragging(false)}
                    onDrop={handleLbDrop}
                    onChange={handleLbFileChange}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ServiceRow>

        {/* ── Trakt.tv ────────────────────────────────────────────────────── */}
        <ServiceRow
          provider="trakt"
          name="Trakt.tv"
          description={
            isTraktAvailable
              ? "Importez votre historique films & séries"
              : "Bientôt disponible"
          }
          state={isTraktAvailable ? traktState : "idle"}
          importedCount={traktCount}
          actionLabel="Connecter"
          onAction={isTraktAvailable ? connectTrakt : undefined}
          disabled={!isTraktAvailable}
        />

        {/* ── Jellyfin ─────────────────────────────────────────────────────── */}
        <ServiceRow
          icon={<JellyfinIcon className="size-5" style={{ color: "#00A4DC" }} />}
          name="Jellyfin"
          description={
            jellyfinHasAccount === null
              ? "Chargement…"
              : jellyfinHasAccount
              ? "Importez l'historique depuis votre serveur Jellyfin"
              : "Connectez d'abord votre compte dans les Paramètres"
          }
          state={jellyfinHasAccount === false ? "idle" : jellyfinState}
          importedCount={jellyfinCount}
          actionLabel="Importer"
          onAction={jellyfinHasAccount ? () => void importJellyfin() : undefined}
          disabled={!jellyfinHasAccount}
        />
      </div>

      {/* Note import en cours */}
      {netflixState === "importing" && (
        <p className="text-white/30 text-xs text-center">
          L&apos;import Netflix continue même si vous passez à l&apos;étape suivante.
        </p>
      )}

      {/* Boutons bas */}
      <div className="flex items-center justify-between pt-2 gap-4">
        <button
          onClick={handleContinue}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          Continuer sans importer
        </button>
        <button
          onClick={handleContinue}
          className="flex items-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <ArrowRight className="size-4" />
          Continuer
        </button>
      </div>
    </motion.div>
  );
}

// ── DropZone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  accept: string;
  label: string;
  icon?: React.ReactNode;
  dragging: boolean;
  loading: boolean;
  fileName: string | null;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function DropZone({ accept, label, icon, dragging, loading, fileName, error, inputRef, onDragOver, onDragLeave, onDrop, onChange }: DropZoneProps) {
  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          loading ? "cursor-wait" : "cursor-pointer",
          dragging
            ? "border-nemo-accent/60 bg-nemo-accent/5"
            : "border-white/15 hover:border-white/30 hover:bg-white/3"
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-6 text-nemo-accent animate-spin mx-auto" />
            <p className="text-white/60 text-sm">{fileName}</p>
            <p className="text-white/30 text-xs">Import en cours… vous pouvez continuer</p>
          </div>
        ) : (
          <>
            {icon ?? <Upload className="size-6 text-white/30 mx-auto mb-2" />}
            <p className="text-white/50 text-sm">
              Glissez votre fichier ici ou{" "}
              <span className="text-nemo-accent">cliquez pour choisir</span>
            </p>
            <p className="text-white/25 text-xs mt-1">{label}</p>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-red-400 text-xs">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      )}
    </>
  );
}

// ── ServiceRow ───────────────────────────────────────────────────────────────

interface ServiceRowProps {
  /** Si fourni, affiche le logo du provider (Netflix, Letterboxd, Trakt) au lieu de logo/logoColor. */
  provider?: string;
  /** Icône custom React à afficher à la place du provider logo. */
  icon?: React.ReactNode;
  name: string;
  description: string;
  state: ServiceState;
  importedCount: number;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

function ServiceRow({
  provider,
  icon,
  name,
  description,
  state,
  importedCount,
  actionLabel,
  onAction,
  disabled,
  children,
}: ServiceRowProps) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-4">
        {/* Logo */}
        {provider ? (
          <ProviderLogo provider={provider} size="md" showBrandBackground ariaLabel={name} />
        ) : icon ? (
          <div className="size-10 rounded-xl bg-[#00A4DC]/15 flex items-center justify-center shrink-0">
            {icon}
          </div>
        ) : null}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{name}</p>
          <p className="text-white/40 text-xs truncate">{description}</p>
        </div>

        {/* État + bouton */}
        <div className="shrink-0">
          {state === "imported" ? (
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <Check className="size-4" />
              <Film className="size-3" />
              <span>{importedCount}</span>
            </div>
          ) : state === "importing" || state === "connecting" ? (
            <Loader2 className="size-5 text-nemo-accent animate-spin" />
          ) : state === "error" ? (
            <div className="flex items-center gap-1.5 text-red-400 text-xs">
              <X className="size-4" />
              Erreur
            </div>
          ) : (
            <button
              onClick={onAction}
              disabled={disabled || !onAction}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                disabled || !onAction
                  ? "glass border-white/8 text-white/20 cursor-not-allowed"
                  : "glass border-white/20 text-white/70 hover:text-white hover:border-white/40"
              )}
            >
              {actionLabel}
              {!disabled && <ChevronDown className="size-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Zone expandable (Netflix CSV) */}
      {children}
    </div>
  );
}
