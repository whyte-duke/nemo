import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vérifie si un item TMDB est dans le cache Jellyfin de l'utilisateur.
 * Utilise jellyfin_server_items (dédupliqué par serveur) via la FK du profil.
 */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ inLibrary: false });

  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType");

  if (!tmdbId || !mediaType || !["movie", "tv"].includes(mediaType)) {
    return NextResponse.json({ error: "tmdbId et mediaType requis" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Récupère le server_id du profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_server_id")
    .eq("id", user.id)
    .single();

  if (!profile?.personal_jellyfin_server_id) {
    return NextResponse.json({ inLibrary: false });
  }

  const { data } = await supabase
    .from("jellyfin_server_items")
    .select("jellyfin_item_id")
    .eq("server_id", profile.personal_jellyfin_server_id)
    .eq("tmdb_id", tmdbId.trim())
    .eq("media_type", mediaType)
    .maybeSingle();

  if (!data) return NextResponse.json({ inLibrary: false });

  return NextResponse.json({
    inLibrary: true,
    jellyfinItemId: data.jellyfin_item_id as string,
  });
}
