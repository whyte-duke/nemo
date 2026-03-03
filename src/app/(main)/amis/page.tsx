"use client";

import { useState } from "react";
import Image from "next/image";
import { Users, UserPlus, Search, Check, X, UserCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFriends, useFriendRequests, useSendFriendRequest, useRespondFriendRequest, useSearchUsers } from "@/hooks/use-friends";
import { FriendCard } from "@/components/friends/FriendCard";
import { InviteModal } from "@/components/invite/InviteModal";
import { useProfile } from "@/hooks/use-profile";
import type { UserRole } from "@/hooks/use-profile";
import { useEffect, useRef } from "react";

function useDebouncedSearch(q: string) {
  const [debounced, setDebounced] = useState(q);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(q), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);
  return debounced;
}

export default function AmisPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const debouncedQuery = useDebouncedSearch(searchQuery);

  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: requests = [] } = useFriendRequests();
  const { data: searchResults = [], isFetching: searching } = useSearchUsers(debouncedQuery);
  const { mutate: sendRequest, isPending: sending } = useSendFriendRequest();
  const { mutate: respond } = useRespondFriendRequest();
  const { data: profile } = useProfile();

  const userRole = (profile?.role ?? "free") as UserRole;
  const canInvite = userRole === "sources" || userRole === "vip" || userRole === "admin";

  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  function handleSendRequest(userId: string) {
    sendRequest(userId, {
      onSuccess: () => setSentRequests((prev) => new Set([...prev, userId])),
    });
  }

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-12 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Users className="size-6 text-nemo-accent" />
            <h1 className="text-2xl font-black text-white">Mes Amis</h1>
            {friends.length > 0 && (
              <span className="text-white/35 text-lg tabular-nums">({friends.length})</span>
            )}
          </div>
          {canInvite && (
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 font-semibold text-sm rounded-full transition-colors"
            >
              <UserPlus className="size-4" />
              Inviter sur Nemo
            </button>
          )}
        </div>

        {/* Demandes reçues */}
        {requests.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
              Demandes reçues
              <span className="ml-2 inline-flex items-center justify-center size-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {requests.length}
              </span>
            </h2>
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-4 p-4 bg-white/4 border border-white/8 rounded-2xl"
                >
                  <div className="relative size-10 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {req.from.avatar_url ? (
                      <Image src={req.from.avatar_url} alt="" fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/50">
                        {(req.from.display_name ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{req.from.display_name ?? "Utilisateur"}</p>
                    <p className="text-white/35 text-xs">Souhaite vous ajouter en ami</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => respond({ id: req.id, status: "accepted" })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-nemo-accent hover:bg-[#f0c85a] text-black text-xs font-semibold rounded-full transition-colors"
                    >
                      <Check className="size-3.5" />
                      Accepter
                    </button>
                    <button
                      onClick={() => respond({ id: req.id, status: "declined" })}
                      className="flex items-center justify-center size-8 rounded-full border border-white/15 hover:border-white/30 text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recherche d'amis */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
            Ajouter un ami
          </h2>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/30" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom d'utilisateur…"
              className="w-full bg-white/6 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:border-white/25 transition-colors"
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-white/30 animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-3 bg-white/4 border border-white/8 rounded-xl hover:border-white/14 transition-colors"
                >
                  <div className="relative size-9 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {user.avatar_url ? (
                      <Image src={user.avatar_url} alt="" fill className="object-cover" sizes="36px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/50">
                        {(user.display_name ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user.display_name ?? "Utilisateur"}</p>
                  </div>
                  <div className="shrink-0">
                    {user.is_friend ? (
                      <span className="flex items-center gap-1.5 text-xs text-nemo-accent font-medium">
                        <UserCheck className="size-3.5" />
                        Ami
                      </span>
                    ) : user.request_pending || sentRequests.has(user.id) ? (
                      <span className="text-xs text-white/35 font-medium">Demande envoyée</span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        disabled={sending}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors",
                          "bg-white/10 hover:bg-white/20 text-white border border-white/15 hover:border-white/30"
                        )}
                      >
                        <UserPlus className="size-3.5" />
                        Ajouter
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Grille des amis */}
        <section>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-6">
            Amis
          </h2>

          {friendsLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 text-white/20 animate-spin" />
            </div>
          )}

          {!friendsLoading && friends.length === 0 && (
            <div className="text-center py-20 space-y-4">
              <Users className="size-16 text-white/8 mx-auto" />
              <p className="text-white/50 font-medium">Aucun ami pour l&apos;instant</p>
              <p className="text-white/25 text-sm max-w-xs mx-auto">
                Invite tes amis à rejoindre Nemo pour les retrouver ici et partager vos films
              </p>
              {canInvite && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 font-semibold text-sm rounded-full transition-colors"
                >
                  <UserPlus className="size-4" />
                  Inviter un ami
                </button>
              )}
            </div>
          )}

          {!friendsLoading && friends.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {friends.map((friend) => (
                <FriendCard key={friend.id} friend={friend} />
              ))}
            </div>
          )}
        </section>
      </div>

      {canInvite && (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          userRole={userRole}
        />
      )}
    </div>
  );
}
