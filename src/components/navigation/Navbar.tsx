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

/* ─── Liens de navigation (épurés) ──────────────────────────────── */
const NAV_LINKS = [
  { href: "/films", label: "Films", icon: Film },
  { href: "/series", label: "Séries", icon: Tv },
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
                {/* Poster */}
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

                {/* Info */}
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
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
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
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 z-(--z-sticky) flex justify-center"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div
        className={cn(
          "transition-all duration-300 mx-auto",
          searchOpen ? "w-[calc(100%-1.5rem)] max-w-xl" : "w-auto"
        )}
      >
        <div className="glass-nav flex items-center gap-3 sm:gap-4 px-4 sm:px-5 h-14 relative">
          {/* ── Retour — même hauteur / design que la navbar ── */}
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
                  className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                >
                  <ArrowLeft className="size-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Logo — masqué lors de la recherche ── */}
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

          {/* ── Nav desktop (Films / Séries + W3NO) ── */}
          <AnimatePresence>
            {!searchOpen && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="hidden lg:flex items-center gap-0.5 ml-1"
                aria-label="Navigation principale"
              >
                <div className="w-px h-5 bg-white/12 mx-2 shrink-0" />
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                      pathname === link.href
                        ? "text-white bg-white/12"
                        : "text-white/55 hover:text-white hover:bg-white/8"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="w-px h-5 bg-white/12 mx-2 shrink-0" />
                <Link
                  href={FINDER_HREF}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-black tracking-widest transition-all duration-200",
                    pathname === FINDER_HREF
                      ? "text-nemo-accent bg-nemo-accent/20"
                      : "text-nemo-accent/80 hover:text-nemo-accent hover:bg-nemo-accent/10"
                  )}
                  title="Trouve-moi un film"
                >
                  W3NO
                </Link>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* ── Spacer (only when search closed to keep pill compact) ── */}
          {searchOpen && <div className="flex-1" />}

          {/* ── Barre de recherche (overlay absolue sur le pill) ── */}
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

          {/* ── Actions (toujours visibles, sauf quand search ouvre) ── */}
          <div className={cn("flex items-center gap-1 shrink-0", searchOpen && "invisible")}>
            <Link
              href={FINDER_HREF}
              className={cn(
                "lg:hidden flex items-center justify-center size-9 rounded-full hover:bg-nemo-accent/15 transition-colors",
                pathname === FINDER_HREF && "bg-nemo-accent/20"
              )}
              aria-label="Trouve-moi un film (W3NO)"
              title="W3NO"
            >
              <span className="text-nemo-accent font-black text-[10px] tracking-wider">W3NO</span>
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Ouvrir la recherche"
              className="flex items-center justify-center size-9 rounded-full hover:bg-white/10 transition-colors"
            >
              <Search className="size-4.5 text-white/70 hover:text-white transition-colors" />
            </button>

            {user ? (
              <>
                {/* Menu utilisateur */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    aria-label="Menu utilisateur"
                    aria-expanded={userMenuOpen}
                    className={cn(
                      "flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-all duration-200",
                      "hover:bg-white/10",
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

                        {/* Lien Ma bibliothèque Jellyfin — si compte connecté */}
                        {profile?.jellyfin_user_id && (
                          <Link
                            href="/hub/jellyfin"
                            className="flex items-center gap-3 px-4 py-3 text-[#00A4DC]/80 hover:text-[#00A4DC] hover:bg-[#00A4DC]/8 transition-colors text-sm"
                          >
                            <JellyfinIcon className="size-4 shrink-0" />
                            Ma bibliothèque
                          </Link>
                        )}

                        {/* Lien Amis avec badge */}
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

                        {/* Bouton inviter un ami — sources/vip uniquement */}
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
              </>
            ) : (
              <Link
                href="/connexion"
                className="px-4 py-1.5 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold text-sm rounded-full transition-colors shadow-lg shadow-amber-500/20"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* Modal d'invitation — rendu en dehors du header pour éviter le stacking context */}
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
