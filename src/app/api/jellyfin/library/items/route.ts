import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ hasPersonalJellyfin: false, items: [], jellyfinUrl: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Récupère le profil avec la liaison au serveur Jellyfin
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url, personal_jellyfin_server_id, last_library_sync_at")
    .eq("id", user.id)
    .single();

  if (!profile?.personal_jellyfin_server_id) {
    return NextResponse.json({ hasPersonalJellyfin: false, items: [], jellyfinUrl: null });
  }

  // Fetch paginé — Supabase limite à 1000 lignes par défaut, on boucle pour tout récupérer
  const PAGE_SIZE = 1000;
  const allItems: Array<{ tmdb_id: string; media_type: "movie" | "tv"; jellyfin_item_id: string }> = [];
  let from = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from("jellyfin_server_items")
      .select("tmdb_id, media_type, jellyfin_item_id")
      .eq("server_id", profile.personal_jellyfin_server_id)
      .range(from, from + PAGE_SIZE - 1);

    if (error || !page || page.length === 0) break;
    allItems.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return NextResponse.json(
    {
      hasPersonalJellyfin: true,
      jellyfinUrl: profile.personal_jellyfin_url as string,
      lastSyncedAt: profile.last_library_sync_at as string | null,
      items: allItems,
    },
    {
      headers: {
        // Côté navigateur : revalider après 5 min, acceptable jusqu'à 10 min
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
