"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (
          authError.message.toLowerCase().includes("invalid") ||
          authError.message.toLowerCase().includes("email") ||
          authError.message.toLowerCase().includes("password")
        ) {
          throw new Error("Email ou mot de passe incorrect");
        }
        throw new Error(authError.message);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative w-full max-w-md"
    >
      <div className="glass-strong rounded-3xl p-8 shadow-2xl">
        <Link href="/" className="block text-center mb-8">
          <span className="text-[#e8b84b] font-black text-3xl tracking-widest">NEMO</span>
        </Link>

        <h1 className="text-white text-2xl font-bold text-center mb-2 text-balance">
          Bon retour !
        </h1>
        <p className="text-white/50 text-sm text-center mb-8">
          Connectez-vous à votre compte Nemo
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
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
              className="w-full glass px-4 py-3 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border border-white/8 focus:border-[#e8b84b]/40 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-white/70 text-sm mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full glass px-4 py-3 pr-12 rounded-xl text-white placeholder:text-white/30 text-sm outline-none border border-white/8 focus:border-[#e8b84b]/40 transition-colors"
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
            <p role="alert" className="text-[#e63946] text-sm px-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all",
              "bg-[#e8b84b] hover:bg-[#f0c85a] text-black",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LogIn className="size-5" />
            )}
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-white/50">
          Pas de compte ?{" "}
          <Link
            href="/inscription"
            className="text-[#e8b84b] hover:text-[#f0c85a] font-medium transition-colors"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
