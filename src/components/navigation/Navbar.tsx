"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  User,
  ChevronDown,
  LogOut,
  Settings,
  History,
  Bookmark,
  X,
  Film,
  Tv,
  ArrowLeft,
  Bell,
  UserPlus,
  Users,
  Activity,
  Sparkles,
} from "lucide-react";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useSearchMulti } from "@/hooks/use-tmdb";
import { tmdbImage } from "@/lib/tmdb/client";
import { formatYear } from "@/lib/utils";
import { InviteModal } from "@/components/invite/InviteModal";
import { useFriendRequests } from "@/hooks/use-friends";
import type { UserRole } from "@/hooks/use-profile";

/* ─── Hook scroll-aware pour bottom nav ─────────────────────────── */
function useScrollDirection() {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    const handler = () => {
      const currentY = window.scrollY;
      if (currentY < 10) {
        setIsScrollingDown(false);
      } else {
        setIsScrollingDown(currentY > lastY);
      }
      lastY = currentY;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return isScrollingDown;
}

/* ─── Liens de navigation (épurés) ──────────────────────────────── */
const NAV_LINKS = [
  { href: "/films", label: "Films", icon: Film },
  { href: "/series", label: "Séries", icon: Tv },
  { href: "/decouvrir", label: "Découvrir", icon: Sparkles },
];

/* ─── Bouton Film Finder (W3NO) ───────────────────────────────────── */
const FINDER_HREF = "/trouve-un-film";

/* ─── Barre de recherche ─────────────────────────────────────────── */
function SearchBar({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data, isFetching } = useSearchMulti(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (id: number, type: string) => {
      onClose();
      const path =
        type === "movie" ? `/film/${id}` : type === "tv" ? `/serie/${id}` : `/acteur/${id}`;
      router.push(path);
    },
    [router, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && query.trim()) {
        onClose();
        router.push(`/recherche?q=${encodeURIComponent(query)}`);
      }
    },
    [query, router, onClose]
  );

  const results = data?.results?.slice(0, 7) ?? [];
  const hasResults = results.length > 0;

  const TYPE_LABELS: Record<string, string> = {
    movie: "Film",
    tv: "Série",
    person: "Acteur",
  };

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 border border-white/15">
        <Search className="size-4 text-white/50 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Films, séries, acteurs..."
          className="flex-1 bg-transparent text-white placeholder:text-white/40 text-sm outline-none"
          style={{ fontSize: "16px" }}
          autoComplete="off"
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            aria-label="Effacer"
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      <AnimatePresence>
        {query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 glass-tile overflow-hidden shadow-2xl z-(--z-modal)"
            style={{ borderRadius: "20px" }}
          >
            {isFetching && !hasResults && (
              <div className="py-5 px-4 text-center">
                <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                  <div className="size-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                  Recherche en cours…
                </div>
              </div>
            )}

            {!isFetching && !hasResults && query.length >= 2 && (
              <div className="py-5 px-4 text-center text-white/40 text-sm">
                Aucun résultat pour &ldquo;{query}&rdquo;
              </div>
            )}

            {results.map((result, i) => (
              <motion.button
                key={`${result.media_type}-${result.id}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
                onClick={() => handleSelect(result.id, result.media_type)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/8 transition-colors text-left group"
              >
                <div className="relative size-11 rounded-xl overflow-hidden bg-white/8 shrink-0">
                  {(result.poster_path ?? result.profile_path) ? (
                    <Image
                      src={
                        tmdbImage.poster(
                          (result.poster_path ?? result.profile_path) ?? null,
                          "w185"
                        ) ?? ""
                      }
                      alt=""
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-lg font-bold">
                      {(result.title ?? result.name ?? "?").charAt(0)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate group-hover:text-white transition-colors">
                    {result.title ?? result.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/8 text-white/50">
                      {TYPE_LABELS[result.media_type] ?? result.media_type}
                    </span>
                    {(result.release_date ?? result.first_air_date) && (
                      <span className="text-white/35 text-xs">
                        {formatYear(result.release_date ?? result.first_air_date)}
                      </span>
                    )}
                    {(result.vote_average ?? 0) > 0 && (
                      <span className="text-nemo-accent text-xs font-medium">
                        ★ {(result.vote_average ?? 0).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}

            {hasResults && (
              <Link
                href={`/recherche?q=${encodeURIComponent(query)}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 px-4 py-3 text-white/40 hover:text-white text-xs font-medium hover:bg-white/5 transition-colors border-t border-white/8"
              >
                Voir tous les résultats pour &ldquo;{query}&rdquo;
                <span className="text-nemo-accent">→</span>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Navbar principale ──────────────────────────────────────────── */
export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const isScrollingDown = useScrollDirection();
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const showBack = pathname !== "/";

  const userRole = (profile?.role ?? "free") as UserRole;
  const canInvite = userRole === "sources" || userRole === "vip" || userRole === "admin";
  const { data: friendRequests = [] } = useFriendRequests();
  const hasPendingRequests = friendRequests.length > 0;

  useEffect(() => {
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          DESKTOP HEADER — pill glassmorphism (lg+)
      ══════════════════════════════════════════════════════════ */}
      <header
        className="hidden lg:flex fixed top-0 left-0 right-0 z-(--z-sticky) justify-center"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div
          className={cn(
            "transition-all duration-300 mx-auto",
            searchOpen ? "w-[calc(100%-1.5rem)] max-w-xl" : "w-auto"
          )}
        >
          <div className="glass-nav flex items-center gap-3 sm:gap-4 px-4 sm:px-5 h-14 relative">
            {/* ── Retour ── */}
            <AnimatePresence>
              {!searchOpen && showBack && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Retour"
                    className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 active:scale-90 transition-all text-white/80 hover:text-white"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Logo ── */}
            <AnimatePresence>
              {!searchOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden shrink-0"
                >
                  <Link
                    href="/"
                    className="text-nemo-accent font-black text-xl tracking-widest hover:opacity-75 transition-opacity block whitespace-nowrap"
                  >
                    NEMO
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Nav desktop ── */}
            <AnimatePresence>
              {!searchOpen && (
                <motion.nav
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-0.5 ml-1"
                  aria-label="Navigation principale"
                >
                  <div className="w-px h-5 bg-white/12 mx-2 shrink-0" />
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 relative",
                        pathname === link.href
                          ? "text-white bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                          : "text-white/55 hover:text-white hover:bg-white/8"
                      )}
                    >
                      {link.label}
                      {pathname === link.href && (
                        <span className="absolute inset-x-3 -bottom-px h-px bg-nemo-accent/60 rounded-full" />
                      )}
                    </Link>
                  ))}
                  <div className="w-px h-5 bg-white/12 mx-2 shrink-0" />
                  <Link
                    href={FINDER_HREF}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-black tracking-widest transition-all duration-200 relative",
                      pathname === FINDER_HREF
                        ? "text-nemo-accent bg-nemo-accent/20 shadow-[inset_0_1px_0_rgba(232,184,75,0.20),0_0_12px_rgba(232,184,75,0.15)]"
                        : "text-nemo-accent/80 hover:text-nemo-accent hover:bg-nemo-accent/10 hover:shadow-[0_0_8px_rgba(232,184,75,0.12)]"
                    )}
                    title="Trouve-moi un film"
                  >
                    W3NO
                  </Link>
                </motion.nav>
              )}
            </AnimatePresence>

            {searchOpen && <div className="flex-1" />}

            {/* ── Barre de recherche ── */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-x-3 top-1/2 -translate-y-1/2 z-10"
                >
                  <SearchBar onClose={() => setSearchOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Actions ── */}
            <div className={cn("flex items-center gap-1 shrink-0", searchOpen && "invisible")}>
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Ouvrir la recherche"
                className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <Search className="size-4.5 text-white/70 hover:text-white transition-colors" />
              </button>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    aria-label="Menu utilisateur"
                    aria-expanded={userMenuOpen}
                    className={cn(
                      "flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-all duration-200",
                      "hover:bg-white/10 active:scale-95",
                      userMenuOpen && "bg-white/10"
                    )}
                  >
                    <div className="relative size-7 rounded-full overflow-hidden bg-nemo-accent/20 ring-1 ring-white/15">
                      {profile?.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt={profile.name ?? "Profil"}
                          fill
                          className="object-cover"
                          sizes="28px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <User className="size-3.5 text-nemo-accent" />
                        </div>
                      )}
                      {hasPendingRequests && (
                        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 border-2 border-nemo-bg" />
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-white/50 transition-transform duration-200",
                        userMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 glass-tile overflow-hidden shadow-2xl z-(--z-modal)"
                      >
                        <div className="px-4 py-3 border-b border-white/8">
                          <p className="text-white font-medium text-sm truncate">
                            {profile?.name ?? user.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {userRole === "admin" && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/25 tracking-widest">
                                ADMIN
                              </span>
                            )}
                            {userRole === "vip" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-nemo-accent/15 text-nemo-accent">
                                VIP
                              </span>
                            )}
                            {userRole === "sources" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                                SOURCES
                              </span>
                            )}
                          </div>
                        </div>

                        {[
                          { href: "/profil/parametres", icon: User, label: "Mon Profil" },
                          { href: "/ma-liste", icon: Bookmark, label: "Mes Listes" },
                          { href: "/historique", icon: History, label: "Historique" },
                          { href: "/activite", icon: Activity, label: "Activité" },
                          { href: "/profil/notifications", icon: Bell, label: "Téléchargements" },
                          { href: "/profil/parametres", icon: Settings, label: "Paramètres" },
                        ].map(({ href, icon: Icon, label }) => (
                          <Link
                            key={`${href}-${label}`}
                            href={href}
                            className="flex items-center gap-3 px-4 py-3 text-white/75 hover:text-white hover:bg-white/8 transition-colors text-sm"
                          >
                            <Icon className="size-4 shrink-0" />
                            {label}
                          </Link>
                        ))}

                        {profile?.jellyfin_user_id && (
                          <Link
                            href="/hub/jellyfin"
                            className="flex items-center gap-3 px-4 py-3 text-[#00A4DC]/80 hover:text-[#00A4DC] hover:bg-[#00A4DC]/8 transition-colors text-sm"
                          >
                            <JellyfinIcon className="size-4 shrink-0" />
                            Ma bibliothèque
                          </Link>
                        )}

                        <Link
                          href="/amis"
                          className="flex items-center gap-3 px-4 py-3 text-white/75 hover:text-white hover:bg-white/8 transition-colors text-sm"
                        >
                          <Users className="size-4 shrink-0" />
                          Amis
                          {hasPendingRequests && (
                            <span className="ml-auto flex items-center justify-center size-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                              {friendRequests.length}
                            </span>
                          )}
                        </Link>

                        {canInvite && (
                          <button
                            onClick={() => { setUserMenuOpen(false); setInviteOpen(true); }}
                            className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-sm border-t border-white/8 text-violet-300 hover:text-violet-200 hover:bg-violet-500/8"
                          >
                            <UserPlus className="size-4 shrink-0" />
                            Inviter un ami
                          </button>
                        )}

                        <button
                          onClick={() => void signOut()}
                          className="w-full flex items-center gap-3 px-4 py-3 text-nemo-red hover:bg-nemo-red/10 transition-colors text-sm border-t border-white/8"
                        >
                          <LogOut className="size-4 shrink-0" />
                          Se déconnecter
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href="/connexion"
                  className="px-4 py-1.5 bg-nemo-accent hover:bg-[#f0c85a] active:scale-95 text-black font-semibold text-sm rounded-full transition-all shadow-lg shadow-amber-500/20"
                >
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          MOBILE HEADER — logo centré + search (< lg)
      ══════════════════════════════════════════════════════════ */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-(--z-sticky)"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
      >
        <AnimatePresence mode="wait">
          {searchOpen ? (
            /* ── Mode recherche : plein écran ── */
            <motion.div
              key="search"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-3 mt-2"
            >
              <div className="glass-nav px-3 h-12 flex items-center">
                <SearchBar onClose={() => setSearchOpen(false)} />
              </div>
            </motion.div>
          ) : (
            /* ── Mode normal : logo centré + icônes ── */
            <motion.div
              key="normal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between px-4 py-3"
            >
              {/* Bouton retour (gauche) ou espace vide */}
              <div className="w-10">
                {showBack && (
                  <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Retour"
                    className="flex items-center justify-center size-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 active:scale-90 transition-all"
                  >
                    <ArrowLeft className="size-4.5 text-white" />
                  </button>
                )}
              </div>

              {/* Logo centré */}
              <Link
                href="/"
                className="text-nemo-accent font-black text-lg tracking-widest"
              >
                NEMO
              </Link>

              {/* Search (droite) */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Ouvrir la recherche"
                className="flex items-center justify-center size-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 active:scale-90 transition-all relative"
              >
                <Search className="size-4.5 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ══════════════════════════════════════════════════════════
          MOBILE SEARCH OVERLAY — dark backdrop (< lg)
      ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: "calc(var(--z-sticky) - 1)" }}
            onClick={() => setSearchOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          MOBILE BOTTOM NAV — fixé en bas (< lg)
          Films | Séries | Découvrir | Profil
      ══════════════════════════════════════════════════════════ */}
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-(--z-sticky) glass-nav-bottom flex items-stretch justify-around px-1",
          "transition-transform duration-300",
          isScrollingDown ? "translate-y-full" : "translate-y-0"
        )}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)", paddingTop: "6px" }}
        aria-label="Navigation principale mobile"
      >
        {/* Films */}
        <Link
          href="/films"
          className={cn("bottom-nav-item", pathname === "/films" && "active")}
          aria-label="Films"
        >
          <Film className="size-5" />
        </Link>

        {/* Séries */}
        <Link
          href="/series"
          className={cn("bottom-nav-item", pathname === "/series" && "active")}
          aria-label="Séries"
        >
          <Tv className="size-5" />
        </Link>

        {/* Découvrir */}
        <Link
          href="/decouvrir"
          className={cn("bottom-nav-item", pathname === "/decouvrir" && "active")}
          aria-label="Découvrir"
        >
          <Sparkles className="size-5" />
        </Link>

        {/* Profil */}
        {user ? (
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className={cn("bottom-nav-item", (userMenuOpen || pathname.startsWith("/profil")) && "active")}
            aria-label="Mon compte"
            aria-expanded={userMenuOpen}
          >
            <div className="relative size-5 rounded-full overflow-hidden bg-nemo-accent/20 ring-1 ring-white/20">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name ?? "Profil"}
                  fill
                  className="object-cover"
                  sizes="20px"
                />
              ) : (
                <User className="size-3 text-nemo-accent absolute inset-0 m-auto" />
              )}
              {hasPendingRequests && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 border border-nemo-bg" />
              )}
            </div>
          </button>
        ) : (
          <Link href="/connexion" className="bottom-nav-item" aria-label="Connexion">
            <User className="size-5" />
          </Link>
        )}
      </nav>

      {/* ── User menu mobile (drawer from bottom) ── */}
      <AnimatePresence>
        {userMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[calc(var(--z-sticky)+1)] bg-black/60 backdrop-blur-sm"
              onClick={() => setUserMenuOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="lg:hidden fixed inset-x-0 bottom-0 z-[calc(var(--z-sticky)+2)] glass-tile rounded-t-3xl overflow-hidden"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-white font-semibold text-base truncate">
                  {profile?.name ?? user?.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {userRole === "admin" && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/25 tracking-widest">
                      ADMIN
                    </span>
                  )}
                  {userRole === "vip" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-nemo-accent/15 text-nemo-accent">
                      VIP
                    </span>
                  )}
                  {userRole === "sources" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                      SOURCES
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-3">
                {[
                  { href: "/profil/parametres", icon: User, label: "Mon Profil" },
                  { href: "/ma-liste", icon: Bookmark, label: "Mes Listes" },
                  { href: "/historique", icon: History, label: "Historique" },
                  { href: "/activite", icon: Activity, label: "Activité" },
                  { href: "/amis", icon: Users, label: "Amis", badge: hasPendingRequests ? friendRequests.length : 0 },
                  { href: "/profil/notifications", icon: Bell, label: "Téléchargements" },
                ].map(({ href, icon: Icon, label, badge }) => (
                  <Link
                    key={`mobile-${href}-${label}`}
                    href={href}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-white/8 active:scale-95 transition-all text-white/75 hover:text-white text-sm relative"
                  >
                    <Icon className="size-4.5 shrink-0" />
                    {label}
                    {badge ? (
                      <span className="ml-auto flex items-center justify-center size-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>

              <div className="px-3 pb-1 space-y-1 border-t border-white/8 pt-1">
                {canInvite && (
                  <button
                    onClick={() => { setUserMenuOpen(false); setInviteOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-violet-300 hover:bg-violet-500/8 active:scale-95 transition-all text-sm"
                  >
                    <UserPlus className="size-4.5 shrink-0" />
                    Inviter un ami
                  </button>
                )}
                <button
                  onClick={() => void signOut()}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-nemo-red hover:bg-nemo-red/10 active:scale-95 transition-all text-sm"
                >
                  <LogOut className="size-4.5 shrink-0" />
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal d'invitation */}
      {user && canInvite && (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          userRole={userRole}
        />
      )}
    </>
  );
}
