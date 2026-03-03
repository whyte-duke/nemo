"use client";

/**
 * @deprecated Ce hook était utilisé pour l'authentification Jellyfin.
 * Avec Supabase Auth, utiliser directement createClient().auth.signInWithPassword()
 * depuis les pages de connexion, ou useAuth() pour l'état utilisateur courant.
 */
export function useJellyfinAuth() {
  return {};
}
