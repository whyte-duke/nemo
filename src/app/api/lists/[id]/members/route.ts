import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id: listId } = await params;

  let body: { userId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Seul l'owner peut ajouter des membres
  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipPost = membership as unknown as { role: string } | null;
  if (!membershipPost || membershipPost.role !== "owner") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Vérifie que le membre ajouté est bien un ami
  const uid = user.id;
  const friendId = body.userId;
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .or(`and(user_id.eq.${uid < friendId ? uid : friendId},friend_id.eq.${uid < friendId ? friendId : uid})`)
    .maybeSingle();

  if (!friendship) {
    return NextResponse.json({ error: "Utilisateur non ami" }, { status: 400 });
  }

  const { error } = await supabase.from("list_members").insert({
    list_id: listId,
    user_id: body.userId,
    role: "member",
  });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id: listId } = await params;
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  if (!targetUserId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Peut se retirer soi-même OU owner retire un member
  const isSelf = targetUserId === user.id;
  const membershipDel = membership as unknown as { role: string } | null;
  const isOwner = membershipDel?.role === "owner";

  if (!isSelf && !isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
