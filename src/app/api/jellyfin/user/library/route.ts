import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJellyfinClient } from "@/lib/jellyfin/client";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url, jellyfin_user_id, jellyfin_user_token")
    .eq("id", user.id)
    .single();

  if (!profile?.jellyfin_user_token || !profile?.jellyfin_user_id) {
    return NextResponse.json({ error: "Compte Jellyfin non connecté" }, { status: 401 });
  }
  if (!profile?.personal_jellyfin_url) {
    return NextResponse.json({ error: "Serveur Jellyfin non configuré" }, { status: 400 });
  }

  try {
    const client = createJellyfinClient(profile.personal_jellyfin_url as string);
    const items = await client.getLibraryItems(
      profile.jellyfin_user_token as string,
      profile.jellyfin_user_id as string
    );
    return NextResponse.json({ ...items, serverUrl: client.serverUrl });
  } catch (err) {
    console.error("[Jellyfin User Library]", err);
    return NextResponse.json({ error: "Erreur lors de la récupération" }, { status: 502 });
  }
}
