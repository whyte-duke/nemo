import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

export type UserRole = "free" | "sources" | "vip" | "admin";

/**
 * Retourne l'utilisateur Supabase Auth courant (lecture du JWT via cookie).
 * Ne fait aucun appel réseau externe — vérification locale du token.
 * Retourne null si l'utilisateur n'est pas authentifié.
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Retourne l'utilisateur et son display_name depuis les métadonnées Supabase.
 * Utile pour les routes qui ont besoin de l'identité complète (ex: download_queue.user_name).
 */
export async function getAuthUserWithName(): Promise<{
  id: string;
  name: string;
} | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const name =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Utilisateur";

  return { id: user.id, name };
}

/**
 * Retourne l'utilisateur avec son rôle (free | sources | vip).
 * Lit le rôle depuis la table profiles via le service role (contourne RLS).
 */
export async function getAuthUserWithRole(): Promise<{
  id: string;
  name: string;
  role: UserRole;
} | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const name =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Utilisateur";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (data?.role as UserRole | undefined) ?? "free";
  return { id: user.id, name, role };
}

/**
 * Vérifie que l'utilisateur courant possède le rôle minimum requis.
 * Ordre : free < sources < vip < admin
 */
export async function requireRole(
  minRole: UserRole
): Promise<{ id: string; name: string; role: UserRole } | null> {
  const user = await getAuthUserWithRole();
  if (!user) return null;
  const order: Record<UserRole, number> = { free: 0, sources: 1, vip: 2, admin: 3 };
  if (order[user.role] >= order[minRole]) return user;
  return null;
}
