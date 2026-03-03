import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { userId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, created_at")
    .eq("id", userId)
    .single();

  if (!profile) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Vérifie si amis
  const uid = user.id;
  const fid = userId;
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id, created_at, source")
    .or(`and(user_id.eq.${uid < fid ? uid : fid},friend_id.eq.${uid < fid ? fid : uid})`)
    .maybeSingle();

  // Vérifie demande en attente
  const { data: pendingReq } = await supabase
    .from("friend_requests")
    .select("id, from_user, status")
    .or(`and(from_user.eq.${uid},to_user.eq.${fid}),and(from_user.eq.${fid},to_user.eq.${uid})`)
    .eq("status", "pending")
    .maybeSingle();

  return NextResponse.json({
    ...profile,
    is_friend: !!friendship,
    friends_since: friendship?.created_at ?? null,
    friendship_source: friendship?.source ?? null,
    request_pending: !!pendingReq,
    request_direction: pendingReq
      ? pendingReq.from_user === uid ? "sent" : "received"
      : null,
    request_id: pendingReq?.id ?? null,
  });
}
