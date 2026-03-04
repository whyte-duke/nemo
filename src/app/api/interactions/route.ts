import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType");
  if (!tmdbId || !mediaType) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("interactions")
    .select("type")
    .eq("user_id", user.id)
    .eq("tmdb_id", Number(tmdbId))
    .eq("media_type", mediaType)
    .single();

  return NextResponse.json({ type: (data as { type?: "like" | "dislike" } | null)?.type ?? null });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { tmdbId: number; mediaType: "movie" | "tv"; type: "like" | "dislike" | null; notInterested?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType, type, notInterested } = body;
  if (typeof tmdbId !== "number" || !mediaType) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (type === null && !notInterested) {
    await supabase
      .from("interactions")
      .delete()
      .eq("user_id", user.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, unknown> = { user_id: user.id, tmdb_id: tmdbId, media_type: mediaType };
    if (type !== null) payload.type = type;
    if (notInterested !== undefined) payload.not_interested = notInterested;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("interactions").upsert(
      payload,
      { onConflict: "user_id,tmdb_id,media_type" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
