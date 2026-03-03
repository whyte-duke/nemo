"use client";

import Image from "next/image";
import Link from "next/link";
import { Film, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FriendProfile } from "@/hooks/use-friends";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: { label: "ADMIN", className: "bg-nemo-accent/20 text-nemo-accent border-nemo-accent/25 font-black tracking-widest" },
  vip: { label: "VIP", className: "bg-nemo-accent/15 text-nemo-accent" },
  sources: { label: "SOURCES", className: "bg-violet-500/20 text-violet-400" },
  free: { label: "", className: "" },
};

interface FriendCardProps {
  friend: FriendProfile;
}

export function FriendCard({ friend }: FriendCardProps) {
  const badge = ROLE_BADGE[friend.role] ?? ROLE_BADGE.free;

  return (
    <Link
      href={`/profil/${friend.id}`}
      className={cn(
        "flex flex-col items-center gap-3 p-5 rounded-2xl",
        "bg-white/4 border border-white/8 hover:border-white/18 hover:bg-white/7",
        "transition-all duration-200 group"
      )}
    >
      {/* Avatar */}
      <div className="relative size-16 rounded-full overflow-hidden bg-nemo-accent/10 ring-2 ring-white/10 group-hover:ring-white/20 transition-all shrink-0">
        {friend.avatar_url ? (
          <Image
            src={friend.avatar_url}
            alt={friend.display_name ?? "Profil"}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-nemo-accent/60">
            {(friend.display_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="text-center min-w-0 w-full">
        <p className="text-white font-semibold text-sm truncate">{friend.display_name ?? "Utilisateur"}</p>

        {badge.label && (
          <span className={cn(
            "inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-1",
            badge.className
          )}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5 text-xs text-white/35">
        <Film className="size-3" />
        <span>{friend.films_watched} vus</span>
      </div>

      {/* CTA */}
      <div className={cn(
        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all",
        "text-white/40 group-hover:text-white/70 bg-white/5 group-hover:bg-white/10"
      )}>
        <Eye className="size-3" />
        Voir le profil
      </div>
    </Link>
  );
}
