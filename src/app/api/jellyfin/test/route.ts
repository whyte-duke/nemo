import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { testJellyfinConnection, syncJellyfinServer } from "@/lib/jellyfin/sync";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { url?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { url, apiKey } = body;
  if (!url || !apiKey) {
    return NextResponse.json({ error: "url et apiKey requis" }, { status: 400 });
  }

  // 1. Tester la connectivité (rapide)
  const testResult = await testJellyfinConnection(url, apiKey);
  if (!testResult.ok) {
    return NextResponse.json(testResult);
  }

  // 2. Connexion OK → synchronisation initiale + sauvegarde en DB
  console.log(`[Jellyfin Test] Connexion OK pour user ${user.id} — démarrage de la première sync…`);
  try {
    const syncResult = await syncJellyfinServer(url, apiKey, user.id);
    return NextResponse.json({
      ok: true,
      serverName: syncResult.serverName,
      movieCount: syncResult.movieCount,
      tvCount: syncResult.tvCount,
      totalSynced: syncResult.totalSynced,
    });
  } catch (err) {
    console.error("[Jellyfin Test] Sync échouée :", err);
    // La connexion est valide mais la sync a échoué — on retourne quand même ok=true avec l'erreur
    return NextResponse.json({
      ok: true,
      serverName: testResult.serverName,
      syncError: err instanceof Error ? err.message : "Erreur lors de la synchronisation",
    });
  }
}
