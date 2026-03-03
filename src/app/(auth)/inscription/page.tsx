"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, UserPlus, Loader2, Star, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Badge d'invitation ───────────────────────────────────────────────────────

const ROLE_CONFIG = {
  vip: {
    label: "Accès VIP",
    description: "Téléchargement Jellyfin inclus · Tous les services activés",
    icon: Star,
    color: "text-[#e8b84b]",
    bg: "bg-[#e8b84b]/10 border-[#e8b84b]/30",
  },
  sources: {
    label: "Accès Sources",
    description: "Accès aux sources de streaming StreamFusion",
    icon: Zap,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/30",
  },
  free: {
    label: "Compte standard",
    description: "Accès de base à la plateforme",
    icon: UserPlus,
    color: "text-white/60",
    bg: "bg-white/5 border-white/15",
  },
} as const;

// ─── Composant interne (accès aux searchParams via Suspense) ──────────────────

function InscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // État du token d'invitation
  const [inviteStatus, setInviteStatus] = useState<"checking" | "valid" | "invalid" | "none">(
    inviteToken ? "checking" : "none"
  );
  const [inviteRole, setInviteRole] = useState<"free" | "sources" | "vip" | null>(null);

  // Valider le token d'invitation au chargement
  useEffect(() => {
    if (!inviteToken) return;

    void fetch(`/api/invite/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; role?: "free" | "sources" | "vip" }) => {
        if (data.valid) {
          setInviteStatus("valid");
          setInviteRole(data.role ?? "vip");
        } else {
          setInviteStatus("invalid");
        }
      })
      .catch(() => setInviteStatus("invalid"));
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // 1. Créer le compte Supabase
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || email.split("@")[0],
          },
        },
      });

      if (authError) throw new Error(authError.message);

      // 2. Activer le token d'invitation si présent et valide
      if (inviteToken && inviteStatus === "valid") {
        try {
          await fetch("/api/invite/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken }),
          });
        } catch {
          // Le rôle n'est pas activé, mais l'inscription est quand même réussie
          console.warn("[inscription] Impossible d'activer le token d'invitation");
        }
      }

      setSuccess(true);

      // Les VIP sautent l'onboarding (déjà configuré par /redeem)
      const destination = inviteRole === "vip" ? "/" : "/onboarding";
      setTimeout(() => {
        router.push(destination);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center size-16 rounded-full bg-green-500/20 text-green-400">
              <UserPlus className="size-8" />
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold mb-3">Compte créé !</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            {inviteRole === "vip"
              ? "Bienvenue ! Votre accès VIP est activé. Redirection en cours\u2026"
              : "Votre compte a bien été créé. Redirection en cours\u2026"}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative w-full max-w-md"
    >
      <div className="glass-strong rounded-3xl p-8 shadow-2xl">
        <Link href="/" className="block text-center mb-8">
          <span className="text-nemo-accent font-black text-3xl tracking-widest">NEMO</span>
        </Link>

        <h1 className="text-white text-2xl font-bold text-center mb-2 text-balance">
          Créer un compte
        </h1>
        <p className="text-white/50 text-sm text-center mb-6">
          Rejoignez Nemo pour accéder à votre bibliothèque personnelle
        </p>

        {/* ── Badge invitation ─────────────────────────────────────────────── */}
        {inviteToken && (
          <div className="mb-6">
            {inviteStatus === "checking" && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                <Loader2 className="size-4 text-white/40 animate-spin shrink-0" />
                <p className="text-white/50 text-sm">Vérification de l'invitation…</p>
              </div>
            )}

            {inviteStatus === "valid" && inviteRole && (() => {
              const cfg = ROLE_CONFIG[inviteRole];
              const Icon = cfg.icon;
              return (
                <div className={cn("flex items-start gap-3 px-4 py-3 rounded-xl border", cfg.bg)}>
                  <Icon className={cn("size-5 shrink-0 mt-0.5", cfg.color)} />
                  <div>
                    <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
                    <p className="text-white/50 text-xs mt-0.5">{cfg.description}</p>
                  </div>
                </div>
              );
            })()}

            {inviteStatus === "invalid" && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/25">
                <p className="text-red-400 text-sm">Lien d'invitation invalide ou expiré</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="display_name" className="block text-white/70 text-sm mb-1.5">
              Nom affiché
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre prénom ou pseudo"
              autoComplete="name"
              className="w-full glass px-4 py-3 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border border-white/8 focus:border-nemo-accent/40 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-white/70 text-sm mb-1.5">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              required
              autoComplete="email"
              className="w-full glass px-4 py-3 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border border-white/8 focus:border-nemo-accent/40 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-white/70 text-sm mb-1.5">
              Mot de passe
              <span className="text-white/30 font-normal ml-1.5">(8 caractères minimum)</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full glass px-4 py-3 pr-12 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border border-white/8 focus:border-nemo-accent/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-nemo-red text-sm px-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all",
              "bg-nemo-accent hover:bg-[#f0c85a] text-black",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <UserPlus className="size-5" />
            )}
            {loading ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-white/50">
          Déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="text-nemo-accent hover:text-[#f0c85a] font-medium transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page wrapper avec Suspense (useSearchParams requiert Suspense) ────────────

export default function InscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="relative w-full max-w-md">
          <div className="glass-strong rounded-3xl p-8 shadow-2xl flex items-center justify-center min-h-80">
            <Loader2 className="size-8 text-nemo-accent animate-spin" />
          </div>
        </div>
      }
    >
      <InscriptionContent />
    </Suspense>
  );
}
