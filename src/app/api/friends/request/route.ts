import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

// GET /api/friends/request — demandes reçues en attente
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: requests, error } = await supabase
    .from("friend_requests")
    .select("id, from_user, created_at")
    .eq("to_user", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!requests || requests.length === 0) return NextResponse.json([]);

  const senderIds = requests.map((r: { from_user: string }) => r.from_user);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", senderIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json(
    requests.map((r: { id: string; from_user: string; created_at: string }) => ({
      id: r.id,
      created_at: r.created_at,
      from: profileMap.get(r.from_user) ?? { id: r.from_user, display_name: null, avatar_url: null, role: "free" },
    }))
  );
}

// POST /api/friends/request — envoyer une demande
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { toUserId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!body.toUserId || body.toUserId === user.id) {
    return NextResponse.json({ error: "Utilisateur invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Vérifie qu'ils ne sont pas déjà amis
  const uid = user.id;
  const fid = body.toUserId;
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(`and(user_id.eq.${uid < fid ? uid : fid},friend_id.eq.${uid < fid ? fid : uid})`)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Déjà amis" }, { status: 400 });

  const { data, error } = await supabase
    .from("friend_requests")
    .insert({ from_user: user.id, to_user: body.toUserId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Demande déjà envoyée" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
