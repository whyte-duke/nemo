import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) return NextResponse.json([]);

  const supabase = createAdminClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .ilike("display_name", `%${q}%`)
    .neq("id", user.id)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = profiles ?? [];

  if (results.length === 0) return NextResponse.json([]);

  // Récupère les IDs déjà amis
  const ids = results.map((p) => p.id);
  const { data: existingFriendships } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  const friendSet = new Set(
    (existingFriendships ?? []).map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    )
  );

  // Récupère les demandes en attente
  const { data: pendingReqs } = await supabase
    .from("friend_requests")
    .select("from_user, to_user, status")
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .in("status", ["pending"]);

  const pendingSet = new Set(
    (pendingReqs ?? []).map((r) =>
      r.from_user === user.id ? r.to_user : r.from_user
    )
  );

  void ids;

  return NextResponse.json(
    results.map((p) => ({
      ...p,
      is_friend: friendSet.has(p.id),
      request_pending: pendingSet.has(p.id),
    }))
  );
}
