import { createAdminClient } from "@/lib/supabase/admin";

interface JellyfinItem {
  Id: string;
  Type: string;
  ProviderIds?: { Tmdb?: string };
}

function buildAuthHeader(apiKey: string): string {
  return `MediaBrowser Client="NEMO", Device="Web", DeviceId="nemo-sync-v1", Version="1.0", Token="${apiKey}"`;
}

async function jellyfinGet<T>(baseUrl: string, apiKey: string, path: string): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-Emby-Authorization": buildAuthHeader(apiKey),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Jellyfin ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface NewItem {
  tmdbId: string;
  mediaType: "movie" | "tv";
  jellyfinItemId: string;
}

export interface SyncResult {
  serverName: string;
  movieCount: number;
  tvCount: number;
  totalSynced: number;
  /** Items absents de la DB avant cette sync (ajoutés depuis la dernière sync) */
  newItems: NewItem[];
}

/**
 * Teste la connexion au serveur Jellyfin via /System/Info.
 * Compatible avec les clés API admin (contrairement à /Users/Me qui nécessite une session).
 */
export async function testJellyfinConnection(
  url: string,
  apiKey: string
): Promise<{ ok: boolean; serverName?: string; error?: string }> {
  try {
    const info = await jellyfinGet<{ ServerName: string }>(url, apiKey, "/System/Info");
    return { ok: true, serverName: info.ServerName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de joindre le serveur Jellyfin",
    };
  }
}

/**
 * Synchronise les items d'un serveur Jellyfin dans la table jellyfin_server_items.
 *
 * Architecture déduplication :
 *   jellyfin_servers (1 entrée par URL) → jellyfin_server_items (partagés entre utilisateurs)
 *   profiles.personal_jellyfin_server_id → FK vers jellyfin_servers
 *
 * Si plusieurs utilisateurs Nemo utilisent le même serveur Jellyfin,
 * les items ne sont stockés qu'une seule fois.
 */
export async function syncJellyfinServer(
  url: string,
  apiKey: string,
  nemoUserId: string
): Promise<SyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const normalizedUrl = url.replace(/\/$/, "");
  const syncStart = Date.now();

  // 1. Info serveur
  const info = await jellyfinGet<{ ServerName: string }>(
    normalizedUrl, apiKey, "/System/Info"
  );
  console.log(`[Jellyfin Sync] → Connexion OK : ${info.ServerName} (${normalizedUrl})`);

  // 2. Upsert du serveur (URL unique — partagé entre tous les utilisateurs Nemo)
  const { data: serverData, error: serverErr } = await supabase
    .from("jellyfin_servers")
    .upsert(
      { url: normalizedUrl, server_name: info.ServerName },
      { onConflict: "url" }
    )
    .select("id")
    .single();

  if (serverErr || !serverData) {
    throw new Error(`Impossible d'enregistrer le serveur : ${serverErr?.message ?? "erreur inconnue"}`);
  }
  const serverId = serverData.id as string;
  console.log(`[Jellyfin Sync] Serveur ID : ${serverId}`);

  // 3. Récupération de tous les items (films + séries) via /Items (endpoint admin)
  const params = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    Limit: "10000",
    Fields: "ProviderIds",
    EnableImages: "false",
    EnableUserData: "false",
  });

  const { Items = [] } = await jellyfinGet<{ Items: JellyfinItem[] }>(
    normalizedUrl, apiKey, `/Items?${params}`
  );
  console.log(`[Jellyfin Sync] Items bruts reçus : ${Items.length}`);

  // 4. Filtrer les items avec un TMDB ID (les autres ne servent pas pour les badges)
  const toUpsert = Items
    .filter((item) => item.ProviderIds?.Tmdb)
    .map((item) => ({
      server_id: serverId,
      jellyfin_item_id: item.Id,
      tmdb_id: String(item.ProviderIds!.Tmdb),
      media_type: (item.Type === "Movie" ? "movie" : "tv") as "movie" | "tv",
      synced_at: new Date().toISOString(),
    }));

  const movieCount = toUpsert.filter((i) => i.media_type === "movie").length;
  const tvCount = toUpsert.filter((i) => i.media_type === "tv").length;
  console.log(`[Jellyfin Sync] Avec TMDB ID : ${toUpsert.length} (${movieCount} films, ${tvCount} séries)`);

  // Taille des batches pour tous les accès paginés Supabase
  const BATCH = 500;

  // 4b. Snapshot paginé des IDs existants AVANT l'upsert
  // ⚠️ Supabase limite à 1000 lignes par défaut — on doit paginer pour les grandes bibliothèques
  const existingIdsArr: string[] = [];
  let snapFrom = 0;
  while (true) {
    const { data: snapPage } = await supabase
      .from("jellyfin_server_items")
      .select("jellyfin_item_id")
      .eq("server_id", serverId)
      .range(snapFrom, snapFrom + BATCH - 1);
    if (!snapPage || snapPage.length === 0) break;
    for (const r of snapPage as { jellyfin_item_id: string }[]) {
      existingIdsArr.push(r.jellyfin_item_id);
    }
    if (snapPage.length < BATCH) break;
    snapFrom += BATCH;
  }
  const existingIds = new Set<string>(existingIdsArr);

  // 5. Upsert par batch
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    await supabase
      .from("jellyfin_server_items")
      .upsert(toUpsert.slice(i, i + BATCH), { onConflict: "server_id,jellyfin_item_id" });
  }

  // Supprimer les items qui ne sont plus dans le serveur (items retirés de la bibliothèque)
  if (toUpsert.length > 0) {
    const currentIds = toUpsert.map((i) => i.jellyfin_item_id);
    await supabase
      .from("jellyfin_server_items")
      .delete()
      .eq("server_id", serverId)
      .not("jellyfin_item_id", "in", `(${currentIds.map((id) => `'${id}'`).join(",")})`);
  }

  // 5b. Calcul du diff : items présents dans toUpsert mais absents avant la sync
  const newItems: NewItem[] = toUpsert
    .filter((item) => !existingIds.has(item.jellyfin_item_id))
    .map((item) => ({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      jellyfinItemId: item.jellyfin_item_id,
    }));

  if (newItems.length > 0) {
    console.log(`[Jellyfin Sync] 🆕 ${newItems.length} nouveaux items détectés`);
  }

  // 6. Mettre à jour les stats du serveur
  await supabase
    .from("jellyfin_servers")
    .update({
      synced_at: new Date().toISOString(),
      item_count: toUpsert.length,
    })
    .eq("id", serverId);

  // 7. Lier le profil utilisateur à ce serveur
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("webhook_token")
    .eq("id", nemoUserId)
    .single();

  await supabase
    .from("profiles")
    .update({
      personal_jellyfin_url: normalizedUrl,
      personal_jellyfin_api_key: apiKey,
      personal_jellyfin_server_id: serverId,
      last_library_sync_at: new Date().toISOString(),
      // Générer un webhook_token unique si pas encore présent
      ...(existingProfile?.webhook_token ? {} : { webhook_token: crypto.randomUUID() }),
    })
    .eq("id", nemoUserId);

  const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
  console.log(
    `[Jellyfin Sync] ✓ ${info.ServerName} — User ${nemoUserId} — ${movieCount} films, ${tvCount} séries — ${elapsed}s`
  );

  return { serverName: info.ServerName, movieCount, tvCount, totalSynced: toUpsert.length, newItems };
}

/**
 * Re-synchronise le serveur Jellyfin d'un utilisateur depuis son profil.
 * Utilisé par le bouton "Resynchroniser" et le webhook automatique.
 */
export async function syncJellyfinLibraryForUser(userId: string): Promise<{ synced: number; newItems: NewItem[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: cfg } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url, personal_jellyfin_api_key")
    .eq("id", userId)
    .single();

  if (!cfg?.personal_jellyfin_url || !cfg?.personal_jellyfin_api_key) {
    throw new Error("Jellyfin personnel non configuré pour cet utilisateur");
  }

  const result = await syncJellyfinServer(
    cfg.personal_jellyfin_url as string,
    cfg.personal_jellyfin_api_key as string,
    userId
  );

  return { synced: result.totalSynced, newItems: result.newItems };
}
