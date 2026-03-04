import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getTVShowSummary } from "@/lib/tmdb/client";
import type { ListItem } from "@/types/supabase";

export type ListDetailItem = ListItem & { title: string; poster_path: string | null };

async function enrichItem(item: ListItem): Promise<ListDetailItem> {
  try {
    if (item.media_type === "movie") {
      const movie = await getMovieSummary(item.tmdb_id);
      return { ...item, title: movie.title, poster_path: movie.poster_path };
    }
    const show = await getTVShowSummary(item.tmdb_id);
    return { ...item, title: show.name, poster_path: show.poster_path };
  } catch {
    return {
      ...item,
      title: item.media_type === "movie" ? `Film #${item.tmdb_id}` : `Série #${item.tmdb_id}`,
      poster_path: null,
    };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  // Vérifie que l'utilisateur est membre
  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });
  const membershipRow = membership as unknown as { role: string };

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, icon, is_default, is_public, created_at, user_id")
    .eq("id", id)
    .single();

  if (!list) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });

  const { data: items } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", id)
    .order("added_at", { ascending: false });

  const { data: members } = await supabase
    .from("list_members")
    .select("role, user_id, profile:profiles(display_name, avatar_url)")
    .eq("list_id", id);

  const enriched = await Promise.all(((items ?? []) as ListItem[]).map(enrichItem));

  return NextResponse.json({
    ...list,
    role: membershipRow.role,
    items: enriched,
    members: ((members ?? []) as unknown as Array<{ role: string; user_id: string; profile: { display_name: string | null; avatar_url: string | null } | null }>).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: m.profile?.display_name ?? null,
      avatar_url: m.profile?.avatar_url ?? null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;

  let body: { name?: string; icon?: string; is_public?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Seul l'owner peut modifier
  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipPatch = membership as unknown as { role: string } | null;
  if (!membershipPatch || membershipPatch.role !== "owner") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    if (body.name.trim().length > 30) return NextResponse.json({ error: "Nom trop long" }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.is_public !== undefined) updates.is_public = body.is_public;

  const { data, error } = await supabase
    .from("lists")
    .update(updates)
    .eq("id", id)
    .select("id, name, icon, is_default, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  // Seul l'owner peut supprimer; la liste par défaut et les listes non_deletable ne peuvent pas être supprimées
  const { data: list } = await supabase
    .from("lists")
    .select("is_default, non_deletable, user_id")
    .eq("id", id)
    .single();

  if (!list) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });

  const { data: membership } = await supabase
    .from("list_members")
    .select("role")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipDel = membership as unknown as { role: string } | null;
  if (!membershipDel || membershipDel.role !== "owner") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const listData = list as { is_default: boolean; non_deletable: boolean };
  if (listData.is_default) {
    return NextResponse.json({ error: "La liste par défaut ne peut pas être supprimée" }, { status: 400 });
  }
  if (listData.non_deletable) {
    return NextResponse.json({ error: "Cette liste ne peut pas être supprimée" }, { status: 403 });
  }

  const { error } = await supabase.from("lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
