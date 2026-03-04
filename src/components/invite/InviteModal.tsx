"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Zap,
  Lock,
  Copy,
  Check,
  Share2,
  Loader2,
  RefreshCw,
  Crown,
  UserPlus,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/hooks/use-profile";

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteRole = "sources" | "vip";

interface GeneratedInvite {
  token: string;
  url: string;
  role: string;
  label: string | null;
}

// ─── Constantes de design par rôle ───────────────────────────────────────────

const ROLE_CARDS = {
  sources: {
    icon: Zap,
    label: "Sources",
    tagline: "Accès aux streams",
    features: [
      "Sources StreamFusion",
      "Streaming haute qualité",
      "Bibliothèque complète",
    ],
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.18)",
    border: "border-violet-500/40",
    selectedBg: "bg-violet-500/12",
    textColor: "text-violet-400",
    badgeBg: "bg-violet-500/20",
    dot: "bg-violet-500",
  },
  vip: {
    icon: Crown,
    label: "VIP",
    tagline: "Accès ultra premium",
    features: [
      "Téléchargement Jellyfin",
      "Tous les services activés",
      "Serveur partagé inclus",
    ],
    color: "#e8b84b",
    glow: "rgba(232,184,75,0.18)",
    border: "border-nemo-accent/40",
    selectedBg: "bg-nemo-accent/12",
    textColor: "text-nemo-accent",
    badgeBg: "bg-nemo-accent/20",
    dot: "bg-nemo-accent",
  },
} as const;

// ─── QR Code via API publique (aucune dépendance) ────────────────────────────

function QRCode({ url, size = 180 }: { url: string; size?: number }) {
  const encoded = encodeURIComponent(url);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&color=e8b84b&bgcolor=0b0d14&format=png&qzone=2`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR Code d'invitation"
      width={size}
      height={size}
      className="rounded-xl"
      crossOrigin="anonymous"
    />
  );
}

// ─── Carte de rôle ───────────────────────────────────────────────────────────

function RoleCard({
  role,
  selected,
  locked,
  onSelect,
}: {
  role: InviteRole;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  const cfg = ROLE_CARDS[role];
  const Icon = cfg.icon;

  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      disabled={locked}
      className={cn(
        "relative flex-1 flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200 text-left overflow-hidden",
        locked ? "cursor-not-allowed" : "cursor-pointer",
        selected && !locked
          ? [cfg.border, cfg.selectedBg]
          : "border-white/8 bg-white/3",
        !locked && !selected && "hover:bg-white/6 hover:border-white/18"
      )}
      style={
        selected && !locked
          ? { boxShadow: `0 0 32px ${cfg.glow} inset, 0 0 0 1px ${cfg.color}30` }
          : undefined
      }
      aria-pressed={selected && !locked}
    >
      {/* ── Indicateur sélectionné ── */}
      <AnimatePresence>
        {selected && !locked && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "absolute top-2.5 right-2.5 size-5 rounded-full flex items-center justify-center",
              cfg.badgeBg
            )}
          >
            <Check className={cn("size-3", cfg.textColor)} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Badge Admin Only (VIP verrouillé) ── */}
      {locked && (
        <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm">
          <Shield className="size-2.5 text-white/30" />
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Admin</span>
        </span>
      )}

      {/* ── Icône ── */}
      <div
        className={cn(
          "size-10 rounded-xl flex items-center justify-center transition-all duration-200",
          locked
            ? "bg-white/4"
            : selected
            ? cfg.selectedBg
            : "bg-white/6"
        )}
        style={!locked && selected ? { boxShadow: `0 0 18px ${cfg.glow}` } : undefined}
      >
        {locked ? (
          <Lock className="size-5 text-white/20" />
        ) : (
          <Icon className={cn("size-5 transition-colors", selected ? cfg.textColor : "text-white/35")} />
        )}
      </div>

      {/* ── Texte ── */}
      <div>
        <p className={cn(
          "font-bold text-sm mb-0.5",
          locked ? "text-white/30" : selected ? cfg.textColor : "text-white/65"
        )}>
          {cfg.label}
        </p>
        <p className={cn("text-xs leading-relaxed", locked ? "text-white/20" : "text-white/40")}>
          {locked ? "Réservé à l'administrateur" : cfg.tagline}
        </p>
      </div>

      {/* ── Features ── */}
      <ul className="space-y-1.5 mt-auto">
        {cfg.features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span
              className={cn("size-1.5 rounded-full shrink-0", locked ? "bg-white/12" : "bg-white/20")}
              style={!locked && selected ? { backgroundColor: cfg.color } : undefined}
            />
            <span className={cn("text-[11px]", locked ? "text-white/20" : selected ? "text-white/65" : "text-white/35")}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      {/* ── Overlay verrouillé ── */}
      {locked && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(-50deg, white, white 1px, transparent 1px, transparent 10px)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <Lock className="size-4 text-white/25" />
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Modal principale ─────────────────────────────────────────────────────────

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
}

export function InviteModal({ open, onClose, userRole }: InviteModalProps) {
  const isAdmin = userRole === "admin";

  const [selectedRole, setSelectedRole] = useState<InviteRole>("sources");
  const [forName, setForName] = useState("");
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  // ── Générer un token ────────────────────────────────────────────────────────
  const generate = useCallback(async (role: InviteRole, name: string) => {
    setGenerating(true);
    setGenError(null);
    setInvite(null);
    setShowQr(false);

    try {
      const label = name.trim() ? `Pour ${name.trim()}` : null;

      const res = await fetch("/api/invite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, label }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Erreur lors de la génération");
      }

      const data = await res.json() as GeneratedInvite;
      setInvite(data);
      setTimeout(() => setShowQr(true), 80);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGenerating(false);
    }
  }, []);

  // Générer à l'ouverture
  useEffect(() => {
    if (open) {
      void generate(selectedRole, forName);
    } else {
      setInvite(null);
      setShowQr(false);
      setGenError(null);
      setCopied(false);
      setForName("");
      setSelectedRole("sources");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    if (!invite?.url) return;
    await navigator.clipboard.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!invite?.url || !canShare) return;
    const role = invite.role === "vip" ? "VIP" : "Sources";
    try {
      await navigator.share({
        title: "Rejoins Nemo",
        text: `Tu es invité(e) à rejoindre Nemo avec l'accès ${role} !`,
        url: invite.url,
      });
    } catch {
      // annulé par l'utilisateur
    }
  };

  // Changer de rôle → regénérer si déjà un nom
  const handleRoleChange = (role: InviteRole) => {
    if (!isAdmin && role === "vip") return;
    setSelectedRole(role);
    void generate(role, forName);
  };

  // Regénérer avec le nom actuel
  const handleRegenerate = () => {
    void generate(selectedRole, forName);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* ── Backdrop ─────────────────────────────────────────────────── */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-(--z-modal) bg-black/80 backdrop-blur-lg"
              />
            </Dialog.Overlay>

            {/* ── Modal ────────────────────────────────────────────────────── */}
            <Dialog.Content asChild aria-describedby="invite-desc">
              <motion.div
                initial={{ opacity: 0, scale: 0.90, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "fixed z-(--z-modal) focus:outline-none",
                  "inset-x-3 bottom-3 sm:inset-auto",
                  "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
                  "w-auto sm:w-120",
                  "max-h-[90svh] overflow-y-auto",
                  "rounded-3xl",
                  "bg-[#0b0d14] border border-white/8 shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
                )}
              >
                {/* ── Ligne lumineuse supérieure ─────────────────────────── */}
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background: isAdmin
                      ? "linear-gradient(90deg, transparent, rgba(232,184,75,0.6) 40%, rgba(167,139,250,0.6) 60%, transparent)"
                      : "linear-gradient(90deg, transparent, rgba(167,139,250,0.5) 50%, transparent)",
                  }}
                />

                {/* ── Halo fond ─────────────────────────────────────────── */}
                <div
                  className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-3xl opacity-15 pointer-events-none"
                  style={{
                    background: isAdmin
                      ? "radial-gradient(circle, #e8b84b 0%, #a78bfa 100%)"
                      : "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
                  }}
                />

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="relative flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/6">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-10 rounded-xl flex items-center justify-center border border-white/10"
                      style={{
                        background: isAdmin
                          ? "linear-gradient(135deg, rgba(232,184,75,0.2), rgba(167,139,250,0.2))"
                          : "rgba(167,139,250,0.15)",
                      }}
                    >
                      <UserPlus className="size-4.5 text-white/80" />
                    </div>
                    <div>
                      <Dialog.Title className="text-white font-bold text-base flex items-center gap-2">
                        Inviter un ami
                        {isAdmin && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/25 tracking-widest">
                            ADMIN
                          </span>
                        )}
                      </Dialog.Title>
                      <p className="text-white/35 text-xs mt-0.5">
                        {isAdmin
                          ? "Tu peux inviter avec n'importe quel niveau d'accès"
                          : "Génère un lien d'accès Sources pour un ami"}
                      </p>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      aria-label="Fermer"
                      className="mt-0.5 size-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                    >
                      <X className="size-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="px-5 pt-4 pb-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4" id="invite-desc">

                  {/* ── Champ "Pour (prénom)" ── */}
                  <div>
                    <label htmlFor="invite-for" className="block text-white/45 text-xs font-semibold uppercase tracking-wider mb-2">
                      Pour qui ?
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30 pointer-events-none" />
                      <input
                        id="invite-for"
                        type="text"
                        value={forName}
                        onChange={(e) => setForName(e.target.value)}
                        placeholder="Prénom de l'invité (optionnel)"
                        maxLength={40}
                        className="w-full bg-white/4 border border-white/8 focus:border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* ── Sélection du niveau d'accès ── */}
                  <div>
                    <p className="text-white/45 text-xs font-semibold uppercase tracking-wider mb-2.5">
                      Niveau d&apos;accès
                    </p>
                    <div className="flex gap-2.5">
                      <RoleCard
                        role="sources"
                        selected={selectedRole === "sources"}
                        locked={false}
                        onSelect={() => handleRoleChange("sources")}
                      />
                      <RoleCard
                        role="vip"
                        selected={selectedRole === "vip"}
                        locked={!isAdmin}
                        onSelect={() => handleRoleChange("vip")}
                      />
                    </div>
                  </div>

                  {/* ── Zone QR + lien ── */}
                  <div className="rounded-2xl bg-white/3 border border-white/6 overflow-hidden">
                    {/* QR */}
                    <div className="flex flex-col items-center py-5 border-b border-white/6">
                      {generating && (
                        <div className="size-40 flex flex-col items-center justify-center gap-3">
                          <div className="relative size-10">
                            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                            <Loader2 className="size-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-400 animate-spin" />
                          </div>
                          <p className="text-white/35 text-xs">Génération du lien…</p>
                        </div>
                      )}

                      {genError && !generating && (
                        <div className="size-40 flex flex-col items-center justify-center gap-3 text-center px-4">
                          <p className="text-red-400 text-sm font-medium">{genError}</p>
                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors"
                          >
                            <RefreshCw className="size-3" />
                            Réessayer
                          </button>
                        </div>
                      )}

                      <AnimatePresence>
                        {showQr && invite && !generating && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.75 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col items-center gap-3"
                          >
                            {/* Cadre QR */}
                            <div
                              className="p-3 rounded-2xl"
                              style={{
                                background: "#0b0d14",
                                boxShadow: invite.role === "vip"
                                  ? "0 0 32px rgba(232,184,75,0.2), 0 0 0 1px rgba(232,184,75,0.15)"
                                  : "0 0 32px rgba(167,139,250,0.2), 0 0 0 1px rgba(167,139,250,0.15)",
                              }}
                            >
                              <QRCode url={invite.url} size={160} />
                            </div>

                            {/* Libellé QR */}
                            <div className="text-center">
                              {invite.label && (
                                <p
                                  className={cn(
                                    "text-sm font-semibold mb-0.5",
                                    invite.role === "vip" ? "text-nemo-accent" : "text-violet-400"
                                  )}
                                >
                                  {invite.label}
                                </p>
                              )}
                              <p className="text-white/30 text-xs">Scanne pour rejoindre Nemo</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* URL + regénérer */}
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      <code className="flex-1 text-[11px] text-white/35 font-mono truncate">
                        {invite?.url ?? "—"}
                      </code>
                      <button
                        onClick={handleRegenerate}
                        disabled={generating}
                        aria-label="Regénérer un nouveau lien"
                        className="shrink-0 size-6 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/25 hover:text-white/60 disabled:opacity-30"
                      >
                        <RefreshCw className={cn("size-3.5", generating && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  {/* ── Boutons d'action ── */}
                  <div className="flex gap-2.5">
                    {/* Bouton "Générer" avec label — uniquement si le nom a changé */}
                    <button
                      onClick={handleRegenerate}
                      disabled={generating || !invite}
                      className={cn(
                        "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all border",
                        "bg-white/5 border-white/10 text-white/50 hover:bg-white/8 hover:text-white/80 hover:border-white/20",
                        (generating || !invite) && "opacity-40 cursor-not-allowed"
                      )}
                      title="Regénérer avec le prénom saisi"
                    >
                      <RefreshCw className={cn("size-4", generating && "animate-spin")} />
                    </button>

                    <button
                      onClick={() => void handleCopy()}
                      disabled={!invite || generating}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border",
                        copied
                          ? "bg-green-500/15 border-green-500/35 text-green-400"
                          : selectedRole === "vip" && isAdmin
                          ? "bg-nemo-accent/12 border-nemo-accent/30 text-nemo-accent hover:bg-nemo-accent/20"
                          : "bg-violet-500/12 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50",
                        (!invite || generating) && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {copied ? (
                        <><Check className="size-4" />Copié !</>
                      ) : (
                        <><Copy className="size-4" />Copier le lien</>
                      )}
                    </button>

                    {canShare && (
                      <button
                        onClick={() => void handleShare()}
                        disabled={!invite || generating}
                        className={cn(
                          "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all border",
                          "bg-white/5 border-white/10 text-white/50 hover:bg-white/8 hover:text-white hover:border-white/20",
                          (!invite || generating) && "opacity-40 cursor-not-allowed"
                        )}
                        title="Partager"
                      >
                        <Share2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Note sécurité */}
                  <p className="text-white/20 text-[10px] text-center">
                    Lien à usage unique · Valable jusqu'à utilisation · Non transférable
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
