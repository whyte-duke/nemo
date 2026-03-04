import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";

const SUGGESTIONS_LIST_NAME = "Suggestions";

async function getOrCreateSuggestionsList(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .eq("name", SUGGESTIONS_LIST_NAME)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: newList, error } = await supabase
    .from("lists")
    .insert({
      user_id: userId,
      name: SUGGESTIONS_LIST_NAME,
      is_default: false,
      icon: "✨",
      is_public: false,
      non_deletable: true,
    })
    .select("id")
    .single();

  if (error || !newList) throw new Error(error?.message ?? "Erreur création liste Suggestions");
  return (newList as { id: string }).id;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { tmdbId: number; mediaType: "movie" | "tv"; action: "add" | "remove" };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType, action } = body;
  if (!tmdbId || !mediaType || !action) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const listId = await getOrCreateSuggestionsList(user.id);

    if (action === "add") {
      const { error } = await supabase
        .from("list_items")
        .upsert(
          { list_id: listId, tmdb_id: tmdbId, media_type: mediaType, added_by: user.id },
          { onConflict: "list_id,tmdb_id,media_type", ignoreDuplicates: true }
        );
      if (error && !error.message.includes("23505")) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      await supabase
        .from("list_items")
        .delete()
        .eq("list_id", listId)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: listData } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", SUGGESTIONS_LIST_NAME)
    .maybeSingle();

  if (!listData) return NextResponse.json([]);

  const listId = (listData as { id: string }).id;

  const { data: items, error } = await supabase
    .from("list_items")
    .select("id, tmdb_id, media_type, added_at")
    .eq("list_id", listId)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(items ?? []);
}
