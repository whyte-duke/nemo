"use client";

import { useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film, ThumbsUp, ThumbsDown, BookMarked, UserPlus, UserCheck,
  Clock, Loader2, ArrowLeft, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";
import {
  useFriendProfile,
  useFriendStats,
  useSendFriendRequest,
  useRespondFriendRequest,
} from "@/hooks/use-friends";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { useAuth } from "@/hooks/use-auth";

type Tab = "activite" | "vus" | "aimes" | "listes";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: { label: "ADMIN", className: "bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/25 font-black tracking-widest" },
  vip: { label: "VIP", className: "bg-nemo-accent/15 text-nemo-accent" },
  sources: { label: "SOURCES", className: "bg-violet-500/20 text-violet-400" },
  free: { label: "", className: "" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function StatBlock({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 bg-white/4 rounded-2xl border border-white/8">
      <div className="text-white/40">{icon}</div>
      <span className="text-white font-black text-xl tabular-nums">{value}</span>
      <span className="text-white/35 text-xs">{label}</span>
    </div>
  );
}

function WatchedGrid({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{ tmdb_id: number; media_type: string; title: string; poster_path: string | null; last_watched_at: string }>>([]);
  const [loading, setLoading] = useState(false);

  useState(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/friends/${userId}/history`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setItems(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 text-white/25 animate-spin" /></div>;
  if (items.length === 0) return <div className="text-center py-10 text-white/30 text-sm">Aucun contenu visionné</div>;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <Link
          key={`${item.tmdb_id}-${item.media_type}`}
          href={`/${item.media_type === "movie" ? "film" : "serie"}/${item.tmdb_id}`}
          className="group"
        >
          <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-white/8 mb-1.5">
            {item.poster_path && (
              <Image
                src={tmdbImage.poster(item.poster_path, "w185") ?? ""}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
              />
            )}
          </div>
          <p className="text-white/55 text-xs truncate group-hover:text-white/80 transition-colors">{item.title}</p>
        </Link>
      ))}
    </div>
  );
}

function LikedGrid({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{ tmdb_id: number; media_type: string; title: string; poster_path: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useState(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/friends/${userId}/likes`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setItems(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 text-white/25 animate-spin" /></div>;
  if (items.length === 0) return <div className="text-center py-10 text-white/30 text-sm">Aucun film/série aimé</div>;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <Link
          key={`${item.tmdb_id}-${item.media_type}`}
          href={`/${item.media_type === "movie" ? "film" : "serie"}/${item.tmdb_id}`}
          className="group"
        >
          <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-white/8 mb-1.5">
            {item.poster_path && (
              <Image
                src={tmdbImage.poster(item.poster_path, "w185") ?? ""}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
              />
            )}
            <div className="absolute bottom-1.5 right-1.5 flex items-center justify-center size-6 rounded-full bg-nemo-accent/20">
              <ThumbsUp className="size-3 text-nemo-accent" />
            </div>
          </div>
          <p className="text-white/55 text-xs truncate group-hover:text-white/80 transition-colors">{item.title}</p>
        </Link>
      ))}
    </div>
  );
}

function ListsGrid({ userId }: { userId: string }) {
  const [lists, setLists] = useState<Array<{ id: string; name: string; icon: string | null; item_count: number; is_public: boolean }>>([]);
  const [loading, setLoading] = useState(false);

  useState(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/friends/${userId}/lists`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setLists(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 text-white/25 animate-spin" /></div>;
  if (lists.length === 0) return <div className="text-center py-10 text-white/30 text-sm">Aucune liste publique</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {lists.map((list) => (
        <div key={list.id} className="flex items-center gap-4 p-4 bg-white/4 border border-white/8 rounded-2xl hover:border-white/15 transition-colors">
          <div className="flex items-center justify-center size-12 rounded-xl bg-white/8 text-2xl shrink-0">
            {list.icon ?? "🎬"}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{list.name}</p>
            <p className="text-white/35 text-xs mt-0.5">{list.item_count} {list.item_count === 1 ? "titre" : "titres"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("activite");

  const { data: profile, isLoading: profileLoading } = useFriendProfile(userId);
  const { data: stats } = useFriendStats(userId);
  const { mutate: sendRequest, isPending: sending } = useSendFriendRequest();
  const { mutate: respond } = useRespondFriendRequest();

  // Si c'est le propre profil → redirige
  if (user && userId === user.id) {
    router.push("/profil/parametres");
    return null;
  }

  if (profileLoading) {
    return (
      <div className="bg-[#0b0d12] min-h-dvh flex items-center justify-center">
        <Loader2 className="size-8 text-white/25 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-[#0b0d12] min-h-dvh flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Utilisateur introuvable</p>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors">
          <ArrowLeft className="size-4" />
          Retour
        </button>
      </div>
    );
  }

  const badge = ROLE_BADGE[profile.role] ?? ROLE_BADGE.free;

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "activite", label: "Activité", icon: <Activity className="size-3.5" /> },
    { id: "vus", label: "Vus", icon: <Film className="size-3.5" /> },
    { id: "aimes", label: "Aimés", icon: <ThumbsUp className="size-3.5" /> },
    { id: "listes", label: "Listes", icon: <BookMarked className="size-3.5" /> },
  ];

  return (
    <div className="bg-[#0b0d12] min-h-dvh">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-8">
        {/* Profil header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
          {/* Avatar */}
          <div className="relative size-20 rounded-full overflow-hidden bg-nemo-accent/10 ring-2 ring-white/15 shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name ?? "Profil"}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-nemo-accent/60">
                {(profile.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-black text-white">{profile.display_name ?? "Utilisateur"}</h1>

            {badge.label && (
              <span className={cn(
                "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5",
                badge.className
              )}>
                {badge.label}
              </span>
            )}

            {profile.is_friend && profile.friends_since && (
              <p className="text-white/30 text-xs mt-2 flex items-center gap-1.5 justify-center sm:justify-start">
                <UserCheck className="size-3" />
                Amis depuis {formatDate(profile.friends_since)}
              </p>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3 justify-center sm:justify-start">
              {profile.is_friend ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/8 rounded-full text-sm text-white/50">
                  <UserCheck className="size-4 text-nemo-accent" />
                  Ami
                </div>
              ) : profile.request_pending ? (
                profile.request_direction === "received" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => respond({ id: profile.request_id!, status: "accepted" })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-nemo-accent hover:bg-[#f0c85a] text-black text-sm font-semibold rounded-full transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => respond({ id: profile.request_id!, status: "declined" })}
                      className="px-4 py-2 border border-white/15 hover:border-white/30 text-white/50 hover:text-white text-sm rounded-full transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/6 rounded-full text-sm text-white/40">
                    <Clock className="size-4" />
                    Demande envoyée
                  </div>
                )
              ) : (
                <button
                  onClick={() => sendRequest(profile.id)}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/18 border border-white/15 hover:border-white/30 text-white text-sm font-semibold rounded-full transition-all"
                >
                  <UserPlus className="size-4" />
                  Ajouter en ami
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatBlock icon={<Film className="size-4" />} value={stats.total_watched} label="Vus" />
            <StatBlock icon={<ThumbsUp className="size-4" />} value={stats.total_likes} label="Likes" />
            <StatBlock icon={<ThumbsDown className="size-4" />} value={stats.total_dislikes} label="Dislikes" />
            <StatBlock icon={<BookMarked className="size-4" />} value={stats.total_lists} label="Listes" />
          </div>
        )}

        {/* Top genres */}
        {stats && stats.top_genres.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Genres préférés</h3>
            <div className="flex flex-wrap gap-2">
              {stats.top_genres.map((g) => (
                <span key={g.name} className="px-3 py-1 bg-white/6 border border-white/10 rounded-full text-white/55 text-xs font-medium">
                  {g.name}
                  <span className="ml-1.5 text-white/25">×{g.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Onglets */}
        <div className="flex items-center gap-1 mb-8 border-b border-white/8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "text-white border-nemo-accent"
                  : "text-white/40 border-transparent hover:text-white/65"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        {activeTab === "activite" && (
          <ActivityFeed />
        )}
        {activeTab === "vus" && <WatchedGrid userId={userId} />}
        {activeTab === "aimes" && <LikedGrid userId={userId} />}
        {activeTab === "listes" && <ListsGrid userId={userId} />}
      </div>
    </div>
  );
}
