import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncJellyfinLibraryForUser } from "@/lib/jellyfin/sync";

/**
 * GET — vérification de l'URL webhook (test navigateur / Jellyfin plugin "test").
 * Valide le token sans déclencher de sync.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("webhook_token", token)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Webhook Jellyfin actif",
    user: profile.display_name ?? profile.id,
  });
}

/**
 * POST — déclenché par le plugin Jellyfin Webhook à chaque ajout de média.
 * Attend la fin de la sync et retourne la liste des nouveaux items avec deep-links.
 */
export async function POST(request: Request) {
  const reqUrl = new URL(request.url);
  const token = reqUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("webhook_token", token)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const userId = profile.id as string;

  // Sync synchrone — on attend la fin pour renvoyer le diff
  const appBase = `${reqUrl.protocol}//${reqUrl.host}`;

  try {
    const { synced, newItems } = await syncJellyfinLibraryForUser(userId);

    // Construction des deep-links vers les pages détail de l'app
    const newItemsWithLinks = (newItems ?? []).map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      jellyfinItemId: item.jellyfinItemId,
      appUrl: `${appBase}/${item.mediaType === "movie" ? "film" : "serie"}/${item.tmdbId}`,
    }));

    if (newItemsWithLinks.length > 0) {
      console.log(
        `[Webhook Jellyfin] ${newItemsWithLinks.length} nouveau(x) item(s) pour user ${userId} :`,
        newItemsWithLinks.map((i) => `${i.mediaType}/${i.tmdbId}`).join(", ")
      );
    }

    return NextResponse.json({
      ok: true,
      synced,
      newCount: newItemsWithLinks.length,
      newItems: newItemsWithLinks,
    });
  } catch (err) {
    console.error("[Webhook Jellyfin] Erreur sync pour", userId, ":", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la sync" },
      { status: 500 }
    );
  }
}
