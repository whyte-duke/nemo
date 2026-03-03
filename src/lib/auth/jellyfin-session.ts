import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/jellyfin/client";

const COOKIE_NAME = "jellyfin_token";

export interface JellyfinSessionUser {
  id: string;
  name: string;
}

/**
 * Récupère l'utilisateur Jellyfin courant à partir du cookie (côté serveur).
 * Retourne null si pas de token ou token invalide.
 */
export async function getJellyfinSession(): Promise<{
  user: JellyfinSessionUser;
  token: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const user = await getCurrentUser(token);
    return {
      user: { id: user.Id, name: user.Name },
      token,
    };
  } catch {
    return null;
  }
}

/**
 * Retourne uniquement l'utilisateur ou null. Utile pour les API qui n'ont pas besoin du token.
 */
export async function getJellyfinUser(): Promise<JellyfinSessionUser | null> {
  const session = await getJellyfinSession();
  return session?.user ?? null;
}
