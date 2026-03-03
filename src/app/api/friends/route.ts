import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

export type FriendProfile = {
  friendship_id: string;
  source: "invite" | "manual";
  friends_since: string;
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  films_watched: number;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: friendships, error } = await supabase
    .from("friendships")
    .select("id, source, created_at, user_id, friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const friendIds = (friendships ?? []).map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  );

  if (friendIds.length === 0) return NextResponse.json([]);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", friendIds);

  // Compte de films/séries vus par ami
  const watchCounts: Record<string, number> = {};
  const { data: watchData } = await supabase
    .from("watch_history")
    .select("user_id")
    .in("user_id", friendIds)
    .gte("progress", 80);

  (watchData ?? []).forEach((w: { user_id: string }) => {
    watchCounts[w.user_id] = (watchCounts[w.user_id] ?? 0) + 1;
  });

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends: FriendProfile[] = (friendships ?? []).map((f) => {
    const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
    const profile = profileMap.get(friendId);
    return {
      friendship_id: f.id,
      source: f.source as "invite" | "manual",
      friends_since: f.created_at,
      id: friendId,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? "free",
      films_watched: watchCounts[friendId] ?? 0,
    };
  });

  return NextResponse.json(friends);
}
