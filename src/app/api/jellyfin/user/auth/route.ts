import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJellyfinClient } from "@/lib/jellyfin/client";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { username?: string; password?: string; serverUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "username et password requis" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Récupérer l'URL du serveur personnel depuis le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url")
    .eq("id", user.id)
    .single();

  const serverUrl: string | null = body.serverUrl ?? profile?.personal_jellyfin_url ?? null;
  if (!serverUrl) {
    return NextResponse.json(
      { error: "Aucun serveur Jellyfin configuré. Ajoutez d'abord l'URL de votre serveur." },
      { status: 400 }
    );
  }

  try {
    const client = createJellyfinClient(serverUrl);
    const result = await client.authenticateByName(username, password);

    await supabase
      .from("profiles")
      .update({
        jellyfin_user_id: result.User.Id,
        jellyfin_user_token: result.AccessToken,
        jellyfin_display_name: result.User.Name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({
      ok: true,
      displayName: result.User.Name,
      userId: result.User.Id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Échec de l'authentification";
    const isUnauthorized = msg.includes("401");
    return NextResponse.json(
      { error: isUnauthorized ? "Identifiants incorrects" : "Impossible de joindre le serveur Jellyfin" },
      { status: isUnauthorized ? 401 : 502 }
    );
  }
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  await supabase
    .from("profiles")
    .update({
      jellyfin_user_id: null,
      jellyfin_user_token: null,
      jellyfin_display_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
