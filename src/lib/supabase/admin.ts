import { createClient } from "@supabase/supabase-js";
import type { Database, DownloadQueue } from "@/types/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Client Supabase avec la clé service role (côté serveur uniquement).
 * Utilisé par les API routes pour lire/écrire avec le jellyfin_user_id.
 * Ne pas exposer ce client au client.
 */
export function createAdminClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Client Supabase non-générique pour la table download_queue.
 * Nécessaire pour contourner une contrainte de typage de Supabase v2.98+
 * avec les tables ajoutées manuellement au type Database.
 */
export function createRawAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export type { DownloadQueue };
