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

  let body: { tmdbId: number; mediaType: "movie" | "tv" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType } = body;
  if (typeof tmdbId !== "number" || !mediaType) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Vérifie que l'utilisateur est membre
  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { error } = await supabase.from("list_items").insert({
    list_id: listId,
    tmdb_id: tmdbId,
    media_type: mediaType,
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
  const tmdbId = parseInt(searchParams.get("tmdbId") ?? "");
  const mediaType = searchParams.get("mediaType") as "movie" | "tv" | null;

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "tmdbId et mediaType requis" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
