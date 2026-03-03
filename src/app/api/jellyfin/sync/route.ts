import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { syncJellyfinLibraryForUser } from "@/lib/jellyfin/sync";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  try {
    const { synced } = await syncJellyfinLibraryForUser(user.id);
    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
